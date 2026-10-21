#!/bin/bash
# Demo-Server beenden
H=$(cd "$(dirname "$0")" && pwd)
[ -f "$H/server.pid" ] && kill "$(cat "$H/server.pid")" 2>/dev/null; rm -f "$H/server.pid"
for i in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:3801/ || exit 0; sleep 0.25; done; true
