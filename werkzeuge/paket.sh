#!/bin/bash
# Neue Version prüfen und als ZIP bauen. Aufruf aus dem Repository-Hauptordner:
#   bash werkzeuge/paket.sh            alle Prüfungen, dann werkzeuge/ausgabe/clubwerk-<version>.zip
#   bash werkzeuge/paket.sh --ohne-tests   Testreihen überspringen (nur für Zwischenstände, nie für eine Auslieferung)
# Bricht bei jedem Fehler ab. Danach: node werkzeuge/pruef.js, committen, pushen, node werkzeuge/modver.js save clubwerk (Datei mitcommitten).
set -u
R=$(cd "$(dirname "$0")/.." && pwd); A=$R/clubwerk; W=$R/werkzeuge; cd "$R"
fail() { echo "ABBRUCH: $*"; exit 1; }
echo "== 1. Versionen"
V=$(sed -n 's/^version: "\(.*\)"/\1/p' "$A/config.yaml")
PV=$(node -p "require('$A/package.json').version"); AV=$(grep -o "const APP_VER = '[^']*'" "$A/public/app/app.js" | sed "s/.*'\(.*\)'/\1/")
LV=$(node -p "const l=require('$A/package-lock.json'); [l.version, (l.packages||{})[''] && l.packages[''].version].join(' ')")
[ "$V" = "$PV" ] || fail "config.yaml $V ≠ package.json $PV"
[ "$V" = "$AV" ] || fail "config.yaml $V ≠ APP_VER $AV in public/app/app.js (sonst lädt die Mitglieder-App nach dem Update nicht neu)"
[ "$LV" = "$V $V" ] || fail "package-lock.json hat „$LV“ statt zweimal $V"
grep -q "^## $V\$" "$A/CHANGELOG.md" || fail "CHANGELOG.md hat keinen Abschnitt „## $V“"
git -C "$R" tag | grep -qx "v$V" && fail "Version $V gibt es schon – jede Änderung braucht eine neue Nummer"
echo "   $V"
echo "== 2. Modulversionen"
node "$W/modver.js" check "$A" || fail "Modul geändert ohne neue Versionsnummer (erweiterungen/<modul>/erweiterung.json bzw. verkaufVersion in package.json)"
echo "== 3. Übersetzungen"
[ -d "$W/i18n/node_modules" ] || (cd "$W/i18n" && npm ci --silent --no-audit --no-fund)
node "$W/i18n/extract.js" > /dev/null || fail "Textextraktion"
node "$W/i18n/fehlend.js" || fail "Englische Übersetzungen fehlen – siehe werkzeuge/i18n/ANLEITUNG-EN.md"
echo "== 4. Geheimnisse"
MUSTER=$W/.geheim-muster; [ -f "$MUSTER" ] || MUSTER=$W/geheim-muster.txt   # lokal, nie im Repository: eine Zeichenfolge pro Zeile (alter API-Schlüssel, echte PIN, echte Passwörter …)
[ -f "$MUSTER" ] || fail "werkzeuge/geheim-muster.txt fehlt – einmal anlegen (siehe CLAUDE.md, Abschnitt Geheimnisse)"
PAT=$(mktemp); grep -v '^\s*#' "$MUSTER" | grep -v '^\s*$' > "$PAT"
TREFFER=$( (git -C "$R" ls-files; git -C "$R" ls-files --others --exclude-standard) | grep -v "^werkzeuge/\.\?geheim-muster\(\.txt\)\?$" | tr '\n' '\0' | xargs -0 grep -IlF -f "$PAT" 2>/dev/null); rm -f "$PAT"
[ -z "$TREFFER" ] || fail "Geheimnis gefunden in: $TREFFER"
grep -rIlE "BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY" "$A" --exclude-dir=node_modules && fail "privater Schlüssel im Paket"
find "$A" -path "$A/node_modules" -prune -o \( -name "*.db" -o -name "*.csv" -o -name ".env" \) -print | grep -q . && fail "Datenbank-/CSV-/Env-Datei im Paket"
echo "   sauber"
if [ "${1:-}" != "--ohne-tests" ]; then
  echo "== 5. Tests"
  [ -d "$A/node_modules" ] || (cd "$A" && npm ci --silent --no-audit --no-fund) || fail "npm ci in clubwerk/"
  bash "$R/tests/run.sh" || fail "tests/run.sh"
  bash "$W/tests/run.sh" || fail "werkzeuge/tests/run.sh: neue Fehlschläge"
fi
echo "== 6. Design-Prüfstand"
G=$W/design-pruefstand/ausgabe
if [ ! -f "$G/gruen" ] || [ -n "$(find "$A/public" "$A/erweiterungen" "$A/src" -type f -newer "$G/gruen" | head -1)" ]; then
  bash "$W/demo/start.sh" || fail "Demo-Server"
  python3 "$W/design-pruefstand/gate.py" $([ "$(uname)" = Darwin ] && python3 -c "import playwright" 2>/dev/null && echo --webkit) > "$W/design-pruefstand/lauf.log" 2>&1
  rc=$?; bash "$W/demo/stop.sh"
  tail -1 "$W/design-pruefstand/lauf.log"
  [ $rc -eq 0 ] || { head -40 "$G/befunde.txt"; fail "Design-Prüfstand nicht grün (Bilder: werkzeuge/design-pruefstand/ausgabe)"; }
else echo "   grün (seit der letzten Änderung schon geprüft)"; fi
echo "== 7. ZIP"
mkdir -p "$W/ausgabe"; Z=$W/ausgabe/clubwerk-$V.zip; rm -f "$Z"
(cd "$R" && zip -qr "$Z" clubwerk -x "clubwerk/node_modules/*" "clubwerk/data/*" "*.DS_Store") || fail "zip"
echo "   $Z ($(du -h "$Z" | cut -f1))"
echo "Fertig. Weiter: node werkzeuge/pruef.js · committen · pushen · node werkzeuge/modver.js save clubwerk (mitcommitten) · git tag v$V"
