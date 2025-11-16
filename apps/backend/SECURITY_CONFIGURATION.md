# Security Configuration Guide

This guide covers all security-related configuration for the D5 Management System.

## Required Environment Variables

### Critical Security Variables (Required)

These must be set before the application can start:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/d5_management

# JWT Authentication (minimum 32 characters each)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-key-minimum-32-characters-long

# Data Encryption (64 hex characters)
ENCRYPTION_KEY=your_64_character_hex_string_here
```

**Generate JWT secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional Security Variables

```bash
# CORS Origins (comma-separated, REQUIRED in production)
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com

# JWT Token Expiry
JWT_EXPIRES_IN=15m              # Access token (default: 15m)
JWT_REFRESH_EXPIRES_IN=30d      # Refresh token (default: 30d)

# Environment
NODE_ENV=production             # production, development, staging, test
PORT=3000                       # Server port (default: 3000)
API_PREFIX=api                  # API path prefix (default: api)
```

## Production Security Checklist

### ✅ Before Deploying to Production

1. **Environment Variables**
   - [ ] All required variables are set
   - [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are at least 32 characters
   - [ ] `ENCRYPTION_KEY` is exactly 64 hex characters
   - [ ] `CORS_ORIGINS` is configured with your actual frontend URLs
   - [ ] `NODE_ENV=production` is set

2. **Database Security**
   - [ ] Database uses strong passwords
   - [ ] Database is not publicly accessible
   - [ ] Database backups are encrypted
   - [ ] Connection uses SSL/TLS

3. **HTTPS/TLS**
   - [ ] Application is behind a reverse proxy (Nginx/Apache)
   - [ ] HTTPS is enforced (redirect HTTP to HTTPS)
   - [ ] TLS 1.2+ is configured
   - [ ] SSL certificate is valid and not expired

4. **Secrets Management**
   - [ ] Secrets are stored in a secrets manager (not in code)
   - [ ] `.env` file is in `.gitignore`
   - [ ] No secrets are committed to version control
   - [ ] Secrets are rotated periodically

5. **CORS Configuration**
   - [ ] `CORS_ORIGINS` contains only your frontend domains
   - [ ] No wildcards (`*`) in production
   - [ ] Credentials are enabled (for HttpOnly cookies)

6. **Security Headers**
   - [ ] Helmet is configured (automatic)
   - [ ] HSTS is enabled in production (automatic)
   - [ ] CSP is configured (automatic in production)

7. **Logging**
   - [ ] No secrets are logged
   - [ ] Error logs don't expose sensitive data
   - [ ] Logs are stored securely

## CORS Configuration

### Development
```bash
# Allow all origins (for local development)
CORS_ORIGINS=
# Or specify localhost
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Production
```bash
# Only allow your actual frontend domains
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
```

**Important**: In production, if `CORS_ORIGINS` is not set, the application will:
- Block all CORS requests
- Exit with an error on startup

## Security Headers

The application automatically sets security headers via Helmet:

- **Content-Security-Policy**: Configured in production
- **HSTS**: Enabled in production (1 year, includeSubDomains, preload)
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Referrer-Policy**: Controls referrer information

## Token Security

### Access Tokens
- **Lifetime**: 15 minutes (configurable via `JWT_EXPIRES_IN`)
- **Storage**: `sessionStorage` in frontend (short-lived)
- **Purpose**: API authentication

### Refresh Tokens
- **Lifetime**: 30 days (configurable via `JWT_REFRESH_EXPIRES_IN`)
- **Storage**: HttpOnly cookie (not accessible to JavaScript)
- **Purpose**: Obtain new access tokens
- **Security**: Rotated on each use, tracked in database

## Rate Limiting

Global rate limiting is configured:
- **Window**: 60 seconds
- **Limit**: 100 requests per window
- **Applied to**: All endpoints (with `ThrottlerGuard`)

Additional rate limiting is applied to:
- `/auth/login`
- `/auth/refresh`
- `/auth/password-reset/request`

## Data Encryption

Sensitive fields are encrypted at rest:
- OAuth tokens (Google Calendar, Drive)
- 2FA secrets
- Customer tax IDs and registration IDs

See `ENCRYPTION_SETUP.md` for details.

## Validation

Environment variables are validated on startup:
- Required variables must be present
- Format validation (e.g., hex strings, minimum lengths)
- Application will not start if validation fails

## Troubleshooting

### "JWT_SECRET is too short"
- Ensure `JWT_SECRET` is at least 32 characters
- Generate a new one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "ENCRYPTION_KEY is invalid"
- Must be exactly 64 hex characters
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "CORS_ORIGINS must be configured in production"
- Set `CORS_ORIGINS` with your frontend URLs
- Format: `https://domain1.com,https://domain2.com`

### "Not allowed by CORS"
- Check that your frontend URL is in `CORS_ORIGINS`
- Ensure `withCredentials: true` is set in frontend API client
- Check browser console for exact error

## Security Best Practices

1. **Never commit secrets** to version control
2. **Rotate secrets** periodically (every 90 days recommended)
3. **Use different secrets** for each environment
4. **Monitor logs** for suspicious activity
5. **Keep dependencies updated** (`npm audit`)
6. **Use HTTPS** in production (never HTTP)
7. **Limit database access** to application servers only
8. **Regular backups** with encrypted storage
9. **Monitor failed login attempts**
10. **Review access logs** regularly

## Incident Response

If a security incident occurs:

1. **Rotate all secrets immediately**
   - JWT secrets
   - Encryption key (requires re-encrypting data)
   - Database passwords
   - OAuth credentials

2. **Review access logs** for unauthorized access

3. **Revoke all active sessions** (clear `user_sessions` table)

4. **Notify affected users** if data was compromised

5. **Document the incident** and remediation steps

