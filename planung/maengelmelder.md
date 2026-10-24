# Mängelmelder – Vorschlag (noch nicht gebaut)

Mitglieder melden in der Mitglieder-App defekte Dinge oder Probleme auf der Vereinsanlage, mit Foto und kurzer Beschreibung. Der Vorstand bzw. die Platzwarte sehen die Meldungen in der Verwaltung und arbeiten sie ab.

## Mitglieder-App (Bereich „Mängel“, über `GK.registerAppSection`)
- **Melden:** bis zu 3 Fotos (Kamera oder Galerie), Ort aus einer Liste (z. B. „Platz 3“, „Clubhaus Damen-WC“), Beschreibung (max. 500 Zeichen), Haken „dringend“ (z. B. Wasserrohrbruch, Verletzungsgefahr).
- Fotos werden schon auf dem Handy verkleinert (ca. 1600 px, JPEG). Ortsdaten (EXIF/GPS) werden entfernt.
- **Meine Meldungen:** Status (Neu · In Arbeit · Erledigt · Abgelehnt/Doppelt) mit kurzer Antwort des Vereins.
- Push an den Melder, sobald sich der Status ändert.
- Optional: **„Schon gemeldet“** – offene Meldungen zum gleichen Ort sehen, damit nichts doppelt kommt. Melder bleiben dabei für andere Mitglieder unsichtbar.

## Verwaltung (Reiter oben)
- **Offen / Erledigt / Einstellungen**
- Liste mit Vorschaubild, Ort, Datum, Melder („Nachname, Vorname“), Dringend-Markierung.
- Detail: Fotos groß, Status setzen, Antwort an den Melder, interne Notiz, Zuständigen zuweisen.
- Einstellungen: Ortsliste pflegen, wer bei neuen Meldungen benachrichtigt wird (Push/Mail), Aufbewahrung der Fotos.
- Eigenes Recht „Mängel“, damit z. B. ein Platzwart nur dieses Modul sieht.
- Protokoll über `ctx.auditDiff`.

## Technik
- Modul `erweiterungen/maengel/` mit `erweiterung.json`, `server.js`, `public/admin.js`, `public/member.js`.
- Tabellen `mg_report`, `mg_photo`, `mg_place`. Fotos in `/data` (mit Sicherung), nicht in der Datenbank.
- Erledigte Meldungen: Fotos werden nach einstellbarer Zeit (Vorschlag 6 Monate) automatisch gelöscht, der Text bleibt.
- Schutz: Größenlimit je Foto, höchstens z. B. 10 Meldungen pro Mitglied und Tag. Bildprüfung auf echte JPEG/PNG-Signatur.
- Einzeln nutzbar. Wenn **Helferdienste** aktiv ist: Knopf „Als Aufgabe für Arbeitseinsatz übernehmen“ (über `ctx.callHooks`). Das kommt erst in Stufe 2.

## Entscheidungen (von Thorsten beantwortet)
1. **Wer meldet:** jeder, der die Mitglieder-App nutzen kann, also auch Konten „Kein Mitglied“ (Trainer).
2. **Wer bekommt Meldungen:** neues Recht „Mängel“ für Verwaltungsnutzer. Wer es hat, sieht das Modul in der Verwaltung und bekommt neue Meldungen (Push/Mail).
3. **Doppelte Meldungen:** Mitglieder sehen fremde Meldungen nicht. Vor dem Absenden prüft Clubwerk, ob es zum gleichen Ort schon eine offene Meldung gibt. Dann zeigt die App sie an (Beschreibung, Datum, erstes Foto, ohne Namen) und fragt: „Ist es das?“. Das Mitglied kann abbrechen oder trotzdem einreichen. Vorschlag: „Ja, das ist es“ zählt als „auch gemeldet“ (+1), und das Mitglied bekommt die Statusmeldungen dieser Meldung. Noch abzustimmen.
4. **Orte:** alle Plätze aus dem Buchungssystem (wenn aktiv), dazu Orte, die in der Verwaltung angelegt werden, dazu „Anderer Ort“ als Freitext des Mitglieds.
5. **Tablet:** ja, Melden auch am Tablet nach Entsperren mit der Mitglieder-PIN (Foto mit der Tablet-Kamera).
6. **Aufbewahrung:** Fotos erledigter Meldungen werden nach 12 Monaten gelöscht. Die Frist ist in den Einstellungen änderbar.
