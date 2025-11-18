# Complete CI/CD Setup Guide for D5 Management System

This guide walks you through setting up CI/CD from scratch, step by step.

## Prerequisites Checklist

- [ ] GitHub repository (public or private)
- [ ] Deployment server (Ubuntu 20.04+ / Debian 11+)
- [ ] SSH access to deployment server
- [ ] Domain name (optional, for SSL)
- [ ] Email address (for SSL certificates)

---

## Step 1: Generate SSH Keys for Deployment

### 1.1 Generate SSH Key Pair

```bash
# Generate a dedicated SSH key for CI/CD
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# When prompted, press Enter to use default location
# For passphrase, you can leave it empty (or set one for extra security)
```

This creates two files:
- `~/.ssh/github_actions_deploy` (private key - keep secret!)
- `~/.ssh/github_actions_deploy.pub` (public key - add to server)

### 1.2 Add Public Key to Your Server

```bash
# Copy public key to your server
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@your-server.com

# Or manually:
cat ~/.ssh/github_actions_deploy.pub | ssh user@your-server.com "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 1.3 Test SSH Connection

```bash
# Test that you can connect without password
ssh -i ~/.ssh/github_actions_deploy user@your-server.com
```

### 1.4 Copy Private Key Content

```bash
# Display the private key (you'll add this to GitHub Secrets)
cat ~/.ssh/github_actions_deploy
```

**Important**: Copy the ENTIRE output, including:
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- All the key content
- `-----END OPENSSH PRIVATE KEY-----`

---

## Step 2: Generate JWT Secrets

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate JWT Refresh Secret
openssl rand -base64 32
```

Save both outputs - you'll need them for GitHub Secrets.

---

## Step 3: Set Up GitHub Secrets

### 3.1 Navigate to GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret**

### 3.2 Add Staging Environment Secrets

Add these secrets with the `STAGING_` prefix:

| Secret Name | Value | How to Get |
|------------|-------|------------|
| `STAGING_SSH_USER` | Your SSH username | e.g., `deploy` or `root` |
| `STAGING_SSH_HOST` | Server IP or hostname | e.g., `staging.example.com` or `192.168.1.100` |
| `STAGING_SSH_PORT` | SSH port (optional) | Default: `22` |
| `STAGING_SSH_PRIVATE_KEY` | Private key content | From Step 1.4 (entire key) |
| `STAGING_DB_PASSWORD` | Database password | Choose a strong password |
| `STAGING_DOMAIN` | Staging domain | e.g., `staging.app.division5.co` |
| `STAGING_EMAIL` | Email for SSL | e.g., `admin@division5.co` |
| `STAGING_FRONTEND_URL` | Frontend URL | e.g., `https://staging.app.division5.co` |
| `STAGING_JWT_SECRET` | JWT secret | From Step 2 |
| `STAGING_JWT_REFRESH_SECRET` | JWT refresh secret | From Step 2 |

### 3.3 Add Production Environment Secrets

Add the same secrets with `PRODUCTION_` prefix:

| Secret Name | Value |
|------------|-------|
| `PRODUCTION_SSH_USER` | Your SSH username |
| `PRODUCTION_SSH_HOST` | Production server IP/hostname |
| `PRODUCTION_SSH_PORT` | SSH port (optional) |
| `PRODUCTION_SSH_PRIVATE_KEY` | Private key content |
| `PRODUCTION_DB_PASSWORD` | Database password |
| `PRODUCTION_DOMAIN` | Production domain |
| `PRODUCTION_EMAIL` | Email for SSL |
| `PRODUCTION_FRONTEND_URL` | Frontend URL |
| `PRODUCTION_JWT_SECRET` | JWT secret (different from staging!) |
| `PRODUCTION_JWT_REFRESH_SECRET` | JWT refresh secret (different from staging!) |

### 3.4 Optional Secrets (Add if needed)

#### SMTP Configuration
- `STAGING_SMTP_HOST` / `PRODUCTION_SMTP_HOST`
- `STAGING_SMTP_PORT` / `PRODUCTION_SMTP_PORT`
- `STAGING_SMTP_USER` / `PRODUCTION_SMTP_USER`
- `STAGING_SMTP_PASSWORD` / `PRODUCTION_SMTP_PASSWORD`
- `STAGING_SMTP_SECURE` / `PRODUCTION_SMTP_SECURE` (true/false)
- `STAGING_SMTP_REQUIRE_TLS` / `PRODUCTION_SMTP_REQUIRE_TLS` (true/false)
- `STAGING_EMAIL_FROM` / `PRODUCTION_EMAIL_FROM`

#### Google Drive Integration
- `STAGING_GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`
- `STAGING_GOOGLE_DRIVE_PRIVATE_KEY`
- `STAGING_GOOGLE_DRIVE_SHARED_DRIVE_ID`
- `STAGING_GOOGLE_DRIVE_SCOPES`
- `STAGING_GOOGLE_DRIVE_IMPERSONATE_USER`
- (Repeat for `PRODUCTION_*`)

#### Google Calendar Integration
- `STAGING_GOOGLE_CALENDAR_CLIENT_ID`
- `STAGING_GOOGLE_CALENDAR_CLIENT_SECRET`
- `STAGING_GOOGLE_CALENDAR_REDIRECT_URI`
- (Repeat for `PRODUCTION_*`)

#### Gemini AI Integration
- `STAGING_GEMINI_API_KEY`
- `STAGING_GEMINI_MODEL_ID` (optional, default: `gemini-1.5-pro-latest`)
- (Repeat for `PRODUCTION_*`)

---

## Step 4: Set Up Branch Protection (Recommended)

### 4.1 Protect Main Branch

1. Go to **Settings** → **Branches**
2. Click **Add rule** or edit existing rule for `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select: `lint-and-typecheck` (from CI workflow)

### 4.2 Set Up Environments (Optional but Recommended)

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `production`
4. Configure:
   - **Deployment branches**: Only `main` branch
   - **Required reviewers**: Add yourself or team members
   - **Wait timer**: Optional (e.g., 5 minutes for rollback window)

Repeat for `staging` environment (use `develop` branch).

---

## Step 5: Test CI Workflow

### 5.1 Create a Test Branch

```bash
# Create a new branch
git checkout -b test-ci

# Make a small change (e.g., update README)
echo "# Test CI" >> README.md

# Commit and push
git add README.md
git commit -m "Test CI workflow"
git push origin test-ci
```

### 5.2 Create Pull Request

1. Go to GitHub repository
2. Click **Pull requests** → **New pull request**
3. Select your test branch → `main`
4. Create pull request
5. Go to **Actions** tab to watch CI run

### 5.3 Verify CI Passes

- ✅ Lint should pass
- ✅ Type check should pass
- ✅ Build should succeed

---

## Step 6: Test Deployment Workflow

### 6.1 Test Staging Deployment

```bash
# Create and push to develop branch
git checkout -b develop
git push origin develop

# Or if develop exists:
git checkout develop
git merge main
git push origin develop
```

Watch the deployment in **Actions** tab.

### 6.2 Test Production Deployment (Manual)

1. Go to **Actions** tab
2. Select **Deploy D5 Management System** workflow
3. Click **Run workflow**
4. Select:
   - Branch: `main`
   - Environment: `production`
   - Skip tests: `false` (for first test)
5. Click **Run workflow**

### 6.3 Monitor Deployment

- Watch the workflow logs in real-time
- Check for any errors
- Verify deployment completes successfully

---

## Step 7: Verify Deployment

### 7.1 Check Application Status

```bash
# SSH into your server
ssh user@your-server.com

# Check if application is running
pm2 status

# Check application logs
pm2 logs d5-management-backend
pm2 logs d5-management-frontend

# Check nginx status
sudo systemctl status nginx
```

### 7.2 Test Application

1. Open your domain in browser: `https://your-domain.com`
2. Verify:
   - ✅ Application loads
   - ✅ Login works
   - ✅ Database connection works
   - ✅ API endpoints respond

### 7.3 Check SSL Certificate

```bash
# On server, check SSL
sudo certbot certificates

# Or test in browser - should show valid SSL
```

---

## Step 8: Set Up Monitoring (Optional but Recommended)

### 8.1 GitHub Actions Notifications

1. Go to **Settings** → **Notifications**
2. Enable email notifications for:
   - Workflow runs
   - Failed workflows

### 8.2 Server Monitoring

```bash
# Set up log monitoring
sudo journalctl -u d5-management -f

# Monitor disk space
df -h

# Monitor memory
free -h
```

### 8.3 Application Health Checks

Consider adding health check endpoints:
- Backend: `/health`
- Frontend: Check if static files serve correctly

---

## Step 9: Create Deployment Checklist

Create a checklist for each deployment:

- [ ] All tests pass
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Environment variables updated
- [ ] Secrets are correct
- [ ] Backup created (for production)
- [ ] Deployment tested in staging first
- [ ] Rollback plan ready

---

## Step 10: Document Your Setup

Update your team documentation with:
- Server IPs and access details
- Domain names
- Deployment process
- Rollback procedures
- Contact information for issues

---

## Troubleshooting Common Issues

### Issue: SSH Connection Fails

**Solution:**
```bash
# Verify SSH key format
cat ~/.ssh/github_actions_deploy | head -1
# Should show: -----BEGIN OPENSSH PRIVATE KEY-----

# Test SSH connection manually
ssh -i ~/.ssh/github_actions_deploy user@server.com

# Check server SSH logs
sudo tail -f /var/log/auth.log
```

### Issue: Deployment Fails with Permission Denied

**Solution:**
```bash
# On server, check permissions
ls -la /home/d5app/d5-management

# Ensure deploy user has sudo access
sudo visudo
# Add: deploy ALL=(ALL) NOPASSWD: /path/to/deploy.sh
```

### Issue: Database Connection Fails

**Solution:**
```bash
# Verify database is running
sudo systemctl status postgresql

# Check database user exists
sudo -u postgres psql -c "\du"

# Test connection
psql -U d5user -d d5_management -h localhost
```

### Issue: Build Fails

**Solution:**
- Check Node.js version matches (should be 20.x)
- Verify all dependencies are in package.json
- Check for TypeScript errors locally first

### Issue: SSL Certificate Fails

**Solution:**
```bash
# Check nginx configuration
sudo nginx -t

# Verify domain DNS points to server
dig your-domain.com

# Check certbot logs
sudo certbot certificates
sudo journalctl -u certbot
```

---

## Best Practices

1. **Always test in staging first**
   - Deploy to staging before production
   - Verify everything works

2. **Use feature branches**
   - Create branches for features
   - Open PRs for code review
   - Merge to develop for staging
   - Merge to main for production

3. **Keep secrets secure**
   - Never commit secrets
   - Rotate secrets regularly
   - Use different secrets for staging/production

4. **Monitor deployments**
   - Watch workflow logs
   - Check application after deployment
   - Monitor error logs

5. **Have a rollback plan**
   - Keep previous versions
   - Document rollback steps
   - Test rollback procedure

6. **Backup before production**
   - Database backup
   - Application files backup
   - Configuration backup

---

## Quick Reference Commands

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_deploy

# Generate JWT secret
openssl rand -base64 32

# Test SSH connection
ssh -i ~/.ssh/github_actions_deploy user@server.com

# Check deployment status
pm2 status
pm2 logs

# Check nginx
sudo nginx -t
sudo systemctl status nginx

# Check SSL
sudo certbot certificates
```

---

## Next Steps

1. ✅ Complete all steps above
2. ✅ Test staging deployment
3. ✅ Test production deployment
4. ✅ Set up monitoring
5. ✅ Document your specific setup
6. ✅ Train team members on deployment process

---

## Support

If you encounter issues:
1. Check GitHub Actions logs
2. Check server logs
3. Review this guide
4. Check `.github/DEPLOYMENT.md` for more details

