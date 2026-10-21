# Erweiterte Testreihen

Rund 50 Testreihen über alle Module, zusätzlich zu den Kerntests in `tests/`. Jede Reihe startet einen eigenen Server mit erfundenen Daten in einem temporären Ordner. Die Reihen prüfen über HTTP, mit Ausgaben `✔`/`✘`.

```bash
bash werkzeuge/tests/run.sh             # alle (ca. 30 Minuten)
bash werkzeuge/tests/run.sh bk mv ber   # nur diese
```

- **Bekannte Fehlschläge** stehen in `erwartet.txt`, meist veraltete Erwartungen. Neue Fehlschläge lassen den Lauf scheitern. Behobene meldet der Lauf als „behoben“.
- **Liste aktualisieren**, nur bewusst und nach einer Korrektur: `CW_ERWARTET_SPEICHERN=1 bash werkzeuge/tests/run.sh`
- **Hilfsserver** startet der Lauf selbst:
  - Test-Mailserver auf Port 2525 (`hilfen/smtp`)
  - Nachbildungen von Home Assistant und Hydrawise (`hilfen/ha_mock.js`, `hilfen/hw_mock.js`)
  - Dropbox (`hilfen/fake_dropbox*.js`)
  - FTP/FTPS/WebDAV/SFTP (`fixtures/srv/servers.py`; braucht `pip install wsgidav cheroot pyftpdlib asyncssh`)
- **Testdaten** in `fixtures/` sind erfunden:
  - Namensliste
  - SEPA-Schema
  - Beispiel-PDFs und -CSV-Dateien
  - Testzertifikate
  - Erweiterungen mit absichtlichen Sicherheitslücken für die Angriffstests
  - Programmstand 2.16.3 für den Umzugstest
