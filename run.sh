#!/bin/bash
ROOT_DIR=$(pwd)

# --- Function to install only if node_modules is missing ---
install_if_missing() {
    if [ ! -d "node_modules" ]; then
        npm install --silent --legacy-peer-deps
    fi
}

# --- Install process ---
# Silent mode: npm install is very chatty, so we redirect output to /dev/null
cd "$ROOT_DIR/web-ui" && install_if_missing
cd "$ROOT_DIR/desktop-client" && npm init -y > /dev/null 2>&1 && install_if_missing && npm install --silent express cors @types/express @types/cors typescript ts-node @types/node > /dev/null 2>&1

# --- Starting Services ---
cd "$ROOT_DIR/desktop-client"
# Redirect output to /dev/null to keep terminal clean
npx ts-node local-api.ts > /dev/null 2>&1 &
DESKTOP_PID=$!

cd "$ROOT_DIR/web-ui"
npm run dev

# Cleanup
kill $DESKTOP_PID 2>/dev/null