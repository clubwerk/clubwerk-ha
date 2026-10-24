# Kassengesetz (KassenSichV / TSE) – Prüfung des Verkaufs (Stand 3.39.0)

Keine Rechtsberatung. Ergebnis einer Prüfung des Codes gegen die bekannten Anforderungen (§ 146a AO, KassenSichV, GoBD). Vor einem Verkauf von Clubwerk mit Steuerberater klären.

## Ist der Verkauf eine „Kasse“ im Sinne des Gesetzes?
Pflichtig sind elektronische Aufzeichnungssysteme **mit Kassenfunktion**, also solche, die zumindest teilweise **bare** Zahlungen erfassen. Karte am Ort zählt dazu. Eine Ausnahme für Vereine oder kleine Umsätze gibt es nicht. Getränkeverkauf ist meist wirtschaftlicher Geschäftsbetrieb.

Clubwerk erfasst heute bare Zahlungen:
- Gäste-Deckel „bar“ oder „Karte“ (`/api/tablet/tab/pay`, Verwaltung `tabs/:id/pay`)
- Veranstaltungsliste: Gäste zahlen bar oder mit Karte (`events/:id/guests/:gid/pay`, `event_payments`)

Nicht bar ist das **Anschreiben** auf Mitgliederkonten mit späterem Einzug (Lastschrift/Überweisung). Ob ein System nur mit Anschreiben als „ohne Kassenfunktion“ gilt, muss der Steuerberater bestätigen.

→ **Mit den Bar- und Kartenfunktionen ist der Verkauf sehr wahrscheinlich TSE-pflichtig.**

## Was heute fehlt (Befunde)
1. **Keine TSE.** Vorgänge werden nicht von einer zertifizierten Sicherheitseinrichtung signiert.
2. **Kein Beleg.** Es gibt keinen Bon (Papier oder digital) mit Pflichtangaben und TSE-Daten (Belegausgabepflicht; Befreiung nur auf Antrag).
3. **Kein DSFinV-K-Export.** Das ist das Pflichtformat für die Kassen-Nachschau bzw. Betriebsprüfung. Die Excel-Abrechnung ersetzt es nicht.
4. **Kein Kassenabschluss** (Tagesabschluss/Z-Bon) und kein Kassenbuch bzw. keine Kassensturzfähigkeit für das Bargeld.
5. **Buchungen werden nachträglich verändert statt durch Gegenbuchungen korrigiert:**
   - Deckel abschreiben setzt `total_cents = 0`, der Betrag steht danach nur noch im Protokoll (`server.js` `closeTab`).
   - Deckel übernehmen ändert `kind` und `member_id` der Buchungen.
   - Leere Deckel und unbenutzte Veranstaltungen werden samt stornierten Buchungen gelöscht.
   - Positiv: Stornos setzen `cancelled_at` statt zu löschen.
6. **Keine Unveränderbarkeit:** Die SQLite-Datei und eine Wiederherstellung aus der Sicherung können Daten ändern, ohne dass es auffällt. Es gibt keine Prüfkette.
7. **Meldepflicht** (seit 2025 über ELSTER): Clubwerk liefert dafür keine Angaben (Seriennummer der TSE, Art der Kasse, Anschaffung).

## Wege
- **A – Ohne Kassenfunktion:** Bar- und Kartenzahlung im Verkauf abschaltbar machen (Einstellung „nur Anschreiben“). Bargeld läuft dann außerhalb von Clubwerk über eine offene Ladenkasse mit Kassenbericht. Wenig Aufwand. Vom Steuerberater bestätigen lassen.
- **B – Echte TSE-Kasse:** große Aufgabe:
  - TSE-Anbindung: Hardware-TSE (USB/microSD, läuft lokal) oder Cloud-TSE (braucht Internet, widerspricht „komplett lokal“)
  - jede Transaktion signieren, Belege mit QR-Code
  - Stornos nur als Gegenbuchung, Kassenabschluss
  - DSFinV-K-Export, Angaben für die Meldepflicht
  - Wechsel auf ein reines Anhängen ohne Änderungen für Kassendaten
  - am Ende ggf. eine Prüfung durch Dritte
- Für den eigenen Verein und für einen Verkauf als Produkt empfiehlt sich zunächst **A**, und B nur, wenn Vereine Bargeld unbedingt in Clubwerk wollen.
