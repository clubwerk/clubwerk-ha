#!/bin/bash
# Großer Musterverein für die Leistungsmessung starten (frisch aus werkzeuge/demo/demo.sql + werkzeuge/last/gross.js):
#   bash werkzeuge/last/start.sh            Verwaltung http://127.0.0.1:3810/admin.html · Tablet http://127.0.0.1:3810/
#                                           Mitglieder-App http://127.0.0.1:5810/ · Beregnungs-Webapp http://127.0.0.1:5811/
#   bash werkzeuge/last/start.sh --behalten Daten vom letzten Lauf weiterverwenden
# Anmeldung wie in der Demo: admin / Test-Kennwort-42 · Tablet-Passwort: Theke-Abend7 · PINs 2468 (Mitglieder), 1234/5678 (Zeiterfassung)
# Der Server läuft mit dem Abfrage-Zähler (werkzeuge/last/zaehler.js → werkzeuge/last/zaehler.log) für werkzeuge/last/messen.py.
set -e
H=$(cd "$(dirname "$0")" && pwd); APP=$(cd "$H/../../clubwerk" && pwd); DATA=${CW_LAST_DATA:-$H/daten}
bash "$H/stop.sh" >/dev/null 2>&1 || true
[ "${1:-}" = "--behalten" ] && [ -f "$DATA/clubwerk.db" ] || node "$H/gross.js" "$DATA"
mkdir -p "$H/keine-erweiterungen"
T0=$(date +%s%N)
cd "$APP"; CW_ZAEHLER_LOG="$H/zaehler.log" NODE_OPTIONS="--require $H/zaehler.js" DATA_DIR="$DATA" PORT=3810 BEREGNUNG_PORT=5811 MEMBER_PORT=5810 CW_TEST_NO_SETUP_CODE=1 EXT_DIR="$H/keine-erweiterungen" nohup node src/server.js > "$H/server.log" 2>&1 &
echo $! > "$H/server.pid"
for i in $(seq 1 240); do curl -s -o /dev/null http://127.0.0.1:3810/ && { echo "Großer Musterverein läuft nach $(( ($(date +%s%N) - T0) / 1000000 )) ms: http://127.0.0.1:3810/admin.html (admin / Test-Kennwort-42)"; exit 0; }; sleep 0.25; done
echo "Server startet nicht – siehe werkzeuge/last/server.log"; exit 1
