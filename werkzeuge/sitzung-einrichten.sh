#!/bin/bash
# Richtet eine Claude-Code-Sitzung in der Cloud ein (läuft automatisch beim Start, siehe .claude/settings.json).
# Lokal passiert nichts – außer man ruft es mit --lokal auf.
# Schnell beim zweiten Mal: Bereits Installiertes wird übersprungen.
#
# Private Dateien kommen aus den Umgebungsvariablen der Cloud-Umgebung (claude.ai/code → Umgebung bearbeiten),
# jeweils base64-kodiert, damit Zeilenumbrüche und Sonderzeichen sicher ankommen:
#   CW_GEHEIM_MUSTER_B64  → werkzeuge/geheim-muster.txt   (Zeichenfolgen, die nie ins Repository dürfen)
#   CW_PRIVAT_B64         → CLAUDE.local.md               (privater Hintergrund zum Verein)
[ "${CLAUDE_CODE_REMOTE:-}" = true ] || [ "${1:-}" = --lokal ] || exit 0
R=$(cd "$(dirname "$0")/.." && pwd); cd "$R" || exit 0
log() { echo "[Einrichtung] $*"; }

# Native Node-Module (better-sqlite3) selbst bauen können, auch wenn nodejs.org nicht erreichbar ist: lokale Header verwenden
ND=$(dirname "$(dirname "$(readlink -f "$(command -v node)")")")
[ -d "$ND/include/node" ] && export npm_config_nodedir="$ND"

npm_dir() { # Ordner – nur wenn node_modules fehlt oder package-lock neuer ist
  local d=$1
  if [ ! -d "$d/node_modules" ] || [ "$d/package-lock.json" -nt "$d/node_modules" ]; then
    log "npm ci in $d"; (cd "$d" && npm ci --no-audit --no-fund --loglevel=error) && touch "$d/node_modules" || log "npm ci in $d fehlgeschlagen"
  fi
}
npm_dir clubwerk
npm_dir werkzeuge/i18n
npm_dir werkzeuge/tests/hilfen/smtp
npm_dir werkzeuge/tests/fixtures/backup-2.16.3-src

# Python: Playwright (Design-Prüfstand) und Testserver für Sicherungsziele
python3 -c "import playwright" 2>/dev/null || { log "pip: playwright"; pip install -q --break-system-packages playwright 2>/dev/null || pip install -q playwright || true; }
python3 -c "import wsgidav, cheroot, pyftpdlib, asyncssh" 2>/dev/null || { log "pip: Testserver"; pip install -q --break-system-packages wsgidav cheroot pyftpdlib asyncssh 2>/dev/null || true; }
python3 - <<'E' 2>/dev/null || { log "Chromium für Playwright installieren"; python3 -m playwright install chromium >/dev/null 2>&1 || log "Chromium-Download gesperrt – Design-Prüfstand braucht einen vorinstallierten Browser"; }
import os
from playwright.sync_api import sync_playwright
p = sync_playwright().start(); ok = os.path.exists(p.chromium.executable_path); p.stop()
raise SystemExit(0 if ok else 1)
E

# Private Dateien aus der Cloud-Umgebung (nie committen – beide stehen in .gitignore)
if [ -n "${CW_GEHEIM_MUSTER_B64:-}" ]; then echo "$CW_GEHEIM_MUSTER_B64" | base64 -d > werkzeuge/geheim-muster.txt 2>/dev/null && log "geheim-muster.txt angelegt"; else log "Hinweis: CW_GEHEIM_MUSTER_B64 fehlt in der Cloud-Umgebung – paket.sh bricht ohne Geheimnis-Muster ab"; fi
if [ -n "${CW_PRIVAT_B64:-}" ]; then echo "$CW_PRIVAT_B64" | base64 -d > CLAUDE.local.md 2>/dev/null && log "CLAUDE.local.md angelegt"; fi
log "fertig"
exit 0
