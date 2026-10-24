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

## Offene Fragen an Thorsten
1. Dürfen auch Konten „Kein Mitglied“ (Trainer) melden?
2. Wer bekommt neue Meldungen: festes Postfach, bestimmte Verwaltungsnutzer, beides?
3. Sehen Mitglieder die offenen Meldungen anderer (ohne Namen)?
4. Ortsliste: frei pflegbar, oder aus den Plätzen des Buchungssystems vorbelegen (falls aktiv)?
5. Auch am Tablet melden (z. B. am Clubhaus), oder nur in der App?
6. Aufbewahrung der Fotos nach „Erledigt“: 6 Monate in Ordnung?
