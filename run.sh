#!/bin/bash
ROOT_DIR=$(pwd)

# Export the root .env (DATABASE_URL, DESKTOP_API_PORT, etc.) into this shell so every child
# process below - the Prisma CLI, `next dev`/`next start`, and the desktop client - inherits it
# directly, rather than relying only on next.config.ts's own dotenv loading (which only reaches
# Next's own process, not the separate `npx prisma` invocation).
set -a
source "$ROOT_DIR/.env"
set +a

# Usage: ./run.sh          -> dev mode (hot reload, what you want while actively coding)
#        ./run.sh prod     -> production build + start (what you want to just run/demo the app -
#                              noticeably faster, since dev mode carries a lot of overhead a long
#                              running session accumulates even more of)
MODE="dev"
if [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    MODE="prod"
fi

RPC_URL="http://127.0.0.1:8545"

# --- Function to install only if node_modules is missing ---
install_if_missing() {
    if [ ! -d "node_modules" ]; then
        npm install --silent --legacy-peer-deps
    fi
}

node_is_up() {
    curl -s -m 2 -X POST "$RPC_URL" -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' > /dev/null 2>&1
}

# --- Make sure Postgres is up before anything tries to talk to it ---
if command -v pg_isready > /dev/null 2>&1 && ! pg_isready -q; then
    echo "Starting PostgreSQL..."
    sudo service postgresql start > /dev/null 2>&1
fi

# --- Blockchain node: reuse one that's already running. Starting a brand-new one wipes every
# account balance/app/contract address that existed before, so that is NOT done silently - it
# requires an explicit --fresh-node flag. Without it, a missing node is a hard stop with clear
# instructions, not a surprise reset (this exact silent-reset is what caused funded test accounts
# to go back to zero and broke in-progress work more than once already).
cd "$ROOT_DIR/contracts" && install_if_missing

ALLOW_FRESH_NODE=0
for arg in "$@"; do
    if [ "$arg" = "--fresh-node" ]; then
        ALLOW_FRESH_NODE=1
    fi
done

if node_is_up; then
    echo "Hardhat node already running - reusing it."
elif [ "$ALLOW_FRESH_NODE" -eq 1 ]; then
    echo "Starting a brand-new local Hardhat node (--fresh-node passed - this wipes all prior chain state)..."
    # CI=true skips Hardhat's interactive telemetry consent prompt, which would otherwise hang
    # forever waiting for stdin on a backgrounded, non-interactive process.
    CI=true npx hardhat node > "$ROOT_DIR/hardhat-node.log" 2>&1 &

    READY=0
    for i in $(seq 1 30); do
        if node_is_up; then
            READY=1
            break
        fi
        sleep 1
    done

    if [ "$READY" -ne 1 ]; then
        echo "Hardhat node did not come up within 30s - check hardhat-node.log"
        exit 1
    fi

    echo "Deploying contract to the fresh node..."
    npx hardhat run scripts/deploy.ts --network localhost
else
    echo "No Hardhat node detected at $RPC_URL."
    echo "Start one yourself in another terminal:"
    echo "    cd contracts && npx hardhat node"
    echo "then deploy to it:"
    echo "    cd contracts && npx hardhat run scripts/deploy.ts --network localhost"
    echo "Or, if you specifically want a fresh chain (this wipes all current apps/balances), re-run:"
    echo "    ./run.sh $1 --fresh-node"
    exit 1
fi

# --- Install process ---
# Silent mode: npm install is very chatty, so we redirect output to /dev/null
cd "$ROOT_DIR/web-ui" && install_if_missing
cd "$ROOT_DIR/desktop-client" && install_if_missing

# --- Apply the latest Prisma schema to the local cache database ---
cd "$ROOT_DIR/web-ui" && npx prisma migrate deploy > /dev/null 2>&1

# --- Starting Services ---
cd "$ROOT_DIR/desktop-client"
# Redirect output to /dev/null to keep terminal clean
npx ts-node local-api.ts > /dev/null 2>&1 &
DESKTOP_PID=$!

cd "$ROOT_DIR/web-ui"
if [ "$MODE" = "prod" ]; then
    # Skip the (slow) rebuild entirely if nothing under src/prisma/config has changed since the
    # last one - this is the actual "build once" behavior: repeat `./run.sh prod` runs with no
    # code changes go straight to `next start` on the existing .next output.
    NEEDS_BUILD=1
    if [ -f ".next/BUILD_ID" ]; then
        CHANGED=$(find src prisma package.json package-lock.json next.config.ts tsconfig.json \
            -newer .next/BUILD_ID 2>/dev/null | head -1)
        if [ -z "$CHANGED" ]; then
            NEEDS_BUILD=0
        fi
    fi

    if [ "$NEEDS_BUILD" -eq 1 ]; then
        echo "Source changed (or no previous build found) - rebuilding..."
        npm run build
    else
        echo "No source changes since the last build - skipping rebuild."
    fi

    echo "Starting in production mode..."
    npm run start
else
    npm run dev
fi

# Cleanup - the desktop client is this script's own child process; the Hardhat node
# deliberately is NOT killed here even if we started it, so the chain (and everything
# published on it) survives past this script exiting, same as if it were its own terminal.
kill $DESKTOP_PID 2>/dev/null
