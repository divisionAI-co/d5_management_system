#!/bin/bash

###############################################################################
# GitHub Secrets Validation Script
# Validates that all required GitHub secrets are set
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if secret exists
check_secret() {
    local secret_name=$1
    local required=$2
    local description=$3
    
    if [ -z "${!secret_name}" ]; then
        if [ "$required" = "true" ]; then
            print_error "Required secret missing: $secret_name"
            echo "  Description: $description"
            return 1
        else
            print_warning "Optional secret not set: $secret_name"
            echo "  Description: $description"
            return 0
        fi
    else
        print_success "Secret set: $secret_name"
        return 0
    fi
}

# Main validation function
validate_secrets() {
    local environment=$1
    
    print_header "Validating $environment Secrets"
    
    local errors=0
    
    # Required secrets
    check_secret "${environment}_SSH_USER" true "SSH username for $environment server" || errors=$((errors + 1))
    check_secret "${environment}_SSH_HOST" true "SSH hostname or IP for $environment server" || errors=$((errors + 1))
    check_secret "${environment}_SSH_PRIVATE_KEY" true "SSH private key for $environment server" || errors=$((errors + 1))
    check_secret "${environment}_DB_PASSWORD" true "Database password for $environment" || errors=$((errors + 1))
    check_secret "${environment}_DOMAIN" true "Domain name for $environment" || errors=$((errors + 1))
    check_secret "${environment}_EMAIL" true "Email for SSL certificates" || errors=$((errors + 1))
    check_secret "${environment}_JWT_SECRET" true "JWT secret for $environment" || errors=$((errors + 1))
    check_secret "${environment}_JWT_REFRESH_SECRET" true "JWT refresh secret for $environment" || errors=$((errors + 1))
    
    # Optional secrets
    check_secret "${environment}_SSH_PORT" false "SSH port (defaults to 22)"
    check_secret "${environment}_FRONTEND_URL" false "Frontend URL for $environment"
    check_secret "${environment}_SMTP_HOST" false "SMTP server hostname"
    check_secret "${environment}_SMTP_PORT" false "SMTP server port"
    check_secret "${environment}_SMTP_USER" false "SMTP username"
    check_secret "${environment}_SMTP_PASSWORD" false "SMTP password"
    check_secret "${environment}_SMTP_SECURE" false "Use SSL/TLS for SMTP"
    check_secret "${environment}_SMTP_REQUIRE_TLS" false "Require TLS for SMTP"
    check_secret "${environment}_EMAIL_FROM" false "From email address"
    check_secret "${environment}_GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL" false "Google Drive service account email"
    check_secret "${environment}_GOOGLE_DRIVE_PRIVATE_KEY" false "Google Drive private key"
    check_secret "${environment}_GOOGLE_DRIVE_SHARED_DRIVE_ID" false "Google Drive shared drive ID"
    check_secret "${environment}_GOOGLE_DRIVE_SCOPES" false "Google Drive scopes"
    check_secret "${environment}_GOOGLE_DRIVE_IMPERSONATE_USER" false "Google Drive impersonate user"
    check_secret "${environment}_GOOGLE_CALENDAR_CLIENT_ID" false "Google Calendar OAuth client ID"
    check_secret "${environment}_GOOGLE_CALENDAR_CLIENT_SECRET" false "Google Calendar OAuth client secret"
    check_secret "${environment}_GOOGLE_CALENDAR_REDIRECT_URI" false "Google Calendar OAuth redirect URI"
    check_secret "${environment}_GEMINI_API_KEY" false "Gemini API key"
    check_secret "${environment}_GEMINI_MODEL_ID" false "Gemini model ID"
    check_secret "${environment}_APP_NAME" false "Application name"
    
    echo ""
    if [ $errors -eq 0 ]; then
        print_success "All required secrets are set for $environment"
        return 0
    else
        print_error "$errors required secret(s) are missing for $environment"
        return 1
    fi
}

# Main script
ENVIRONMENT=${1:-staging}

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    print_error "Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

# Convert to uppercase for environment variable names
ENVIRONMENT=$(echo "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')

validate_secrets "$ENVIRONMENT"

