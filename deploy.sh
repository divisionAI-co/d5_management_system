#!/bin/bash

###############################################################################
# D5 Management System - One-Click Deployment Script
# For Ubuntu 20.04+ / Debian 11+
# 
# Usage:
#   Local:  ./deploy.sh
#   Remote: ./deploy.sh --remote user@hostname [--key /path/to/key] [--port 22] [--repo git-url]
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Remote deployment variables
REMOTE_HOST=""
REMOTE_USER=""
REMOTE_KEY=""
REMOTE_PORT="22"
GIT_REPO=""
REMOTE_MODE=false
REMOTE_SETUP_SSH=false

# Configuration variables
APP_USER="d5app"
APP_DIR="/home/${APP_USER}/d5-management"
DB_NAME="d5_management"
DB_USER="d5user"
DB_PASSWORD="d5app!"  # Set this to your desired database password, or leave empty to be prompted
APP_NAME="D5 Management System"  # Application name (shown in frontend)
NGINX_SITE="d5-management"
DOMAIN="app.division5.co"
EMAIL=""
NGINX_PORT="80"  # Default port, can be changed if 80 is in use

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}âœ… $1${NC}"
}

print_error() {
    echo -e "${RED}âŒ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}âš ï¸  $1${NC}"
}

print_info() {
    echo -e "${BLUE}â„¹ï¸  $1${NC}"
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --remote|-r)
                REMOTE_MODE=true
                REMOTE_CONNECTION="$2"
                shift 2
                # Parse user@host format
                if [[ "$REMOTE_CONNECTION" == *"@"* ]]; then
                    REMOTE_USER="${REMOTE_CONNECTION%%@*}"
                    REMOTE_HOST="${REMOTE_CONNECTION#*@}"
                else
                    print_error "Remote connection must be in format: user@hostname"
                    exit 1
                fi
                ;;
            --key|-k)
                REMOTE_KEY="$2"
                shift 2
                ;;
            --port|-p)
                REMOTE_PORT="$2"
                shift 2
                ;;
            --repo|-R)
                GIT_REPO="$2"
                shift 2
                ;;
            --allow-root)
                ALLOW_ROOT=1
                shift
                ;;
            --setup-ssh)
                REMOTE_SETUP_SSH=true
                REMOTE_CONNECTION="$2"
                shift 2
                # Parse user@host format
                if [[ "$REMOTE_CONNECTION" == *"@"* ]]; then
                    REMOTE_USER="${REMOTE_CONNECTION%%@*}"
                    REMOTE_HOST="${REMOTE_CONNECTION#*@}"
                else
                    print_error "Remote connection must be in format: user@hostname"
                    exit 1
                fi
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --remote, -r USER@HOST    Deploy to remote server (e.g., ubuntu@192.168.1.100)"
                echo "  --key, -k PATH            Path to SSH private key (optional)"
                echo "  --port, -p PORT           SSH port (default: 22)"
                echo "  --repo, -R URL            Git repository URL (optional, for cloning)"
                echo "  --allow-root              Allow running as root (not recommended)"
                echo "  --setup-ssh USER@HOST     Set up SSH key authentication (one-time setup)"
                echo "  --help, -h                Show this help message"
                echo ""
                echo "Examples:"
                echo "  Local deployment:        ./deploy.sh"
                echo "  Remote deployment:       ./deploy.sh -r ubuntu@example.com"
                echo "  With SSH key:            ./deploy.sh -r ubuntu@example.com -k ~/.ssh/id_rsa"
                echo "  Setup SSH keys:          ./deploy.sh --setup-ssh ubuntu@example.com"
                echo "  With Git repo:           ./deploy.sh -r ubuntu@example.com -R https://github.com/user/repo.git"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Build SSH command
build_ssh_cmd() {
    local SSH_CMD="ssh"
    if [ -n "$REMOTE_KEY" ]; then
        SSH_CMD="$SSH_CMD -i $REMOTE_KEY"
    fi
    SSH_CMD="$SSH_CMD -p $REMOTE_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10"
    echo "$SSH_CMD"
}

# Build SCP command
build_scp_cmd() {
    local SCP_CMD="scp"
    if [ -n "$REMOTE_KEY" ]; then
        SCP_CMD="$SCP_CMD -i $REMOTE_KEY"
    fi
    SCP_CMD="$SCP_CMD -P $REMOTE_PORT -o StrictHostKeyChecking=no"
    echo "$SCP_CMD"
}

# Setup SSH key authentication
setup_ssh_keys() {
    print_header "Setting Up SSH Key Authentication"
    print_info "This will set up passwordless SSH access to $REMOTE_USER@$REMOTE_HOST"
    echo ""
    
    # Check if SSH key exists
    local SSH_KEY_PATH="$HOME/.ssh/id_rsa"
    local SSH_KEY_PUB="$HOME/.ssh/id_rsa.pub"
    
    if [ ! -f "$SSH_KEY_PATH" ]; then
        print_info "No SSH key found. Generating one..."
        read -p "Enter a passphrase for your SSH key (or press Enter for no passphrase): " -s PASSPHRASE
        echo ""
        
        if [ -z "$PASSPHRASE" ]; then
            ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_PATH" -N "" -q
        else
            ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_PATH" -N "$PASSPHRASE" -q
        fi
        
        print_success "SSH key generated at $SSH_KEY_PATH"
    else
        print_info "Using existing SSH key at $SSH_KEY_PATH"
    fi
    
    # Read public key
    if [ ! -f "$SSH_KEY_PUB" ]; then
        print_error "Public key not found at $SSH_KEY_PUB"
        exit 1
    fi
    
    local PUB_KEY=$(cat "$SSH_KEY_PUB")
    
    print_info "Copying public key to remote server..."
    print_warning "You will be prompted for your password one last time"
    echo ""
    
    # Copy public key to remote server
    ssh-copy-id -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" 2>/dev/null || {
        # Fallback: manual copy
        print_info "Attempting manual key copy..."
        ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" "mkdir -p ~/.ssh && chmod 700 ~/.ssh" || {
            print_error "Cannot connect to server. Please check your credentials."
            exit 1
        }
        
        echo "$PUB_KEY" | ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" "cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys" || {
            print_error "Failed to copy SSH key. Please do it manually:"
            echo ""
            echo "Run this command:"
            echo "  ssh-copy-id -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST"
            echo ""
            echo "Or manually:"
            echo "  cat $SSH_KEY_PUB | ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST 'cat >> ~/.ssh/authorized_keys'"
            exit 1
        }
    }
    
    print_success "SSH key copied to remote server"
    
    # Test passwordless connection
    print_info "Testing passwordless connection..."
    if ssh -p "$REMOTE_PORT" -o PasswordAuthentication=no -o BatchMode=yes "$REMOTE_USER@$REMOTE_HOST" "echo 'Connection successful'" > /dev/null 2>&1; then
        print_success "SSH key authentication is working!"
        echo ""
        print_info "You can now deploy without entering a password:"
        echo "  ./deploy.sh --remote $REMOTE_USER@$REMOTE_HOST"
    else
        print_warning "Passwordless connection test failed, but key was copied."
        print_info "You may need to try connecting once more with password, then it should work."
    fi
}

# Test SSH connection
test_ssh_connection() {
    print_header "Testing SSH Connection"
    
    local SSH_CMD=$(build_ssh_cmd)
    
    print_info "Connecting to $REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT..."
    
    if $SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "echo 'Connection successful'" > /dev/null 2>&1; then
        print_success "SSH connection successful"
    else
        print_error "Cannot connect to remote server"
        print_info "Please check:"
        echo "  1. Server IP/hostname is correct"
        echo "  2. SSH service is running on the server"
        echo "  3. Your SSH key is authorized (or password authentication is enabled)"
        echo "  4. Firewall allows SSH connections on port $REMOTE_PORT"
        echo "  5. SSH key path is correct (if using --key)"
        echo ""
        print_info "To set up SSH key authentication, run:"
        echo "  ./deploy.sh --setup-ssh $REMOTE_USER@$REMOTE_HOST"
        exit 1
    fi
}

# Deploy to remote server
deploy_remote() {
    print_header "Remote Deployment Mode"
    print_info "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PORT"
    
    # Test connection
    test_ssh_connection
    
    local SSH_CMD=$(build_ssh_cmd)
    local SCP_CMD=$(build_scp_cmd)
    
    # Create temporary directory for transfer
    local TEMP_DIR=$(mktemp -d)
    local SCRIPT_NAME=$(basename "$0")
    
    print_header "Preparing Files for Transfer"
    
    # Copy deploy script
    print_info "Copying deployment script..."
    cp "$0" "$TEMP_DIR/$SCRIPT_NAME"
    chmod +x "$TEMP_DIR/$SCRIPT_NAME"
    
    # Determine project files to transfer
    if [ -n "$GIT_REPO" ]; then
        print_info "Will clone from Git repository: $GIT_REPO"
    else
        print_info "Copying project files..."
        # Copy project files (exclude common ignore patterns)
        rsync -av --exclude='node_modules' \
                  --exclude='.git' \
                  --exclude='dist' \
                  --exclude='build' \
                  --exclude='.env*' \
                  --exclude='*.log' \
                  --exclude='.DS_Store' \
                  --exclude='.vscode' \
                  --exclude='.idea' \
                  ./ "$TEMP_DIR/project/" || {
            print_warning "rsync not available, using tar instead..."
            tar --exclude='node_modules' \
                --exclude='.git' \
                --exclude='dist' \
                --exclude='build' \
                --exclude='.env*' \
                --exclude='*.log' \
                -czf "$TEMP_DIR/project.tar.gz" . || {
                print_error "Failed to package project files"
                exit 1
            }
        }
    fi
    
    print_header "Transferring Files to Remote Server"
    
    # Create remote temp directory
    local REMOTE_TEMP=$($SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "mktemp -d")
    print_info "Remote temp directory: $REMOTE_TEMP"
    
    # Transfer deploy script
    print_info "Uploading deployment script..."
    $SCP_CMD "$TEMP_DIR/$SCRIPT_NAME" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TEMP/"
    
    # Transfer project files
    if [ -n "$GIT_REPO" ]; then
        # Just pass the repo URL, script will clone it
        print_info "Git repository will be cloned on remote server"
    else
        print_info "Uploading project files (this may take a while)..."
        if [ -d "$TEMP_DIR/project" ]; then
            # Use rsync if available, otherwise scp
            if command -v rsync &> /dev/null; then
                # Build rsync SSH command
                local RSYNC_SSH=""
                if [ -n "$REMOTE_KEY" ]; then
                    RSYNC_SSH="ssh -i $REMOTE_KEY -p $REMOTE_PORT -o StrictHostKeyChecking=no"
                else
                    RSYNC_SSH="ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no"
                fi
                rsync -avz -e "$RSYNC_SSH" "$TEMP_DIR/project/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TEMP/project/" || {
                    print_warning "rsync failed, using scp instead..."
                    $SCP_CMD -r "$TEMP_DIR/project/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TEMP/"
                }
            else
                $SCP_CMD -r "$TEMP_DIR/project/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TEMP/"
            fi
        else
            $SCP_CMD "$TEMP_DIR/project.tar.gz" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_TEMP/"
            $SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_TEMP && mkdir -p project && tar -xzf project.tar.gz -C project && rm project.tar.gz"
        fi
    fi
    
    # Cleanup local temp
    rm -rf "$TEMP_DIR"
    
    print_header "Executing Deployment on Remote Server"
    print_warning "You will be prompted for configuration on the remote server"
    print_info "The deployment will run interactively on: $REMOTE_USER@$REMOTE_HOST"
    echo ""
    
    # Execute deploy script on remote server
    # Pass GIT_REPO as environment variable if provided
    # Use -t flag to allocate pseudo-terminal for interactive prompts
    print_info "Starting deployment on remote server..."
    echo ""
    
    # Build environment variables to pass
    local ENV_VARS=""
    if [ -n "$GIT_REPO" ]; then
        ENV_VARS="GIT_REPO='$GIT_REPO'"
    fi
    if [ "${ALLOW_ROOT:-0}" = "1" ]; then
        ENV_VARS="${ENV_VARS} ALLOW_ROOT=1"
    fi
    
    if [ -n "$GIT_REPO" ]; then
        $SSH_CMD -t "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_TEMP && $ENV_VARS bash $SCRIPT_NAME" || {
            print_error "Deployment failed on remote server"
            print_info "Check the error messages above for details"
            exit 1
        }
    else
        $SSH_CMD -t "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_TEMP/project && $ENV_VARS bash ../$SCRIPT_NAME" || {
            print_error "Deployment failed on remote server"
            print_info "Check the error messages above for details"
            exit 1
        }
    fi
    
    # Cleanup remote temp (optional, keep for debugging)
    # In CI/CD mode, always clean up. Otherwise, ask user
    if [ -n "$CI" ] || [ -n "$DEPLOY_NON_INTERACTIVE" ]; then
        print_info "Cleaning up temporary files (CI/CD mode)..."
        $SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "rm -rf $REMOTE_TEMP" 2>/dev/null || true
        print_success "Remote temporary files cleaned up"
    else
        read -p "Clean up temporary files on remote server? (y/N): " CLEANUP
        if [[ "$CLEANUP" =~ ^[Yy]$ ]]; then
            $SSH_CMD "$REMOTE_USER@$REMOTE_HOST" "rm -rf $REMOTE_TEMP"
            print_success "Remote temporary files cleaned up"
        else
            print_info "Remote temporary files kept at: $REMOTE_TEMP"
        fi
    fi
    
    print_header "Remote Deployment Complete! ðŸŽ‰"
    print_success "Application has been deployed to $REMOTE_USER@$REMOTE_HOST"
}

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then 
        print_error "Please do not run this script as root. It will use sudo when needed."
        echo ""
        print_info "To fix this, create a non-root user on the server:"
        echo "  1. Create a new user: adduser yourusername"
        echo "  2. Add to sudo group: usermod -aG sudo yourusername"
        echo "  3. Switch to that user: su - yourusername"
        echo "  4. Then run the deployment script again"
        echo ""
        print_info "Or if you must use root, set ALLOW_ROOT=1 (not recommended):"
        echo "  ALLOW_ROOT=1 ./deploy.sh"
        echo ""
        if [ "${ALLOW_ROOT:-0}" != "1" ]; then
            exit 1
        else
            print_warning "Running as root (ALLOW_ROOT=1). This is not recommended for security reasons."
        fi
    fi
}

# Check Ubuntu/Debian
check_os() {
    if [ ! -f /etc/os-release ]; then
        print_error "Cannot detect OS. This script supports Ubuntu/Debian only."
        exit 1
    fi
    
    . /etc/os-release
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        print_error "This script supports Ubuntu/Debian only. Detected: $ID"
        exit 1
    fi
    
    print_success "OS detected: $PRETTY_NAME"
}

# Check if port is in use
check_port_in_use() {
    local PORT=$1
    if command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$PORT "; then
            return 0  # Port is in use
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":$PORT "; then
            return 0  # Port is in use
        fi
    elif command -v lsof &> /dev/null; then
        if lsof -i :$PORT &> /dev/null; then
            return 0  # Port is in use
        fi
    fi
    return 1  # Port is not in use
}

# Detect what's using port 80
detect_port_80_service() {
    if check_port_in_use 80; then
        if systemctl is-active --quiet apache2 2>/dev/null || systemctl is-active --quiet httpd 2>/dev/null; then
            echo "apache"
        elif systemctl is-active --quiet nginx 2>/dev/null; then
            echo "nginx"
        else
            echo "unknown"
        fi
    else
        echo "none"
    fi
}

# Detect what's using a specific port
detect_port_service() {
    local PORT=$1
    if check_port_in_use "$PORT"; then
        if systemctl is-active --quiet nginx 2>/dev/null; then
            # Check if Nginx is actually listening on this port
            if (netstat -tuln 2>/dev/null | grep -q ":$PORT ") || (ss -tuln 2>/dev/null | grep -q ":$PORT "); then
                # Try to see if nginx is the one using it
                if lsof -i :$PORT 2>/dev/null | grep -q nginx; then
                    echo "nginx"
                    return
                fi
            fi
        fi
        if systemctl is-active --quiet apache2 2>/dev/null || systemctl is-active --quiet httpd 2>/dev/null; then
            if lsof -i :$PORT 2>/dev/null | grep -qE "(apache|httpd)"; then
                echo "apache"
                return
            fi
        fi
        echo "unknown"
    else
        echo "none"
    fi
}

# Get user input
get_user_input() {
    print_header "Configuration"
    
    # Check if running in non-interactive mode (CI/CD)
    local NON_INTERACTIVE=false
    if [ -n "$CI" ] || [ -n "$DEPLOY_NON_INTERACTIVE" ]; then
        NON_INTERACTIVE=true
        print_info "Running in non-interactive mode (CI/CD)"
    fi
    
    # Check if port 80 is in use
    PORT_80_SERVICE=$(detect_port_80_service)
    if [ "$PORT_80_SERVICE" != "none" ]; then
        if [ "$NON_INTERACTIVE" = true ]; then
            # Use environment variable or default to 8080
            NGINX_PORT="${NGINX_PORT:-8080}"
            print_info "Port 80 in use, using Nginx port: $NGINX_PORT (from NGINX_PORT env var)"
            # In non-interactive mode, allow reusing existing Nginx on the chosen port
            if check_port_in_use "$NGINX_PORT"; then
                PORT_SERVICE=$(detect_port_service "$NGINX_PORT")
                if [ "$PORT_SERVICE" = "nginx" ]; then
                    print_info "Port $NGINX_PORT is in use by existing Nginx. Will update configuration."
                else
                    print_warning "Port $NGINX_PORT is in use by $PORT_SERVICE. Proceeding anyway in non-interactive mode."
                fi
            fi
        else
            print_warning "Port 80 is already in use by $PORT_80_SERVICE"
            echo ""
            print_info "Options:"
            echo "  1. Use a different port for Nginx (e.g., 8080) - Recommended"
            echo "  2. Configure Apache to reverse proxy to this application"
            echo ""
            read -p "Choose option (1 or 2) [1]: " PORT_CHOICE
            PORT_CHOICE=${PORT_CHOICE:-1}
            
            if [ "$PORT_CHOICE" = "1" ]; then
                read -p "Enter port for Nginx (default: 8080): " NGINX_PORT
                NGINX_PORT=${NGINX_PORT:-8080}
                
                # Validate port
                if ! [[ "$NGINX_PORT" =~ ^[0-9]+$ ]] || [ "$NGINX_PORT" -lt 1 ] || [ "$NGINX_PORT" -gt 65535 ]; then
                    print_error "Invalid port number. Using default 8080"
                    NGINX_PORT="8080"
                fi
                
                # Check if chosen port is also in use
                if check_port_in_use "$NGINX_PORT"; then
                    PORT_SERVICE=$(detect_port_service "$NGINX_PORT")
                    if [ "$PORT_SERVICE" = "nginx" ]; then
                        print_warning "Port $NGINX_PORT is already in use by Nginx."
                        print_info "The script will update the existing Nginx configuration."
                        read -p "Continue with updating Nginx on port $NGINX_PORT? (y/n) [y]: " CONTINUE_NGINX
                        CONTINUE_NGINX=${CONTINUE_NGINX:-y}
                        if [ "$CONTINUE_NGINX" != "y" ] && [ "$CONTINUE_NGINX" != "Y" ]; then
                            print_error "Deployment cancelled."
                            exit 1
                        fi
                        print_info "Will update existing Nginx configuration on port $NGINX_PORT"
                    else
                        print_error "Port $NGINX_PORT is in use by $PORT_SERVICE. Please choose another port."
                        exit 1
                    fi
                fi
                
                print_info "Nginx will run on port $NGINX_PORT"
                print_info "Access your application at: http://$(hostname -I | awk '{print $1}'):$NGINX_PORT"
                if [ -n "$DOMAIN" ]; then
                    print_info "Or configure Apache to reverse proxy from $DOMAIN to port $NGINX_PORT"
                fi
            else
                NGINX_PORT="80"
                print_info "You'll need to configure Apache manually to reverse proxy to this application"
                print_info "Nginx will be installed but may conflict with Apache on port 80"
            fi
        fi
    else
        NGINX_PORT="${NGINX_PORT:-80}"
    fi
    
    # Domain and email (from script variables, env vars, or prompt)
    if [ "$NON_INTERACTIVE" = true ]; then
        # Non-interactive mode: use env var or script variable
        DOMAIN="${DEPLOY_DOMAIN:-$DOMAIN}"
        EMAIL="${DEPLOY_EMAIL:-$EMAIL}"
        print_info "Domain: ${DOMAIN:-not set}"
        print_info "Email: ${EMAIL:-not set}"
    else
        # Interactive mode: use script variable if set, otherwise prompt
        if [ -z "$DOMAIN" ]; then
            read -p "Enter your domain name (e.g., example.com) [optional]: " DOMAIN
        else
            print_info "Using domain from script variable: $DOMAIN"
        fi
        
        if [ -z "$EMAIL" ]; then
            read -p "Enter your email for SSL certificate [optional]: " EMAIL
        else
            print_info "Using email from script variable: $EMAIL"
        fi
    fi
    
    # Database password (from script variable, env var, or prompt)
    if [ "$NON_INTERACTIVE" = true ]; then
        # Non-interactive mode: use env var or script variable
        DB_PASSWORD="${DEPLOY_DB_PASSWORD:-$DB_PASSWORD}"
        if [ -z "$DB_PASSWORD" ]; then
            print_error "DEPLOY_DB_PASSWORD environment variable or DB_PASSWORD script variable is required in non-interactive mode"
            exit 1
        fi
        if [ -n "$DEPLOY_DB_PASSWORD" ]; then
            print_info "Using database password from DEPLOY_DB_PASSWORD environment variable"
        else
            print_info "Using database password from script variable"
        fi
    else
        # Interactive mode: use script variable if set, otherwise prompt
        if [ -z "$DB_PASSWORD" ]; then
            read -p "Enter database password for ${DB_USER}: " -s DB_PASSWORD
            echo
            read -p "Confirm database password: " -s DB_PASSWORD_CONFIRM
            echo
            
            if [ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]; then
                print_error "Passwords do not match!"
                exit 1
            fi
        else
            print_info "Using database password from script variable"
        fi
    fi
    
    if [ -z "$DB_PASSWORD" ]; then
        print_error "Database password cannot be empty!"
        exit 1
    fi
    
    # JWT secrets (from env vars or generate)
    if [ "$NON_INTERACTIVE" = true ]; then
        JWT_SECRET="${DEPLOY_JWT_SECRET:-$(openssl rand -base64 32)}"
        JWT_REFRESH_SECRET="${DEPLOY_JWT_REFRESH_SECRET:-$(openssl rand -base64 32)}"
        ENCRYPTION_KEY="${DEPLOY_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
        if [ -n "$DEPLOY_JWT_SECRET" ]; then
            print_info "Using JWT secret from DEPLOY_JWT_SECRET"
        else
            print_info "Generated JWT secret"
        fi
        if [ -n "$DEPLOY_JWT_REFRESH_SECRET" ]; then
            print_info "Using JWT refresh secret from DEPLOY_JWT_REFRESH_SECRET"
        else
            print_info "Generated JWT refresh secret"
        fi
        if [ -n "$DEPLOY_ENCRYPTION_KEY" ]; then
            print_info "Using encryption key from DEPLOY_ENCRYPTION_KEY"
        else
            print_info "Generated encryption key"
        fi
    else
        read -p "Enter JWT secret (or press Enter to generate): " JWT_SECRET
        read -p "Enter JWT refresh secret (or press Enter to generate): " JWT_REFRESH_SECRET
        read -p "Enter encryption key (64 hex characters, or press Enter to generate): " ENCRYPTION_KEY
        
        # Generate secrets if not provided
        if [ -z "$JWT_SECRET" ]; then
            JWT_SECRET=$(openssl rand -base64 32)
            print_info "Generated JWT secret"
        fi
        
        if [ -z "$JWT_REFRESH_SECRET" ]; then
            JWT_REFRESH_SECRET=$(openssl rand -base64 32)
            print_info "Generated JWT refresh secret"
        fi
        
        if [ -z "$ENCRYPTION_KEY" ]; then
            ENCRYPTION_KEY=$(openssl rand -hex 32)
            print_info "Generated encryption key (64 hex characters)"
        else
            # Validate encryption key format (must be 64 hex characters)
            if ! [[ "$ENCRYPTION_KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
                print_error "Encryption key must be exactly 64 hexadecimal characters"
                print_info "Generating a new encryption key..."
                ENCRYPTION_KEY=$(openssl rand -hex 32)
                print_info "Generated encryption key (64 hex characters)"
            fi
        fi
    fi
    
    # Validate JWT secrets length (minimum 32 characters)
    if [ ${#JWT_SECRET} -lt 32 ]; then
        print_error "JWT_SECRET must be at least 32 characters long"
        exit 1
    fi
    
    if [ ${#JWT_REFRESH_SECRET} -lt 32 ]; then
        print_error "JWT_REFRESH_SECRET must be at least 32 characters long"
        exit 1
    fi
}

# Update system
update_system() {
    print_header "Updating System Packages"
    
    sudo apt update
    sudo apt upgrade -y
    
    print_success "System updated"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    # Install base dependencies
    sudo apt install -y \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    
    # Install Puppeteer/Chrome dependencies (required for PDF generation)
    print_info "Installing Puppeteer/Chrome dependencies..."
    # Detect correct ALSA package for Ubuntu version
    # Ubuntu 24.04+ uses libasound2t64, older versions use libasound2
    ALSA_PKG="libasound2t64"
    if ! apt-cache show libasound2t64 &>/dev/null; then
        # Fallback to libasound2 for older Ubuntu versions
        ALSA_PKG="libasound2"
    fi
    
    sudo apt install -y \
        $ALSA_PKG \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        xdg-utils
    
    print_success "Dependencies installed"
}

# Install Node.js
install_nodejs() {
    print_header "Installing Node.js"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_info "Node.js already installed: $NODE_VERSION"
    else
        print_info "Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
        
        print_success "Node.js installed: $(node -v)"
    fi
}

# Install PM2
install_pm2() {
    print_header "Installing PM2"
    
    if command -v pm2 &> /dev/null; then
        print_info "PM2 already installed"
    else
        sudo npm install -g pm2
        print_success "PM2 installed"
    fi
}

# Install PostgreSQL
install_postgresql() {
    print_header "Installing PostgreSQL"
    
    if command -v psql &> /dev/null; then
        print_info "PostgreSQL already installed"
    else
        sudo apt install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        print_success "PostgreSQL installed and started"
    fi
}

# Setup database
setup_database() {
    print_header "Setting Up Database"
    
    # Create database and user
    sudo -u postgres psql <<EOF
-- Create database
SELECT 'CREATE DATABASE ${DB_NAME}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

-- Create user with CREATEDB permission (needed for Prisma shadow database)
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '${DB_USER}') THEN
        CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}' CREATEDB;
    ELSE
        -- Grant CREATEDB if user already exists
        ALTER USER ${DB_USER} WITH CREATEDB;
    END IF;
END
\$\$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
\q
EOF
    
    print_success "Database and user created (with CREATEDB permission for Prisma Migrate)"
}


# Install Nginx
install_nginx() {
    print_header "Installing Nginx"
    
    if command -v nginx &> /dev/null; then
        print_info "Nginx already installed"
        # Stop Nginx if it's running on port 80 and we need a different port
        if [ "$NGINX_PORT" != "80" ] && systemctl is-active --quiet nginx 2>/dev/null; then
            if check_port_in_use 80; then
                print_info "Stopping Nginx to reconfigure for port $NGINX_PORT"
                sudo systemctl stop nginx
            fi
        fi
    else
        sudo apt install -y nginx
        # Don't start Nginx yet if port 80 is in use - we'll configure it first
        if [ "$NGINX_PORT" = "80" ] && check_port_in_use 80; then
            print_warning "Port 80 is in use. Nginx will be configured but not started yet."
        else
            sudo systemctl enable nginx
            # Start will happen after configuration
        fi
        print_success "Nginx installed"
    fi
}

# Configure firewall
configure_firewall() {
    print_header "Configuring Firewall"
    
    if command -v ufw &> /dev/null; then
        sudo ufw --force enable
        sudo ufw allow OpenSSH
        if [ "$NGINX_PORT" != "80" ]; then
            sudo ufw allow ${NGINX_PORT}/tcp
            print_info "Opened port $NGINX_PORT for Nginx"
        else
            sudo ufw allow 'Nginx Full'
        fi
        print_success "Firewall configured"
    else
        print_warning "UFW not found, skipping firewall configuration"
    fi
}

# Create application user
create_app_user() {
    print_header "Creating Application User"
    
    if id "$APP_USER" &>/dev/null; then
        print_info "User $APP_USER already exists"
        # Ensure home directory exists and has correct permissions
        if [ ! -d "/home/$APP_USER" ]; then
            sudo mkdir -p "/home/$APP_USER"
            sudo chown -R $APP_USER:$APP_USER "/home/$APP_USER"
        fi
    else
        sudo adduser --disabled-password --gecos "" $APP_USER
        sudo usermod -aG sudo $APP_USER
        print_success "User $APP_USER created"
    fi
    
    # Ensure npm cache directory exists with correct permissions
    # This prevents EACCES errors when npm tries to create cache
    print_info "Setting up npm cache directory for $APP_USER..."
    sudo -u $APP_USER mkdir -p "/home/$APP_USER/.npm" 2>/dev/null || {
        # If mkdir fails, create as root then fix ownership
        sudo mkdir -p "/home/$APP_USER/.npm"
        sudo chown -R $APP_USER:$APP_USER "/home/$APP_USER/.npm"
    }
    # Ensure correct ownership (in case it was created by root)
    sudo chown -R $APP_USER:$APP_USER "/home/$APP_USER/.npm" 2>/dev/null || true
}

# Deploy application
deploy_application() {
    print_header "Deploying Application"
    
    # Determine source directory (current directory when running locally)
    # For remote deployments, this will be the temp directory where files were transferred
    # For local deployments, this will be the current working directory
    local SOURCE_DIR="$(pwd)"
    print_info "Source directory: $SOURCE_DIR"
    
    # Check if directory exists
    if [ -d "$APP_DIR" ]; then
        print_warning "Application directory exists. Updating files..."
        
        # Backup existing .env files
        print_info "Backing up existing .env files..."
        local BACKUP_DIR="$APP_DIR/.env-backup-$(date +%Y%m%d_%H%M%S)"
        sudo mkdir -p "$BACKUP_DIR"
        
        # Find and backup all .env files
        sudo find "$APP_DIR" -name ".env" -type f -exec cp {} "$BACKUP_DIR/" \; 2>/dev/null || true
        sudo find "$APP_DIR" -name ".env.*" -type f -exec cp {} "$BACKUP_DIR/" \; 2>/dev/null || true
        
        # If using git repo, pull latest (skip file sync)
        if [ -n "$GIT_REPO" ] || [ -d "$APP_DIR/.git" ]; then
            print_info "Updating from git repository (skipping file sync)..."
            sudo chown -R $APP_USER:$APP_USER $APP_DIR
            cd $APP_DIR
            sudo -u $APP_USER git pull || print_warning "Git pull failed"
            cd "$SOURCE_DIR"
        else
            # No .git directory - always sync files from source
            print_info "Syncing application files from source to $APP_DIR (preserving .env files)..."
            print_info "Source: $SOURCE_DIR"
            
            # Use rsync if available for better control
            if command -v rsync &> /dev/null; then
                sudo rsync -av --delete \
                    --exclude='.env' \
                    --exclude='.env.*' \
                    --exclude='node_modules' \
                    --exclude='dist' \
                    --exclude='build' \
                    --exclude='.git' \
                    --exclude='.env-backup-*' \
                    "$SOURCE_DIR/" "$APP_DIR/" || {
                    print_warning "rsync failed, using cp instead..."
                    # Fallback to cp with exclusions
                    sudo find "$SOURCE_DIR" -type f ! -name ".env" ! -name ".env.*" ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/build/*" ! -path "*/.git/*" ! -path "*/.env-backup-*" -exec sh -c 'mkdir -p "$(dirname "$2")" && cp "$1" "$2"' _ {} "$APP_DIR/{}" \;
                }
                print_success "Files synced from source to application directory"
            else
                # Fallback: copy files while preserving .env
                print_info "Copying files (excluding .env, node_modules, dist, build)..."
                sudo find "$SOURCE_DIR" -type f \
                    ! -name ".env" \
                    ! -name ".env.*" \
                    ! -path "*/node_modules/*" \
                    ! -path "*/dist/*" \
                    ! -path "*/build/*" \
                    ! -path "*/.git/*" \
                    ! -path "*/.env-backup-*" \
                    -exec sh -c 'DEST="$2/$(echo "$1" | sed "s|^$3/||")"; mkdir -p "$(dirname "$DEST")" && cp "$1" "$DEST"' _ {} "$APP_DIR" "$SOURCE_DIR" \;
                print_success "Files copied from source to application directory"
            fi
        fi
        
        # Restore .env files from backup
        if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
            print_info "Restoring .env files..."
            sudo find "$BACKUP_DIR" -name ".env*" -type f -exec sh -c 'cp "$1" "$2/$(basename "$1")"' _ {} "$APP_DIR" \; 2>/dev/null || true
            # Also restore nested .env files (e.g., apps/backend/.env)
            sudo find "$BACKUP_DIR" -name ".env*" -type f | while read -r backup_file; do
                local rel_path=$(echo "$backup_file" | sed "s|^$BACKUP_DIR/||")
                local dest_path="$APP_DIR/$rel_path"
                if [ -f "$dest_path" ]; then
                    sudo cp "$backup_file" "$dest_path"
                fi
            done
        fi
        
    else
        print_info "Creating new application directory..."
        # If git repo, clone it. Otherwise, copy from current directory
        if [ -n "$GIT_REPO" ]; then
            sudo -u $APP_USER git clone $GIT_REPO $APP_DIR
            sudo chown -R $APP_USER:$APP_USER $APP_DIR
        else
            print_info "Copying application files from current directory..."
            sudo mkdir -p $APP_DIR
            # Copy all files except .env (will be created by configure scripts)
            sudo rsync -av --exclude='.env' --exclude='.env.*' --exclude='node_modules' --exclude='dist' --exclude='build' --exclude='.git' "$SOURCE_DIR/" "$APP_DIR/" || {
                sudo cp -r "$SOURCE_DIR"/* "$APP_DIR/" 2>/dev/null || true
                sudo cp -r "$SOURCE_DIR"/.[!.]* "$APP_DIR/" 2>/dev/null || true
                # Remove .env files that might have been copied
                sudo find "$APP_DIR" -name ".env" -type f -delete 2>/dev/null || true
                sudo find "$APP_DIR" -name ".env.*" -type f -delete 2>/dev/null || true
            }
            sudo chown -R $APP_USER:$APP_USER $APP_DIR
        fi
    fi
    
    # Ensure npm cache directory exists with correct permissions
    # This prevents EACCES errors when npm tries to create cache
    print_info "Ensuring npm cache directory exists with correct permissions..."
    sudo -u $APP_USER mkdir -p "/home/$APP_USER/.npm" 2>/dev/null || {
        # If mkdir fails, create as root then fix ownership
        sudo mkdir -p "/home/$APP_USER/.npm"
        sudo chown -R $APP_USER:$APP_USER "/home/$APP_USER/.npm"
    }
    # Ensure correct ownership (in case it was created by root or already exists)
    sudo chown -R $APP_USER:$APP_USER "/home/$APP_USER/.npm" 2>/dev/null || true
    
    cd $APP_DIR
    sudo -u $APP_USER npm install
    
    # Ensure all files are owned by APP_USER (fixes permission issues)
    sudo chown -R $APP_USER:$APP_USER $APP_DIR
    
    print_success "Application deployed (with .env files preserved)"
}

# Configure backend environment
configure_backend() {
    print_header "Configuring Backend"
    
    cd $APP_DIR/apps/backend
    
    # Create .env file
    if [ -f .env ]; then
        print_info "Backend .env exists, backing up..."
        sudo -u $APP_USER cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Get optional environment variables (for non-interactive mode or from existing .env)
    local SMTP_HOST="${DEPLOY_SMTP_HOST:-}"
    local SMTP_PORT="${DEPLOY_SMTP_PORT:-587}"
    local SMTP_USER="${DEPLOY_SMTP_USER:-}"
    local SMTP_PASSWORD="${DEPLOY_SMTP_PASSWORD:-}"
    local SMTP_SECURE="${DEPLOY_SMTP_SECURE:-false}"
    local SMTP_REQUIRE_TLS="${DEPLOY_SMTP_REQUIRE_TLS:-false}"
    local EMAIL_FROM="${DEPLOY_EMAIL_FROM:-noreply@${DOMAIN:-localhost}}"
    
    local GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL="${DEPLOY_GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL:-}"
    local GOOGLE_DRIVE_PRIVATE_KEY="${DEPLOY_GOOGLE_DRIVE_PRIVATE_KEY:-}"
    local GOOGLE_DRIVE_SHARED_DRIVE_ID="${DEPLOY_GOOGLE_DRIVE_SHARED_DRIVE_ID:-}"
    local GOOGLE_DRIVE_SCOPES="${DEPLOY_GOOGLE_DRIVE_SCOPES:-}"
    local GOOGLE_DRIVE_IMPERSONATE_USER="${DEPLOY_GOOGLE_DRIVE_IMPERSONATE_USER:-}"
    
    local GOOGLE_CALENDAR_CLIENT_ID="${DEPLOY_GOOGLE_CALENDAR_CLIENT_ID:-}"
    local GOOGLE_CALENDAR_CLIENT_SECRET="${DEPLOY_GOOGLE_CALENDAR_CLIENT_SECRET:-}"
    local GOOGLE_CALENDAR_REDIRECT_URI="${DEPLOY_GOOGLE_CALENDAR_REDIRECT_URI:-}"
    
    local GEMINI_API_KEY="${DEPLOY_GEMINI_API_KEY:-}"
    local GEMINI_MODEL_ID="${DEPLOY_GEMINI_MODEL_ID:-gemini-1.5-pro-latest}"
    
    # Determine FRONTEND_URL for email links
    local FRONTEND_URL="${DEPLOY_FRONTEND_URL:-}"
    if [ -z "$FRONTEND_URL" ] && [ -n "$DOMAIN" ]; then
        local frontend_subdomain="${DEPLOY_FRONTEND_SUBDOMAIN:-app}"
        if [[ "$DOMAIN" == "${frontend_subdomain}."* ]]; then
            FRONTEND_URL="https://${DOMAIN}"
        else
            FRONTEND_URL="https://${frontend_subdomain}.${DOMAIN}"
        fi
    elif [ -z "$FRONTEND_URL" ]; then
        FRONTEND_URL="http://localhost:5173"
    fi
    
    # Rate limiting configuration (with defaults)
    local RATE_LIMIT_WINDOW_MS="${DEPLOY_RATE_LIMIT_WINDOW_MS:-900000}"  # 15 minutes
    local RATE_LIMIT_MAX_ATTEMPTS="${DEPLOY_RATE_LIMIT_MAX_ATTEMPTS:-5}"
    local MAX_FAILED_LOGIN_ATTEMPTS="${DEPLOY_MAX_FAILED_LOGIN_ATTEMPTS:-5}"
    local ACCOUNT_LOCKOUT_DURATION_MS="${DEPLOY_ACCOUNT_LOCKOUT_DURATION_MS:-1800000}"  # 30 minutes
    
    # Determine CORS_ORIGINS
    local CORS_ORIGINS="${DEPLOY_CORS_ORIGINS:-}"
    if [ -z "$CORS_ORIGINS" ] && [ -n "$DOMAIN" ]; then
        CORS_ORIGINS="https://${DOMAIN},https://www.${DOMAIN}"
    elif [ -z "$CORS_ORIGINS" ]; then
        CORS_ORIGINS="http://localhost:5173"
    fi
    
    # If .env exists, try to preserve existing values for optional configs
    if [ -f .env ]; then
        print_info "Preserving existing configuration values from .env..."
        # Extract values from existing .env if not provided via DEPLOY_* vars
        [ -z "$SMTP_HOST" ] && SMTP_HOST=$(grep "^SMTP_HOST=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$SMTP_USER" ] && SMTP_USER=$(grep "^SMTP_USER=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$SMTP_PASSWORD" ] && SMTP_PASSWORD=$(grep "^SMTP_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL" ] && GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=$(grep "^GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$GOOGLE_DRIVE_PRIVATE_KEY" ] && GOOGLE_DRIVE_PRIVATE_KEY=$(grep "^GOOGLE_DRIVE_PRIVATE_KEY=" .env 2>/dev/null | cut -d'=' -f2- | sed 's/^"//;s/"$//' || echo "")
        [ -z "$GOOGLE_DRIVE_SHARED_DRIVE_ID" ] && GOOGLE_DRIVE_SHARED_DRIVE_ID=$(grep "^GOOGLE_DRIVE_SHARED_DRIVE_ID=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$GOOGLE_CALENDAR_CLIENT_ID" ] && GOOGLE_CALENDAR_CLIENT_ID=$(grep "^GOOGLE_CALENDAR_CLIENT_ID=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$GOOGLE_CALENDAR_CLIENT_SECRET" ] && GOOGLE_CALENDAR_CLIENT_SECRET=$(grep "^GOOGLE_CALENDAR_CLIENT_SECRET=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$GOOGLE_CALENDAR_REDIRECT_URI" ] && GOOGLE_CALENDAR_REDIRECT_URI=$(grep "^GOOGLE_CALENDAR_REDIRECT_URI=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$GEMINI_API_KEY" ] && GEMINI_API_KEY=$(grep "^GEMINI_API_KEY=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$FRONTEND_URL" ] && FRONTEND_URL=$(grep "^FRONTEND_URL=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$ENCRYPTION_KEY" ] && ENCRYPTION_KEY=$(grep "^ENCRYPTION_KEY=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$CORS_ORIGINS" ] && CORS_ORIGINS=$(grep "^CORS_ORIGINS=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
        [ -z "$RATE_LIMIT_WINDOW_MS" ] && RATE_LIMIT_WINDOW_MS=$(grep "^RATE_LIMIT_WINDOW_MS=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "900000")
        [ -z "$RATE_LIMIT_MAX_ATTEMPTS" ] && RATE_LIMIT_MAX_ATTEMPTS=$(grep "^RATE_LIMIT_MAX_ATTEMPTS=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "5")
        [ -z "$MAX_FAILED_LOGIN_ATTEMPTS" ] && MAX_FAILED_LOGIN_ATTEMPTS=$(grep "^MAX_FAILED_LOGIN_ATTEMPTS=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "5")
        [ -z "$ACCOUNT_LOCKOUT_DURATION_MS" ] && ACCOUNT_LOCKOUT_DURATION_MS=$(grep "^ACCOUNT_LOCKOUT_DURATION_MS=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "1800000")
    fi
    
    # Generate .env with comprehensive structure
    sudo -u $APP_USER cat > .env <<EOF
# ============================================
# ENVIRONMENT
# ============================================
NODE_ENV=production
PORT=3000

# ============================================
# DATABASE
# ============================================
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"

# ============================================
# JWT AUTHENTICATION
# ============================================
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# ============================================
# ENCRYPTION (for sensitive data at rest)
# ============================================
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ============================================
# CORS
# ============================================
CORS_ORIGINS=${CORS_ORIGINS}

# ============================================
# API
# ============================================
API_PREFIX=api

# ============================================
# EMAIL / SMTP
# ============================================
EMAIL_PROVIDER=smtp
SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASSWORD=${SMTP_PASSWORD:-}
SMTP_SECURE=${SMTP_SECURE:-false}
SMTP_REQUIRE_TLS=${SMTP_REQUIRE_TLS:-false}
SMTP_ALLOW_SELF_SIGNED=false
SMTP_REJECT_UNAUTHORIZED=true
# SMTP_CA_CERT=                    # Base64-encoded CA certificate (optional)
# SMTP_CA_CERT_PATH=              # Path to CA certificate file (optional)
# SMTP_TLS_SERVERNAME=            # TLS servername (optional)
# SMTP_TLS_CIPHERS=               # TLS ciphers (optional)
EMAIL_FROM=${EMAIL_FROM}

# ============================================
# GOOGLE DRIVE INTEGRATION
# ============================================
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=${GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL:-}
GOOGLE_DRIVE_PRIVATE_KEY=${GOOGLE_DRIVE_PRIVATE_KEY:-}
GOOGLE_DRIVE_SHARED_DRIVE_ID=${GOOGLE_DRIVE_SHARED_DRIVE_ID:-}
GOOGLE_DRIVE_SCOPES=${GOOGLE_DRIVE_SCOPES:-https://www.googleapis.com/auth/drive}
GOOGLE_DRIVE_IMPERSONATE_USER=${GOOGLE_DRIVE_IMPERSONATE_USER:-}

# ============================================
# GOOGLE CALENDAR INTEGRATION
# ============================================
GOOGLE_CALENDAR_CLIENT_ID=${GOOGLE_CALENDAR_CLIENT_ID:-}
GOOGLE_CALENDAR_CLIENT_SECRET=${GOOGLE_CALENDAR_CLIENT_SECRET:-}
GOOGLE_CALENDAR_REDIRECT_URI=${GOOGLE_CALENDAR_REDIRECT_URI:-}

# ============================================
# GEMINI AI API
# ============================================
GEMINI_API_KEY=${GEMINI_API_KEY:-}
GEMINI_MODEL_ID=${GEMINI_MODEL_ID:-gemini-1.5-pro-latest}

# ============================================
# FRONTEND URL (for email links)
# ============================================
FRONTEND_URL=${FRONTEND_URL}

# ============================================
# RATE LIMITING & ACCOUNT LOCKOUT
# ============================================
RATE_LIMIT_WINDOW_MS=${RATE_LIMIT_WINDOW_MS}
RATE_LIMIT_MAX_ATTEMPTS=${RATE_LIMIT_MAX_ATTEMPTS}
MAX_FAILED_LOGIN_ATTEMPTS=${MAX_FAILED_LOGIN_ATTEMPTS}
ACCOUNT_LOCKOUT_DURATION_MS=${ACCOUNT_LOCKOUT_DURATION_MS}
EOF
    
    print_success "Backend configured"
}

# Configure frontend environment
configure_frontend() {
    print_header "Configuring Frontend"
    
    cd $APP_DIR/apps/frontend
    
    # Backup existing .env if it exists
    if [ -f .env ]; then
        print_info "Frontend .env exists, backing up..."
        sudo -u $APP_USER cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        
        # Preserve any custom variables from existing .env (excluding VITE_API_URL and VITE_APP_NAME which we'll update)
        print_info "Preserving custom variables from existing .env..."
    fi
    
    # Determine API URL (backend uses /api/v1 due to versioning)
    if [ -n "$DOMAIN" ]; then
        local api_subdomain="${DEPLOY_FRONTEND_SUBDOMAIN:-app}"
        if [[ "$DOMAIN" == "${api_subdomain}."* ]]; then
            API_URL="https://${DOMAIN}/api/v1"
        else
            API_URL="https://${api_subdomain}.${DOMAIN}/api/v1"
        fi
    else
        if [ "$NGINX_PORT" = "80" ]; then
            API_URL="http://localhost/api/v1"
        else
            API_URL="http://localhost:${NGINX_PORT}/api/v1"
        fi
    fi
    [ -n "$DEPLOY_API_URL" ] && API_URL="$DEPLOY_API_URL"
    
    # Use APP_NAME from script variable or environment variable, with fallback
    local FRONTEND_APP_NAME="${DEPLOY_APP_NAME:-$APP_NAME}"
    if [ -z "$FRONTEND_APP_NAME" ]; then
        FRONTEND_APP_NAME="D5 Management System"
    fi
    
    # Extract any custom variables from existing .env (excluding VITE_API_URL and VITE_APP_NAME)
    # Store them in a temp file to preserve them
    local TEMP_ENV=$(mktemp)
    if [ -f .env ]; then
        # Get all lines that are not VITE_API_URL or VITE_APP_NAME and are not empty or comments
        grep -v "^VITE_API_URL=" .env 2>/dev/null | grep -v "^VITE_APP_NAME=" | grep -v "^#" | grep -v "^$" > "$TEMP_ENV" 2>/dev/null || true
    fi
    
    # Create new .env file
    {
        echo "VITE_API_URL=${API_URL}"
        echo "VITE_APP_NAME=${FRONTEND_APP_NAME}"
        # Append custom variables if any exist
        if [ -s "$TEMP_ENV" ]; then
            echo ""
            cat "$TEMP_ENV"
        fi
    } | sudo -u $APP_USER tee .env > /dev/null
    
    # Clean up temp file
    rm -f "$TEMP_ENV"
    
    print_success "Frontend configured"
}

# Setup database schema
setup_database_schema() {
    print_header "Setting Up Database Schema"
    
    cd $APP_DIR/apps/backend
    
    # Ensure proper ownership
    sudo chown -R $APP_USER:$APP_USER .

    
    # Generate Prisma Client
    sudo -u $APP_USER npx prisma generate
    
    # Run migrations
    sudo -u $APP_USER npx prisma migrate deploy
    
    # Check if this is the first deployment (no users exist)
    print_info "Checking if database needs seeding..."
    
    # Use a simple Node.js script to check if users exist
    SEED_CHECK=$(sudo -u $APP_USER node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.user.count().then(count => {
            console.log(count);
            prisma.\$disconnect();
        }).catch(() => {
            console.log('0');
            process.exit(0);
        });
    " 2>/dev/null || echo "0")
    
    if [ "$SEED_CHECK" = "0" ] || [ -z "$SEED_CHECK" ]; then
        print_info "Database is empty. Running seed script..."
        if sudo -u $APP_USER npm run seed; then
            print_success "Database seeded with initial data"
        else
            print_warning "Seed script encountered an error (this is normal if data already exists)"
        fi
    else
        print_info "Database already has data ($SEED_CHECK users found). Skipping seed."
    fi
    
    print_success "Database schema created"
}

# Build application
build_application() {
    print_header "Building Application"
    
    cd $APP_DIR
    
    # Ensure proper ownership before building
    sudo chown -R $APP_USER:$APP_USER $APP_DIR
    
    # Clean up dist directories with proper permissions
    print_info "Cleaning build directories..."
    if [ -d "apps/backend/dist" ]; then
        sudo -u $APP_USER rm -rf apps/backend/dist || {
            # If rm fails due to permissions, fix ownership and try again
            sudo chown -R $APP_USER:$APP_USER apps/backend/dist
            sudo -u $APP_USER rm -rf apps/backend/dist
        }
    fi
    if [ -d "apps/frontend/dist" ]; then
        sudo -u $APP_USER rm -rf apps/frontend/dist || {
            sudo chown -R $APP_USER:$APP_USER apps/frontend/dist
            sudo -u $APP_USER rm -rf apps/frontend/dist
        }
    fi
    
    # Build backend
    print_info "Building backend..."
    cd apps/backend
    # Ensure ownership of backend directory
    sudo chown -R $APP_USER:$APP_USER .
    sudo -u $APP_USER npm run build
    
    # Build frontend
    print_info "Building frontend..."
    cd ../frontend
    # Ensure ownership of frontend directory
    sudo chown -R $APP_USER:$APP_USER .
    sudo -u $APP_USER npm run build
    
    # Final ownership check
    cd $APP_DIR
    sudo chown -R $APP_USER:$APP_USER .
    
    print_success "Application built"
}

# Configure PM2
configure_pm2() {
    print_header "Configuring PM2"
    
    cd $APP_DIR
    
    # Create ecosystem file
    sudo -u $APP_USER cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [
    {
      name: 'd5-backend',
      script: './apps/backend/dist/src/main.js',
      cwd: '${APP_DIR}',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/home/${APP_USER}/.pm2/logs/d5-backend-error.log',
      out_file: '/home/${APP_USER}/.pm2/logs/d5-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
    },
  ],
};
EOF
    
    # Start with PM2
    sudo -u $APP_USER pm2 start ecosystem.config.js
    sudo -u $APP_USER pm2 save
    
    # Setup PM2 startup
    STARTUP_CMD=$(sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER | grep "sudo")
    if [ -n "$STARTUP_CMD" ]; then
        eval $STARTUP_CMD
    fi
    
    print_success "PM2 configured and started"
}

# Configure Nginx
configure_nginx() {
    print_header "Configuring Nginx"
    
    # Determine server name
    if [ -n "$DOMAIN" ]; then
        # Support main domain, www subdomain, and app subdomain
        SERVER_NAME="${DOMAIN} www.${DOMAIN} app.${DOMAIN}"
    else
        SERVER_NAME="_"
    fi
    
    # Create Nginx config
    sudo tee /etc/nginx/sites-available/${NGINX_SITE} > /dev/null <<EOF
upstream backend {
    server localhost:3000;
    keepalive 64;
}

server {
    listen ${NGINX_PORT};
    server_name ${SERVER_NAME};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        root ${APP_DIR}/apps/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        index index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API Documentation
    location /api/docs {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    client_max_body_size 50M;
}
EOF
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/${NGINX_SITE} /etc/nginx/sites-enabled/
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    if ! sudo nginx -t; then
        print_error "Nginx configuration test failed!"
        exit 1
    fi
    
    # Start or reload Nginx
    if systemctl is-active --quiet nginx 2>/dev/null; then
        sudo systemctl reload nginx
    else
        sudo systemctl start nginx
        sudo systemctl enable nginx
    fi
    
    print_success "Nginx configured and running on port $NGINX_PORT"
}

# Create Apache reverse proxy config (optional)
create_apache_proxy_config() {
    if [ "$NGINX_PORT" = "80" ] || [ -z "$DOMAIN" ]; then
        return  # Skip if using port 80 or no domain
    fi
    
    print_header "Apache Reverse Proxy Configuration"
    
    print_info "To serve this application through Apache on port 80, create this Apache virtual host:"
    echo ""
    echo "Create file: /etc/apache2/sites-available/${NGINX_SITE}.conf"
    echo ""
    cat <<APACHE_EOF | sudo tee /tmp/${NGINX_SITE}-apache.conf.example > /dev/null
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN} app.${DOMAIN}
    
    # Proxy to Nginx on port ${NGINX_PORT}
    ProxyPreserveHost On
    ProxyPass / http://localhost:${NGINX_PORT}/
    ProxyPassReverse / http://localhost:${NGINX_PORT}/
    
    # Optional: SSL redirect
    # RewriteEngine On
    # RewriteCond %{HTTPS} off
    # RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</VirtualHost>

# For SSL (after setting up Let's Encrypt)
<VirtualHost *:443>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN} app.${DOMAIN}
    
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${DOMAIN}/privkey.pem
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:${NGINX_PORT}/
    ProxyPassReverse / http://localhost:${NGINX_PORT}/
</VirtualHost>
APACHE_EOF
    
    print_info "Example Apache config saved to: /tmp/${NGINX_SITE}-apache.conf.example"
    print_info "To use it:"
    echo "  1. sudo cp /tmp/${NGINX_SITE}-apache.conf.example /etc/apache2/sites-available/${NGINX_SITE}.conf"
    echo "  2. sudo a2enmod proxy proxy_http"
    echo "  3. sudo a2ensite ${NGINX_SITE}"
    echo "  4. sudo systemctl reload apache2"
}

# Setup SSL
setup_ssl() {
    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        print_warning "Skipping SSL setup (domain or email not provided)"
        return
    fi
    
    # Only setup SSL if using port 80 (standard HTTP/HTTPS)
    if [ "$NGINX_PORT" != "80" ]; then
        print_warning "SSL setup skipped (Nginx is on port $NGINX_PORT, not 80)"
        print_info "Configure SSL on Apache if using reverse proxy"
        return
    fi
    
    print_header "Setting Up SSL Certificate"
    
    # Install Certbot
    if ! command -v certbot &> /dev/null; then
        sudo apt install -y certbot python3-certbot-nginx
    fi
    
    # Obtain certificate
    print_info "Obtaining SSL certificate..."
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect
    
    print_success "SSL certificate installed"
}

# Create deployment script
create_deploy_script() {
    print_header "Creating Update Script"
    
    sudo -u $APP_USER cat > $APP_DIR/update.sh <<'UPDATE_EOF'
#!/bin/bash
set -e

echo "ðŸš€ Starting update..."

cd /home/d5app/d5-management

# Pull latest changes (if git repo)
if [ -d .git ]; then
    git pull origin main || git pull origin master
fi

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

echo "âœ… Update complete!"
UPDATE_EOF
    
    sudo chmod +x $APP_DIR/update.sh
    sudo chown $APP_USER:$APP_USER $APP_DIR/update.sh
    
    print_success "Update script created at $APP_DIR/update.sh"
}

# Main deployment function
main() {
    # Parse arguments first
    parse_arguments "$@"
    
    # If SSH setup mode, handle that and exit
    if [ "$REMOTE_SETUP_SSH" = true ]; then
        setup_ssh_keys
        exit 0
    fi
    
    # If remote mode, handle remote deployment and exit
    if [ "$REMOTE_MODE" = true ]; then
        deploy_remote
        exit 0
    fi
    
    # Local deployment continues below
    print_header "D5 Management System - Deployment Script"
    print_info "This script will install and configure the D5 Management System"
    print_info "Press Ctrl+C to cancel at any time\n"
    
    # Pre-flight checks
    check_root
    check_os
    
    # Get user input
    get_user_input
    
    # Installation steps
    update_system
    install_dependencies
    install_nodejs
    install_pm2
    install_postgresql
    setup_database
    install_nginx
    configure_firewall
    create_app_user
    
    # Application deployment
    deploy_application
    configure_backend
    configure_frontend
    setup_database_schema
    build_application
    
    # Service configuration
    configure_pm2
    configure_nginx
    create_apache_proxy_config
    setup_ssl
    create_deploy_script
    
    # Final summary
    print_header "Deployment Complete! ðŸŽ‰"
    
    echo -e "\n${GREEN}Application Information:${NC}"
    if [ "$NGINX_PORT" = "80" ]; then
        if [ -n "$DOMAIN" ]; then
            echo "  Frontend: https://${DOMAIN}"
            echo "  API: https://${DOMAIN}/api"
            echo "  API Docs: https://${DOMAIN}/api/docs"
        else
            SERVER_IP=$(hostname -I | awk '{print $1}')
            echo "  Frontend: http://${SERVER_IP}"
            echo "  API: http://${SERVER_IP}/api"
            echo "  API Docs: http://${SERVER_IP}/api/docs"
        fi
    else
        SERVER_IP=$(hostname -I | awk '{print $1}')
        echo "  Frontend: http://${SERVER_IP}:${NGINX_PORT}"
        echo "  API: http://${SERVER_IP}:${NGINX_PORT}/api"
        echo "  API Docs: http://${SERVER_IP}:${NGINX_PORT}/api/docs"
        if [ -n "$DOMAIN" ]; then
            echo ""
            echo -e "${YELLOW}To serve via Apache on port 80:${NC}"
            echo "  See: /tmp/${NGINX_SITE}-apache.conf.example"
            echo "  Or configure Apache reverse proxy manually"
        fi
    fi
    
    echo -e "\n${GREEN}Next Steps:${NC}"
    echo "  1. Configure email settings in: $APP_DIR/apps/backend/.env"
    echo "  2. Configure Google Drive (if needed) in: $APP_DIR/apps/backend/.env"
    echo "  3. Configure Gemini API (if needed) in: $APP_DIR/apps/backend/.env"
    echo "  4. (Optional) Seed initial data: cd $APP_DIR/apps/backend && npm run seed"
    
    echo -e "\n${GREEN}Useful Commands:${NC}"
    echo "  View logs: pm2 logs d5-backend"
    echo "  Restart: pm2 restart d5-backend"
    echo "  Update app: $APP_DIR/update.sh"
    echo "  Database GUI: cd $APP_DIR/apps/backend && npx prisma studio"
    
    echo -e "\n${GREEN}Default Test Users (if seeded):${NC}"
    echo "  Admin: admin@d5.com / admin123"
    echo "  Sales: sales@d5.com / sales123"
    
    echo -e "\n${YELLOW}âš ï¸  Important:${NC}"
    echo "  - Change default passwords in production!"
    echo "  - Configure email, Google Drive, and Gemini API as needed"
    echo "  - Set up database backups"
    echo "  - Review security settings"
    echo "  - Security features enabled:"
    echo "    â€¢ Encryption at rest (ENCRYPTION_KEY)"
    echo "    â€¢ Rate limiting & account lockout"
    echo "    â€¢ Secure token handling (HttpOnly cookies)"
    echo "    â€¢ CORS protection (CORS_ORIGINS)"
    
    echo -e "\n"
}

# Run main function with all arguments
main "$@"

