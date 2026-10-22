# Änderungen

## 3.35.0

**Kalender in E-Mails: Knopf statt Anhang**
- Buchungs-Mails („Für dich gebucht“, Mitspieler, Änderungen) und Mails zur Aufstellung im Spielbetrieb haben jetzt den Knopf **„Zu deinem Kalender hinzufügen“**. Am iPhone öffnet er kurz den Browser und bietet „Hinzufügen“ an. Der Termin hängt nicht mehr als Datei an.
- Der Knopf zeigt auf die Adresse der Mitglieder-App (Verwaltung › Mitglieder-App: externe Adresse, sonst die Adresse im Vereins-WLAN). Ist dort keine https-Adresse eingetragen, fehlt der Knopf.

**Vereinslogo in E-Mails**
- Das Logo behält in der Mail sein Seitenverhältnis und wird nicht mehr in ein Quadrat gedrückt.
- Lässt sich ein Logo im Browser nicht zeichnen, erzeugt die Verwaltung kein leeres, unsichtbares Bild mehr dafür. Die Mail zeigt dann die Anfangsbuchstaben des Vereins.

**Spielbetrieb: Damen 40 und Herren 40 sind zwei Mannschaften**
- Spielen die Damen 40 an den Terminen der H40 (Altersklasse laut Rahmenterminplan „H40“), hielt Clubwerk sie für dieselbe Mannschaft wie die Herren 40. Beim Speichern kam dann „gibt es schon“. Jetzt zählt für „doppelt“ der Name („Damen 40“, „Herren 40 II“). Die Altersklasse sagt nur noch, an welchen Terminen gespielt wird.
- Ebenso beim Übernehmen eines Spielplans: Spiele der „H40“ landen nicht mehr bei den Damen 40.

**Handy: Doppeltippen zoomt nicht mehr**
- Wer schnell zweimal auf einen Artikel oder Knopf tippt, vergrößert die Seite nicht mehr, etwa in Chrome am iPhone. Das gilt für Tablet, Mitglieder-App und Verwaltung. Mit zwei Fingern lässt sich weiter zoomen.

## 3.34.0

**Schneller – geprüft mit einem großen Musterverein** (500 Mitglieder, 40 Mannschaften, rund 6 800 Platzbuchungen und 21 000 Getränkebuchungen, gemessen wie auf einem älteren Tablet)
- **Verwaltung › Verkauf › Buchungen:** 4,3 s → 0,7 s. **Veranstaltungen:** 2,2 s → 0,9 s. **Abrechnung:** 1,1 s → 0,5 s. Lange Listen zeigen zuerst 150 Einträge, „Weitere anzeigen“ holt den Rest. Summen rechnen wie bisher über alles. Außerdem werden Beträge und Datumsangaben in allen Listen schneller dargestellt.
- **Weniger Arbeit für den Server:** Über alle Seiten braucht Clubwerk jetzt gut ein Viertel der bisherigen Datenbankabfragen (190 000 → 55 000). Bisher wurde vieles für jeden Eintrag einzeln nachgeschlagen, etwa Name, Foto oder Einstellungen. Am meisten bringt das:
  - Buchungsprotokoll: 25 000 → 60 Abfragen
  - Tablet › Plätze: 14 000 → 120
  - Mitglieder-App › Buchen: 9 400 → 130
  - Spieltage: 4 100 → 80
  - Verwaltung › Mitglieder-App: 8 500 → 660
  - Helferdienste-Übersicht und Startseite der Verwaltung: 27 000 → 7 500
  Was die Seiten anzeigen, ist unverändert. Für jede geänderte Anfrage wurden die Antworten vorher und nachher Zeichen für Zeichen verglichen.
- **Anmeldung in der Verwaltung:** 1,6 s → 1,1 s.

**Wiedereintritt und Mitgliedsnummern**
- **Wiedereintritt:** Ist der Austritt schon wirksam, heißt der Knopf beim Mitglied jetzt „Wiedereintritt …“. Das Mitglied bekommt dann eine neue Mitgliedsnummer und als Eintritt das heutige Datum. Hatte es ein SEPA-Mandat, wird eine neue Mandatsreferenz angelegt, und für Lastschriften muss ein neues Mandat unterschrieben werden. Beitrag und Abteilungsbeiträge laufen ab dem Wiedereintritt wie bei einem neuen Mitglied, also je nach Einstellung anteilig fürs restliche Jahr. Alte Nummer und altes Mandat stehen im Änderungsverlauf. Alles Bisherige wie Buchungen, Stunden und Zahlungen bleibt beim Mitglied.
- **Austritt zurücknehmen** (Austritt noch nicht wirksam, zum Beispiel zurückgezogene Kündigung): wie bisher, die Nummer bleibt.
- **Vergebene Mitgliedsnummern kommen nie wieder:** auch nicht, wenn ein Mitglied gelöscht wird oder beim Wiedereintritt eine neue Nummer bekommt.

**Namen überall „Nachname, Vorname“**
- Listen, Tabellen, Auswahlfelder, Kacheln und Überschriften zeigen Personen jetzt durchgehend als „Nachname, Vorname“ und sortieren nach Nachnamen. Neu umgestellt sind zum Beispiel Verkauf › Buchungen, Deckel, Gäste und Zahlungen, Abrechnung, Benutzer, Helferdienste, Zeiterfassung, Rechnungen und Spendenquittungen an Mitglieder sowie Überschriften wie „Austritt von …“.
- In ganzen Sätzen, Anreden, Briefen, auf Ausdrucken für die Person und bei frei eingetippten Gastnamen bleibt die gewohnte Reihenfolge „Vorname Nachname“. Mannschaften und Firmen stehen wie geschrieben.

**Korrekturen**
- **Verkauf am Tablet, viele Artikel mit Bildern:** Wird die Artikelseite neu aufgebaut, etwa nach „Auswahl leeren“, erscheinen die Bilder sofort und blinken nicht mehr kurz leer. Die lange Liste „Deine Auswahl“ springt nicht mehr zur Seite, wenn ihre Scrollleiste erscheint. (Dass bei jedem Tipp die ganze Seite neu aufgebaut wurde, ist schon seit 3.32 behoben.)
- **Beitrag einer Person:** Helferstunden-Vorgabe und „Diese Beitragsarten dürfen nicht buchen“ richten sich immer nach dem Hauptbeitrag. Bisher konnte eine einmalige Gebühr wie die Aufnahmegebühr bei einem Wiedereintritt oder ein Zusatzbeitrag vom selben Tag den Hauptbeitrag verdrängen. Dann galt zum Beispiel ein Mitglied mit „Unterstützend“ (keine Helferstunden) plötzlich als stundenpflichtig.
- **Für später abgesichert:** Eine neue automatische Leistungsprüfung schlägt Alarm, wenn eine dieser Seiten wieder deutlich mehr Abfragen braucht.

## 3.33.0

**Mitglied löschen – sicher**
- **Neu in der Mitgliederverwaltung:** Beim Mitglied gibt es jetzt den Knopf „Löschen …“. Gedacht ist er vor allem für versehentlich, doppelt oder falsch angelegte Mitglieder. Für echte Austritte bleibt der Weg „Austritt“ und danach „Anonymisieren“.
- **Gelöscht wird nur, wenn nichts mehr am Mitglied hängt.** Sonst zeigt Clubwerk eine Liste, was zuerst zu lösen ist, zum Beispiel „Beitrag zugeordnet: Erwachsene“, „Zahlt für: Muster, Lena“, „Spielt in: Herren 30 (Spielbetrieb)“ oder „2 kommende Buchungen (Buchungssystem)“. Geprüft werden:
  - Verkauf: offener Betrag und offene Veranstaltungslisten
  - Mitgliederverwaltung: Beiträge, Abteilungen, Zahler und Familie, offene Forderungen, Ämter und Ehrungen
  - Spielbetrieb: Mannschaften
  - Buchungssystem: kommende Buchungen, Serien und Warteliste
  - Helferdienste: kommende Einsätze und noch nicht bestätigte Stunden
  - Buchhaltung: offene Rechnungen
  - Verwaltung: ein verbundener Benutzer
- Vergangenes sperrt nicht: Alte Buchungen, Abrechnungen und bezahlte Forderungen bleiben mit dem Namen erhalten.
- **Dieselbe Prüfung gilt für „Löschen“ unter Verkauf → Mitglieder & Konten und für „Inaktive entfernen“.** Bisher wurden dort Beiträge, Mannschaften und Buchungen im Hintergrund einfach mit entfernt.
- Löschen dürfen Benutzer mit dem Recht „Konten“ oder dem vollen Recht „Mitglieder“. Abteilungsleitungen dürfen es nicht.

**PIN-Eingabe am Tablet überall gleich**
- Verkauf, Platzbuchung, Helferdienste und Zeiterfassung zeigen dasselbe PIN-Fenster: immer 6 Kreise, die Stellen 5 und 6 blass, weil die PIN 4 bis 6 Ziffern hat. Gleich sind auch der Text „Bitte deine PIN eingeben – …“, die Abstände und die Größe. Bisher zeigten Helferdienste, Platzbuchung und Zeiterfassung nur 4 Kreise, und bei den Helferdiensten war unten ein leerer Streifen.

## 3.32.0

**Verkauf am Tablet**
- **Schneller beim Tippen:** Tippt man mehrmals schnell auf einen Artikel oder auf „+“ unter „Deine Auswahl“, zählt Clubwerk jetzt ohne Verzögerung hoch. Bisher wurde bei jedem Tipp die ganze Artikelseite neu aufgebaut (auf einem langsamen Tablet rund 0,3 Sekunden pro Tipp), jetzt nur noch die eine Kachel (rund 0,02 Sekunden).
- **Nur noch Namen in der Liste:** Der Hinweis „Familie“ und das Schloss-Symbol sind weg. Familienmitglieder und Personen, für die jemand anderes zahlt, erscheinen nur, wenn in der Mitgliederverwaltung bei ihnen „Verkauf am Tablet: bucht selbst“ eingestellt ist. Voreingestellt ist „über den Hauptzahler (nicht in der Liste)“.
- **Kein Flackern mehr beim Wechseln:** Beim Wechsel zwischen Verkauf, Plätzen, Helferdiensten usw. bleibt die Kopfzeile mit Vereinsname, Logo und Reitern ruhig stehen. Bisher wurde sie auf jeder Seite leer aufgebaut und danach gefüllt.

**Verwaltung am Tablet**
- **Automatisch abmelden:** Wer die Verwaltung über den Knopf „Verwaltung“ am Tablet öffnet, wird nach einer Minute ohne Eingabe abgemeldet. So bleibt sie nicht offen, wenn jemand vergisst, sich abzumelden. Ruft man die Verwaltung direkt auf (Adresse `…:3801/admin.html` oder Seitenleiste von Home Assistant), bleibt man wie bisher angemeldet.

**Mitglieder**
- **Geschlecht:** Zur Auswahl stehen nur noch „männlich“ und „weiblich“, im Mitgliedsantrag (am Tablet und online) und in der Mitgliederverwaltung. Auch der Import nimmt nur diese beiden Angaben. Die Bestandserhebung für den Landessportbund behält ihren Aufbau, damit das Format für den Verband gleich bleibt.

**Spielbetrieb**
- **Gastspieler ohne Mannschaft gehören nicht mehr zum Spielbetrieb:** Wird eine Mannschaft gelöscht oder ein Gastspieler aus seiner letzten Meldeliste genommen, wird er ganz entfernt, und sein persönlicher Link gilt nicht mehr. Bisher blieb er stehen und musste einzeln entfernt werden. Wer noch in einer anderen Mannschaft spielt, bleibt. Kommt jemand zurück, legt man ihn neu an und schickt ihm den neuen Link.
- Die Rückfrage beim Löschen einer Mannschaft zählt genau auf, was mitgeht: Spieltage, Meldeliste und die Gastspieler, die dadurch ganz entfernt werden.

**Fehler behoben**
- Startseite der Verwaltung: Der offene Betrag im Verkauf und bei den Mitgliedern wird wieder richtig angezeigt.
- Buchungssystem: Die Mail „Für dich gebucht“ zeigt wieder Platz, Tag und Uhrzeit. Bei geänderten Buchungen kommt die Push-Nachricht auch dann, wenn Mails an Mitspieler ausgeschaltet sind.
- Drucken (QR-Codes, Briefe, Spielbetrieb) läuft überall über denselben, bewährten Weg wie die übrigen Ausdrucke.
- Hinweistext zur PIN korrigiert: Sie hat 4 bis 6 Ziffern.
- Spielbetrieb: Gastspieler sind jetzt in der Modul-Sicherung enthalten.
- Mitgliedsantrag: Am Tablet und in der App ist der Verweis auf die Satzung nur noch Text (kein Link, der aus der App herausführt). Im Online-Antrag bleibt er ein Link.
- Spielbetrieb: Die Knöpfe stehen wie in allen anderen Modulen oben rechts in der Reiterzeile.
- Benutzer & Rechte: Der zuletzt gewählte Reiter bleibt erhalten.
- Mitglieder-App, Zugang: Mitglieder stehen überall als „Nachname, Vorname“ und sind danach sortiert.
- Schrift auf Vereinsfarbe und auf roten Knöpfen richtet sich nach der Farbe. So bleibt sie auch bei heller Vereinsfarbe und im dunklen Modus gut lesbar.

**Aufgeräumt**
- Rechnungen von Getränkehändlern erkennt Clubwerk jetzt allgemein am Kopf der Rechnung („Getränke <Name>“) statt an fest eingebauten Händlernamen.
- Module fragen sich gegenseitig nur noch über die vorgesehenen Schnittstellen ab. Jedes Modul bleibt so allein nutzbar.
- Doppelte Programmteile zusammengelegt (Home-Assistant-Anbindung, Anmeldebremse, Druck, Dialoge), Überbleibsel entfernt. Dazu gehören die alte Dropbox-Einstellung „aufbewahren“, die nie wirkte, und die Einstellung „Erinnerung nach (Tagen)“ in der Buchhaltung, die nie ausgewertet wurde.
- Neue automatische Tests für Spielbetrieb, Buchungs-Mails, Namenssortierung, Protokolltexte und Rechnungsleser. Der Design-Prüfstand achtet zusätzlich auf feste weiße Schrift auf Vereins- und Warnfarbe.

## 3.31.0

**Sicherheitsprüfung:** Clubwerk wurde gründlich auf Sicherheitslücken durchgesehen – Anmeldung, Rechte, Tablet, Mitglieder-App, Tresor, Sicherungen und alle Module. Eine Lücke, über die jemand aus dem Internet hineinkommt, gab es nicht. Behoben ist alles, was gefunden wurde:

- **PIN am Tablet (wichtig):** Hatte der Vorstand die PIN eines Mitglieds zurückgesetzt, konnte jemand am Tablet eine neue PIN festlegen – und die galt dann auch in der Mitglieder-App des Mitglieds, z. B. zum Öffnen der Türen. Jetzt ändert eine am Tablet neu festgelegte PIN die App-PIN nicht mehr. Dort gilt die PIN erst nach einer Änderung mit der bisherigen PIN oder nach dem nächsten Koppeln.
- **Mitglieder-App einrichten:** Einen QR-Code oder eine Einladung für ein Mitglied erzeugt nur noch, wer das Mitglied verwalten darf (Recht „Mitglieder“ bzw. „Mitglieder anlegen“; Abteilungsleitungen nur für die eigene Abteilung). Ein Recht wie „Beregnung“ allein reicht nicht mehr, um ein Handy als Mitglied zu koppeln.
- **Buchungssystem:** Wer Belegungen nur ansehen darf, konnte über „nur dieser Termin“ trotzdem Buchungen verlegen. Ändern braucht jetzt überall das Recht „für Mitglieder buchen“.
- **Rollen „nur eigene Abteilung(en)“:** Gelten nur für „Mitglieder“ und „E-Mail an Mitglieder“. Andere Rechte (z. B. Bankdaten, Helferstunden) hätten in so einer Rolle für alle Mitglieder gegolten – sie lassen sich dort nicht mehr ankreuzen und wirken in bestehenden Rollen nicht mehr. Bitte solche Rechte in einer eigenen Rolle vergeben. PIN zurücksetzen dürfen Abteilungsleitungen nur noch in der eigenen Abteilung.
- **Modul-Sicherungen und Tresor:** Mit eingeschaltetem Tresor standen Adressen und Bankdaten in der Modul-Sicherung (vor dem Deinstallieren) unverschlüsselt. Jetzt bleiben sie darin verschlüsselt. War der Tresor beim Sichern gesperrt, gingen die Daten verloren – auch das ist behoben.
- **Anmeldung in der Verwaltung:** Die Sperre nach vielen falschen Passwörtern ließ sich mit sehr vielen Schein-Anmeldungen aufheben – jetzt nicht mehr. Und: Geräte, an denen man sich schon einmal angemeldet hat, sperrt die Pause nach 20 Fehlversuchen nicht mehr aus. So kann ein Fremder im WLAN den Admin nicht mehr mit falschen Passwörtern aussperren.
- **Mit dem eigenen Passwort bestätigen:** Erweiterung hochladen, eine Datenbank-Sicherung wiederherstellen und einem Benutzer „alle Rechte“ geben.
- **Sicherungsziele:** Der Verbindungstest verwendet das gespeicherte Passwort nur noch für denselben Server. FTPS (z. B. FRITZ!Box) prüft das Zertifikat jetzt auch beim Übertragen der Dateien.
- **Lesbare Auszüge** (Excel mit Namen, Beträgen, Türprotokoll) gehen nicht mehr von selbst mit ins Sicherungsziel, weil sie unverschlüsselt sind. Wer sie möchte, schaltet sie unter Einstellungen → Sicherung wieder ein.
- **Kleinere Punkte:**
  - Im PDF eines Mitgliedsantrags ist die IBAN ohne Recht „Bankdaten“ abgekürzt.
  - Verlorene oder gesperrte Handys bekommen nach einem neuen QR-Code keine Push-Nachrichten mehr.
  - Die Beregnungs-Webapp ist auch dann nicht von außen erreichbar, wenn ein Tunnel versehentlich auf sie zeigt.
  - Über ein Proxy-Add-on (z. B. NGINX) sind Verwaltung und Tablet aus dem Internet nicht mehr erreichbar.
  - „Türen nur im Vereins-WLAN“ gilt bei jedem Tunnel-Aufbau.
  - Online-Mitgliedsanträge sind je Anschluss begrenzt, damit niemand die Tagesgrenze für alle aufbraucht.
  - Zeiterfassung: Falsche PINs sperren eine Person nur noch kurz (höchstens eine Stunde); gegen Durchprobieren zählt zusätzlich das Gerät.

## 3.30.6

- **Neutral für jeden Verein:** Beispiele in Änderungsprotokoll, Anleitung und Programmkommentaren nennen keinen echten Verein und keine echte Adresse mehr („TC Musterstadt“, „app.dein-verein.de“, Gerätename „homeassistant“, Kürzel „TCM“). Gefunden hat das die neue Geheimnis-Prüfung, die vor jeder Version läuft.
- **Für Entwickler:** Das Repository enthält jetzt alle Werkzeuge für die Weiterentwicklung (Ordner `werkzeuge/`, Anleitung in `CLAUDE.md`): Paket-Skript mit allen Prüfungen, Demo-Server mit erfundenen Daten, rund 50 erweiterte Testreihen, Design-Prüfstand, Übersetzungswerkzeuge.

## 3.30.5

**Design-Prüfstand:** Ab jetzt prüft ein automatischer Prüfstand vor jeder Version alle Oberflächen – Verwaltung (auch im Tablet-Rahmen), Tablet, Mitglieder-App und Beregnungs-Webapp – in Handy-, Tablet- und Rechnergröße, hell und dunkel, rund 1 000 Ansichten mit Fenstern, Reitern, Menü und Scrollen bis ganz unten. Ohne grünes Ergebnis wird kein Paket gebaut. Was er in dieser Version gefunden hat:

- **iPhone zoomte beim Antippen von Eingabefeldern:** Felder hatten weniger als 16 px Schrift. Am Handy jetzt überall 16 px – kein Hineinzoomen mehr.
- **Seite scrollte hinter geöffneten Fenstern:** Bei offenem Fenster (Verwaltung, Tablet, App) steht die Seite dahinter jetzt still.
- **Menü am Handy:** Bei wenig Bildschirmhöhe wurden die Menüeinträge zusammengedrückt – jetzt scrollt das Menü, die Einträge behalten ihre Höhe.
- **Lesbarkeit:** Nebentexte (Spaltenköpfe, Abschnittstitel, Hinweise) waren zu blass – jetzt in Hell und Dunkel mindestens 4,5 : 1 Kontrast. Buchungsarten mit hellen Farben (z. B. Orange) bekommen automatisch dunkle Schrift statt weißer.
- **Platzplan am Tablet/Handy:** Plätze behalten ihre volle Breite („Platz 2“ statt „Plat…“); der Plan lässt sich seitlich wischen, die Uhrzeiten bleiben links stehen.
- **Formulare am Handy:** Felder einer Zeile stehen untereinander in voller Breite statt zusammengedrückt (z. B. Verkauf → Nachtragen, Beregnung → Plätze); alle Auswahllisten sehen gleich aus.
- **Tippflächen am Handy:** „mehr“ unter Einleitungen, Links in Hinweisen, Farbkreise der Buchungsarten, Spiele im Kalender, Textknöpfe in der App („Ändern“) sind groß genug zum sicheren Antippen.
- Spielbetrieb: Kalender-Einträge mit korrekter Schrift (ungültige Schriftangabe entfernt).

## 3.30.4

- **Tablet (Plätze):** Der aktive Reiter in der Kopfzeile hatte auf der Platzseite noch einen weißen Unterstrich aus der alten Kopfzeile – entfernt, alle Reiter sehen jetzt gleich aus (auch bei eigenen Links).
- **Kopfzeile am Handy:** Bei wischbarer Reiterleiste wird der aktive Reiter automatisch ganz ins Bild geholt statt halb am Rand zu stehen.
- **Verwaltung am Handy:** Das Buchungssystem war durch die Tagesleiste breiter als der Bildschirm (Seite ließ sich seitlich verschieben) – die Tage lassen sich jetzt wischen. Alle 16 Seiten mit ihren Reitern auf 390 px geprüft.
- **Verwaltung im Tablet-Rahmen (iPhone):** Die Seite ließ sich nicht bis ganz nach unten scrollen, weil das Ende unter der Safari-Leiste lag – die Höhe richtet sich jetzt nach dem sichtbaren Bereich (auch bei eigenen Links).
- **Menü am Handy:** Das geöffnete Menü deckt die Seite ganz ab, nur das Menü scrollt; die Seite dahinter bleibt stehen. Der Tastenhinweis „⌘K / Strg K“ erscheint nur noch, wo es eine Tastatur gibt.

## 3.30.3

Alle übrigen Punkte aus der Design-Prüfung:
- **Tablet:** Einzelne Aktion („Einsatz beginnen“) über die ganze Zeile wie die Leerzustände; die Leiste „vorbei · aufklappen“ steht zwischen Spaltenköpfen und Zeitraster (auch in Verwaltung und App); Anmeldung zur Verwaltung sieht aus wie die übrigen Fenster (mittig, Knopf über die volle Breite).
- **Mitglieder-App:** Ein einzelnes Gerät (z. B. eine Tür) nimmt die ganze Breite ein; Fenster ohne farbigen Randstreifen, ausgewogener Text, kein Loch über dem Knopf.
- **Buchungssystem:** Buchungsart-Dialog mit schmalem Feld „Reihenfolge“ und beschrifteter eigener Farbe; Serien-Dialog mit „Erster/Letzter Tag“, „Beginn/Ende“ und Notiz über die ganze Breite.
- **Mitgliederverwaltung:** Beitragsart-Dialog mit Mindest- und Höchstalter nebeneinander, Betrag in €; Mahnungen mit einzeiliger Auswahl; Bestandserhebung mit gleich breiten Zahlenspalten.
- **Mitglieder-App-Verwaltung:** Testnachricht in eigener Zeile, Speichern rechts; Minutenfeld in Standardhöhe.
- **Einstellungen:** Tablet & Kopfzeile, Passwort, Weitere Adressen – Speichern immer unten rechts; Module mit ihren Symbolen und vollständiger Beschreibung, Status groß geschrieben; Sprachen-Knöpfe bündig.
- **Verkauf:** Bestellung und Zeiterfassung mit vollständigem Hinweissatz statt zerrissenem Text; Bestand mit verständlichen Spaltenköpfen und „–“ statt Lücken.
- **Zugang:** Zeitprofile als normale Karten, „Türen“ als Feldbeschriftung, Hilfetext unter der Tabelle.
- **Spielbetrieb:** Aufgaben und Erinnerungsfelder sind ausgegraut, solange ihr Haken fehlt; „Entfernen“ einheitlich.
- Überall: richtige Einzahl/Mehrzahl statt „Rechnung(en)“, Speichern-Leisten rechtsbündig, Hinweisbalken bleiben ein zusammenhängender Satz.

## 3.30.2

**Mitgliederverwaltung (1.8.0) – Familien**
- **Familienmitglieder zahlen über das Oberhaupt:** „Wer zahlt?“ ist für Partner/in und Kinder gesperrt, Zahler ist automatisch das Oberhaupt. Bestehende Familien werden beim Start angeglichen. Einstellbar bleibt nur, wie am Tablet gebucht wird.
- **Kein eigener Beitrag in der Familie:** „+ Beitrag“ entfällt; Zuordnungen mit eigenem Beitrag werden abgelehnt, die Liste markiert Doppelungen („eigener Beitrag trotz Familienmitgliedschaft“).
- **Konto & Mandat und Dokumente** zeigen „Familienmitglied von …“ mit Link zum Oberhaupt; Konto und Mandat sind ausgegraut, Beitrittserklärung und SEPA-Mandat werden beim Oberhaupt abgelegt.
- Abteilungen bleiben möglich – der Zusatzbeitrag wird dem Oberhaupt belastet (steht jetzt so in der Karte).
- **Mitglieder im Menü** öffnet immer die ganze Liste mit leerer Suche.
- **Beitragsarten sortierbar** (↑ ↓) – die Reihenfolge gilt auch für Auswahlfelder und die Beitrittserklärung. Alter steht als „ab 19“ statt „19–…“.
- **„Meine Daten“** (was Mitglieder in der App sehen und ändern dürfen) steht jetzt unter Verein → Mitglieder-App → Meine Daten.
- Anträge: Erklär-Kacheln entfallen, die Knöpfe stehen rechts in der Reiterzeile.

**Mitglieder-App**
- **Bereiche ein- und ausschalten:** Unter Mitglieder-App → Bereiche schaltet „In der App“ einen Bereich für alle aus und wieder ein – Freischaltungen bleiben erhalten. „Allen entziehen“ entfällt.
- Reiterleiste unten immer einzeilig, Meldungen erscheinen unten statt über dem Vereinsnamen, Buchungen im Plan werden nicht mehr abgeschnitten, Spieltitel dürfen zweizeilig sein.

**Beregnung (1.3.1)**
- Nur der Knopf „Starten“ startet – nicht mehr die ganze Kachel.
- Ohne Verbindung zur Anlage sind die Kacheln ausgegraut wie bei den Türen.
- Der Hinweis „Fehler heute“ auf der Übersicht verschwindet, sobald das Protokoll angesehen wurde („Protokoll öffnen“ führt direkt hin).
- Behoben: Fehlermeldung „Cannot set properties of null“ nach dem Wechsel von der Beregnung zu einer anderen Seite.

**Protokoll**
- Keine internen Schlüssel mehr: Einstellungen stehen als „Vorlauf (Tage im Voraus): 7 → 14“, Rechte mit ihren Namen, Browser als „Chrome · Windows“. Zeit einzeilig mit vierstelliger Jahreszahl.

**Logo im PDF:** Bei SVG-Logos fehlte das Logo seit 3.25.0 in Beitrittserklärung, Rechnungen und E-Mails. Die Verwaltung erzeugt jetzt ein PNG dafür – nach dem Update einmal die Verwaltung öffnen.

**Einheitliches Design (Prüfung aller 209 Ansichten)**
- Tablet hochkant: Kopfzeile wird zweizeilig, wenn die Reiter nicht passen – nichts überlappt mehr.
- „Wer bist du?“ ist überall dieselbe Namensauswahl (Plätze, Helferdienste, Zugang): Hinweis über die volle Breite, Treffer in zwei Spalten, Namen einzeilig. PIN-Feld: „OK“ ist der grüne Hauptknopf.
- Verwaltung: Knöpfe wie „+ Neues Mitglied“ stehen rechts in der Reiterzeile; Reiter springen beim Wechsel nicht mehr; Untertitel ohne verwaiste Wörter; ein Leerzustand für alle Listen; gesperrte Knöpfe grau und lesbar; Feldbeschriftungen beginnen groß; lange Dialoge behalten Speichern/Abbrechen unten sichtbar; Meldungen verschwinden beim Seitenwechsel.
- Einzelseiten: Sonderrechte im Raster, Buchungsdialog ohne schwebende Knöpfe, Postfach mit Speichern unten rechts, Türen ohne abgeschnittene Auswahlfelder, Einwilligungstexte mehrzeilig, Übersichtskacheln mit einzeiligen Titeln, „Einstellungen exportieren/importieren“ statt „Funktion …“.

## 3.30.1

- **Tablet: weitere Tage buchen (Buchungssystem 1.6.0):** Über dem Belegungsplan lassen sich wie in der Mitglieder-App die Tage bis zum Vorlauf wählen und dort buchen – mit denselben Regeln. Nach 2 Minuten ohne Eingabe springt das Tablet wieder auf „heute“.
- **Tagesauswahl überall gleich:** Verwaltung, Tablet und Mitglieder-App nutzen dieselben Tagesknöpfe (Wochentag klein, Tag groß, heute markiert). In der Verwaltung blättern die Pfeile wochenweise; das Datumsfeld zum Springen bleibt daneben.
- **Sonderrecht „darf mit allen Buchungsarten buchen“:** Unter Buchungssystem → Einstellungen → Mitglieder-App → Sonderrechte lässt sich einem Mitglied jede aktive Buchungsart freigeben, auch künftig angelegte; die Einzelauswahl wird dann ausgegraut. In der Liste steht „alle Buchungsarten“.

## 3.30.0

- **Beregnung nur für ausgewählte Mitglieder:** Unter Mitglieder-App → Bereiche → „Wer sieht welchen Bereich?“ steht für jeden Bereich, ob ihn alle sehen oder nur ausgewählte Mitglieder. Beregnung und Türen sind beim Freischalten nicht mehr vorausgewählt (einstellbar je Bereich). Mit „Allen entziehen …“ verschwindet die Beregnung auf einen Schlag bei allen Mitgliedern – danach einzeln für Platzwart oder Vorstand wieder freischalten.
- **Gleiche Bedienung überall (Beregnung 1.3.0, Zugang 1.2.0):** Beregnung und Türen sehen in Verwaltung, Mitglieder-App, Tablet und Beregnungs-Webapp gleich aus – dieselben Kacheln mit Symbol, Namen, Zustand und Knöpfen. In der Verwaltung lässt sich ein Platz jetzt auch direkt starten und einzeln stoppen; Restzeiten laufen mit.
- **Termine überall mit gleichem Datumsblock** (Datum groß, Wochentag darunter) – jetzt auch bei den Helferdiensten in der Verwaltung und am Tablet.
- Regel festgehalten: gleiche Sache = gleiches Aussehen in allen Oberflächen (ERWEITERUNGEN.md).

## 3.29.4

- **Tablet: Browser trägt den Benutzernamen nicht mehr in die Namenssuche ein.** Chrome hielt die Suche für das Benutzerfeld zum Tablet-Passwort und füllte dort den gespeicherten Verwaltungs-Benutzernamen ein. Das Passwortfeld des Tablets hat jetzt ein eigenes (unsichtbares) Benutzerfeld „Vereinsheim“ in einem eigenen Formular – die Suche bleibt leer.

## 3.29.3

Tablet: alle Seiten nach denselben Regeln – nichts mehr „zusammengestückelt“:

- **Gleicher Aufbau überall:** Titel = Name in der Kopfzeile (Verkauf, Helferdienste, Beregnung, Plätze, Mitglied werden, Zeiterfassung, Zugang), darunter ein Satz, was man tut, dann Abschnitte mit Überschrift und dem gleichen Kachelraster.
- **Aktionen als große Kacheln mit Symbol:** „Einsatz beginnen“ (Helferdienste) sieht jetzt aus wie „Ich möchte Mitglied werden“ – unter „Was möchtest du tun?“. Der große grüne Einzelknopf und die zwei Spalten sind weg.
- **Zugang und Beregnung** passen sich am Tablet an: volle Breite, große Kacheln mit Symbol (Schloss, Tropfen) vier je Zeile, Fenster in der Mitte wie bei den übrigen Seiten. Bei Zugang wird der Name jetzt wie überall gesucht (nach 2 Buchstaben) statt aus einer langen Liste gewählt.
- **Kopfzeile:** Bei vielen Reitern werden die Namen nicht mehr abgeschnitten („Helferdiens…“).
- **Zeiterfassung** hat die Überschrift „Personal“, Plätze zeigt das Datum als Abschnitt über dem Plan.
- Gestaltungsregeln fürs Tablet in ERWEITERUNGEN.md festgehalten.

## 3.29.2

- **Platzbelegung überall gleich (Buchungssystem 1.5.0):** Das Tablet zeigt die Plätze jetzt im selben Belegungsplan wie Verwaltung und Mitglieder-App – Plätze nebeneinander, Zeitachse links, Buchungen als Blöcke (Buchungsarten in ihrer Farbe, Jetzt-Linie). Freie Stelle antippen bucht, Buchung antippen storniert.
- Unter jedem Platz steht überall die Öffnungszeit (in der Verwaltung stand vorher „Plätze“).
- Vergangene Stunden des heutigen Tages sind überall gleich eingeklappt – jetzt auch in der Verwaltung; ein Klick auf die Leiste klappt sie auf.

## 3.29.1

Einheitliches Design in der ganzen Verwaltung und der Mitglieder-App:

- **Überall Reiter oben:** Auch Einstellungen und Mitglieder-App haben jetzt die Reiter oben wie Verkauf, Beregnung oder Zugang – kein Seitenmenü mehr. Unterbereiche innerhalb eines Reiters (z. B. Buchungssystem → Einstellungen) erscheinen einheitlich als Umschalter darunter.
- **Gleicher Seitenkopf:** Die Überschrift zeigt immer den Namen der Seite wie im Menü (z. B. „Verkauf“, „Buchungssystem“), der Satz darunter erklärt den gewählten Reiter. Bei Mitglieder-App und Einstellungen steht die Einleitung wieder oben.
- **Startseite überall gleich festlegen:** In der Mitglieder-App legt man Reihenfolge und Start-Reiter jetzt in einer Liste fest – genauso wie bei „Leiste am Tablet“ („Reiter in der App“, ↑ ↓ und „Start“).
- **Aktionen rechts:** „+ Neu …“ und weitere Aktionen stehen auf allen Seiten rechts über der Liste, die Hauptaktion ganz rechts; Suche und Filter links.
- **Speichern** ist überall der grüne Hauptknopf; Benutzer & Rechte hat Reiter für Benutzer und Rollen.
- **Mitglieder-App:** leere Bereiche (z. B. „Noch keine Plätze eingerichtet“) erscheinen als Karte wie überall; „Alle Zonen ausschalten“ erscheint erst, wenn es Plätze gibt (auch in der Beregnungs-Webapp).
- Gestaltungsregeln für Module ergänzt (ERWEITERUNGEN.md).

## 3.29.0

Sicherheit und Datenschutz nach dem Tiefen-Review:

- **Tresor ausschalten ohne Risiko:** Vorher wurden die Schlüssel gelöscht und erst danach die Dateien (Fotos, Dokumente, Mail-Anhänge) entschlüsselt – ein Abbruch mittendrin hätte Dateien unlesbar gemacht. Jetzt: freien Speicher prüfen, alle Dateien einzeln entschlüsseln und prüfen, erst dann Datenbank und Schlüssel umstellen. Scheitert etwas, bleibt der Tresor eingeschaltet und alles wieder verschlüsselt.
- **Unterbrochene Läufe:** Bricht das Ein- oder Ausschalten ab (Neustart, Stromausfall), bringt Clubwerk beim nächsten Start alles in einen sicheren Zustand und vermerkt das im Protokoll. Halb geschriebene Zwischendateien werden entfernt.
- **Tresor erweitert:** zusätzlich Schlüsselnummer der Mitglieder, Handynummer der Gastspieler/innen, Notizen zu Buchhaltungs-Partnern und externen Helfern. Ältere Einträge werden beim ersten Start automatisch nachverschlüsselt. In der Verwaltung steht jetzt genau, was verschlüsselt wird – und was bewusst lesbar bleibt (Namen, Mitgliedsnummer, Belege …).
- **Mitglieder-App von außen nur über den Tunnel:** Direkte Anfragen aus dem Internet (z. B. durch eine Portfreigabe am Router) werden abgewiesen und gemeldet. Gast-WLAN und VPN funktionieren weiter. Wer bewusst einen eigenen Reverse Proxy betreibt, kann das unter Mitglieder-App → Verbindung erlauben.
- **Tunnel-Quelle wirklich exklusiv:** Ist sie festgelegt, gilt nur noch diese eine Adresse – auch nicht mehr das Proxy-Add-on aus der Konfiguration.
- **Vereinsnetz:** Ohne eingetragenes Vereinsnetz schlägt die Verwaltung das Netz von Home Assistant zum Übernehmen vor (auch, wenn man über die Seitenleiste arbeitet).
- **Sicherung zurückspielen:** Der Inhalt wird jetzt mit einem eigenen Leser der Archiv-Köpfe geprüft statt über die Textausgabe von tar; Verknüpfungen, Gerätedateien, Pfade nach oben, Steuerzeichen und fremde Namen werden abgelehnt. Wiederhergestellt wird nur in einen leeren Ordner.
- **Gastlinks verfallen:** nach 12 Monaten ohne Nutzung oder wenn der Gast in keiner aktiven Mannschaft mehr ist. Beim nächsten Teilen entsteht automatisch ein neuer Link (Spielbetrieb 1.4.1).
- **Update-Paket gegenprüfen:** Nach dem Hochladen zeigt Clubwerk eine Prüfsumme des Paketinhalts; dieselbe Zahl steht in „PRUEFSUMMEN.md“ im GitHub-Repository.
- Adressprüfung akzeptiert nur noch gültige IP-Adressen.
- **Tests im Repository:** Die automatischen Tests (Sicherheit, Tresor, Sicherung, Rechte …) liegen jetzt im Ordner `tests/` des GitHub-Repositorys und laufen bei jeder Änderung automatisch.

## 3.28.0

- **Gastspieler/innen (Spielbetrieb 1.4.0):** Mannschaften können jetzt auch Personen aufnehmen, die nicht Mitglied im Verein sind (z. B. Spielgemeinschaft mit dem Nachbarverein). Anlegen geht in der Verwaltung (Mannschaft → Spieler/innen → „+ Gastspieler/in anlegen“) und für den Mannschaftsführer direkt in der App (Rückmeldungen → „Gastspieler/in“).
- **Persönlicher Link statt Konto:** Jeder Gast bekommt einen eigenen Link (🔗 kopieren bzw. „Link teilen“) und meldet sich darüber selbst zu den Spieltagen zurück – ohne Anmeldung und ohne Mitglieder-App. Der Mannschaftsführer kann die Rückmeldung alternativ selbst eintragen (✓/✕ in seiner Übersicht).
- **Überall als „Gast“ gekennzeichnet:** in der Mannschaft, im Sportwart-Dashboard und in der Aufstellung. Gäste erscheinen nicht in der Mitgliederliste, am Tablet oder bei Buchungen. Auch für Gäste gilt: ein Einsatz je Tag.
- **Link erneuern / entfernen:** Ein weitergegebener Link lässt sich jederzeit ungültig machen („Neuer Link …“); „Ganz entfernen …“ nimmt den Gast aus allen Mannschaften.
- Hinweis: Damit der Link von unterwegs funktioniert, braucht die Mitglieder-App eine öffentliche Adresse (Tunnel oder eigene App-Adresse in den Einstellungen).

## 3.27.6

- **Buchung eintragen (Verwaltung, Buchungssystem 1.4.4):** übersichtlicher aufgebaut – Platz, Datum und Zeit (von–bis) in einer Zeile, dann Buchungsart und Titel, darunter „Wer spielt“ (Mitglied, Mitspieler). Gäste und Wiederholen klappen erst auf „+ Gäste“ bzw. „Wiederholen …“ auf; die interne Notiz steht unten über die ganze Breite.
- **Standarddauer 1 Stunde:** Ein Klick in den Kalender oder „Neue Buchung“ schlägt eine Stunde vor; wird der Beginn verschoben, wandert das Ende mit.

## 3.27.5

- **Platzbelegung in der App (Buchungssystem 1.4.3):** Buchungsarten (z. B. Medenspiel) behalten ihre Farbe auch bei eigenen Buchungen; die eigene Buchung erkennt man dann am Rahmen in Vereinsfarbe.

## 3.27.4

- **Spieltage (Spielbetrieb 1.3.3):** Ein ✓/✕ in der Tageszeile (mehrere Mannschaften) und „Alle ✓ / Alle ✕“ über mehrere Mannschaften sind jetzt jeweils eine einzige Anfrage – schneller und schont den Spamschutz der Mitglieder-App.

## 3.27.3

- **Stabiler bei Fehlern im Hintergrund:** Ein Fehler beim Versand von E-Mail oder Push (oder in einer anderen Hintergrundaufgabe) beendet das Add-on nicht mehr – er steht als „Fehler im Hintergrund (abgefangen)“ im Protokoll, die Buchung läuft durch. Vorher riss dabei die Verbindung ab („Load failed“ in der App).
- **Mitglieder-App:** Statt „Load failed“ eine verständliche Meldung; Abfragen im Vereins-WLAN werden bei einem Verbindungsabbruch einmal über die öffentliche Adresse wiederholt.

## 3.27.2

- **Ein Einsatz je Tag (Spielbetrieb 1.3.2):** Wer an einem Tag in einer Mannschaft aufgestellt ist, kann am selben Tag in keiner anderen Mannschaft aufgestellt oder als Ersatz geführt werden (eine Ersatz-Einplanung dort entfällt automatisch). Der andere Mannschaftsführer sieht „spielt in Herren“, die Zusage zählt bei ihm nicht mehr mit (Ampel und Übersicht bleiben ehrlich). Der Spieler sieht beim anderen Spieltag „spielt in …“ statt ✓/✕. Rückmeldungen gehen wie bisher an alle betroffenen Mannschaftsführer – jeder sieht sie bei seinem Spieltag.

## 3.27.1

- **Spieltage in mehreren Mannschaften (Spielbetrieb 1.3.1):** In „Alle“ steht jeder Tag nur noch einmal („Herren + Herren 30“). Ein ✓/✕ gilt für alle Mannschaften an diesem Tag; antippen klappt die einzelnen Mannschaften auf, um getrennt zu antworten („Herren ✕ · Herren 30 offen“). Eine gemeinsame Leiste „8 offen in 2 Mannschaften · Alle ✓ / Alle ✕“; derselbe Mannschaftsführer erscheint nur einmal.

## 3.27.0

- **Spielbetrieb – Übersicht für den Sportwart (Spielbetrieb 1.3.0):** Neue erste Seite „Übersicht“: Kennzahlen (Rückmeldequote, Spieltage der nächsten 14 Tage, zu wenige Zusagen, offene Absage-Anfragen), „Braucht Aufmerksamkeit“ (zu wenige Zusagen, Aufstellung noch nicht verschickt, Absage-Anfragen – mit „Öffnen“) und je Mannschaft eine Rückmelde-Matrix: Spieler/innen × die nächsten Termine mit ✓/✕/offen, aufgestellt, Ersatz, Absage-Anfrage, Zusagen je Termin und „Offene erinnern“ (eine Nachricht je Person mit der Zahl offener Termine).
- **Spieltage in der App:** Kopfkarte mit Mannschaft und Liga, kurzer Anleitung (✓ kann · ✕ kann nicht; was „vorläufig“ heißt) und dem Mannschaftsführer (sonst Stellvertretung) mit Handynummer und „Anrufen“. Abschaltbar unter Spielbetrieb → Einstellungen.

## 3.26.3

- **Platzbelegung „Ausführlich“ (Buchungssystem 1.4.2):** Neben „Kompakt“ (alle Plätze auf einen Blick) gibt es die Ansicht „Ausführlich“: breite Platzspalten zum seitlichen Wischen, die Uhrzeiten bleiben links stehen, in den Blöcken stehen die ganzen Namen. Die gewählte Ansicht merkt sich das Handy.

## 3.26.2

- **Buchungsfenster neu gestaltet (Buchungssystem 1.4.1):** alle Felder gleich hoch (48 px), gleiche Beschriftungen, kompakter Aufbau: Für wen · Dauer/Art · Mitspieler. Gast, Gerät/allein und Wiederholen klappen erst auf Antippen auf („+ Gast“, „Wiederholen …“), die Platzordnung als Häkchen mit „lesen“.
- **Mitglieder-App lädt Bereiche nach jedem Update neu:** Die Dateien der Bereiche tragen die Versionsnummer – das Handy hält keine alte Fassung mehr fest.

## 3.26.1

- **Benachrichtigungen zentral:** In der Mitglieder-App schaltet das Mitglied Benachrichtigungen je Handy nur noch an oder aus. Welche Hinweise kommen, legt allein der Vorstand fest (Mitglieder-App → Benachrichtigungen); frühere Abwahlen einzelner Anlässe am Handy gelten nicht mehr.

## 3.26.0

- **Für andere buchen (Buchungssystem 1.4.0, Spielbetrieb 1.2.3):** Neues Sonderrecht „darf für andere buchen“. Damit bucht ein Mitglied in der App für ein anderes – etwa für ein älteres Mitglied ohne Handy. Kontingent, Regeln und Gebühren gelten für das Mitglied, für das gebucht wird; es bekommt eine E-Mail. Die Buchung steht beim Buchenden unter „Meine Buchungen“ („für …“) und lässt sich dort ändern und stornieren.
- **„Jetzt auf der Anlage“:** eingeklappt als eine Zeile über dem Kalender („1 belegt · 1 kommt“) – antippen zeigt Plätze und Namen, eine Zeile antippen alle Namen. Abschaltbar unter Buchungssystem → Einstellungen.
- **Startseite der Mitglieder-App:** Unter Mitglieder-App → Bereiche einstellbar – ein fester Bereich (z. B. Buchen) oder der zuletzt genutzte (wie bisher).
- **Kalender in E-Mails:** Buchungs- und Spieltag-Mails haben den Termin immer als Kalendereintrag im Anhang. Antippen öffnet direkt „Zum Kalender hinzufügen“ (iPhone-Mail, Gmail …) – der Knopf, der Safari öffnete, entfällt.
- **Mitglieder-App im Vereins-WLAN:** Beim Öffnen eines WLAN-Bereichs (Beregnung, Türen) prüft die App die lokale Adresse sofort und danach noch einige Male – wechselt das Handy erst kurz nach dem Öffnen ins Vereins-WLAN, wird der Bereich trotzdem frei.
- **Sonderrechte (Verwaltung):** Bearbeiten und Entfernen als Symbolknöpfe.

## 3.25.2

- **Mitglieder-App im einheitlichen Design:** Buchen, Spieltage, Meine Daten und Dienste nutzen jetzt dieselben Bausteine – gleiche Karten mit gleichem Kopf (Aktion rechts), gleiche Zeilenlisten, ein einheitlicher Datumsblock vor jedem Termin, gleiche Marken, Umschalter, Hinweisleisten, Knöpfe und Formularfenster, gleiche Abstände. Module: Buchungssystem 1.3.3, Spielbetrieb 1.2.2, Helferdienste 2.0.2, Mitgliederverwaltung 1.7.1.
- **Styleguide:** Der Teil für die Mitglieder-App ist jetzt eine vollständige Bausteintabelle (ERWEITERUNGEN.md); die Vorlage für neue Module enthält einen Beispielbereich für die App.
- **Mitglieder-App (Verwaltung):** „Einladen“ und „Entfernen“ in der Liste der freigeschalteten Mitglieder sind kleine Symbolknöpfe (mit Hinweis beim Darüberfahren) – die Tabelle passt ohne seitliches Scrollen.

## 3.25.1

- **Mitglieder-App, „Meine Daten“ (Mitgliederverwaltung 1.7.0):** Einwilligungen lassen sich wie die übrigen Angaben freigeben – „Sehen“ und „Ändern (erteilen und widerrufen)“ getrennt. Ausgeblendet erscheinen sie in der App nicht mehr; ein Widerruf geht dann formlos beim Vorstand.
- **Modulversionen:** Verkauf hat eine eigene Versionsnummer (bleibt 3.25.0, da unverändert). Jedes geänderte Modul bekommt künftig seine eigene neue Nummer; die Add-on-Version zählt alles zusammen.

## 3.25.0

- **Einheitliches Design (Styleguide):** Alle Tablet-Seiten – Verkauf, Zeiterfassung, Mitglied werden, Helferdienste, Plätze – nutzen dieselben Bausteine: gleiche Breite, gleicher Seitenkopf mit Untertitel, gleiches Raster, gleiche Kacheln, Leerzustände, Hauptknöpfe, PIN-Fenster und Sperrseite. Der Styleguide steht in ERWEITERUNGEN.md, die Vorlage für neue Module nutzt ihn.
- **Eine PIN für Mitglieder-App und Verkauf:** Wer im Verkauf schon eine PIN hat, gibt beim Freischalten der App genau diese ein; wer noch keine hat, legt sie in der App fest und sie gilt auch am Tablet. PIN am Tablet geändert → gilt sofort auch in der App. Bisher getrennte PINs werden einmalig zusammengeführt (die App-PIN gilt).
- **Mitglieder-App (Verwaltung):** Seite in Unterbereiche geteilt – Mitglieder, Bereiche, Benachrichtigungen, Verbindung, Sicherheit; roter Punkt, wo etwas zu tun ist; Filter „eingeladen“ und „warten auf WLAN“.
- **Vereinsfarbe:** Die Mitglieder-App übernimmt eine neue Farbe beim Start bzw. beim Zurückholen in den Vordergrund (ohne Neuladen), auch die Statusleiste am Handy; das Tablet beim nächsten Abgleich.
- **Platzübersicht in der App:** „Jetzt auf der Anlage“ (wer gerade spielt, wer gleich kommt); in den Blöcken stehen die Spieler einzeln („Thorsten S.“).
- **Plätze am Tablet:** Vergangene Zeiten sind eingeklappt (antippen klappt auf, nach einer Minute wieder zu).
- **Spieltage in der App:** kompakte Liste – eine Zeile je Spieltag mit ✓/✕, Details zum Aufklappen.
- **E-Mails:** Schrift, Größe und Fettung auch in GMX/Web.de und anderen strengen Mailprogrammen korrekt.
- Tablet: Das Suchfeld im Verkauf ist beim Zurückkehren immer leer (der Browser füllte alte Eingaben ein).
- **App-Symbol (Home-Bildschirm):** Hintergrund in Vereinsfarbe, Vereinslogo groß mit schmalem weißem Rahmen (leere Ränder des Logos werden abgeschnitten). Wird bei Logo- oder Farbwechsel neu erzeugt. Auf dem iPhone erscheint das neue Symbol, wenn die App neu auf den Home-Bildschirm gelegt wird.

## 3.24.0

- **Mitglieder-App ohne QR-Code im Vereinsheim einladen:** „Einladen …“ je Mitglied – QR-Code am Bildschirm, **per E-Mail** (Knopf „App freischalten“ mit Anleitung) oder **Einladungsbrief** zum Ausdrucken. „Einladungen verschicken …“ für viele auf einmal (E-Mail oder Briefe). Gültigkeit für E-Mail/Brief einstellbar (2, 7 oder 14 Tage).
  - Bestätigungsmail an das Mitglied nach jeder Freischaltung; Warnung an den Vorstand, wenn eine schon benutzte Einladung erneut geöffnet wird.
  - **Gestufte Freischaltung:** von unterwegs ohne zweiten Faktor freigeschaltete Handys bekommen Türen und Beregnung erst nach dem ersten Öffnen im Vereins-WLAN (oder Freigabe durch den Vorstand).
  - **Bestätigung per SMS (optional):** LTE-USB-Stick mit SIM am Home-Assistant-Rechner schickt einen 6-stelligen Code an die Handynummer aus der Mitgliederverwaltung – ohne Internet. Einrichtung, Statusanzeige (SIM, Netz, Empfang) und Test-SMS unter Mitglieder-App. Das Add-on bekommt dafür Zugriff auf serielle Geräte (`uart`).
- **Spielbetrieb – Kalender:** alle Spieltage eines Jahres im Layout des Rahmenterminplans (Monate als Spalten, Tage als Zeilen), mit Ampel, Heim/Auswärts, vorläufigen Terminen; zum Antippen und Drucken (A4 quer).
- Spielbetrieb: Dieselbe Mannschaft (gleiche Altersklasse und Nummer) lässt sich nicht mehr doppelt anlegen – Vorschlag „Herren 30 II“. Bereits doppelte Mannschaften werden einmalig durchnummeriert.
- Spielbetrieb: Spieler-Dialog umgedreht – links Mitglieder suchen, rechts die Mannschaft in Meldelisten-Reihenfolge; Beschriftung „Spieler/innen“.
- Rahmenterminplan: Hessenliga-Mannschaften ohne eigene HL-Termine (z. B. D40) bekommen die Termine ihrer Altersklasse.

## 3.23.1

- **Mehrere Mannschaften einer Altersklasse** („Herren 30 1“ / „Herren 30 2“, „Damen 1“ / „Damen II“): Der Spielplan-Import trennt sie jetzt anhand der Nummer beim Vereinsnamen („TC Musterstadt II“) – im Spielbetrieb und im Buchungssystem (eigene Plätze je Mannschaft). Vorher landeten alle Spiele einer Altersklasse bei einer Mannschaft. Bereits importierte Spiele werden weiter erkannt, nichts wird doppelt angelegt.

## 3.23.0

- **Spielbetrieb: Rahmenterminplan importieren.** Die PDF des Verbands einlesen – für alle Mannschaften auf einmal entstehen vorläufige Termine nach Altersklasse (H40, D, HL H30 …), lange bevor der Spielplan feststeht.
  - Prüfseite je Mannschaft mit den erkannten Terminen; Altersklasse wird aus Name/Liga vorgeschlagen und ist änderbar.
  - Zusatz- und Ausweichtage (Z/A) optional.
  - Spieler sehen die Termine nach „Abfrage starten“ und melden „kann“ / „kann nicht“ wie gewohnt.
  - Der Spielplan-Import macht aus den vorläufigen Terminen die echten Spieltage – Rückmeldungen bleiben. Termine ohne Spiel entfallen; wer „kann“ gemeldet hatte, bekommt eine Sammelnachricht „spielfrei“.
- Mannschaften haben jetzt eine Altersklasse (Feld „Altersklasse (Rahmenterminplan)“).

## 3.22.0

- **Neues Modul „Spielbetrieb“:** Mannschaften mit Mannschaftsführer, Stellvertreter und Spielern (auch in mehreren Mannschaften), Spielplan-Import vom Verband mit Heim- und Auswärtsspielen, Verfügbarkeit „kann“ / „kann nicht“ (optional mit Uhrzeit) und Aufstellung in der Mitglieder-App.
  - Ampel rot/grün je Spieltag nach Mindestanzahl Spieler.
  - Absagen nach der Aufstellung muss der Mannschaftsführer bestätigen.
  - Einstellbar, was Spieler von den anderen sehen; Aufgaben (Fahrer, Bewirtung …) und automatische Erinnerungen jeweils optional.
  - Läuft auch ohne Mitgliederverwaltung (dann nur Push).
- Buchungssystem: Der Spielplan-Import legt bei aktivem Spielbetrieb die Spieltage mit an.
- Für Erweiterungen: `hooks.appVisible`, Spielplan-Parser im Kern, Hooks `spielplanGames` / `bookImportedGames`.

## 3.21.2

- Protokoll des Add-ons: Jede Zeile beginnt jetzt mit Datum und Uhrzeit (Ortszeit), z. B. `[2026-10-20 14:47:03] Clubwerk auf Port 3100 …` – auch die Meldungen beim Start.

## 3.21.1

- E-Mails zu Buchungen: Statt „In der App öffnen“ gibt es jetzt **„Zum Kalender hinzufügen“** direkt unter dem Termin in der Infokarte (bei neuen und geänderten Buchungen). Der Knopf öffnet die Kalenderdatei des Termins – auf dem iPhone fragt der Kalender dann direkt nach. Ist die App nicht von unterwegs erreichbar, hängt der Termin stattdessen als Kalenderdatei an der Mail. In der Textfassung steht der Link mit dabei.

## 3.21.0

- **Verschlüsselung der persönlichen Daten (neu):** Adressen, Kontaktdaten, Geburtsdaten, Bankdaten, Unterschriften, Anträge, Änderungsverlauf, SEPA-Dateien, Buchhaltungs-Anschriften sowie Mitgliederdokumente, Profilfotos und Mail-Anhänge liegen auf Wunsch verschlüsselt auf der Platte (AES-256-GCM). Einschalten unter Datensicherung → „Verschlüsselung der persönlichen Daten“ – mit Wiederherstellungscode zum Ausdrucken (zwei Blätter: Vorsitz und Kassenwart) und Probe.
  - Ohne Internet und ohne weiteres Gerät: Nach einem Neustart öffnet die erste Anmeldung eines Admins die Daten. Bis dahin laufen Tablet, Buchungen, Türen und Beregnung weiter; E-Mails an Mitglieder warten und gehen danach raus.
  - Schnell: Im Betrieb liegt eine entschlüsselte Kopie nur im Arbeitsspeicher – Listen und Suche sind so schnell wie bisher.
  - Neue Online-Anträge und Änderungswünsche werden auch im verschlossenen Zustand angenommen (öffentlicher Schlüssel).
  - Hinweis in der Übersicht, solange die Verschlüsselung aus ist bzw. die Daten nach einem Neustart noch zu sind.

## 3.20.4

- **Passwort für das Tablet ist jetzt Pflicht** (Schutz der Mitgliederdaten): Ohne Passwort bleibt die Buchungsseite für normale Geräte gesperrt; das Tablet zeigt „Tablet noch nicht eingerichtet“, die Übersicht der Verwaltung einen roten Hinweis mit „Festlegen“. Bei der Ersteinrichtung wird es gleich mit abgefragt (mind. 8 Zeichen, nicht zu leicht, anders als das Adminpasswort). Ausschalten geht nicht mehr, nur ändern. Angemeldete Admins und die Home-Assistant-Seitenleiste kommen weiterhin immer hinein. **Nach dem Update: einmal unter Einstellungen → Tablet & Kopfzeile ein Passwort festlegen und am Tablet eingeben.**
- **Vereinsnetz gilt jetzt auch für Verwaltung, Tablet und Beregnungs-Webapp:** Ist es eingetragen, kommen nur noch Geräte aus diesen Netzen (plus Seitenleiste) an Port 3100 und 5000 – Gast-WLAN, VPN und andere Add-ons nicht mehr. Schutz vor Selbstaussperren beim Speichern; Hinweis in der Übersicht, solange kein Vereinsnetz eingetragen ist.
- Mitglieder-App – **Tunnel-Quelle festlegen:** Die Absenderangabe des Cloudflare Tunnels kann auf die eine Adresse beschränkt werden, von der der Tunnel tatsächlich kommt („Nur diese Quelle zulassen“). Ungültige Absenderangaben werden abgelehnt.
- Komplettsicherung: Vor dem Entpacken wird die Inhaltsliste geprüft – nur normale Dateien und Ordner mit bekannten Namen, keine Verknüpfungen, keine Pfade nach oben, Größe begrenzt.

## 3.20.3

Nachbesserungen aus der Gesamtprüfung (Security und Datensicherheit):

- **Verwaltung/Tablet (Port 3100) und Beregnungs-Webapp (Port 5000) nur noch aus dem eigenen Netz:** Kommt eine Anfrage direkt von einer öffentlichen Internet-Adresse (z. B. weil der Port am Router versehentlich freigegeben ist), wird sie abgewiesen und als Sicherheitshinweis gemeldet. Geprüft wird die echte Absenderadresse, nicht eine Kopfzeile. Seitenleiste, Heimnetz, VPN (auch Tailscale) und IPv6 im eigenen Netz funktionieren wie bisher.
- **Abteilungsadmins:** dürfen Personen- und Kontaktdaten ihrer Mitglieder ändern, aber nicht mehr Mitgliedsnummer, Status, Eintritt, Schlüsselnummer, Zahlungsart, Notizen und Einwilligungen – das pflegt die Vereinsverwaltung. Die Felder sind für sie ausgegraut. In der Übersicht sehen sie Mitgliederzahlen nur noch für die eigene Abteilung.
- Mitglieder-App: Die lokale Adresse im Vereinsheim wird nur noch an gekoppelte Handys herausgegeben.
- Komplettsicherung: Beim Wiederherstellen wird die Datei erst vollständig entschlüsselt und ihr Prüfwert bestätigt, bevor überhaupt entpackt wird. Unplausible Schlüsselparameter im Dateikopf werden abgelehnt.

## 3.20.2

Weitere Nachbesserungen aus der vertieften Code-Prüfung:

- Online-Mitgliedsantrag: Die Mindest-Ausfüllzeit (15 s) hing an einem Zeitstempel, den der Browser selbst mitschickte – ein Programm konnte einfach einen alten Wert senden. Jetzt stellt der Server beim Öffnen ein signiertes Formular-Ticket aus: frühestens nach 15 Sekunden, höchstens 6 Stunden und nur einmal einlösbar.
- Push-Nachrichten: Push-Abos werden nur noch für die bekannten Push-Dienste der Browser angenommen (Apple, Google, Mozilla, Microsoft). Ein Handy kann dem Server damit kein beliebiges Ziel – etwa ein Gerät im Vereinsnetz – als Push-Adresse unterschieben. Ältere Abos mit fremdem Ziel werden beim nächsten Versand verworfen.

## 3.20.1

Sicherheits-Nachbesserungen aus einer externen Code-Prüfung:

- Mitglieder-App – **Vereinsnetz genauer:** Das interne Home-Assistant-Netz (172.30.32.0/23) zählt nicht mehr als Vereins-WLAN. Neu unter Mitglieder-App → „Vereinsnetz“: festlegen, welche Netze als Vereinsheim gelten (z. B. `192.168.10.0/24`), Knopf „Mein Netz übernehmen“. Leer = wie bisher jede private Adresse. Türen (Zugang) nutzen jetzt dieselbe Regel.
- Beregnung – **unterwegs nur mit PIN:** Hat ein Mitglied die Ausnahme „auch unterwegs“, fragt die App beim Starten von außerhalb nach der PIN. Im Vereins-WLAN bleibt es ein Tipp; Stoppen geht immer ohne PIN.

## 3.20.0

- Buchungssystem – **Serien mit Wiederholung:** täglich, wöchentlich (mit Wochentagen), alle 2/3/4 Wochen, monatlich am gleichen Tag oder am gleichen Wochentag (z. B. 2. Dienstag). In Serien & Sperren, im Buchungsdialog („wiederholen … bis“) und in der App (Sonderrecht Serien). Die Vorschau zeigt Anzahl, erste Termine und Überschneidungen.
- Buchungssystem – **Serientermin antippen → „Nur diesen Termin“ / „Diesen und alle folgenden“ / „Gesamte Serie“** zum Ändern und Absagen: in der Verwaltung (Platz, Uhrzeit, Titel, Buchungsart, Notiz), in der App für eigene Serien (Beginn, Dauer, absagen) und am Tablet (absagen). „Folgende“ teilt die Serie sauber auf.
- Buchungssystem – **Spielplan-Import:** Tabelle von der Verbandsseite einfügen (nuLiga „Begegnungen“) oder CSV/Excel/.ics wählen. Heimspiel-Erkennung (auch Spielort), Mannschaft und Plätze/Dauer aus der Liga („6er“ → 3 Plätze, 5 Std.), Vorgaben je Mannschaft gemerkt, gleichzeitige Spiele auf freie Plätze verteilt, Spiele als Vereinstermine je Mannschaft gebündelt, Buchungen zu Spielzeiten nach Bestätigung storniert. Erneuter Import erkennt Spielverlegungen.
- **Neue E-Mails:** Alle Mails von Clubwerk kommen mit einem ruhigen HTML-Layout (Vereinslogo, Vereinsfarbe, klare Schrift, Fuß); Buchungsmails mit Infokarte (Platz, Wann, Gebucht von, Spieler) und Knopf „In der App öffnen“. Die Textfassung bleibt für Mailprogramme ohne HTML.
- Kleinigkeit: Neue Serie in der Verwaltung schlug als Ende den 30.09. vor, auch wenn der schon vorbei war.

## 3.19.5

- Mitglieder-App: Startseite und Skript werden mit Versionsnummer verknüpft und nie zwischengespeichert (`app.js?v=…`, `no-store`) – damit bekommt auch die Home-Bildschirm-App auf dem iPhone nach einem Update sofort den neuen Stand.
- Mitglieder-App: Hält die Home-Bildschirm-App nach einem Update noch das alte Skript fest, lädt sie sich beim nächsten Start einmal selbst neu (Versionsabgleich mit dem Server). Die laufende Version steht im Konto-Menü hinter dem Profilbild.

## 3.19.3

- Mitglieder-App: Die lokale Adresse wird nur noch als Inlay in der App geöffnet – der Ausweg „In Safari öffnen“ ist entfernt. Antwortet die lokale Adresse nicht, bleibt die App mit Hinweis und „Zurück“ in sich.
- Verwaltung am Handy: Datumsfelder in Dialogen ragten auf dem iPhone über den Rand hinaus – behoben.
- Tablet-Kopfzeile am Handy: Bei fünf und mehr Reitern werden die Namen nicht mehr abgeschnitten, die Leiste ist seitlich wischbar.

## 3.19.2

- Mitglieder-App: Nach einem Netzwechsel (Mobilfunk → Vereins-WLAN) oder wenn die App wieder in den Vordergrund kommt, prüft sie die lokale Adresse erneut und gibt Beregnung/Zugang frei – bisher nur beim Start.

## 3.19.1

- Mitglieder-App: „Im Vereinsheim lokal öffnen“ bettet den Bereich jetzt als Inlay in die App ein, statt die ganze App unter der lokalen Adresse neu zu öffnen (kein Wechsel nach Safari mehr). PIN einmal eingeben, danach öffnet sich das Inlay beim nächsten Antippen von selbst; antwortet die lokale Adresse nicht, gibt es nach 8 s „In Safari öffnen“ als Ausweg. Einbetten ist nur zwischen den eigenen Adressen erlaubt.

## 3.19.0

- Mitglieder-App: **Push-Benachrichtigungen** aufs Handy (iPhone als Home-Bildschirm-App ab iOS 16.4, Android im Browser). Der Vorstand legt unter Mitglieder-App → „Benachrichtigungen“ fest, welche Anlässe es im Verein gibt, stellt Vorläufe ein und kann Testnachrichten schicken; das Mitglied schaltet Push hinter dem Profilbild → „Benachrichtigungen“ je Handy ein und wählt je Anlass. Anlässe: Buchen (als Mitspieler eingetragen, Buchung geändert, Buchung storniert, Platz frei aus der Warteliste, Erinnerung vor dem Spiel mit Vorlauf), Helferdienste (Erinnerung am Vortag), Testnachricht. Versand verschlüsselt über Apple/Google, nur Titel und ein Satz, Protokoll in der Verwaltung, erloschene Abos werden aufgeräumt. Erweiterungen melden eigene Anlässe über `hooks.pushEvents` an (siehe ERWEITERUNGEN.md).
- Helferdienste: Die E-Mail-Erinnerung am Vortag ging bisher stündlich erneut raus (Markierung griff nicht) – behoben.

## 3.18.0

- Mitglieder-App: Start ohne Warten – die Inhalte erscheinen sofort über die aktuelle Adresse; die Prüfung der lokalen Adresse läuft im Hintergrund und schaltet bei Erfolg um (bisher wartete die App draußen bis zu 8 s).
- Mitglieder-App: Lokale Route auch mit iCloud Privat-Relay. Der Bildschirm „Nur im Vereins-WLAN“ hat den Knopf „Im Vereinsheim lokal öffnen“: Die App wechselt per Seitenaufruf auf die lokale Adresse (`https://lan…:5001`) und nimmt die Kopplung über einen einmaligen Code mit (60 Sekunden gültig, nur mit PIN, nur aus dem Vereinsnetz einlösbar, im Protokoll vermerkt). Jedes Handy bekommt dafür einen zweiten Geräteschlüssel für die lokale Adresse; Sperre und Entfernen gelten für beide.
- Doku: Cloudflare-Route mit `https://`-Dienst-URL und Ursprungs-Servername statt „No TLS Verify“; Hinweise zu DNS-Rebind-Schutz (Fritz!Box) und Privat-Relay.

## 3.17.4

- Übersicht: Die Kachel „Buchungssystem“ zeigt jetzt wie „Verkauf“ groß die Summe der offenen Gebühren (ohne Mitgliederverwaltung: Gebühren des laufenden Jahres), darunter Buchungen heute und Belegung. Das Hinweis-Banner zu offenen Platzgebühren entfällt.
- Mitglieder-App: Die Prüfung der lokalen Route beim Start wartet bis zu 4 s und versucht es zweimal (der erste HTTPS-Aufbau zu einer neuen Adresse dauert auf manchen Handys länger). Der Bildschirm „Nur im Vereins-WLAN“ zeigt unten klein, ob die lokale Adresse erreichbar war und woran es sonst lag.

## 3.17.3

- Mitglieder-App → „Adresse der App“: Bei eingeschaltetem externem Zugang zeigte das Feld „Adresse im Vereins-WLAN“ nach dem Speichern wieder die öffentliche Adresse statt des gespeicherten Werts (nur Anzeige – gespeichert war richtig). Behoben; der Hinweis darunter nennt jetzt, welche Adresse im QR-Code landet und dass die WLAN-Adresse als lokale Route dient.

## 3.17.2

- Buchungssystem: Die Platzgebühren je Mitglied in der Mitglieder-App („Meine Platzgebühren“) und der Zusatzschalter „Gebühren“ in der Freischaltungstabelle sind wieder entfernt – offene Platzgebühren sieht nur der Vorstand auf der Übersichtskarte (Kennzahl und Hinweis) und im Reiter „Gebühren“.

## 3.17.1
- **Mitglieder-App – Zusatzschalter dezenter:** Die Haken „auch unterwegs“ und „Gebühren“ in der Freischaltungstabelle sind jetzt kleine Schaltflächen-Pills direkt neben dem Haken des Bereichs (grün = an), in einer Zeile ohne Versatz.

## 3.17.0
**3.17.0 – Platzgebühren, Mitspieler-Pflicht, Ballmaschine & Ballwand, Reihenfolge der App-Bereiche**
- Buchungssystem: neuer Reiter „Gebühren“ (Gast- und Platzgebühren mit Zahlungsstand aus der Mitgliederverwaltung, Filter offen/bezahlt, Jahr); Übersicht zeigt „Offene Platzgebühren“ mit Hinweis. Mitglieder sehen ihre offenen Gebühren in der App („Meine Platzgebühren“), wenn in der Mitglieder-App der Haken „Gebühren zeigen“ gesetzt ist.
- Plätze & Geräte: je Platz „Mitspieler: Pflicht“ und „Allein trainieren erlaubt“ (z. B. Ballwand); Geräte „als Mitspieler buchbar“ (z. B. Ballmaschine) – beim Buchen in App und Tablet unter „Mit wem spielst du?“ wählbar, die Ballmaschine wird im selben Zeitfenster mitgebucht und bei Änderung/Storno mitgeführt. Gerät und „allein“ kosten nichts und zählen nicht fürs Kontingent.
- Mitglieder-App: heute beginnt die Übersicht bei der aktuellen Stunde (vergangene Stunden als aufklappbare Leiste), „Freie Zeiten“ blendet vergangene Zeiten aus.
- Verwaltung → Mitglieder-App: Karte „Reihenfolge in der App“ legt die Reihenfolge der Bereiche (Reiter und Tabellenspalten) fest.

## 3.16.0
**Mitgliederverwaltung – Zahler und Familienmitgliedschaft getrennt.** Neben dem Zahler (wer die Beiträge, den Verkauf und die Lastschrift trägt) gibt es jetzt die Familienmitgliedschaft: Partner/in und Kinder bis 18 Jahre werden dem Oberhaupt mit Familienbeitrag zugeordnet und brauchen keine eigene Beitragsart; ein Vater kann weiterhin für erwachsene Kinder mit eigenem Beitrag zahlen. Höchstens zwei Erwachsene je Familie, Kinder, die 19 werden, meldet der Beitragslauf (keine stille Umstellung). Bestehende Familien werden beim Update automatisch übernommen. Neues Feld im Reiter „Zahlung & Familie“, in der Mitglieder-App, im Export, in der Datenauskunft und als Importspalte „Familie bei“. Helferdienste zählen den Familienpool nach der Familienmitgliedschaft.

## 3.15.1
**Fachaudit Getränkebuchung, Abrechnung und SEPA**
- Tablet „Rückgängig“ lehnt bereits abgerechnete Buchungen ab (Meldung „bereits abgerechnet – bitte an den Vorstand wenden“); Abrechnung und Buchungen können nicht mehr auseinanderlaufen.
- Doppeltes Buchen durch Doppeltipp oder WLAN-Aussetzer am Tablet wird verhindert: Jede Warenkorb-Buchung trägt einen Schlüssel, Wiederholungen innerhalb von 2 Minuten liefern das erste Ergebnis.
- Beitragslauf: Positionen, die ein parallel laufender Lauf schon gebucht hat, werden innerhalb der Transaktion erkannt und übersprungen (Antwort nennt die Anzahl).
- Bankverbindung bearbeiten: Mandatsdatum in der Zukunft wird abgelehnt; der Einzug warnt zusätzlich, wenn ein Mandat erst nach dem Einzugstag unterschrieben wurde.
- SEPA: Download eines verworfenen Einzugs liefert einen klaren Fehler (410) statt einer leeren Datei; `CreDtTm` in Ortszeit mit Zeitzonenversatz.
- Rücknahme eines Beitragslaufs nimmt Getränkeabrechnung und Posten in einer Transaktion zurück.
- Mengen und Beträge mit Nachkommastellen werden am Tablet und beim Nachtrag abgewiesen statt stillschweigend abgeschnitten.
- Veranstaltungs-Übernahme behält den ursprünglichen Buchungszeitpunkt (`created_at`).
- Karte „Von unterwegs nutzbar“: bei ausgeschaltetem Tunnel steht „Nur im Vereins-WLAN (Tunnel aus)“ statt des Hinweises auf die lokale Route.

## 3.15.0
- **Mitglieder-App – lokale Route im Vereinsheim:** Die App unter der öffentlichen Adresse prüft beim Start, ob sie die lokale HTTPS-Adresse von Clubwerk erreicht („Adresse im Vereins-WLAN“, z. B. `https://lan.meinverein.de:5001`), und nutzt sie dann für alle Aufrufe: schneller, ohne Tunnel, und Bereiche „nur im Vereins-WLAN“ (Beregnung, Türen) funktionieren – unabhängig von iCloud Privat-Relay. Voraussetzung ist ein gültiges Zertifikat für die lokale Adresse (Anleitung in der Dokumentation: Cloudflare-DNS-Eintrag mit privater IP + Let's-Encrypt-Add-on mit DNS-Challenge). Dafür: CORS nur zwischen den beiden eigenen Adressen, Content-Security-Policy entsprechend erweitert.
- **Regel geschärft:** Als Vereins-WLAN gilt nur noch, was direkt bei Home Assistant ankommt. Die Erkennung über die öffentliche IP des Vereinsanschlusses (3.14.0/3.14.1) entfällt – sie war nicht wasserdicht (Privat-Relay, Carrier-NAT). Die Ausnahme „auch unterwegs“ je Mitglied bleibt.
- `/api/ping` zeigt `wlan` (direkt aus dem Vereinsnetz) und die gesehene Adresse.

## 3.14.2
- **Mitglieder-App – Ausnahme „auch unterwegs“ je Mitglied:** Bereiche, die sonst nur im Vereins-WLAN gelten (z. B. Beregnung), lassen sich für einzelne Mitglieder auch von unterwegs freigeben – in der Tabelle unter Mitglieder-App neben dem Haken des Bereichs („auch unterwegs“, nur mit dem Recht des Bereichs). Gedacht für Platzwart oder Vorstand – und für Handys mit **iCloud Privat-Relay**: Dort leitet Apple den Verkehr über Cloudflare, sodass Clubwerk das Handy auch im Vereinsheim nicht am Vereinsanschluss erkennen kann (`/api/ping` zeigt dann eine Adresse `2a09:…`). Alternativ am iPhone: Einstellungen → WLAN → (i) beim Vereins-WLAN → „IP-Adressen-Tracking beschränken“ aus.

## 3.14.1
- **Mitglieder-App – Vereins-WLAN über die öffentliche Adresse jetzt auch bei IPv6 erkannt:** Handys erreichen Cloudflare meist über IPv6; der Add-on-Container hat aber selbst keine IPv6-Adresse, deshalb kannte Clubwerk das IPv6-Netz des Vereins nicht und zeigte im Vereinsheim „Nur im Vereins-WLAN“. Clubwerk fragt die IPv6-Adressen des Home-Assistant-Rechners jetzt beim Supervisor ab (gleiches Netz wie die Handys im WLAN). Zur Diagnose liefert `https://app.…/api/ping` die gesehene Absenderadresse (`ip`) und ob sie als Vereins-WLAN erkannt wurde (`clubNet`); unter Mitglieder-App → „Von unterwegs nutzbar“ stehen die erkannten Netze.

## 3.14.0
Große Qualitätsrunde: vier vollständige Prüfungen (Sicherheit, Code, Design/Symmetrie, Menüs) plus Performance – alle Befunde umgesetzt und mit neuen Testreihen abgesichert.

### Sicherheit
- **Sicherheit – Seitenleiste und Proxy-Add-ons sauber getrennt:** Als Home-Assistant-Seitenleiste (Ingress, ohne Tablet-Passwort, Ersteinrichtung ohne Code, Update-Upload) gilt nur noch, was tatsächlich vom Supervisor kommt – nicht mehr alles, was über ein eingetragenes Proxy-Add-on (Cloudflared, NGINX) hereinkommt. Die Sperre „Verwaltung und Tablet nie von außen“ greift jetzt vor allem anderen.
- **Mitglieder-App – Tunnel-Absender nur vom Tunnel:** Die echte Absenderadresse hinter Cloudflare (`cf-connecting-ip`) wird nur noch Anfragen aus dem Add-on-Netz von Home Assistant, von der in der Add-on-Konfiguration eingetragenen Proxy-Adresse („IP eines Proxy-Add-ons“, jetzt jede private Adresse erlaubt) oder vom selben Rechner geglaubt. Andere Geräte im WLAN können so keine Bremsen mehr mit wechselnden Adressen umgehen. Wird eine Tunnel-Anfrage abgelehnt, zeigt die Verwaltung unter Mitglieder-App → „Von unterwegs erreichbar“ 24 Stunden lang einen Hinweis mit der Adresse; „Verbindung prüfen“ nennt sie ebenfalls. Eine direkt freigegebene öffentliche Adresse (Portweiterleitung am Router) gilt immer als „unterwegs“. Die eigene Internet-Adresse wird verschlüsselt (https) abgefragt.
- **Mitglieder-App – Bremsen je Gerät und Mitglied:** Schreibende Aufrufe sind auf 60 je Minute und Handy begrenzt, Türen auf 12 je Minute, Beregnung auf 10 je Minute, Buchen/Stornieren/Warteliste auf 10 je Minute und Mitglied. Mitspieler-Benachrichtigungen sind auf 20 E-Mails je Mitglied und Stunde gedeckelt (darüber läuft die Buchung ohne Mail weiter).
- **Meine Daten – PIN für E-Mail-Adresse und Einwilligungen:** Eine neue E-Mail-Adresse und Änderungen an Einwilligungen bestätigt das Mitglied mit seiner App-PIN (wie Bankverbindung und Kündigung); Anschrift und Telefon weiterhin ohne PIN, der Vorstand bestätigt. Die PIN-Abfrage liegt jetzt immer über dem geöffneten Blatt.
- **Profilbilder anderer** werden nur noch Mitgliedern gezeigt, die den Bereich (Buchen, Helferdienste) selbst nutzen dürfen und solange das Modul aktiv ist.
- **Kleineres:** Die App-PIN (Mitglieder-App, Beregnungs-Webapp) bleibt nur noch im Speicher der Seite statt im `sessionStorage`. Das Buchungsprotokoll (CSV) entschärft Zellen, die Excel als Formel auswerten würde (Gastnamen). Die Rechteliste in `/api/admin/status` gibt es erst nach der Anmeldung. Die Bremse gegen Durchprobieren hat eine Obergrenze (20 000 Einträge). Mitglieder-App und Beregnungs-Webapp melden interne Fehler als 500 und protokollieren sie, statt sie als „Ungültige Anfrage“ zu verstecken. Erweiterungen erhalten `ctx.rateLimitKey(name, max, ms, req => schlüssel)`.

### Code-Qualität und Stabilität
- **Konten zusammenführen und löschen räumt jetzt überall auf:** Beim Zusammenführen doppelter Konten wandern auch die Daten der Module mit – Vereinsdaten, Beitrag, Bankverbindung und Dokumente der Mitgliederverwaltung, Platzbuchungen samt Mitspieler-Einträgen, Helferstunden, Sonderrechte und Freischaltungen. Beim Löschen werden sie entfernt. Bisher brach beides mit „Interner Fehler“ ab, sobald ein Modul das Konto kannte. Zusammenführen geht nur noch in echte Mitglieds- oder Mannschaftskonten; Fehler werden verständlich gemeldet. Erweiterungen können sich über den Hook `memberRemoved` beteiligen (ERWEITERUNGEN.md).
- **Rechte „E-Mail“ wird jetzt wirklich übernommen:** Rollen und Benutzer, die „Mitglieder“ haben, bekommen beim Update das Recht „E-Mail“ – die Übernahme aus 3.10 scheiterte bisher still beim Start.
- **Datenauskunft mit den eigenen Rechten:** Die DSGVO-Auskunft zeigt die IBAN nur noch mit dem Recht „Bankdaten“, Forderungen nur mit „Finanzen“, Dokumente nur mit „Dokumente“ – vorher sah jeder mit „Mitglieder“ alles.
- **Beregnung läuft sicher zu Ende:** Wird das Modul ausgeschaltet, während ein Platz beregnet wird, schließt Clubwerk sofort alle Ventile; laufende Zonen werden auch bei ausgeschaltetem Modul und beim Beenden (Update, Neustart) abgeschaltet statt offen zu bleiben.
- **Große Uploads schonen den Speicher:** Datenbank-Sicherungen, Update-Pakete und Modul-Sicherungen werden beim Hochladen direkt auf die Platte geschrieben statt komplett im Arbeitsspeicher gepuffert (bis zu 200 MB – auf einem Raspberry Pi zuvor kritisch).
- **Schneller am Tablet:** Indizes für Bestand je Artikel, Deckel, Veranstaltungen, Zahlungen, Gutschriften und Geräte der Mitglieder-App; die Namensliste liest die Profilbild-Kennung in einer Abfrage statt je Mitglied einzeln.
- **Kein Doppelklick-Doppel mehr:** Alle „Anlegen“/„Speichern“-Knöpfe in Dialogen der Verwaltung (auch in den Modulen, z. B. Serienbuchungen) sind gesperrt, solange gespeichert wird.
- **Mitgliederverwaltung:** Ein neues Mitglied wird ganz oder gar nicht angelegt (Beitrag, Bank, Abteilung in einem Schritt – z. B. eine doppelte Mandatsreferenz hinterlässt kein halbes Mitglied mehr); Einstellungen werden erst geprüft und dann gespeichert (bei einem Fehler bleibt alles unverändert).
- **Buchungssystem:** Kontingent und Doppelbelegung werden beim Eintragen noch einmal geprüft (Doppeltipp in der App konnte zwei Plätze gleichzeitig buchen); Regelverstöße in der Preisvorschau erscheinen als Hinweis.
- **Zugang:** Die Einstellungen werden erst nach vollständiger Prüfung gespeichert (vorher konnten Tür-IDs und Zeitprofile schon geändert sein, wenn ein späterer Teil abgelehnt wurde).
- **Kleineres:** Gelöschte Konten und Artikel lassen sich nicht mehr versehentlich „wiederbeleben“, Nachbuchungen nur auf aktive Konten; „Inaktive entfernen“ und „Rückgängig“ am Tablet zählen korrekt; Lieferanten-E-Mail wird schon beim Speichern geprüft; Funktionsimport der Helferdienste übernimmt nur bekannte Einstellungen; ein kaputt kodierter Sprach-Cookie, ein fehlendes `tar` oder ein Fehler in den nächtlichen Aufgaben beenden den Prozess nicht mehr; Fehlermeldungen der Schnittstelle sind durchgängig JSON `{ error }`; Namenszerlegung („von der Heide, Anna“) und Datums-/Geldhelfer gibt es nur noch an einer Stelle (Server `src/util.js` bzw. `ctx.util`, Browser `names.js`). Konvention für Datums-/Zeitformate in ERWEITERUNGEN.md.

### Oberfläche, Menüs, Performance
- **Oberfläche – Symmetrie und Gleichmäßigkeit:** Alle gemessenen Versätze und Überlappungen aus dem Design-Review behoben: Modulliste bei 1024 px (Kopfzellen überlappten, Beschreibung 0 px breit), aktiver Reiter wurde aus der Leiste herausgescrollt, Überschrift/Knopf-Überlappung bei 390 px (Rechnungen), gequetschtes Namensfeld der Zeitprofile, Knopfhöhen 44 vs. 40 px vereinheitlicht, Sprachen-Tabelle und weitere Tabellen in Karten bei 1024 px, Tabellenkopf 2 px versetzt, Heatmap-Monatsnamen, Speichern-Knopf außerhalb der Karte (Buchungssystem → Einstellungen), Pill-Größen, einheitliche Tablet-Kopfzeile mit aktivem Reiter auf allen Tablet-Seiten, Mitglieder-App (leere Profilbild-Karte, Zeitachsen-Beschriftung außerhalb der Karte, Sprach-Knopf fest unten).
- **Menü:** Feste Modulreihenfolge in der Seitenleiste (Verkauf, Buchungssystem, Helferdienste, Zeiterfassung, Beregnung, Zugang, Mitgliederverwaltung, Buchhaltung); Einstellungs-Bereich „E-Mail-Versand“ heißt jetzt „Postfach“ (alle Hinweise verweisen darauf); Buchungssystem-Reiter „Labels“ → „Buchungsarten“, Mitgliederverwaltung „Auswertungen“ → „Auswertung“, Beregnung „Webapp & Schutz“ → „Webapp & PIN“; falscher Verweis unter „Von unterwegs buchen“ korrigiert; Zähler in der Seitenleiste für Helferdienste (Stunden zu bestätigen) und Datensicherung (ohne Passwort oder älter als 7 Tage); Übersicht bündelt Hinweise (3 sichtbar + „weitere anzeigen“), Modulkarten in gleichmäßigem Raster; lange Modul-Einstellungen (Buchungssystem, Buchhaltung) in Unterbereichen mit Speichern je Karte. Ohne Mitgliederverwaltung bleibt alles wie gewohnt („Mitglieder & Konten“ unter Verein); jedes Modul läuft weiterhin allein.
- **Performance:** Vorbereitete Datenbankabfragen werden wiederverwendet (Statement-Cache) – die Übersicht mit 400 Mitgliedern und 50 000 Buchungen braucht 113 ms statt 699 ms, alle anderen Seiten profitieren mit. Antworten werden komprimiert (Brotli/gzip: Verwaltung 90 kB statt 314 kB, Listen und Buchungsprotokoll entsprechend), Schriften und Icons bleiben eine Woche im Browser-Cache, SQLite mit `synchronous=NORMAL` (bei WAL sicher) und 16 MB Seitencache. Gemessen mit großen Testdaten: Tablet-Start 44 ms, Mitgliederliste 75 ms, Belegungsplan 6 ms, Platzbuchung am Tablet 3 ms.

## 3.13.2
- **Beregnung überall gleich:** Eigene Webapp, Tablet und Mitglieder-App zeigen jetzt exakt dieselbe Seite – laufende und wartende Plätze haben überall den eigenen **„Stoppen“-Knopf**, die Zeile „Nächste automatische Beregnung“ ist auch in der Webapp und am Tablet entfernt, die Statuszeile lautet überall „Verbunden mit der Bewässerungsanlage“. Einziger Unterschied: In Webapp und am Tablet fragt Stoppen nach der Vereins-PIN, sofern „Stoppen ohne PIN“ nicht eingeschaltet ist; in der Mitglieder-App ist das Handy bereits freigeschaltet.

## 3.13.1
- **Mitglieder-App – Arbeitsstunden motivierender dargestellt:** Solange Stunden fehlen, steht groß „X h noch offen“ (mit Balken und „… von … geleistet – bitte bis …“). Ist das Soll erreicht, gibt es keinen Zielstrich und kein „Geschafft“ mehr, sondern „X h geleistet – danke!“ – und die offenen Dienste stehen dann ganz oben, die Stundenkarte darunter.

## 3.13.0
- **Saubere Adressen am Tablet:** Statt `/x/mitglieder/` heißen die Seiten jetzt wie ihre Reiter – `/plaetze/`, `/helferdienste/`, `/mitglied-werden/`, `/zeiterfassung/`, `/beregnung/`, `/zugang/`, Verkauf auch unter `/verkauf`. Alte Adressen mit `/x/…/` (Lesezeichen, gespeicherte Tablets) leiten automatisch weiter; auch über die Home-Assistant-Seitenleiste funktioniert alles wie bisher.
- **Start-Reiter einstellbar:** Unter Einstellungen → Tablet & Kopfzeile → „Leiste am Tablet“ (bisher „Reihenfolge am Tablet“) legt ein Auswahlknopf „Start“ fest, welcher Reiter beim Aufruf der Adresse (`…:3100`) erscheint – direkt unter dieser Adresse, ohne Weiterleitung. Dorthin kehrt das Tablet auch nach 30 Sekunden ohne Eingabe zurück. Vorgabe bleibt Verkauf; ist das Start-Modul abgeschaltet, erscheint wieder Verkauf.
- Erweiterungen können im Manifest unter `tablet.pfad` ihre Adresse festlegen (siehe ERWEITERUNGEN.md).
- **Mitglieder-App – Vereins-WLAN auch über die öffentliche Adresse erkannt:** Wer im Vereins-WLAN die App über die öffentliche Adresse (z. B. `app.dein-verein.de`) öffnet, wurde bisher wie „unterwegs“ behandelt, weil die Anfrage über Cloudflare kommt – Beregnung zeigte „Nur im Vereins-WLAN“. Clubwerk ermittelt jetzt regelmäßig die Internet-Adresse des Vereinsanschlusses und erkennt Handys im Vereins-WLAN daran (IPv4 gleich bzw. IPv6 im selben Netz). Die erkannte Adresse steht unter Mitglieder-App → „Von unterwegs nutzbar“.
- **Übernahme-Code kopieren:** Neben dem Code im Hinweis „Auf den Home-Bildschirm“ gibt es einen Kopierknopf.

## 3.12.0
- **Mitglieder-App – je Bereich „von unterwegs nutzbar“:** Unter Mitglieder-App → „Von unterwegs erreichbar“ wird für jeden Bereich festgelegt, ob er auch über das Internet (Cloudflare Tunnel) funktioniert. Vorgabe: Buchen, Meine Daten und Helferdienste ja, **Beregnung und Türen nein**. Unterwegs sind gesperrte Bereiche in der App ausgegraut und zeigen „Nur im Vereins-WLAN“; der Server lehnt sie auch direkt ab. Ändern nur mit dem Recht „Einstellungen“, jede Änderung steht im Protokoll.
- **Entfernen mit Auswahl:** „Entfernen …“ fragt jetzt, ob nur das **Handy** entfernt werden soll (Freischaltungen bleiben, neuer QR-Code genügt) oder das Mitglied **ganz aus der App** (Handy und alle Freischaltungen weg, das Mitglied verschwindet aus der Liste und steht wieder unter „Mitglied freischalten“). Auch im Bearbeiten-Dialog des Mitglieds.
- **Filter in der Liste:** Alle / mit Handy / ohne Handy / alte Adresse – jeweils mit Anzahl.
- **Alte Adresse erkennen:** Clubwerk merkt sich, unter welcher Adresse ein Handy gekoppelt wurde. Handys, die vor dem Einrichten der öffentlichen Adresse gekoppelt wurden, stehen mit „alte Adresse – neuer QR-Code nötig“ in der Liste – sie funktionieren nur im Vereins-WLAN, bis sie einen neuen QR-Code scannen.
- Die Kurzanleitung für den Cloudflare Tunnel passt zur aktuellen Cloudflare-Oberfläche (Networking → Tunnels, Routes → Published application).

## 3.11.2
- **Mitglieder-App – Handy entfernen / neuer QR-Code:** Die Rechteprüfung zählt nur noch echte Freischaltungen. Einträge abgeschalteter oder entfernter Module, gesperrte Freischaltungen und Bereiche „für alle“ blockieren nicht mehr. Fehlt ein Recht wirklich, nennt die Meldung den Bereich (z. B. „fehlt dir das Recht für: Beregnung“) statt nur „Bereiche, für die dir die Berechtigung fehlt“.

## 3.11.1
- **Beregnung in der Mitglieder-App:** Starten und Stoppen ohne zusätzliche PIN (das Handy ist gekoppelt und freigeschaltet). Laufende und wartende Plätze haben einen eigenen **„Stoppen“-Knopf** – nur dieser Platz wird ausgeschaltet, wartende Plätze rücken sofort nach. Die Zeile „Nächste automatische Beregnung“ ist entfernt.

## 3.11.0
- **Die PIN ist jetzt eine Zentralfunktion** – sie gilt für alles im Vereinsheim: Verkauf, Platzbuchung und Helferdienste.
  - **Platzbuchung am Tablet nur mit PIN:** Buchen und Stornieren am Tablet geht nur noch mit eigener PIN. Ohne PIN erscheint „Kein PIN vergeben“ – mit dem Angebot, sie gleich festzulegen (zweimal eingeben), danach geht es direkt weiter zur Buchung.
  - **Verkauf:** Wer noch keine PIN hat, wird beim Antippen seines Namens aufgefordert, eine festzulegen („Später“ ist möglich, Einkaufen geht weiter).
  - Neue PINs werden immer zweimal eingegeben. Am Tablet lässt sich die PIN nur noch ändern, nicht mehr entfernen – vergessene PINs setzt der Vorstand zurück.
  - **Mitgliederverwaltung:** Beim Mitglied steht „PIN vergeben“ oder „kein PIN“, dazu „PIN zurücksetzen“ (auch mit dem Recht „Mitglieder“).

## 3.10.8
- **Mitglieder-Import erkennt ähnliche Namen:** Neben gleicher Mitgliedsnummer und gleichem Namen findet der Import jetzt auch Spitznamen (Benni ↔ Benedikt/Benjamin, Susi ↔ Susanne, Sepp ↔ Josef …), Kurzformen (Alex ↔ Alexander, Susann ↔ Susanne) und Schreibvarianten (Stefan ↔ Stephan, Müller ↔ Mueller, Meier ↔ Mayer). In der Vorschau steht je Treffer eine Auswahl „zusammenführen mit …“ oder „als neues Mitglied anlegen“ – bei gleichem Geburtsdatum ist Zusammenführen vorgewählt, bei abweichendem Geburtsdatum gibt es keinen Vorschlag (z. B. Vater und Sohn). Beim Zusammenführen überschreiben die Daten aus der Datei die vorhandenen; Getränkekonto, PIN und App bleiben erhalten. Zwei Zeilen können nicht demselben Mitglied zugeordnet werden.

## 3.10.7
- **Platzbuchung – Titel freiwillig, auch bei Serien und Sperren:** Ohne Titel heißt eine Serie wie ihr Label oder das gebuchte Mitglied, eine Sperre einfach „Sperre“. Nur eine Vereinsbuchung ganz ohne Mitglied, Label und Titel wird abgelehnt (wie bei Einzelbuchungen). Die Felder zeigen „optional“ an.

## 3.10.6
- **Helferdienste:** Die Zahl im Reiter „Stunden (1)“ aktualisiert sich jetzt sofort nach dem Bestätigen, Ablehnen, Ausstempeln, Nachtragen oder Löschen – und beim Öffnen des Reiters, falls neue Meldungen aus der App gekommen sind.

## 3.10.5
- **Mitglieder-App – „In den Kalender“:** Öffnet keine leere Zusatzseite mehr. Auf dem iPhone erscheint direkt das Kalenderfenster über der App, danach ist man wieder in der App; auf Android wird der Termin wie gewohnt an die Kalender-App übergeben.

## 3.10.4
- **Platzbuchung – Reihenfolge der Plätze und Geräte:** Unter „Plätze & Geräte“ mit ↑ ↓ frei festlegen. Die Reihenfolge gilt im Belegungsplan, in der Mitglieder-App und am Tablet. Neu angelegte Plätze und Geräte kommen ans Ende.

## 3.10.3
- **Platzbuchung – Serie aus dem Kalender:** „Bitte den Zeitraum prüfen“ beim Speichern behoben. Das Feld „wöchentlich wiederholen bis“ hatte intern denselben Namen wie die Platzauswahl – dadurch wurde die Platznummer als Enddatum gelesen. Betroffen waren auch einzelne Buchungen im Kalender bei Benutzern mit dem Recht für Serien; beides geht jetzt wieder (einzeln „Gebucht.“, als Serie „x Termine angelegt, y belegte ausgelassen“).

## 3.10.2
- **Helferdienste in der App:** Einsätze, die schon vorbei sind (z. B. heute 9–15 Uhr, abends angesehen), stehen nicht mehr unter „Termine“ – vorher gab es dort „Ich helfe“ und dann die Meldung „nicht mehr offen“. Anzeige und Eintragen folgen jetzt derselben Regel: Eintragen geht bis zum Ende des Dienstes (Nachtschichten bis zum Ende am Folgetag). Vergangene Schichten in einem Dienstplan zeigen „vorbei“ statt eines Knopfs, und „Meine Dienste“ listet nur noch kommende.

## 3.10.1
- **Neues Mitglied von Hand nur mit Beitrittserklärung:** Beim Anlegen muss die unterschriebene Beitrittserklärung (mit SEPA-Mandat) als PDF oder Foto hochgeladen werden – per Knopf oder Ziehen ins Feld. Sie landet beim Mitglied unter „Dokumente“. Ohne Unterschrift auf Papier geht es weiter über „Beitrittserklärung am Tablet“.
- **Lastschrift vollständig:** Kontoinhaber ist jetzt Pflicht (wird aus Vor- und Nachname vorgeschlagen, bei Kindern einfach den Elternteil eintragen), dazu IBAN und Datum des SEPA-Mandats.
- Abteilungsleitungen können die Beitrittserklärung ebenfalls hochladen. Hochgeladene, aber nicht verwendete Dateien werden nach einem Tag gelöscht.
- **Platzbuchung – Plätze und Geräte löschen:** Nach der Rückfrage wird nur noch verhindert, wenn es **kommende** Buchungen, Serien oder Sperren gibt (die Meldung nennt Anzahl und nächsten Termin). Vergangene und stornierte Buchungen stehen dem Löschen nicht mehr im Weg und bleiben im Protokoll und in der Auswertung erhalten.

## 3.10.0
- **Neu: E-Mail unter „Verein“** – die Rundmail ist aus der Mitgliederverwaltung herausgelöst und jetzt ein eigenes E-Mail-Programm für den ganzen Verein:
  - **Empfänger als Chips:** Gruppen (alle aktuellen, aktive, passive, Ehrenmitglieder, Kinder & Jugendliche, Abteilungen, Ämter, Beitragsarten – jeweils mit Anzahl), einzelne Mitglieder per Namenssuche, freie Adressen (auch „Name <adresse>“, mehrere mit Komma einfügen) und gespeicherte **Verteiler**. Jede Adresse bekommt die Mail nur einmal; Kinder ohne eigene Adresse auf Wunsch über den Zahler (Eltern).
  - **Formatierter Text:** fett, kursiv, unterstrichen, Überschriften, Listen, Zitat, Links, Trennlinie; Platzhalter wie {briefanrede}, {vorname}, {mitgliedsnr} werden je Empfänger ersetzt. Eingefügter Text aus Word oder Webseiten wird bereinigt.
  - **Anhänge** per Knopf oder Ziehen ins Fenster (bis 10 MB je Datei, 20 MB je Mail; Programme gesperrt).
  - **Entwürfe** speichern sich beim Schreiben automatisch, **Vorlagen** für wiederkehrende Mails, **Vorschau** mit Empfängerliste und Musteransicht vor dem Senden.
  - **Absender:** Gesendet wird über das Vereinspostfach (kein Spam), aber mit dem Namen des Vorstandsmitglieds und **seiner Antwortadresse** – Antworten landen direkt bei ihm. Eigene Unterschrift, auf Wunsch Kopie an sich selbst.
  - **Gesendet:** Zustellstatus je Empfänger, Versand im Hintergrund mit Fortschritt (läuft nach einem Neustart weiter), Fehlgeschlagene erneut senden, Mail weiterverwenden, Anhänge herunterladen.
  - **Recht „E-Mail“** (Benutzer & Rechte). Wer bisher die Mitgliederverwaltung nutzen durfte, bekommt es automatisch. Mit einer Rolle „nur eigene Abteilung“ nur an Mitglieder der eigenen Abteilungen; gesendete Mails anderer bleiben dann verborgen.
- **Reiter auf dem Handy:** Auch die Reiter innerhalb einer Seite bleiben in einer Zeile und lassen sich seitlich wischen.

## 3.9.0
- **Arbeitseinsatz heißt jetzt „Helferdienste“ – mit Dienstplänen:** Für Veranstaltungen (z. B. Sommerfest, Clubmeisterschaft) einen Dienstplan über einen oder mehrere Tage anlegen, je Tag Schichten mit Aufgabe, Zeit und Anzahl Helfer (auch unbegrenzt, auch über Mitternacht, z. B. 23:30–02:00). Je Plan wählbar, ob die Dienste zu den Pflichtstunden zählen. Mitglieder tragen sich in der App ein; Austragen geht bis 24 Stunden vorher (der Admin bekommt eine Info), danach nur über den Ansprechpartner. Nur die Verwaltung trägt Nicht-Mitglieder ein. Pläne kopieren (z. B. fürs nächste Jahr), drucken, als Excel exportieren und als Veranstaltung in den Verkauf übernehmen. Einzeltermine (Arbeitseinsätze) und Stunden bleiben wie bisher.
- **Profilbild:** Mitglieder laden in der Mitglieder-App ein Foto hoch (oben rechts) und wählen selbst, wo es erscheint – Verkauf am Tablet, Platzbuchung, Helferdienste. Die Verwaltung sieht das Bild beim Mitglied und kann es entfernen. Bilder sind in der Vollsicherung enthalten.
- **Mitglieder-App – Bereiche je Mitglied:** Unter „Mitglieder-App“ lassen sich jetzt **alle** Bereiche je Mitglied an- und abhaken (Buchen, Meine Daten, Dienste, Beregnung …) – auch die, die bisher automatisch für alle galten. Abgehakte Bereiche verschwinden aus der App des Mitglieds.
- **Platzbuchung – Sonderrechte in der App:** Einzelnen Mitgliedern erlauben, in der Mitglieder-App **Serien** zu buchen (wöchentlich bis zu einem Jahr, belegte Termine werden übersprungen, „Meine Serien“ mit Beenden) und mit bestimmten **Labels** zu buchen – zusätzlich zu den Label-Rechten nach Ämtern.
- **Serien aus dem Kalender:** Beim Anlegen eines Termins im Belegungsplan „wöchentlich wiederholen bis“ wählen – mit dem Recht für Serien.
- **Platzbuchung in der App:** Die Übersicht zeigt den ganzen Tag ohne eigenes Scrollfeld – die Seite scrollt normal, nichts hängt mehr. Buchen mit fehlendem Mitgliedsstatus war blockiert („null“) – behoben.
- **Neue Mitglieder nur vollständig:** Anlegen geht nur mit Anschrift, E-Mail, Handynummer, Geburtsdatum, Beitrag (passend zum Alter) und Zahlungsart – bei Lastschrift mit IBAN und Mandatsdatum.
- **Mitglieder-App:** Datumsfelder auf dem iPhone laufen nicht mehr über den Rand, lange Dialoge lassen sich scrollen (z. B. „Stunden melden“), das Menü überlappt nicht mehr. Bei „Kontaktdaten ändern“ steht, welche Angaben nur der Vorstand ändern kann (Einstellung in der Mitgliederverwaltung → Mitglieder-App).

## 3.8.2
- **Buchungssystem – Label-Rechte:** Je Label einstellbar, wer damit buchen darf: nur die Verwaltung, alle Mitglieder (z. B. „Clubmeisterschaft“) oder bestimmte **Ämter** aus der Mitgliederverwaltung (z. B. „Trainer“ für Training, „Mannschaftsführer“ für Medenspiel) und einzelne Personen. Berechtigte wählen das Label direkt in der Mitglieder-App.
- **Vereinstermin:** Labels wie Training oder Medenspiel können ohne Höchstdauer, Kontingent, Vorlauf und Gebühren gebucht werden (Haken am Label) – z. B. ein Medenspiel über 5 Stunden drei Wochen im Voraus, Gegner als Gäste ohne Gastgebühr.
- **Buchungen bearbeiten** statt stornieren und neu anlegen: in der Verwaltung („Bearbeiten“ im Termin – Platz, Zeit, Mitglied, Mitspieler, Gäste, Label) und in der App die eigene Buchung (Beginn, Dauer, Mitspieler, Gäste). Gastgebühren werden neu berechnet; neue Mitspieler bekommen die Buchungs-Mail, entfernte eine Storno-Mail, alle anderen eine kurze Änderungs-Mail mit „vorher“.
- **Mitglieder-App – Übersicht:** Alle Plätze nebeneinander mit allen Buchungen auf einen Blick (wie im Vereinsheim-Plan, Labels farbig); freie Stelle antippen zum Buchen, eigene Buchung zum Ändern oder Stornieren. Die bisherige Ansicht heißt „Freie Zeiten“.
- **Belegungsplan:** Termine zeigen nur so viele Zeilen, wie hineinpassen – nichts wird mehr halb abgeschnitten (sonst Name · Uhrzeit in einer Zeile). Etwas mehr Höhe je Stunde.
- **Tablet:** Aufeinanderfolgende Zeiten derselben Buchung erscheinen als ein Block (z. B. 19:00–20:00). Bei „Wer bist du?“ werden keine Namen mehr vorgeschlagen – erst nach Eingabe der ersten Buchstaben, angezeigt als „Nachname, Vorname“ (auch beim Arbeitseinsatz).
- **Neu: Auswertung (Dashboard)** im Buchungssystem: gebuchte Stunden, Auslastung, Buchungen und Stornos mit Vorjahresvergleich, Stoßzeit, beliebtester Tag und Platz, Auslastung je Platz, Verwendung nach Art und Label (Ring), Jahreskalender, Stunden je Monat, wer am meisten spielt, „Wann wird gespielt?“ – gesamt oder je Platz.
- **Neu: Buchungsprotokoll:** alle Buchungen des Jahres, auch stornierte und Sperren, nach Tag gruppiert – Filter Mitglieder, mit Gast, Labels, Sperren, Storniert, je Platz, Suche, sortiert nach Termin oder Eintragung, Export als CSV.
- **Neu: Auswertung im Verkauf:** Umsatz, verkaufte Artikel, Buchungen und Stornos mit Verlauf und Vorjahresvergleich, Bestseller, stärkster Tag, Stoßzeit, die meistverkauften Artikel mit Anteil, Umsatz nach Kategorie, Jahreskalender, Umsatz je Monat, „Wann wird gekauft?“.
- **Reiter in einer Zeile:** Die Reiter eines Moduls brechen nicht mehr in eine zweite Zeile um; bei wenig Platz lassen sie sich seitlich wischen.
- **Mitglieder:** Alle Mitgliederlisten sind nach Nachname, Vorname sortiert (auch Arbeitseinsatz-Übersicht, Einzug, offene Posten). Fehlende Vor- und Nachnamen werden aus dem bekannten Namen übernommen. Beiträge mit Altersgrenze (z. B. „Jugendliche“ bis 18) lassen sich nur Mitgliedern im passenden Alter zuordnen; falsche Zuordnungen sind markiert.
- **Übersicht:** Lange Modulnamen brechen sauber mit Trennstrich um, nichts überlappt; Modulkarten zeigen ihr eigenes Symbol.
- **Deutsche Zahlenformate auf dem Server:** Beträge in Übersicht, E-Mails und PDFs erscheinen als „1.234,50 €“ statt „€1,234.50“ (fehlende Sprachdaten im Add-on ergänzt).

## 3.8.1
- **Untermenüs springen nicht mehr:** Die Einleitung unter der Überschrift ist auf allen Modulseiten gleich hoch (zwei Zeilen) – die Reiter stehen beim Wechseln immer an derselben Stelle. Längere Texte lassen sich mit „mehr“ aufklappen. Auf dem Handy bleibt die Überschrift einzeilig.
- **Schmale Bildschirme:** Auf Seiten mit wenig Inhalt erschien über der Seite ein leerer Streifen – behoben.
- **Arbeitseinsatz – Befreiung direkt in der Übersicht:** Je Mitglied „Pflichtstunden …“ mit der Wahl Automatisch / Eigenes Soll / Befreit (dauerhaft oder bis Datum, mit Grund) – auch für aktive Mitglieder. Befreite sind gekennzeichnet und haben einen eigenen Filter; geleistete Stunden zählen weiter, fehlende werden nicht berechnet.
- **Buchungssystem überarbeitet:** einheitliche Höhen in allen Leisten (40 px), Tabellen mit gleichem Rand wie in den anderen Modulen, ruhige Leiste im Belegungsplan (nichts verschiebt sich mehr, „Heute“ hält seinen Platz), einheitliche Beschriftungen und Auswahl-Chips in allen Dialogen, Farbpalette der Labels als gleichmäßiges Raster, auf dem Handy kompakte Karten statt verschobener Tabellenzeilen.

## 3.8.0
- **Buchungssystem – wer darf buchen:** Nur Mitglieder mit erlaubtem Status (Standard: aktiv und Ehrenmitglied) können buchen oder als Mitspieler eingetragen werden – passive/unterstützende nicht (einstellbar). Zusätzlich lassen sich einzelne Beitragsarten (z. B. „Fördermitglied“) ausschließen. Die App zeigt den Grund an; gesperrte Mitglieder erscheinen nicht in der Mitspielerauswahl.
- **Plätze einer Abteilung:** Ein Platz kann einer Abteilung gehören (z. B. Padel). Abteilungsmitglieder buchen kostenlos; andere zahlen eine Platzgebühr je Person (z. B. 5 €, als offener Posten beim buchenden Mitglied) – oder dürfen gar nicht buchen.
- **Preisvorschau:** Vor dem Buchen zeigt die App (und das Tablet) genau, was anfällt: Gastgebühr, Platzgebühr für Nicht-Abteilungsmitglieder, zusammen.
- **Gäste aus Partnervereinen:** Je Gast ein Haken „Mitglied in einem Partnerverein“ – der Gast wird erfasst, aber ohne Gastgebühr.
- **Labels** (wie bei OpenResa): Name und Farbe, z. B. Training, Medenspiel, Clubmeisterschaft. Einzelbuchungen (auch für Mitglieder, z. B. „Clubmeisterschaft – Lukas vs. Wendelin“), Vereinsbuchungen und Serien bekommen ein Label und erscheinen farbig im Belegungsplan, in der App und am Tablet. Eigene Seite „Labels“ mit Suche und Anzahl kommender Termine.
- **Wochenansicht** im Belegungsplan: ein Platz, sieben Tage nebeneinander – zusätzlich zur Tagesansicht mit allen Plätzen.
- **Rechte im Buchungssystem:** Belegung ansehen · für Mitglieder buchen (auch mit Label) · Buchungen anderer stornieren · Serien & Sperren · Plätze, Labels & Einstellungen – einzeln in Rollen vergebbar.
- **E-Mail an Mitspieler:** Bei jeder Buchung bekommen die eingetragenen Mitspieler eine kurze E-Mail (Platz, wann, wer gebucht hat, wer mitspielt) – ebenso beim Stornieren, mit Namen dessen, der storniert hat. Storniert die Verwaltung, werden Bucher und Mitspieler informiert.
- **In den Kalender:** Nach dem Buchen in der App „In den Kalender“ – legt den Termin (mit Ort und Erinnerung 1 Std. vorher) im Smartphone-Kalender an. Unter „Meine Buchungen“ hat jede Buchung dafür ein Kalender-Symbol.
- **Arbeitseinsatz – Befreiung:** Mitglieder lassen sich (dauerhaft oder befristet) vom Arbeitseinsatz befreien. Sie können weiter Stunden leisten, die erfasst werden, haben aber kein Soll – es wird nichts eingezogen.

## 3.7.1
- **Arbeitseinsatz – Ausstempeln mit Rückfrage:** Am Tablet kommt vor dem Ausstempeln eine Bestätigung mit Name, Einsatz und bisheriger Dauer (erst danach die PIN).
- **Unter 5 Minuten zählt nicht:** Wer nach weniger als 5 Minuten ausstempelt (z. B. versehentlich eingestempelt), bekommt nichts gutgeschrieben – der Eintrag wird verworfen, die Rückfrage weist vorher darauf hin. Auch beim Nachtragen und Melden in der App sind mindestens 5 Minuten nötig.

## 3.7.0
- **Neues Modul „Buchungssystem“** – Plätze und Geräte buchen, ähnlich wie OpenResa:
  - **Mitglieder-App (Bereich „Buchen“):** Tag wählen, freie Zeit antippen, Dauer, Mitspieler (aus der Mitgliederliste) und Gäste angeben, Platzordnung bestätigen. Eigene Buchungen mit Stornieren, Warteliste bei belegter Zeit (E-Mail, sobald frei).
  - **Regeln:** Buchungszeiten, Wochentage, Zeitraster und Höchstdauer je Platz; Vorlauf in Tagen; Kontingent offener Buchungen je Mitglied (Mitspieler zählen mit); niemand zweimal zur gleichen Zeit; Stornieren bis X vor Beginn. Gleichzeitige Buchungen derselben Zeit: nur eine gewinnt.
  - **Gäste:** Gastgebühr je Gast (je Platz oder Standard) wird als offener Posten beim buchenden Mitglied angelegt und mit dem nächsten Einzug abgerechnet; beim Stornieren entfällt sie.
  - **Geräte** (z. B. Ballmaschine, Leihschläger) mit Anzahl – so viele gleichzeitige Buchungen wie Stück vorhanden.
  - **Verwaltung:** Belegungsplan (Tag, alle Plätze nebeneinander, in eine freie Stelle klicken), Buchen für Mitglieder, Sperren mit automatischem Stornieren und E-Mail an Betroffene, Serien für Training und Mannschaften (belegte Tage werden ausgelassen, Vorschau vorab), Sperren über Zeiträume (z. B. Winterpause).
  - **Tablet im Vereinsheim (Reiter „Plätze“):** Tagesbelegung aller Plätze, buchen und stornieren mit Name und PIN.
- **Mitglieder-App von unterwegs (Cloudflare Tunnel):** Unter Mitglieder-App → „Von unterwegs erreichbar“ die öffentliche Adresse eintragen und einschalten; QR-Codes enthalten dann diese Adresse. Nur der Port der Mitglieder-App wird freigegeben – Verwaltung, Tablet und Beregnung lehnen Anfragen über den Tunnel grundsätzlich ab, auch bei falsch eingestelltem Tunnel. Sperren bei Fehlversuchen gelten je Absender (echte IP hinter dem Tunnel), „Verbindung prüfen“ testet den Weg von außen.

## 3.6.4
- **Thekendienst als dauerhafter Einsatz:** Einsätze können jetzt „dauerhaft“ sein – ganzjährig ohne festen Termin. Ein dauerhafter „Thekendienst“ ist schon angelegt. Solange er aktiv ist, steht er am Tablet beim Einstempeln zur Auswahl (neben den Einsätzen des Tages); deaktiviert verschwindet er. In der Verwaltung stehen dauerhafte Einsätze in einer eigenen Karte „Dauerhaft (ganzjährig)“, beim Stunden-Nachtragen sind sie wählbar. In der Mitglieder-App erscheinen sie nicht (kein Eintragen, keine Erinnerungen).

## 3.6.3
- **Arbeitseinsatz: Einsätze aktivieren und deaktivieren** – direkt in der Liste per Knopf oder im Bearbeiten-Dialog („aktiv“). Deaktivierte Einsätze bleiben erhalten (grau, Markierung „deaktiviert“), stehen aber nicht am Tablet und nicht in der Mitglieder-App, und es gehen keine Erinnerungen raus. Neue Einsätze lassen sich auch gleich deaktiviert anlegen, z. B. als Entwurf. Ersetzt das bisherige Häkchen „abgesagt“.

## 3.6.2
- **Reiter der Module fehlten manchmal (behoben):** Nach einer erneuten Anmeldung ohne Neuladen der Seite – typisch nach einem Update oder Neustart des Add-ons, weil dabei alle Sitzungen enden – erschienen die Reiter (z. B. Mitglieder · Beiträge · Einzug …) beim Wechsel zwischen Modulen nicht mehr, erst F5 half. Die Reiter werden jetzt nach jeder Anmeldung wieder zuverlässig gesetzt.
- **Schnelles Wechseln bei langsamer Verbindung:** Lädt eine Seite noch, während man schon weiterklickt, konnte die alte Seite die neue überschreiben. Die Verwaltung zeichnet in diesem Fall die aktuelle Seite neu.

## 3.6.1
- **Bankkonten zentral** unter Einstellungen → Bankkonten: beliebig viele Konten, eins ist das Standardkonto, jedes Konto lässt sich optional Abteilungen zuordnen. Die IBAN wird mit Prüfziffer geprüft. Verwalten dürfen Benutzer mit dem Recht Einstellungen, Buchhaltung oder Beiträge & Einzug.
  - **Buchhaltung:** Auf der Rechnung steht das Konto der Abteilung (Abteilung im Rechnungsdialog oder bei der Firma hinterlegt), sonst das Standardkonto; im Dialog änderbar. Jede Rechnung behält das Konto vom Rechnungstag, auch wenn es später geändert wird. Die eigenen Bankfelder der Buchhaltung entfallen.
  - **Mitgliederverwaltung:** „Konto für Lastschriften“ wird aus den zentralen Konten gewählt (Standard: Standardkonto). Das bisher dort eingetragene Vereinskonto wird beim Update automatisch als Standardkonto übernommen.
- **Arbeitseinsatz am Tablet:** Gibt es heute einen Einsatz, ist er gleich ausgewählt (bei mehreren antippen) – eine Beschreibung ist dann freiwillig und wird an den Einsatz angehängt.

## 3.6.0
- **Neues Modul „Buchhaltung“** (erste Ausbaustufe):
  - **Rechnungen** an Firmen/Sponsoren (z. B. Bandenwerbung, Trikotwerbung, Anzeigen) und an Mitglieder – fortlaufende Nummer je Jahr (R-2026-0001 …), Umsatzsteuer je Position (19 %, 7 %, ohne; Vorgabe einstellbar, Kleinunternehmer-Regel möglich), Status offen/bezahlt/storniert, Versand als PDF per E-Mail und Zahlungserinnerung für überfällige Rechnungen.
  - **Firmen & Sponsoren** einmal anlegen – mit Ansprechperson, Rechnungs-E-Mail und den jährlichen Positionen. „Jahresrechnungen“ erstellt (und verschickt) die Rechnungen aller Sponsoren eines Jahres in einem Schritt, jede Firma nur einmal pro Jahr.
  - **Rechnungen an Mitglieder** stehen zusätzlich als offener Posten in der Mitgliederverwaltung (Lastschrift oder Überweisung). Wird der Posten dort bezahlt oder storniert, übernimmt die Buchhaltung den Status.
  - **Spendenquittungen** (Zuwendungsbestätigung nach amtlichem Muster, eine Seite A4) für Mitglieder, Firmen oder einmalige Spender: Geldspende, Sachspende (mit Herkunft und Wertermittlung) und Verzicht auf Aufwandserstattung. Betrag in Worten, Angaben zum Freistellungs- bzw. Feststellungsbescheid aus den Einstellungen.
  - Übersicht zeigt offene Rechnungen, fehlende Jahresrechnungen und überfällige Rechnungen. Neues Recht „Buchhaltung“ für Rollen.

## 3.5.1
- **Lastschrift: „Zahlung erfolgt“ bucht der Kassierer selbst** – nach dem Einreichen stehen die Posten „im Einzug“. Erst wenn keine Rücklastschrift mehr kommt, unter „Offene Posten → Im Einzug“ alle (oder einzelne) markieren und „Zahlung erfolgt“ buchen; im Einzug gibt es dafür „Zahlung erfolgt (alle ohne Rücklastschrift)“. Die Übersicht erinnert zehn Tage nach dem Einzugstermin daran.

## 3.5.0
- **Ein- und Austritte von Abteilungsleitungen bestätigt die Vereinsverwaltung** (einstellbar, Standard an): neue Mitglieder, Austritte, Rückkehr und angenommene Beitrittserklärungen einer Abteilungsleitung landen unter „Anträge → Änderungen & Meldungen“ und gelten erst nach Bestätigung. Beitrittserklärungen werden von der Abteilungsleitung „befürwortet“, angenommen werden sie von einem Admin. Neue Mitglieder sind bis zur Bestätigung nicht am Tablet und nicht im Beitragslauf; abgelehnte Neuanlagen werden wieder entfernt. Die Vereinsverwaltung bekommt eine E-Mail (wenn „Neue Anträge melden an“ eingetragen ist).

## 3.4.1
- **Abteilungsadmins:** Übersicht zeigt nur noch die eigenen Mitglieder (Anzahl, Austritte, Eintritte) und nur Hinweise, die sie selbst erledigen können – keine Vereinszahlen, keine SEPA-/Bank- oder Beitragshinweise. Im Mitglied gibt es für sie keinen Knopf „+ Abteilung“ mehr.

## 3.4.0
- **Familie am Tablet:** Angehörige buchen standardmäßig über den Hauptzahler – sie stehen nicht mehr einzeln in der Namensliste, der Hauptzahler trägt die Markierung „Familie“. Gilt ab dem Update für alle, die unter einem Hauptzahler hängen (wer bisher „zahlt selbst“ eingestellt hatte, behält seinen Eintrag).
- Je Angehörigem einstellbar unter Mitglied → Zahlung & Familie → „Verkauf am Tablet“: über den Hauptzahler · eigener Eintrag, zahlt der Hauptzahler · eigener Eintrag, zahlt selbst.

## 3.3.4
- **Beitrittserklärung:** Werden mehrere Personen angemeldet, steht nur die Familienmitgliedschaft zur Auswahl (eine einzelne Person bekommt sie nicht angeboten). Kinder lassen sich nur bis 18 Jahre mit anmelden – gilt am Tablet, online und in der Verwaltung, der Server prüft es zusätzlich.

## 3.3.3
- **Tablet-Kopfzeile symmetrisch:** alle Reiter gleich breit (nach dem längsten Namen), Symbol und Text mittig, die Leiste steht genau in der Mitte – auch auf kleineren Tablets. Auf dem Handy brechen lange Namen in zwei Zeilen um statt abgeschnitten zu werden.

## 3.3.2
- **Verkauf: „Gebinde“ statt „Kiste“** – passt für Kisten, Kartons, Fässer oder Packungen (Artikel, Lieferungen, Bestand, Inventur, Bestellung, Excel-Import und -Export). Excel-Listen mit der alten Spalte „Kiste“ werden weiter erkannt.
- Beispiel „Patronen“ aus den Texten entfernt.

## 3.3.1
- **Erste Einrichtung kompakter:** je Modul nur noch eine kurze Zeile, Verkauf steht oben, Häkchen sauber ausgerichtet.

## 3.3.0
- **Rollen & Rechte neu:** Rollen bündeln Rechte – Vorlagen Vorstand, Kassenwart, Abteilungsleitung, Thekenteam und Kassenprüfer, frei anpassbar, eigene Rollen möglich. Ein Benutzer kann mehrere Rollen und zusätzlich Einzelrechte haben; Änderungen gelten sofort.
- **Abteilungsadmins:** Rollen „nur eigene Abteilung(en)“ – sie sehen nur die Mitglieder ihrer Abteilung, ändern Stammdaten, tragen Austritte ein, legen neue Mitglieder an (automatisch in ihrer Abteilung) und nehmen Anträge mit ihrer Abteilung an. Beiträge, Einzug, Bankdaten, Auswertungen, Import und Einstellungen bleiben der Vereinsverwaltung.
- **Benutzer aus der Mitgliederliste anlegen** oder manuell; der Benutzername ist immer erster Buchstabe Vorname + Nachname (ä → ae …).
- **Altersstufen-Hinweise:** Rutscht jemand in eine höhere Stufe, wächst ein Kind aus dem Familienbeitrag heraus oder steigt beim Zusatzbeitrag auf, entscheidet die Verwaltung „Umstellen“ oder „So belassen“ (gemerkt). Bis dahin läuft der bisherige Beitrag weiter.
- **Mitglieder-App:** Was Mitglieder sehen und ändern dürfen (Anschrift, Kontakt, Bankverbindung, Kündigung …), ist jetzt einstellbar.
- **Import mit Spaltenzuordnung:** S-Verein/SPG-Verein, WISO Mein Verein, verein.cloud oder eigene CSV-/Excel-Listen; Clubwerk erkennt das Format, die Zuordnung lässt sich anpassen und wird gemerkt.
- **PDFs neu gestaltet:** Beitrittserklärung (mit Vereinslogo), SEPA-Mandat, Rechnungen, Mahnungen und Briefe in klarem, modernem Layout mit Vereinsfarbe.
- **Austritt mit Dokument:** Kündigungsschreiben als PDF oder Foto gleich beim Austritt ablegen.
- **Reihenfolge am Tablet:** Die Module und Links in der Leiste oben lassen sich sortieren.
- Einstellungen der Mitgliederverwaltung in Bereiche aufgeteilt (Verein & SEPA, Beitrittserklärung, Mitglieder-App, Import & Datenschutz); Eingabefelder laufen auf dem Handy nicht mehr über den Rand.

## 3.2.1
- **Modul heißt „Mitgliederverwaltung“** (Menü, Übersicht, Hilfe).
- **Zusatzbeitrag ohne Geburtsdatum:** Fehlt das Geburtsdatum, gilt der Zusatzbeitrag für Erwachsene (Stufe ohne Höchstalter) – mit Hinweis im Mitglied und im Beitragslauf. Passt keine Altersstufe (z. B. nur „ab 19“ für einen 15-Jährigen), steht „beitragsfrei“ da; der Zeitraum wird vermerkt und ab dem passenden Alter wird automatisch abgerechnet.
- **Keine Nachberechnung alter Jahre:** Wird ein Zusatzbeitrag neu angelegt, jemand mit früherem Eintritt einer Abteilung zugeordnet, eine Befreiung aufgehoben oder ein Austritt zurückgenommen, rechnet Clubwerk ab dem laufenden Beitragsjahr – nicht rückwirkend.
- **Rückkehr nach Austritt** öffnet die Beiträge und Abteilungen wieder, die mit dem Austritt endeten.
- **Beitragslauf zurücknehmen:** Wird ein älterer Lauf nach einem neueren zurückgenommen, bleibt „abgerechnet bis“ beim Stand des neueren Laufs – nichts wird doppelt berechnet.
- **Familie:** Wer über einen Angehörigen als Zahler eingetragen wird, hängt automatisch am Hauptzahler (keine Ketten mehr; bestehende werden beim Start bereinigt).
- **Mitglieder-App „Meine Daten“** zeigt auch die Zusatzbeiträge der Abteilungen.
- **Import aus verein.cloud:** Beiträge einer Abteilung (neben dem Hauptverein) werden als Zusatzbeiträge übernommen, „gebucht bis“ inklusive.
- Beitragsarten, die schon in Gebrauch sind, lassen sich nicht mehr zwischen Hauptverein und Zusatzbeitrag umstellen. Bei Zusatzbeiträgen zählt die Spalte „Mitglieder“ je Altersstufe; Arbeitsstunden gibt es nur bei Hauptvereinsbeiträgen.
- Teilzahlungen behalten Rechnungsnummer, Mahnstufe und Beitragsbezug; Funktionsimport übernimmt nur bekannte Einstellungen.
- Handy: Werte mit Zusatzzeile (z. B. „jährlich / anteilig“) stehen in der Kartenansicht sauber rechtsbündig untereinander; lange Kartentitel brechen neben dem Knopf um.

## 3.2.0
- **„Getränke“ heißt jetzt „Verkauf“** – ein Verein verkauft mehr als Getränke (Speisen, Vereinsartikel, Bälle …). Tablet, Menü und Texte sind angepasst; Daten und Einstellungen bleiben unverändert.
- **Mitgliederverwaltung als eigenes Modul im Menü** mit den Reitern Mitglieder, **Beiträge** (Beitragslauf sowie Beitragsarten & Abteilungen), **Einzug & Zahlungen** (Lastschriften, offene Posten, Rechnungen & Mahnungen), Anträge, Auswertungen und Einstellungen. Offene Anträge stehen als Zahl am Menüeintrag und am Reiter.
- **Konten & PINs gehören zum Verkauf:** Mit aktiver Mitgliederverwaltung liegt die Kontenliste unter „Verkauf → Konten“.
- Der Menüpunkt „Mitglieder-App“ erscheint auch, wenn nur „Meine Daten“ oder „Dienste“ in der App aktiv sind.

## 3.1.2
- **Abteilungen auf der Beitrittserklärung:** Sind Zusatzbeiträge angelegt, kreuzt man auf dem Antrag (Tablet, online und in der Verwaltung) je Person an, in welcher Abteilung sie mitmacht – mit dem Zusatzbeitrag passend zum Alter. Das PDF und das leere Papierformular führen die Abteilungen mit; beim Annehmen werden die Personen den Abteilungen zugeordnet und die Zusatzbeiträge laufen automatisch.

## 3.1.1
- **Zusatzbeiträge der Abteilungen:** Zum Beitrag des Hauptvereins kommen je Abteilung eigene Beiträge dazu – mehrere je Abteilung nach Alter (z. B. Padel Erwachsene ab 19 Jahre, Padel Jugend bis 18). Sie gelten automatisch für jede Person, die der Abteilung angehört, und richten sich nach ihrem Alter. In einer Familie zahlt der Hauptzahler sie zusätzlich zum Familienbeitrag – aber nur für die Angehörigen, die in der Abteilung sind. Je Mitglied lässt sich ein fester Zusatzbeitrag wählen oder „befreit“ (z. B. Trainer).
- **Neue Option „Eintrittsjahr frei“** bei Beitragsarten: im Beitragsjahr des Eintritts wird nichts berechnet, ab dem nächsten Beitragsjahr der volle Beitrag. Der Beitragslauf vermerkt das freie Jahr als abgerechnet.

## 3.1.0 – Mitgliederverwaltung & Arbeitseinsatz
- **Neues Modul Mitgliederverwaltung:** Stammdaten mit Änderungsverlauf, Abteilungen, Beitragsarten (Altersgrenzen, Familienbeitrag, anteilig im Eintrittsjahr, Aufnahmegebühr), Familien mit Hauptzahler, Ein- und Austritt, Ehrungen und Ämter, Dokumentenablage, Datenauskunft und Anonymisieren.
- **Beitragslauf und SEPA-Lastschrift:** offene Posten nach „gebucht bis“, auf Wunsch mit den Getränken; Getränke jederzeit separat einziehen. SEPA-Datei im neuen Format pain.008.001.08 (Erst-/Folgelastschrift getrennt, Bankarbeitstage, Mandatsverfall), Vorabinformation per E-Mail oder Brief, Rücklastschriften, Teilzahlungen, Rechnungen und Mahnungen als PDF.
- **Digitale Beitrittserklärung** wie das Papierformular – vorbereitet in der Verwaltung und am Tablet mit Code unterschrieben, selbst am Tablet („Mitglied werden“) oder online. Familienmitgliedschaft, SEPA-Mandat mit Unterschrift, PDF mit Prüfwert, Willkommens-E-Mail mit Mitgliedsnummer und Mandatsreferenz.
- **Mitglieder-App „Meine Daten“:** Beiträge und Zahlungen ansehen, Kontaktdaten ändern, Einwilligungen widerrufen, neue Bankverbindung auf dem Handy unterschreiben, kündigen.
- **Auswertungen:** Bestandserhebung für den Landessportbund (Excel), Ein-/Austritte, Geburtstage und Jubiläen, Mitgliederliste mit wählbaren Spalten, Rundmail mit Platzhaltern.
- **Import aus verein.cloud** (CSV-Export) inklusive Abteilungen, Beiträgen, „gebucht bis“, Mandaten und abweichenden Zahlern.
- **Neues Modul Arbeitseinsatz & Thekendienst:** Soll je Mitglied (Vorgabe, Alter, Beitragsart, Ausnahmen), Familien gemeinsam, Einsätze mit Helferliste in der App („Dienste“), Stempeln am Tablet, Stunden melden und bestätigen, Erinnerungen per E-Mail; fehlende Stunden rechnet der Beitragslauf mit dem Stundensatz ab.
- Neue Rechte: Mitglieder, Bankdaten, Finanzen, Dokumente, Arbeitseinsatz. Dokumente der Mitglieder sind in der Komplettsicherung enthalten.

## 3.0.1
- **Verbindung zu Home Assistant repariert:** Das Startskript bekam vom Basis-Image (s6-overlay) die Umgebung ohne den Zugangsschlüssel (SUPERVISOR_TOKEN). Folge: „Keine Verbindung zu Home Assistant“ bei Zugang und Beregnung, und das Update per ZIP konnte Home Assistant nicht ansprechen. Das Protokoll des Add-ons zeigt beim Start jetzt, ob der Schlüssel da ist.
- **Sprachdateien fehlten im Add-on:** Englisch und die Sprachvorlagen wurden beim Bauen nicht mit ins Add-on kopiert.
- Verständlichere Meldungen, wenn Home Assistant nicht erreichbar ist oder den Zugriff verweigert.
- Tablet: Bei „Gerade oft hier“ steht wieder der Vorname unter dem Nachnamen.

## 3.0.0 – Clubwerk
- **Neuer Name: Clubwerk.** Neues Logo, neuer interner Name (`clubwerk`), neues Sicherungsformat `.cwbackup`. Sicherungen der Vorgängerversion (`.vhsicherung`) lassen sich weiter einspielen – so kommen alle Daten in die Neuinstallation (Anleitung: INSTALLATION.md, „Umstieg von Vereinsheim“).
- **Whitelabel:** Tablet, Mitglieder-App und Verwaltung zeigen Name, Logo und Farbe des Vereins; das Tablet-Symbol trägt den Vereinsnamen. Clubwerk selbst erscheint nur in Home Assistant.
- **Mehrsprachig:** komplette Oberfläche auf Deutsch und Englisch – Tablet, Verwaltung, Mitglieder-App, alle Module, Fehlermeldungen, E-Mails, Excel- und PDF-Dateien. Vereinssprache unter Einstellungen → Sprachen, eigene Sprache je Browser (Globus-Symbol), die Mitglieder-App folgt der Sprache des Handys.
- **Weitere Sprachen importieren:** Vorlage als JSON (für KI) oder Excel (für Übersetzer) herunterladen, übersetzen, importieren – auch in Teilen. Vorhandene Sprachen herunterladen und verbessern; auch deutsche Begriffe lassen sich anpassen (z. B. „Spieler“ statt „Mitglieder“). Platzhalter werden beim Import geprüft.
- Excel-Importe (Mitglieder, Artikel) erkennen Spaltenköpfe in allen Sprachen.
- Erweiterungen können eigene Sprachdateien mitbringen (`sprachen/`), im Server steht `ctx.T()` bereit.

## 2.16.3
- Update-Seite erklärt genau, warum das Hochladen noch nicht freigeschaltet ist, und zeigt die einmaligen Schritte (Add-on-Store → „Nach Updates suchen“ → „Aktualisieren“). Die falsche Meldung „kommt aus einem Add-on-Repository“ bei lokaler Installation ist behoben.

## 2.16.2
- Sauberes Beenden bei Neustart/Update: keine Fehlermeldung „The database connection is not open“ mehr im Protokoll.
- Sicherheit: Wird das Add-on beendet, während ein Türöffner (Impuls-Relais) gerade angesteuert ist, wird das Relais vorher sofort ausgeschaltet.

## 2.16.1
- Dropbox lässt sich wieder jederzeit mit App key und App secret verbinden bzw. neu verbinden: unter „Ziel hinzufügen“ (Art „Dropbox“), über „Dropbox neu verbinden …“ und bei Dropbox → „Bearbeiten“.
- Hinweise auf der Seite „Datensicherung“ brechen nicht mehr mitten im Satz um.

## 2.16.0
- **Update per ZIP-Upload** in der Verwaltung (Einstellungen → Update): Paket wird geprüft, vorher automatisch gesichert, der alte Stand bleibt als Reserve, Home Assistant baut die neue Version. Nur über die Seitenleiste, nur mit allen Rechten und Passwort. „Zurück auf …“ für die letzten zwei Versionen.
- Vorbereitet für die Installation über ein **GitHub-Repository** (Updates mit einem Klick in Home Assistant), mit Anleitung zum Umzug der Daten.
- Diese Änderungsliste.

## 2.15.0
- Buchungsseite packt die Kategorien wie beim Tetris auf einem festen Raster – kaum noch leere Flächen, dafür größere Kacheln.

## 2.14.2
- Artikelnamen auf der Buchungsseite und in der Auswahl immer vollständig lesbar (bis 3 Zeilen), Anordnung passt sich dem Tablet an, ohne Scrollen.

## 2.14.1
- Mitglieder-App auf dem iPhone: Freischaltung wird per Übernahme-Code in die Home-Bildschirm-App übernommen.

## 2.14.0
- **Sicherungsziele**: neben Dropbox auch WebDAV (Nextcloud, NAS, Storage Box), SFTP und FTPS (z. B. FRITZ!Box) – mehrere gleichzeitig, mit Fingerabdruck-Prüfung, Überwachung und Wiederherstellen von jedem Ziel.

## 2.13.0
- **Verschlüsselte Komplettsicherung** jede Nacht (alle Module, Belege, Bilder, Erweiterungen), Sicherungspasswort mit Notfallblatt, Aufbewahrung nach Generationen, monatliche Probe-Wiederherstellung, lesbare Excel-Auszüge je Modul.
- Getränke ist ein Modul wie alle anderen.

## 2.12.0
- Großes Sicherheits-Update: Einrichtungscode, geprüfte Erweiterungen, signierte Modul-Sicherungen ohne Geheimnisse, Schutz vor PIN-Raten am Tablet, Sperren je Konto, Schutz gegen fremde Webseiten (DNS-Rebinding) u. v. m.

## 2.11.0
- Buchungen behalten Artikelname und Kategorie vom Zeitpunkt des Buchens.

## 2.10.0
- IDs werden nie doppelt vergeben; beim Artikel-Import wird je vorhandenem Artikel gefragt.

## 2.9.1
- Buchungsseite im Design „V2“ (helle Kopfzeile, kompakte Kacheln ohne Scrollen).

## 2.8.0 / 2.9.0
- Neues Design für Tablet, Verwaltung und Mitglieder-App; neue Artikelsymbole.
