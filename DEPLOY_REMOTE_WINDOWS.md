# Deploying to Remote Ubuntu Server from Windows

This guide shows you how to deploy the D5 Management System from your Windows machine to a remote Ubuntu server.

## 🚀 Quick Start

### Method 1: Using PowerShell Script (Easiest)

```powershell
# Open PowerShell in the project directory
cd C:\Users\division5\Documents\projects\d5_management_system

# Run the deployment script
.\deploy-remote.ps1 -ServerIP "your-server-ip" -Username "your-username"
```

**With SSH key:**
```powershell
.\deploy-remote.ps1 -ServerIP "your-server-ip" -Username "your-username" -SSHKey "C:\path\to\your\key.pem"
```

**Custom SSH port:**
```powershell
.\deploy-remote.ps1 -ServerIP "your-server-ip" -Username "your-username" -Port "2222"
```

### Method 2: Manual Steps

#### Step 1: Copy Script to Server

**Using SCP (in PowerShell or Git Bash):**
```powershell
scp deploy.sh username@your-server-ip:~/deploy.sh
```

**Or using WinSCP (GUI):**
1. Download WinSCP: https://winscp.net/
2. Connect to your server
3. Drag `deploy.sh` to the server's home directory

#### Step 2: SSH into Server

```powershell
ssh username@your-server-ip
```

#### Step 3: Run the Script

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📋 Prerequisites

### On Your Windows Machine:

1. **OpenSSH Client** (usually pre-installed on Windows 10/11)
   - Check: `ssh` in PowerShell
   - If not installed: Settings → Apps → Optional Features → Add OpenSSH Client

2. **SCP** (usually comes with OpenSSH)
   - Check: `scp` in PowerShell

3. **PowerShell 5.1+** (Windows 10/11 default)

### On Your Ubuntu Server:

1. **SSH Server** installed and running
   ```bash
   sudo apt update
   sudo apt install openssh-server
   sudo systemctl start ssh
   sudo systemctl enable ssh
   ```

2. **SSH Access** configured
   - Your public key added to `~/.ssh/authorized_keys`, OR
   - Password authentication enabled

---

## 🔐 SSH Setup Options

### Option A: Password Authentication

1. Enable password auth on server:
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PasswordAuthentication yes
   sudo systemctl restart ssh
   ```

2. Connect with password:
   ```powershell
   ssh username@your-server-ip
   # Enter password when prompted
   ```

### Option B: SSH Key Authentication (Recommended)

#### 1. Generate SSH Key on Windows

```powershell
# In PowerShell
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
# Save to: C:\Users\YourUsername\.ssh\id_rsa
```

#### 2. Copy Public Key to Server

```powershell
# Method 1: Using ssh-copy-id (if available)
ssh-copy-id username@your-server-ip

# Method 2: Manual copy
type $env:USERPROFILE\.ssh\id_rsa.pub | ssh username@your-server-ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

#### 3. Test Connection

```powershell
ssh username@your-server-ip
# Should connect without password
```

---

## 📝 Example Deployment Session

```powershell
# Navigate to project
cd C:\Users\division5\Documents\projects\d5_management_system

# Deploy to server
.\deploy-remote.ps1 -ServerIP "192.168.1.100" -Username "ubuntu"

# Or with domain
.\deploy-remote.ps1 -ServerIP "app.yourdomain.com" -Username "ubuntu"
```

**What happens:**
1. Script tests SSH connection
2. Copies `deploy.sh` to server
3. Makes it executable
4. Runs the deployment script
5. You'll be prompted for:
   - Domain name (optional)
   - Email for SSL (optional)
   - Database password
   - JWT secrets (optional)

---

## 🛠️ Troubleshooting

### "SSH connection failed"

**Solutions:**
1. Check server IP is correct
2. Verify SSH service is running: `sudo systemctl status ssh` (on server)
3. Check firewall allows SSH: `sudo ufw allow ssh` (on server)
4. Test connection manually: `ssh username@server-ip`

### "Permission denied (publickey)"

**Solutions:**
1. Use password auth: `ssh -o PreferredAuthentications=password username@server-ip`
2. Or set up SSH keys (see Option B above)
3. Check key permissions: `chmod 600 ~/.ssh/id_rsa` (on server)

### "SCP not found"

**Solutions:**
1. Install OpenSSH: Settings → Apps → Optional Features → OpenSSH Client
2. Or use WinSCP (GUI alternative)
3. Or use Git Bash (includes SCP)

### "Script execution policy error"

**Solutions:**
```powershell
# Allow script execution (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "deploy.sh not found"

**Solutions:**
1. Make sure you're in the project root directory
2. Verify `deploy.sh` exists: `ls deploy.sh` (Git Bash) or `dir deploy.sh` (PowerShell)

---

## 🔄 Alternative: Using Git Bash

If you prefer Git Bash (comes with Git for Windows):

```bash
# In Git Bash
cd /c/Users/division5/Documents/projects/d5_management_system

# Copy script
scp deploy.sh username@your-server-ip:~/deploy.sh

# SSH and run
ssh username@your-server-ip
chmod +x deploy.sh
./deploy.sh
```

---

## 📦 Alternative: Using WinSCP + PuTTY

1. **WinSCP** - Copy `deploy.sh` to server
2. **PuTTY** - SSH into server and run:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

---

## ✅ After Deployment

Once deployment completes, you can:

1. **Access the application:**
   - Frontend: `https://your-domain.com` or `http://server-ip`
   - API: `https://your-domain.com/api`
   - API Docs: `https://your-domain.com/api/docs`

2. **Update the application:**
   ```bash
   ssh username@server-ip
   cd /home/d5app/d5-management
   ./update.sh
   ```

3. **View logs:**
   ```bash
   ssh username@server-ip
   pm2 logs d5-backend
   ```

---

## 🔐 Security Notes

- **Never commit** `.env` files or SSH keys to Git
- Use **SSH keys** instead of passwords when possible
- Keep your **server updated**: `sudo apt update && sudo apt upgrade`
- Configure **firewall** on server: `sudo ufw enable`
- Use **strong passwords** for database and JWT secrets

---

## 📞 Quick Reference

```powershell
# Deploy to remote server
.\deploy-remote.ps1 -ServerIP "server-ip" -Username "username"

# With SSH key
.\deploy-remote.ps1 -ServerIP "server-ip" -Username "username" -SSHKey "C:\path\to\key.pem"

# Manual SSH
ssh username@server-ip

# Copy file
scp file.txt username@server-ip:~/
```

