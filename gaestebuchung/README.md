# Buchungsseite für Gäste (Cloudflare Worker)

Kleine eigene Webseite, auf der **Nichtmitglieder** Plätze buchen und mit **PayPal oder Debit-/Kreditkarte** bezahlen. Sie gehört zum
Clubwerk-Modul „Plätze“ (Reiter **Gäste**), läuft aber **außerhalb** des Vereinsnetzes bei Cloudflare – Clubwerk selbst bleibt von außen
unerreichbar. Clubwerk ruft die Seite etwa jede Minute selbst auf (ausgehend, signiert), schickt die freien Zeiten und holt neue Buchungen
und Stornos ab. Jede Zahlung prüft Clubwerk danach **selbst bei PayPal**, erst dann steht die Buchung im Platzplan und der Gast bekommt die
Bestätigung mit dem Platzcode per E-Mail (über das Postfach des Vereins).

Die Seite kennt **keine Mitgliederdaten** – nur freie Zeiten, Preise und die Gastbuchungen (Name, E-Mail, Handy; nach 30 Tagen gelöscht).

| Datei | Inhalt |
|---|---|
| `src/index.js` | Worker: Seiten, Reservieren, PayPal (Orders v2, Capture serverseitig), Storno/Erstattung, Abgleich, Webhooks |
| `src/paypal.js` | PayPal-REST und eigene Prüfung der Webhook-Signatur (CRC32 + SHA256withRSA) |
| `src/signatur.js` | HMAC-Signatur der Anfragen zwischen Clubwerk und Seite (auch in Clubwerk nachgebaut) |
| `src/seiten.js`, `public/` | HTML, Gestaltung, Skript der Seite, `hoehe.js` für die Homepage |
| `migrations/` | Datenbank (D1) |
| `SCHNITTSTELLE.md` | Schnittstelle Version 1 (Abgleich, Status, Signatur) |
| `test/` | Tests mit nachgebauter PayPal-Schnittstelle (`npm test`), D1-Nachbildung für Node |
| `lokal.js` | Seite lokal ohne Cloudflare starten (Tests, Ausprobieren) |

## Einrichtung (zuerst nur PayPal-Sandbox)

Gebraucht werden: ein kostenloses Cloudflare-Konto, ein PayPal-Geschäftskonto (für die Sandbox reicht der Entwicklerzugang), Node.js 22
auf einem PC (oder WSL). Alle Befehle im Ordner `gaestebuchung/`. Die Schritte mit Bildern stehen in der Anleitung des Moduls „Plätze“
(Kapitel „Gästebuchung mit PayPal“).

1. **PayPal-Sandbox:** <https://developer.paypal.com> → *Apps & Credentials* → oben **Sandbox** →
   - App **„Buchungsseite“** anlegen (Typ *Merchant*) → *Client ID* und *Secret* notieren.
   - App **„Clubwerk Prüfung“** anlegen (gleiches Sandbox-Geschäftskonto) und unter *Features* **Transaction Search** einschalten →
     *Client ID* und *Secret* gehören **nur** in Clubwerk (Plätze › Gäste › Einrichten), nie in den Worker.
2. **Cloudflare anmelden:** `npx wrangler login`
3. **Datenbank anlegen:** `npx wrangler d1 create gaestebuchung` → die ausgegebene `database_id` in `wrangler.toml` eintragen, dann
   `npx wrangler d1 migrations apply gaestebuchung --remote`
4. **Client-ID** der App „Buchungsseite“ in `wrangler.toml` bei `PAYPAL_CLIENT_ID` eintragen (öffentlich, kein Geheimnis).
5. **Geheimnisse nur per Befehl** (nie in Dateien, nie in Git):
   - `npx wrangler secret put PAYPAL_CLIENT_SECRET` → Secret der App „Buchungsseite“
   - `npx wrangler secret put CLUBWERK_SCHLUESSEL` → gemeinsamer Schlüssel aus Clubwerk (Plätze › Gäste › Einrichten › „Schlüssel erzeugen“)
6. **Turnstile (Schutz gegen Massen-Reservierungen):** im Cloudflare-Dashboard › **Turnstile** › *Add widget*: Name „Buchungsseite“,
   Hostnamen der Buchungsseite (z. B. `gaestebuchung.<name>.workers.dev` und `buchen.dein-verein.de`), Modus *Managed*. Den **Site Key**
   in `wrangler.toml` bei `TURNSTILE_SITE_KEY` eintragen, den **Secret Key** nur per `npx wrangler secret put TURNSTILE_SECRET`.
   Ohne beide nimmt die Seite keine Reservierungen an.
7. **Hochladen:** `npx wrangler deploy` → Adresse `https://gaestebuchung.<name>.workers.dev` (eigene Adresse wie `buchen.dein-verein.de`
   geht unter *Workers › gaestebuchung › Settings › Domains & Routes*).
8. **Webhook bei PayPal:** in der App „Buchungsseite“ unter *Webhooks* → URL `https://<adresse>/api/v1/webhook`, Ereignisse
   *Checkout order approved*, *Payment capture completed / denied / pending / refunded / reversed* → **Webhook ID** in `wrangler.toml` bei
   `PAYPAL_WEBHOOK_ID` eintragen und noch einmal `npx wrangler deploy`.
9. **Clubwerk:** Plätze › Gäste › Einrichten → Adresse der Buchungsseite, Schlüssel, PayPal-App „Clubwerk Prüfung“, Homepage-Adresse.
   „Jetzt abgleichen“ muss „verbunden“ zeigen. Danach je Platz „für Gäste buchbar“ einschalten.
10. **Ausprobieren:** Sandbox-Käufer unter *Testing Tools › Sandbox Accounts* (Typ *Personal*), Testkarten unter *Testing Tools › Card Testing*.

### Sandbox → Live (erst nach Rücksprache mit dem Vorstand)

1. In <https://developer.paypal.com> oben auf **Live** stellen, dort beide Apps neu anlegen (Live-Konto des Vereins).
2. `wrangler.toml`: `PAYPAL_ENV = "live"`, neue `PAYPAL_CLIENT_ID` und `PAYPAL_WEBHOOK_ID`; `npx wrangler secret put PAYPAL_CLIENT_SECRET` mit dem Live-Secret; `npx wrangler deploy`.
3. In Clubwerk Umgebung **Live** wählen und die Live-App „Clubwerk Prüfung“ eintragen. Clubwerk vergleicht bei jedem Abgleich die
   Umgebung der Seite mit der eigenen und hält an, wenn sie nicht passt.

## Auf der Homepage einbinden

Als Link (`https://<adresse>/`) oder als Rahmen. Einbetten erlaubt die Seite **nur** auf der in Clubwerk eingetragenen Homepage
(`frame-ancestors`); am Handy öffnet „Weiter zur Buchung“ die Seite groß und leitet zu PayPal weiter (kein Popup).

```html
<iframe src="https://buchen.dein-verein.de/" title="Platz buchen" allow="payment" style="width:100%;border:0;min-height:600px"></iframe>
<script src="https://buchen.dein-verein.de/hoehe.js" async></script>
```

## Sicherheit

- Clubwerk ↔ Seite: HMAC-SHA256 über Methode, Pfad, Zeit, Nonce und Body; ±5 Minuten, jede Nonce nur einmal; die Antwort ist an die
  Nonce gebunden und ebenfalls signiert (`SCHNITTSTELLE.md`).
- PayPal: Order mit `custom_id` = `invoice_id` = Buchungsnummer, Capture nur serverseitig mit `PayPal-Request-Id`, nur `COMPLETED` gilt als
  bezahlt; Betrag, Währung und Buchungsnummer der Zahlung werden geprüft. Webhooks: Signatur selbst geprüft (Zertifikat nur von
  `api(-m).(sandbox.)paypal.com`), danach wird der Stand trotzdem bei PayPal nachgelesen.
- Zwei getrennte PayPal-Apps: Die Seite darf abbuchen und erstatten; Clubwerk benutzt seine App **nur lesend** (Zahlung nachsehen,
  Transaction Search). PayPal kennt keine reinen Lese-Schlüssel – deshalb liegt Clubwerks Secret im Tresor.
- Ohne Abgleich seit 10 Minuten nimmt die Seite keine Buchungen an (freie Zeiten wären veraltet).
- Reservieren nur mit gültigem **Cloudflare-Turnstile**-Token (serverseitig über `siteverify` geprüft, Aktion `reservieren`, jedes Token
  einmal); fehlt es, ist es ungültig oder Turnstile nicht erreichbar, lehnt die Seite ab. Dazu die Bremse je Adresse.
- Storno-Link: HMAC aus dem gemeinsamen Schlüssel und der Buchungsnummer (wird nicht gespeichert). Ein neuer Schlüssel macht alte Links
  ungültig – Stornos gehen dann über den Verein.

## Entwickeln und testen

```bash
npm test                         # Tests gegen die nachgebaute PayPal-Schnittstelle (Node 22, ohne weitere Pakete)
node --no-warnings lokal.js      # lokal auf http://127.0.0.1:8787 (D1 als SQLite-Datei)
npx wrangler dev                 # in der Cloudflare-Laufzeit (workerd), Datenbank lokal
```

Die Ende-zu-Ende-Tests mit Clubwerk laufen in `werkzeuge/tests/gast_test.js` (Clubwerk + diese Seite lokal + nachgebaute PayPal-Sandbox).
