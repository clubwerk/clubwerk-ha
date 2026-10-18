#!/usr/bin/with-contenv sh
set -e
# Neue Dateien (Datenbank, Sicherungen, Belege) nur für das Programm selbst lesbar
umask 077
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
    case "$CF$KF" in *..*|*/*) echo "HTTPS: Dateinamen ohne Ordner angeben";; *) export SSL_CERT="/ssl/$CF" SSL_KEY="/ssl/$KF";; esac
  fi
  # Nur wenn ein Proxy-Add-on (z. B. Cloudflared, NGINX) davor sitzt: dessen IP, damit die echte Absenderadresse gezählt wird
  PX=$(node -e "try{const v=String(require('/data/options.json').proxy_addon_ip||'').trim();if(/^172\.30\.(32|33)\.\d{1,3}$/.test(v))process.stdout.write(v)}catch(e){}")
  [ -n "$PX" ] && export TRUSTED_PROXY="172.30.32.2,$PX"
fi

# Zugangsschlüssel zu Home Assistant: Der Supervisor legt ihn in die Umgebung des Containers. Startet das Basis-Image
# (s6-overlay) dieses Skript ohne diese Umgebung, liegt er unter /run/s6/container_environment – dann von dort holen.
for V in SUPERVISOR_TOKEN HASSIO_TOKEN; do
  eval "CUR=\${$V:-}"
  if [ -z "$CUR" ] && [ -r "/run/s6/container_environment/$V" ]; then export "$V=$(cat "/run/s6/container_environment/$V")"; fi
done
[ -z "${SUPERVISOR_TOKEN:-}" ] && [ -n "${HASSIO_TOKEN:-}" ] && export SUPERVISOR_TOKEN="$HASSIO_TOKEN"
if [ -n "${SUPERVISOR_TOKEN:-}" ]; then echo "Verbindung zu Home Assistant: Zugangsschlüssel vorhanden."; else echo "WARNUNG: Kein Zugangsschlüssel von Home Assistant (SUPERVISOR_TOKEN) – Türen, Beregnung und Updates funktionieren so nicht."; fi

echo "Clubwerk startet (Daten in /data) ..."
exec node /app/src/server.js
