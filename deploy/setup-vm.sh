#!/bin/bash
# Full VM setup script for claude-code-web
# Usage: ./setup-vm.sh
set -e

echo "=============================================="
echo "  Agent Data - VM Setup"
echo "=============================================="

# Install system dependencies
echo ""
echo "=== Installing system dependencies ==="
sudo apt-get update -qq
sudo apt-get install -y -qq curl git nginx

# Install Node.js 20
echo ""
echo "=== Installing Node.js 20 ==="
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y -qq nodejs
fi
echo "Node: $(node -v)"

# Install pnpm
echo ""
echo "=== Installing pnpm ==="
if ! command -v pnpm &> /dev/null; then
    sudo npm install -g pnpm@10.19.0 >/dev/null 2>&1
fi
echo "pnpm: $(pnpm -v)"

# Install PM2
echo ""
echo "=== Installing PM2 ==="
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2 >/dev/null 2>&1
fi
echo "PM2: $(pm2 -v)"

# Install Claude CLI (for authentication)
echo ""
echo "=== Installing Claude CLI ==="
if ! command -v claude &> /dev/null; then
    npm install -g @anthropic-ai/claude-code >/dev/null 2>&1
fi
echo "Claude CLI installed"

echo ""
echo "=============================================="
echo "  Setup complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Run: claude /login"
echo "  2. Run: ./deploy.sh"
