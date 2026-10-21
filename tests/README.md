# Tests

Automatische Tests für Clubwerk. Sie laufen bei jedem Push über GitHub Actions (`.github/workflows/tests.yml`) und lassen sich lokal so starten:

```bash
cd clubwerk && npm ci && cd ..
bash tests/run.sh            # alle
bash tests/run.sh attack enc # einzelne
```

Jeder Test startet einen eigenen Server mit leeren Testdaten in einem temporären Ordner. Es werden keine echten Daten, Passwörter oder Schlüssel verwendet.

| Test | prüft |
|---|---|
| attack | Übernahme bei der Einrichtung, Erraten von PINs/Passwörtern, Rechte, ungeprüfte Erweiterungen, Modul-Sicherungen, fremde Adressen (DNS-Rebinding), Sicherheits-Header |
| cw | Vereinsnetz, öffentliche Absender, Tunnel-Quelle (exklusiv), Mitglieder-App direkt aus dem Internet, Tablet-Passwort |
| enc | Tresor: verschlüsselt auf der Platte, Neustart → gesperrt, Anmeldung/Code öffnet, Ausschalten |
| vjob | Tresor: Abbruch beim Ein-/Ausschalten, beschädigte Datei, Wiederaufnahme beim Start – kein Datenverlust |
| vscope | Tresor: Klartext-Suche über die Datenbankdatei für alle vertraulichen Felder, Nachverschlüsseln neuer Felder |
| glink | Gastlinks: Verfall nach 12 Monaten / ohne Mannschaft, neuer Link beim Teilen |
| upd | Update-Paket: Inhalts-Prüfsumme unabhängig vom Packen |
| tarx | Sicherung zurückspielen: präparierte Archive werden abgelehnt |
| pin, ext | eine PIN für Tablet und App, Gastspieler/innen |
| harden | Rollen der Verwaltung, Header, Uploads, Excel-Formeln, Login-Bremse |
