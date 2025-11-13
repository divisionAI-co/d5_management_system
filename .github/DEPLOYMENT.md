# GitHub Actions Deployment Guide

This guide explains how to set up and use GitHub Actions for deploying the D5 Management System.

## Overview

The deployment workflow supports two environments:
- **Staging**: Deploys when pushing to `develop` branch
- **Production**: Deploys when pushing to `main` branch

You can also manually trigger deployments using the "Run workflow" button in GitHub Actions.

## Prerequisites

1. **GitHub Repository**: Your code should be in a GitHub repository
2. **Deployment Server**: A server (Ubuntu/Debian) accessible via SSH
3. **SSH Access**: SSH key pair for server access
4. **GitHub Secrets**: All required secrets configured (see below)

## Setting Up GitHub Secrets

### Required Secrets

#### Staging Environment Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | Example |
|------------|-------------|---------|
| `STAGING_SSH_USER` | SSH username for staging server | `deploy` |
| `STAGING_SSH_HOST` | Staging server hostname or IP | `staging.example.com` |
| `STAGING_SSH_PORT` | SSH port (optional, defaults to 22) | `22` |
| `STAGING_SSH_PRIVATE_KEY` | SSH private key for staging server | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `STAGING_DB_PASSWORD` | Database password for staging | `your-staging-db-password` |
| `STAGING_DOMAIN` | Staging domain name | `staging.app.division5.co` |
| `STAGING_EMAIL` | Email for SSL certificates | `admin@division5.co` |
| `STAGING_FRONTEND_URL` | Frontend URL for staging | `https://staging.app.division5.co` |
| `STAGING_JWT_SECRET` | JWT secret for staging | Generate with `openssl rand -base64 32` |
| `STAGING_JWT_REFRESH_SECRET` | JWT refresh secret for staging | Generate with `openssl rand -base64 32` |

#### Production Environment Secrets

| Secret Name | Description | Example |
|------------|-------------|---------|
| `PRODUCTION_SSH_USER` | SSH username for production server | `deploy` |
| `PRODUCTION_SSH_HOST` | Production server hostname or IP | `app.division5.co` |
| `PRODUCTION_SSH_PORT` | SSH port (optional, defaults to 22) | `22` |
| `PRODUCTION_SSH_PRIVATE_KEY` | SSH private key for production server | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `PRODUCTION_DB_PASSWORD` | Database password for production | `your-production-db-password` |
| `PRODUCTION_DOMAIN` | Production domain name | `app.division5.co` |
| `PRODUCTION_EMAIL` | Email for SSL certificates | `admin@division5.co` |
| `PRODUCTION_FRONTEND_URL` | Frontend URL for production | `https://app.division5.co` |
| `PRODUCTION_JWT_SECRET` | JWT secret for production | Generate with `openssl rand -base64 32` |
| `PRODUCTION_JWT_REFRESH_SECRET` | JWT refresh secret for production | Generate with `openssl rand -base64 32` |

### Optional Secrets

#### SMTP Configuration (Optional)

| Secret Name | Description | Default |
|------------|-------------|---------|
| `STAGING_SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `STAGING_SMTP_PORT` | SMTP server port | `587` |
| `STAGING_SMTP_USER` | SMTP username | - |
| `STAGING_SMTP_PASSWORD` | SMTP password | - |
| `STAGING_SMTP_SECURE` | Use SSL/TLS | `false` |
| `STAGING_SMTP_REQUIRE_TLS` | Require TLS | `false` |
| `STAGING_EMAIL_FROM` | From email address | `noreply@<domain>` |

(Repeat for `PRODUCTION_*` variants)

#### Google Drive Integration (Optional)

| Secret Name | Description |
|------------|-------------|
| `STAGING_GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL` | Google Drive service account email |
| `STAGING_GOOGLE_DRIVE_PRIVATE_KEY` | Google Drive private key (full key) |
| `STAGING_GOOGLE_DRIVE_SHARED_DRIVE_ID` | Google Drive shared drive ID |
| `STAGING_GOOGLE_DRIVE_SCOPES` | Google Drive scopes |
| `STAGING_GOOGLE_DRIVE_IMPERSONATE_USER` | User to impersonate |

(Repeat for `PRODUCTION_*` variants)

#### Google Calendar Integration (Optional)

| Secret Name | Description |
|------------|-------------|
| `STAGING_GOOGLE_CALENDAR_CLIENT_ID` | Google Calendar OAuth client ID |
| `STAGING_GOOGLE_CALENDAR_CLIENT_SECRET` | Google Calendar OAuth client secret |
| `STAGING_GOOGLE_CALENDAR_REDIRECT_URI` | Google Calendar OAuth redirect URI |

(Repeat for `PRODUCTION_*` variants)

#### Gemini AI Integration (Optional)

| Secret Name | Description |
|------------|-------------|
| `STAGING_GEMINI_API_KEY` | Gemini API key |
| `STAGING_GEMINI_MODEL_ID` | Gemini model ID (default: `gemini-1.5-pro-latest`) |

(Repeat for `PRODUCTION_*` variants)

## Generating Secrets

### Generate JWT Secrets

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate JWT Refresh Secret
openssl rand -base64 32
```

### Generate SSH Key

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@your-server.com

# Copy private key content to GitHub Secrets
cat ~/.ssh/github_actions_deploy
```

## Setting Up SSH Access

1. **Generate SSH Key Pair** (see above)

2. **Add Public Key to Server**:
   ```bash
   # On your server
   mkdir -p ~/.ssh
   chmod 700 ~/.ssh
   echo "your-public-key-here" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

3. **Test SSH Connection**:
   ```bash
   ssh -i ~/.ssh/github_actions_deploy user@your-server.com
   ```

4. **Add Private Key to GitHub Secrets**:
   - Copy the entire private key content (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`)
   - Add it to `STAGING_SSH_PRIVATE_KEY` or `PRODUCTION_SSH_PRIVATE_KEY`

## Deployment Workflow

### Automatic Deployment

- **Staging**: Automatically deploys when you push to `develop` branch
- **Production**: Automatically deploys when you push to `main` branch

### Manual Deployment

1. Go to **Actions** tab in GitHub
2. Select **Deploy D5 Management System** workflow
3. Click **Run workflow**
4. Choose environment (staging or production)
5. Optionally skip tests
6. Click **Run workflow**

## Workflow Steps

1. **Run Tests**: Type checks and tests (can be skipped)
2. **Checkout Code**: Gets the latest code from repository
3. **Setup Deployment**: Installs required tools (rsync, ssh-client)
4. **Configure SSH**: Sets up SSH key for server access
5. **Deploy**: Runs `deploy.sh` script on the server via SSH
6. **Notify**: Reports deployment status

## Troubleshooting

### SSH Connection Failed

- Verify SSH key is correctly added to GitHub Secrets
- Check SSH key format (should include header and footer)
- Ensure server allows SSH connections
- Verify SSH host and port are correct

### Deployment Failed

- Check GitHub Actions logs for specific error messages
- Verify all required secrets are set
- Ensure server has required dependencies (Node.js, PostgreSQL, etc.)
- Check server disk space and permissions

### Database Connection Failed

- Verify database password is correct
- Ensure database server is accessible
- Check database user has required permissions

### Permission Denied

- Ensure SSH user has sudo permissions
- Check file permissions on server
- Verify application user exists and has correct permissions

## Security Best Practices

1. **Use Strong Secrets**: Generate strong, random passwords and secrets
2. **Rotate Secrets Regularly**: Change secrets periodically
3. **Limit SSH Access**: Restrict SSH access to specific IPs if possible
4. **Use Environment Protection**: Use GitHub environment protection rules for production
5. **Review Actions**: Regularly review GitHub Actions logs for suspicious activity
6. **Keep Secrets Secure**: Never commit secrets to the repository

## Environment Protection Rules

For production deployments, consider setting up environment protection rules:

1. Go to **Settings → Environments → New environment**
2. Name it `production`
3. Add required reviewers
4. Add deployment branches (only `main`)
5. Add wait timer (optional)

This ensures production deployments require approval.

## Monitoring

- Check GitHub Actions tab for deployment status
- Monitor server logs: `journalctl -u d5-management -f`
- Check application logs: `/home/d5app/d5-management/logs/`
- Monitor database connections and performance

## Rollback

If deployment fails, you can rollback by:

1. Reverting to previous commit
2. Manually running deployment for that commit
3. Or restoring from backup on server

## Support

For issues or questions:
1. Check GitHub Actions logs
2. Review server logs
3. Check deployment script output
4. Contact the development team

