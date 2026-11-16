#!/bin/sh
set -e
# Neue Dateien (Datenbank, Sicherungen, Belege) nur für das Programm selbst lesbar
umask 077
# Passwörter/PINs prüft scrypt im Thread-Pool von Node; mit glibc behält sonst jeder Thread danach ~16 MB (musl/Alpine ignoriert die Variable)
export MALLOC_ARENA_MAX=1
# Zeitstempel wie im Protokoll von Clubwerk selbst
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
# Alle Daten (Datenbank, Belege) liegen in /data – das sichert Home Assistant automatisch mit.
export DATA_DIR=/data
export PORT=3100
export HOST=0.0.0.0
export BEREGNUNG_PORT=5000
export MEMBER_PORT=5001
# Seitenleiste von Home Assistant (Ingress) – nur für den Supervisor erreichbar, immer ohne Verschlüsselung (HA verschlüsselt selbst)
export INGRESS_PORT=8099
export EXT_DIR=/share/clubwerk/erweiterungen

if [ -f /data/options.json ]; then
  EPW=$(node -e "try{process.stdout.write(require('/data/options.json').notfall_passwort||'')}catch(e){}")
  [ -n "$EPW" ] && export EMERGENCY_PW="$EPW"
  # HTTPS für Tablet/Verwaltung, Mitglieder-App und Beregnung (Zertifikat aus dem Home-Assistant-Ordner /ssl)
  SSL_ON=$(node -e "try{process.stdout.write(require('/data/options.json').ssl?'1':'')}catch(e){}")
  if [ -n "$SSL_ON" ]; then
    CF=$(node -e "try{process.stdout.write(require('/data/options.json').certfile||'fullchain.pem')}catch(e){}")
    KF=$(node -e "try{process.stdout.write(require('/data/options.json').keyfile||'privkey.pem')}catch(e){}")
    case "$CF$KF" in *..*|*/*) log "HTTPS: Dateinamen ohne Ordner angeben";; *) export SSL_CERT="/ssl/$CF" SSL_KEY="/ssl/$KF";; esac
  fi
  # Nur wenn ein Proxy-Add-on (z. B. Cloudflared, NGINX) davor sitzt: dessen IP, damit die echte Absenderadresse gezählt wird.
  # Erlaubt sind private Adressen (Add-on-Netz 172.30.x, aber auch ein Proxy auf einem anderen Rechner im Vereins-WLAN); die
  # Supervisor-Adresse 172.30.32.2 bleibt dem Ingress vorbehalten und zählt hier nicht.
  PX=$(node -e "try{const v=String(require('/data/options.json').proxy_addon_ip||'').trim();if(v!=='172.30.32.2'&&/^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/.test(v))process.stdout.write(v)}catch(e){}")
  [ -n "$PX" ] && export TRUSTED_PROXY="172.30.32.2,$PX"
fi

# Zugangsschlüssel zu Home Assistant: Der Supervisor legt ihn in die Umgebung des Containers. Startet ein Basis-Image
# mit s6-overlay dieses Skript ohne diese Umgebung, liegt er unter /run/s6/container_environment – dann von dort holen.
for V in SUPERVISOR_TOKEN HASSIO_TOKEN; do
  eval "CUR=\${$V:-}"
  if [ -z "$CUR" ] && [ -r "/run/s6/container_environment/$V" ]; then export "$V=$(cat "/run/s6/container_environment/$V")"; fi
done
[ -z "${SUPERVISOR_TOKEN:-}" ] && [ -n "${HASSIO_TOKEN:-}" ] && export SUPERVISOR_TOKEN="$HASSIO_TOKEN"
if [ -n "${SUPERVISOR_TOKEN:-}" ]; then log "Verbindung zu Home Assistant: Zugangsschlüssel vorhanden."; else log "WARNUNG: Kein Zugangsschlüssel von Home Assistant (SUPERVISOR_TOKEN) – Türen, Beregnung und Updates funktionieren so nicht."; fi

# Arbeitsspeicher: Obergrenze für den Hauptprozess, ein Viertel des Geräts, 256–512 MB (Pi mit 1 GB: Home Assistant braucht selbst viel).
# Ein Speicherleck endet so als Neustart des Add-ons (Watchdog) statt im Auslagern des ganzen Geräts.
MEM_KB=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
HEAP_MB=$(( ${MEM_KB:-0} / 4096 ))
[ "$HEAP_MB" -lt 256 ] && HEAP_MB=256
[ "$HEAP_MB" -gt 512 ] && HEAP_MB=512
# Übersetzter Code wird zwischengespeichert (schnellerer Start). Nur hier für den Hauptprozess: Lese- und Demo-Kopie bekommen eine
# eigene, knappe Umgebung ohne diese Variable und hinterlassen so nichts außerhalb ihres Ordners.
export NODE_COMPILE_CACHE=/tmp/clubwerk-compile-cache
log "Clubwerk startet (Daten in /data, höchstens ${HEAP_MB} MB Arbeitsspeicher für Daten) ..."
exec node --max-old-space-size="$HEAP_MB" /app/src/server.js
