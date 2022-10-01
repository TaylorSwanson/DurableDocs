#!/bin/bash

# Kill any lingering miniflare instances
# Test port is in use first or kill gets mad
PID=$(lsof -tn -iTCP:8788 -sTCP:LISTEN)
if [[ ! -z "$PID" ]]; then
  kill -9 $PID
fi
# Inspector
PID=$(lsof -tn -iTCP:9229 -sTCP:LISTEN)
if [[ ! -z "$PID" ]]; then
  kill -9 $PID
fi

npx wrangler dev --local
