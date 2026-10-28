# Clubwerk – Dokumentation

Clubwerk ist eine modulare Vereinsverwaltung: ein Kern (Mitglieder & Konten, Benutzer & Rechte, Einstellungen, Datensicherung, Protokoll, Mitglieder-App, Tablet) und Module, die einzeln ein- und ausgeschaltet werden (Einstellungen › Module). Ein Verein kann z. B. nur die Zeiterfassung nutzen. Beim ersten Start führt der Einrichtungs-Assistent durch alles Nötige.

## Wo steht die Anleitung?

Jedes Modul hat eine eigene, bebilderte **Anleitung als PDF** (Deutsch und Englisch, passend zur eingestellten Sprache):

- In der Verwaltung unter **Einstellungen › Module** beim Modul auf **„Anleitung (PDF)“** – auch für Module, die noch ausgeschaltet sind.
- Oben rechts auf jeder Verwaltungsseite der **„?“-Knopf**: Er öffnet die Anleitung an der Stelle des gerade offenen Reiters.

| Anleitung | Inhalt |
|---|---|
| Kern | Übersicht, Einrichtung, Mitglieder & Konten, Mitglieder-App, Nachrichten, Kontoauszug, Benutzer & Rechte, Datensicherung, Protokoll, Einstellungen, Tablet |
| Verkauf | Tablet-Verkauf, Buchungen, Abrechnung, Veranstaltungen & Deckel, Auswertung, Lager und Artikel |
| Plätze | Platzbuchung, Serien & Sperren, Gebühren, Auswertung |
| Spielbetrieb | Mannschaften, Spieltage, Rückmeldungen, Aufstellung |
| Turniere | Clubmeisterschaft, Turniertag (LK), Turnierplaner |
| Dienste & Termine | Dienstpläne, Einsätze, Termine mit Zu- und Absage, Stunden |
| Zeiterfassung | Stempeln, Stunden, Personal |
| Beregnung | Bedienen, Plätze & Zonen, Verlauf |
| Zugang | Türen, Zeitprofile, Sperrtage, Verlauf |
| Mängel | Meldungen, Orte, Aufbewahrung |
| Mitglieder | Stammdaten, Beiträge, Einzug, Posten, Mahnwesen, Gratulationen |
| Buchhaltung | Rechnungen, Spenden, Firmen |

Die PDFs entstehen beim Bauen des Pakets und liegen im Add-on (`erweiterungen/<modul>/ANLEITUNG.de.pdf`, Kern und Verkauf unter `anleitungen/`). Sie brauchen kein Internet.

## Installation

Schritt für Schritt steht sie in der **Installationsanleitung** (`INSTALLATION.md`): feste IP, Add-on kopieren, installieren, konfigurieren, Tablet einrichten, HTTPS, Updates, Sicherung und Notfall, Installation über ein GitHub-Repository. Kennzahlen für Home Assistant (REST-Sensor) stehen dort in Abschnitt 9.

## Mitglieder-App von unterwegs (Cloudflare Tunnel)
Normalerweise ist die Mitglieder-App nur im Vereins-WLAN erreichbar. Damit Mitglieder auch von zu Hause buchen können, wird **nur die Mitglieder-App** über einen Cloudflare Tunnel ins Internet gebracht – ohne Portfreigabe am Router.

1. Kostenloses Konto bei Cloudflare anlegen und die Domain des Vereins dort verwalten lassen (z. B. `meinverein.de`).
2. Cloudflare → Zero Trust → Networking → Tunnels → „Tunnel erstellen“ → Cloudflared → Namen vergeben → Umgebung **Docker** → aus dem angezeigten Befehl den **Token** (die lange Zeichenkette nach `--token`) kopieren.
3. In Home Assistant das Add-on **Cloudflared** installieren (Add-on-Store, Repository von Tobias Brenner), unter Konfiguration den Token bei „Tunnel token“ eintragen, kein „External Home Assistant Hostname“ setzen, starten.
4. Im Tunnel unter „Routes“ → „Add route“ → **„Published application“** einen Eintrag anlegen: Subdomain `app`, Domain `meinverein.de`, Dienst **HTTPS** (bzw. HTTP, wenn HTTPS in Clubwerk aus ist), URL `IP-von-Home-Assistant:5001` (Port der Mitglieder-App). Bei HTTPS unter „Additional application settings → TLS“ **No TLS Verify** einschalten. **Keine weiteren Ports** freigeben.
5. In Clubwerk unter Mitglieder-App › Einstellungen › „Von unterwegs erreichbar“ `https://app.meinverein.de` eintragen, „eingeschaltet“ anhaken, speichern und „Verbindung prüfen“.
6. Neue QR-Codes enthalten jetzt die öffentliche Adresse und funktionieren im WLAN und unterwegs. Bereits gekoppelte Handys brauchen für unterwegs einen neuen QR-Code – in der Liste stehen sie mit „alte Adresse – neuer QR-Code nötig“, der Filter „alte Adresse“ zeigt sie gesammelt.
7. Unter **„Von unterwegs nutzbar“** je Bereich festlegen, ob er auch über das Internet funktioniert. Vorgabe: Buchen, Meine Daten und Helferdienste ja, Beregnung und Türen nein. **Als Vereins-WLAN gilt ausschließlich, was direkt bei Home Assistant ankommt** – alles über den Tunnel ist „unterwegs“, egal von welcher Adresse (auch iCloud Privat-Relay spielt dann keine Rolle). Ändern darf das nur, wer das Recht „Einstellungen“ hat. Einzelne Mitglieder (Platzwart, Vorstand) bekommen in der Tabelle die Ausnahme „auch unterwegs“. Startet so ein Mitglied die Beregnung von unterwegs, fragt die App nach der PIN (Stoppen geht immer ohne). Unter **„Vereinsnetz“** lässt sich festlegen, welche Netze als Vereinsheim zählen (z. B. `192.168.10.0/24`, Knopf „Mein Netz übernehmen“); leer = jede private Adresse. Das interne Home-Assistant-Netz (172.30.32.x/33.x) zählt nie.
8. **Lokale Route einrichten (nötig, damit WLAN-Bereiche über die öffentliche App im Vereinsheim funktionieren):** Die App unter `https://app.meinverein.de` prüft beim Start, ob sie die lokale Adresse erreicht, und nutzt sie dann für alle Aufrufe (schneller, kein Tunnel). Das geht nur mit **HTTPS und gültigem Zertifikat** für die lokale Adresse (Browser blocken http von einer https-Seite):
   - Cloudflare → DNS → Eintrag `lan` (Typ A) → lokale IP von Home Assistant (z. B. 192.168.178.20), Proxy **aus** (graue Wolke). Private Adressen sind erlaubt.
   - Add-on **Let's Encrypt** (Home Assistant): Domain `lan.meinverein.de`, Challenge `dns`, Provider `dns-cloudflare` mit einem Cloudflare-API-Token (Zone → DNS → Bearbeiten). Zertifikat landet unter `/ssl/fullchain.pem` und `/ssl/privkey.pem`; das Add-on erneuert es automatisch.
   - Clubwerk-Add-on → Konfiguration: `ssl: true`, `certfile: fullchain.pem`, `keyfile: privkey.pem`, neu starten. Cloudflare-Route (Published application): Dienst-URL `https://IP:5001` (mit `https://`, sonst Umleitungsschleife) und unter TLS den **Ursprungs-Servernamen** `lan.meinverein.de` eintragen (dann prüft Cloudflare das Zertifikat gegen diesen Namen; alternativ „TLS-Zertifikats-Überprüfung deaktivieren“).
   - Clubwerk → Mitglieder-App → „Adresse im Vereins-WLAN“: `https://lan.meinverein.de:5001`. Die Karte zeigt „ist eingerichtet ✓“.
   - Prüfen: Im Vereins-WLAN in der App die Beregnung öffnen; `https://app.meinverein.de/api/ping` zeigt die vom Server gesehene Adresse (`ip`) und `wlan: true/false`.
   - Router mit DNS-Rebind-Schutz (Fritz!Box): `lan.meinverein.de` unter Heimnetz → Netzwerk → Netzwerkeinstellungen → DNS-Rebind-Schutz als Ausnahme eintragen, sonst löst das Handy den Namen im WLAN nicht auf.
   - **iCloud Privat-Relay (iPhone):** Mit Privat-Relay scheitert die stille Hintergrundprüfung der lokalen Adresse (das Relay erreicht 192.168.x.x nicht). Dafür zeigt der Bildschirm „Nur im Vereins-WLAN“ den Knopf **„Im Vereinsheim lokal öffnen“**: Die App bettet den Bereich als Inlay von der lokalen Adresse ein (bleibt in der App, kein Wechsel nach Safari) und nimmt die Kopplung über einen einmaligen Code mit (60 s, nur mit PIN, nur aus dem Vereinsnetz einlösbar) – das Mitglied gibt einmal seine PIN ein, danach merkt sich der Browser die Freischaltung auch für die lokale Adresse. Hat das Inlay einmal geantwortet, öffnet es sich beim nächsten Antippen des Bereichs von selbst. Antwortet die lokale Adresse nicht binnen 8 s, zeigt die App einen Hinweis und „Zurück“ – sie verlässt sich nie selbst. Die Diagnosezeile unter dem Knopf zeigt, warum die Hintergrundprüfung scheiterte. Technisch: `?embed=<bereich>` zeigt die App ohne Kopf und Reiter; Einbetten erlauben sich nur die eigenen Adressen gegenseitig (CSP `frame-ancestors`/`frame-src`).

**Sicherheit des Tunnels:** Verwaltung, Tablet-Seiten und Beregnung lehnen jede Anfrage ab, die über den Tunnel kommt – auch wenn der Tunnel versehentlich auf den falschen Port zeigt. Die Mitglieder-App antwortet nur unter der eingetragenen Adresse. Jedes Handy ist einzeln mit QR-Code und PIN gekoppelt; Fehlversuche werden je Absender gesperrt. Ausschalten genügt, um den Zugang von außen sofort zu schließen.
