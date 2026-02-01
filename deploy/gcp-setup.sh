#!/bin/bash
# GCP VM Setup Script for sql-agent
# Run this on a fresh Ubuntu 22.04 VM

set -e

echo "=== Installing dependencies ==="
sudo apt-get update
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx

# Install Node.js 20
echo "=== Installing Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
echo "=== Installing pnpm ==="
sudo npm install -g pnpm@10.19.0

# Install PM2 for process management
echo "=== Installing PM2 ==="
sudo npm install -g pm2

echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "1. Clone your repo: git clone git@github.com:s23h/sql-agent.git ~/app"
echo "2. cd ~/app && pnpm install"
echo "3. Create .env file with your API keys"
echo "4. pnpm run build"
echo "5. pm2 start ecosystem.config.cjs"
echo "6. Configure nginx (see deploy/nginx.conf)"
