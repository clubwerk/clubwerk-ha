#!/bin/bash
# Demo-Server mit erfundenen Beispieldaten starten (frisch aus demo.sql):
#   bash werkzeuge/demo/start.sh            Verwaltung http://127.0.0.1:3801/admin.html · Tablet http://127.0.0.1:3801/
#                                           Mitglieder-App http://127.0.0.1:5803/ · Beregnungs-Webapp http://127.0.0.1:5801/
#   bash werkzeuge/demo/start.sh --behalten Daten vom letzten Lauf weiterverwenden
# Anmeldung Verwaltung: admin / Test-Kennwort-42 · Tablet-Passwort: Theke-Abend7 · PINs der Demo: 2468 (Mitglieder), 1234/5678 (Zeiterfassung)
# Voraussetzung: einmal „npm ci“ im Ordner clubwerk/.
set -e
H=$(cd "$(dirname "$0")" && pwd); APP=$(cd "$H/../../clubwerk" && pwd); DATA=${CW_DEMO_DATA:-$H/daten}
bash "$H/stop.sh" >/dev/null 2>&1 || true
[ "${1:-}" = "--behalten" ] && [ -f "$DATA/clubwerk.db" ] || node "$H/laden.js" "$DATA"
mkdir -p "$H/keine-erweiterungen"
cd "$APP"; DATA_DIR="$DATA" PORT=3801 BEREGNUNG_PORT=5801 MEMBER_PORT=5803 CW_TEST_NO_SETUP_CODE=1 EXT_DIR="$H/keine-erweiterungen" nohup node src/server.js > "$H/server.log" 2>&1 &
echo $! > "$H/server.pid"
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:3801/ && { echo "Demo läuft: http://127.0.0.1:3801/admin.html (admin / Test-Kennwort-42)"; exit 0; }; sleep 0.5; done
echo "Demo-Server startet nicht – siehe werkzeuge/demo/server.log"; exit 1
