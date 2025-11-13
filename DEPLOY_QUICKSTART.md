# One-Click Deployment - Quick Start

## 🚀 Quick Deployment

### Option 1: Remote Deployment (Recommended for Windows)

Deploy directly from your local machine (Windows/Linux/Mac) to a remote Ubuntu server:

**From Windows (using Git Bash, WSL, or PowerShell with OpenSSH):**
```bash
# Basic remote deployment
./deploy.sh --remote ubuntu@your-server-ip

# With SSH key
./deploy.sh --remote ubuntu@your-server-ip --key ~/.ssh/id_rsa

# With custom SSH port
./deploy.sh --remote ubuntu@your-server-ip --port 2222

# Deploy from Git repository (clones on remote server)
./deploy.sh --remote ubuntu@your-server-ip --repo https://github.com/user/repo.git

# Show help
./deploy.sh --help
```

**What it does:**
- Tests SSH connection to your server
- Copies project files to the remote server
- Executes the deployment script on the remote server
- All installation happens on the remote server automatically

### Option 2: Deploy Locally on Server

If you're already on the Ubuntu server:

```bash
# 1. Make script executable
chmod +x deploy.sh

# 2. Run deployment
./deploy.sh
```

### Option 3: Deploy from Git Repository (on server)

If your code is in a Git repository:

```bash
# 1. SSH into your server
ssh user@your-server-ip

# 2. Clone the repository
git clone <your-repo-url> d5-management
cd d5-management

# 3. Make script executable and run
chmod +x deploy.sh
./deploy.sh
```

## 📋 What the Script Does

The deployment script automates:

1. ✅ System updates and dependency installation
2. ✅ Node.js 20.x installation
3. ✅ PostgreSQL installation and database setup
4. ✅ Nginx installation and configuration
5. ✅ PM2 process manager setup
6. ✅ Application deployment
7. ✅ Environment configuration
8. ✅ Database migrations
9. ✅ Application building
10. ✅ SSL certificate setup (if domain provided)
11. ✅ Firewall configuration

## 🔧 What You'll Need to Provide

The script will prompt you for:

- **Domain name** (optional) - e.g., `example.com`
- **Email address** (optional) - for SSL certificate
- **Database password** - for PostgreSQL user
- **JWT secrets** (optional) - will auto-generate if not provided

## 📝 Example Sessions

### Remote Deployment Example

```bash
$ ./deploy.sh --remote ubuntu@192.168.1.100

========================================
Remote Deployment Mode
========================================

ℹ️  Target: ubuntu@192.168.1.100:22

========================================
Testing SSH Connection
========================================

ℹ️  Connecting to ubuntu@192.168.1.100:22...
✅ SSH connection successful

========================================
Preparing Files for Transfer
========================================

ℹ️  Copying deployment script...
ℹ️  Copying project files...

========================================
Transferring Files to Remote Server
========================================

ℹ️  Remote temp directory: /tmp/tmp.XXXXXX
ℹ️  Uploading deployment script...
ℹ️  Uploading project files (this may take a while)...

========================================
Executing Deployment on Remote Server
========================================

⚠️  You will be prompted for configuration on the remote server
ℹ️  The deployment will run interactively on: ubuntu@192.168.1.100

... [deployment runs on remote server] ...

========================================
Remote Deployment Complete! 🎉
========================================

✅ Application has been deployed to ubuntu@192.168.1.100
```

### Local Deployment Example

```bash
$ ./deploy.sh

========================================
D5 Management System - Deployment Script
========================================

ℹ️  This script will install and configure the D5 Management System
ℹ️  Press Ctrl+C to cancel at any time

✅ OS detected: Ubuntu 22.04.3 LTS

========================================
Configuration
========================================

Enter your domain name (e.g., example.com) [optional]: example.com
Enter your email for SSL certificate [optional]: admin@example.com
Enter database password for d5user: [hidden]
Confirm database password: [hidden]
Enter JWT secret (or press Enter to generate): [Enter]
Enter JWT refresh secret (or press Enter to generate): [Enter]

... [installation proceeds automatically] ...

========================================
Deployment Complete! 🎉
========================================

Application Information:
  Frontend: https://example.com
  API: https://example.com/api
  API Docs: https://example.com/api/docs
```

## 🔄 Updating the Application

After initial deployment, use the update script:

```bash
cd /home/d5app/d5-management
./update.sh
```

Or manually:

```bash
cd /home/d5app/d5-management
git pull
npm install
cd apps/backend && npm run build && npx prisma migrate deploy
cd ../frontend && npm run build
cd ../..
pm2 restart d5-backend
```

## 🛠️ Post-Deployment Configuration

After deployment, configure these in `/home/d5app/d5-management/apps/backend/.env`:

1. **Email Settings** - SMTP configuration
2. **Google Drive** - Service account credentials
3. **Gemini API** - API key for AI features

Then restart:

```bash
pm2 restart d5-backend
```

## 📊 Monitoring

```bash
# View application logs
pm2 logs d5-backend

# Monitor resources
pm2 monit

# Check status
pm2 status

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## 🔐 Security Checklist

After deployment:

- [ ] Change default test user passwords
- [ ] Configure email settings
- [ ] Set up database backups
- [ ] Review firewall rules: `sudo ufw status`
- [ ] Enable automatic security updates
- [ ] Configure monitoring/alerting

## 🐛 Troubleshooting

### Remote deployment: Cannot connect to server

```bash
# Test SSH connection manually
ssh ubuntu@your-server-ip

# Check if SSH key is authorized
ssh -i ~/.ssh/id_rsa ubuntu@your-server-ip

# Verify firewall allows SSH
# On server: sudo ufw status
```

### Script fails with permission errors

```bash
# Make sure you're not running as root
# The script will use sudo when needed
```

### Database connection fails

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U d5user -d d5_management -h localhost
```

### Application won't start

```bash
# Check PM2 logs
pm2 logs d5-backend

# Check environment variables
cat /home/d5app/d5-management/apps/backend/.env
```

### Nginx 502 error

```bash
# Check if backend is running
pm2 status

# Test backend directly
curl http://localhost:3000/api/health
```

## 📞 Support

For issues:
1. Check the logs: `pm2 logs d5-backend`
2. Review the full deployment guide: `DEPLOYMENT_UBUNTU.md`
3. Check application status: `pm2 status`

