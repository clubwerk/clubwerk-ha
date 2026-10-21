#!/bin/bash
# Erweiterte Testreihen (rund 50, zusätzlich zu tests/run.sh im Repository-Hauptordner).
#   bash werkzeuge/tests/run.sh              alle
#   bash werkzeuge/tests/run.sh bk mv ber    nur diese
# Vergleich mit werkzeuge/tests/erwartet.txt (Testreihe: Testname der bekannten Fehlschläge). Neue Fehlschläge → Rückgabewert 1.
# Hinweis: „zeit: Gehen mit Tagesdauer“ schlägt kurz nach Mitternacht fehl (Schicht über Mitternacht) – dann tagsüber wiederholen.
# Voraussetzungen: einmal „npm ci“ in clubwerk/ (den Test-Mailserver installiert der Lauf selbst). Für „targets“ zusätzlich: pip install wsgidav cheroot pyftpdlib asyncssh
# Für „migrate“: der alte Stand 2.16.3 liegt in fixtures/backup-2.16.3-src; seine Bibliotheken holt der Test beim ersten Lauf (npm ci).
set -u
H=$(cd "$(dirname "$0")" && pwd)
export CW_APP=${CW_APP:-$(cd "$H/../../clubwerk" && pwd)}
S=$(mktemp -d "${TMPDIR:-/tmp}/cwtest.XXXXXX"); W=$S/work
mkdir -p "$W" "$S/none" "$S/srv/dav" "$S/srv/ftp" "$S/srv/sftp"
cp -R "$H/fixtures/." "$S/"; cp "$H"/hilfen/*.js "$W/"; cp "$H"/*_test.js "$W/"
# alter Stand: Bibliotheken einmalig im Werkzeugordner installieren und verlinken
OLD="$H/fixtures/backup-2.16.3-src"
export CW_TEST_NO_SETUP_CODE=1 VH_TEST_NO_SETUP_CODE=1 CW_TEST_TABLET_OPEN=1
PIDS=()
start_bg() { "$@" & PIDS+=($!); }
kill_srv() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && { pkill -P "$p" 2>/dev/null; kill "$p" 2>/dev/null; }; done; PIDS=(); sleep 0.7; }
trap 'kill_srv; kill ${SMTP_PID:-0} 2>/dev/null; rm -rf "$S"' EXIT
srv() { # name port [ENV=… …]
  local n=$1 p=$2; shift 2; local D=$S/r_$n; rm -rf "$D"; mkdir -p "$D"
  start_bg bash -c "cd \"$CW_APP\" && exec env DATA_DIR=\"$D\" PORT=$p $* TRUSTED_PROXY=172.30.32.2 EXT_DIR=\"$S/none\" node src/server.js > \"$S/r_$n.log\" 2>&1"
  for i in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$p/" && return; sleep 0.25; done
}
seed() { # Testdaten mit erfundenen Namen vorbereiten (vor srv)
  local D=$S/r_$1; rm -rf "$D"; mkdir -p "$D"
  (cd "$CW_APP" && DATA_DIR="$D" SEED=on node -e "
    const {seedIfEmpty}=require('./src/seed'); seedIfEmpty();
    const {db}=require('./src/db'); const ins=db.prepare(\"INSERT INTO members(name,kind) VALUES (?,'mitglied')\");
    require('$S/names.json').forEach(n=>ins.run(n));") >/dev/null 2>&1
}
seeded() { seed "$1"; local n=$1 p=$2; shift 2; local D=$S/r_$n
  start_bg bash -c "cd \"$CW_APP\" && exec env DATA_DIR=\"$D\" PORT=$p $* TRUSTED_PROXY=172.30.32.2 EXT_DIR=\"$S/none\" node src/server.js > \"$S/r_$n.log\" 2>&1"
  for i in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$p/" && return; sleep 0.25; done
}
plain() { srv "$@"; }
withha() { # Server mit Home-Assistant- und Hydrawise-Nachbildung (3240/5240/5243, HA 5241, Hydrawise 5242)
  start_bg node "$W/ha_mock.js"; start_bg node "$W/hw_mock.js"; sleep 0.5
  srv "$1" 3240 BEREGNUNG_PORT=5240 MEMBER_PORT=5243 HA_URL=http://127.0.0.1:5241/api HA_TOKEN=tok HYDRAWISE_BASE=http://127.0.0.1:5242
}
# Test-Mailserver (Port 2525): legt jede Mail als $S/smtp/mailN.json ab
[ -d "$H/hilfen/smtp/node_modules" ] || (cd "$H/hilfen/smtp" && npm ci --silent --no-audit --no-fund)
mkdir -p "$S/smtp"; cp "$H/hilfen/smtp/srv.js" "$S/smtp/"; ln -sfn "$H/hilfen/smtp/node_modules" "$S/smtp/node_modules"
node "$S/smtp/srv.js" > "$S/smtp/srv.log" 2>&1 & SMTP_PID=$!
RES=$S/ergebnis.txt; : > "$RES"
run() { local out=$S/t_$1.out; (cd "$W" && timeout 600 node "$1_test.js" "$S" > "$out" 2>&1)
  echo "== $1: $(grep -c '^✘' "$out") Fehler · $(grep -c '^✔' "$out") ok"; grep '^✘' "$out" | sed -e "s/^/$1: /" -e 's/  .*$//' >> "$RES"; }   # nur Testreihe und Testname vergleichen, nicht die Details
NAMES="${*:-$(cat "$H/namen.txt")}"
for t in $NAMES; do
  case $t in
    harden) plain harden 3193 BEREGNUNG_PORT=5193 MEMBER_PORT=5194; run harden ;;
    priv) seeded priv 3201; run priv ;;
    gate) seeded gate 3233 CW_TEST_TABLET_OPEN=0; run gate ;;
    zug|app) withha "$t"; run "$t" ;;
    ber) withha ber; run ber; run ber2; run ber3 ;;
    ber2|ber3) ;;   # laufen mit ber auf demselben Server
    abtipp) plain abtipp 3232; run abtipp ;;
    admin) seeded admin 3208; run admin ;;
    api) seeded api 3196; run api ;;
    audit) seeded audit 3202; run audit ;;
    evt) seeded evt 3198; run evt ;;
    inact) seeded inact 3206; run inact ;;
    logo) seeded logo 3192; run logo ;;
    mod) plain mod 3238; run mod ;;
    neutral) plain neutral 3211; run neutral ;;
    settle) seeded settle 3205; run settle ;;
    v114) plain v114 3236; run v114 ;;
    zeit) srv z 3234; run zeit ;;
    dbx) start_bg node "$W/fake_dropbox.js"; sleep 0.5; plain dbx 3199 DROPBOX_API=http://localhost:3299 DROPBOX_CONTENT=http://localhost:3299; run dbx ;;
    shutdown) start_bg node "$W/ha_mock.js"; sleep 0.5; run shutdown ;;
    migrate) if [ ! -d "$OLD/node_modules" ]; then (cd "$OLD" && npm ci --silent --no-audit --no-fund) || echo "migrate: npm ci für den alten Stand fehlgeschlagen"; fi
             ln -sfn "$OLD/node_modules" "$S/backup-2.16.3-src/node_modules"; run migrate ;;
    targets) start_bg python3 "$S/srv/servers.py"; start_bg python3 "$S/srv/servers.py" ftps; start_bg python3 "$S/srv/servers.py" ftp; sleep 4; run targets ;;
    *) run "$t" ;;
  esac
  kill_srv
done
# Vergleich mit den bekannten Fehlschlägen
neu=0
while IFS= read -r l; do grep -qxF "$l" "$H/erwartet.txt" 2>/dev/null || { echo "NEU ✘ $l"; neu=$((neu + 1)); }; done < "$RES"
for t in $NAMES; do grep "^$t: " "$H/erwartet.txt" 2>/dev/null; done | while IFS= read -r l; do grep -qxF "$l" "$RES" || echo "behoben: $l"; done
if [ "${CW_ERWARTET_SPEICHERN:-}" = 1 ]; then sort -u "$RES" > "$H/erwartet.txt"; echo "erwartet.txt aktualisiert"; fi
[ $neu -eq 0 ] && echo "OK – keine neuen Fehlschläge" || echo "$neu neue Fehlschläge"
exit $([ $neu -eq 0 ] && echo 0 || echo 1)
