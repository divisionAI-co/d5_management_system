# Ubuntu Server Deployment Guide

Complete guide for deploying the D5 Management System to an Ubuntu server.

## 📋 Prerequisites

- Ubuntu 20.04 LTS or higher (22.04 LTS recommended)
- Root or sudo access
- Domain name (optional, but recommended)
- Minimum 2GB RAM, 2 CPU cores, 20GB storage

---

## 🔧 Step 1: Server Initial Setup

### 1.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Create Application User

```bash
# Create a non-root user for the application
sudo adduser --disabled-password --gecos "" d5app
sudo usermod -aG sudo d5app

# Switch to the application user
su - d5app
```

### 1.3 Install Essential Tools

```bash
sudo apt install -y curl wget git build-essential
```

---

## 🗄️ Step 2: Install PostgreSQL

### 2.1 Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
```

### 2.2 Start and Enable PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.3 Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE d5_management;
CREATE USER d5user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE d5_management TO d5user;
ALTER DATABASE d5_management OWNER TO d5user;
\q
```

**Note:** Replace `your_secure_password_here` with a strong password.

### 2.4 Configure PostgreSQL (Optional - for remote access)

```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/*/main/postgresql.conf

# Find and uncomment:
# listen_addresses = 'localhost'

# Edit pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Add line (for local connections):
# host    d5_management    d5user    127.0.0.1/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 📦 Step 3: Install Node.js

### 3.1 Install Node.js 18+ (using NodeSource)

```bash
# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version   # Should be 9.x.x or higher
```

### 3.2 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

---

## 🌐 Step 4: Install and Configure Nginx

### 4.1 Install Nginx

```bash
sudo apt install -y nginx
```

### 4.2 Start and Enable Nginx

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4.3 Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

---

## 📥 Step 5: Deploy Application

### 5.1 Clone Repository

```bash
# As d5app user
cd /home/d5app
git clone <your-repository-url> d5-management
cd d5-management
```

**Or upload files via SCP/SFTP:**
```bash
# From your local machine
scp -r . d5app@your-server-ip:/home/d5app/d5-management
```

### 5.2 Install Dependencies

```bash
cd /home/d5app/d5-management
npm install
```

---

## ⚙️ Step 6: Configure Environment Variables

### 6.1 Backend Configuration

```bash
cd /home/d5app/d5-management/apps/backend
cp .env.example .env
nano .env
```

**Edit `.env` with production values:**

```env
# Environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL="postgresql://d5user:your_secure_password_here@localhost:5432/d5_management?schema=public"

# JWT Secrets (GENERATE STRONG RANDOM STRINGS!)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-characters-long
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS (replace with your domain)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# API Prefix
API_PREFIX=api

# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Google Drive (if using)
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=service-account@your-project.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_SHARED_DRIVE_ID=your-shared-drive-id

# Gemini API (if using)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL_ID=gemini-1.5-pro-latest
```

**Generate secure JWT secrets:**
```bash
# Generate random secrets
openssl rand -base64 32
openssl rand -base64 32
```

### 6.2 Frontend Configuration

```bash
cd /home/d5app/d5-management/apps/frontend
cp .env.example .env
nano .env
```

**Edit `.env` with production values:**

```env
VITE_API_URL=https://yourdomain.com/api
VITE_APP_NAME=D5 Management System
```

---

## 🗃️ Step 7: Database Setup

### 7.1 Generate Prisma Client

```bash
cd /home/d5app/d5-management/apps/backend
npx prisma generate
```

### 7.2 Run Migrations

```bash
# Apply all migrations
npx prisma migrate deploy
```

### 7.3 (Optional) Seed Initial Data

```bash
npm run seed
```

---

## 🏗️ Step 8: Build Application

### 8.1 Build Backend

```bash
cd /home/d5app/d5-management/apps/backend
npm run build
```

### 8.2 Build Frontend

```bash
cd /home/d5app/d5-management/apps/frontend
npm run build
```

The frontend build output will be in `apps/frontend/dist/`

---

## 🚀 Step 9: Configure PM2

### 9.1 Create PM2 Ecosystem File

```bash
cd /home/d5app/d5-management
nano ecosystem.config.js
```

**Create `ecosystem.config.js`:**

```javascript
module.exports = {
  apps: [
    {
      name: 'd5-backend',
      script: './apps/backend/dist/main.js',
      cwd: '/home/d5app/d5-management',
      instances: 2, // or 'max' for all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/home/d5app/.pm2/logs/d5-backend-error.log',
      out_file: '/home/d5app/.pm2/logs/d5-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
    },
  ],
};
```

### 9.2 Start Application with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Follow the command output to enable PM2 on system boot
```

### 9.3 PM2 Useful Commands

```bash
pm2 status          # Check status
pm2 logs d5-backend  # View logs
pm2 restart d5-backend  # Restart
pm2 stop d5-backend     # Stop
pm2 delete d5-backend   # Remove
pm2 monit           # Monitor resources
```

---

## 🌐 Step 10: Configure Nginx

### 10.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/d5-management
```

**Configuration file:**

```nginx
# Backend API
upstream backend {
    server localhost:3000;
    keepalive 64;
}

# Frontend and API Server
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (React app)
    location / {
        root /home/d5app/d5-management/apps/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API Documentation
    location /api/docs {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Max upload size (adjust as needed)
    client_max_body_size 50M;
}
```

**Replace `yourdomain.com` with your actual domain.**

### 10.2 Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/d5-management /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔒 Step 11: SSL Certificate (Let's Encrypt)

### 11.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 11.2 Obtain SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Follow the prompts:**
- Enter your email
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### 11.3 Auto-Renewal

Certbot automatically sets up auto-renewal. Test it:

```bash
sudo certbot renew --dry-run
```

---

## ✅ Step 12: Verify Deployment

### 12.1 Check Services

```bash
# Check PM2
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql

# Check backend logs
pm2 logs d5-backend --lines 50
```

### 12.2 Test Endpoints

```bash
# API Health (adjust domain)
curl http://localhost:3000/api/health

# Frontend
curl http://localhost
```

### 12.3 Access Application

- **Frontend**: `https://yourdomain.com`
- **API**: `https://yourdomain.com/api`
- **API Docs**: `https://yourdomain.com/api/docs`

---

## 🔄 Step 13: Deployment Updates

### 13.1 Update Script

Create a deployment script:

```bash
cd /home/d5app/d5-management
nano deploy.sh
```

**`deploy.sh`:**

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build backend
cd apps/backend
npm run build
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build frontend
cd ../frontend
npm run build

# Restart backend
cd ../..
pm2 restart d5-backend

echo "✅ Deployment complete!"
```

**Make it executable:**
```bash
chmod +x deploy.sh
```

### 13.2 Run Updates

```bash
./deploy.sh
```

---

## 📊 Step 14: Monitoring and Maintenance

### 14.1 Set Up Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 14.2 Monitor Resources

```bash
# PM2 monitoring
pm2 monit

# System resources
htop  # Install: sudo apt install htop
```

### 14.3 Database Backups

Create backup script:

```bash
nano /home/d5app/backup-db.sh
```

**`backup-db.sh`:**

```bash
#!/bin/bash
BACKUP_DIR="/home/d5app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U d5user -d d5_management > $BACKUP_DIR/d5_management_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete

echo "Backup created: $BACKUP_DIR/d5_management_$DATE.sql"
```

**Make executable and add to crontab:**
```bash
chmod +x /home/d5app/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/d5app/backup-db.sh
```

---

## 🐛 Troubleshooting

### Backend Not Starting

```bash
# Check logs
pm2 logs d5-backend

# Check environment variables
cd apps/backend
cat .env

# Test database connection
psql -U d5user -d d5_management -h localhost
```

### Nginx 502 Bad Gateway

```bash
# Check if backend is running
pm2 status

# Check backend logs
pm2 logs d5-backend

# Test backend directly
curl http://localhost:3000/api/health
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U d5user -d d5_management -h localhost

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Frontend Not Loading

```bash
# Check build output exists
ls -la apps/frontend/dist

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify file permissions
sudo chown -R d5app:d5app /home/d5app/d5-management
```

---

## 🔐 Security Checklist

- [ ] Changed all default passwords
- [ ] Generated strong JWT secrets
- [ ] Configured firewall (UFW)
- [ ] SSL certificate installed
- [ ] Nginx security headers configured
- [ ] Database user has limited privileges
- [ ] Application runs as non-root user
- [ ] Environment variables secured (`.env` not in git)
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`
- [ ] Database backups configured

---

## 📝 Quick Reference

### Important Paths

- **Application**: `/home/d5app/d5-management`
- **Backend**: `/home/d5app/d5-management/apps/backend`
- **Frontend Build**: `/home/d5app/d5-management/apps/frontend/dist`
- **Nginx Config**: `/etc/nginx/sites-available/d5-management`
- **PM2 Config**: `/home/d5app/d5-management/ecosystem.config.js`
- **Logs**: `~/.pm2/logs/`

### Useful Commands

```bash
# Restart services
pm2 restart d5-backend
sudo systemctl restart nginx
sudo systemctl restart postgresql

# View logs
pm2 logs d5-backend
sudo tail -f /var/log/nginx/error.log

# Database
psql -U d5user -d d5_management
npx prisma studio  # (in backend directory)

# Update application
cd /home/d5app/d5-management
./deploy.sh
```

---

## 🎉 Deployment Complete!

Your application should now be accessible at:
- **Frontend**: `https://yourdomain.com`
- **API**: `https://yourdomain.com/api`
- **API Docs**: `https://yourdomain.com/api/docs`

For production, consider:
- Setting up monitoring (e.g., Sentry, DataDog)
- Configuring automated backups
- Setting up CI/CD pipeline
- Implementing rate limiting
- Adding monitoring dashboards

