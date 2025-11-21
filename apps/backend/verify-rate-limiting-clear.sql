SELECT 'rate_limit_attempts' as table_name, COUNT(*) as count FROM rate_limit_attempts
UNION ALL
SELECT 'failed_login_attempts', COUNT(*) FROM failed_login_attempts
UNION ALL
SELECT 'account_lockouts', COUNT(*) FROM account_lockouts;

