# Data Encryption Setup Guide

This application uses application-level encryption for sensitive data at rest using AES-256-GCM.

## Required Environment Variable

Add the following to your `.env` file:

```bash
# Generate a 32-byte (64 hex character) encryption key:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_character_hex_string_here
```

**IMPORTANT**: 
- Generate a strong, random key using the command above
- Store this key securely (use a secrets manager in production)
- **Never commit this key to version control**
- If you lose this key, encrypted data cannot be recovered

## Currently Encrypted Fields

### ✅ Implemented

1. **OAuth Tokens** (`UserCalendarIntegration` table)
   - `accessToken` - Encrypted
   - `refreshToken` - Encrypted
   - Used by: Google Calendar, Google Drive integrations

2. **Two-Factor Authentication Secrets** (`User` table)
   - `twoFactorSecret` - Encrypted
   - Used by: AuthService for TOTP 2FA

3. **Customer Sensitive Data** (`Customer` table)
   - `taxId` - Encrypted
   - `registrationId` - Encrypted
   - Used by: CustomersService

## Migration Notes

### Existing Data

If you have existing unencrypted data in the database:

1. **OAuth Tokens**: Will be automatically encrypted on next token refresh
2. **2FA Secrets**: Will be encrypted when users re-enable 2FA
3. **Customer Data**: Existing `taxId` and `registrationId` values will remain unencrypted until updated

### Future Encryption (Requires Schema Changes)

The following fields should be encrypted but require database schema migrations:

1. **Employee Salary** (`Employee.salary`)
   - Currently: `Decimal @db.Decimal(10, 2)`
   - Required change: Change to `String?` type
   - Migration needed: Create migration to change column type, then update EmployeesService

2. **Performance Review Data** (`PerformanceReview` table)
   - `ratings` (JSON) - Consider encrypting sensitive rating details
   - `strengths`, `improvements`, `goals` (Text) - May contain sensitive information
   - Migration needed: These are already text/JSON, just need service updates

## Testing Encryption

To verify encryption is working:

1. Check database directly - encrypted fields should be base64 strings (not readable)
2. Check API responses - fields should be decrypted and readable
3. Test OAuth flow - tokens should work normally (encryption is transparent)

## Security Best Practices

1. **Key Management**: Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) in production
2. **Key Rotation**: Plan for key rotation (requires re-encrypting all data)
3. **Backup**: Ensure encryption key is backed up securely
4. **Access Control**: Limit database access - even with encryption, principle of least privilege applies

## Troubleshooting

### "ENCRYPTION_KEY environment variable is required"

- Ensure `ENCRYPTION_KEY` is set in your `.env` file
- Restart the application after adding the variable

### Decryption fails for existing data

- The encryption service will return the original value if decryption fails (for legacy unencrypted data)
- This allows gradual migration
- New data will always be encrypted

### Performance Impact

- Encryption/decryption adds minimal overhead (< 1ms per operation)
- Consider caching decrypted values if needed for high-traffic endpoints

