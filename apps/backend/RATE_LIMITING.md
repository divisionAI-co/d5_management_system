# Rate Limiting & Account Security

This document describes the enhanced rate limiting and account security features.

## Features

### 1. Per-IP Rate Limiting
- **Limit**: 5 login attempts per 15 minutes per IP address
- **Purpose**: Prevents brute-force attacks from a single IP
- **Storage**: Tracked in `rate_limit_attempts` table

### 2. Per-Username Rate Limiting
- **Limit**: 5 login attempts per 15 minutes per email/username
- **Purpose**: Prevents targeted attacks on specific accounts
- **Storage**: Tracked in `rate_limit_attempts` table

### 3. Account Lockout
- **Trigger**: 5 failed login attempts within 15 minutes
- **Duration**: 30 minutes (configurable)
- **Storage**: Tracked in `account_lockouts` table
- **Auto-unlock**: Account automatically unlocks after lockout period expires

### 4. Global Rate Limiting
- **Limit**: 100 requests per 60 seconds (all endpoints)
- **Purpose**: General API protection
- **Implementation**: NestJS Throttler

## Configuration

Environment variables (optional, defaults shown):

```bash
# Rate limiting
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes in milliseconds
RATE_LIMIT_MAX_ATTEMPTS=5            # Max attempts per window

# Account lockout
MAX_FAILED_LOGIN_ATTEMPTS=5          # Attempts before lockout
ACCOUNT_LOCKOUT_DURATION_MS=1800000  # 30 minutes in milliseconds
```

## Database Schema

### RateLimitAttempt
Tracks rate limiting attempts:
- `identifier`: IP address or email/username
- `type`: "ip" or "username"
- `success`: Whether the attempt was successful
- `createdAt`: Timestamp

### FailedLoginAttempt
Tracks failed login attempts per user:
- `userId`: User who attempted login
- `email`: Email used in attempt
- `createdAt`: Timestamp

### AccountLockout
Tracks locked accounts:
- `userId`: Locked user
- `lockedUntil`: When the lockout expires
- `reason`: Reason for lockout (e.g., "Too many failed login attempts")

## How It Works

### Login Flow

1. **Rate Limit Check** (`LoginRateLimitGuard`)
   - Checks IP-based rate limit
   - Checks username-based rate limit (if email provided)
   - Blocks request if limits exceeded

2. **Account Lockout Check** (`AccountLockoutGuard`)
   - Checks if account is locked
   - Blocks request if account is locked
   - Returns lockout expiration time

3. **Authentication** (`AuthService`)
   - Validates credentials
   - Returns success or failure

4. **Post-Authentication**
   - **On Success**:
     - Clears failed login attempts
     - Clears account lockout
     - Records successful attempt
   - **On Failure**:
     - Records failed attempt
     - Records rate limit attempt
     - Locks account if threshold reached

## API Responses

### Rate Limit Exceeded (429)
```json
{
  "statusCode": 429,
  "message": "Too many login attempts from this IP address. Please try again later.",
  "retryAfter": 450
}
```

### Account Locked (423)
```json
{
  "statusCode": 423,
  "message": "Account is temporarily locked due to too many failed login attempts. Please try again in 25 minute(s).",
  "lockedUntil": "2024-01-15T10:30:00Z"
}
```

## Testing

### Test Rate Limiting

```bash
# Make 6 rapid login attempts (should fail on 6th)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo ""
done
```

### Test Account Lockout

1. Make 5 failed login attempts with the same email
2. 6th attempt should return 423 (Account Locked)
3. Wait 30 minutes (or reduce `ACCOUNT_LOCKOUT_DURATION_MS` for testing)
4. Account should be unlocked automatically

## Cleanup

The system automatically cleans up old records:
- **Rate Limit Attempts**: Deleted after 1 hour
- **Failed Login Attempts**: Cleared on successful login
- **Account Lockouts**: Automatically removed when expired

## Manual Account Unlock

To manually unlock an account (admin operation):

```sql
DELETE FROM account_lockouts WHERE user_id = 'user-id-here';
DELETE FROM failed_login_attempts WHERE user_id = 'user-id-here';
```

Or via Prisma Studio:
1. Open `npx prisma studio`
2. Navigate to `account_lockouts` table
3. Delete the lockout record for the user

## Security Considerations

1. **IP Spoofing**: Rate limiting by IP can be bypassed with IP rotation. Username-based limiting provides additional protection.

2. **Distributed Attacks**: If an attacker uses many IPs, per-IP limiting won't help. Per-username limiting still protects individual accounts.

3. **Legitimate Users**: Legitimate users locked out can contact support for manual unlock.

4. **Lockout Duration**: 30 minutes balances security with user experience. Adjust based on your threat model.

5. **Database Performance**: Indexes on `identifier`, `type`, and `createdAt` ensure fast lookups.

## Monitoring

Monitor these metrics:
- Failed login attempts per user
- Locked accounts count
- Rate limit violations by IP
- Unlock requests from users

## Future Enhancements

Potential improvements:
- [ ] Progressive lockout (longer duration after each lockout)
- [ ] Email notification on account lockout
- [ ] Admin dashboard for viewing lockouts
- [ ] Whitelist trusted IPs
- [ ] CAPTCHA after N failed attempts
- [ ] Rate limiting for password reset endpoints

