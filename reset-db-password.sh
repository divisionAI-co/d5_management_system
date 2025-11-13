#!/bin/bash

###############################################################################
# Reset Database Password for D5 Management System
# This script resets the PostgreSQL password for the d5user account
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (matches deploy.sh)
DB_USER="d5user"
DB_NAME="d5_management"
APP_USER="d5app"
APP_DIR="/home/${APP_USER}/d5-management"
BACKEND_ENV="${APP_DIR}/apps/backend/.env"

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Main script
main() {
    print_header "Reset Database Password"
    
    print_info "This script will:"
    echo "  1. Reset the PostgreSQL password for user: ${DB_USER}"
    echo "  2. Update the .env file with the new password"
    echo "  3. Restart the backend application"
    echo ""
    
    # Get new password
    read -p "Enter new password for ${DB_USER}: " -s NEW_PASSWORD
    echo
    read -p "Confirm new password: " -s NEW_PASSWORD_CONFIRM
    echo
    echo ""
    
    if [ "$NEW_PASSWORD" != "$NEW_PASSWORD_CONFIRM" ]; then
        print_error "Passwords do not match!"
        exit 1
    fi
    
    if [ -z "$NEW_PASSWORD" ]; then
        print_error "Password cannot be empty!"
        exit 1
    fi
    
    # Reset password in PostgreSQL
    print_info "Resetting password in PostgreSQL..."
    sudo -u postgres psql <<EOF
ALTER USER ${DB_USER} WITH ENCRYPTED PASSWORD '${NEW_PASSWORD}';
\q
EOF
    
    if [ $? -eq 0 ]; then
        print_success "Password reset in PostgreSQL"
    else
        print_error "Failed to reset password in PostgreSQL"
        exit 1
    fi
    
    # Update .env file
    if [ ! -f "$BACKEND_ENV" ]; then
        print_error ".env file not found at: $BACKEND_ENV"
        print_info "Please update the DATABASE_URL manually in your .env file"
        exit 1
    fi
    
    print_info "Updating .env file..."
    
    # Backup current .env
    BACKUP_FILE="${BACKEND_ENV}.backup.$(date +%Y%m%d_%H%M%S)"
    sudo -u $APP_USER cp "$BACKEND_ENV" "$BACKUP_FILE"
    print_info "Backup created: $BACKUP_FILE"
    
    # Update DATABASE_URL in .env
    # Escape special characters in password for sed
    ESCAPED_PASSWORD=$(echo "$NEW_PASSWORD" | sed 's/[[\.*^$()+?{|]/\\&/g')
    
    # Update the password in DATABASE_URL
    sudo -u $APP_USER sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://${DB_USER}:${ESCAPED_PASSWORD}@localhost:5432/${DB_NAME}?schema=public\"|" "$BACKEND_ENV"
    
    if [ $? -eq 0 ]; then
        print_success ".env file updated"
    else
        print_error "Failed to update .env file"
        print_info "Please manually update DATABASE_URL in: $BACKEND_ENV"
        exit 1
    fi
    
    # Restart backend
    print_info "Restarting backend application..."
    if command -v pm2 &> /dev/null; then
        sudo -u $APP_USER pm2 restart d5-backend
        if [ $? -eq 0 ]; then
            print_success "Backend restarted"
        else
            print_warning "Failed to restart backend. You may need to restart manually:"
            echo "  sudo -u $APP_USER pm2 restart d5-backend"
        fi
    else
        print_warning "PM2 not found. Please restart your backend application manually."
    fi
    
    # Final summary
    print_header "Password Reset Complete! 🎉"
    
    echo -e "\n${GREEN}Summary:${NC}"
    echo "  Database user: ${DB_USER}"
    echo "  Password: [updated]"
    echo "  .env file: ${BACKEND_ENV}"
    echo "  Backup: ${BACKUP_FILE}"
    
    echo -e "\n${YELLOW}Note:${NC}"
    echo "  If the backend doesn't restart automatically, run:"
    echo "    sudo -u $APP_USER pm2 restart d5-backend"
    
    echo ""
}

# Run main function
main "$@"

