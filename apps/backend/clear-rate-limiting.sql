-- Clear all rate limiting data to allow testing
-- Run these queries in your database to reset rate limiting

-- 1. Clear all rate limit attempts (IP and username based)
DELETE FROM rate_limit_attempts;

-- 2. Clear all failed login attempts
DELETE FROM failed_login_attempts;

-- 3. Clear all account lockouts
DELETE FROM account_lockouts;

-- Optional: Verify the tables are empty
-- SELECT COUNT(*) FROM rate_limit_attempts;
-- SELECT COUNT(*) FROM failed_login_attempts;
-- SELECT COUNT(*) FROM account_lockouts;

