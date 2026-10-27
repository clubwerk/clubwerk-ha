# Clubwerk – Installationsanleitung

Für jeden Verein mit Vereinsheim und Home Assistant. Schritt für Schritt von der ZIP-Datei bis zum fertigen Tablet an der Theke.
Zeitbedarf: ca. 1 Stunde (davon 10–20 Minuten Warten, während Home Assistant das Add-on baut).

---

## 0. Was du brauchst

| Was | Hinweis |
|---|---|
| **Home Assistant** | als **Home Assistant OS** (z. B. Raspberry Pi 4/5, Home Assistant Green/Yellow, Mini-PC). Nur diese Variante (oder „Supervised“) kann Add-ons installieren – *Home Assistant Container/Core* kann es **nicht**. Prüfen: **Einstellungen → System → Info**: dort muss „Installationsart: Home Assistant OS“ stehen. |
| **Speicher** | ca. 1 GB frei (Einstellungen → System → Speicher) |
| **Internet** | nur bei der Installation (Home Assistant lädt die Bausteine für das Add-on) |
| **Ein PC/Mac** | im selben Netz wie Home Assistant, zum Kopieren der Dateien |
| **Tablet** | Android-Tablet (z. B. Teclast T70 Pro) mit **Fully Kiosk Browser** (Plus-Lizenz), Tablet-Ständer, Ladekabel |
| **Optional** | Shelly Plug S Gen3 zum schonenden Laden des Tablet-Akkus |

**Inhalt der ZIP-Datei**

```
clubwerk-ha/
├── repository.yaml          ← nur für Variante B (GitHub)
└── clubwerk/             ← das eigentliche Add-on
    ├── config.yaml
    ├── Dockerfile
    ├── DOCS.md              ← Bedienungsanleitung (Reiter „Dokumentation“)
    ├── INSTALLATION.md      ← diese Anleitung
    ├── src/  public/  seed/ …
```

---

## 1. Feste IP-Adresse für Home Assistant

Das Tablet ruft Clubwerk über die IP-Adresse von Home Assistant auf. Damit sich diese nie ändert:

1. IP nachsehen: **Einstellungen → System → Netzwerk** (z. B. `192.168.178.20`).
2. Im Router (FRITZ!Box: **Heimnetz → Netzwerk → Gerät bearbeiten → „Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“**) die Adresse festhalten.

Diese IP brauchst du später für das Tablet. Im Folgenden steht dafür `<HA-IP>`.

---

## 2. Zugriff auf den Ordner `addons` einrichten (Samba)

1. **Einstellungen → Add-ons → Add-on-Store** → **Samba share** suchen → **Installieren**.
2. Reiter **Konfiguration**: Benutzername und Passwort eintragen (frei wählbar) → **Speichern**.
3. Reiter **Info** → **Starten**.
4. Am PC den Ordner öffnen:
   - **Windows**: Explorer → Adresszeile `\\<HA-IP>\addons` (oder `\\homeassistant.local\addons`) → mit dem Samba-Benutzer anmelden.
   - **Mac**: Finder → **Gehe zu → Mit Server verbinden** → `smb://<HA-IP>/addons`.

*Alternative ohne Samba:* Add-on **Studio Code Server** oder **Advanced SSH & Web Terminal** – der Ordner heißt dort `/addons`.

---

## 3. Add-on-Dateien kopieren

1. ZIP-Datei am PC **entpacken**.
2. Den Ordner **`clubwerk`** (nicht `clubwerk-ha`!) in den Samba-Ordner `addons` kopieren.
3. Prüfen – so muss es aussehen:

```
addons/
└── clubwerk/
    ├── config.yaml      ← muss DIREKT hier liegen
    ├── Dockerfile
    └── …
```

> Häufigster Fehler: ein Ordner zu viel, z. B. `addons/clubwerk-ha/clubwerk/config.yaml` oder `addons/clubwerk/clubwerk/config.yaml`. Dann findet Home Assistant das Add-on nicht.

---

## 4. Add-on installieren

1. **Einstellungen → Add-ons → Add-on-Store**.
2. Oben rechts **⋮ → Nach Updates suchen**. Danach die Seite neu laden (F5).
3. Ganz oben erscheint der Abschnitt **Lokale Add-ons** mit **Clubwerk** → anklicken → **Installieren**.
4. Jetzt baut Home Assistant das Add-on (lädt Node.js, PDF- und Texterkennung). **Raspberry Pi: 10–20 Minuten**, Mini-PC: 3–5 Minuten. Das Fenster darf offen bleiben oder geschlossen werden.

Falls die Installation abbricht: **Einstellungen → System → Protokolle → Supervisor** ansehen. Meist fehlt Internet oder Speicherplatz – beheben und erneut **Installieren**.

---

## 5. Konfigurieren und starten

1. Reiter **Konfiguration**:
   - `notfall_passwort`: **leer lassen** (nur für den Notfall, siehe Abschnitt 11)
   - Unten bei **Netzwerk** steht der Port **3100** für das Tablet. Nur ändern, wenn 3100 schon belegt ist.
   → **Speichern**.
2. Reiter **Info**: einschalten
   - **Beim Booten starten**
   - **Watchdog** (startet die App neu, falls sie hängt)
   - **In der Seitenleiste anzeigen**
3. **Starten**.
4. Reiter **Protokoll**: Nach einigen Sekunden steht dort
   `Clubwerk läuft auf http://0.0.0.0:3100`. Damit ist die Installation fertig.

---

## 6. Ersteinrichtung in der Verwaltung

1. In der Home-Assistant-Seitenleiste **Clubwerk** öffnen.
   Wer die Verwaltung stattdessen direkt im Browser öffnet (`http://<Adresse>:3100`), wird bei der ersten Einrichtung nach einem **Einrichtungscode** gefragt. Er steht im Reiter **Protokoll** des Add-ons („Erste Einrichtung – Einrichtungscode: XXXX-XXXX“). So kann niemand im WLAN der neuen Installation zuvorkommen und das Adminkonto anlegen.
2. **Willkommen & Admin-Konto**: Sprache wählen, **„Einrichtung starten“**, dann Name, Benutzername (vorgeschlagen: **admin**) und Passwort (mind. 8 Zeichen) festlegen und gut aufbewahren! Das Adminkonto hat immer alle Rechte und kann nicht gelöscht werden.
   **Einrichtungs-Assistent**: Danach führt Clubwerk Schritt für Schritt durch Verein, „Wie nutzt ihr Clubwerk?“ (mit oder ohne Tablet), Module, Sicherheit, Postfach, die Module, Mitglieder-App, Vereinsnetz und Sicherungen. Jeder Schritt lässt sich mit „Später“ überspringen; offene Punkte stehen auf der Übersicht und unter **Verein → Einrichtung**. Module sind später jederzeit unter **Einstellungen → Module & Erweiterungen** änderbar. Die Schritte 5–7 betreffen nur das Modul Verkauf.
   Tipp: Danach für dich selbst einen eigenen Benutzer mit **„Alle Rechte“** anlegen und das Adminkonto nur als Reserve verwenden.
3. **Mitglieder importieren**: **Mitglieder & Konten → Excel importieren …** → Excel-Datei mit den Spalten **Vorname** und **Nachname** wählen (z. B. ein Export aus der Vereinsverwaltung; optional Spalte **Typ** = „Mannschaft“ für Mannschaften/Gruppen) → Vorschau prüfen → **… Mitglieder anlegen**.
   „Verein (kostenfrei)“ und „Gast (bar)“ sind bereits angelegt.
   **Logo & Farbe**: unter **Einstellungen → Vereinslogo** hochladen – die Vereinsfarbe wird aus dem Logo übernommen.
4. **Benutzer & Rechte**: weitere Admins anlegen, z. B.

   | Person | Rechte |
   |---|---|
   | Kassierer | Abrechnung, Übernahme |
   | Getränkewart | Lieferungen, Bestand, Bestellung, Artikel |
   | Festwart | Veranstaltungen |
   | Vorstand | Buchungen, Mitglieder |
   | Vereins-Technik / Stellvertretung | Alle Rechte |

5. **Artikel**: Die allgemeine Beispielliste anpassen (Preise, Einzelartikel je Kiste, Mindestbestand) oder unter **Artikel → Excel importieren …** die eigene Liste einspielen.
6. **Bestand & Inventur**: einmal den Anfangsbestand zählen und eintragen.
7. **Einstellungen**: Bestelldaten (Lieferant, E-Mail), „Ich bin öfter hier“ (Anzahl/Tage).
8. **Datensicherung → Dropbox** (optional): täglicher Export – die Anleitung steht direkt auf der Seite.

---

## 7. Tablet einrichten (Fully Kiosk Browser)

**Grundeinstellungen am Tablet**
1. Tablet ins **Vereins-WLAN** (dasselbe Netz wie Home Assistant).
2. **Einstellungen → Display**: Bildschirm-Timeout auf das Maximum, Helligkeit nach Wunsch.
3. Im Browser einmal `http://<HA-IP>:3100` aufrufen – es muss die Namensliste erscheinen.

**Fully Kiosk Browser** (Play Store, Plus-Lizenz für den Kiosk-Modus)
1. Beim ersten Start als **Start-URL** `http://<HA-IP>:3100` eintragen.
2. Einstellungen (vom linken Rand wischen → **Settings**):
   - **Web Content Settings → Start URL**: `http://<HA-IP>:3100`
   - **Web Browsing Settings → Reload on Internet Reconnect**: an
   - **Device Management → Keep Screen On**: an; **Launch on Boot**: an
   - **Device Management → Screen Orientation**: Landscape (quer)
   - **Kiosk Mode → Enable Kiosk Mode**: an, **Kiosk Mode PIN** vergeben (verhindert, dass jemand die App verlässt)
   - **Remote Administration**: an, Passwort vergeben (nur nötig für die Home-Assistant-Integration unten)
3. Tablet neu starten → Clubwerk muss von allein im Vollbild erscheinen.

**Optional: Buchungsseite mit Passwort schützen.** Soll nicht jeder im WLAN (z. B. mit dem eigenen Handy) buchen können, in der Verwaltung unter **Einstellungen → „Buchungsseite mit Passwort schützen“** ein Passwort festlegen. Das Tablet zeigt dann einmal „Buchungsseite gesperrt“ – Passwort eingeben, danach bleibt es freigeschaltet (bis zu 400 Tage). Wichtig für Fully Kiosk: Cookies dürfen beim Neustart nicht gelöscht werden (Standard; falls ihr das Löschen von Cookies aktiviert habt, wieder ausschalten). Neues Passwort oder „Alle Geräte abmelden“ sperrt alle bisher freigeschalteten Geräte.

Die Verwaltung ist am Tablet über „Verwaltung“ oben rechts erreichbar (Admin-Passwort). Bequemer ist der PC über die Home-Assistant-Seitenleiste.

---

## 8. Akku schonen mit Shelly Plug (optional)

Ein Tablet, das dauerhaft am Strom hängt, bläht mit der Zeit den Akku auf. Besser: zwischen 20 % und 80 % laden.

1. Shelly Plug S Gen3 einrichten (Shelly-App, ins Vereins-WLAN) und in Home Assistant hinzufügen (**Einstellungen → Geräte & Dienste → Shelly** wird meist automatisch gefunden).
2. In Home Assistant die Integration **Fully Kiosk Browser** hinzufügen (IP des Tablets + Remote-Admin-Passwort). Danach gibt es einen Sensor für den Akkustand.
3. Automatisierung (**Einstellungen → Automatisierungen → ⋮ → In YAML bearbeiten**); die Entitätsnamen an eure anpassen:

```yaml
alias: Tablet Vereinsheim laden
triggers:
  - trigger: numeric_state
    entity_id: sensor.tablet_getraenke_batterie
    below: 20
    id: laden
  - trigger: numeric_state
    entity_id: sensor.tablet_getraenke_batterie
    above: 80
    id: aus
actions:
  - choose:
      - conditions: [{ condition: trigger, id: laden }]
        sequence: [{ action: switch.turn_on, target: { entity_id: switch.shelly_tablet } }]
      - conditions: [{ condition: trigger, id: aus }]
        sequence: [{ action: switch.turn_off, target: { entity_id: switch.shelly_tablet } }]
```

---

## 9. Kennzahlen in Home Assistant (optional)

Offener Betrag, heute gebuchte Getränke, knappe Artikel und laufende Veranstaltung als Sensoren – das YAML-Beispiel steht in der **DOCS.md** (Abschnitt „Kennzahlen in Home Assistant“).

---

## 9b. Erweiterungen und Links (optional)

- **Mitgelieferte Erweiterungen** (z. B. Zeiterfassung) schaltet ihr in der Verwaltung unter **Einstellungen → Erweiterungen** ein und aus. Aktive Erweiterungen erscheinen am Tablet oben neben „Verwaltung“ und in der Verwaltung im Menü. Ausschalten blendet sie aus; die Daten bleiben erhalten.
- **Weitere Erweiterungen nachinstallieren:** in der Verwaltung unter Einstellungen → Module & Erweiterungen → **„Erweiterung einspielen (ZIP)“**, danach „Jetzt neu starten“ und aktivieren. Alternativ den Ordner per Samba nach `share/clubwerk/erweiterungen/` kopieren und das Add-on neu starten.
- **Funktionsimport:** Jedes Modul (Beregnung, Zugang, Zeiterfassung) lässt sich einzeln exportieren und importieren – z. B. alle Plätze und Zonen der Beregnung. In der Liste „Module & Erweiterungen“ auf **Export** bzw. **Import** tippen oder auf der Modulseite die Karte „Einstellungen übertragen“ nutzen. PINs, Passwörter und API-Keys sind nie enthalten und müssen danach selbst eingetragen werden. Nur Erweiterungen aus vertrauenswürdiger Quelle installieren – sie laufen mit denselben Rechten wie Clubwerk.
- **Eigene Links** (z. B. Platzbuchung, Vereinsverwaltung, Beregnung): **Einstellungen → Links in der Kopfzeile**. Sie erscheinen am Tablet oben neben „Verwaltung“ und laufen eingebettet unter der Kopfzeile.
- **Beregnung einrichten:** Zuerst die Bewässerungssteuerung in Home Assistant einbinden (Einstellungen → Geräte & Dienste → Integration hinzufügen, z. B. „Hunter Hydrawise“ oder „Rain Bird“). Dann in der Verwaltung unter **Beregnung** die Plätze anlegen, je Platz die Zonen in der richtigen Reihenfolge auswählen (z. B. Vorne, dann Hinten) und die Laufzeit eintragen, **Vereins-PIN** festlegen, speichern. Die Webapp für die Mitglieder: `http://<Adresse von Home Assistant>:5000` (bei uns z. B. `http://homeassistant.local:5000`) – auf dem Handy öffnen und „Zum Home-Bildschirm“. Wichtig nach dem Update auf 2.1: im Add-on **„Neu bauen“**, damit der neue Port 5000 und der Zugriff auf Home Assistant (zum Schalten der Ventile) übernommen werden.
- **Zugang einrichten:** Schlösser/Relais zuerst in Home Assistant einbinden (z. B. Integration „Nuki“ oder „Shelly“). Dann in der Verwaltung unter **Zugang**: Türen anlegen und je Tür Art und Gerät wählen, Zeitprofile prüfen und eins als **Standard** markieren, speichern. Mitglieder unter **Mitglieder-App** freischalten (Bereiche ankreuzen, QR-Code erzeugen). Die Mitglieder-App: `http://<Adresse von Home Assistant>:5001`. Nach dem Update im Add-on **„Neu bauen“** (Ports 5000 und 5001).
- **Postfach (E-Mail-Versand für Bestellung, Rundmail und Zeiterfassung):** in der Verwaltung unter **Einstellungen → Postfach** (Server, Port, Benutzer, Passwort, Absender), danach „Testmail senden“. Ein bisher in der Zeiterfassung eingetragenes Postfach wird beim Update automatisch übernommen.

## 9c. HTTPS für alle Geräte (empfohlen)

Mit HTTPS laufen **Tablet, Verwaltung (Port 3100), Beregnung (5000) und Mitglieder-App (5001)** verschlüsselt – niemand im WLAN kann Passwörter, PINs oder Geräteschlüssel mitlesen. Wer eine Adresse noch mit `http://` aufruft (alte Lesezeichen, Tablet), wird automatisch auf `https://` umgeleitet. Die Home-Assistant-Seitenleiste funktioniert unverändert.

Ein Zertifikat gilt immer für einen **Namen**, nicht für eine IP-Adresse. Empfohlen: **DuckDNS** – kostenlos, ohne offene Ports am Router, ohne Zertifikatswarnung.

**Schritt 1 – DuckDNS-Namen anlegen**
1. Auf duckdns.org anmelden (z. B. mit Google-Konto), einen Namen anlegen, z. B. `mein-verein` → `mein-verein.duckdns.org`.
2. Bei „current ip“ die **interne** IP-Adresse von Home Assistant eintragen (z. B. `192.168.178.20`, siehe Abschnitt 1) und „update ip“. Den **Token** oben auf der Seite notieren.

**Schritt 2 – FRITZ!Box: Namen im Heimnetz erlauben**
Die FRITZ!Box blockiert Namen, die auf interne Adressen zeigen. Unter **Heimnetz → Netzwerk → Netzwerkeinstellungen → DNS-Rebind-Schutz** den Namen `mein-verein.duckdns.org` als Ausnahme eintragen, übernehmen.

**Schritt 3 – Zertifikat holen (Add-on „Let's Encrypt“)**
1. In Home Assistant: **Einstellungen → Add-ons → Add-on-Store → „Let's Encrypt“** installieren.
2. Konfiguration: `domains: mein-verein.duckdns.org`, eigene E-Mail, `challenge: dns`, `dns: provider: dns-duckdns`, `duckdns_token: <Token aus Schritt 1>`. Speichern, starten – im Protokoll steht „Successfully received certificate“. Die Dateien `fullchain.pem` und `privkey.pem` liegen dann im Ordner `ssl`.
3. Das Zertifikat gilt 90 Tage: das Let's-Encrypt-Add-on z. B. monatlich per Automation neu starten lassen, dann erneuert es sich selbst (Clubwerk nach einer Erneuerung einmal neu starten).

*Alternative:* die MyFRITZ!-Adresse der FRITZ!Box geht auch, braucht aber eine dauerhafte Portfreigabe von Port 80 auf Home Assistant und eine echte öffentliche IPv4-Adresse.

**Schritt 4 – HTTPS einschalten**
1. **Einstellungen → Add-ons → Clubwerk → Konfiguration:** „HTTPS für alle Geräte“ einschalten (Dateinamen `fullchain.pem` / `privkey.pem`), speichern, Add-on neu starten. Im Protokoll steht dann „(HTTPS, http:// wird umgeleitet)“.
2. **Tablet:** im Fully Kiosk Browser die Start-URL auf `https://mein-verein.duckdns.org:3100` ändern (ist ein Passwort für die Buchungsseite gesetzt, einmal neu eingeben).
3. **Verwaltung:** künftig `https://mein-verein.duckdns.org:3100/admin.html`.
4. **Mitglieder-App:** unter Mitglieder-App → Adresse der App `https://mein-verein.duckdns.org:5001` eintragen, unter „Sicherheit“ steht „HTTPS an“. Bereits gekoppelte Handys brauchen wegen der neuen Adresse **einmal einen neuen QR-Code** – der Browser speichert den Geräteschlüssel je Adresse. Am besten HTTPS einrichten, bevor viele Mitglieder gekoppelt sind.
5. **Beregnung:** Mitglieder öffnen `https://mein-verein.duckdns.org:5000`.

Fehlt das Zertifikat oder ist es nicht lesbar, laufen alle Ports wie bisher ohne Verschlüsselung weiter (Hinweis im Add-on-Protokoll).

Zusätzlich sinnvoll: Mitglieder- und Gäste-WLAN getrennt vom Netz, in dem Home Assistant und die Technik hängen, und ein WLAN-Passwort, das nicht am Aushang steht.

## 10. Updates einspielen

Es gibt drei Wege – alle behalten die Daten (Datenbank, Belege, Sicherungen liegen im Add-on-Datenordner, nicht im Programmordner).

### Weg A: ZIP hochladen in der Verwaltung (ab 2.16, am einfachsten)
1. Verwaltung **über die Home-Assistant-Seitenleiste** öffnen (aus Sicherheitsgründen geht das Update nur dort, nicht über Port 3100).
2. **Einstellungen → Update → „ZIP-Paket hochladen …“** und das Gesamtpaket wählen (die ZIP-Datei, so wie sie geliefert wird).
3. Clubwerk prüft das Paket und zeigt „alte Version → neue Version“ und was neu ist.
4. Mit dem eigenen Passwort bestätigen → **„Update einspielen“**. Vorher wird automatisch gesichert, der bisherige Programmordner bleibt als Reserve erhalten.
5. Home Assistant baut die neue Version (2–10 Minuten). Die Seite lädt sich danach von selbst neu.

Falls Home Assistant das Bauen nicht von selbst startet, steht das in der Verwaltung – dann **Einstellungen → Add-ons → Clubwerk → Aktualisieren** (bzw. „Neu bauen“) klicken; die neuen Dateien liegen schon bereit.
**Zurück zur vorherigen Version:** Einstellungen → Update → „Zurück auf …“ (die letzten zwei Versionen werden aufgehoben).
Nur Benutzer mit allen Rechten, immer mit Passwort; jedes Update geht zusätzlich an die Sicherheits-E-Mail.

### Weg B: per Samba (wie bisher)
1. Im Samba-Ordner `addons` den alten Ordner `clubwerk` löschen und den Ordner `clubwerk` aus der ZIP hineinkopieren.
2. **Add-on-Store → ⋮ → Nach Updates suchen** → Seite neu laden.
3. Beim Add-on „Clubwerk“ **Aktualisieren** (bzw. „Neu bauen“) klicken.

### Weg C: über ein GitHub-Repository (Updates mit einem Klick)
Liegt Clubwerk in einem (öffentlichen) GitHub-Repository, zeigt Home Assistant neue Versionen von selbst an – mit Änderungsliste und Knopf **„Aktualisieren“**, wie bei offiziellen Add-ons. Siehe Abschnitt 12.

**Wichtig ab Version 1.14:** Mannschaftskonten brauchen eine PIN. Bestehende Mannschaften ohne PIN sind nach dem Update am Tablet gesperrt, bis der Vorstand unter **Mitglieder & Konten → Bearbeiten** eine PIN vergibt.

---

## 11. Sicherung, Notfall & Fehlersuche

**Sicherung**
- Das Add-on ist automatisch in jedem **Home-Assistant-Backup** enthalten (Einstellungen → System → Backups).
- Zusätzlich: nächtliche Sicherung in der App (14 Stück), optional täglich nach Dropbox, und **Komplettsicherung** (Datenbank + Belege) zum Herunterladen.

**Admin-Passwort vergessen**
- Ein Benutzer mit allen Rechten vergibt unter **Benutzer & Rechte** ein neues Passwort.
- Gibt es keinen: Add-on → **Konfiguration** → `notfall_passwort` setzen (mind. 8 Zeichen) → **Speichern** → **Neu starten** → mit Benutzername **admin** und diesem Passwort anmelden. **Danach die Option wieder leeren und neu starten.** Nur Home-Assistant-Administratoren kommen an diese Einstellung.

**Fehlersuche**

| Problem | Lösung |
|---|---|
| Add-on erscheint nicht unter „Lokale Add-ons“ | Ordnerstruktur prüfen (Abschnitt 3): `config.yaml` muss direkt in `addons/clubwerk/` liegen. Danach im Add-on-Store neu laden bzw. Home Assistant neu starten. |
| Installation bricht ab | Protokoll unter Einstellungen → System → Protokolle → Supervisor. Internet/Speicher prüfen, erneut installieren. |
| Tablet zeigt „Seite nicht erreichbar“ | Gleiches WLAN? Richtige IP (Abschnitt 1)? Port 3100 im Add-on-Reiter „Konfiguration → Netzwerk“ eingetragen? Läuft das Add-on (Reiter Info)? |
| Seitenleiste „Clubwerk“ fehlt | Add-on → Info → „In der Seitenleiste anzeigen“ einschalten. |
| Uhrzeit der Buchungen falsch | Zeitzone in Home Assistant prüfen: Einstellungen → System → Allgemein. |
| Positionen werden nicht (alle) erkannt | Foto gerader/heller aufnehmen oder die Rechnung als PDF vom Lieferanten anfordern. Unsichere Zeilen sind gelb markiert und lassen sich direkt korrigieren; fehlende Positionen mit „+ Zeile“ ergänzen – Zuordnungen merkt sich die App je Lieferant. |
| App reagiert nicht | Add-on → Neu starten. Der Watchdog macht das bei Absturz automatisch. Protokoll-Reiter ansehen. |

**Sicherheit im Betrieb**
- Port 3100 nur im Vereins-WLAN nutzen, **niemals** im Router ins Internet freigeben.
- Das Vereins-WLAN mit einem eigenen Passwort schützen (kein offenes Gäste-WLAN im selben Netz).


---

## 12. Installation über ein GitHub-Repository (Updates mit einem Klick)

**Repository anlegen (einmalig, macht der Betreuer):**
1. Bei github.com ein **öffentliches** Repository anlegen, z. B. `clubwerk-ha` (Home Assistant kann Add-ons nur aus öffentlichen Repositories laden; im Programm stehen keine Passwörter oder Vereinsdaten – die liegen nur in Home Assistant).
2. Den **Inhalt** des Ordners `clubwerk-ha` aus der ZIP hochladen (also `repository.yaml`, den Ordner `clubwerk` usw.).
3. In `repository.yaml` bei `url:` die Adresse des Repositorys eintragen.
4. Für jede neue Version: den Ordner `clubwerk` im Repository ersetzen (die Versionsnummer steht in `clubwerk/config.yaml`, die Änderungen in `clubwerk/CHANGELOG.md`).

**In Home Assistant hinzufügen:** Einstellungen → Add-ons → **Add-on-Store → ⋮ → Repositories** → Adresse des Repositorys eintragen → Hinzufügen. Danach erscheint „Clubwerk“ im Store und lässt sich installieren. Neue Versionen zeigt Home Assistant unter Einstellungen → Add-ons bzw. bei den Updates an.

**Umzug vom lokalen Add-on (Samba) zum GitHub-Add-on:** Für Home Assistant sind das zwei verschiedene Add-ons mit getrennten Datenordnern – die Daten ziehen deshalb über die Komplettsicherung um:
1. Im **bisherigen** Add-on: Datensicherung → Sicherungspasswort festlegen (falls noch nicht geschehen) → **„Jetzt sichern“** → **„Letzte Komplettsicherung herunterladen“**. Die Datei (`.cwbackup`) gut aufheben.
2. Das bisherige Add-on **stoppen** (die Ports 3100/5000/5001 werden frei).
3. Das GitHub-Add-on installieren, die Add-on-Konfiguration übernehmen (z. B. HTTPS, Zertifikat, Notfall-Passwort – sie wird nicht mit umgezogen) und starten.
4. Über die Seitenleiste öffnen, mit einem beliebigen Passwort einrichten, dann **Datensicherung → Wiederherstellen → „Komplettsicherung hochladen …“**, Sicherungspasswort eingeben, Add-on neu starten. Danach gelten wieder alle bisherigen Benutzer, Mitglieder, Handys der Mitglieder-App, Buchungen und Belege.
5. Alles prüfen – dann das alte Add-on deinstallieren und den Ordner `addons/clubwerk` löschen.
6. Wer die Kennzahlen in Home Assistant nutzt (Abschnitt 9): in `configuration.yaml` statt `local-clubwerk` den neuen Namen des Add-ons eintragen (steht auf der Info-Seite des Add-ons unter „Hostname“) oder einfach die IP-Adresse von Home Assistant.

## Umstieg von „Vereinsheim“ (bis 2.16) auf Clubwerk (ab 3.0)

Clubwerk ist ein neues Add-on (eigener Name in Home Assistant). Die Daten kommen über die Komplettsicherung mit:

1. Im alten Add-on „Vereinsheim“: **Datensicherung → Jetzt sichern**, dann **Letzte Komplettsicherung herunterladen** (Datei `…_Vereinsheim.vhsicherung`). Das Sicherungspasswort bereithalten (Notfallblatt).
2. Das alte Add-on **stoppen** (noch nicht deinstallieren) und bei ihm „Beim Start ausführen“ ausschalten – beide nutzen dieselben Ports.
3. Den Ordner `clubwerk` aus der ZIP zusätzlich nach `addons` kopieren (der Ordner `vereinsheim` bleibt vorerst liegen), im Add-on-Store **⋮ → Nach Updates suchen**, unter „Lokale Add-ons“ **Clubwerk → Installieren → Starten**.
4. Clubwerk öffnen, mit einem vorläufigen Passwort einrichten, dann **Datensicherung → Komplettsicherung hochladen …** und die Datei aus Schritt 1 wählen, Sicherungspasswort eingeben, **neu starten**.
5. Danach ist alles wieder da (Mitglieder, Artikel, Buchungen, Benutzer, Einstellungen, Belege, Erweiterungen); angemeldet wird mit den bisherigen Benutzern und Passwörtern.
6. Tablet und Handys: Adresse und Ports bleiben gleich. Wer die Kennzahlen in Home Assistant nutzt, ändert in `configuration.yaml` `local-vereinsheim` in `local-clubwerk`.
7. Läuft alles, das alte Add-on deinstallieren und den Ordner `addons/vereinsheim` löschen. Erweiterungen im Ordner `share/vereinsheim/erweiterungen` nach `share/clubwerk/erweiterungen` verschieben.
