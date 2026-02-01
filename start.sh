#!/bin/bash
# Wrapper script to start the server with env vars loaded
set -a
source "$(dirname "$0")/.env" 2>/dev/null || true
set +a

exec pnpm run preview
