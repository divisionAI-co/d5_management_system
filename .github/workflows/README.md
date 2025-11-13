# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing and deployment.

## Workflows

### `ci.yml` - Continuous Integration
- Runs on: Pull requests and pushes to main/master
- What it does:
  - Lints backend and frontend code
  - Type checks TypeScript
  - Builds both applications
  - Ensures code quality before merging

### `deploy.yml` - Production Deployment
- Runs on: Pushes to main/master branch (or manual trigger)
- What it does:
  - Deploys the application to your remote server
  - Uses the `deploy.sh` script
  - Runs in non-interactive mode

## Setup Instructions

### 1. Generate SSH Key for CI/CD

```bash
# Generate a dedicated SSH key for CI/CD
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_deploy_key -N ""

# Copy the PUBLIC key to your server
ssh-copy-id -i ~/.ssh/github_deploy_key.pub user@your-server

# Or manually add to server:
cat ~/.ssh/github_deploy_key.pub | ssh user@your-server "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 2. Add Secrets to GitHub

Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

#### Required:
- `SSH_PRIVATE_KEY` - The **private** key content (entire content of `~/.ssh/github_deploy_key`)
- `SSH_HOST` - Your server IP or hostname (e.g., `division5.co`)
- `SSH_USER` - SSH username (e.g., `deploy` or `root`)
- `DEPLOY_DB_PASSWORD` - Database password for `d5user`

#### Optional:
- `SSH_PORT` - SSH port (default: 22)
- `DEPLOY_DOMAIN` - Your domain name (e.g., `example.com`)
- `DEPLOY_EMAIL` - Email for SSL certificate
- `DEPLOY_JWT_SECRET` - JWT secret (will auto-generate if not provided)
- `DEPLOY_JWT_REFRESH_SECRET` - JWT refresh secret (will auto-generate if not provided)
- `NGINX_PORT` - Nginx port if port 80 is in use (default: 8080)

### 3. Test the Workflow

1. Push to `main` or `master` branch
2. Go to **Actions** tab in GitHub
3. Watch the workflow run
4. Check deployment logs

## Security Notes

- **Never commit SSH private keys** to the repository
- Use GitHub Secrets for all sensitive data
- The SSH key should have minimal permissions (only deploy access)
- Consider using a dedicated deploy user instead of root

## Manual Deployment

You can also trigger deployment manually:
1. Go to **Actions** tab
2. Select **Deploy to Production** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## Troubleshooting

### SSH Connection Fails
- Verify `SSH_HOST` and `SSH_USER` are correct
- Check `SSH_PRIVATE_KEY` is the full private key (including `-----BEGIN` and `-----END` lines)
- Ensure SSH key is added to server's `authorized_keys`

### Deployment Fails
- Check workflow logs in GitHub Actions
- Verify all required secrets are set
- Ensure server has required dependencies (Node.js, PostgreSQL, etc.)

