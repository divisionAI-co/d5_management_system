#!/bin/bash
# Troubleshooting script for Nginx subdomain configuration

echo "=== Nginx Configuration Check ==="
echo ""
echo "1. Checking Nginx config file..."
if [ -f "/etc/nginx/sites-available/d5-management" ]; then
    echo "✅ Config file exists"
    echo ""
    echo "Current server_name directive:"
    grep "server_name" /etc/nginx/sites-available/d5-management
    echo ""
else
    echo "❌ Config file not found at /etc/nginx/sites-available/d5-management"
    exit 1
fi

echo ""
echo "2. Checking enabled sites..."
echo "Enabled Nginx sites:"
ls -la /etc/nginx/sites-enabled/ | grep -v "^total"
echo ""

echo "3. Checking if d5-management is enabled..."
if [ -L "/etc/nginx/sites-enabled/d5-management" ]; then
    echo "✅ Site is enabled"
else
    echo "❌ Site is NOT enabled. Run: sudo ln -s /etc/nginx/sites-available/d5-management /etc/nginx/sites-enabled/"
fi

echo ""
echo "4. Testing Nginx configuration..."
sudo nginx -t

echo ""
echo "5. Checking Nginx status..."
sudo systemctl status nginx --no-pager | head -10

echo ""
echo "6. Checking what ports Nginx is listening on..."
sudo netstat -tlnp | grep nginx || sudo ss -tlnp | grep nginx

echo ""
echo "7. Checking Nginx error logs (last 20 lines)..."
sudo tail -20 /var/log/nginx/error.log

echo ""
echo "8. Checking DNS for app.division5.co..."
echo "DNS A record check:"
dig +short app.division5.co || nslookup app.division5.co || echo "dig/nslookup not available"

echo ""
echo "=== Troubleshooting Complete ==="
echo ""
echo "If server_name is correct but still not working:"
echo "1. Make sure DNS A record for app.division5.co points to your server IP"
echo "2. Check firewall: sudo ufw status"
echo "3. Try full restart: sudo systemctl restart nginx"
echo "4. Check browser cache or try incognito mode"

