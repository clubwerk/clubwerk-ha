# Schnittstelle Clubwerk ↔ Buchungsseite, Version 1

Clubwerk (Modul „Plätze“, `clubwerk/erweiterungen/buchung/lib/gaeste.js`) und die Buchungsseite (`src/index.js`) sprechen nur über
**eine** Adresse: `POST https://<buchungsseite>/api/v1/sync`. Die Verbindung geht **immer von Clubwerk aus** (etwa jede Minute);
die Buchungsseite kennt die Adresse von Clubwerk nicht und erreicht es nie. Ändert sich die Schnittstelle unverträglich, steigt `v`;
die Buchungsseite antwortet auf eine fremde Version mit 409 und Clubwerk zeigt „Schnittstelle passt nicht“.

## Signatur (beide Richtungen)

Gemeinsamer Schlüssel: 32 Zufallsbytes, base64url (43 Zeichen). Clubwerk erzeugt ihn, er liegt dort im Tresor (`ctx.geheim`) und im
Worker als Secret `CLUBWERK_SCHLUESSEL`.

Anfrage (Kopfzeilen von Clubwerk):

| Kopf | Inhalt |
|---|---|
| `X-Clubwerk-Zeit` | Unix-Sekunden (echte Uhr) – höchstens 300 s Abweichung |
| `X-Clubwerk-Nonce` | 16 Zufallsbytes hex – jede nur einmal (Buchungsseite merkt sie 15 Minuten) |
| `X-Clubwerk-Signatur` | hex HMAC-SHA256 über `cw-gb-v1\nPOST\n/api/v1/sync\n<Zeit>\n<Nonce>\n<hex SHA-256 des Bodys>` |

Antwort (Kopfzeilen der Buchungsseite): `X-Clubwerk-Zeit` und `X-Clubwerk-Signatur` = hex HMAC-SHA256 über
`cw-gb-v1-antwort\n<Nonce der Anfrage>\n<Zeit>\n<hex SHA-256 des Bodys>`. Clubwerk verwirft jede Antwort ohne gültige Signatur
(auch 4xx/5xx ohne Signatur gelten nur als „keine Verbindung“). Vergleiche immer in konstanter Zeit.

## Anfrage (Clubwerk → Buchungsseite)

```json
{
  "v": 1,
  "anzeige": { "verein": "TC Grün-Weiß Musterstadt", "farbe": "#1f6f43", "homepage": "https://www.dein-verein.de",
               "impressum": "https://…", "datenschutz": "https://…", "hinweis": "freier Text", "logo": "data:image/png;base64,…" },
  "regeln":  { "aktiv": true, "storno_stunden": 24, "halten_min": 10 },
  "plaetze": [{ "id": 3, "name": "Platz 1", "minuten": 60, "preis": 1500 }],
  "frei":    [{ "platz": 3, "datum": "2026-11-25", "zeiten": [["18:00", "19:00", 1795543200000]] }],
  "quittungen": [{ "ref": "G-7K3M-Q2XD", "version": 4, "stand": "eingetragen" }],
  "stornos":    [{ "ref": "G-7K3M-Q2XD", "grund": "Platzsperre" }]
}
```

- `anzeige`: Name, Farbe, Homepage (Leerzeichen-getrennt, nur `https`-Ursprünge – daraus wird `frame-ancestors`), Links, Hinweistext.
  `logo` nur, wenn sich der Hash gegenüber `logo_hash` der letzten Antwort geändert hat; `null` entfernt es.
- `plaetze[].preis`: Cent **je Buchung** (Preis je Stunde × Dauer, rechnet Clubwerk). `minuten`: Dauer einer Gastbuchung.
- `frei`: alle freien Zeiten im Vorlauf; jede Zeit `[Beginn, Ende, Beginn in ms seit 1970]` (Ortszeit des Vereins, `ab` rechnet Clubwerk).
  Ersetzt die bisherige Liste vollständig. Sind `plaetze` und `frei` nicht dabei, bleiben die alten.
- `quittungen`: Clubwerk bestätigt den Stand `version` einer Buchung. `stand`: `vorlaeufig` (Platz gehalten), `eingetragen` (im Platzplan,
  Mail mit Code verschickt), `belegt` (Zeit in Clubwerk schon vergeben → reserviert: nicht abbuchen; bezahlt: erstatten),
  `abweichung` (Prüfung bei PayPal passt nicht – der Verein klärt das), `storniert` (ausgetragen), `erledigt` (abgelaufen/abgelehnt).
- `stornos`: der Verein storniert (Verwaltung, Sperre, Turnier) → Buchungsseite erstattet bei PayPal (Gast-Fristen gelten nicht).

## Antwort (Buchungsseite → Clubwerk)

```json
{
  "v": 1, "jetzt": 1795450000000, "paypal": "sandbox", "logo_hash": "…",
  "buchungen": [{ "ref": "G-7K3M-Q2XD", "version": 4, "status": "bezahlt", "platz": 3, "datum": "2026-11-25", "beginn": "18:00", "ende": "19:00",
                  "betrag": 1500, "waehrung": "EUR", "vorname": "Gerda", "nachname": "Gast", "email": "gerda@example.com", "telefon": "0170 …",
                  "order_id": "…", "capture_id": "…", "refund_id": null, "erstellt": 0, "bezahlt_am": 0, "storno_am": null,
                  "halten_bis": 0, "grund": null, "fehler": null, "link": "https://<buchungsseite>/buchung/G-7K3M-Q2XD?t=…" }]
}
```

Gemeldet werden alle Buchungen, deren `version` über der zuletzt quittierten liegt (höchstens 200 je Abgleich). `link` (Bestätigung und
Storno für den Gast) nur bei bezahlten bzw. vorläufigen Buchungen; Clubwerk setzt ihn in die Bestätigungsmail und speichert ihn nicht.

### Status einer Buchung

| Status | Bedeutung | Clubwerk |
|---|---|---|
| `reserviert` | Gast ist bei PayPal, Zeit gehalten bis `halten_bis` | Platzhalter „Gastbuchung (Zahlung läuft)“ im Platzplan, kein Code |
| `vorlaeufig` | Zahlung `PENDING` bei PayPal | prüft selbst bei PayPal (`PENDING`), Platz gehalten, kein Code |
| `bezahlt` | Zahlung `COMPLETED` | prüft selbst bei PayPal (Betrag, Währung, `custom_id`, Status), dann Eintrag, Platzcode, Mail, Buchhaltung |
| `abgelehnt`, `abgelaufen` | nichts abgebucht | Platzhalter weg |
| `storno_angefragt`, `erstattung_laeuft` | Erstattung veranlasst | bleibt eingetragen |
| `erstattet` | Erstattung `COMPLETED` | prüft selbst (`REFUNDED`), dann austragen, Code ungültig, Storno-Mail, Buchhaltung |
| `erstattung_fehler` | Erstattung abgelehnt, Teilerstattung, Rückbuchung oder Betrag passt nicht | Abweichung in der Verwaltung |

## Weitere Adressen der Buchungsseite (für Gäste)

| Adresse | Zweck |
|---|---|
| `GET /` | Buchungsseite (Tage, Zeiten, Angaben, Bezahlen) |
| `GET /api/v1/angebot` | freie Zeiten mit Preis (für die Seite) |
| `POST /api/v1/reservieren` | Zeit halten und PayPal-Order anlegen (`intent=CAPTURE`, `custom_id` = `invoice_id` = Buchungsnummer, `PayPal-Request-Id`); nur mit gültigem Turnstile-Token im Feld `turnstile` (serverseitig geprüft) |
| `POST /api/v1/bezahlen` | Capture serverseitig nach Freigabe (Knöpfe am Rechner) |
| `GET /zurueck/<ref>`, `GET /abbruch/<ref>` | Rückkehr von PayPal (Weiterleitung am Handy) |
| `GET /buchung/<ref>?t=…`, `POST /buchung/<ref>/storno` | Stand der Buchung, Storno bis zur Frist |
| `POST /api/v1/webhook` | Webhooks von PayPal (Signatur selbst geprüft; nur Anstoß, der Stand wird bei PayPal nachgelesen) |
| `GET /hoehe.js` | Skript für die Homepage: Höhe des iframes |
| `GET /api/v1/status` | `{ schnittstelle, offline, zu, paypal }` (ohne Anmeldung, nichts Persönliches) |
