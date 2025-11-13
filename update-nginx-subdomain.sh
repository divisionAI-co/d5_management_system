#!/bin/bash
# Quick script to update Nginx configuration to include app.division5.co subdomain

set -e

NGINX_SITE="d5-management"
DOMAIN="division5.co"

echo "Updating Nginx configuration for subdomain support..."

# Check if Nginx config exists
if [ ! -f "/etc/nginx/sites-available/${NGINX_SITE}" ]; then
    echo "Error: Nginx config file not found at /etc/nginx/sites-available/${NGINX_SITE}"
    exit 1
fi

# Get the current NGINX_PORT from the config
NGINX_PORT=$(grep -E "^\s*listen\s+" /etc/nginx/sites-available/${NGINX_SITE} | head -1 | awk '{print $2}' | tr -d ';')
if [ -z "$NGINX_PORT" ]; then
    NGINX_PORT="80"
fi

# Backup current config
sudo cp /etc/nginx/sites-available/${NGINX_SITE} /etc/nginx/sites-available/${NGINX_SITE}.backup.$(date +%Y%m%d_%H%M%S)

# Read the current config and update server_name
sudo sed -i "s/server_name.*;/server_name ${DOMAIN} www.${DOMAIN} app.${DOMAIN};/" /etc/nginx/sites-available/${NGINX_SITE}

# Test configuration
if ! sudo nginx -t; then
    echo "Error: Nginx configuration test failed!"
    echo "Restoring backup..."
    sudo cp /etc/nginx/sites-available/${NGINX_SITE}.backup.* /etc/nginx/sites-available/${NGINX_SITE} 2>/dev/null || true
    exit 1
fi

# Reload Nginx
if systemctl is-active --quiet nginx 2>/dev/null; then
    sudo systemctl reload nginx
    echo "✅ Nginx configuration updated and reloaded"
    echo "✅ Subdomain app.${DOMAIN} is now supported"
else
    echo "⚠️  Nginx is not running. Start it with: sudo systemctl start nginx"
fi

