#!/bin/bash
# Quick script to fix line endings for deploy.sh
# Run this if you get "cannot execute: required file not found" error

echo "Fixing line endings for deploy.sh..."

# Remove CRLF and ensure LF only
sed -i 's/\r$//' deploy.sh

# Make executable
chmod +x deploy.sh

echo "Done! You can now run: ./deploy.sh"
echo "Or on Windows with Git Bash: bash deploy.sh"

