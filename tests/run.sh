#!/bin/bash
# Automatische Tests für Clubwerk. Aufruf aus dem Repository: bash tests/run.sh [namen…]   (ohne Namen: alle)
# Voraussetzung: einmal „npm ci“ im Ordner clubwerk/. Jeder Test startet seinen eigenen Server mit leeren Testdaten.
set -u
T=$(cd "$(dirname "$0")" && pwd)
export CW_APP=${CW_APP:-$(cd "$T/../clubwerk" && pwd)}
export CW_TEST_NO_SETUP_CODE=1 VH_TEST_NO_SETUP_CODE=1
S=$(mktemp -d); trap 'pkill -f "DATA_DIR=$S" 2>/dev/null; rm -rf "$S"' EXIT
mkdir -p "$S/none"; cp -r "$T/lib/evilext" "$S/"; python3 "$T/lib/make_tars.py" "$S/tarx"
NAMES="${*:-attack cw enc vjob vscope glink upd tarx pin ext harden}"
fails=0
for t in $NAMES; do
  srv=""
  if [ "$t" = harden ]; then   # erwartet einen laufenden Server ohne Einrichtung auf Port 3193
    mkdir -p "$S/r_harden"; (cd "$CW_APP" && env DATA_DIR="$S/r_harden" PORT=3193 BEREGNUNG_PORT=5193 MEMBER_PORT=5194 CW_TEST_TABLET_OPEN=1 EXT_DIR="$S/none" node src/server.js > "$S/harden_srv.log" 2>&1) & srv=$!
    for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3193/ && break; sleep 0.25; done
  fi
  out="$S/$t.out"
  (cd "$T" && timeout 600 node "${t}_test.js" "$S" > "$out" 2>&1); rc=$?
  [ -n "$srv" ] && { pkill -P $srv 2>/dev/null; kill $srv 2>/dev/null; }
  n=$(grep -c '^✘' "$out"); okc=$(grep -c '^✔' "$out")
  if [ $rc -ne 0 ] || [ "$n" -ne 0 ]; then fails=$((fails + 1)); echo "✘ $t: $n Fehler, $okc ok (Exit $rc)"; grep '^✘' "$out" | head -10; tail -5 "$out"; else echo "✔ $t: $okc ok"; fi
done
[ $fails -eq 0 ] && echo "ALLES OK" || echo "$fails Testreihe(n) mit Fehlern"
exit $([ $fails -eq 0 ] && echo 0 || echo 1)
