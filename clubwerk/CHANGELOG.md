# Änderungen

## 2026.11.39

### Neu
- Spieltage und eigene Dienste (Schichten) haben in der Mitglieder-App den Knopf „In den Kalender“, wie die Termine mit Zu- und Absage.

### Verbessert
- Die Tablet-Seiten Plätze, Licht, Stempeln und Dienste zeigen beim Zurückkehren sofort ihren letzten Stand, auch wenn der Server langsam antwortet – keine leere Seite mehr beim Wechsel. Wird das Tablet gesperrt, ist dieser Stand weg.
- Blätter am Tablet und in der Mitglieder-App (Beregnung, Licht, Türen, PIN, Profil u. a.) blenden weich ein und aus, wie die übrigen Fenster.
- Anleitung und Einrichtungsfenster für Google Drive nennen jetzt den Schritt „Branding“ (App-Name, Support-E-Mail, Startseite, Datenschutzerklärung, Entwickler-E-Mail), ohne den „App veröffentlichen“ gesperrt bleibt, und erklären, dass Clubwerk nur eigene Ordner sieht und einen vorhandenen Ordner gleichen Namens daneben neu anlegt.

## 2026.11.38

### Verbessert
- Änderungsprotokoll und Hinweise im Programm sind jetzt neutral formuliert, ohne Personennamen.

## 2026.11.37

**Anrede nur Frau und Herr, Fenster der Verwaltung ohne Flackern (Wünsche/Fehler 11.11.2026)**
- Anrede und Geschlecht kennen nur noch Frau/Herr bzw. männlich/weiblich. In der LSB-Auswertung entfällt die Spalte „divers“; frühere Einträge zählen dort als „ohne Angabe“.
- Fenster in der Verwaltung blenden weich ein und aus (wie am Tablet), statt die Seite beim Schließen schlagartig aufzuhellen.

**Verwendungszweck der Lastschrift einstellbar (Wunsch 11.11.2026)**
- Auf dem Kontoauszug steht jetzt „Mitgliedsbeitrag 2026: Erwachsene, Tennis - Mitgl.-Nr. 1041“ statt nur der Beitragsarten mit Zeitraum (der Punkt „·“ der Vorlage wird für die Bank zu „-“).
- Unter Beiträge & Zahlungen › Einstellungen › Lastschrift lässt sich der Text als Vorlage anpassen (Platzhalter {Jahr}, {Posten}, {Nr}, {Name}, {Verein}). Der Verkaufs-Einzug nennt weiter nur die Posten.

**Zuverlässigere Endprüfung („Wackler-Jagd“, Entscheidung 11.11.2026; `planung/wackler-jagd.md`)**
- Tablet und Seiten mit weichem Überblenden: Wurde ein Seitenwechsel abgebrochen, während die Seite überblendet (zum Beispiel kehrt das Tablet zum Start zurück, während gerade neu geladen wird), meldete der Browser einen Skriptfehler „Transition was skipped“. Zu sehen war nichts, aber die Fehlermeldung landete in der Konsole und ließ die Endprüfung zufällig rot werden. Der Fehler wird jetzt aufgefangen.
- Mitglieder-App, Tablet und Verwaltung: Lädt die Sprachdatei nicht (schwaches Netz, Vereins-Server gerade stark ausgelastet), bleiben die Texte deutsch – bisher konnten dann einzelne Bereiche der App gar nicht erscheinen (Skriptfehler „T is not defined“). Kann die Mitglieder-App eine Datei nicht vom Vereins-Server holen, steht das jetzt im Protokoll des Add-ons (vorher still). Ursachen: Die Mitglieder-App holte die Sprachdatei per Umweg über den Vereins-Server und gab nach 5 Sekunden auf – unter hoher Last (zum Beispiel kurz nach einem Neustart) kam das vor. Jetzt liefert die App sie direkt. Außerdem packte der Server die Sprachdatei nach jeder Sprachänderung und nach dem Start und blieb dabei kurz für alle Anfragen stehen (auf schnellen Rechnern eine Viertelsekunde, auf kleinen länger) – das läuft jetzt im Hintergrund.
- Anleitung Schlüssel: Das Bild zum Fenster „Rücknahme“ ließ sich nicht mehr erzeugen (bei Tablet-Breite steht der Knopf im Eintrag hinter dem Stift, seit 2026.11.32) – das Bild entsteht jetzt über den Stift. Schlüssel 1.0.4.
- Für Entwickler: Testreihen und Design-Prüfstand warten auf Zustände statt fester Pausen (Mail angekommen, Zone geschaltet, Durchlauf des Flutlicht-Abgleichs, Karte der Mitglieder-App entschieden, Prozess beendet …). Neue Kernprüfung `pausen` meldet jede neue feste Pause; begründete Fälle tragen `pause-ok: <Grund>`. Der Test-Mailserver legt Mails jetzt in einem Schritt ab (vorher konnte ein Test eine halb geschriebene Mail lesen). Die Mitglieder-App vermerkt ihre Kartenentscheidung unsichtbar am Dokument (`data-pushkarte`), Flutlicht zählt im Testbetrieb seine Abgleiche. Flutlicht 1.3.2.

**Profilbild bei der Platzbuchung am Tablet (Fehler 11.11.2026)**
- Im Fenster „Wer bist du?“ (Tablet › Plätze) erschien statt des Profilbilds ein kaputtes Bild-Symbol – der Pfad zum Bild stimmte seit den eigenen Tablet-Adressen (/plaetze/) nicht mehr. Behoben.
- Sehr lange Namen in Listen am Handy (z. B. bei „Offene Posten“) bekommen eine eigene Zeile, statt auf einen schmalen Rest gequetscht zu werden.
- Mitglieder-App › Dienste: die kleinen Profilbilder der Helfer stehen mit Abstand nebeneinander statt übereinander.
- Die Beispieldaten haben jetzt Profilbilder, und der Design-Prüfstand meldet jedes Bild, das nicht lädt (Regel „bild-kaputt“).

**Verwaltung am Tablet aufgeräumt (Fehler 11.11.2026: „Das sieht am Tablet total unaufgeräumt aus“; `planung/tablet-aufraeumen.md`)**
- Die Verwaltung im Tablet-Rahmen (Menüpunkt „Verwaltung“ am Tablet) zeigt Tabellen bis 1399 Pixel Breite als **Liste** – eine Karte je Eintrag, Name oben, die Angaben darunter –, nicht mehr als eng gedrängte Tabelle. Am Rechner (und am Tablet über 1400 Pixel) bleibt die Tabelle.
- **Mitgliederliste am Tablet:** Zeile 1 „Nachname, Vorname“ mit Hinweis-Schild („Altersstufe prüfen“, „Mandat widerrufen“) und Austrittsdatum daneben, Zeile 2 Nr., Alter, Abteilung, Beitrag und Zahlung. Alle Zeilen sind gleich hoch; „zahlt für 3“ und „zahlt über …“ machen sie nicht mehr höher.
- Der Vereinsname steht am Tablet nur noch einmal (in der Kopfzeile); die Vereinskarte oben in der Seitenleiste entfällt dort.
- **Filterleiste** (Mitglieder): die zwei Auswahlfelder „Alle Abteilungen“ und „Alle Beiträge“ bleiben zusammen und teilen sich die zweite Zeile zu gleichen Teilen, statt dass eines allein darunter steht; die Suche füllt die erste Zeile bis zum Rand.
- **Reiter und Knopfreihe** schließen rechts bündig ab: stehen die Knöpfe („Import …“, „Excel“, „+ Neues Mitglied“) unter den Reitern, füllt die Reiterleiste die ganze Zeile, die Reiter verteilen sich gleichmäßig.
- Am Handy und im Hochformat füllen Auswahlfelder ihre Zeile (zwei nebeneinander, ein einzelnes über die ganze Breite) statt halbbreit allein zu stehen – zuerst aufgefallen bei Plätze › Buchungen. Im Hochformat des Tablets steht oben nur noch der Menüknopf, ohne zweiten Vereinsnamen.
- **Leere Spalten** (z. B. „Abteilungen“, wenn niemand eine hat) werden samt Überschrift ausgeblendet – in allen Tabellen der Verwaltung. Spaltenüberschrift „Alter“ steht bündig über den Zahlen.
- **Kein Zoomen mehr am Tablet** (Wunsch 11.11.2026): Auf allen Tablet-Seiten – Verkauf, Plätze, Dienste, Stempeln, Zugang, Mängel, „Mitglied werden“ und so weiter – lässt sich nicht mehr mit zwei Fingern oder Doppeltippen vergrößern; am iPad ging das bisher trotz Sperre. Die Verwaltung (auch im Tablet-Rahmen), die Mitglieder-App und die Beregnungs-Webapp am eigenen Port lassen sich weiter vergrößern; die Beregnung am Tablet ist gesperrt. Zurück zum Tablet gilt wieder die normale Größe. Für Entwickler: Baustein `CWZoom` (theme-init.js), aufgerufen von `nav.js` und von Tablet › Beregnung; Testreihe `zoom` (liest alle Tablet-Module aus den Manifesten). Beregnung 1.16.4.
- Für Entwickler: `<html class="tabrahmen">` (theme-init.js) für die Verwaltung im Tablet-Rahmen; Baustein `.fb-sel` für zusammengehörige Auswahlfelder in Filterleisten. Der Design-Prüfstand prüft die Verwaltung jetzt auch im Tablet-Rahmen (alle Seiten, Reiter und Fenster) und hat vier neue Regeln: `filter-einzelgaenger`, `spalte-leer`, `vereinskarte-doppelt`, `reiter-knopfreihe-unbuendig`. Mitglieder 1.47.1, Buchung 1.32.2.

## 2026.11.36

**Dokumente als ZIP – je Mitglied und für die ganze Mitgliederliste (Entscheidungen 11.11.2026; `planung/dokumente-zip.md`)**
- Mitglied › Dokumente: Knopf **„Alle Dokumente als ZIP“** rechts über der Ablage. Er lädt alle Dokumente des Mitglieds auf einmal herunter, in einem Ordner „Nachname, Vorname“ und mit einer Übersicht als Excel. Das steht im Protokoll.
- Mitgliederliste: neuer Knopf **„Dokumente (ZIP) …“** neben „Excel“. Er nimmt genau die Mitglieder, die gerade in der Liste stehen (alle oder gefiltert nach Suche, Abteilung, Beitrag, Status). Im ZIP: ein Ordner je Mitglied „Nachname, Vorname“ (bei gleichen Namen mit Mitgliedsnummer), jede Datei mit Datum vorn, dazu „Übersicht.xlsx“ (Mitglied, Nr., Dokument, Art, Datum, Größe, Herkunft, Datei im ZIP). Das Fenster zeigt vorher Anzahl und Größe.
- Enthalten ist alles, was am Mitglied unter „Dokumente“ steht – auch Schlüsselprotokolle aus dem Modul Schlüssel (nur mit dem Recht „Schlüssel“).
- Schutz beim gesammelten Export: nur mit dem Recht „Dokumente“ und dem **eigenen Passwort**; Protokolleintrag mit Anzahl und Auswahl (keine Inhalte); alle mit dem Recht „Sicherheitswarnungen“ bekommen sofort eine Warnung „Dokumente gesammelt exportiert“. Höchstens 10 gesammelte Exporte je Stunde und Benutzer, höchstens 2 GB je ZIP. Der Download-Link gilt nur einmal, nur 2 Minuten und nur für den, der ihn angefordert hat.
- Abteilungsleitungen (Rolle „nur eigene Abteilung“ plus Recht „Dokumente“) bekommen nur Mitglieder ihrer Abteilung(en). Dabei behoben: Sie sahen die Dokumente eigener Mitglieder in der Liste, konnten sie aber nicht öffnen.
- Das ZIP entsteht Datei für Datei während des Herunterladens (wenig Speicher, auch bei vielen Dokumenten); bricht der Browser ab, hört Clubwerk sofort auf. Dateinamen werden bereinigt (keine Pfade, kein „..“, Umlaute bleiben); fehlt eine Datei, steht das in der Übersicht.
- Die Demo hat jetzt Beispiel-Dokumente bei mehreren Mitgliedern.
- Für Entwickler: Hook `memberDocuments` – Einträge können `read()` mitliefern (Inhalt als Buffer), dann landen sie im ZIP. Neue Testreihe `dokzip`. Mitglieder 1.47.0, Schlüssel 1.0.3.

## 2026.11.35

**Hinweis vor der Abmeldung am Tablet, eigene Seite „Keine Verbindung“ in der Mitglieder-App, rundes App-Symbol für Android (Leitfäden-Abgleich, Entscheidungen 11.11.2026; `planung/leitfaeden-2.md`)**
- Verwaltung am Tablet: 10 Sekunden vor der Abmeldung nach einer Minute ohne Eingabe erscheint ein Fenster „Du wirst gleich abgemeldet“ mit einem Countdown und dem Knopf **„Angemeldet bleiben“** (gibt wieder eine volle Minute). Jedes andere Antippen zählt genauso. Ohne Tippen wird wie bisher abgemeldet. Screenreader sagen das Fenster an, der Knopf hat gleich den Fokus.
- Verkauf am Tablet: dasselbe 10 Sekunden bevor ein angemeldetes Mitglied nach einer Minute ohne Eingabe zur Namensliste zurückgeht – mit Auswahl „Gleich wird abgebrochen … nichts wird gebucht“ und „Weiter auswählen“, ohne Auswahl „Du wirst gleich abgemeldet“.
- Tablet-Seiten der Module (z. B. „Mitglied werden“, Schlüssel, Mängel): Gehen nach 30 Sekunden ohne Eingabe Eingaben verloren (ausgefülltes Feld, Häkchen, Unterschrift), kommt 10 Sekunden vorher „Gleich geht es zurück zum Start“ mit **„Hier bleiben“**. Ohne Eingaben geht es wie bisher still zurück.
- Mitglieder-App: Ohne Netz (oder wenn der Vereins-Server nicht antwortet) erscheint statt der Fehlerseite des Browsers die eigene Seite **„Keine Verbindung“** mit „Erneut versuchen“, hell und dunkel, auf Deutsch und Englisch. Kommt das Netz zurück, lädt die App von selbst neu; antwortet der Verein noch nicht (etwa während eines Neustarts), fragt die Seite von selbst wieder nach (nach 3, 6, 12, 24 Sekunden, dann alle 30 Sekunden). Gespeichert wird dafür nur diese eine Hinweisseite mit ihren Schriften und Farben – keine Mitgliederdaten, keine Antworten des Servers, und die App selbst kommt immer frisch vom Verein.
- Mitglieder-App unter Android: Das App-Symbol gibt es jetzt zusätzlich in einer Fassung zum runden Zuschneiden („maskable“): Vereinsfarbe bis zum Rand, das Logo ganz im Kreis. Bisher schnitt Android die Ecken des weißen Logo-Rahmens ab. Erzeugt wird es wie das bisherige Symbol beim nächsten Öffnen der Verwaltung; iPhone und Rechner behalten ihr Symbol. Auch das Tablet-Manifest hat die runde Fassung.
- Für Entwickler: Baustein `CWZeit` (theme-init.js) für Hinweise vor einer Zeitgrenze; der Service Worker der App (`sw.js?v=<Version>`) wird jetzt für jedes Handy angemeldet, nicht erst beim Einschalten von Push. Neue Testreihen `zeithin` und `appoff`. Verkauf 3.101.6.

## 2026.11.34

**Seiten laden bei großen Vereinen schneller (Auftrag 10.11.2026)**
- Clubwerk fragt die Datenbank jetzt viel seltener: Über alle 271 Seiten und Listen von Verwaltung, Tablet und Mitglieder-App zusammen 10 700 statt 61 900 Abfragen (gemessen mit einem Musterverein mit 500 Mitgliedern und 7 Jahren Daten). Die Inhalte sind dieselben wie vorher.
- Besonders spürbar: Übersicht der Verwaltung 9 962 → 230 Abfragen (206 → 87 ms), Helferdienste › Übersicht 7 901 → 61 (103 → 47 ms), Plätze in der Mitglieder-App 4 625 → 49 (59 → 9 ms), Tablet › Plätze beim ersten Öffnen 4 575 → 40, Mitgliederliste 67 → 14 ms, Abrechnung 57 → 26 ms, Beitragsläufe 12 → 3 ms. Vorher wuchsen diese Zahlen mit jedem Mitglied – jetzt bleiben sie gleich, ob 50 oder 500 Mitglieder.
- Nach einigen Jahren wäre es sonst langsamer geworden: Platzbuchungen, Verkäufe, Forderungen und Helferstunden aus früheren Jahren werden nicht mehr bei jedem Öffnen ganz durchgelesen (z. B. „Gerade oft hier“ auf der Tablet-Startseite 23 → 1 ms). Dafür legt Clubwerk beim ersten Start ein paar Suchhilfen in der Datenbank an (dauert Sekundenbruchteile, auch bei bestehenden Installationen). Der Verkauf am Tablet bleibt dabei unverändert schnell.
- Einstellungen › Datenqualität und Buchführung: Die Prüfkette des Änderungsjournals (GoBD) rechnet Clubwerk jetzt nur noch ab dem zuletzt geprüften Eintrag nach statt jedes Mal alles – sonst wurde die Prüfung mit jedem Jahr langsamer (Entscheidung). Die ganze Kette prüft Clubwerk weiterhin einmal pro Woche, nach jedem Zurückspielen einer Sicherung und auf Knopfdruck: Einstellungen › Buchführung › **„Ganze Prüfkette prüfen“** (bisher „Jetzt nachrechnen“). Hat sich ein schon geprüfter Eintrag verändert, zeigt Clubwerk das sofort rot und schickt eine Sicherheitswarnung „Änderungsjournal (GoBD) unterbrochen“.
- Für Entwickler: Sammel-Hooks der Mitgliederverwaltung `memberInfos(ids)`, `familiesOf(ids)`, `memberAddresses(ids)` für Listen; Einstellungen liest eine Leseanfrage nur einmal je Schlüssel. Neues Werkzeug `werkzeuge/last/alle.js` misst jede GET-Adresse; die Testreihe `last` misst jetzt automatisch alle Adressen bei 50 und 500 Mitgliedern, wird rot, wenn eine Adresse mit der Mitgliederzahl wächst, und prüft die Abfragepläne auf ganze Tabellendurchläufe (Ausnahmen begründet in `werkzeuge/last/scan-erlaubt.txt`). Mitglieder 1.46.1, Helferdienste 2.16.3, Plätze 1.31.1, Spielbetrieb 1.24.5.

## 2026.11.33

**Plätze: Stornieren auch aus „Ändern“, „Kostenlos.“ bündig, Platzbuchung in „Für mich“ hervorgehoben (Fehler 10.11.2026)**
- Mitglieder-App › Plätze: Im Fenster „Buchung ändern“ gibt es ganz unten den Knopf „Buchung stornieren“ (rot). Er führt in dieselbe Sicherheitsabfrage wie bisher, mit denselben Regeln (Frist, Mitspieler stornieren für alle, Gebühr entfällt). Ist die Buchung nicht mehr stornierbar, erscheint der Knopf nicht.
- Verwaltung › Plätze: Auch im Fenster „Bearbeiten“ einer Buchung oder Sperre steht links unten „Stornieren“ bzw. „Sperre aufheben“, mit derselben Rückfrage wie in den Einzelheiten. Am Tablet gibt es kein „Ändern“; dort führt das Antippen einer Buchung ohnehin direkt zum Stornieren.
- Der Hinweis „Kostenlos.“ bzw. der Preis im Buchungsfenster stand eingerückt (er erbte von der Zeitenliste „rechtsbündig, schmal“); jetzt steht er bündig mit den Feldern. Der Design-Prüfstand hat dafür die neue Regel `text-eingerueckt`.
- Mitglieder-App › Plätze › „Buchung ändern“: Wer schon die höchste Zahl offener Buchungen erreicht hat (auch weil andere ihn als Mitspieler eingetragen haben), konnte seine eigene Buchung nicht mehr ändern („Du hast schon die höchste Zahl …“), und der Preishinweis blieb leer. Jetzt zählt nur, wer neu hinzukommt; neue Buchungen und neue Mitspieler am Höchstwert bleiben gesperrt.
- Mitglieder-App › Für mich › „Als Nächstes“: Eigene Platzbuchungen heben sich ab – die Datumskachel ist in der Vereinsfarbe gefüllt, die Zeile nennt „Platzbuchung“. Antippen öffnet die Buchung direkt mit „Ändern“ und „Stornieren“. (Module können Zeilen mit `accent` hervorheben.)

**Bilder laden erst, wenn man sie braucht (Mitglieder-App und Verwaltung)**
- Mitglieder-App: Profilfotos in langen Listen (Helferlisten mit Gesichtern, Mängelmelder, Profil) werden erst geladen, wenn sie beim Scrollen bis etwa eine Bildschirmhöhe an den sichtbaren Bereich herankommen. Unterwegs über das Handynetz spart das Daten und Wartezeit; in einer Liste mit 60 Fotos waren es beim Öffnen 9 statt 36 Bilder. Bis ein Bild da ist, steht ein ruhiger grauer Platzhalter in gleicher Größe, nichts springt.
- Verwaltung: Bilder in Listen (Artikel, Mängelliste, Helfer-Gesichter) laden ebenfalls erst beim Heranscrollen. Einzelbilder (Logo, Foto im offenen Fenster) laden wie bisher sofort, das Tablet lädt Artikelbilder weiter vorab.
- Zusage und Absage zu Terminen in der App reagieren sofort: Die Anzeige wechselt beim Tippen, nicht erst nach der Antwort des Vereins-Servers (gemessen im langsamen Handynetz: 372 ms → 28 ms). Klappt es nicht, springt sie zurück und eine Meldung erscheint.
- Neue Regel im Design-Prüfstand: Bilder in Listen ohne verzögertes Laden schlagen an.
**Leitfäden-Abgleich: Sicherheit, Barrierefreiheit, Ladezeit (Auftrag 10.11.2026, `planung/leitfaeden.md`)**
- Sicherheit: Auch die Mitglieder-App und die Beregnungs-Webapp senden jetzt die Kopfzeile, die fremden Fenstern den Zugriff auf Clubwerk-Seiten verwehrt (Cross-Origin-Opener-Policy) – bisher nur die Verwaltung. Die Cookies der Demo-Kopie gehen über HTTPS nur noch verschlüsselt. Ein neuer Test prüft die Sicherheits-Kopfzeilen auf allen drei Ports, auch auf Fehlerseiten.
- Barrierefreiheit (WCAG 2.2 AA, für Screenreader und Tastatur; Aussehen unverändert bis auf eine Farbe): Fenster der Verwaltung nehmen beim Öffnen den Fokus, die Seite dahinter ist solange für die Tab-Taste gesperrt, Escape schließt (wie ein Klick neben das Fenster) und danach steht der Fokus wieder auf dem Knopf, der es geöffnet hat. Fenster und Blätter in Tablet, Mitglieder-App und Modulen gelten für Screenreader als Dialog mit ihrer Überschrift als Namen. Kurzmeldungen („Gespeichert.“, Fehler) werden vorgelesen. Reiter werden als Reiter angesagt, mit dem gewählten. Überschriften springen nicht mehr von Ebene 1 auf 3. Die Anmeldeseite der Verwaltung hat einen Hauptbereich und liest Fehler sofort vor.
- Mitglieder-App: Die Beschriftung des gewählten Bereichs in der Leiste unten ist etwas dunkler (hell) bzw. heller (dunkel). Lag eine grüne Fläche unter der Glasleiste, war sie vorher nur mit 3,8 : 1 lesbar, jetzt mindestens 5,4 : 1.
- Ladezeit Verwaltung: Die Skripte der Module werden jetzt gleichzeitig geladen statt eins nach dem anderen und bleiben mit ihrer Versionsnummer im Browser gespeichert (bisher fragte jeder Aufruf alle neu nach). Lighthouse am Rechner 93 → 97 Punkte, am Handy erscheint die Seite rund 1,4 s früher.
- Tablet: Die Seiten der Module (Plätze, Dienste, Mängel …) laden die Schriften gleich mit der Seite. Vorher kam die Ziffernschrift manchmal erst später, und der Inhalt sprang beim Öffnen kurz nach unten.
- Sprachpaket: Die Texte für die Oberfläche (bei Englisch 1,2 MB) baut Clubwerk nur noch einmal je Sprache und hält sie fertig gepackt bereit – vorher bei jedem Seitenaufruf neu, was gerade auf kleinen Rechnern Zeit vor dem ersten Bild kostete. Englisch ist dabei ein Viertel kleiner (Brotli).
- Datenbank: Clubwerk lässt SQLite jetzt regelmäßig die Statistiken für schnelle Abfragen aktualisieren (`PRAGMA optimize` nach dem Start, stündlich und beim Beenden), wie es die SQLite-Dokumentation empfiehlt.
- Für Entwickler: Design-Prüfstand mit neuen Regeln `ueberschrift-sprung`, `reiter-rolle`, `meldung-live`, `fenster-rolle`; die Regel `kontrast` rechnet bei Glasleisten auch mit einer Fläche in Vereinsfarbe darunter. Gemeinsamer Baustein in `theme-init.js` (`CWA11y`).
- Für Entwickler: Lighthouse ist jetzt Teil der Endprüfung (`paket.sh` Stufe 6b, gleichzeitig zum Design-Prüfstand, rund 2 Minuten): Hauptseiten von Verwaltung, Tablet und Mitglieder-App am Handy (gedrosselt) und am Rechner mit festen Mindestwerten für Performance, Barrierefreiheit und Best Practices (`werkzeuge/lighthouse/`). Ausweg `CW_OHNE_LIGHTHOUSE=1`.

## 2026.11.32

**Geld und Daten sicher (Analyse Tests und technische Schulden, Auftrag 10.11.2026)**
- Familie und „zahlt für“: Platzgebühren, Gastgebühren, Lichtgeld und Rechnungen aus der Buchhaltung landen jetzt beim Zahler – wie Beiträge. Bisher standen sie beim Kind bzw. Angehörigen; dort gab es kein Mandat, der Einzug ließ sie liegen und eine Mahnung wäre ans Kind gegangen. Offene, noch nicht eingezogene Posten dieser Art hängt Clubwerk beim ersten Start einmal zum Zahler um.
- Plätze: Eine Gebühr, die schon eingezogen oder bezahlt ist, wird nicht mehr still als „storniert“ angezeigt. „Gebühr stornieren“ meldet dann, dass sie in den Mitgliedern zu stornieren ist (mit Guthaben oder Rücküberweisung). Eine solche Buchung lässt sich nicht mehr ändern (Gäste, Mitglied); Stornieren geht weiter, die Gebühr bleibt sichtbar stehen und das Protokoll vermerkt „Gebühr nicht storniert“.
- Posten stornieren, der schon bezahlt ist: Clubwerk fragt jetzt immer, was mit dem Geld passiert („als Guthaben behalten“ oder „zurücküberwiesen“) – auch bei Lastschrift, bar und Überweisung, nicht nur bei Zahlungen laut Kontoauszug (Entscheidung 10.11.2026).
- Mahnungen: Ein doppelter Klick auf „per E-Mail senden“ verschickt jede Mahnung nur einmal und bucht die Mahngebühr nur einmal. Wird ein Posten bezahlt, während die Mails noch rausgehen, geht an dieses Mitglied keine Mahnung mehr.
- Komplettsicherung aus einer neueren Clubwerk-Version: wird nicht mehr in eine ältere Version eingespielt („Bitte zuerst Clubwerk aktualisieren“) – wie schon bei der Teil-Wiederherstellung.
- Anonymisieren mit eingeschaltetem Tresor: Nach dem Zurückspielen einer Sicherung anonymisiert Clubwerk Ausgetretene erneut. Dabei ging bisher das Geburtsjahr (für die LSB-Statistik) verloren. Jetzt bleibt es erhalten und wird nach dem Entsperren auf das Jahr gekürzt.
- Home-Assistant-Backup: Lief nach einem Backup der Abschlussschritt nicht (z. B. Absturz von Home Assistant), hätte der nächste Neustart still auf den Stand des Backups zurückgesprungen. Das passiert nicht mehr, wenn die Datenbank deutlich neuer ist als der Schnappschuss.
- Flutlicht und Datenschutz (Entscheidung 10.11.2026): Einträge mit Lichtgeld sind Buchungsbelege und behalten den Namen 10 Jahre (Aufbewahrungspflicht) – so steht es jetzt auch in Einstellungen › Datenschutz. Einträge ohne Lichtgeld verlieren den Namen nach der Frist wirklich und kommen nicht mehr ins Änderungsjournal. Die Zahl „fällig“ stimmt wieder (zählte auch laufende Einträge).
- Updates: Ergänzen der Datenbank beim Start übergeht nur noch „Spalte gibt es schon“ still, alle anderen Fehler stehen im Protokoll; eine missglückte Änderung der Prüfregel wird zurückgenommen.
- Für Entwickler: neue Testreihen `anontresor` (Anonymisieren und Komplett-Wiederherstellung mit Tresor), `updapply` (Update einspielen und zurückrollen mit nachgebautem Supervisor), `migrate3` (Umstellung einer Datenbank aus 3.95.0 mit allen Modulen); Tests ergänzt in `bk`, `trainer`, `mv`, `backup`, `fl`. Hook `gobdTables` kennt `onlyIf` (nur Zeilen mit Geld ins Journal). Mitglieder 1.44.0, Plätze 1.30.0, Flutlicht 1.3.0.

**Mitglieder-App: Einladung per E-Mail bei gemeinsamer Adresse nur an ein Mitglied (Auftrag 10.11.2026)**
- Steht dieselbe E-Mail-Adresse bei mehreren Mitgliedern (z. B. Eltern und Kinder mit einem Postfach), geht die Einladung zur Mitglieder-App per E-Mail nur noch an **eines** von ihnen: das Familienoberhaupt, ohne Familie den Zahler, sonst den ältesten Erwachsenen. Groß-/Kleinschreibung und Leerzeichen spielen dabei keine Rolle. Vorher konnte, wer das Postfach liest, die App mit jedem dieser Links als jedes Mitglied freischalten.
- Alle anderen mit derselben Adresse schaltet ihr per QR-Code frei – am Bildschirm, am Tablet oder mit dem Einladungsbrief. Im Fenster „Einladen …“ ist „Per E-Mail schicken“ für sie ausgegraut, mit dem Hinweis „E-Mail-Adresse gehört zu Nachname, Vorname – bitte per QR-Code freischalten“. Beim Sammelversand stehen sie unter „übersprungen“ mit demselben Grund, in der Auswahl steht „E-Mail beim Oberhaupt“ (bzw. „E-Mail beim Zahler“ oder der Name).
- Die Regel gilt im Server, nicht nur in der Oberfläche. Bekommt ein Mitglied eine eigene Adresse, bekommt es die Einladung wieder selbst. Ohne Mitgliederverwaltung gibt es keine E-Mail-Adressen und damit keine E-Mail-Einladung – dort ändert sich nichts.
- Für Entwickler: neuer Hook `mailOwners()` der Mitgliederverwaltung (`{ id: { owner, ownerName, why } }`), Testreihe `invdup`. Mitglieder 1.45.0.

**Willkommens-E-Mail auch beim Anlegen von Hand, Text selbst festlegen (Auftrag 10.11.2026)**
- Mitglieder › „+ Neues Mitglied“: Unten vor „Anlegen“ gibt es das Häkchen **„Willkommens-E-Mail senden“**. Es ist vorbelegt, sobald eine E-Mail-Adresse eingetragen und ein Postfach eingerichtet ist; sonst ist es ausgegraut und sagt warum. Darunter **„Einladung zur Mitglieder-App mitsenden“** (vorbelegt aus): Der persönliche Link zum Freischalten steckt dann gleich in derselben Mail. Bisher ging eine Willkommens-E-Mail nur raus, wenn eine Beitrittserklärung angenommen wurde.
- Dasselbe bei „Partner/in neu anlegen“ und „Kind neu anlegen“. Hat das neue Familienmitglied keine eigene Adresse, geht die Willkommens-E-Mail an das Oberhaupt; die App-Einladung gibt es dann nur per QR-Code. Teilt es sich die Adresse mit anderen, gilt die Regel von oben – die App-Einladung ist dann ausgegraut („E-Mail-Adresse gehört zu … – bitte per QR-Code freischalten“).
- Am Mitglied (Stammdaten) zeigt die neue Karte **„Willkommens-E-Mail“**, wann sie zuletzt gesendet wurde und wohin sie geht; „Willkommens-E-Mail senden …“ fragt nach und bietet die App-Einladung an. Jeder Versand steht im Verlauf des Mitglieds und im Protokoll.
- Mitglieder › Einstellungen › **„Willkommens-E-Mail“**: Betreff und Text frei festlegen, Platzhalter per Klick einfügen ({Vorname}, {Nachname}, {Mitgliedsnummer}, {Verein}, {Eintritt}, {Beitrag}), „Vorschau …“ mit Beispielwerten, „Standardtext wiederherstellen …“ (der bisherige Text). Unbekannte Platzhalter meldet Clubwerk vor dem Speichern, leerer Betreff oder Text geht nicht. Bei Lastschrift hängt Clubwerk Mandatsreferenz und Gläubiger-ID immer selbst an (nicht änderbar), die hochgeladene Beitrittserklärung kommt als PDF in den Anhang. Der eigene Text des Vereins wird nicht übersetzt; der Standardtext und die festen Teile kommen in der Vereinssprache.
- Für Entwickler: ein Weg für alle Willkommens-E-Mails (`erweiterungen/mitglieder/lib/willkommen.js`), neu `ctx.appInvite` (`state(id)`, `create(id, user)`) für eine App-Einladung in einer Modul-Mail. Testreihe `mvu` erweitert; `werkzeuge/tests/run.sh` erkennt jetzt auch abgebrochene Reihen, deren Stacktrace auf „{“ endet (Playwright-Zeitüberschreitung).

**Anleitung „Mitglieder-App einrichten“ als PDF aus Clubwerk (Auftrag 10.11.2026)**
- Mitglieder-App › Mitglieder › Karte **„Anleitung für Mitglieder“**: Der Knopf „Anleitung für Mitglieder (PDF)“ lädt eine zweiseitige Anleitung auf Deutsch oder Englisch herunter – Einladung am Handy öffnen, PIN festlegen, App auf iPhone und Android auf den Startbildschirm legen, Code einfügen, Tipps. Aufbau wie die freigegebene Vorlage, mit Bildern der echten App.
- Eingesetzt werden euer Vereinsname, eure Vereinsfarbe und euer Logo, die eingestellten Gültigkeiten von E-Mail-Einladung und QR-Code, im WLAN-Tipp nur eure Bereiche, die nur im Vereins-WLAN gehen (ohne solche fällt der Tipp weg), der Tipp zu Benachrichtigungen nur, wenn Anlässe freigegeben sind, und der SMS-Code nur mit SMS-Bestätigung. Beschriftungen wie „Code kopieren“ oder „Übernahme-Code eingeben“ stehen genau so in der App.
- Mitschicken: Beim Einladen per E-Mail (einzeln und im Sammelversand) gibt es das Häkchen „E-Mail: Anleitung als PDF anhängen“ (vorbelegt an), beim Einladungsbrief „Brief: Anleitung mitdrucken“ – dann entsteht ein PDF mit jedem Brief samt Anleitung dahinter. Die Willkommens-E-Mail mit App-Einladung hat das Häkchen „Anleitung als PDF anhängen“. Das PDF wird je Sprache einmal gebaut und wiederverwendet, nicht je Mitglied neu.
- Für Entwickler: `src/appanleitung.js` (pdfkit, Schriften im Paket unter `anleitungen/app/schriften/`), Bilder `anleitungen/app/<sprache>-<bild>.jpg` aus der Demo per `werkzeuge/anleitungen/app-bilder.js` (iPhone mit WebKit, Android mit Chromium, nur Ausschnitte ohne Vereinsname; läuft in `paket.sh` Stufe 5c und baut nur bei Änderungen neu), `ctx.appInvite.guide()`, Testreihe `appanl`.
- Nebenbei: In der englischen Übersicht steht der Hinweis zu dringenden Mängelmeldungen jetzt ganz auf Englisch („2 urgent fault reports are open.“) statt halb deutsch. Mängel 1.11.4.

**Klarer, barrierefreier, einheitlicher: Ergebnis des Designer-Blicks (Auftrag 10.11.2026, alle 15 Punkte aus `planung/ui-review.md`; Erscheinungsbild unverändert)**
- Übersicht: Jede Kachel sagt jetzt, was ihre Zahl bedeutet („4 Plätze“, „7 heute“, „4 offen“, „3 Türen“, „9 ausgegeben“) – die Einheit steht klein hinter der Zahl. Statt nur „Hinweis“ steht der Grund im Klartext („2 dringende Mängelmeldungen sind offen“, bei mehreren „(+1 weitere)“). Buchhaltung zeigt nur den Betrag, die Anzahl steht darunter („1 Rechnung überfällig …“).
- Übersicht › „Zu erledigen“: „6 von 21 Aufgaben“ statt „6 von 21“. Die Reihenfolge richtet sich nach Dringlichkeit – erst Störungen, dann fehlende Datensicherung, dann Sicherheit und Datenschutz, dann Hinweise. Hinweise desselben Bereichs stehen zusammen unter einer Überschrift (vorher stand „Sicherheit“ zweimal untereinander).
- Fehler behoben: In Mitglied › Stammdaten klebte bei „Schlüssel“ der Hinweistext direkt an der Beschriftung. Jetzt stehen beide untereinander wie bei den anderen Feldern.
- Tastatur und Screenreader: Mit der Tab-Taste erscheint als Erstes „Zum Inhalt springen“ (nur bei Fokus sichtbar), und jede Verwaltungsseite hat eine Hauptüberschrift. Die Zähler im Menü werden als „Mitglieder, 5 offen“ vorgelesen, null wird nicht mehr vorgelesen. Das Suchfeld der Seitenleiste hat beim Fokus einen sichtbaren Rahmen.
- Pflichtfelder sind überall gleich gekennzeichnet: „Vereinsname (Pflicht)“, im Fenster „Neues Mitglied“ Name, Geburtsdatum, Anschrift, E-Mail, Handy, Beitrag und Beitrittserklärung. Die Einleitung im Fenster ist auf zwei Sätze gekürzt. Neue Felder brauchen dafür nur das Attribut `required`.
- Einheitliche Begriffe: überall „Handy“ und „Telefon (Festnetz)“ (Stammdaten, Liste, Fenster, Excel-Export, App, Online-Antrag). Das Beitrittsformular-Einlesen aus Tabellen erkennt weiterhin auch „Mobil“.
- Einstellungen › Verein: Die selten genutzte Karte „Seitenleiste“ ist eingeklappt (Pfeil), die Seite ist dadurch kurz. Die Farbvorschau heißt „Vorschau · Hell/Dunkel“ und zeigt nur Farbfelder – keine Knöpfe „Speichern“ und „70,00 €“, die wie echte Bedienelemente aussahen.
- Reiterleisten, die überlaufen, haben am Rechner kleine Pfeile an der Kante (Maus); am Handy und Tablet wischt man weiter.
- Mitglieder-App › Plätze (kompakt): Im Plan stehen nur Kürzel („DG · SH“) und Zeit, nie mehr „Me-denspiel“ oder abgeschnittene Namen; die ganzen Namen zeigt das Antippen bzw. „Ausführlich“.
- Mitglieder-App › Für mich: Die Installationskarte zeigt nur den ersten Schritt groß; die weiteren sind eine Zeile mit „Wie?“, die Erklärung klappt im selben Blatt auf.
- Tablet: Alle Kleinschrift ist jetzt mindestens 13 px (Abschnittsüberschriften wie „GÄSTE-DECKEL“, Artikelnamen in dichten Raster-Stufen, Vorname auf den Hauptkarten 15 px).
- Mitglieder › Liste: „zahlt über Weber, Markus“ und „zahlt für 3“ statt „über …“ und „+3“. Das Banner „1 Mitglied ohne Pflichtangaben“ nennt die Namen. In der Karte erklärt jedes gelbe Kennzeichen („Altersstufe prüfen“, „Mandat widerrufen“, „Geburtsdatum fehlt“ …), was gemeint ist und was zu tun ist.
- Fenster „Einladen …“: Die Wege haben einen Pfeil und sehen nach Knöpfen aus; ist „Per E-Mail“ ausgegraut, führt der Link „Postfach einrichten …“ direkt in die Einstellungen.
- Entfernen-Symbole (Papierkorb) sind überall in Gefahrenfarbe, nicht erst beim Darüberfahren; die Spalte in „Freigeschaltete Mitglieder“ heißt „Rechte · Einladen · Entfernen“.
- Am Handy kleben Speichern-Knöpfe langer Formulare unten am Rand, solange die Karte zu sehen ist (z. B. Mitglied › Stammdaten); am Seitenende stehen sie an ihrem Platz und verdecken nichts.
- Für Entwickler: neue Bausteine `markRequired` (Feld mit `required` → „(Pflicht)“), `markSave`, `.sr-only`, `.skip`, `.card.fold`; Module können in der Kachel-Hook-Ausgabe `kpis[].note` als fertigen Satz mitgeben. Neue Prüfstand-Regeln: `label-klebt`, `h1-fehlt`, `skip-link-fehlt`, `knopf-name-zaehler`, `pflicht-unmarkiert`, `symbolknopf-papierkorb-farbe`, `kleinschrift-tablet`, `silbentrennung-titel`, `reiter-abgeschnitten-ohne-pfeil`. Module: Mitglieder, Plätze, Beregnung, Zugang, Flutlicht, Mängel, Zeiterfassung, Spielbetrieb, Turniere, Schlüssel, Buchhaltung und Verkauf bekommen eine neue Modulversion.

**Tabellen bei Tablet-Breite als Liste, keine verschachtelten Scrollbereiche (Auftrag 10.11.2026)**
- Verwaltung am Tablet (Fensterbreite 701–1279 px, z. B. iPad quer): Tabellen, die in dieser Breite nicht mehr in eine Zeile passen, stehen jetzt als Liste untereinander – Name fett oben, darunter die Angaben, Knöpfe rechts oben. Vorher brachen Werte ungleich um („bis / einschl. 17“, „Möller, / Paula“, „Tennis / Erwachsene“). Betrifft Mitglieder › Beiträge & Abteilungen (Beiträge Hauptverein, Zusatzbeiträge, Abteilungen, Altersstufen) und alle weiteren Tabellen im Listenformat (Mitgliederliste, Offene Posten, Protokoll, Lager, Stunden u. a.). Ab 1280 px bleiben es Tabellen wie bisher, am Handy ändert sich nichts.
- Keine eigenen Scrollbereiche mehr auf der Seite: Listen wie Lager › Artikel, Bestand, Lieferungen, Beitragslauf oder Einzug stehen in voller Länge, das Mausrad scrollt über jeder Fläche die Seite. Die Kopfzeile der Tabelle klebt am oberen Rand. In Fenstern (z. B. Import-Vorschau) scrollen lange Listen weiter im Fenster.
- Listen am Tablet erklären ihre Zahlen: In der Listenform steht vor einer reinen Zahl (oder einem Datum ohne weiteren Text) jetzt ihre Spaltenüberschrift als kleine graue Beschriftung – „Gebinde 24“, „Mindest 0“, „fällig 14.11.2026“. Vorher stand in Lager › Artikel nur „Bier 1,50 € 24 Bestand: 166 0 aktiv“. Betrag mit €, Schilder und Namen bleiben ohne Beschriftung; am Handy ändert sich dafür nichts (dort gelten schmale Zeilen).
- Die Tablet-Liste zeigt mehr als die Handy-Liste: Spalten, die am Handy wegfallen (z. B. Rhythmus, Art, Arbeitsstunden), erscheinen mit ihrer Überschrift. Bestehende Beschriftungen wie „Bestand“ oder „Mitglieder“ sind dabei gleich klein und grau.
- Mitglieder › Beiträge & Abteilungen › Altersstufen: In der Liste steht jetzt „bisher … → neu …“ samt Datum („ab“) – vorher fehlte die wichtigste Angabe für die Entscheidung, der bisherige Beitrag.
- App › Plätze › Freie Zeiten: Hat eine Zeile ein Kästchen mit langem Namen („Ballmaschine Lobster Elite“), stehen die Kästchen der Zeile untereinander und gleich breit – vorher verteilten sie sich verschieden breit auf zwei Zeilen. Plätze 1.29.1.
- Für Entwickler: `.tbl.kompakt` bildet jetzt auch bei 701–1279 px die Listenform (Kopie der Handy-Regeln in `admin.html`, mit `k-tabelle` am `<table>` bleibt eine Tabelle Tabelle); `.scroll` ist `overflow: clip` ohne `max-height`, nur in `#overlay` scrollt es. Neue Prüfstand-Regeln `zelle-umbruch` (kurzer Wert in einer Tabellenzelle bricht um) und `scroll-verschachtelt` (senkrechter Scrollbereich außerhalb von Fenstern), Prüfung `kompakt-kopie`. Mitglieder 1.44.0, Turniere 1.11.5 (Gruppenkarten mind. 400 px breit), Dienste & Termine 2.16.1, Verkauf 3.101.5.

**Datumsfehler zwischen 0 und 2 Uhr nachts behoben (Tests stabil, Auftrag 10.11.2026)**
- Zwischen 0 und 2 Uhr nachts rechneten einige Stellen noch mit dem Vortag: die Zählung abgelehnter Türöffnungen am Tag (Zugang), die Vorbelegung beim Anlegen eines Sperrzeitraums (Zugang), die Vorauswahl des heutigen Turniertags (Turniere), der Beitragsvorschlag im Online-Antrag, das Datum auf der Dienste-Kachel am Tablet und der „Stand“ in der Datenüberlassung für den Steuerberater. Jetzt gilt überall der heutige Tag.
- E-Mails in der Mitglieder-App laufen am Monatsende richtig ab (Aufbewahrung ab 31.08. um 6 Monate endete bisher am 03.03. statt am 28.02.).
- Kontoauszug: Eine unmögliche Datumsangabe (z. B. 31.13.2026 oder 30.02.2026) wird übersprungen, statt als Buchungstag gespeichert zu werden.
- Für Entwickler: gemeinsame Test-Uhr (`src/testuhr.js`, `util.jetzt()`), neue Einzeltest-Reihe `rechnen` (Beitragsberechnung, Altersstufen, SEPA, Kontoauszug, Mahnplan, Geschäftsjahr; unter einer Sekunde), Warten auf Zustände statt fester Pausen in den Testreihen. Mitglieder 1.43.1, Zugang 1.13.1, Turniere 1.11.5, Flutlicht 1.2.3, Dienste & Termine 2.16.1.

## 2026.11.31

**Geschäftsjahr: Kündigung zum Ende des Geschäftsjahres, Jahresauswertungen nach Geschäftsjahr (Auftrag 09.11.2026)**
- Neu: Das Geschäftsjahr ist eine eigene Einstellung für den ganzen Verein – unabhängig vom Beitragsjahr. Beispiel: Beiträge laufen von Mai bis April, das Geschäftsjahr ist das Kalenderjahr. Einstellen lässt es sich unter Mitglieder › Einstellungen › Mitgliedschaft („Geschäftsjahr beginnt am 1.“ direkt neben „Beitragsjahr beginnt am 1.“) und unter Einstellungen › Buchführung – beides ist dasselbe Feld. Wer bisher dort ein anderes „Wirtschaftsjahr“ eingestellt hatte, behält es; es gilt jetzt als Geschäftsjahr.
- Kündigung: Der früheste Austritt ist jetzt das Ende des Geschäftsjahres unter Einhaltung der Kündigungsfrist – bisher war es fälschlich das Ende des Beitragsjahres. Mit Frist 0 und Geschäftsjahr = Kalenderjahr heißt das: Kündigung bis 31.12. → Austritt zum 31.12. Das gilt gleich in der Mitglieder-App („Mitgliedschaft kündigen“), in der Eingangsbestätigung per E-Mail und im Fenster „Kündigung bestätigen“.
- Austritt in der Verwaltung: „Austritt zum“ ist jetzt vorausgefüllt mit dem frühesten Termin nach Kündigungsfrist und Geschäftsjahr und passt sich an, wenn man „Kündigung eingegangen am“ ändert (bis man das Datum selbst ändert). Bisher stand dort das Ende des Beitragsjahres ohne Frist. Beiträge bleiben wie bisher: Ein angefangenes Beitragsjahr wird voll berechnet (Entscheidung).
- Jahresauswertungen nach Geschäftsjahr: Verkauf › Auswertung (Jahreswahl „Geschäftsjahr 2026/27“, Monate und Kalender ab dem ersten Monat des Geschäftsjahres, Vergleich mit dem vorigen Geschäftsjahr), Beiträge & Zahlungen („eingegangen …“), Platzgebühren, Rechnungen („Bezahlt …“ zählt jetzt nach Zahltag, Jahresfilter), DATEV und die Datenüberlassung für die Betriebsprüfung. Arbeitseinsatz bekommt als Abrechnungsjahr zusätzlich „wie das Geschäftsjahr des Vereins“. Verkauf: der Knopf „Ganze Saison“ heißt jetzt „Geschäftsjahr“ und beginnt am Anfang des Geschäftsjahres. Solange das Geschäftsjahr am 1. Januar beginnt, bleibt alles wie bisher.
- Bewusst beim Kalenderjahr bleiben: Spendenquittungen, Nummernkreise (Rechnungen, Spenden, Schlüsselprotokolle), Jahresrechnungen für Sponsoren, LSB-Bestandserhebung und Ein-/Austritte je Jahr, Gratulationen, Platz-Auslastung, Flutlicht-Betriebsstunden, Spieltage und Turniere.
- Für Entwickler: neuer Baustein `src/geschaeftsjahr.js` bzw. `ctx.geschaeftsjahr` (`range`, `yearOf`, `label`, `exitDate` …), Testreihe `gj`. Dienste & Termine 2.16.0, Buchhaltung 1.14.0, Plätze 1.29.0, Mitglieder 1.43.0 (zusammen mit den Änderungen unten).

**Mitgliederliste mit Karte: Mausrad überall, bündige Unterkanten, keine eigenen Scrollbalken (Fehler 09.11.2026)**
- Mitglieder › Mitglieder: Stand die Maus auf der Karte rechts oder daneben, ließ sich nicht scrollen – die Liste hatte einen eigenen Scrollbereich, und die Karte hielt das Mausrad fest. Jetzt scrollt die ganze Seite, egal wo die Maus steht. Die Kopfzeile der Liste und die Karte bleiben dabei oben stehen.
- Liste und Karte enden unten immer auf gleicher Höhe – bei langen Listen, bei einem Treffer und ohne Treffer. Die rechte Spalte reicht als Rahmen bis zum Ende der Liste, der Inhalt der Karte bleibt oben stehen.
- Bei niedrigem Fenster hat die Karte keinen eigenen Scrollbalken mehr: Ist sie höher als das Fenster, scrollt sie mit der Seite, bis ihr Ende zu sehen ist.
- Hinweise wieder in der Liste: Seit 2026.11.30 fehlten neben der Karte die Hinweis-Schilder (z. B. „Altersstufe prüfen“) und die Spalte „Zahlung“. Jetzt steht jedes Schild unter dem Namen – bei jeder Bildschirmbreite, mit und ohne Karte, auch am Handy. Alle Spalten sind wieder da. In der Karte stehen die Hinweise oben unter dem Namen statt ganz unten.
- Nach Suche oder Filter zeigt die Karte kein Mitglied mehr, das gar nicht in der Liste steht – dann steht dort „Mitglied auswählen“.
- Die Karte neben der Liste erscheint jetzt ab 1500 Pixel Breite (vorher 1400): Darunter passen nicht alle Spalten einzeilig daneben, dann bleibt die Liste in voller Breite wie früher.
- Dasselbe in Verkauf › Konten (gleicher Aufbau mit Liste und Karte).
- Für Entwickler: Testreihe `mausrad` (echtes Mausrad über Liste, Karte, Lücke und Rand, Chromium und WebKit) und zwei neue Prüfstand-Regeln: `mausrad-sperrt` (über jeder klebenden Fläche, der Mitte und dem Rand bewegt das Mausrad etwas, solange die Seite scrollen kann) und `liste-scrollt-innen` (weder Liste noch Karte scrollen in sich); `d3-kartenhoehe` prüft jetzt alle Rahmen nebeneinander, nicht nur bekannte Kartenklassen. Neuer Baustein `GK.klebend` (ERWEITERUNGEN.md).

**Mitglied von einem anderen Mitglied übernehmen, Angehörige in der Familie neu anlegen, Umzug (Auftrag 09.11.2026)**
- Mitglieder: Neues Mitglied, Stammdaten und „Beitrittserklärung erfassen“ haben den Knopf **„Von Mitglied übernehmen …“**. Man sucht ein Mitglied (Anzeige „Nachname, Vorname“) und setzt Haken, was ins Formular soll: Anschrift, Nachname und Telefon Festnetz sind vorgewählt, E-Mail und Mobil nicht. „Übernehmen“ füllt nur das Formular – gespeichert wird erst mit „Anlegen“ bzw. „Speichern“. **Bankdaten werden nie übernommen.** Stattdessen gibt es im selben Fenster die Wahl „Zur Familie von … hinzufügen“ oder „Zahlt über …“; dann braucht das neue Mitglied weder eigenen Beitrag noch eigenes Konto. Die Familienregeln gelten wie bisher (ein Oberhaupt, höchstens ein weiterer Erwachsener, Kinder bis 18) und werden auch beim Anlegen geprüft; ein Kind über 18 und eine zweite Partnerin melden sich mit klarem Hinweis. Kinder brauchen keine E-Mail und kein Handy.
- Mitglieder › Zahlung & Familie: In der Karte „Familienmitgliedschaft“ gibt es neben „Hinzufügen“ die Knöpfe **„Partner/in neu anlegen“** und **„Kind neu anlegen“**. Das Formular „Neues Mitglied“ ist vorbelegt mit Anschrift, Nachname und Festnetz des Oberhaupts, der Familie und der Zahlung über das Oberhaupt. Gibt es schon eine/n Partner/in, ist „Partner/in neu anlegen“ gesperrt (mit Begründung).
- Mitglieder › Stammdaten: Neues Feld „Telefon Festnetz“ im Formular „Neues Mitglied“. **Umzug:** Ändert man die Anschrift und wohnen andere aktive Mitglieder unter der bisherigen, fragt Clubwerk beim Speichern „Unter derselben Anschrift wohnen auch: … Dort ebenfalls ändern?“ – mit einem Haken je Person. Ohne Bestätigung ändert sich niemand anderes; jede Änderung steht im Verlauf der Person und im Protokoll („Straße: … → …“).
- Familien- und Zahleranzeigen der Mitgliederverwaltung (Familienkarte, Zahlergruppe, Hinweise, Liste) zeigen die Namen jetzt als „Nachname, Vorname“.
- Beispieldaten: Die Mitglieder der Beispielfamilien Hofmann und Weber wohnen unter derselben Anschrift wie ihr Oberhaupt (zum Ausprobieren des Umzugs); die Oberhäupter haben eine Festnetznummer.
- Für Entwickler: neue Testreihe `mvu` (Familienregeln beim Anlegen, Umzug nur bei gleicher Anschrift und nach Bestätigung, Protokoll, Oberfläche).
- Familienkarte: „Partner/in neu anlegen“ und „Kind neu anlegen“ stehen in zwei gleichen Hälften bündig unter „Hinzufügen“; am Handy haben alle Knöpfe (auch „Mahnsperre …“, die Mandat-Knöpfe unter „Konto & Mandat“ und „Bestellung jetzt senden …“ in Lager) die volle Breite und gleiche Höhe. Die Zahlergruppe ist nach „Nachname, Vorname“ sortiert, die Familie nach Rolle (Oberhaupt, Partner/in, Kinder älteste zuerst).
- Mitglieder-App › Meine Daten: Familie, Zahler und Oberhaupt stehen als „Nachname, Vorname“.
- Für Entwickler: neue Prüfstand-Regel `d5-knopfspalte` (Knopfzeilen unter einer Feldzeile gleich breit und bündig; Knöpfe am Handy untereinander gleich breit) und neue Gruppe `mitglieddetail` (jeder Reiter der Mitglieder-Detailansicht samt Fenstern – vorher nirgends geprüft).
- Mitglieder-App, erster Start am iPhone: Der Kasten „Auf den Home-Bildschirm“ hat jetzt drei nummerierte, gleich sichtbare Schritte. ① Code kopieren (Code groß, breiter Knopf „Code kopieren“, danach „✓ Kopiert“ und Haken; dazu der Hinweis, dass man sich ohne Code neu einladen lassen muss), ② Auf den Home-Bildschirm legen (Teilen-Symbol als Bild, Lage der Leiste wird nicht genannt), ③ App öffnen und Code einfügen. Im Fenster „Fast geschafft“ der App holt der Knopf „Einfügen“ den Code aus der Zwischenablage; klappt das nicht, tippt man ihn wie bisher ein. Wer den Kasten mit ✕ schließt, bevor der Code kopiert ist, wird gefragt „Code schon kopiert?“. In eingebetteten Browsern (Gmail, WhatsApp) steht davor Schritt 0 „In Safari öffnen“. Android und Rechner bleiben unverändert. Hat das Mitglied seine PIN gerade beim Koppeln in Safari vergeben, steht in Schritt ③ zusätzlich „(die du eben vergeben hast)“.
- Einladung: Die Einladungs-E-Mail und der Brief mit QR-Code sagen jetzt passend zur PIN: Hat das Mitglied schon eine PIN (Verkauf am Tablet), heißt es „Deine PIN eingeben – dieselbe wie im Verkauf am Tablet“, sonst „Deine persönliche PIN vergeben (4 bis 6 Ziffern)“. Ohne gültigen Einladungslink verrät der Server nichts darüber. Testreihe `invpin`.
- Altersstufen (Fehler 09.11.2026): Ein Kind mit 19, das aus dem Familienbeitrag fällt, bekam „Jugendliche“ vorgeschlagen, weil sich dessen Altersbereich („bis 19“) mit „Erwachsene ab 19“ überschnitt. Jetzt gilt bei Überschneidung immer die höhere Stufe (höchstes „ab“, bei Gleichstand die ohne Obergrenze mit den meisten Mitgliedern) – beim Vorschlag für Kinder und Beitragswechsel, beim Zusatzbeitrag nach Alter und bei Vorschlägen für neue Anträge. „Umstellen“ und „So belassen“ laufen wie bisher.
- Beitragsart bearbeiten: Die Felder heißen „ab … Jahre“ und „bis einschließlich … Jahre“, darunter steht „Gerechnet wird mit dem Alter zu Beginn des Beitragszeitraums.“ und – bei einer Obergrenze – „bis einschließlich 18 → gilt bis zum Tag vor dem 19. Geburtstag“. Überschneiden sich die Altersbereiche mit einer anderen Beitragsart gleicher Art, warnt das Fenster („Überschneidet sich mit … – meintest du bis einschließlich 18?“, Speichern bleibt möglich, Knopf „Trotzdem speichern“); Einstellungen › Datenqualität zeigt es als Hinweis „Altersgrenzen überschneiden sich“.
- Überall dieselbe Schreibweise der Altersgrenzen: „ab 19“, „bis einschl. 18“, „12 bis einschl. 18“ (Tabelle Beitragsarten, Schild „passt nicht zum Alter“, Fehler- und Warntexte, Import-Abgleich). Import aus verein.cloud: „unter 19“ im Beitragsnamen wird als „bis einschließlich 18“ übernommen; „bis 19“ wird wörtlich als 19 gelesen (Hinweis, falls es „unter 19“ meint, bitte nach dem Import prüfen).
- Altersstufen und Beitragslauf-Vorschau sagen jetzt dasselbe (Fund 09.11.2026): Die Vorschau prüft vor dem Warnen die Altersstufen (und schaut so weit voraus wie „bis“ im Beitragslauf), ein Hinweis, der wegen einer kurz geänderten Altersgrenze als „erledigt“ geschlossen wurde, kommt wieder, sobald der Anlass zurückkehrt („belassen“ bleibt belassen), bei Kindern in der Familie warnt die Vorschau nicht zusätzlich „bitte eigene Beitragsart zuweisen“, wenn unter „Altersstufen“ schon ein Hinweis steht, und die Warnungen nennen Namen als „Nachname, Vorname“ und die Altersgrenze als „bis einschl. 18 Jahre“.
- Tabellen und Karten (Fund 09.11.2026): In „Beiträge Hauptverein“ und bei den Zusatzbeiträgen bleibt die Alter-Spalte einzeilig („bis einschl. 17“); bei 1280–1359 Pixel Breite entfallen dafür „Arbeitsstunden“ und „Formular“ (stehen beim Bearbeiten), damit die Tabelle nicht aus der Karte ragt. In der Karte „Altersstufen“ und beim Zusatzbeitrag im Mitglied steht der Name in einer Zeile, der Betrag grau darunter (statt „Name · Betrag“, wobei ein Umbruch die zweite Zeile mit „·“ begann). Dasselbe bei den Beiträgen in der Mitglieder-Karte. Auch in Mannschaften (Spielbetrieb), Serien-Sperren (Buchung), Kalender-Hinweis (Dienste & Termine) und der Lastschrift-Prüfung beginnt keine Zeile mehr mit „·“.
- Für Entwickler: neue Prüfstand-Regel `punkt-zeilenanfang` (ein „·“ am Anfang einer umgebrochenen Zeile).
- Buchung, Dienste & Termine, Spielbetrieb: je ein kleiner Punktfehler (Trennzeichen am Zeilenanfang), Modulversionen hochgezählt.
- Mitglieder 1.43.0.

**Feinschliff aus dem vollen Design-Prüfstand (Release-Zug 09.11.2026)**
- Überall: Ein Trennpunkt „·“ steht nie mehr am Anfang einer umgebrochenen Zeile (zentral für Verwaltung, Tablet und App); Übersetzungen mit solchen Trennern bleiben vollständig englisch.
- Nebeneinanderstehende Felder fluchten auch bei Tablet-Breite: Sicherungspasswort, Flutlicht, Mitglieder-App, Buchführung („Geldkonto je Zahlweg“), Gratulationen (schmale Karte zweispaltig).
- Knöpfe am Handy: Knöpfe in Tabellenzeilen sind beim Umbruch gleich breit, rote Aktionen bleiben abgesetzt; die Prüfung „ganze Zeile einspaltig“ misst, ohne umzuschalten – am iPhone blieb das Scrollen sonst kurz vor dem Seitenende hängen (Einrichtung).
- Beiträge & Abteilungen und Altersstufen scrollen bei Tablet-Breite nicht mehr seitlich; Mitgliederliste am Handy zeigt die Zahlungsart nur noch bei „über …“; Hauptkarte der App kürzt „mit …“ nicht mehr mit „…“; Spieltag: Aktionen oben, „Aufgabe hinzufügen“ mit eigener Zeile. Flutlicht 1.2.2.

## 2026.11.30

**Mitgliederliste mit dem Mitglied daneben, Übersicht ohne Begrüßung (Wunsch 09.11.2026)**
- Mitglieder: Auf breiten Bildschirmen (ab 1400 Pixel) steht rechts neben der Liste eine Karte mit dem Wichtigsten zum angeklickten Mitglied – Geburtsdatum, Eintritt, Abteilungen, Beitrag, Zahlung, „Abgerechnet bis“, offene Posten, Kontakt und Hinweise. „Öffnen“ oder ein Doppelklick öffnet das Mitglied, die Knöpfe darunter springen direkt in Mitgliedschaft, Zahlung & Familie, Konto & Mandat oder Verlauf. Auf kleineren Bildschirmen, am Tablet und am Handy bleibt alles wie bisher: Ein Klick öffnet das Mitglied.
- Übersicht: Statt „Guten Abend, …“ steht oben jetzt einfach „Übersicht“, darüber wie bisher das Datum.
- Übersicht: Kennzahlen in den Modulkacheln brechen nicht mehr um – bei „Dienste & Termine“ stand das „h“ von „129 von 155 h“ allein in der zweiten Zeile. Lange Werte sind etwas kleiner.
- Mitgliederliste: Alle Zeilen sind gleich hoch. Namen, Abteilungen, Beitrag, Zahlung („über Weber, Markus“) und Hinweise bleiben auf großen Bildschirmen einzeilig, statt einzelne Zeilen höher zu machen – solange die Liste damit hineinpasst. Sehr lange Beitragsarten oder Namen brechen um, statt dass die Liste seitlich scrollt.
- Überall (Verwaltung, Tablet, App): Zahl und Einheit bleiben zusammen – „18:55 Uhr“, „64 min“, „30 Tage“, „20 %“ brechen nie mehr so um, dass die Einheit allein in der nächsten Zeile steht – auch in eigenen Texten des Vereins (Beitragsart „Erwachsene ab 27 Jahre“, Hinweis zum Arbeitseinsatz „15 € je Stunde“).
- Für Entwickler: neue Prüfstand-Regel `einheit-allein` (eine Einheit wie h, €, % steht nie allein in der nächsten Zeile).
- Mitglieder 1.40.0, Turniere 1.11.4 (Spielzeit am Tablet „· 40 min“ bleibt zusammen, die Zeile steht als Name ohne Übersetzung).

**Große Rundmails kommen vollständig an – auch bei Anbietern, die Mails je Verbindung begrenzen (Fehler 09.11.2026: 80 von 181 zugestellt, 101 „451 … Mails per session limit exceeded“)**
- Lehnt der Mailserver eine Mail nur vorübergehend ab (Antworten 4xx wie 451, 450, 421, 452), zählt sie nicht mehr als „fehlgeschlagen“, sondern wartet. Clubwerk holt sie von selbst nach: neue Verbindung, Pausen 1, 5, 15 und dann alle 60 Minuten, höchstens 24 Stunden lang. Erst danach gilt sie als fehlgeschlagen. Antworten 5xx (zum Beispiel „Adresse unbekannt“) bleiben sofort ein Fehler. Wer zuerst abgelehnt und später angenommen wird, bekommt die Mail genau einmal.
- Einstellungen › Postfach: neue Felder „Höchstens … Mails je Verbindung“ (Standard 20, vorher fest 50) und „Höchstens … Mails je Stunde“ (leer = unbegrenzt), mit kurzer Erklärung. Meldet der Anbieter ein Limit, senkt Clubwerk die Zahl für diese Rundmail selbst und macht weiter. Darunter steht, wie viele Einzelmails gerade warten.
- Gesendet-Ordner: statt „101 fehlgeschlagen“ steht „80 zugestellt · 101 warten“ mit „nächster Versuch 19:45“; in der Nachricht zeigt jeder Empfänger, ob er wartet. Neuer Knopf „Jetzt erneut versuchen“ für Wartende.
- Einzelmails (Mahnungen, Einladungen, Protokolle, Erinnerungen) laufen bei einem 4xx ebenfalls über die Warteschlange. Es ist dieselbe Warteschlange wie für Mails, die bei gesperrtem Tresor warten (`vault_mail`, neue Spalten für den nächsten Versuch). Testmail und Bestellung melden einen Fehler weiterhin sofort.
- Für Entwickler: `mail.send({ direct: true, … })` meldet 4xx sofort statt zu warten; `CW_MAIL_BACKOFF_UNIT` und `CW_MAIL_TICK` (nur Tests). Testreihe `mdrossel` mit eigenem Test-Mailserver (`hilfen/drossel.js`). Die Zählung „je Stunde“ liegt im Speicher und beginnt nach einem Neustart neu. Anleitung (Kern) Deutsch und Englisch ergänzt.
- Handy: Knopfzeilen in der Verwaltung sind gleich breit (zwei nebeneinander oder untereinander, nie einer schmaler allein darunter); passt eine Beschriftung nicht in die halbe Breite, steht die ganze Zeile in einer Spalte. Die Nachricht im Gesendet-Ordner zeigt die Zustellung als „Nachname, Vorname“ und scrollt als ganze Seite. Dienste & Termine 2.16.0: Datumskästchen steht oben bündig mit dem Titel, auch wenn das Schild umbricht. Prüfstand: neue Regeln `knopfreihe-ungleich` und `knopf-mehrzeilig`.
- Fehler behoben (09.11.2026): Einzeilige, selbst wachsende Textfelder (zum Beispiel „Was“ bei Mitglieder › Einstellungen › Gratulationen, Betreff bei der Bestellung) waren 120 statt 40 Pixel hoch; daneben hingen Auswahlfelder und Knöpfe unten, die Beschriftungen standen versetzt. Jetzt sind sie so hoch wie ein normales Feld und wachsen nur mit dem Text. Prüfstand: neue Regeln `felder-ungleich-hoch` und `beschriftung-versetzt` (am alten Stand schlägt die Gratulationen-Karte an).

## 2026.11.29

**Zugangsdaten liegen jetzt im Tresor (Frage 08.11.2026: „Sind alle Passwörter und Pins in der DB gehasht?“)**
- Passwörter und PINs von Menschen waren schon immer nur als gesalzener Hash gespeichert. Lesbar in der Datenbank standen aber die Zugangsdaten, mit denen Clubwerk selbst bei anderen Diensten anklopft: Postfach-Passwort, Dropbox, die Zugänge zu NAS, Cloud und Google Drive, der Hydrawise-Schlüssel und der Schlüssel der Datensicherung – und damit auch in jedem Schnappschuss. Die liegen jetzt verschlüsselt im Tresor, genau wie Adressen und Bankdaten.
- Folge (so gewollt): Nach einem Neustart warten Datensicherung, E-Mails und Hydrawise, bis sich ein Admin mit Schlüssel anmeldet oder den Wiederherstellungscode eingibt. In der Übersicht steht dann „Tresor gesperrt – Sicherung und E-Mails warten, bitte anmelden.“ Wartende E-Mails gehen nach dem Anmelden raus, die Sicherung des Tages läuft sofort nach, gespeicherte Stopps der Beregnung werden gesendet. Ist um die Uhrzeit der Sicherung noch niemand angemeldet, kommt einmal am Tag die Sicherheitswarnung „Tresor gesperrt – Sicherung wartet“ (auch per Push).
- Bestehende Installationen werden beim ersten Start von selbst umgestellt; ältere Schnappschüsse im Sicherungsordner werden dabei bereinigt, und die Datenbankdatei wird aufgeräumt, damit keine alten Werte darin stehen bleiben.
- Kurze Codes (Unterschrift der Beitrittserklärung und der Schlüsselübergabe am Tablet, SMS-Code der App) sind jetzt gesalzen gespeichert; ein Code, der gerade beim Update offen war, muss neu erzeugt werden. Gast-Links im Spielbetrieb und Spielerseiten im LK-Turnier stehen verschlossen im Tresor; die bestehenden Links gelten weiter.
- Achtung beim Zurückgehen auf eine ältere Version: Die findet die Zugangsdaten nicht mehr – Postfach, Dropbox, Sicherungsziele und Hydrawise müssten neu eingetragen werden (oder den Schnappschuss von vor dem Update zurückspielen).
- Für Entwickler: neuer Baustein `src/geheim.js` bzw. `ctx.geheim`, neue Prüfregel `geheimnis-klartext`, Testreihe `geheim`. Beregnung 1.16.2, Mitglieder 1.39.2, Schlüssel 1.0.1, Spielbetrieb 1.24.2, Turniere 1.11.3.

## 2026.11.28

**Fehler am iPhone: Datei im Reiter „Dokumente“ ausgewählt – danach passierte nichts (Fehler 07.11.2026)**
- Bei Mitglied › Dokumente › „Datei wählen & hochladen“ blieb nach dem Antippen einer Datei in der Dateien-App alles unverändert: keine Meldung, kein Eintrag in der Ablage. Ursache: Das Auswahlfeld für die Datei wurde nur im Hintergrund gebaut und nie in die Seite eingehängt. Safari am iPhone vergisst die Auswahl dann während des langen Auswahlfensters. Am Rechner fiel das nicht auf.
- Jetzt hängt das Feld unsichtbar in der Seite, bis die Auswahl da ist oder abgebrochen wurde (gemeinsamer Baustein `CWPick.file`, auf allen Oberflächen verfügbar). Der Knopf zeigt „Wird hochgeladen …“, und jeder Fehler erscheint als Meldung. Dasselbe gilt für den Import von Funktions-Einstellungen (Dateien einspielen); alle anderen Dateiauswahlen waren schon richtig eingebaut.
- Eine neue Prüfregel (`datei-feld-lose`) meldet künftig jedes selbstgebaute Dateifeld ohne den Baustein; die Testreihe `uploadios` spielt das Hochladen im Reiter „Dokumente“ in Chromium und WebKit (Safari-Technik) durch.
- Mitglieder 1.39.1.

## 2026.11.27

**Neues Modul „Schlüssel“: Schlüsselübergabe mit Unterschrift, Rücknahme und Verlust (Wunsch 05.11.2026, Stufe 1)**
- Unter Anlage › Schlüssel führt der Verein seinen Bestand: Sorten wie „Clubhaus Haupteingang“ mit mehreren Stück (Schlüssel, Transponder, Karte), „vorrätig · ausgegeben · verloren · gesperrt“ je Stück, „sicherheitsrelevant“ für Generalschlüssel.
- **Ausgabe mit Protokoll:** Person wählen (Mitglied, „Kein Mitglied“ oder jemand ohne Clubwerk-Konto wie Pächter oder Handwerker mit Name und Kontakt), Schlüssel, optional „Rückgabe bis“, Pfand (nur als „bar erhalten“ quittiert). Die Bedingungen kommen aus einer Vorlage mit Platzhaltern und werden beim Unterschreiben eingefroren. Beide Seiten unterschreiben auf dem Bildschirm (bei Minderjährigen auch eine erziehungsberechtigte Person) – auf jedem Gerät in der Verwaltung oder am Vereinstablet mit einem 6-stelligen Code (3 Stunden gültig, falsche Codes werden gesperrt).
- Aus jeder Unterschrift entsteht einmal ein PDF mit Nummer („S-2026-014“) und Prüfwert, verschlüsselt im Tresor; es geht per E-Mail an die Person und erscheint bei Mitgliedern im Reiter „Dokumente“ (ohne Kopie).
- **Rücknahme, Verlust, Stornierung** bekommen ein eigenes Protokoll. Die Rücknahme braucht die Unterschrift der annehmenden Person. Der Verlust eines sicherheitsrelevanten Schlüssels löst eine rote Sicherheitswarnung aus, jeder andere eine gelbe.
- **Wer hat welchen Schlüssel?** Liste mit Filtern „Zurückfordern“ (ausgetreten oder überfällig), „Befristet“, „Mit Pfand“; Hinweis auf der Übersicht und im Austritts-Fenster der Mitgliederverwaltung; „Erinnerung schicken“; Excel mit Ausgaben, Bestand und Pfandliste; Suche über „Nr. 08“. Ein Mitglied mit Schlüssel lässt sich nicht löschen.
- Die alten „Schlüsselnummern“ aus der Mitgliederverwaltung lassen sich als „übernommen, ohne Protokoll“ übernehmen; das Protokoll holt man später mit Unterschriften nach. Danach steht im Mitgliederformular statt des Feldes ein Hinweis.
- Datenschutz: Löschfristen (ohne Pfand 3 Jahre, mit Pfand oder Kosten 10 Jahre nach Rückgabe), Auskunft ohne Unterschriftsbilder, Eintrag im Verzeichnis der Verarbeitungstätigkeiten. Funktionsexport enthält nur Sorten, Vorlagen und Einstellungen.
- Neu: gemeinsames Unterschriftsfeld für Verwaltung und Tablet (`unterschrift.js`), die Beitrittserklärung bleibt unverändert. Schlüssel 1.0.0, Mitgliederverwaltung 1.39.0.

**Platzbuchung: Spielerliste im Buchungsfenster aufgeräumt (Fund Design-Prüfstand 06.11.2026)**
- Im Fenster einer Buchung (Verwaltung › Plätze › Woche) stehen die Spieler jetzt untereinander, eine Person je Zeile, als „Nachname, Vorname“ und nach Nachname sortiert – links bündig, auch am Handy. Gäste, Gerät („+ Ballmaschine“) und Allein-Training folgen darunter.
- Die Knöpfe sind geordnet wie in den anderen Fenstern: „Stornieren“ steht in eigener Zeile mit Trennlinie, darunter „Bearbeiten“ und „Schließen“.
- Dieselbe Darstellung am Tablet (Buchung antippen), in der Mitglieder-App (belegte Zeit, „Meine Buchungen“) und in den Buchungs-E-Mails („Spieler: Adler, Felix; Becker, Anna“).
- Die Beispieldaten haben jetzt jeden Tag eine Buchung mit vier Spielern auf Platz 1 (12–13 Uhr), damit der Prüfstand das Fenster an jedem Tag mit vier Namen prüft.
- Buchung 1.28.5.

## 2026.11.26

**Dienste & Termine: Neuer Dienstplan erklärt, wo die Uhrzeiten hinkommen (Wunsch 05.11.2026)**
- Im Fenster „Neuer Dienstplan“ steht jetzt ein Hinweis: Schichten mit Uhrzeit und Aufgabe (Theke, Küche, Kasse …) legt man nach dem Speichern je Tag an, auch mehrere zur selben Zeit.
- Beim Anlegen heißt der Knopf „Speichern und Schichten anlegen“: Der Plan wird gespeichert und gleich das Fenster „Neue Schicht“ für den ersten Tag geöffnet, mit gesetztem Haken „Danach weitere Schicht anlegen“. Wer keine Schicht will, schließt dieses Fenster, der Plan ist trotzdem gespeichert. Beim Bearbeiten bleibt es bei „Speichern“.
- Ein Tag ohne Schicht sagt jetzt: „Noch keine Schicht – mit „+ Schicht“ Uhrzeit und Aufgabe anlegen.“ (statt „Keine Schichten an diesem Tag.“).
- Dienste & Termine 2.15.6.

**Datensicherung: Google Drive als neues Sicherungsziel (Auftrag 05.11.2026: „Ich will von Dropbox weg“)**
- Unter Verein › System › Datensicherung › Sicherungsziele gibt es bei „Ziel hinzufügen …“ jetzt „Google Drive (eigene Google-App)“. Der Verein legt dafür einmal eine eigene Google-App in der Google Cloud Console an; die Anleitung beschreibt jeden Schritt mit den Namen der Menüpunkte.
- Anmelden ohne Weiterleitung an eine Adresse von außen: Clubwerk zeigt einen Code, man öffnet am Handy oder Rechner google.com/device, gibt ihn ein und erlaubt den Zugriff. Clubwerk merkt die Bestätigung von selbst, schreibt, liest und löscht eine Testdatei und legt erst dann das Ziel an.
- Clubwerk bekommt nur die Berechtigung „drive.file“ und sieht damit nur die eigenen Dateien im Ordner „Clubwerk-Sicherung“ (mit „Komplett“ und „Lesbar“), nicht den Rest des Drive.
- Alles wie bei den anderen Zielen: nächtliche Komplettsicherung und lesbare Auszüge, Aufräumen nach Generationen (auch eigene Aufbewahrung), Nachprüfung am Ziel, Probe-Wiederherstellung (reihum), Wiederherstellen und „Aus Sicherung übernehmen …“ direkt aus Google Drive.
- Große Dateien gehen in Stücken hoch und machen nach einem Abbruch an derselben Stelle weiter; danach vergleicht Clubwerk die Prüfsumme von Google mit der Datei hier (auch beim Herunterladen). Bremst Google, wartet Clubwerk und versucht es erneut.
- Klare Meldungen mit HTTP-Status und nächstem Schritt, z. B. Speicher voll, Drive API nicht aktiviert, falscher Client-Typ, Testnutzer fehlt. Läuft die Anmeldung ab oder wird sie widerrufen, steht sofort „Neu verbinden“ in der Übersicht und bei den Zielen, und der Vorstand bekommt eine Sicherheitswarnung. Läuft sie genau eine Woche nach dem Verbinden ab, nennt Clubwerk als Ursache den Status „Testen“ der Google-App („App veröffentlichen“).
- Dropbox läuft unverändert weiter, beide Ziele gehen gleichzeitig. „Entfernen“ des Google-Ziels lässt die Dateien in Google Drive unberührt. Client-Secret und Anmeldung stehen nie im Protokoll, in Meldungen, Warnungen oder Exporten.

## 2026.11.25

**Tablet: Namensliste scrollt flüssiger (Entscheidung 04.11.2026: „Mach es performant“)**
- Die Kacheln der Namensliste, die Buchstaben, die Knöpfe „Gast“, „Verein“, „Gäste-Deckel“, die Artikelkacheln und die Kacheln der übrigen Tablet-Seiten (Stempeln, Dienste, Mitglied werden, Turniere) haben statt des großen weichen Schattens nur noch einen kleinen Schatten. Der Rand bleibt, die Kacheln heben sich weiter klar vom Hintergrund ab, hell wie dunkel. Verwaltung und Mitglieder-App sind unverändert.
- Grund: Der große Schatten musste beim Scrollen für jede Kachel neu gezeichnet werden. Gemessen (großer Musterverein, 4-fach gebremste CPU, 2 500 px scrollen): Zeichenzeit 126 → 70 ms quer, 94 → 45 ms hochkant (Verkauf 3.101.4).

**Tablet: Fenster blenden weich ein und aus (Fehler 04.11.2026, Video mit 60 Bildern pro Sekunde)**
- Beim Antippen eines Mitglieds ohne PIN dunkelte das Fenster „Kein PIN vergeben“ die ganze Seite schlagartig ab, und nach „Später“ sprang sie schlagartig wieder auf hell. Jetzt blenden alle Fenster der Tablet-Seiten (Verkauf, Plätze, Dienste, Stempeln, Mitglied werden, Turniere, Mängel) in rund 0,16 s weich ein und aus. Wer gleich weitertippt, wird nicht aufgehalten: das Fenster ist sofort zu, nur die Abdunklung klingt nach. Wer am Gerät „Bewegung reduzieren“ eingestellt hat, sieht es wie bisher ohne Übergang.

**Tablet › Verkauf: Artikelseite blinkt nicht mehr beim Öffnen (Fehler 04.11.2026, „es blinkt die Artikelseite“)**
- Beim ersten Namen nach dem Laden der Seite (also auch nach jedem Wechsel von einem anderen Reiter) erschienen die Artikelbilder erst nach und nach über rund eine Sekunde – die ganze Kachelfläche veränderte sich dabei mehrmals. Die Anordnung der Kacheln selbst war immer gleich.
- Jetzt holt das Tablet die Artikelbilder im Hintergrund, sobald die Namensliste steht, und setzt die fertigen Bilder beim Öffnen direkt ein: Die Artikelseite steht im ersten Bild vollständig da. Die Namensliste erscheint so schnell wie vorher; die Bilder werden nicht öfter geholt als bisher (danach ein Jahr aus dem Zwischenspeicher).

**Tablet: kein leeres Aufblinken mehr beim Zurück zum Verkauf (Fehler 04.11.2026)**
- Beim Wechsel von einem anderen Reiter (z. B. Plätze oder Dienste) zurück zu „Verkauf“ zeigte die Überblendung für einige Bilder eine leere Verkaufsseite: Überschriften und „Ich bin neu“, aber keine Namen. Grund: Die Seite wurde gezeichnet, bevor die Namen vom Server da waren.
- Jetzt merkt sich das Tablet den letzten Stand der Namensliste für die Dauer des geöffneten Browser-Tabs und zeigt ihn sofort; die frischen Daten kommen gleich danach (bei Änderungen sichtbar wie bisher). Beim allerersten Öffnen bleiben die Abschnitte unsichtbar, bis Daten da sind – nie eine leere Liste mit „Ich bin neu“.
- Gemessen mit absichtlich verzögerter Antwort: vorher 33 von 86 Bildern mit leerer Namensliste, jetzt keines.

## 2026.11.24

**Tablet › Verkauf: Name antippen geht wieder sofort (Fehler 04.11.2026, „die lädt zu lange“)**
- **Die Ursache:** Nach jedem Antippen eines Namens hat das Tablet alle Artikelkacheln neu aufgebaut und dabei bis zu 80 Anordnungen durchprobiert, bis jeder Artikelname lesbar war und möglichst nichts scrollt – auch dann, wenn sich seit dem letzten Mitglied gar nichts geändert hatte. Bei 80 Artikeln dauerte das auf einem langsameren Tablet jedes Mal rund eine Sekunde, auf schwächeren Geräten deutlich länger.
- **Jetzt:** Die Kacheln bleiben stehen, und das Tablet merkt sich die gefundene Anordnung. Beim nächsten Mitglied wird nur die Auswahl zurückgesetzt. Gemessen mit einem großen Musterverein (500 Mitglieder, 80 Artikel mit Bild, 4-fach gebremste CPU): **0,6–1,2 s → 0,2 s** vom Antippen bis zu den Artikeln.
- Die Anordnung bleibt auch nach einem Wechsel zu einem anderen Reiter des Tablets (Plätze, Dienste …) und zurück gemerkt. Nur wenn sich Artikel, Preise oder die Bildschirmgröße ändern, sucht das Tablet einmal neu.
- Wie die Kacheln angeordnet werden, ist unverändert (für 9 Artikelzahlen von 5 bis 130 in 7 Bildschirmgrößen vorher und nachher verglichen). Buchen, Warenkorb, Rückgängig und Kontostände sind nicht berührt (Verkauf 3.101.3).
- **Namensliste:** Buchstabe antippen, „Alle“, Tippen in der Suche und das Zurückkommen nach „Anderes Mitglied“ bauen die Liste nicht mehr jedes Mal neu auf und sortieren nicht mehr neu – die Namen werden einmal vorbereitet und danach nur ein- und ausgeblendet. Bei rund 300 Namen und 4-fach gebremster CPU: Suche 0,23–0,26 s → 0,12–0,19 s je Taste, Suche leeren 0,18–0,24 s → 0,15 s. Was die Liste zeigt und in welcher Reihenfolge, ist unverändert.
- **Weniger Arbeit für den Server:** Die Namensliste des Tablets fragte bei jedem Laden und alle 60 Sekunden für jedes Mitglied, das „über den Zahler“ bucht, einzeln nach, wer zahlt – bei 500 Mitgliedern 445 Datenbankabfragen, jetzt 49 (Mitgliederverwaltung 1.38.3).
- **Damit es nicht wiederkommt:** neue Testreihe `tablettempo` (großer Musterverein, gebremste CPU): Abfragen, Anfragen und Datenmenge beim Start, wiederverwendete Anordnung, keine Auswahl des vorigen Mitglieds, neuer Preis erscheint.

**Aufgeräumt:** Zwei Beispieltexte nannten noch ein echtes Vereinskürzel. Sie zeigen jetzt das Musterkürzel „TCM“ (TC Grün-Weiß Musterstadt).

## 2026.11.22

**Seitenleiste der Verwaltung selbst anpassen (Wunsch 04.11.2026)**
- **Neue Karte „Seitenleiste“** unter Einstellungen › Verein: Die sechs Bereiche (Gastro, Sport, Anlage, Mitglieder, Finanzen, Verein) lassen sich **umbenennen** (zum Beispiel „Gastro“ → „Vereinsheim“, bis 24 Zeichen, leer = Standardname) und mit den Pfeilen **in der Reihenfolge verschieben**.
- **Menüeinträge verschieben:** Jeden Eintrag legt ihr mit einer Auswahl in einen anderen Bereich und ordnet ihn mit den Pfeilen innerhalb des Bereichs. Neue Bereiche gibt es nicht, und keiner geht verloren; ein Bereich ohne Einträge erscheint im Menü nicht.
- **Gilt für den ganzen Verein** (Recht „Einstellungen“), nicht je Person. Welche Seiten jemand sieht, bestimmen weiter die Rechte. Die Leiste baut sich nach dem Speichern sofort neu auf.
- **Nichts verschwindet:** Neue Module stehen von selbst am Ende ihres Standardbereichs; Einträge, die es nicht mehr gibt, werden ignoriert. **Standard wiederherstellen** fragt nach und setzt alles zurück.
- **Eigene Namen** bleiben in jeder Sprache so, wie der Verein sie schreibt. Sie erscheinen auch in der Kopfzeile über der Seite, im Menüknopf am Handy und in der Suche. Lange Namen brechen in der Leiste um, nichts wird abgeschnitten.
- **Protokoll und Sicherung:** Das Protokoll zeigt die Änderung mit Namen („Name „Gastro“: Gastro → Vereinsheim“, „„Beregnung“ liegt in: Anlage → Sport“). Die Einstellung steckt in „Aus Sicherung übernehmen“ (Teil „Verein“).
- Anleitung „Grundlagen“ (Deutsch und Englisch) um die neue Karte ergänzt; Testreihe `leistanp`.
- **Am Handy bleibt nichts abgeschnitten:** In der Karte stehen Bereichsname und Auswahl in voller Breite unter der Beschriftung, die Pfeile rechts daneben; der Text in Auswahlfeldern fluchtet jetzt mit dem in Textfeldern (überall in der Verwaltung).
- **Lange Werte in Feldern:** Betreff der Bestellung (Verkauf › Lager), Abo-Link des Kalenders (Dienste & Termine), Buchungstext einer Forderung (Mitglieder) und die Bezeichnung einer Position (Buchhaltung) brechen jetzt in die nächste Zeile um, statt abgeschnitten zu werden; „Ehrenmitglied vorschlagen“ (Gratulationen) hat mehr Platz. Der Design-Prüfstand meldet solche Felder künftig selbst.
- **Menüknopf am Handy mit eigenem Bereichsnamen:** Er bekommt höchstens 42 % der Kopfleiste und verkleinert die Schrift, wenn nötig. Passt der Name auch dann nicht, steht „Menü“ auf dem Knopf; der Bereich steht darunter in der Kopfzeile der Seite. So bleibt neben dem Vereinsnamen immer Platz, nichts wird mit „…“ gekürzt.
- Weitere Felder, die ihren Text nun ganz zeigen (brechen um): Ort in Mängel › Einstellungen, Name im Turnierplaner, Titel im Einsatz-Fenster der Dienste, begünstigte Zwecke in der Buchhaltung und „Was“ bei den Gratulationen.
## 2026.11.23

**E-Mails zur Platzbuchung nennen den richtigen Bereich der App (Fehler 04.11.2026)**
- In der Buchungsbestätigung stand „Alle Buchungen siehst du in der Mitglieder-App unter „Buchen““ – der Bereich heißt in der App aber „Plätze“. Das ist korrigiert, ebenso in der Mail „Frei geworden“ an die Warteliste.
- **Damit es nicht wiederkommt:** Die neue Testreihe `appbereich` prüft alle Texte der Form „in der (Mitglieder-)App unter „…““ gegen die echten Namen der App-Bereiche.
- **Module:** Plätze 1.28.4.

## 2026.11.21

**Englische Oberfläche: keine deutschen Reste mehr (Fehler 03.11.2026)**
- **Der Auslöser:** In der englischen Mitglieder-App stand bei „Work hours“ noch „… danach 15,00 € je fehlender Stunde“ auf Deutsch, dazu Datum und Betrag im deutschen Format. Jetzt steht dort ein ganzer englischer Satz: „0 h of 4 h done – please by 30/04/2027, after that €15.00 per missing hour.“
- **Daten, Beträge und Dezimalzahlen richten sich nach der Sprache:** in der englischen Oberfläche erscheinen `31.12.2026` als 31/12/2026, `15,00 €` als €15.00 und `1,5 h` als 1.5 h – überall, auch in Hinweisen vom Server. Auch einmal angelegte Zahlen- und Datumsformate der Module folgen der Sprache. Deutsch bleibt unverändert.
- **Zusammengesetzte Texte werden Teil für Teil übersetzt:** Aufzählungen wie „Zeiterfassung · An wen der Stundennachweis …“ oder „Heim · auswärts · 3/4 können“ und Angaben der Form „Bezeichnung: Wert“ blieben bisher halb deutsch, halb englisch. Rund 30 Stellen in der Verwaltung, im Tablet und in der App sind außerdem auf ganze Sätze umgestellt (Monatsnamen in den Statistiken, „alle 25 Konten“, Mahnstufen, Mannschaften „gegen/bei …“, Kontoauszug-Hinweis, Lastschrift-Hinweis, Termine „Als Nächstes“, LK-Turniertag am Tablet „Als Nächstes (etwa … Uhr)“ und „läuft seit … Minuten“ u. a.).
- **Tablet › Beregnung war nie übersetzt:** die Seite lud ihre Sprachdatei vom falschen Pfad und blieb deutsch (Tablet, Rahmen „Beregnung“).
- **Texte des Vereins bleiben, wie sie sind:** Hinweise und Notizen, die der Verein selbst eingibt (Arbeitseinsätze, Sperrzeiträume, Kündigungsgründe), werden nicht mehr zu einem Mischtext übersetzt.
- **Weitere Texte ohne Übersetzung gefunden:** die lange Beschreibung des Moduls „Turniere“ (fiel beim Sammeln der Texte heraus), die Namen der Artikel-Symbole („Brötchen“, „Heißgetränke“ …) und Ein-Wort-Beschriftungen („geleistet“, „erledigt“, „bei“). Drei englische Einleitungen und die Herkunft „im Paket“ sind gekürzt, damit nichts umbricht; der Link „Ansehen/View“ in den Hinweisen hat jetzt die Mindestbreite einer Tippfläche.
- **Neuer Prüfablauf:** der Design-Prüfstand geht Tablet, Verwaltung und App auch **mit Sprache Englisch** durch (alle Seiten, Reiter und Fenster, `gate.py --lauf=en`, in `paket.sh`) und meldet jeden sichtbaren Text, der noch deutsch aussieht. Am alten Stand 914 verschiedene Texte (1 144 Fundstellen), jetzt 0. Ausgenommen: Namen und Texte aus den Daten sowie das Protokoll (gespeicherter Text).
- **Module:** Dienste & Termine 2.15.4, Mitglieder 1.38.1, Buchung 1.28.3, Beregnung 1.16.1, Turniere 1.11.1, Flutlicht und Spielbetrieb mit Versionsschritt. **Für Entwickler:** Regel `deutsch-in-englisch` (`deutsch.js`), Testreihe `deutsch`, `i18n-core.js` übersetzt „A · B · C“ Teil für Teil, `i18n-dom.js` formatiert Datum, Euro und Dezimalzahlen je Sprache, `extract.js` nimmt Beschreibungen bis 4 000 Zeichen mit, `extra.json` für Ein-Wort-Beschriftungen.

## 2026.11.20

**Mitglieder-App: „App installieren“ auf Android**
- **Neu:** Auf Android-Handys (Chrome, Edge, Samsung Internet) zeigt „Für mich“ ganz oben die Karte **„App installieren“**. Ein Antippen öffnet den Installationsdialog des Handys; danach startet die App direkt vom Startbildschirm, die Freischaltung bleibt erhalten. „Später“ (oder ein „Abbrechen“ im Dialog) blendet die Karte 14 Tage aus, nach der Installation verschwindet sie.
- Der Knopf „App installieren“ kommt jetzt auch auf langsamen Geräten zuverlässig: Meldet der Browser das Angebot, bevor die App ganz geladen ist, geht es nicht mehr verloren.
- **Auch ohne Knopf eine Anleitung (Rückmeldung eines Android-Mitglieds: „Ich habe kein Teilen gefunden“):** Bietet der Browser keinen Installationsknopf an (Firefox, Samsung Internet, Chrome ohne Angebot), zeigt „Für mich“ die Schritte des jeweiligen Browsers mit Symbolen – ohne „Teilen“ und ohne eine feste Lage der Leiste. In Gmail/WhatsApp kommt zuerst „Im Browser öffnen“. Die Karte bleibt, bis installiert oder „Später“, auch wenn Benachrichtigungen schon gehen. Auf dem iPhone bleibt alles wie bisher. Es steht immer nur eine Karte da.
- **Für alle Systeme die richtige Karte:** Außer Android jetzt auch Rechner (Chrome/Edge: Knopf bzw. Installieren-Symbol der Adressleiste; Safari am Mac ab Version 17: „Zum Dock hinzufügen"; Firefox am Rechner: keine Karte, weil er dort nicht installiert), iPad (wird über die Berührung erkannt, auch wenn es sich als Mac meldet) und unbekannte Android-Browser (Opera, Xiaomi, Huawei … bekommen die allgemeine Anleitung). Chrome/Firefox/Edge auf dem iPhone vor iOS 16.4: zuerst „In Safari öffnen". Die Tabelle steht in der Anleitung.
- **Erkennt, wenn die App schon installiert ist:** In der installierten App erscheint nie eine Installations-Karte. Merkt der Android-Browser, dass die App schon da ist, steht nur der Hinweis „Du hast die App schon – öffne sie vom Startbildschirm“. Wo es sich nicht erkennen lässt (iPhone-Safari, Anleitungen ohne Knopf), blendet „Habe ich schon installiert“ die Karte dauerhaft aus.
- Das Symbol der App ist jetzt für 192 und 512 Pixel eingetragen und hat eine feste Kennung, damit Android sie sicher als installierbare App erkennt.

**Mitglieder-App: Hinweis „erst im Vereins-WLAN“ nennt nur, was wirklich betroffen ist**
- **Fehler behoben:** Die E-Mail „Mitglieder-App freigeschaltet“, die Kopplung in der App und die Verwaltung sagten fest „Türen und Beregnung“ – auch in Vereinen, die nur Licht oder gar keinen solchen Bereich haben. Jetzt steht dort aus den tatsächlich betroffenen Bereichen des Mitglieds z. B. „Einige Bereiche (Licht) schalten sich erst frei, sobald du die App einmal im Vereins-WLAN öffnest.“ Ohne bekannte Liste lautet der Satz allgemein „Einige Bereiche …“; ohne sensible Bereiche gibt es keinen Hinweis.
- **Verwaltung:** Der Knopf heißt „Bereiche im Vereins-WLAN jetzt freigeben“; der Sicherheitshinweis zu HTTPS nennt nur Türen und Beregnung, wenn es sie im Verein gibt.
- **E-Mail-Layout:** Lange Angaben in der Infokarte (z. B. dieser Hinweis, die Beschreibung einer Mängelmeldung) stehen jetzt mit der Bezeichnung darüber in voller Breite statt in der schmalen Spalte, die am Handy in viele Zeilen brach.

**Verwaltung: kürzeres Menü, nach Bereichen geordnet**
- **Bereiche statt einer langen Liste:** Das Menü links ist nach Aufgaben geordnet – **Gastro** (Verkauf, Lager), **Sport** (Plätze, Spielbetrieb, Clubmeisterschaft, Turniertag, Turnierplaner), **Anlage** (Beregnung, Flutlicht, Zugang, Mängel), **Mitglieder** (Mitglieder, Dienste & Termine, Zeiterfassung, Nachrichten, Mitglieder-App), **Finanzen** (Beiträge & Zahlungen, Buchhaltung) und **Verein** (Benutzer & Rechte, System, Einstellungen). Mit allen Modulen waren es 24 Zeilen und das Menü musste schon am Rechner scrollen – jetzt sind es 7.
- **Aufklappen mit einem Klick:** Ein Klick auf einen Bereich zeigt seine Einträge. Der Bereich der Seite, auf der ihr seid, ist immer offen. Mehrere Bereiche dürfen gleichzeitig offen sein, und jedes Gerät merkt sich, welche ihr offen lasst. Ein Punkt am zugeklappten Bereich zeigt, dass darin etwas zu tun ist (rot, wenn die Datensicherung fehlt). Auch mit der Tastatur: Pfeile hoch/runter, rechts klappt auf, links zu.
- **Wer wenig sieht, klappt nichts auf:** Mit bis zu 9 Einträgen (z. B. Kassenwart, Platzwart, Thekenteam) steht alles wie bisher untereinander, nur mit den Bereichen als Überschriften.
- **Neue Seite „System“:** Datensicherung, Protokoll und Einrichtung sind jetzt Reiter einer Seite „System“ im Bereich Verein. Lesezeichen, Hinweise der Übersicht, die Suche (Strg K) und das „?“ führen weiter direkt an die richtige Stelle.
- **Unten im Menü** stehen Name, Tablet und Abmelden in einer Zeile; ist der Name dafür zu lang, rutschen die beiden Knöpfe darunter – der Name bricht nie mitten im Wort.
- **Mitglieder-App › Plätze › „Jetzt auf der Anlage“:** Lange Namen einer Belegung (z. B. „Training Jugend U12 Leistungsgruppe“) stehen ganz da und brechen um, statt mit „…“ zu enden (Buchung 1.28.3).
- **Menüknopf am Handy** zeigt jetzt den Bereich (z. B. „Finanzen“) statt des langen Seitennamens und bleibt so immer einzeilig – vorher brach „Dienste & Termine“ oder „Beiträge & Zahlungen“ auf zwei Zeilen um.
- Am Handy und im Tablet-Rahmen gilt dasselbe Menü; jede Zeile ist dort 40 px hoch, und mit einem offenen Bereich passt alles ohne Scrollen auf den Bildschirm.
- **Für Entwickler:** `registerPage({ bereich })` für neue Module, Gruppe `'system'`; Prüfstand-Regeln `leiste-scrollt` (Rechner 1280 × 800, Laptop 1366 × 768, Tablet-Rahmen 820, Handy 390 × 664) und `kopfknopf-umbruch` (Kopfzeilen-Knöpfe einzeilig, 390 und 360 px, Chromium und WebKit), neue Testreihe `leiste`.

**Mitglieder: fehlendes Geburtsdatum wird als Hinweis angezeigt**
- **Fehler behoben:** Die LSB-Bestandserhebung meldete „2 Mitglieder ohne Geburtsdatum sind nicht enthalten“, aber im Filter „Mit Hinweis“ tauchten diese Mitglieder nicht auf. Jetzt steht bei jedem aktuellen Mitglied ohne Geburtsdatum der Hinweis **„Geburtsdatum fehlt“** (Liste, Filter „Mit Hinweis“, beim Geburtsdatum im Mitglied).
- **LSB-Meldung klickbar:** Die Meldung nennt die Mitglieder mit Namen (Klick öffnet das Mitglied); „In der Liste anzeigen“ springt in die Mitgliederliste, gefiltert auf genau diese.
- **Einstellungen › Datenqualität:** neuer Prüfpunkt „Mitglieder ohne Geburtsdatum“ mit Anzahl, Namen und Sprung in die Liste.
- **Beitragslauf-Vorschau:** warnt auch bei Familienmitgliedern ohne Geburtsdatum (sie gelten als Erwachsene); bei Abteilungs-Zusatzbeiträgen tat sie das schon. Berechnet wird nichts anders als bisher.
- **Mitgliederliste sortierbar:** Klick auf „Name“, „Nr.“ oder „Alter“ sortiert, zweiter Klick dreht um (Pfeil ▲/▼, auch per Tastatur). Standard bleibt „Nachname, Vorname“; Nummern werden als Zahlen sortiert (10 nach 2), Mitglieder ohne Nummer oder Geburtsdatum stehen immer am Ende. Am Handy gibt es dafür ein Feld „Sortieren“. Die Wahl wird je Gerät gemerkt. Für Entwickler: Baustein `GK.sortKit` (siehe ERWEITERUNGEN.md).
- **Mitgliedsnummern:** neue Einstellung „Neue Nummer“ unter Mitglieder › Einstellungen › Mitgliedschaft: „ab dem Startwert“ (wie bisher) oder „nach höchster Nummer“ (höchste vorhandene + 1, nützlich nach einem Import). Geprüft: Eine schon vergebene Nummer wird in beiden Fällen nicht noch einmal vergeben.
- **Papier-Beitrittserklärung (PDF) verständlicher:** Im leeren Antrag stehen bei „Weitere Familienmitglieder“ Kästchen „Partner/in“ und „Kind“, darüber die Regel aus den Einstellungen („Partner/in: höchstens eine weitere erwachsene Person. Kind: bis einschließlich 18 Jahre.“). Das Geschlecht steht ebenfalls als Kästchen („männlich/weiblich/divers“); Beitragsart, Abteilungen und Einwilligungen hatten sie schon.
- **„Ort, Datum“ bei Unterschriften:** Im leeren Antrag und im leeren SEPA-Mandat steht kein Vereinsort mehr vorausgefüllt (das Mitglied schreibt Ort und Datum selbst). Im online oder am Tablet unterschriebenen PDF stehen Wohnort des Mitglieds und Datum der Unterschrift (nur ohne Wohnort der Vereinsort).
- **Doppelter Punkt nach dem Vereinsnamen:** Endet der Vereinsname auf „e. V.“, stand im Antrag „… im TC Muster e. V..“. Neuer Helfer `endDot` (src/util.js) hängt das Satzende nur an, wenn noch keiner da ist. Alle Vorlagen (PDFs, E-Mails, Push- und App-Texte) durchsucht: nur diese eine Stelle setzte einen Punkt direkt hinter den Namen.
- **Beispieldaten:** ein Demo-Mitglied ohne Geburtsdatum. **Module:** Mitglieder 1.38.0. Testreihen `mv`, `dq` erweitert.

**Mitglieder-App: einzelne Termine in den eigenen Kalender übernehmen**
- Im Fenster eines Termins aus dem **Vereinskalender** (Dienste & Termine › Termine) gibt es neben „Schließen“ den Knopf **„In den Kalender“**. Er legt genau diesen Termin im Kalender des Handys an (iPhone zeigt die Kalender-Vorschau, ohne Safari) – mit Uhrzeit, Ort und Beschreibung, ganztägige und mehrtägige Termine stimmen.
- Auch die **Termine mit Zu- und Absage** haben unter den Antwort-Knöpfen jetzt „In den Kalender“.
- Das persönliche Kalender-Abo bleibt daneben bestehen (alle Termine automatisch).

## 2026.11.19

**Mitglieder-App: einen Bereich für viele Mitglieder auf einmal freigeben**
- **Neu: „Bereich freigeben …“** über der Liste „Freigeschaltete Mitglieder“ (Mitglieder-App › Mitglieder). Statt bei 80 Mitgliedern einzeln den Haken „Türen“ zu setzen, wählt ihr den Bereich und **wer** ihn bekommt: alle Mitglieder in der App, eine Mitgliedsart (z. B. aktiv), eine Abteilung oder eine eigene Auswahl mit Häkchen und Suche. Konten „Kein Mitglied“ kommen nur über die eigene Auswahl dazu.
- **Erst die Vorschau:** wie viele den Bereich neu bekommen, wer ihn schon hat und bei wem es nicht geht (gesperrt, abgelaufen, Handy muss neu eingeladen werden) – mit Namen zum Aufklappen. Geändert wird erst nach der Bestätigung. Mitglieder ohne Handy bekommen den Bereich trotzdem; er gilt, sobald sie die App koppeln.
- **Türen, Beregnung und Licht nur mit Wort und Passwort:** Zur Bestätigung tippt ihr FREIGEBEN und euer eigenes Passwort ein, bei anderen Bereichen reicht der Knopf. Eine solche Sammel-Freigabe meldet sich sofort als Sicherheitswarnung beim Vorstand. Gesammelt freigeben darf nur, wer das volle Recht für den Bereich hat (nicht nur für die eigene Abteilung).
- **„Erst im Vereins-WLAN öffnen“ bleibt:** Handys, die von unterwegs ohne SMS-Code gekoppelt wurden, öffnen Türen, Beregnung und Licht auch nach einer Sammel-Freigabe erst nach dem ersten Besuch im Vereins-WLAN. Gesperrte Freischaltungen bleiben gesperrt, und kein Handy wird beim Sammeln entkoppelt.
- **Zurücknehmen:** Die letzte Sammel-Freigabe steht über der Liste und lässt sich mit „Zurücknehmen …“ wieder entziehen – wen ihr seitdem einzeln geändert habt, bleibt, wie er ist.
- **Hinweis in der Übersicht:** Wird ein Modul mit eigenem App-Bereich eingeschaltet und hat ihn noch niemand, fragt die Übersicht „Neuer Bereich …: für wen freigeben?“ und öffnet das Fenster gleich mit diesem Bereich („Vorerst für niemanden“ blendet den Hinweis aus).
- **Protokoll:** je Mitglied ein Eintrag wie beim Einzeln-Freigeben, dazu ein Sammel-Eintrag mit Bereich, Anzahl und Auswahl.
- **Module:** Mitglieder 1.37.0 (liefert Mitgliedsarten und Abteilungen für die Auswahl). **Für Entwickler:** neuer Hook `memberGroups()` der Mitgliederverwaltung, neue Testreihe `afall`.

## 2026.11.18

**Design-Prüfstand findet mehr – und was er neu fand, ist behoben**
- **Spielbetrieb › Mannschaften › „Spieler verwalten“:** Hinweise wie „wird 2027 erst 19 (D40) · männlich – Damenmannschaft“ und „Gast“ stehen jetzt in einer eigenen Zeile unter dem Namen. Vorher lag am Handy der „+“-Knopf bzw. ▲ ▼ über dem Hinweis, er lief rechts aus dem Listenrahmen und die Trennlinien endeten zu früh.
- **Alle Fenster der Verwaltung am Handy:** Die Leiste mit Abbrechen/Speichern klebt jetzt wirklich am unteren Bildschirmrand – vorher schaute darunter ein Streifen Inhalt hervor („+ Gastspieler/in anlegen“, „Meldeliste“). Solange darunter noch etwas kommt, zeigt die Leiste einen leichten Schatten. Zeichnet sich ein offenes Fenster neu (z. B. nach „+“), springt es nicht mehr nach oben.
- **Spieltag-Fenster:** unten nur noch „Schließen“ und „Aufstellung verschicken“; „Offene erinnern“, „Spieltag ändern …“ und „Treffpunkt speichern“ stehen bei ihrem Bereich. Am Handy belegten fünf Knöpfe vorher ein Drittel des Bildschirms.
- **Listen in Kästen am Handy:** kein doppelter Rahmen mehr (z. B. Rückmeldungen im Spieltag-Fenster – Zeilen-Karten lagen auf dem Rahmen des Kastens). **Auswahlfelder** zeigen ihren Text in Safari mittig statt zu tief („kann“ wirkte unten abgeschnitten).
- **Belegungspläne (Plätze in App, Tablet und Verwaltung, Turniertag):** Buchungsarten werden mit Silbentrennung umbrochen statt mitten im Wort („Medensp|iel“), und ein Block zeigt nur ganze Zeilen – kein halb angeschnittener Name mehr am unteren Rand.
- **Auswahlfelder mit langen Einträgen in älterem Safari (iOS/macOS 26):** Karten und Fenster ließen sich seitlich verschieben, wenn eine Auswahl einen langen Eintrag hatte (z. B. Beregnung und Zugang › Einstellungen „Hersteller“, Plätze & Zonen). Jetzt bleibt der Text im Feld.
- **Mitglieder-App › Plätze › „Jetzt auf der Anlage“:** Die Zeilen (Tippen zeigt den ganzen Namen) sind jetzt groß genug zum Tippen.
- **Schilder brechen um statt hinauszuragen** (überall): lange Namen und Hinweise in Schildern laufen nicht mehr aus Karten und Listen (z. B. Dienste › „Kommende Einsätze“).
- **Listen in Fenstern am Handy** zwei Zeilen je Eintrag statt hoher Karten: Aufstellung im Spieltag, Abtippliste, „Diese Saison nicht da“, Lieferung ansehen, Antrag prüfen, Lastschrift-Empfänger, Empfänger und Antworten einer Nachricht.
- **Weitere Stellen, die erst der neue Prüfstand fand:** rote Knöpfe abgesetzt („Alle … entfernen“, „Ablehnen“ im Antrag, „Posten stornieren …“, „Löschen“ einer Nachricht); Lieferung von Hand und neue Beitragsart mit fluchtenden Feldern; „Heute“ in der Tagesansicht der Plätze so hoch wie die Tage; Namen über den Ergebnisfeldern (Clubmeisterschaft) und Paarungen am Tablet (Turniertag › „Ergebnis eintragen“) ganz statt mit „…“; Deckel-Name am Tablet ganz; „Bezahlen“ am Deckel nicht mehr als zweiter Hauptknopf; Dienste: Antwortenliste und Pflichtstunden-Zeilen ohne Wortsäulen; Datensicherung: Abstand über „Speichern“, lange Adressen brechen um; Mitglieder-App › Einstellungen › Benachrichtigungen nicht mehr breiter als die Karte; Platzhalter wie „Gebinde“ ganz sichtbar.
- **Mitglieder-App › Freigaben-Fenster und „Für viele freigeben“ am Handy:** Umschalter und Link groß genug zum Tippen, lange Namen stehen über die ganze Zeile.
- **Mitglieder-App:** Im Aufstellungs-Bogen sind „+ Bewirtung“ & Co. groß genug zum Tippen, Uhrzeit und Ergebnis gleich hoch; Turniere und Mängel unter „Mehr“ zeigen kurze Texte ganz.
- **Prüfstand** (nur Werkzeug): öffnet jetzt jedes Fenster jeder Seite (vorher nur das erste) – auch in der Mitglieder-App, wo bisher kein einziges Blatt geprüft wurde –, misst auch unter der Falz von Fenstern und Listen, prüft alle Bereiche unter „Mehr“, hat fünf neue Regeln (seitlich scrollende Listen, Schild ragt aus dem Rahmen, Inhalt unter/hinter der Fußleiste, abgeschnittene Platzhalter) und Stressdaten mit beiden Hinweisen zugleich; neue Schilder-Abdeckung zeigt, welche Schildarten nie in den Testdaten vorkommen.

**Sicherheitswarnungen an den Vorstand („Sicherheit & Betrieb“)**
- **Warnungen kommen jetzt an.** Clubwerk hat schon an vielen Stellen Auffälliges bemerkt (viele falsche Passwörter, ein gesperrtes Handy, geänderte Türen …), das landete aber fast nur im Protokoll. Jetzt gibt es dafür einen festen Weg: Alle mit dem neuen Recht **„Sicherheitswarnungen“** bekommen sie – wer „alle Rechte“ hat, automatisch. Alles läuft auf eurem Home Assistant, ohne Internetdienst und ohne KI.
- **Rote Warnungen kommen sofort** per Push aufs Handy (auch nachts) und per E-Mail, zum Beispiel: viele falsche Passwörter oder PINs, ein gesperrtes Handy, „alle Rechte“ vergeben, eine hochgeladene Erweiterung, Tresor ausgeschaltet oder mit Wiederherstellungscode geöffnet, Notfall-Passwort gesetzt, Sicherungsziel geändert, Sicherung fehlgeschlagen, Speicher fast voll, eine Beregnung, die sich nicht stoppen lässt, eine Tür, die sich nicht abschließt. Der Push nennt nur die Art der Warnung, nie Namen oder Adressen; der Vorstand gibt ihn wie alle Anlässe unter Mitglieder-App › Benachrichtigungen frei.
- **Gelbe Warnungen kommen gesammelt** in einer Tagesmail um 7 Uhr, nur an Tagen mit neuen Warnungen: Anmeldung von einem neuen Gerät, geänderte Benutzer, Rollen und Passwörter (auch das eigene Passwort steht jetzt im Protokoll), keine Sicherung seit 48 Stunden, neue Fehler in den Daten, viele abgelehnte Türöffnungen, viele abgewiesene Tunnel-Anfragen, Tür steht zu lange offen, Licht lässt sich nicht schalten, Speicher wird knapp.
- **Keine Alarmflut:** Gleiche Warnungen werden zusammengefasst (mit Zähler, auch über einen Neustart hinweg), dieselbe Warnung kommt höchstens einmal in der Stunde, am Tag höchstens zehn Sofortmeldungen.
- **Neuer Bereich Einstellungen › Sicherheit:** Liste der Warnungen mit **Erledigt** (gilt für alle), „Alle erledigt“, „Auch erledigte zeigen“ und **Testwarnung senden**; darunter, wer Warnungen bekommt (mit Push und E-Mail je Person) und **zusätzliche Adressen**. Die bisherige Warn-Adresse aus Mitglieder-App › Sicherheit („Warnung bei gesperrtem Handy an“) gilt als zusätzliche Adresse weiter und steht jetzt hier. In der **Übersicht** steht ein roter bzw. gelber Hinweis, solange etwas offen ist.
- **Datenschutz:** Warnungen enthalten nur, was zum Nachfragen nötig ist (Benutzername, Mitglied, Adresse), Zugangsdaten und lange Schlüssel werden herausgefiltert. Sie werden nach der Frist „Anmeldungen und Sicherheitsmeldungen“ gelöscht, stehen in der Datenauskunft des Mitglieds, werden beim Anonymisieren gelöscht und stehen im Verzeichnis von Verarbeitungstätigkeiten.
- **Module:** Zugang 1.13.0, Beregnung 1.16.0, Flutlicht 1.2.0, Zeiterfassung 1.9.0, Turniere 1.11.0, Mitglieder 1.36.0 melden ihre Warnungen über diesen Weg; Betriebsmeldungen gehen weiterhin zusätzlich an die Home-Assistant-Benachrichtigung, falls eingetragen.
- **Für Entwickler:** Module melden ihre Arten über `hooks.securityEvents` (`{ id, label, level, push }`) und warnen mit `ctx.securityAlert('<id>', text, { key, member })`. Neue Quelltext-Regel `warnung-art` in `werkzeuge/sicherheit-regeln.js`, neue Testreihe `secwarn`.

## 2026.11.17

**Mitglieder-App: Liste „Freigeschaltete Mitglieder“ neu gestaltet, „erst im WLAN“ erklärt**
- **Die Liste ist wieder aufgeräumt.** Statt einer Spalte mit Häkchen je Bereich (bei acht Bereichen breiter als der Bildschirm, mit Scrollbalken, abgeschnittenem „Zuletzt benutzt“ und ungleich hohen Zeilen) gibt es jetzt je Mitglied eine Zeile: **Handy** (eine Pille), **Freigaben** (ein Satz: „alle Bereiche“, „alle außer Beregnung“, „3 Bereiche“, „keine“), **Zuletzt benutzt** und drei Knöpfe. Am Handy bleibt es die kompakte Liste.
- **Freigaben bearbeitet man im Fenster** (neuer Knopf „Freigaben bearbeiten“, am Handy Tippen auf die Zeile): ein Haken je Bereich, „unterwegs“ als eigene Pille beim Bereich. Dieselben Freigaben, dieselben Rechte wie vorher.
- **„Türen/Beregnung erst im WLAN“ ist jetzt erklärt:** Hat ein Mitglied sein Handy von unterwegs ohne SMS-Code freigeschaltet, steht in der Liste eine Pille „Erst im Vereins-WLAN öffnen“, darüber ein Hinweis mit Grund und nächstem Schritt (App einmal im Vereinsheim öffnen oder selbst freigeben), im Fenster derselbe Hinweis. Der Filter heißt „erst im WLAN öffnen“. Das Mitglied sieht in der App bei den gesperrten Bereichen einen verständlicheren Text.
- **Tabellen am Tablet nicht mehr zu breit:** Beim Prüfen mit den neuen Regeln zeigte sich, dass im Tablet-Rahmen (Verwaltung bei 1024 bis 1180 Pixel Breite) acht weitere Tabellen ein Stück seitlich scrollten. Dort entfallen jetzt je ein bis drei weniger wichtige Spalten, damit alles ohne Scrollen passt (am Handy zeigt die kompakte Liste weiterhin alles): Offene Posten (Art), Lastschriften (Vorabinfo), Plätze › Buchungen (Eingetragen), Verkauf › Buchungen (Zusatzschilder), Lager › Bestand (Aufteilung der Buchungen, Kategorie), Dienste › Stunden (Uhrzeit, Fortschritt), Kontoauszug (Verwendungszweck), Mitglieder-App › Bereiche (Beschriftungen unter den Spaltenköpfen). Die Liste der Mitglieder-App bricht lange Namen um, statt die Knöpfe aus der Karte zu schieben.
- **Für Entwickler:** Der Design-Prüfstand hat zwei neue Regeln, die den Fehler am alten Stand finden: `tabelle-scrollt-seitlich` (keine Tabelle scrollt seitlich, gleich in welchem Rahmen; Ausnahme: die Zusage-Matrix im Spielbetrieb) und `spalte-verdeckt` (eine klebende Spalte verdeckt keine andere). Neue Testreihe `afl`.

**Datensicherung nach Dropbox: ehrlicher Verbindungstest und verständliche Fehler**
- **„Verbunden“ heißt jetzt wirklich: Sicherungen kommen an.** Beim Verbinden und bei „Testen“ legt Clubwerk eine kleine Testdatei im Sicherungsordner an, findet sie in der Liste wieder und löscht sie. Vorher fragte der Test nur das Dropbox-Konto ab und meldete „in Ordnung“, obwohl Dropbox das Speichern ablehnte. So fiel das erst bei der nächtlichen Sicherung auf.
- **Fehlermeldungen mit dem nächsten Schritt:** fehlende Berechtigung („files.content.write“ in der Dropbox-App anhaken, dann neu verbinden), Speicher voll, E-Mail-Adresse des Dropbox-Kontos nicht bestätigt, Verbindung abgelaufen, falscher Code und mehr. Bei der Meldung „other“, mit der Dropbox ohne Grund ablehnt, nennt Clubwerk zuerst die fehlenden Häkchen in der Dropbox-App (files.content.write, files.content.read, files.metadata.read, danach neu verbinden). Das war die Ursache im Verein: Ohne diese Häkchen lehnt Dropbox jeden Upload so ab.
- Im Protokoll stehen jetzt HTTP-Status, Fehlerart und die Request-Id von Dropbox (für den Dropbox-Support), nie ein Zugangsschlüssel.
- Die Anleitung erklärt, dass die Häkchen unter „Permissions“ vor dem Verbinden gesetzt werden müssen und nach einer Änderung neu verbunden werden muss.

**iPhone/iPad: Cursor in Fenstern wieder im Feld**
- In Fenstern mit Eingabefeldern (z. B. Einstellungen › Datensicherung › Dropbox: „App key“) zeichnete Safari den blinkenden Cursor beim Tippen deutlich unterhalb des Feldes. Ursache ist ein Fehler in Safari (iOS 26): Ist die Seite hinter dem Fenster weit nach unten gescrollt, verrutscht der Cursor, sobald die Tastatur aufgeht. Jetzt steht die Seite hinter dem Fenster während der Eingabe kurz auf ihrem Anfang (sie sieht dabei unverändert aus) und ist nach dem Tippen wieder genau an derselben Stelle. Das gilt für alle Fenster in Verwaltung, Tablet, Mitglieder-App und Beregnung.
- Der Design-Prüfstand prüft das jetzt bei jedem Fenster mit Eingabefeld am Handy, auch in Safari-Technik (Regeln `caret-seite-gescrollt` und `fenster-springt`).

**Fehler behoben: Beregnung mit Hunter Hydrawise – „Keine Verbindung“ und gescheiterter Stopp (Beregnung 1.15.0)**
- **Was passiert war:** Platz starten, gleich wieder stoppen – danach stand „Keine Verbindung zur Bewässerungsanlage“, alle Kacheln waren gesperrt und der Stopp scheiterte. Ursache ist die Bremse von Hydrawise: Je Konto nimmt Hydrawise nur 3 Schaltbefehle in 30 Sekunden und 30 Aufrufe in 5 Minuten an, darüber antwortet es mit „zu viele Anfragen“. Clubwerk fragte nach jedem Befehl sofort neu nach, schickte beim Stoppen für jede Zone einen eigenen Befehl, vergaß bei einer solchen Antwort den letzten Stand der Anlage und fragte dann noch öfter. Das Konto teilen sich oft weitere Programme (z. B. die Hydrawise-Integration in Home Assistant oder eine alte Webapp), dann ist die Grenze schnell erreicht.
- **Jetzt:** Clubwerk zählt die eigenen Aufrufe und hält Abstand, fragt nur so oft nach, wie Hydrawise es erlaubt, und viele offene Handys teilen sich eine Abfrage. Gestoppt wird nur die Zone, die wirklich läuft. Bremst Hydrawise trotzdem, bleiben Anzeige und Kacheln mit dem letzten Stand da („Die Steuerung bremst gerade (zu viele Anfragen)“).
- **Ein Stopp geht nie verloren:** Er wird gespeichert (auch über einen Neustart), automatisch nachgeholt, sobald Hydrawise wieder annimmt, und hat Vorrang vor allem anderen. Die Kachel zeigt „Stopp wird nachgeholt“ mit Countdown, der Verlauf „Stopp nachgeholt“. Ein Start wartet ebenso, statt als Fehler zu enden.
- **Hinweis in der Verwaltung**, wenn Hydrawise öfter bremst: „Teilt sich das Hydrawise-Konto mit anderen Programmen?“ (Beregnung › Bedienen und Übersicht).
- Bei „Hydrawise über Home Assistant“ schließt Clubwerk beim Stoppen nur noch offene Ventile, denn auch dort geht jeder Befehl an die Hydrawise-Cloud. Zugang und Flutlicht sprechen nur mit dem eigenen Home Assistant und waren nicht betroffen.
- Für Entwickler: neue Testreihe `berlimit` mit einer Hydrawise-Nachbildung, die die Grenzen durchsetzt (`hilfen/hw_limit_mock.js`).

**Mitglieder-App: Die Karte „Benachrichtigungen einschalten“ nennt jetzt, worüber es wirklich Hinweise gibt**
- Der Satz auf der Karte war fest („Spieltage, Dienste und Nachrichten“). Jetzt nennt er genau die Bereiche, aus denen der Vorstand Hinweise freigegeben hat und die es im Verein gibt, zum Beispiel „Damit du Platzbuchungen, Spieltage, Dienste und Nachrichten vom Verein nicht verpasst.“ – in der Reihenfolge der App-Leiste, höchstens vier, bei mehr „… und mehr“.
- Ohne Spielbetrieb steht dort kein „Spieltage“; Platzbuchungen kommen dazu, sobald das Buchungssystem aktiv ist; nicht freigegebene Hinweise werden nicht genannt.
- Englisch (britisch) mit passender Aufzählung. Es gibt keine neue Einstellung.

**Plätze: Mitspieler dürfen eine Buchung stornieren (Buchung 1.28.0)**
- Wer als Mitspieler in einer Buchung steht, kann sie jetzt in der App und am Tablet stornieren – für alle, mit derselben Frist wie der Buchende. Vorher stand dort fälschlich „Diese Buchung kannst du nicht mehr stornieren“, auch wenn die Frist noch lange nicht vorbei war.
- Das Fenster sagt jetzt, was passiert: „Die Buchung von Max Muster wird für alle storniert.“ Ist die Frist vorbei, steht dort der echte Grund („Stornieren geht nur bis … Minuten vor Beginn.“ bzw. „Die Buchung hat schon begonnen.“). Wer weder gebucht hat noch mitspielt, liest „Gebucht hat … – nur er/sie oder ein Mitspieler kann stornieren.“
- Ändern bleibt beim Buchenden, Serien bleiben beim Buchenden, Turnierspiele weiter nur unter „Turniere“.
- Eine Gebühr entfällt genau wie beim Storno durch den Buchenden (der offene Posten des Buchenden wird einmal zurückgenommen). Der Buchende und die anderen Mitspieler bekommen eine E-Mail und – falls vom Vorstand freigegeben – den Push-Hinweis „Buchung storniert“. In der Verwaltung steht „storniert von <Name> (Mitspieler)“, das Protokoll nennt den Namen.

## 2026.11.16

**Mitglieder-App: Anleitung für jedes Handy, neue Einladungs-E-Mail, Vereinsname als Pflicht, zwei Fehler in Hinweisen**
- **„Für mich“ zeigt immer nur die Karte, die als Nächstes nötig ist, passend zum Handy:**
  - **iPhone/iPad** (Safari, Chrome, Firefox, Edge): „Teilen-Symbol antippen → Zum Home-Bildschirm → von dort öffnen“. Nie mehr „unten auf Teilen“: je nach Einstellung sitzt die Leiste oben, unten oder im Menü „…“, das Symbol ist als Bild dabei. Der Kasten „Auf den Home-Bildschirm“ mit dem Übernahme-Code sagt dasselbe neutral; solange er offen ist, gibt es keine zweite Karte.
  - **Eingebettete Browser** (Gmail, Outlook, WhatsApp, Instagram, Facebook …): zuerst „In Safari öffnen“ (iPhone) bzw. „Im Browser öffnen“ (Android), mit „Adresse kopieren“ als Ausweg.
  - **iOS vor 16.4:** ehrlicher Hinweis, dass dort keine Benachrichtigungen möglich sind.
  - **Android:** Push geht ohne Startbildschirm – dort kommt gleich „Einschalten“. **Desktop, Huawei ohne Google-Dienste, sehr alte Geräte:** keine Karte statt einer falschen Anleitung.
  - Erkannt wird über Merkmale des Browsers (Push, Home-Bildschirm-App), der Gerätename ergänzt nur Version und eingebettete Browser.
- **Einladungs-E-Mail neu:** Betreff „Dein Zugang zur Mitglieder-App – bitte am Handy öffnen“; gleich nach der Anrede „Öffne diese E-Mail auf deinem Handy und tippe auf den Knopf“; großer Knopf „App jetzt freischalten“ über die ganze Breite (gültig bis …, nur für dich); drei Schritte mit der Nummer direkt am Text (vorher stand die Nummer weit links, der Text weit rechts); darunter die Adresse als Text und „Fragen? Antworte einfach“. Der Einladungsbrief (Aushang) sagt zum Home-Bildschirm ebenfalls nur noch „Die App zeigt dir genau, wie“. Lange Adressen laufen in Mails nicht mehr über den Rand.
- **Vereinsname ist Pflicht:** Der Einrichtungs-Assistent verlangt ihn beim Anlegen des Kontos. Fehlt er, meldet die Datenqualität „Vereinsname fehlt“ in Rot (Knopf zur Einstellung), das Feld in den Einstellungen bleibt leer statt „Unser Verein“ zu zeigen, und es werden keine E-Mails und Push-Hinweise verschickt, bis er eingetragen ist.
- **Fehler behoben (Buchung 1.26.2):** Die Erinnerung vor dem Spiel nannte allen dieselbe Mitspielerliste – der Empfänger stand selbst als Mitspieler da, der Bucher fehlte. Jetzt sieht jeder die anderen Beteiligten (Bucher und Mitspieler), nie sich selbst.
- **„from <App-Name>“ unter Hinweisen auf dem iPhone:** kommt von iOS selbst. iOS zeigt bei Hinweisen einer Home-Bildschirm-App „from <Name der App>“ an, der Text steht nicht in unseren Hinweisen und lässt sich je Hinweis nicht ändern. Der Name stammt aus dem Namen der App (Manifest); beim „Zum Home-Bildschirm“ lässt er sich auf dem iPhone ändern. Quellen: WebKit-Blog „Web Push for Web Apps on iOS and iPadOS“ und die Dokumentation von PushAlert (beide beschreiben „from App-Name“); am Gerät nicht nachgeprüft.
- Für Entwickler: Karten-Entscheidung als reine Funktion `cwPushPlan` (Testreihe `pushwahl` prüft die Matrix aller Plattformen), Mail-Layout mit `card.steps`, breitem Knopf (`button.wide`, `buttonTop`), Testreihe `vname`; der Design-Prüfstand zeigt zehn Fälle (iPhone Safari/Chrome/Gmail/iOS 15, Android Chrome/Samsung/Gmail, einschalten, gesperrt).

**Verbessert: Die Demo je Modul braucht weniger Arbeitsspeicher**
- Die abgeschottete Demo-Kopie (Einstellungen › Module › „Demo“) gibt kurzlebigen Arbeitsspeicher schneller zurück und braucht dadurch rund 15 MB weniger (etwa 135 statt 150 MB). Am Aussehen und Verhalten der Demo ändert sich nichts.

**Neu: Umfragen in der Mitglieder-App (Verein & System › Nachrichten)**
- An eine Nachricht in der App lässt sich eine **Umfrage** hängen: Frage, 2 bis 10 Antworten, eine oder mehrere Antworten, auf Wunsch anonym, mit Ende oder bis zum Beenden. Beispiele: Termin der Weihnachtsfeier, Trikotfarbe, Meinungsbild.
- Mitglieder stimmen in der Nachricht ab und können ihre Stimme bis zum Ende ändern. Das Ergebnis sehen sie – je nach Einstellung – nach der eigenen Stimme, erst nach dem Ende oder gar nicht. Offene Umfragen stehen unter „Für mich › Zu erledigen“.
- Unter „Gesendet“ steht das Ergebnis mit Beteiligung und – wenn nicht anonym – wer was gewählt hat (Nachname, Vorname). „Umfrage beenden“ beendet sie sofort; „Weiterverwenden“ übernimmt die Umfrage ohne Stimmen.
- Anonym heißt: Niemand in Clubwerk sieht, wer was gewählt hat. Für geheime Wahlen nach Satzung ist das kein Ersatz. Stimmen verschwinden mit der Nachricht.
- Für Entwickler: Tabelle `msg_vote`, Spalten `poll`/`poll_closed_at` an `mail_message`, neue Testreihe `umfr`.

**Neu: QR-Code für die Überweisung – auf Rechnungen, Mahnungen und in der App**
- Rechnungen und Mahnungen der Mitgliederverwaltung und Rechnungen der Buchhaltung tragen neben der Bankverbindung einen QR-Code. Die Banking-App liest daraus Empfänger, IBAN, Betrag und Rechnungsnummer – nichts muss mehr abgetippt werden. Der Code entsteht im Vereinsheim, ohne Internet und ohne Gebühren. Bei Lastschrift und Gutschriften gibt es keinen Code.
- **Mitglieder-App › Meine Daten › Zahlungen:** Wer per Rechnung oder bar zahlt oder eine Mahnung bekommen hat, sieht den Knopf „Überweisen“. Er zeigt den QR-Code (zum Scannen am Rechner oder von einem zweiten Gerät) und Empfänger, IBAN, Betrag und Verwendungszweck zum Kopieren. Offene Posten ohne Rechnungsnummer bekommen dabei eine. Auch „Für mich“ führt bei offenen Beträgen direkt dorthin. Wer per Lastschrift zahlt, sieht den Knopf nicht, damit niemand doppelt zahlt.
- **Kontoauszug:** Zahlt jemand mehrere Rechnungen mit einer Überweisung (mehrere Rechnungsnummern im Verwendungszweck) und passt die Summe genau, schlägt Clubwerk jetzt **eine** sichere Zuordnung für alle vor. Bisher wurde daraus je Rechnung eine „Überzahlung“.
- Auf Rechnungen der Mitgliederverwaltung steht als Empfänger jetzt der Kontoinhaber aus Einstellungen › Bankkonten (wie schon bei der Buchhaltung), damit die Bank den Namen bei der Empfängerprüfung bestätigt.
- Module: Mitglieder 1.35.0, Buchhaltung 1.13.0. Für Entwickler: `src/girocode.js` (EPC-QR nach EPC069-12, Version 002), neue Testreihe `giro`.

**Neu: Kalender der Homepage in der App und persönliches Kalender-Abo**
- **Dienste & Termine › Einstellungen › Kalender der Homepage:** Hat eure Homepage einen Kalender zum Abonnieren, tragt ihr dort den Abo-Link ein (webcal:// oder https://). Clubwerk holt die Termine jede Stunde ab und zeigt sie in der Mitglieder-App im Reiter „Termine“ als „Vereinskalender“ (Antippen zeigt die Beschreibung) und die nächsten drei auf der Startseite „Für mich“. Gepflegt wird weiter auf der Homepage. Serientermine, ganztägige und mehrtägige Termine werden erkannt, abgesagte fallen weg. Ist die Homepage einmal nicht erreichbar, bleibt der letzte Stand.
- **Mitglieder-App › Mehr › Kalender abonnieren:** ein persönlicher Link für den Kalender des Handys (iPhone, Android, Outlook). Darin stehen die eigenen Dienste, zugesagten Termine, Platzbuchungen und Spiele der eigenen Mannschaften, ohne Namen anderer. Der Kalender hält sich selbst aktuell. „Neuer Link“ macht den alten ungültig, „Abo beenden“ löscht ihn; wird das Handy entfernt, gilt der Link nicht mehr. Unterwegs klappt das, wenn die App eine öffentliche Adresse hat.
- Module: Dienste & Termine, Plätze und Spielbetrieb mit neuer Version. Für Entwickler: `src/ical.js` (Kalenderdateien lesen), `src/kalender.js` (Abo-Link, Hook `calendarEvents`), neue Testreihe `kal`.

## 2026.11.15

**Benachrichtigungen: Mitglieder schalten nur noch ihr Handy an oder aus – und „Für mich“ erinnert daran**
- **Wieder wie festgelegt:** Unter „Mein Konto › Benachrichtigungen“ gibt es nur noch den Schalter für dieses Handy. Die Auswahl einzelner Hinweise (Spieltage, Dienste, Termine, Nachrichten …) ist weg – welche Hinweise kommen, bestimmt allein der Vorstand unter Mitglieder-App › Benachrichtigungen. Das Blatt zeigt zur Information, aus welchen Bereichen Hinweise kommen. Wer früher einzelne Hinweise abgewählt hatte, bekommt sie jetzt wieder (die gespeicherten Abwahlen werden beim Start gelöscht und nicht mehr beachtet).
- **Neue Karte oben in „Für mich“: „Benachrichtigungen einschalten“** – „Damit du Spieltage, Dienste und Nachrichten vom Verein nicht verpasst.“ mit **Einschalten** und **Später** (blendet die Karte 14 Tage aus, danach kommt sie wieder). Nach dem Einschalten verschwindet sie. Sie erscheint nur, wenn der Vorstand Hinweise freigegeben hat und dieses Handy noch keine bekommt.
  - **iPhone im Safari:** Die Karte erklärt in drei Schritten (Teilen → „Zum Home-Bildschirm“ → von dort öffnen), denn Push gibt es auf dem iPhone erst in der Home-Bildschirm-App.
  - **Im Handy gesperrt:** Die Karte sagt kurz, wo man es in den Einstellungen wieder erlaubt.
- Unverändert: Erinnerungen per E-Mail (z. B. „Helfer am Vortag per E-Mail erinnern“ und „Deine Erinnerung“ bei den Gratulationen für Benutzer mit dem Recht „Gratulationen“) und ihre Einstellungen.
- Anleitung (Kern, Turniere) und Planungsdateien angepasst. Turniere 1.10.2 (nur Anleitung). Für Entwickler: `PUT /api/push/events` und `push.setEvents` entfallen, `GET /api/forme` liefert `push: { released, mine }`; neue Testreihe `pushwahl` scheitert, sobald es wieder eine Auswahl je Anlass für Mitglieder gibt; der Design-Prüfstand prüft die Karte in drei Zuständen (einschalten, gesperrt, iPhone).
## 2026.11.14

**Neu: „Abgerechnet bis“ für alle auf einmal setzen (Beiträge & Zahlungen › Beitragslauf)**
- Für den Umstieg aus einem anderen Programm: Wurden die Beiträge bis zu einem Tag schon dort abgerechnet oder eingezogen (dort oft „gebucht bis“), trägt man das jetzt für alle Mitglieder auf einmal ein. Der nächste Beitragslauf berechnet diese Zeit dann nicht noch einmal. Es entstehen keine Posten, vorhandene Posten bleiben unverändert.
- Wählbar: Datum (vorgeschlagen: Ende des letzten Beitragsjahres), Beitragsarten und Abteilungen (ohne Auswahl alle). Zusatzbeiträge der Abteilungen und Familien zählen mit.
- Das Datum geht nur vorwärts. Zurücksetzen geht nur mit eigenem Häkchen und roter Warnung – und nie hinter Posten, die Clubwerk selbst schon berechnet hat.
- **Vorschau:** wie viele Beiträge bei wie vielen Mitgliedern sich ändern, von welchem auf welches Datum, wer übersprungen wird (schon später abgerechnet, ausgetreten, beginnt erst später, befreit, über die Familie abgedeckt, ohne Beitrag) und wie viel ein Beitragslauf dadurch nicht mehr berechnet. Warnung, wenn das Datum in der Zukunft oder mitten in einem Beitragsjahr liegt. Liste zum Aufklappen und als Excel.
- **Sicherheitsabfrage:** Zusammenfassung, das Wort SETZEN eintippen und mit dem eigenen Passwort bestätigen. Hat sich seit der Vorschau etwas geändert, braucht es eine neue Vorschau. Nur mit dem Recht „Beitragslauf, Lastschriften …“.
- **Zurücknehmen:** Die letzte Änderung lässt sich zurücknehmen, solange danach kein Beitragslauf lief. Ein älterer Beitragslauf lässt sich erst zurücknehmen, wenn die Änderung danach zurückgenommen ist – sonst würde doppelt berechnet.
- Jede Änderung steht im Protokoll, in der Historie der Mitglieder und im Änderungsjournal der Buchführung (jetzt auch für die Zusatzbeiträge der Abteilungen).
- Module: Mitglieder 1.34.0. Neue Testreihe `gbis`.

## 2026.11.13

**Neu: Einstellungen › Buchführung – vorbereitet für Steuerberater und Betriebsprüfung (GoBD)**
- **Änderungsjournal:** Clubwerk hält jede neue, geänderte oder gelöschte Zeile mit Geld oder Belegen fest – wann, wer, vorher und nachher. Das gilt für Verkäufe, Deckel, Veranstaltungen, Lieferungen, Artikelpreise, Forderungen, Lastschriften, Mahnungen, Rechnungen, Spendenquittungen und Nenngeld, egal an welcher Stelle etwas geändert wird. Jeder Eintrag ist mit dem vorigen verkettet. „Jetzt nachrechnen“ (und jede Nacht die Datenqualität) zeigt, ob etwas fehlt oder verändert wurde. Beim ersten Start hält Clubwerk den vorhandenen Stand einmal fest.
- Das Journal bleibt mindestens 10 Jahre, auch wenn ein Mitglied anonymisiert wird – so bleibt nachvollziehbar, wer eine Forderung oder Lastschrift schuldete. Unter Datenschutz lässt sich die Frist nicht kürzer stellen.
- **Belege bleiben, wie sie ausgestellt wurden:** Rechnungen, Stornorechnungen und Spendenquittungen speichert Clubwerk beim Erstellen als PDF. Danach kommt immer genau diese Datei, auch wenn sich Anschrift, Steuernummer oder Unterschrift später ändern; eine veränderte Datei fällt auf. Ältere Rechnungen werden beim nächsten Öffnen festgehalten. Zahlungserinnerungen nennen weiter die aktuelle Anschrift.
- Gelöschte Lieferbelege bleiben 11 Jahre im Papierkorb (bisher 90 Tage).
- **Konten und Sphären:** Je Zahlweg ein Geldkonto und je Erlösart (Verkauf je Artikelkategorie, Beiträge, Abteilungsbeiträge, Aufnahmegebühren, Rechnungen je Steuersatz, Platz- und Lichtgeld, Nenngeld …) ein Konto und eine Sphäre: ideeller Bereich, Vermögensverwaltung, Zweckbetrieb oder wirtschaftlicher Geschäftsbetrieb. Clubwerk schlägt Sphären vor; die Zuordnung stimmt ihr mit dem Steuerberater ab.
- **DATEV-Buchungsstapel:** alle Zahlungseingänge, die durch Clubwerk laufen, für einen Zeitraum im DATEV-Format. Rücklastschriften, Stornos und „wieder offen“ erscheinen als Gegenbuchung. Die Vorschau zeigt die Summen je Sphäre und warnt bei mehr als 45.000 € im Zweckbetrieb oder 50.000 € im wirtschaftlichen Geschäftsbetrieb.
- **Datenüberlassung für die Betriebsprüfung:** ein ZIP je Jahr im Beschreibungsstandard der Finanzverwaltung mit allen Tabellen mit Geld und Belegen, dem Änderungsjournal und den Zahlungseingängen – ohne PINs, Passwörter und Kontonummern.
- „Bisherige Exporte“ merkt sich jeden Export und zeigt „seitdem geändert“, wenn im Zeitraum später noch etwas erfasst oder storniert wurde.
- Bitte den ersten DATEV-Export mit dem Steuerberater abstimmen (Konten, Kontenrahmen, Import in sein Programm).
- Module: Buchhaltung 1.12.0, Mitglieder 1.33.0, Buchung 1.26.1, Flutlicht 1.1.1, Turniere 1.10.1. Für Entwickler: neue Hooks `gobdTables` und `gobdKeys` (src/gobd.js), neue Testreihe `gobd`.

## 2026.11.12

**Tempo, Teil 2: kleinere Ziffernschrift und flüssiger Verkauf am Tablet bei langen Artikellisten**
- **Schriften:** Die Ziffernschrift (Uhrzeit, Beträge) ist von 21 auf 4 kB geschrumpft, die Textschrift bleibt unverändert (eine gekürzte Fassung ließ im Design-Prüfstand Texte anders umbrechen und wurde deshalb nicht übernommen). Die Startschrift wird beim Öffnen der App und der Verwaltung gleich mit geladen, damit der Text nicht erst in der Ersatzschrift erscheint. Aussehen und Zeichenvorrat (Umlaute, ß, €, Akzente) sind unverändert; Tablet und Verwaltung nutzen dieselben Dateien und profitieren mit.
- **Tablet-Verkauf:** Wer einen Namen antippt, sah bei sehr langen Artikellisten (400 Artikel, getestet auf einem Tablet mit 4× langsamerer CPU) erst nach rund 14 Sekunden die Kacheln, weil die Anordnung zu viele Varianten durchprobierte. Jetzt dauert es rund 4 Sekunden (gleiche Anordnung wie vorher, Messung: dieselbe Dichte, dieselbe Kachelbreite). Bei normalen Listen (bis 80 Artikel) ändert sich nichts an der Anordnung, sie wird aber ebenfalls schneller, weil die Schrift nicht mehr für jeden Namen einzeln ausgelesen wird.
- Buchung, Preise und Konten sind unverändert; die Abfragen am Server brauchen auch bei 2 500 Mitgliedern, 400 Artikeln und 30 000 Buchungen nur wenige Millisekunden (Buchen 3 ms, Namensliste 58 ms).
- **Tests:** Reihe `apptempo` prüft Schriftgrößen, die Vorladung und die Zahl der Schriftabfragen der Kachel-Anordnung (vorher 11 600, jetzt 31).

## 2026.11.8

**Mitglieder-App: kein kurzes „Mitglieder-App“ mehr beim Start**
- Die Überschrift oben blieb beim Start kurz auf dem Platzhalter „Mitglieder-App“ stehen und sprang dann auf „Für mich“. Jetzt bleibt sie leer, bis der richtige Titel feststeht.

## 2026.11.11

**Safari-Technik (WebKit) wird jetzt in jeder Prüfung mitgetestet – und zwei echte Safari-Fehler sind behoben**
- Auswahlfelder (zum Beispiel „Alle Mannschaften“ im Spielbetrieb) waren in Safari am Handy 49 statt 40 Pixel hoch und standen damit schief neben den Knöpfen. Jetzt überall 40 Pixel.
- Die helle Nebenschrift auf den grünen Hauptkarten („Zu erledigen“ in der Verwaltung, Termine im Tablet) war auf dem hellsten Teil des Verlaufs zu blass (3,8 : 1). Sie ist jetzt kräftiger (über 4,5 : 1), wie es die Vereinsfarbe schon immer bekam.
- Sonst nichts: Alle übrigen Ansichten (Verwaltung, Tablet, App, Einrichtung; Demo, lange Namen, frische Installation) bestehen die Prüfung auch in der Safari-Technik.

## 2026.11.10

**Datensicherung: wöchentliche Probe-Wiederherstellung vom Ziel außer Haus**
- Jeden Sonntag nach der Sicherung (statt einmal im Monat) holt Clubwerk die neueste Sicherung reihum von einem Sicherungsziel zurück – ohne Ziel nimmt es die Datei hier – und vergleicht sie mit der Datei hier (Prüfsumme).
- Die Probe startet Clubwerk abgeschottet mit dieser Sicherung (wie nach einem Totalausfall, mit allen Modulen) und zählt die wichtigsten Daten: Konten, Mitglieder, offene Posten, Verkäufe, Platzbuchungen, Belege und mehr. Hier wird dabei nichts verändert.
- Ist eine Zahl in der Sicherung weniger als halb so groß wie jetzt, erscheint ein gelber Hinweis „Sicherung wirkt unvollständig“. Beschädigte oder unlesbare Sicherungen geben eine rote Warnung, auch in der Übersicht, und eine E-Mail an die Sicherheits-Adresse.
- Neue Karte „Probe-Wiederherstellung“ auf der Seite Datensicherung mit Ergebnis, Quelle, Zählerständen, vorheriger Probe und „Jetzt prüfen“.
- Nach jedem Hochladen prüft Clubwerk, ob die Datei vollständig am Ziel liegt. Ein voller Speicher oder ein abgebrochener Upload fällt so sofort auf.
- **Passwort-Probe:** Ein halbes Jahr nach dem Festlegen fragt die Seite, ob das notierte Sicherungspasswort noch passt.
- Für Entwickler: neuer Hook `probeCounts` (Zählerstände je Modul); alle Module liefern ihre wichtigsten Anzahlen. Neue Testreihe `probe`, Reihe `targets` erweitert.

## 2026.11.9

**Neu: Einstellungen › Datenqualität**
- Clubwerk prüft jede Nacht, ob die Daten zueinander passen, und zeigt die Funde in einem neuen Reiter unter Einstellungen. Geprüft wird zum Beispiel: Lastschriftzahler ohne gültiges Mandat, Lastschriften, die nicht als bezahlt gebucht sind, Familienmitglieder ohne Oberhaupt (etwa weil das Oberhaupt ausgetreten ist), offene Posten gelöschter Mitglieder, gelöschte Konten am Tablet mit offenem Betrag und abgelaufene Einladungen.
- Jeder Fund sagt, warum er schadet, und hat einen Knopf, der direkt zur Stelle führt, an der man ihn behebt. Geld korrigiert Clubwerk nie von selbst.
- Echte Fehler (rot) erscheinen zusätzlich in der Übersicht. „Jetzt prüfen“ startet die Prüfung sofort.
- Module können eigene Prüfungen beitragen (Mitglieder 1.31.7 macht den Anfang).

## 2026.11.8

**Mitglieder-App: kein kurzes „Mitglieder-App“ mehr beim Start**
- Die Überschrift oben blieb beim Start kurz auf dem Platzhalter „Mitglieder-App“ stehen und sprang dann auf „Für mich“. Jetzt bleibt sie leer, bis der richtige Titel feststeht.

## 2026.11.7

**Mitglieder-App: deutlich schnellerer Start, vor allem bei schlechtem Netz**
- Gemessen an einem Handy mit langsamer CPU (4× gedrosselt) und langsamem Netz (Fast 3G): Kaltstart bis „Für mich“ sichtbar **4,8 s → 1,6 s**, Start mit schon geladener App **3,7 s → 1,1 s**; Anfragen beim Start 28 → 15, übertragene Daten beim Warmstart 28 kB → 3 kB.
- Die App lädt beim Start nicht mehr alle Bereiche (Plätze, Nachrichten, Dienste, Licht, Türen …) nacheinander, sondern nur noch „Für mich“. Ein Bereich wird erst geholt, wenn man ihn antippt – und seine Dateien kommen gleichzeitig statt eine nach der anderen.
- Die ersten beiden Abfragen („wer bin ich“ und „Für mich“) starten schon, während die App noch lädt. Das spart eine komplette Wartezeit des Netzes.
- Dateien mit Versionsnummer (App, Stile, Bereiche) bleiben ein Jahr im Speicher des Handys und werden nicht mehr bei jedem Start erneut angefragt. Bei einem Update ändert sich die Nummer, dann lädt die App alles neu.
- Funktion, Rechte und Datenschutz sind unverändert; es kommen keine zusätzlichen externen Anfragen dazu.
- **Neue Testreihe `apptempo`:** prüft Zwischenspeicher-Regeln, Kompression, Zahl der Anfragen und Datenmenge beim Kalt- und Warmstart (Zählwerte, keine Uhrzeit-Messung).

## 2026.11.6

**Mitglieder-App: Beschriftungen der unteren Leiste mit klarem Abstand**
- In 2026.11.5 brach „Nachrichten“ nicht mehr um, stand aber fast Kante an Kante neben „Meine Daten“ (nur 2–4 px). Jetzt haben benachbarte Beschriftungen mindestens 8 px Abstand zwischen den Buchstaben, bei jeder Breite von 320 bis 430 px und auch, wenn Safari breiter schreibt.
- Die Spalten der Leiste richten sich nach der Länge der Beschriftung (statt alle gleich breit). Reicht der Platz nicht, wird zuerst die Schrift etwas kleiner (nie unter 10 px), und erst dann brechen Beschriftungen mit mehreren Wörtern an ihrem Leerzeichen um („Für / mich“, „Meine / Daten“) – nie mitten im Wort.
- **Design-Prüfstand:** neue Regel „Textabstand“ (Leisten der App, Reiter, Segmente, Chips und Tablet-Kopfzeile: mindestens 8 px zwischen den Textkanten, jede Beschriftung bleibt in ihrer Spalte).

## 2026.11.5

**Mitglieder-App: Beschriftungen der unteren Leiste brechen nie mehr mitten im Wort um**
- Am iPhone stand in der unteren Leiste „Nachrichte“ und darunter „n“. Der Grund: Safari setzt Schrift etwas breiter als andere Browser, und die Leiste teilte dann das Wort. Jetzt wird die Schrift der ganzen Leiste in kleinen Schritten kleiner, bis jede Beschriftung ganz auf einer Zeile steht – bei jeder Breite von 320 bis 430 px, mit den längsten Namen („Nachrichten“, „Meine Daten“, „Beregnung“, „Spieltage“) und auch dann, wenn Safari 9 % breiter schreibt.
- **Seitentitel der App** („Dienste & Termine“) und Vereinsname oben enden nicht mehr mit „…“, sondern brechen an Leerzeichen um.
- **Verwaltung am Handy:** Der Vereinsname im Kopf brach bei langem Seitennamen mitten im Wort („Musterstad / t“). Knöpfe in Handy-Listen (z. B. „Herunterladen … / Wiederherstellen …“ bei den Schnappschüssen) rutschen in die nächste Zeile, statt aus der Karte zu ragen. Lange Schilder („gehört nicht zu Clubwerk“) und der Postentext in Offene Posten brechen um statt abgeschnitten zu werden.
- **Design-Prüfstand geschärft:** neue Regel „Wort getrennt“ (kein Wort steht über zwei Zeilen, auf allen Oberflächen; Trennung mit sichtbarem Bindestrich bleibt erlaubt), ein **Safari-Puffer** (Handy-Ansichten von Tablet, Verwaltung und App zusätzlich mit rund 9 % breiterem Text, weil WebKit in der Cloud fehlt) und die Leiste der App wird bei 320, 360, 375, 390 und 430 px mit den längsten Beschriftungen aller Module geprüft. Die Bilder der Befunde zeigen jetzt die markierte Stelle.

## 2026.11.4

**Zugang und Beregnung: Geräte nur noch mit Passwort zuordnen**
- Bekommt eine Tür oder eine Beregnungszone ein Gerät aus Home Assistant (neue Tür/Zone oder ein anderes Gerät), fragt Clubwerk jetzt nach dem **eigenen Passwort**. Umbenennen, Reihenfolge, Laufzeiten und Löschen gehen weiter ohne Passwort. Das gilt auch beim Import von Einstellungen aus einer Datei: Die Vorschau sagt vorher, dass das Passwort nötig ist.
- Wer **nicht alle Rechte** hat (z. B. nur das Recht „Zugang“ oder „Beregnung“), sieht und wählt nur noch Geräte des eingestellten Herstellers. „Gemischt / anderer Hersteller“ mit freier Wahl aller Geräte richtet nur noch ein Benutzer mit allen Rechten ein. So kann niemand ohne alle Rechte z. B. die Alarmanlage als Tür eintragen.
- Die Sicherheitswarnung an den Vorstand bei geänderten Geräten bleibt wie bisher.
- Anleitungen von Zugang und Beregnung ergänzt, neue Testreihe `geraet`.
- Nicht geändert (Entscheidung): Erweiterungen dürfen weiter auch über die normale Verwaltung mit Passwort hochgeladen werden; falsche PINs am Tablet lösen weiter nur eine Warnung aus.

**Falsches Passwort bei einer Bestätigung meldet nicht mehr ab**
- Wer sich bei einer Rückfrage mit Passwort vertippte (z. B. Datenbank wiederherstellen, Tresor, Sicherungsziel), landete auf der Anmeldeseite, obwohl er angemeldet blieb. Jetzt kommt nur die Meldung „Dein Passwort stimmt nicht.“

**Datensicherung**
- **Wiederherstellen vom NAS (SFTP):** Unter Last konnte die heruntergeladene Sicherung noch leer oder halb sein, wenn Clubwerk sie las („Das ist keine Komplettsicherung“). Clubwerk wartet jetzt, bis die Datei ganz geschrieben ist. Alle anderen Ziele (WebDAV, FTP, Dropbox) und Uploads sind geprüft – dort war es schon richtig.
- **Schnappschüsse heißen jetzt `clubwerk_<Datum>_<Anlass>.db`** statt `getraenke_…` (Altlast aus der Getränke-App). Ältere Schnappschüsse mit dem alten Namen stehen weiter in der Liste, lassen sich wiederherstellen und werden beim Aufräumen mitgezählt – immer die ältesten zuerst.

**Kleine Korrekturen**
- **Seitenwechsel:** Verzögerte Abläufe (z. B. die Empfängerzahl bei Nachrichten, Vorschauen beim Tippen, Abfragen nach einem Türbefehl) liefen nach dem Wechsel auf eine andere Seite weiter und erzeugten Fehler im Hintergrund. Sie enden jetzt mit ihrer Ansicht – in der Verwaltung und in der Mitglieder-App. Der Design-Prüfstand prüft das auf jeder Seite und in jedem Reiter.
- **Anleitungen:** Die Bilder von Monatsansichten (Zeiterfassung, Zugang, Beregnung, Flutlicht) entstehen am Monatsanfang aus dem Vormonat, damit sie nicht leer sind. Das Bauen der Anleitungen scheiterte vorher an Monatsersten.
## 2026.11.3

**Abstände: Knöpfe kleben nicht mehr an Ergebnis-Kästen, Kopfleiste deckt den Inhalt**
- **Beiträge & Zahlungen › Lastschriften › „Neuer Einzug“:** Nach „Prüfen“ klebte der Kasten („Keine fälligen Lastschriften.“ oder ein Hinweis) am Knopf. Ergebnisbereiche unter einer Knopf- oder Feldzeile haben jetzt überall in der Verwaltung 12 px Abstand (auch Beitragslauf › Vorschau, Auswertungen).
- **Handy: klebende Kopfleiste** („Unser Verein / Verwaltung“ mit Menüknopf): Beim Scrollen schaute über der Leiste Inhalt heraus (Überschriften, Knöpfe, Kästen). Der Streifen darüber ist jetzt gedeckt.
- **Nachrichten:** Die Auswahlfelder „Vorlage“ und „Platzhalter“ über dem Text standen nur 2 px auseinander, jetzt mehr Luft.
- Die Reiterleiste, die am rechten Rand ausläuft („Rec…“), ist gewollt: Der Verlauf zeigt, dass man seitlich wischen kann.
- **Design-Prüfstand geschärft:** neue Regel „Berührung“ (zwei sichtbare Kästen/Knöpfe/Felder mit weniger als 6 px Abstand), neue Regel „Kopfleiste überdeckt“, und der Prüfstand klickt jetzt lesende Knöpfe (Prüfen, Vorschau, Anzeigen) und prüft auch das Ergebnis – mit Daten und leer.

## 2026.11.1

**Neues Modul „Flutlicht“: Licht der Plätze automatisch zur Buchung oder per Handy**
- Clubwerk schaltet das Flutlicht über Home Assistant, egal von welchem Hersteller: je Platz ein Schalter (`switch.*` oder `light.*`). Das Modul ist einzeln nutzbar und standardmäßig aus (Einstellungen › Module).
- **Automatisch:** Ist ein Platz nach Einbruch der Dunkelheit gebucht, geht das Licht kurz vorher an (Vorlauf) und nach dem Spiel aus (Nachlauf). Aufeinanderfolgende Buchungen bleiben ohne Pause hell. Wird storniert, geht es nach dem Nachlauf aus. Den Sonnenuntergang rechnet Clubwerk selbst aus dem Standort (oder übernimmt ihn aus Home Assistant), mit einstellbarem Versatz.
- **Von Hand:** in der Verwaltung (Seite „Flutlicht“ › Bedienen, auch mit dem neuen Recht „Flutlicht bedienen“), am Tablet (Seite „Licht“, mit Namen und App-PIN) und in der Mitglieder-App (Bereich „Licht“) – Mitglieder nur mit Freischaltung und nur im WLAN des Vereinsheims, nie von unterwegs. „+30 Min.“ verlängert, „Alles aus“ schaltet sofort alles ab.
- **Geht immer von selbst aus:** Jedes Einschalten hat ein festes Ende, das auch einen Neustart oder ein Update übersteht. Zur Nachtruhe (je Wochentag einstellbar) geht alles aus, auch Licht, das jemand in Home Assistant eingeschaltet hat. Nur die Verwaltung darf danach noch einschalten, ebenfalls mit festem Ende. Licht, das außerhalb von Clubwerk angeht, wird übernommen und geht nach der Höchstdauer aus.
- **Zeiten:** Dunkelheit, Nachtruhe, Saison (optional) und Sperrzeiträume.
- **Lichtgeld (optional, standardmäßig aus):** Betrag je angefangene Viertelstunde ab einer Uhrzeit, gebucht wie die Platzgebühr (offener Posten bei den Mitgliedern bzw. aufs Verkaufskonto), mit Storno im Verlauf. Bei Buchungen zahlt der Buchende nur die gebuchte Zeit; Verwaltung, Serien und Vereinsbuchungen sind frei.
- **Verlauf:** wer wann wie lange Licht hatte, Lichtgeld, Betriebsstunden je Lichtanlage im Jahr, Störungen; Excel. Namen werden nach der Frist unter Einstellungen › Datenschutz entfernt (Standard 24 Monate).
- Mit Beispieldaten für die Demo (Schalter nur simuliert), Anleitung auf Deutsch und Englisch (mit Abschnitt „Was brauche ich?“) und Testreihe `fl`.
- **Plätze:** neue Schnittstelle für das Flutlicht (Buchungen eines Tages); sonst unverändert.

**Zeiterfassung: Rückmeldung am Tablet nach einer Schicht über Mitternacht**
- Wer nach Mitternacht ausstempelte, sah am Tablet „Heute 22:24 – 00:29 · 0:00 Std.“, und am Monatsersten stand der neue Monat mit 0 Stunden da. Jetzt zählt die Schicht wie in der Abrechnung zu dem Tag und Monat, an dem sie begann, und der Monatsname passt dazu. Abrechnung, Nachweis und Excel waren nicht betroffen.
- Die Testreihe der Zeiterfassung läuft jetzt zu jeder Uhrzeit grün, auch am Monatsersten kurz nach Mitternacht.

## 2026.11.0

Ab jetzt zeigt die Versionsnummer Jahr und Monat (wie bei Home Assistant). 2026.11.0 folgt direkt auf 3.102.0.

**Sicherheits-Review: Lücken geschlossen, die automatische Tests nicht finden**
Der ganze Programmcode wurde mit dem Blick eines Angreifers gelesen. Gefunden und behoben:
- **Fremde Sicherungen öffnen ist jetzt wirklich abgeschottet.** Bei „Aus Sicherung übernehmen …“ konnte eine präparierte Sicherung einer fremden Installation eigenen Programmcode mitbringen, der beim Öffnen lief. Jetzt laufen dabei nur die mitgelieferten Module, und die Lesekopie ist vom Betriebssystem eingesperrt: Sie darf nur ihren eigenen Ordner lesen und schreiben, keine anderen Programme starten und läuft (im Add-on) als eigener Benutzer ohne Zugriff auf eure Daten.
- **Präparierte Datenbanken:** Eine untergeschobene Datenbank mit versteckten Datenbank-Befehlen (Trigger, Views, Namen mit Sonderzeichen) wird beim Wiederherstellen abgelehnt; beim Start entfernt Clubwerk solche Bestandteile. Eine Lücke beim Umstellen der Kennnummern ließ sonst andere Datenbanken auf der Platte verändern.
- **Riesige gepackte Dateien (ZIP-Bomben):** Beim Entpacken von Kontoauszügen, Modul-Sicherungen, Erweiterungen und Updates zählt Clubwerk jetzt mit und bricht ab, statt der Größenangabe in der Datei zu glauben – sonst konnte eine kleine Datei den Speicher füllen.
- **Unterschriften mit riesigen Bildmaßen** (Online-Antrag, neue Bankverbindung in der App) werden abgelehnt – sie hätten den Server beim Erzeugen des PDFs minutenlang blockieren können.
- **Mitgliederverwaltung:**
  - Wer nur das Recht „Mitglieder“ hat, konnte beim Annehmen eines Antrags („mit vorhandenem Mitglied zusammenführen“) dessen Bankverbindung ändern. Das geht jetzt nur noch mit dem Recht „Bankdaten“.
  - Abteilungsleitungen sahen beim Kind ihrer Abteilung den kompletten Datensatz des Zahlers (Anschrift, E-Mail …), auch wenn dieser in einer anderen Abteilung ist – jetzt nur noch den Namen. Bei Anträgen sehen sie Treffer im Bestand nur aus der eigenen Abteilung und führen nur mit diesen zusammen.
  - Anträge nehmen nur Beiträge an, die im Formular stehen, und höchstens einen weiteren Erwachsenen (Partner/in) – wie die Familienregel es vorsieht.
- **Datensicherung:** Dropbox-Schlüssel ändern, Dropbox verbinden und „lesbare Auszüge“ einschalten gehen jetzt nur mit dem eigenen Passwort (wie bei den anderen Sicherungszielen), dazu kommt eine Sicherheitswarnung. Auch das Herunterladen eines Datenbank-Schnappschusses fragt nach dem Passwort, denn er enthält die Schlüssel der Datensicherung.
- **Buchhaltung:** Eine Rechnung an ein Mitglied lässt sich nicht mehr als „bezahlt“ markieren, solange der Posten gerade per Lastschrift eingezogen wird (sonst zahlte das Mitglied doppelt). Der Funktionsimport prüft die Einstellungen (z. B. Rechnungsnummer-Vorsilbe) genauso wie die Verwaltung.
- **Kontoauszug:** Steht die Kennung eines Lastschrift-Einzugs nur im Verwendungszweck einer Überweisung (den schreibt der Absender selbst), gilt der Vorschlag nie als „sicher“. Und ein Einzug wird nur dann als bezahlt gebucht, wenn mindestens der offene Betrag eingegangen ist.
- **PINs:** Am Tablet warnt Clubwerk den Vorstand, wenn reihum bei vielen Mitgliedern falsche PINs eingegeben werden (ab 25 in 24 Stunden). Die Zeiterfassung und die Vereins-PIN der Beregnung nehmen keine leicht zu erratenden PINs (1111, 1234 …) mehr an; bei der Zeiterfassung setzt ein richtiges Stempeln die wachsende Sperre nicht mehr zurück. Beim Turnierplaner darf die Turnierleitung jetzt deutlich mehr Ergebnisse am Stück eintragen (falsche Codes sperrt seit 3.102.0 die Sperre je Turnier).
- **Clubmeisterschaft:** Aus der App ließ sich die Frist für den Spieltermin mit einem Trick umgehen – behoben.
- **Spielbetrieb:** Mannschaftsführer können in der App nur noch Spieler der Meldelisten aufstellen bzw. für Aufgaben wählen (vorher ließen sich über die Antwort Namen beliebiger Konten auslesen).
- **Plätze:** Einen Serientermin in der App nur noch auf einen freigegebenen Platz derselben Art verlegen (nicht auf ein Gerät oder einen gesperrten Platz). Zwei gleichzeitige Änderungen derselben Buchung legen keine doppelte Gebühr mehr an.
- **Zugang und Beregnung:** Die Sicherheitswarnung bei geänderten Türen bzw. Ventilen kommt jetzt auch beim Funktionsimport und beim ersten Eintragen. Die Beregnung am Tablet ist nur noch erreichbar, wenn sie dort eingeschaltet ist.
- **Push in der App:** Ein Push-Abo, das zu einem anderen Mitglied gehört, lässt sich nicht mehr übernehmen.
- **Demo je Modul:** Die Sperren in der Demo-Kopie (Neustart, Erweiterungen …) ließen sich mit Großbuchstaben in der Adresse umgehen – behoben.
- Neue Testreihe `rev`, die jeden dieser Angriffe nachstellt.

## 3.102.0

**Sicherheits-Durchgang: mehr Schutz gegen Durchprobieren, Angriffe werden jetzt bei jeder Version automatisch geprüft**
- **Code der Turnierleitung (Turnierplaner am Tablet):** Nach 10 falschen Codes ist die Eingabe für dieses Turnier 15 Minuten gesperrt, bei weiteren Fehlserien länger – egal von welchem Gerät. Das steht im Protokoll, auf Wunsch gibt es eine Sicherheitswarnung per E-Mail. Ein neuer Code in der Verwaltung hebt die Sperre sofort auf. Vorher wurde nur jedes einzelne Gerät gebremst.
- **Beitrittserklärung am Tablet:** Der 6-stellige Code ist zusätzlich über alle Tablets zusammen geschützt (nach 30 falschen Codes kurz gesperrt).
- **Dienste & Termine › Stunden:** Eine ungültige Jahreszahl in der Adresse führte zu einem Fehler – jetzt gilt dann einfach das aktuelle Jahr.
- **Geprüft und für sicher befunden** (für Vereine nichts zu tun): Jede der rund 820 Adressen von Verwaltung, Tablet, Mitglieder-App und Beregnung verlangt die richtige Anmeldung und das passende Recht; über den Cloudflare-Tunnel ist nur die Mitglieder-App erreichbar; ein Mitglied kommt in der App nicht an Buchungen, Nachrichten, Fotos oder Meldungen anderer; SQL-Angriffe, eingeschleuster Code in Namen, getarnte Dateien (SVG, HTML) und Formeln in Exporten werden abgewehrt; alle PINs, Passwörter und Codes sind gegen Durchprobieren gesperrt.
- **Für die Zukunft:** Diese Prüfungen laufen jetzt vor jeder neuen Version automatisch mit (neue Adressen sind sofort dabei), dazu Regeln im Quelltext und eine Prüfung der Bibliotheken auf bekannte Lücken.

## 3.101.0

**Design-Durchgang: keine abgeschnittenen Namen und keine Überlappungen mehr**
- **Mitglieder-App › Plätze › Geräte › Freie Zeiten:** Das Kästchen mit dem Gerätenamen war zu schmal – „Ballmaschine“ war nur als „allmaschin“ zu sehen. Die Kästchen wachsen jetzt mit dem Namen und brechen bei Bedarf um. Auch die Kurzfassung rechts („Medenspiel …“) wird nicht mehr gekürzt.
- **Mitglieder-App › Dienste:** Ein langer Dienstname („Frühjahrsinstandsetzung“) lief in den Knopf „voll“/„Ich helfe“. Lange Wörter werden jetzt getrennt.
- **Verwaltung am Handy:** Der Knopf oben rechts mit dem Seitennamen schnitt lange Namen ab („Beiträge & Zahlung“) – jetzt bricht er um. Ein langer Vereinsname steht links ganz da (vorher nach zwei Zeilen mit „…“), „e. V.“ bleibt zusammen. Lange Seitentitel (z. B. Turniernamen) stehen ganz da statt mit „…“.
- **Listen in der Verwaltung am Handy:** Namen stehen immer ganz da (sie brechen um). Werte unter dem Namen enden nur noch dann mit „…“, wenn sie länger sind als die ganze Zeile – vorher waren manche hart abgeschnitten. In Listen mit Häkchen (z. B. Dienste › Stunden bestätigen) war die Namensspalte auf ein Drittel gequetscht; das ist behoben. Bei zwei Knöpfen rechts wird ein langer Name nicht mehr zur schmalen Wortsäule zusammengedrückt. In Dienste › Stunden steht der Status am Handy als farbiger Text, im Filter „Zu bestätigen“ entfällt er (steht schon im Filter).
- **Tablet:** Lange Vereinsnamen in der Kopfzeile werden sinnvoll geteilt („TC Grün-Weiß“ / „Musterstadt 1923 e. V.“) statt gekürzt. Namenskacheln beim Verkauf und in der Zeiterfassung wachsen mit langen Namen (Doppelnamen, „von …“) statt sie abzuschneiden. Platznamen im Belegungsplan brechen um.
- **Plätze und Verkauf › Auswertung:** Lange Platz-, Artikel- und Kategorienamen brechen um statt „…“.
- **Turnierplaner:** Im Spielplan am Handy stehen lange Mannschaftsnamen ganz da; im Fenster „Ergebnis“ werden sie nicht mehr mitten im Wort getrennt.
- **Spielbetrieb:** „Braucht Aufmerksamkeit“ am Handy zeigt den Text in eigener Zeile statt als schmale Wortsäule; Mannschaftsnamen im Kalender enden sauber mit „…“ (voller Name beim Antippen).
- **Verkauf › Buchungen:** „Nur Konto“ steht jetzt in derselben Zeile wie „Von“ und „Bis“ – bei langen Namen rutschte das Feld vorher schief darunter.
- **Zugang › Freischaltungen:** „gesperrt“ steht neben dem Handy-Status statt unter dem Namen.
- **Einstellungen › Verein:** „kein Logo“ war im dunklen Modus kaum lesbar.
- **Design-Prüfstand geschärft:** neue Regel gegen Text, der links, rechts, oben oder unten aus seinem Rahmen läuft (die alte Messung sah nur den rechten Rand). Zusätzlich prüft er jetzt zwei weitere Fälle: mit langen, realistischen Namen (Stresstext) und eine frische Installation ohne Daten („Unser Verein“).

## 3.100.0

**Aus Sicherung übernehmen: nur gewählte Teile aus einer Komplettsicherung holen**
- Neu unter **Datensicherung › Aus Sicherung übernehmen …**: Nach einer Neuinstallation (oder jederzeit) lassen sich aus einer alten Komplettsicherung **einzelne Teile** holen, ohne den jetzigen Stand zu ersetzen – zum Beispiel nur die **Verkaufsartikel mit Bildern**.
- Ablauf: Sicherung wählen (hier, auf einem Sicherungsziel oder als Datei vom Gerät) und Passwort eingeben → **Was übernehmen?** mit Häkchen je Modul und Teil → **Vorschau** „x neu, y aktualisiert, z unverändert“ → **Übernehmen** mit eigenem Passwort → Ergebnismeldung.
- Wählbar: beim Verkauf Artikel (mit Bildern), Lieferanten-Zuordnungen, Reihenfolge der Kategorien und **Konten am Tablet** (Name, Art, PIN); bei allen anderen Modulen die ganze Einrichtung (Plätze, Abteilungen und Beitragsarten, Firmen, Türen …); dazu Vereinsname, Anschrift, Logo und Farbe. Braucht ein Teil einen anderen, wird dessen Häkchen automatisch gesetzt und erklärt.
- Es gilt dieselbe Regel wie beim Funktionsimport: **gleicher Name → aktualisiert, sonst neu, gelöscht wird nie etwas.** Zweimal übernehmen erzeugt keine Dubletten; Konten merken sich ihre Herkunft. Eine hier schon vergebene PIN bleibt. Offene Beträge, Buchungen und Verkäufe kommen (noch) nicht mit.
- Sicherheit: nur Benutzer mit allen Rechten; vorher automatisch ein Schnappschuss; Eintrag ins Protokoll. Die Sicherung wird nur im eigenen Clubwerk in einem abgeschotteten, temporären Ordner geöffnet, der danach restlos gelöscht wird. Passwörter werden nie gespeichert. Vertrauliche Daten (z. B. Kontakte von Firmen) brauchen den Wiederherstellungscode oder das Passwort eines damaligen Admins und werden mit dem Tresor dieser Installation neu verschlüsselt. Sicherungen einer neueren Clubwerk-Version werden abgelehnt.

## 3.99.0

**Einstellungen exportieren und importieren: jetzt vollständig und ohne Verlust**
- **Verkauf:** Der Export enthält jetzt **alle Artikel** (Name, Kategorie, Preis, Gebindegröße, Mindest- und Zielbestand, Reihenfolge, Symbol, sichtbar/ausgeblendet und das **eigene Bild**), dazu die Reihenfolge der Kategorien, „Gerade oft hier“ und die Lieferanten-Zuordnungen. Nicht dabei sind Bestand, Buchungen, Lieferungen, Konten, PINs und Passwörter.
- **Gleichnamige Einträge werden aktualisiert** statt übersprungen: Plätze und Buchungsarten, Abteilungen und Beitragsarten, Firmen (Buchhaltung), Personal (Zeiterfassung) und Mannschaften. Neue Einträge werden angelegt, **gelöscht wird nie etwas** (auch die Orte der Mängelmeldung werden nicht mehr ersetzt, sondern abgeglichen).
- **Genaue Meldung nach dem Import**, z. B. „Artikel: 3 neu, 42 aktualisiert · Bilder: 5 neu“. Ungültige Einträge werden übersprungen und gezählt.
- Der Hinweistext vor dem Import stimmt jetzt („Gleichnamige Einträge werden aktualisiert, neue angelegt, nichts wird gelöscht“).
- Mitglieder: Erinnerung an Zahlungen, Aufbewahrungsdauer und SEPA-Pflicht sind im Export, Dienste & Termine: Absage-Kontakt und -Empfänger.
- **Vorschau vor dem Import:** Der Dialog zeigt vorher, was passieren würde („Das würde passieren: Artikel: 3 neu, 42 aktualisiert“) – gespeichert wird erst nach „OK“.
- Weitere Einstellungen im Export: Mitglieder (Gratulationsregeln, Kindergrenze der Familie), Beregnung und Zugang (Aufbewahrung des Protokolls).
- Grenzen zur Sicherheit: höchstens 1 000 Artikel je Import, Bilder höchstens 2 MB, Datei höchstens 24 MB; es werden nur bekannte Felder übernommen.

## 3.98.1

- **Mitglieder-App › Adresse: fehlender Port wird erkannt.** Trägt jemand die Adresse im Vereins-WLAN als `https://lan.dein-verein.de` ohne `:5001` ein, ist die App im WLAN nicht erreichbar. Jetzt erscheint ein Hinweis „Port fehlt – meinst du …:5001?“ mit dem Knopf **So übernehmen**. Der Wert wird nie still geändert. Die öffentliche Adresse (Cloudflare, ohne Port) wird nicht beanstandet.

## 3.98.0

**Mitglieder-Import: Beitragsarten aus der Datei zusammenführen**
- Führt das alte Programm dieselbe Beitragsart unter mehreren Namen (zum Beispiel „Jugend bis 18“ und „Jugendliche bis 18“), gibt es im Import-Schritt „Beitragsarten aus der Datei“ jetzt die Wahl „zusammenführen mit „…““. Alle Mitglieder landen dann in einer Beitragsart, jedes genau einmal.
- Das Ziel wird neu angelegt – auf Wunsch unter neuem Namen („neu anlegen als“) – oder auf eine vorhandene Beitragsart gelegt. Ketten gehen (A mit B, B mit C), Kreise werden abgelehnt.
- Sehen Beitragsarten gleich aus (gleicher Betrag, Rhythmus und Abteilung, ähnlicher Name), schlägt Clubwerk das Zusammenführen vor: Hinweis oben, die Gruppe ist farbig zusammengefasst und mit „ähnlich“ gekennzeichnet.
- Es gilt immer die Zielart (Betrag, Rhythmus, Altersgrenzen, Familie, Abteilung). Weicht etwas ab, nennt ein Warnkasten, wer künftig wie viel zahlt – übernommen wird erst nach „Verstanden – so übernehmen“.
- Eine Ergebniszeile zeigt vor dem Übernehmen, welche Beitragsarten neu entstehen und mit wie vielen Mitgliedern.

## 3.97.2

**Verwaltung am Tablet meldet niemanden mehr woanders ab**
- Wer die Verwaltung direkt geöffnet hat (zum Beispiel in der Seitenleiste von Home Assistant) und im selben Browser auch die Tablet-Seite mit der Verwaltung offen hatte, wurde nach einer Minute abgemeldet. Grund: Die Verwaltung am Tablet meldet nach einer Minute ohne Eingabe ab – und beide teilten sich dieselbe Anmeldung.
- Jetzt hat die Verwaltung am Tablet ihre eigene, getrennte Anmeldung. Die Abmeldung nach einer Minute gilt nur dort; die direkte Anmeldung bleibt davon unberührt, und umgekehrt.
- Zusätzlich beendet Clubwerk eine Anmeldung am Tablet selbst nach 3 Minuten ohne Anfrage (etwa wenn das Tablet aus ist) und spätestens nach 4 Stunden.

## 3.97.1

**Home Assistant: Link „Clubwerk“ auf der Add-on-Seite funktioniert**
- Der Satz „Weitere Informationen findest du auf der Seite Clubwerk“ führt jetzt zur öffentlichen Clubwerk-Seite auf GitHub (vorher sah „Clubwerk“ nur wie ein Link aus).

## 3.97.0

**Spieltage aus „Für mich“: Liste bleibt zugeklappt**
- Wer in der App von „Für mich“ (Hinweis „Spieltage: n Rückmeldungen offen“) zu den Spieltagen springt, sieht jetzt dieselbe zugeklappte Liste wie über den Reiter. Sie scrollt zum Termin und hebt ihn etwa zwei Sekunden farbig hervor, statt ihn aufzuklappen.

## 3.96.0

**Anleitungs-PDFs mit sauber eingebetteter Schrift**
- **PDFs schlanker und schärfer:** Die Anleitungen wurden bisher mit der Schrift als Zeichnungen (statt als echte Schrift) abgelegt. Jetzt stecken feste Schriftschnitte darin (normal und fett, lokal im Werkzeug, nichts aus dem Netz). Alle 24 PDFs zusammen: **von 27,1 auf 24,3 MB** (der Rest sind vor allem die Bilder). Text lässt sich in den PDFs jetzt auch besser markieren und durchsuchen.
- Das Schriftbild bleibt gleich (Seiten vorher/nachher verglichen); die Wortabstände sind etwas gleichmäßiger.

## 3.95.0

**Aufräumen nach den Anleitungen: „Für mich“, Englisch, Karten und schlankere PDFs**
- **Termine unter „Für mich › Zu erledigen“ nur noch als Hinweis:** „Termine: 2 Antworten offen“ (bei einem einzigen „Termine: 1 Antwort offen“), darunter der Termin mit der nächsten Antwortfrist („Weihnachtsfeier · Antwort bis 12.12.“). Keine ✓/✕-Knöpfe mehr, wie bei den Spieltagen. Antippen öffnet die Termine in „Dienste“ und scrollt zum Termin mit der nächsten Frist.
- **Fehler behoben:** Ein Termin, der mehr als 60 Tage entfernt war, aber bald abläuft (Antwortfrist), fehlte unter „Zu erledigen“. Jetzt zählen alle künftigen Termine ohne Antwort, solange die Frist läuft – ohne Zeitgrenze.
- **„Für mich“ auch auf Englisch:** Die Überschriften der Zeilen (z. B. „Spieltage: 7 Rückmeldungen offen“, „Kontaktdaten ergänzen“, „Lastschrift“) blieben in der englischen App deutsch. Sie werden jetzt übersetzt; Namen (Mannschaften, Termine, Nachrichten) bleiben unverändert.
- **Englische Texte korrigiert:** Die Seite „Stunden“ heißt „Hours“, der Reiter „Tabellen“ „Tables“ (statt klein „hours“/„tables“), die Wertung „Aufgabe“ im Tennis „Retired“ (statt „Task“); die Feldbezeichnung bei Aufgaben des Spielbetriebs heißt „Task name“. Am Tablet steht beim Ausstempeln „Std.“ statt „Stunden“.
- **Abgeschnittene Knöpfe in der Mitglieder-Verwaltung behoben:** Bei etwa 1180 Pixel Fensterbreite ragte in „Beiträge Hauptverein“ der Knopf „Bearbeiten“ aus der Karte, und bei „Wer zahlt?“ / „Familienmitgliedschaft“ fehlte „Lösen“. Die beiden Karten stehen jetzt bis 1320 Pixel untereinander, und in „Beiträge Hauptverein“ entfallen in schmalen Fenstern die Spalten „Arbeitsstunden“ und „Formular“ (sie stehen beim Bearbeiten).
- **Design-Prüfstand schärfer:** Er prüft die Verwaltung jetzt auch bei 1180 Pixel und meldet neu jede Karte, die seitlich scrollt (Regel `karte-scrollt-seitlich`) – bisher blieb so etwas unbemerkt, weil scrollende Karten ausgenommen waren.
- **PDF-Anleitungen schlanker:** Das Paket war mit 3.94.0 von 7,7 auf 49 MB gewachsen. Die Bilder in den PDFs sind jetzt höchstens 920 Pixel breit und stärker komprimiert, die Versionsnummer steht nicht mehr im PDF. Ein PDF wird nur noch neu gebaut, wenn sich Text, Bildaufbau oder Vorlage ändern – nicht mehr mit jeder Version (sonst wüchse das öffentliche Repository jedes Mal um die Größe aller PDFs). Größe aller 24 PDFs: vorher 41 MB, nachher 27 MB (die Bilder machen den Großteil aus; weiter ohne sichtbaren Qualitätsverlust nicht möglich).
- Module: Buchhaltung 1.9.0, Dienste & Termine 2.12.0, Plätze 1.23.0, Mängel 1.9.0, Spielbetrieb 1.19.0, Turniere 1.8.0, Mitglieder 1.29.0.

## 3.94.0

**Anleitungen je Modul als PDF – bebildert, vollständig, auch auf Englisch**
- **Zu jedem Modul gibt es jetzt eine eigene Anleitung** (dazu eine für den Kern mit Einstellungen, Mitglieder-App, Nachrichten, Benutzer & Rechte, Sicherung und eine für den Verkauf): kurz erklärt, mit Bildern aus der Demo, die Verwaltung **Reiter für Reiter** in der Reihenfolge, wie sie auf dem Bildschirm steht. Jede Anleitung hat Deckblatt mit Versionsnummer, Inhaltsverzeichnis mit Seitenzahlen und Lesezeichen. Es gibt sie auf **Deutsch und Englisch** (britisch); geöffnet wird die Sprache, die in Clubwerk eingestellt ist.
- **Knopf „Anleitung (PDF)“** in Einstellungen › Module bei jedem Modul – auch bei Modulen, die noch ausgeschaltet sind.
- **„?“-Knopf oben rechts auf jeder Verwaltungsseite:** öffnet die Anleitung des Moduls gleich an der Stelle des gerade offenen Reiters (in einem neuen Tab; die Mitglieder-App ist nicht betroffen).
- **Die PDFs entstehen beim Bauen des Pakets** und liegen im Modulordner (`ANLEITUNG.de.pdf`, `ANLEITUNG.en.pdf`). Sie brauchen kein Internet und belasten den Home-Assistant-Rechner nicht. Die Bilder entstehen frisch aus einer eigenen Demo, mit einer Home-Assistant-Attrappe für Türen und Ventile.
- **Dauerhaft geprüft:** `paket.sh` bricht ab, wenn ein Modul keine Anleitung hat, eine Seite oder ein Reiter der Verwaltung darin fehlt oder das PDF nicht zum Text passt (Testreihe `anl`). Neue feste Regel: Jede neue Funktion ändert die Anleitung in derselben Version mit (`werkzeuge/anleitungen/SCHREIBEN.md`).
- **`DOCS.md`** (Reiter „Dokumentation“ in Home Assistant) ist jetzt eine kurze Übersicht mit Verweisen; veraltete Abschnitte (alte Menüs, „Einzug & Zahlungen“, Mahnungen vor 3.90) sind entfernt. Bestehen bleibt die Anleitung für den Cloudflare-Tunnel.
- **Beispieldaten ergänzt**, damit die Bilder nichts Leeres zeigen: Mitglieder (Beitrittserklärung, Änderungswünsche, Ehrung, Amt), Buchhaltung (Jahrespositionen der Firmen), Spielbetrieb (vorläufige Rahmentermine).
- **Laufzeit von `paket.sh`:** Die Anleitungen werden als eigene Stufe 5c gleichzeitig zu den Tests gebaut. Ein vollständiger Neubau aller 24 PDFs mit allen Bildern dauerte unter Last rund 5 bis 9 Minuten, mit dem Bilder-Zwischenspeicher (nichts am Aussehen oder an den Beispieldaten geändert) rund 25 Sekunden; der Gesamtlauf blieb bei etwa 3 Minuten ohne Neubau der Bilder.
- Module: Dienste & Termine 2.11.0, Beregnung 1.11.0, Buchhaltung 1.8.0, Plätze 1.22.0, Mängel 1.8.0, Mitglieder 1.28.0, Spielbetrieb 1.18.0, Turniere 1.7.0, Zeiterfassung 1.6.0, Zugang 1.9.0.

## 3.93.0

**Mitglieder-App „Für mich“: offene Spieltage werden nicht mehr übersehen**
- **Fehler behoben:** Wer bei vielen Spieltagen noch nicht geantwortet hatte (z. B. 20 Rahmentermine ab Mai des nächsten Jahres), sah unter „Zu erledigen“ nichts davon, weil nur die nächsten 60 Tage geprüft wurden.
- **Jetzt ein Hinweis ohne Zeitgrenze:** Unter „Zu erledigen“ steht eine Zeile „Spieltage: 20 Rückmeldungen offen“ (bei einem einzigen: „Spieltage: 1 Rückmeldung offen“), darunter die Mannschaften und „nächster am 16.05.“. Sie zählt alle künftigen, freigegebenen Spieltage deiner Mannschaften, bei denen deine Rückmeldung fehlt.
- **Antippen** springt in den Bereich Spieltage, direkt zum nächsten offenen Termin. Dort antwortest du wie gewohnt mit ✓ oder ✕. Die kleinen ✓/✕ direkt auf „Für mich“ gibt es nicht mehr.
- Unverändert: „Als Nächstes“ zeigt weiter die nächsten 60 Tage, und der Hinweis „Aufstellung noch nicht verschickt“ für Mannschaftsführer hat seine eigene Frist.
- Beispieldaten: In der Demo hat die Herren-30-Mannschaft jetzt offene Rahmentermine im Mai und Juni 2027.

## 3.92.0

**„Demo“ je Modul: jedes Modul gefahrlos ausprobieren**
- **Neuer Knopf „Demo“** in Einstellungen › Module (Recht „Einstellungen“). Er öffnet in einem **neuen Tab** eine eigene Demo-Kopie von Clubwerk mit genau diesem Modul und erfundenen Beispieldaten – oben steht deutlich „Demo · <Modul> – erfundene Daten, nichts davon wird gespeichert“. Funktioniert auch über die Seitenleiste von Home Assistant.
- **Getrennt von euren Daten:** Die Kopie läuft als eigener Prozess mit eigenem, vorübergehendem Ordner außerhalb der Vereinsdaten (kommt nie in Sicherungen). Sie kann nichts nach außen schalten oder senden: keine Türen, Ventile oder andere Home-Assistant-Geräte, keine E-Mails, kein Push, keine Sicherungen oder Updates. Nur wer sie gestartet hat, kommt hinein – mit seiner normalen Anmeldung; die Anmeldung der Demo gilt umgekehrt nicht in der echten Verwaltung.
- **Nur eine Demo zugleich.** Sie endet beim Schließen des Tabs, mit „Demo beenden“, nach 30 Minuten ohne Nutzung oder wenn Clubwerk neu startet – und wird dabei jedes Mal restlos gelöscht.
- **Speicherbedarf:** Eine laufende Demo braucht gemessen etwa 120–140 MB Arbeitsspeicher (Ziel höchstens 150 MB), danach nichts mehr.
- In der Modulliste ist Platz für weitere Knöpfe je Modul (als Nächstes „Anleitung (PDF)“). Am Handy steht die Knopfzeile jetzt über die ganze Breite statt eingequetscht unter dem Symbol.

**Beispieldaten: jedes Modul bringt seine eigenen mit – und alle sind gut gefüllt**
- Die Beispieldaten sind nach Modulen aufgeteilt. Jedes Modul ist so auch in der Demo allein nutzbar (ohne Mitgliederverwaltung nur mit Vor- und Nachnamen). „Demo ausprobieren“ beim ersten Start lädt weiter alle Module.
- **Mitglieder und Geld, alles passend zueinander:** 43 Mitglieder mit Anschrift, Geburtstag und Bankverbindung, Abteilungen Tennis und Fußball mit Zusatzbeiträgen, zwei Familienmitgliedschaften (mit Kindern), „zahlt für“, eine Kündigung zum Jahresende. Beitragslauf im Frühjahr, SEPA-Einzug mit Erst- und Folgelastschriften, Kontoauszug mit Sammelgutschrift, Überweisungen, Teilzahlung und einer **Rücklastschrift** („Konto erloschen“, Gebühr der Bank), danach **Mahnungen in drei Stufen** (Zahlungserinnerung, 1. und 2. Mahnung mit Gebühr). Ein zweiter Kontoauszug von dieser Woche hat noch zwei Buchungen zu prüfen.
- **Buchhaltung:** zwei Firmen, Rechnungen (eine per Kontoauszug bezahlt, eine offen) und drei Spenden mit Quittung.
- **Dienste & Termine:** vergangene und kommende Arbeitseinsätze, Dienstpläne (Sommerfest, Glühweinabend), Thekendienste am Tablet, Stunden zum Prüfen, Soll/Ist, Termine mit Zu- und Absagen. **Zeiterfassung:** acht Wochen Stunden mit Monatsnachweis.
- **Spielbetrieb:** sechs Mannschaften mit vergangenen Spieltagen (Ergebnisse) und kommenden (Zu-/Absagen, Aufstellung, Aufgaben). **Plätze:** Training als Serien, Buchungen über die ganze Woche, Gastgebühren. **Zugang:** drei Türen, Zeitprofile, Türprotokoll. **Beregnung:** vier Plätze mit Verlauf. **Mängel:** offene und erledigte Meldungen.
- **Verkauf:** Lieferungen, Inventur, Monatsabrechnung, Veranstaltung „Saisonabschluss“, Gäste-Deckel, Verkäufe über die letzten Wochen. **Nachrichten:** drei verschickte Nachrichten und eine Vorlage. **Datenschutz:** Hinweis in der Mitglieder-App.
- Das laufende Dorfturnier, der LK-Turniertag und die Clubmeisterschaft bleiben wie bisher.

**Behoben**
- „Demo ausprobieren“ beim ersten Start in Home Assistant: Die Beispieldaten fehlten im gebauten Add-on (der Ordner wurde nicht mitkopiert).

**Darstellung – aufgefallen durch die vollen Beispieldaten**
- **Gäste-Deckel und Abrechnungsliste einer Veranstaltung:** statt bis zu vier Knöpfen je Zeile ein Knopf **„Abrechnen …“**. Im Fenster stehen „Bar bezahlt“, „Karte bezahlt“, „Auf ein Konto übernehmen …“ bzw. „Mitglied zuordnen …“ und – abgesetzt in eigener Zeile – rot „Abschreiben …“. Der rote „Löschen“-Knopf einer Veranstaltung und einer Lieferung steht nicht mehr direkt neben einem normalen Knopf.
- Die Filter „Alle / Offen / Bezahlt“ der Abrechnungsliste waren im dunklen Modus kaum lesbar (dunkle Schrift auf Grün) – jetzt wie alle Umschalter.
- **Am Handy zwei Zeilen je Eintrag** auch in Lieferungen, Bestandsänderungen, Abrechnungen, Bankkonten, Nachrichten-Vorlagen und -Listen, Gäste-Deckeln, Veranstaltungen, Verkaufsbuchungen, Kontoauszug, offenen Posten, Einzügen, Altersstufen, Beitragsarten, Stunden und Zugang. Details wie „wer, wann“ stehen beim Öffnen. Die Abrechnungsliste einer Veranstaltung hat am Handy keine eigene Scrollbox mehr.
- Verkauf › Auswertung: Die kleinen Kennzahlen stehen am Handy in zwei statt vier Spalten (vorher abgeschnitten, z. B. „Gast (bar/Karte)“).
- Tablet: Lange Namen auf den Kacheln (z. B. „Gastmannschaft SV Musterdorf“) stehen zweizeilig statt mit „…“; hochkant drei Kacheln je Reihe. In der Kopfzeile am Handy bleibt der Vereinsname neben „Demo“ ganz lesbar.
- Betreffzeilen gesendeter Nachrichten werden umbrochen statt gekürzt.
- Plätze: Graue Buchungsarten (z. B. „Platzpflege“) bekommen schwarze statt dunkelgraue Schrift – vorher zu wenig Kontrast.
- Spielbetrieb › Einstellungen: „Entfernen“ bei den Aufgaben ist so hoch wie die Felder daneben.
- Der zarte Farbschimmer oben im Hintergrund ist eine Spur heller: Nicht gewählte Reiter (graue Schrift auf der Reiterleiste) haben jetzt auch dort mindestens 4,5 : 1 Kontrast. Die Schrittnummern im Einrichtungs-Assistenten sind kräftiger.

**Für Entwickler**
- Neue feste Regel: **Jede neue Funktion bringt ihre Beispieldaten mit** (`erweiterungen/<modul>/demo/demo.sql`, bearbeitet mit `werkzeuge/demo/aufteilen.js`). Neue Testreihen `demod` (Inhalt in jeder Hauptansicht je Modul, jedes Modul allein, Geld-Daten stimmig) und `demok` (Demo-Kopie: Rechte, Abschottung, Ende, nur eine zugleich, Speicher).
- Module: Dienste & Termine 2.10.0, Beregnung 1.10.0, Buchhaltung 1.7.0, Plätze 1.21.0, Mängel 1.7.0, Mitglieder 1.27.0, Spielbetrieb 1.16.0, Turniere 1.6.0, Zeiterfassung 1.5.0, Zugang 1.8.0, Verkauf 3.81.0.

## 3.91.1

**Turnierplaner: Monitor nachgeschärft**
- Der Monitor spricht jetzt immer die Sprache des Vereins (wie das Tablet), auch wenn der Browser des Fernsehers auf Englisch steht – vorher erschien er dann halb übersetzt.
- „Jetzt“: Bis zu vier Spielfelder stehen nebeneinander in einer Reihe (bei mehr gleichmäßig verteilt, z. B. 3 + 3), Rundenangabe unter dem Namen. Restzeit und „danach“ stehen in allen Karten auf derselben Höhe.
- Module: Turniere 1.5.1.

## 3.91.0

**Turnierplaner: eigene Turniere wie das Dorfturnier – Tennis und Fußball**
- **Neue Seite „Turnierplaner“** im Modul Turniere (Verwaltung, Recht „Turniere“). Ein Turnier anlegen mit Name, Tag, Beginn, Anzahl der Plätze bzw. Spielfelder und Sportart – schon beim Anlegen zeigt Clubwerk, wie viele Gruppen und Spiele es werden und **wann das Turnier voraussichtlich endet**.
- **Vier Spielformen:** Gruppen + Endrunde („Dorfturnier“), Jeder gegen jeden, K.-o. mit Setzliste (Gesetzte treffen spät aufeinander, fehlende Gegner = Freilos) und Schleifchenturnier (je Runde neue Doppelpartner, gezählt werden die gewonnenen Spiele je Person; Partner wiederholen sich nicht, solange es geht).
- **Sportart-Vorlagen:** Tennis 2-1-0 Punkte, gewonnene Spiele, 20 Minuten Spielzeit und 5 Minuten Pause, Tiebreak bis 7 im K.-o.; Fußball 3-1-0, Tore, 12/3 Minuten, Neunmeterschießen ohne Verlängerung, „Spielfeld“ statt „Platz“. Alles lässt sich einzeln ändern, auch Wertung auf Sätze wie bei der Clubmeisterschaft.
- **Gruppen automatisch,** auch bei ungleichen Zahlen – zum Beispiel 28 Mannschaften → 4 Vierer- und 4 Dreiergruppen, nie „Platz frei“. Auslosung zufällig, auf Wunsch mit Setzliste (je Gruppe ein Gesetzter); danach lassen sich zwei Mannschaften von Hand tauschen.
- **Tabelle:** Punkte → Differenz → mehr Tore bzw. Spiele → direkter Vergleich → Los. Die Reihenfolge ist einstellbar. Das Los zieht die Turnierleitung per Knopf, es steht im Protokoll.
- **Endrunde:** die ersten zwei jeder Gruppe über Kreuz (1. A gegen 2. B, 1. B gegen 2. A …). Geht es nicht auf, füllen die besten Dritten auf (verglichen je Spiel, weil Gruppen verschieden groß sein können). Spiel um Platz 3 abwählbar. Die Endrunde füllt sich von selbst, sobald eine Gruppe fertig ist; Sieger rücken automatisch vor. Neunmeter bzw. Tiebreak gibt es nur im K.-o. und zählen nicht für Tabellen.
- **Spielplan mit Uhrzeit und Platz:** Niemand spielt zweimal hintereinander, die Gruppen verteilen sich über die Plätze, Pausen nach der Vorrunde und zwischen den K.-o.-Runden sind einstellbar. Ein Warnhinweis erscheint, wenn das Ende nach der eingestellten spätesten Uhrzeit liegt.
- **Am Turniertag:** Zentrale mit jedem Platz (läuft gerade, Restzeit, als Nächstes), „Nächste Spiele starten“ für alle freien Plätze auf einmal und „Nachrücken“ – ist ein Platz früher frei, kommt das nächste Spiel nach vorne. Läuft ein Spiel länger, rutschen die folgenden nach hinten.
- **Ergebnisse trägt nur die Turnierleitung ein** – in der Verwaltung oder am Tablet. Am Tablet fragt Clubwerk dafür einen eigenen Code der Turnierleitung ab (4–6 Ziffern, in den Einstellungen des Turniers). Die Mannschaften selbst können nichts eintragen.
- **Monitor zum Aufhängen:** ein Link ohne Anmeldung (über die Adresse der Mitglieder-App, nur ansehen). Am Fernseher wechselt die Anzeige von selbst zwischen laufenden Spielen mit Restzeit, nächsten Spielen, Tabellen, Turnierbaum und letzten Ergebnissen, groß lesbar und hell oder dunkel. Am Handy steht alles untereinander; über den QR-Code einer Mannschaft sieht sie zuerst ihr nächstes Spiel und ihre Gruppe. „Link erneuern“ macht alte Links ungültig.
- **Mannschaften:** freie Namen, Spieler freiwillig (auch Gäste), einzeln oder per Excel/CSV mit einer Namensspalte. Ohne Mitgliederverwaltung und ohne das Modul „Plätze“ geht alles genauso. Optional: Startgeld je Mannschaft (bar/digital mit Kassenbericht) und Sperre der Plätze im Buchungssystem.
- **Ehrentafel:** Beim Beenden kommen Sieger, Zweiter und Dritter je Turnier und Jahr in die Ehrentafel des Turnierplaners.
- **Datenschutz:** Spielernamen der Mannschaften werden nach einer Frist gelöscht (Vorgabe 1 Jahr, Einstellungen › Datenschutz); Mannschaftsnamen, Ergebnisse und Ehrentafel bleiben.
- Die Demo enthält ein laufendes Dorfturnier (Code der Turnierleitung 2468).
- Module: Turniere 1.5.0.

## 3.90.0

**Mahnwesen: Zahlungserinnerung, 1. und 2. Mahnung – Stufe für jeden Posten, Briefe als Sammel-PDF**
- **Mahnstufen einstellbar** (Beiträge & Zahlungen › Einstellungen › Mahnungen). Vorgabe: **Zahlungserinnerung** 14 Tage nach Fälligkeit (kostenlos), **1. Mahnung** 14 Tage danach und **2. Mahnung** weitere 14 Tage danach (je 2,50 € Gebühr). Je Stufe lassen sich Bezeichnung, Abstand, Gebühr und Text ändern (1 bis 5 Stufen), dazu die Zahlungsfrist in den Schreiben. Im Text setzt Clubwerk {name}, {betrag} und {frist} ein. Die bisherige Einstellung „Mahngebühr ab 2. Mahnung“ geht darin auf: Wer dort einen Betrag eingetragen hatte, findet ihn jetzt bei der 1. und 2. Mahnung.
- **Stufe je Posten statt je Zahler:** Ein Posten erreicht die nächste Stufe erst, wenn sein Abstand um ist. Ein Beitrag, der gestern fällig wurde, springt also nicht mehr mit den alten Posten auf die letzte Stufe, und am Tag nach einer Mahnung kann man nicht gleich die nächste schicken. Ein Schreiben fasst alle fälligen offenen Posten zusammen, nennt bei jedem die Stufe und verrechnet ein Guthaben.
- **Mahnlauf** (Beiträge & Zahlungen › Rechnungen & Mahnungen › „Mahnungen – jetzt fällig“): zeigt nur, wer jetzt dran ist, mit Schreiben, Betrag und Gebühr. Dann **„E-Mails senden“** (mit PDF) und für alle ohne E-Mail **„Briefe als PDF“** – ein Sammel-PDF zum Drucken. **Stufe und Gebühr werden erst gebucht, wenn die E-Mail raus ist bzw. nach „Briefe gedruckt“.** Die Gebühr fällt einmal je Schreiben an, nicht je Posten, und offene Mahngebühren lösen selbst keine neue Gebühr aus.
- **Niemanden mahnen, der schon gezahlt hat:** Über der Liste steht, bis wann der Kontoauszug eingelesen ist; ist er älter als 7 Tage oder sind Buchungen noch nicht zugeordnet, erscheint eine Warnung. Posten im Einzug werden nie gemahnt, Zahler mit gültigem Lastschrift-Mandat auch nicht – ihre Posten kommen in den nächsten Einzug.
- **Mahnsperre** für einen Zahler (z. B. „Ratenzahlung vereinbart“, auf Wunsch mit Enddatum) oder einen einzelnen Posten („Posten ändern“ › „Mahnsperre …“). Alle Sperren stehen auf der Seite unten, mit „wäre jetzt dran“.
- **„Letzte Mahnung ohne Zahlung“:** eine Liste für den Vorstand, sobald die letzte Stufe erreicht und die Frist um ist. Was dann passiert, entscheidet der Vorstand – Clubwerk sperrt nichts von selbst.
- **Mahnhistorie** am Mitglied (Reiter „Zahlung & Familie“ › Mahnungen: wann, welches Schreiben, Betrag, Gebühr, per E-Mail oder Brief), im Verlauf und im Protokoll. Wird ein Posten storniert, bietet Clubwerk die Mahngebühr, die er ausgelöst hat, gleich mit an.
- **Nach der zweiten Rücklastschrift nur noch Überweisung:** Nach einer Rücklastschrift wird beim nächsten Einzug erneut abgebucht. Kommt vom selben Zahler eine zweite zurück, sind seine Posten automatisch vom Einzug ausgenommen und laufen über Rechnung und Mahnung (Hinweis beim Mitglied und im Einzug „wegen 2 Rücklastschriften ausgenommen“). Das Mandat bleibt eingetragen; „Wieder einziehen …“ beim Mitglied hebt das auf. Das gilt für Rücklastschriften von Hand und aus dem Kontoauszug; frühere Rücklastschriften zählen mit.
- **Mitglieder-App „Für mich“ › Mein Konto:** Nach einer Mahnung steht beim offenen Betrag „Zahlungserinnerung vom …“ bzw. „1. Mahnung vom …“ und darunter, wohin überwiesen wird (Konto und Verwendungszweck). Push-Nachrichten zu Mahnungen gibt es bewusst nicht.
- **Bestehende Mahnstufen bleiben erhalten:** Was schon gemahnt war, behält Stufe und Datum; der Abstand zählt ab dem alten Mahndatum. Ein Beitragslauf, aus dem schon gemahnt wurde, lässt sich nicht mehr zurücknehmen, und „Zuordnung aufheben“ im Kontoauszug erkennt, wenn ein Rest inzwischen gemahnt wurde.
- Die Demo zeigt Posten in verschiedenen Mahnstufen.
- Module: Mitglieder 1.26.0.

## 3.89.0

**Termine mit Zu- und Absage – für Weihnachtsfeier, Versammlung & Co.**
- **Neue Art „Termin“ bei den Helferdiensten** (Verwaltung › Helferdienste › Einsätze › „Art“). Ein Termin ist kein Dienst: Er zählt nie zu den Arbeitsstunden, steht nicht am Tablet zum Stempeln und taucht in keiner Stundenrechnung auf. Dazu eine **Antwortfrist** (leer = bis zum Termin) und eine **Höchstzahl Personen**. Bestehende Einträge bleiben, wie sie sind; ein Einsatz ohne erfasste Stunden lässt sich auf „Termin“ umstellen.
- **In der Mitglieder-App** gibt es unter „Dienste“ den Reiter **„Termine“** mit **„Ich komme“** (mit Begleitpersonen: „Wie viele Personen kommen?“) und **„Ich komme nicht“**. Ändern geht bis zur Antwortfrist. Mitglieder sehen nur die **Anzahl** („bisher 42 Personen zugesagt, noch 8 Plätze frei“), keine Namen.
- **„Für mich“:** Fehlt die Antwort, steht der Termin unter „Zu erledigen“ mit ✓/✕ gleich in der Zeile; bei Zusage unter „Als Nächstes“.
- **Teilnehmerliste in der Verwaltung** („Antworten“ am Termin): wer kommt (mit Personenzahl und Anmerkung), wer nicht, wer noch nicht geantwortet hat – alphabetisch nach Nachname. Die Verwaltung kann für ein Mitglied antworten (z. B. nach einem Anruf), die Liste als **Excel** laden und mit „Ohne Antwort erinnern“ nachfassen. Absagen sieht nur die Verwaltung.
- **Benachrichtigungen:** ein eigener Anlass **„Erinnerung an einen Termin“** (Mitglieder-App › Benachrichtigungen, getrennt von „Erinnerung an den Dienst“): Einladung beim Anlegen (abwählbar), Bitte um Antwort am Tag vor Fristende nur an Mitglieder ohne Antwort, Erinnerung am Vortag nur bei Zusage.
- **Neuer Name: „Dienste & Termine“.** Das Modul heißt in der Verwaltung jetzt so (vorher „Helferdienste“); in der Mitglieder-App steht in der Leiste weiter kurz „Dienste“, die Überschrift im Bereich lautet „Dienste & Termine“. Nichts an den Daten oder Rechten ändert sich.
- **Mitglieder-App „Für mich“:** Lange Titel wie „Mitgliederversammlung“ werden bei Zeilen mit Zusage-Knöpfen nicht mehr abgeschnitten, und die Knöpfe sind so hoch wie das Symbol der Zeile.
- Module: Dienste & Termine 2.9.0.

## 3.88.0

**Nachrichten: aus „E-Mail“ wird „Nachrichten“ – per E-Mail, in der Mitglieder-App und als Push-Hinweis**
- **Verein › Nachrichten** (bisher „E-Mail“): Alles Bisherige bleibt – Empfänger, Vorlagen, Verteiler, Entwürfe, Gesendet mit Zustellstatus, „nur eigene Abteilung“. Neu steht beim Schreiben eine Zeile **„Weg“**: E-Mail, In der Mitglieder-App und Push-Hinweis aufs Handy. Man kann mehrere wählen; der Push-Hinweis öffnet die Nachricht in der App und bringt sie deshalb immer mit.
- **Mitglieder-App › Nachrichten:** Ein neuer Bereich mit der Liste (neueste oben, Ungelesene mit Punkt und fett, Angeheftetes zuerst), der einzelnen Nachricht und den Anhängen. Bilder und PDFs öffnen sich in der App selbst, alles andere lässt sich über das Teilen-Menü des Handys sichern. Links in Nachrichten sind in der App nur Text mit der Adresse zum Abschreiben – die App öffnet nie ein neues Fenster oder Safari. Der Reiter erscheint, sobald der Verein die erste Nachricht in die App geschickt hat. Er lässt sich unter Mitglieder-App wie die anderen Bereiche ein- und ausschalten und umsortieren.
- **„Für mich“:** Die neueste ungelesene Nachricht steht oben unter „Neu für dich“ und verschwindet, sobald sie geöffnet wurde.
- **Push:** Neuer Anlass „Nachrichten vom Verein“ (der Vorstand gibt ihn unter Mitglieder-App › Benachrichtigungen frei). Es kommt nur der Betreff und „Neue Nachricht von …“, nie der Text. Mitglieder können ihn in der App unter Benachrichtigungen für jedes Handy abschalten – diese Auswahl gilt jetzt auch für alle anderen Hinweise (bisher wurde sie zwar gespeichert, beim Senden aber nicht beachtet).
- **Wer bekommt sie:** Gruppen, Abteilungen, Ämter, Beiträge, einzelne Mitglieder und Verteiler wie bisher, dazu **„Alle Mitglieder der App“** und **Mannschaften** (aus dem Spielbetrieb, mit Mannschaftsführer). Wer keine E-Mail-Adresse hat, bekommt die Nachricht trotzdem in der App. Das Abteilungs-Recht gilt für alle Wege: „Alle Mitglieder der App“ und fremde Gruppen gibt es dort nicht. Ohne Mitgliederverwaltung gehen „Alle Mitglieder der App“ und einzelne Mitglieder.
- **Sichtbar in der App:** Nachrichten verschwinden nach einem Zeitraum (Vorgabe 6 Monate, je Nachricht 1/3/6/12/24 Monate; die Vorgabe steht unter „Gesendet“) oder von Hand („Aus der App nehmen“). **„Anheften“** hält Dauerhaftes wie die Platzordnung oben und lässt es nie ablaufen.
- **Zustellung:** Unter „Gesendet“ steht je Person, wie die Nachricht angekommen ist: E-Mail, App, Push – oder „nicht erreichbar“ (keine Adresse und kein Handy in der App).
- **Datenschutz:** Ob ein Mitglied eine Nachricht geöffnet hat, sieht nur es selbst. Der Vorstand sieht nur eine Zahl („51 von 84 haben sie geöffnet“), keine Namen. Das Protokoll nennt nur „Nachricht gesendet“ mit Nummer, Weg und Anzahl – nie Betreff oder Text. Anhänge laufen über den geschützten Weg; nur echte Bilder und PDFs werden in der App angezeigt. Nach dem Ablauf wird die Zeile des Mitglieds gelöscht, nur die Zahl bleibt. Die Datenauskunft nennt die Nachrichten samt Gelesen-Stand, beim Anonymisieren fallen sie weg.
- Rechte: Das Recht „E-Mail“ heißt jetzt „Nachrichten schreiben“ (gleiche Wirkung).
- Module: Mitglieder 1.25.0 (Auskunft und Anonymisieren kennen die Nachrichten), Spielbetrieb 1.15.0 (Mannschaften als Empfängergruppen).

## 3.87.0

**Kontoauszug einlesen und abgleichen (Beiträge & Zahlungen › Kontoauszug)**
- Den Kontoauszug aus dem Online-Banking hineinziehen – Clubwerk ordnet Überweisungen, Lastschrift-Gutschriften und Rücklastschriften den offenen Posten, Einzügen und Rechnungen zu. Niemand muss mehr jede Zahlung einzeln im Online-Banking nachsehen und anklicken.
- Liest CAMT (camt.052/053/054, auch Version 08, wie sie Sparkassen seit November 2025 liefern; einzeln oder als ZIP), das Sparkassen-Format „CSV-CAMT“ und den CSV-Export anderer Banken. Beim CSV einer fremden Bank einmal die Spalten zuordnen – danach geht es von selbst.
- Jede Buchung bekommt einen Vorschlag: **sicher** (Rechnungsnummer und Betrag passen, unsere Lastschrift-Gutschrift, Rücklastschrift mit unserer Kennung), **wahrscheinlich** (IBAN und Betrag passen) oder **vielleicht** (Name ähnlich, Betrag passt). „Alle sicheren übernehmen“ bucht die sicheren auf einmal, die übrigen prüft man einzeln – oder ordnet von Hand zu bzw. markiert „gehört nicht zu Clubwerk“.
- Gebucht wird genau wie von Hand: Teilzahlung lässt den Rest offen, eine Überzahlung wird Guthaben, eine Überweisung für mehrere Posten bezahlt die ältesten zuerst. Die Lastschrift-Gutschrift bucht „Zahlung erfolgt“, die Rücklastschrift öffnet die Posten wieder – mit der Gebühr aus dem Auszug und dem Grund aus dem Rückgabecode (bei „Konto erloschen“ wird das Mandat gesperrt, änderbar).
- Kein Geld doppelt: Derselbe Auszug zweimal eingelesen ändert nichts – auch nicht, wenn dieselben Tage einmal als CAMT und einmal als CSV kommen. Jede Zuordnung lässt sich aufheben, solange danach nichts anderes passiert ist.
- Wer einen per Kontoauszug bezahlten Posten storniert, wählt „als Guthaben behalten“ oder „Geld wurde zurücküberwiesen“ – das Geld verschwindet nicht still.
- Rechnungen der Buchhaltung: an Firmen direkt, an Mitglieder über deren offenen Posten (die Rechnung zieht nach). Wird ein Posten wieder offen (Rücklastschrift, Zuordnung aufgehoben), ist es die Rechnung auch wieder.
- „Offene Posten“, „Rechnungen & Mahnungen“ und die Rechnungen der Buchhaltung zeigen, bis wann der Kontoauszug eingelesen ist – damit niemand gemahnt wird, der schon gezahlt hat.
- Datenschutz: Abbuchungen (Strom, Lieferanten …) werden nicht gespeichert, die Datei selbst auch nicht. Name, IBAN und Verwendungszweck liegen verschlüsselt im Tresor; „gehört nicht zu Clubwerk“ wird nach 90 Tagen gelöscht (Frist unter Einstellungen › Datenschutz). Neues Recht „Kontoauszüge einlesen und zuordnen“ (zum Zuordnen zusätzlich „Einzug“ bzw. „Buchhaltung“). Ohne Mitgliederverwaltung steht die Seite unter Buchhaltung.
- Module: Mitglieder 1.24.0, Buchhaltung 1.6.0.

## 3.86.0

**Datenschutz: feste Löschfristen, vollständige Auskunft, Hinweis in der App**
- **Neu: Einstellungen › Datenschutz.** Dort stehen alle Löschfristen aller eingeschalteten Module auf einen Blick, jede mit „Fällig“ (so viel fällt beim nächsten Lauf weg). Clubwerk löscht einmal am Tag von selbst, was älter ist. Ins Protokoll kommt nur, wie viel gelöscht wurde, nie was. „Jetzt löschen“ startet den Lauf sofort.
- **Vorgaben (alle einstellbar):** Türöffnungen 30 Tage, Anmeldungen und Sicherheitsmeldungen mit IP-Adresse 30 Tage, übriges Protokoll 12 Monate, gesendete Rundmails samt Anhängen 12 Monate, Beregnung 12 Monate. Die Fristen für erledigte Mängel und fremde Turnierspieler stehen dort mit. Geld (Verkauf, Beiträge, Buchhaltung) und Arbeitszeiten löscht Clubwerk nie von selbst, weil dafür gesetzliche Aufbewahrungsfristen gelten.
- **Sicherungen:** Die Seite sagt, wann Gelöschtes auch aus den Sicherungen verschwindet. Wird eine Sicherung zurückgespielt, löscht Clubwerk Abgelaufenes sofort wieder und anonymisiert bereits anonymisierte Mitglieder erneut. Dafür merkt es sich nur Konto, Mitgliedsnummer und Eintritt, keine Namen.
- **Nach dem Austritt:** Die Erinnerung „seit über … Jahren ausgetreten“ ist jetzt ab Werk an (2 Jahre). Unter Mitglieder › Einstellungen › Datenschutz & Aufbewahrung gibt es die Liste dazu mit „anonymisieren“ für alle auf einmal (Bestätigung mit ANONYMISIEREN). Mitglieder mit offener Forderung bleiben, bis sie ausgeglichen ist. Der Hinweistext nennt jetzt die richtigen Fristen (Belege 8 Jahre, Bücher 10 Jahre).
- **Datenauskunft aus allen Modulen:** Die Auskunft im Mitglied enthält jetzt auch Platzbuchungen, Türöffnungen, Beregnung, Helferstunden, Spielbetrieb, Clubmeisterschaft, Mängelmeldungen, Rechnungen und Spenden.
- **Mitglieder-App › Meine Daten › „Datenauskunft anfordern“:** Mit der PIN bestätigt kommt die Auskunft per E-Mail an die hinterlegte Adresse, als PDF zum Lesen und als Datei zum Weiterverwenden. Die IBAN steht darin nur gekürzt. Das geht höchstens zweimal am Tag und steht im Protokoll.
- **Datenschutzhinweis in der Mitglieder-App:** Der Text steht unter Einstellungen › Datenschutz, eine Vorlage zum Ergänzen ist dabei. Mitglieder sehen ihn einmal beim nächsten Öffnen der App, nach jeder Änderung erneut, und jederzeit unter „Mein Konto › Datenschutz“.
- **Verzeichnis von Verarbeitungstätigkeiten:** „Verzeichnis drucken“ erzeugt eine Vorlage aus allen eingeschalteten Modulen: Zweck, Daten, Betroffene, wer Zugriff hat (aus den Rollen) und die Löschfristen. Der Verein ergänzt Vorstand, Datenschutzbeauftragte und genutzte Dienste.
- **Einwilligungen:** Bei der Beitrittserklärung gibt es „+ Vorlage …“ für Fotos, Presse & Aushang und Geburtstag im Vereinsheft. Unter Mitglieder › Auswertung zeigt die neue Karte „Einwilligungen“, wie viele zugestimmt haben, und es gibt die Liste mit Namen als Excel, zum Beispiel für den Pressewart.
- Die Fristen sind Vorschläge und keine Rechtsberatung. Im Zweifel stimmt der Verein sie mit seinem Datenschutzbeauftragten oder dem Landesverband ab.
- Datensicherung › Datenbank-Schnappschüsse: Die Spalte mit dem technischen Dateinamen ist weg (Art und Stand zeigen dasselbe lesbar, der Name steht beim Darüberfahren). Am Handy wurde er sonst abgeschnitten.
- Module: Mitglieder 1.23.0, Plätze 1.20.0, Helferdienste 2.8.0, Spielbetrieb 1.14.0, Turniere 1.4.0, Mängel 1.6.0, Zugang 1.7.0, Beregnung 1.9.0, Buchhaltung 1.5.0, Zeiterfassung 1.4.0.

## 3.85.0

**Gelöschte Mitglieder: kein Geld auf Konten, die niemand mehr sieht**
- **Abrechnung zurücknehmen:** Ist ein Mitglied aus der letzten Abrechnung inzwischen gelöscht, lässt sich diese Abrechnung nicht mehr zurücknehmen – sonst stünde der Betrag wieder offen auf einem gelöschten Konto. Der Knopf „Zurücknehmen“ erscheint dann nicht. Dasselbe gilt in der Mitgliederverwaltung für „Lauf zurücknehmen“ und das Stornieren eines Verkaufs-Postens.
- **Stornieren einer schon abgerechneten Buchung eines gelöschten Mitglieds:** Bisher entstand eine Gutschrift auf dem gelöschten Konto, die nie verrechnet wurde. Jetzt lehnt Clubwerk das mit dem Hinweis ab, den Betrag bar zu erstatten und den Bestand bei Bedarf unter Lager zu korrigieren.
- Für Entwickler: Alle 16 bekannten Fehlschläge der erweiterten Testreihen sind geklärt (`erwartet.txt` ist leer). Fast alle prüften noch einen alten Stand (z. B. Adressen am Tablet, „Verkauf“ statt „Getränke“, Familienmitgliedschaft getrennt vom Zahler, PIN lässt sich am Tablet nicht mehr entfernen) und sind angepasst.

## 3.84.0

**Mitglieder-App „Für mich“: zeigt, was wirklich ansteht – aus allen Bereichen**
- **Vier feste Karten** statt „Als Nächstes“ und „Offen“: **Neu für dich**, **Als Nächstes**, **Zu erledigen**, **Mein Konto**. Leere Karten fallen weg, jede Zeile springt direkt an die passende Stelle.
- **Als Nächstes:** die nächste eigene Buchung, der nächste Helferdienst, Spieltage, für die ich zugesagt habe oder aufgestellt bin, und das nächste Spiel der Clubmeisterschaft – jetzt **bis 60 Tage voraus** (bisher 14). Jeder Bereich zeigt mindestens seinen nächsten Termin, vier Buchungen verdrängen also nie den Dienst.
- **Zu erledigen:** nur, was ich selbst tun muss – nie Erledigtes. **Zusagen oder absagen für Spieltage direkt in der Zeile** (✓/✕, derselbe Weg wie unter „Spieltage“, gleiche Regeln). Dazu „Aufstellung noch nicht verschickt“ (Mannschaftsführer), Clubmeisterschaft „Termin vereinbaren · Frist …“, „Ergebnis eintragen“ und „Anmeldung offen“, Arbeitsstunden „noch 4 h bis 31.12. · 2 freie Dienste“ (springt zu den freien Diensten), „Kontaktdaten ergänzen“ und „Lastschrift-Mandat fehlt“ (öffnet gleich das passende Blatt unter „Meine Daten“).
- **Mein Konto:** Thekenkonto (weiter unter Mitglieder-App › Bereiche ein- und ausschaltbar), offene Beiträge und Rechnungen und die nächste Lastschrift mit Datum – auf den Cent dieselben Zahlen wie unter „Meine Daten“. Familienmitglieder sehen wie bisher keine Beträge, die zahlt das Oberhaupt. Platzgebühren laufen über Beiträge & Zahlungen und stecken dort schon drin.
- **Neu für dich:** einmalige Hinweise – Antwort des Vereins auf meine Mängelmeldung, meine Buchung wegen einer Platzsperre storniert, Platz von der Warteliste frei. Nach dem Antippen verschwinden sie (eine neue Antwort erscheint wieder). Erledigte Mängelmeldungen stehen nicht mehr unter „Offen“.
- **Untere Leiste:** Beschriftungen werden nie mehr mit „…“ gekürzt („Meine Dat…“ am iPhone). Passt eine nicht ganz – schmales Handy, Anzeigezoom, die etwas breitere Schrift in Safari –, stehen alle Beschriftungen zweizeilig; die Symbole bleiben auf einer Linie. Der Design-Prüfstand prüft die Leiste dafür jetzt auch bei 320, 360 und 375 px Breite – bei 390 px passte „Meine Daten“ im Prüfstand gerade noch, deshalb ist es nicht aufgefallen.
- Datenschutz wie bisher: nur eigene Daten, nur freigeschaltete Bereiche, von unterwegs nur, was unterwegs erlaubt ist, nichts protokolliert. Welche Hinweise schon angetippt wurden, merkt sich Clubwerk je Mitglied (ohne Inhalt, nach 180 Tagen gelöscht).
- Module: Plätze 1.19.0, Spieltage 1.13.0, Dienste 2.7.0, Meine Daten/Mitglieder 1.22.0, Mängel 1.5.0, Turniere 1.3.0.
- Für Entwickler: Hook `forMe` liefert jetzt `news`, `next`, `todo` (mit optionalen Knöpfen `actions`) und `money` (siehe ERWEITERUNGEN.md); `open` von älteren Modulen landet unter `todo`.

## 3.83.0

**Weniger auf einen Blick – nur das, was gerade zählt (Entschlacken, Entscheidung)**
- **Übersicht:** Die Kennzahlenzeile oben ist weg – dieselben Zahlen stehen im Modulraster. „Einrichtung zu … % fertig“ ist nur noch eine Zeile mit Balken (die offenen Punkte stehen unter „Einrichtung“). „Zu erledigen“ zeigt jetzt 6 statt 3 Hinweise, jeden als kurzen Satz (z. B. „13 Artikel unter null – fehlt eine Lieferung?“ statt der ganzen Artikelliste); Einzelheiten zeigt der Hinweis beim Darüberfahren und die Seite, zu der der Link führt. „Bestand knapp“ und „Letzte Lieferungen“ erscheinen nur, wenn es etwas zu zeigen gibt. Im Modulraster rutscht eine Zahl nie mehr allein in die nächste Zeile („zu bestätigen: 0“).
- **Plätze › Buchung eintragen:** Gäste, Wiederholen und Notiz stehen hinter „Weitere Angaben“ zum Aufklappen. Beim Bearbeiten einer Buchung mit Gästen oder Notiz ist der Bereich gleich offen.
- **Mitglieder:** Die vier Zahlenkacheln über der Liste sind weg – „Aktuell“ und „Mit Hinweis“ stehen mit Zahl an den Filtern, „Austritt angekündigt“ jetzt unter „Auswertung › Ein- und Austritte“. Der Hinweis auf fehlende Pflichtangaben ist eine Zeile mit „Anzeigen“.
- Kürzere Hinweistexte auch aus Beregnung, Zugang, Zeiterfassung und Mitgliedern; die Fehlermeldung steht im Tooltip.
- Module: Mitglieder 1.21.6, Plätze 1.18.3, Beregnung 1.8.4, Zugang 1.6.3, Zeiterfassung 1.3.2.

## 3.82.0

**Mitglieder-Import: ähnliche Abteilungen werden zugeordnet statt neu angelegt**
- Steht in der Datei zum Beispiel „Padel-Abteilung“ und in Clubwerk gibt es schon „Padel“, legt der Import nicht mehr still eine zweite Abteilung an. Die Vorschau zeigt eine neue Karte „Abteilungen aus der Datei“ und fragt je Abteilung: **vorhandene verwenden**, **neu anlegen** oder **nicht übernehmen**. Es funktioniert wie bei den Beitragsarten und gilt für verein.cloud und alle anderen Dateiformate.
- Gibt es eine ähnliche Abteilung, ist die Wahl Pflicht – ohne Entscheidung wird nichts angelegt, und „Übernehmen“ weist mit einem Hinweis darauf hin. Jede vorhandene Abteilung lässt sich auch ohne Vorschlag zuordnen.
- „Nicht übernehmen“: Das Mitglied wird ohne diese Abteilung importiert, die Beiträge dieser Abteilung entfallen (die Karte nennt, wie viele Beitragsarten das betrifft). Der Hauptverein ist nie eine Abteilung.
- Mitglieder-Modul 1.21.5.

## 3.81.0

**Gleiche Linien, gleiche Höhen, nichts abgeschnitten – überall**
- **Formulare fluchten:** Felder untereinander liegen jetzt auf denselben Linien, statt dass jede Zeile anders geteilt ist. Dafür gibt es ein gemeinsames Formularraster mit vier Spalten (am Handy eine). Umgestellt sind unter anderem: Fenster „Buchung eintragen“, Einstellungen › Verein (Name, Farben, Anschrift, Kontakt), Mitglieder-App › Adresse, Lager › Bestelldaten, Artikel bearbeiten, Bruch/Korrektur, Beregnung › Plätze & Zonen, Lastschrift (SEPA), Neues Mitglied (Bankdaten) und Gratulationen.
- **Buchung eintragen:** Die Mitspieler stehen jetzt direkt unter dem Feld „Mitspieler“, „+ Gäste“ und „Wiederholen …“ in einer eigenen Zeile darunter – nicht mehr dazwischen. Die Mitspieler-Chips sind so hoch wie die Knöpfe.
- **Eine Höhe je Zeile:** Felder, Knöpfe, Reiter, Umschalter und Filterchips, die nebeneinanderstehen, sind gleich hoch (40 px). Bisher waren Reiter 44 px, Filterchips 32 px und kleine Knöpfe neben Feldern 34 px hoch.
- **Nichts mehr mit „…“ gekürzt:** Tablet-Kopfzeile bei 1280 px (z. B. „Stemp…“, „Bereg…“ – jetzt zweizeilig mit allen Reitern ganz), Namen in Handy-Listen (Verkauf, Protokoll, Plätze, Mitglieder-App), Reihenfolge der Tablet-Reiter am Handy, Einrichtung, Turnier-Tabellen und -Kacheln am Tablet, Kennzahlen bei Tablet-Breite, Verkauf › Auswertung, Mängel-Liste am Handy. Nur lange Texte (Protokolldetails, Dateinamen) dürfen in Handy-Listen am Ende mit „…“ enden – der volle Text steht beim Antippen.
- **Gleich hohe Karten:** Gruppen der Clubmeisterschaft nebeneinander sind gleich hoch.
- **Handy:** Die Suche in Filterleisten geht über die ganze Breite, die Filterchips stehen darunter in einer Zeile zum Wischen.
- Für Entwickler: neuer Baustein `.frm` (Formularraster, kit.css) und neue Regeln im Design-Prüfstand: Fluchtlinien (`d1-fluchtlinie`), gleiche Höhe in einer Zeile (`d2-zeilenhoehe`), Karten gleich hoch (`d3-kartenhoehe`), kein gekürzter Kurztext (`d4-gekuerzt`). Der Prüfstand wartet vor „nicht erreichbar“, bis die Seite fertig aufgebaut ist, und meldet Tablet-Gruppen, die keine Reiter fanden, statt sie still zu überspringen.
## 3.80.1

**Tablet: Die Kopfzeile bleibt beim Wechsel zwischen den Modulen stehen**
- Jeder Reiter am Tablet (Verkauf, Plätze, Dienste …) ist eine eigene Seite. Die Kopfzeile wurde bisher erst ganz am Ende jeder Seite aufgebaut. Kam die Seite etwas langsamer an (WLAN, Home Assistant), zeichnete das Tablet die neue Seite zuerst **ohne Kopfzeile** und baute sie danach sichtbar neu auf – erst ein leeres Feld fürs Logo, die Uhr kurz in einer anderen Schrift. Jetzt steht die Kopfzeile schon im ersten Bild jeder Seite fertig da.
- Am stärksten betroffen war die **Beregnung**: Dort wurde die Kopfzeile sogar erst nachträglich eingefügt (mehrere Bilder ohne Kopfzeile). Jetzt liefert der Server sie gleich mit.
- Gilt auch für „Verwaltung“ und eigene Links in der Kopfzeile. Verwaltung und Mitglieder-App waren nicht betroffen – dort wechselt nur der Inhalt, die Seite bleibt dieselbe.
- Messung (Chrome, 4-fach gebremst): erster Inhalt nach dem Modulwechsel 380 ms in 3.78, jetzt 328 ms (vor dem Design-Umbau 320 ms). Mit verzögert ankommenden Skripten: bisher bis zu 5 Bilder ohne Kopfzeile, jetzt keins.
- Für Entwickler: Der Design-Prüfstand meldet Tablet-Seiten, bei denen `nav.js` nicht direkt nach `<header id="gkHeader">` steht oder die Kopfzeile per Skript eingefügt wird.

## 3.80.0

**Kein Flackern mehr beim Tippen – Tablet, Verwaltung und Mitglieder-App reagieren wieder so flott wie vor dem Design-Umbau**
- **Ursache:** Jedes Fenster (PIN-Eingabe, Rückfragen, „Mehr“ in der App, das Menü der Verwaltung am Handy) hat die Seite dahinter festgehalten, indem es die ganze Seite umgestellt hat. Dabei hat der Browser bei jedem Öffnen und Schließen die komplette Seite neu gezeichnet. Seit dem Design-Umbau (weiche Schatten, Schimmer) kostet das ein Vielfaches – auf älteren Tablets und am iPhone sah das aus wie Flackern oder Neuladen. Jetzt hält das Fenster das Scrollen selbst fest; die Seite dahinter bleibt unberührt und steht trotzdem still.
- **Verkauf am Tablet:** Nach „Anderes Mitglied“, „Zurück“ und alle 60 Sekunden hat die Startseite alle Namenskacheln (samt Fotos) ein zweites Mal aufgebaut, auch wenn sich nichts geändert hatte. Jetzt wird nur neu gezeichnet, wenn sich etwas geändert hat.
- **Messwerte** (Chrome, 4-fach gebremst wie ein älteres Tablet; bisher → jetzt, in Klammern der Stand vor dem Design-Umbau): Namen antippen und „Abbrechen“ – Neuzeichnen 79 → 6 ms (vorher 10 ms), die Seite verschiebt sich dabei nicht mehr. „Anderes Mitglied“ 188 → 134 ms je Klick (vorher 142 ms), Name antippen bis zur Artikelseite 330 → 253 ms (vorher 233 ms). Rückfrage in der Verwaltung öffnen und schließen: Neuzeichnen 63 → 8 ms (vorher 18 ms). „Mehr“ in der App: 15 → 3 ms. Das Aussehen bleibt gleich.
- **Verwaltung:** Die Ziffernschrift lädt gleich beim Öffnen, Zahlen springen beim ersten Fenster nicht mehr kurz aus einer Ersatzschrift um.
- **Verwaltung › Beregnung › Bedienen:** Am iPhone blieb die Karte „Plätze“ leer mit der Meldung „undefined is not an object (evaluating 'T.prime')“. Die Platzkacheln wurden erst mitten in der Ansicht nachgeladen. Jetzt lädt die Verwaltung sie gleich zusammen mit dem Modul, auf demselben Weg wie das Modul selbst und mit dessen Versionsnummer. Dasselbe gilt für die Mitglieder-App und für die Türkacheln (Zugang) und die Turnier-Tabellen (Turniere).
- Für Entwickler: neues Feld `"skripte"` in der erweiterung.json (gemeinsame Bausteine, die Verwaltung und App vor admin.js/member.js laden, siehe ERWEITERUNGEN.md). Der Design-Prüfstand prüft jetzt Bedienschritte auf Flackern (keine Navigation, kein Neuladen von CSS/Schriften, nichts verschiebt sich, Neuzeichnen beim Fenster begrenzt, kein Neuaufbau unveränderter Listen) und meldet Seitensperren an html/body sowie nachgeladene Bausteine im Quelltext. Testreihe `berapp` erweitert.

## 3.79.1

**Mitglieder-Import: führende 0 bei Telefonnummern**
- In der Spaltenzuordnung stand bei „Mobil“ und „Telefon“ noch die Nummer wie in der Datei (ohne 0 am Anfang, weil das alte Programm sie als Zahl gespeichert hat). Übernommen wurde bei verein.cloud schon richtig mit 0 – jetzt zeigt auch die Zuordnung die Nummer so, wie sie übernommen wird.
- Dieselbe Korrektur gilt jetzt für **alle Dateiformate** (auch eigene Tabellen, S-Verein, WISO …), bisher nur für verein.cloud.

## 3.79.0

**Mitglieder-Import: Beispielwerte nicht mehr gemischt**
- Bei der Zuordnung der Spalten stand rechts je Feld der erste gefüllte Wert aus den ersten drei Zeilen der Datei. Fehlte bei der ersten Person z. B. die E-Mail, erschien die E-Mail der nächsten Person neben dem Namen der ersten – es sah aus, als würden Daten vertauscht. Übernommen wurde dabei immer richtig, nur die Anzeige war irreführend.
- Jetzt stehen rechts alle Werte **einer einzigen Person** (die vollständigste der ersten 50 Zeilen), mit Angabe der Zeile in der Datei.

**Übersicht der Verwaltung**
- Der Knopf „Bestellung“ oben rechts ist weg. Die Bestellung erreicht man wie gewohnt über das Menü (Lager › Bestellung).
- **Alles fluchtet:** Die Trennlinien der Kennzahlenzeile, „Zu erledigen“, das Modulraster und die beiden Karten unten liegen jetzt auf denselben Linien; Karten nebeneinander sind gleich hoch. Kurztexte im Modulraster und unter den Kennzahlen brechen um statt abgeschnitten zu werden. Nebeneinander stehen die Bereiche erst ab 1440 px Breite, darunter untereinander.
- Hinweis bei „Letzte Lieferungen“ nennt den richtigen Ort (Lager › Lieferungen & Belege).

## 3.78.0

**Demo-Modus: Clubwerk mit erfundenen Daten ausprobieren**
- **Beim allerersten Start** gibt es neben „Einrichtung starten“ den zweiten Weg **„Demo ausprobieren“**: Clubwerk startet einmal neu und zeigt einen erfundenen Verein mit Mitgliedern, Buchungen, Plätzen, Diensten, Turnieren und mehr. Wie die Einrichtung geht das nur über die Home-Assistant-Seitenleiste oder mit dem Einrichtungscode aus dem Protokoll des Add-ons.
- **Eigene Zugangsdaten:** Passwort der Verwaltung und Tablet-Passwort der Demo werden zufällig erzeugt und nur dem angezeigt, der die Demo startet (und angemeldeten Admins im Demo-Hinweis) – es gibt keine bekannten Standard-Passwörter.
- **Deutlich gekennzeichnet:** Hinweisleiste „Demo – alle Daten sind erfunden“ in der Verwaltung, „Demo“ in der Kopfzeile und auf der Sperrseite des Tablets, Hinweis in der Mitglieder-App.
- **Sicher:** In der Demo schaltet Clubwerk nie Geräte über Home Assistant (Türen, Beregnung – „Öffnen“ wird nur simuliert) und verschickt keine Push-Nachrichten und keine SMS.
- **„Demo beenden und einrichten“** (in der Hinweisleiste, mit allen Rechten und dem eigenen Passwort): Clubwerk startet neu und löscht dabei alles restlos – Datenbank, Belege, Bilder, Fotos, Dokumente, Mail-Anhänge, Sicherungen, Erweiterungen und die Zugänge der Demo. Danach begrüßt Clubwerk wie bei einer neuen Installation; wer die Demo beendet hat, richtet ohne Einrichtungscode ein (eine Stunde lang).
- Für Entwickler: Die Beispieldaten liegen jetzt im Paket (`clubwerk/demo/demo.sql`); `werkzeuge/demo/laden.js` nutzt dieselbe Ladefunktion. Neue Testreihe `demo`.

## 3.77.0

**Einrichtungs-Assistent und Betrieb ohne Tablet**
- **Erster Start:** Statt der bisherigen Seite „Erste Einrichtung“ begrüßt Clubwerk mit „Willkommen“, Sprache und „Einrichtung starten“. Danach entsteht das Admin-Konto – jetzt mit eigenem Namen und frei wählbarem Benutzernamen (vorgeschlagen bleibt „admin“), dazu der Hinweis auf das Notfallpasswort.
- **Einrichtungs-Assistent:** Führt danach Schritt für Schritt durch Sprache, Verein, „Wie nutzt ihr Clubwerk?“, Module, Sicherheit, Postfach, die Schritte der eingeschalteten Module (z. B. Artikel und Preise, Plätze, Beiträge, Vereinskonto, Lastschrift, Türen, Beregnung, Mannschaften, Personal), Mitglieder-App, Vereinsnetz und Sicherungen. Jeder Schritt zeigt dieselben Karten wie unter Einstellungen, oben steht der Fortschritt, unten „Später“ und „Weiter“. Zum Schluss „Fertig“ mit den offenen Punkten und dem QR-Code fürs Tablet.
- **Checkliste:** Auf der Übersicht steht „Einrichtung zu x % fertig“ mit den nächsten offenen Punkten. Der neue Menüpunkt **Verein › Einrichtung** zeigt alle Punkte – offen, erledigt, ausgeblendet – und führt mit „Einrichtung fortsetzen“ nur durch das, was noch fehlt. Übersprungene Punkte bleiben sichtbar, bis sie erledigt oder ausgeblendet sind. Nur mit dem Recht „Einstellungen“.
- **Ohne Tablet:** Unter Einstellungen › Tablet gibt es die neue Karte „Tablet im Vereinsheim“. „Ohne Tablet“ schaltet alle Tablet-Seiten ab (auch die der Module): Die Tablet-Adresse führt direkt zur Anmeldung der Verwaltung, ein Tablet-Passwort ist nicht nötig. Mitglieder-App und Beregnungs-Webapp laufen weiter. Beim Einschalten wird – falls noch keins vergeben ist – sofort das Tablet-Passwort festgelegt, bevor eine Tablet-Seite erreichbar ist. Ausschalten meldet alle Tablets ab.
- **Bestehende Installationen bleiben unverändert:** Das Tablet bleibt eingeschaltet, es erscheint keine Checkliste; der Menüpunkt „Einrichtung“ steht bereit, wenn man nachsehen will, was noch fehlt.
- Für Entwickler: Module melden ihre Schritte über den neuen Hook `setupSteps` (siehe ERWEITERUNGEN.md). Neue Testreihen `einr` und `ohnetab`.

## 3.76.0

**Design „Anzeigetafel“: Plätze (Belegungsplan am Tablet, in der Verwaltung und in der Mitglieder-App) – damit ist der Design-Umbau komplett**
- Nur das Aussehen, nichts an Buchungsregeln, Gebühren, Kontingenten oder Abläufen. Turnier-Buchungen („Clubmeisterschaft: …“) und Sperren bleiben gut lesbar.
- **Belegungsplan überall gleich:** Uhrzeiten an der Zeitachse und in den Blöcken in der Ziffernschrift, Blöcke mit weichem Schatten und runderen Ecken, ruhigere Spaltenköpfe, die „Jetzt“-Linie bleibt rot.
- **Verwaltung › Plätze:** Die Legende unter dem Plan besteht jetzt aus Pillen. Im Reiter „Buchungen“ haben alle Personen dieselben ruhigen Initialen statt bunter Farben, Uhrzeiten stehen in Ziffernschrift. Gebühren und Auswertung: Beträge und Kennzahlen in Ziffernschrift.
- **Mitglieder-App › Plätze › „Meine Buchungen“:** Hat man zwei eigene Buchungen, war die Zeile am Handy zu hoch. Jetzt steht das Datum kurz („Di, 27.10.“) und „Stornieren“ ist wie „Kalender“ und „Ändern“ ein Symbolknopf. Die Zeilen sind halb so hoch.
- Die letzten festen Farben (weiße Schrift, halbtransparentes Schwarz) sind durch die Farbwerte der Vereinsfarbe ersetzt; der Plan stimmt damit in hell, dunkel und „Hoher Kontrast“.

## 3.75.0

**Design „Anzeigetafel“: Mitglieder, Beiträge & Zahlungen, Gratulationen und Online-Antrag**
- Nur das Aussehen, nichts an den Abläufen oder am Geld: Beitragslauf, Lastschriften, Mahnungen und offene Posten rechnen wie bisher.
- **Mitglieder und Zahlungen:** Mitgliedsnummern, Datums- und Zeitangaben (Eintritt, Fälligkeit, Läufe, Verlauf, Dokumente) und die Summen unter Lauf und Einzug stehen jetzt in der Ziffernschrift wie die Kennzahlen und Beträge.
- **Gratulationen:** das Datum der Anlässe in der Ziffernschrift.
- **Online-Antrag (Beitrittserklärung):** Karten, Personen, Beitragsarten und Einwilligungen mit denselben Rändern und Rundungen wie die Mitglieder-App, Beiträge in Ziffernschrift. Die letzten festen Farben sind weg; nur die Tinte im weißen Unterschriftsfeld bleibt bewusst fest, damit sie auch im dunklen Modus lesbar ist.

## 3.74.0

**Turniere: LK-Turniertag mit nuLiga-Import (neue Seite „Turniertag“)**
- **Neue Seite „Turniertag“** in der Verwaltung (Recht „Turniere“). Die bisherige Seite heißt jetzt **„Clubmeisterschaft“**.
- **Import aus nuLiga:** die XML-Datei je Turnier (Turnier-Export). Mehrere Turniere am selben Wochenende werden ein Turniertag. Dazu optional die Meldeliste als CSV – sie bringt die genaue LK (z. B. 16,1) und „bar“ als Zahlungsart. Konkurrenzen ohne Meldungen werden übersprungen. Übernommen werden nur Name, Verein, LK, Geschlecht, Geburtsjahr und die nuLiga-Nummern – keine Anschriften, E-Mails oder Telefonnummern.
- **Neu einlesen** (z. B. nach einer Nachmeldung): Clubwerk zeigt vorher, was sich ändert (neue Spieler, geänderte LK, neue Planung, entfallene Matches). Check-in, Zahlungen, Ergebnisse und deine Umplanungen bleiben.
- **Check-in** in der Verwaltung und am Tablet: einchecken, Nenngeld bar oder digital, „abwesend“ und „wieder da“, Sortierung nach Nachname, Startzeit oder LK. Zeitwünsche aus nuLiga („bitte nur vormittags“) sind sichtbar. Das Nenngeld läuft in einem eigenen **Kassenbericht** (gesamt, bar, digital, offen) – nicht in der Verkaufskasse.
- **Turnierzentrale:** je Platz das laufende Match mit Spielzeit und das nächste mit voraussichtlicher Uhrzeit, ob es bereit ist (beide eingecheckt, nicht abwesend, nicht noch auf einem anderen Platz) und wie viel es über Plan liegt. Dazu die **Warteschlange**, „**Freie Plätze belegen**“ (bereite Matches auf freie Plätze, die für die automatische Verteilung frei gegeben sind) und „**Ursprüngliche Planung**“ zurück zu nuLiga. „Match starten“ hält die Startzeit fest.
- **Zeitplan:** je Platz eine Spalte mit roter Linie für jetzt. Läuft ein Match länger, rutschen die folgenden Matches desselben Platzes und derselben Spieler (mit Pause) nach hinten und sind markiert. Am Handy Platz für Platz. Dauer je Match und Pause unter „Einstellungen“.
- **Ergebnisse** tragen die Spieler nach dem Match am Tablet ein (einmal) oder die Turnierleitung (auch kampflos, Aufgabe, korrigieren). Unmögliche Ergebnisse werden abgelehnt. Folgerunden ohne Paarung lassen sich von Hand besetzen, bis nuLiga neu exportiert ist. Reiter „Ergebnisse“: Liste je Konkurrenz und Runde in der Reihenfolge von nuLiga zum Abtippen, auch zum Drucken.
- **Plätze:** entstehen aus den Platznamen in nuLiga; weitere (z. B. „Halle Platz A“) von Hand. Jeder Platz lässt sich einem Platz des Buchungssystems zuordnen – „Plätze sperren …“ sperrt ihn an den Turniertagen (vorher siehst du, welche Buchungen storniert würden; die Mitglieder bekommen Bescheid). Ohne das Modul „Plätze“ läuft alles ohne Sperren.
- **Fernseher im Clubhaus:** eigene Seite (Adresse unter Turniertag › Einstellungen) mit allen Plätzen, Verzug, Warteschlange und letzten Ergebnissen – aktualisiert sich selbst.
- **Spielerseite per QR-Code** (beim Check-in zeigen oder alle auf einmal drucken): ohne Konto und ohne App, nur ansehen – nächstes Match, Ablauf des Platzes, eigene Ergebnisse. Sie läuft über die Adresse der Mitglieder-App, gilt nur für dieses Turnier und nur bis zu seinem Ende.
- **Datenschutz:** Spieler fremder Vereine werden nach einer einstellbaren Frist nach dem Turnier gelöscht (Standard 30 Tage), eigene Mitglieder bleiben.
- **Plätze (Buchungssystem):** kann jetzt Plätze für einen Turniertag sperren und wieder freigeben (für das Modul „Turniere“).
## 3.73.0

**Buchhaltung und Mängel im neuen Aussehen „Anzeigetafel“ (Etappe D2-9 des Design-Umbaus)**
- **Buchhaltung:** Rechnungsnummern, Daten, Beträge und Summen stehen in der schmalen Zahlenschrift – in der Rechnungsliste, im Rechnungsfenster, bei „Zahlung buchen“, in den Positionen mit Netto, Umsatzsteuer und Gesamt, bei den Spendenquittungen und bei den Bankkonten.
- **Spendenquittungen:** Die drei Kennzahlen oben haben jetzt alle eine Zeile mit der Anzahl und stehen dadurch auf einer Linie. Stornierte Quittungen tragen eine Marke „storniert“.
- Das Kreuz zum Entfernen einer Rechnungsposition ist ein Liniensymbol statt eines Schriftzeichens.
- **Mängel (Verwaltung):** Meldedatum und Uhrzeit, „+2“ bei „Auch gemeldet“ und das Abschlussdatum stehen in der Zahlenschrift; die Pfeile zum Sortieren der Orte sind Liniensymbole.
- Nur das Aussehen ändert sich – keine Rechnungs-, Spenden- oder Zahlungslogik.
## 3.72.0

**Turniere: Doppel, Saisonabschluss mit Ehrentafel und Import einer Einteilung (Clubmeisterschaft, zweiter Teil)**
- **Doppel:** Beim Anlegen der Saison legst du die Doppel-Ligen fest. Vorgegeben ist „A+B, C+D“ – je zwei benachbarte Einzel-Ligen; bei einer ungeraden Zahl spielt die letzte Liga allein, dann werden die Partner innerhalb der Liga gelost. In der App melden sich Mitglieder für Einzel und/oder Doppel an.
- **Partner auslosen:** Jede Person aus der oberen Liga bekommt einen Partner aus der unteren. Wer übrig bleibt, steht unter „ohne Partner“. Daraus kannst du von Hand ein Paar bilden – ein Dreier-Team gibt es nicht. Danach werden die Paare in Gruppen gelost (gleich groß, ab 6 Paaren zwei Gruppen), und jede Doppel-Liga spielt ihre eigene Endrunde: Halbfinale über Kreuz, Finale, Clubmeister „Doppel A+B“.
- **Doppel spielen:** Termin und Ergebnis kann jeder der vier Spieler eintragen, die Platzbuchung gilt für alle vier. Der Titel lautet z. B. „Clubmeisterschaft: Felix Adler/Daniel Graf gegen … – Doppel A+B – Gruppenphase“. In Tabellen stehen Paare kurz als „Adler / Graf“.
- **Saison abschließen** (Übersicht › „Saison abschließen …“): Clubwerk zeigt vorher die Clubmeister, wer durch die Relegation die Liga wechselt und ob noch Spiele offen sind. Danach stehen die Clubmeister in der **Ehrentafel**, und Ergebnisse lassen sich nicht mehr ändern.
- **Nächste Saison:** Bei „+ Neue Saison“ lässt sich die Einteilung der abgeschlossenen Saison übernehmen – mit der Relegation: Der Sieger aus der unteren Liga steigt auf, der Verlierer aus der oberen ab. Angemeldet ist damit noch niemand. Wer sich in der App anmeldet, behält seine Liga.
- **Ehrentafel:** neuer Reiter in der Verwaltung, zusätzlich in der App unter „Endrunde“ und am Tablet. Frühere Jahre (vor Clubwerk) lassen sich mit „+ Eintrag“ ergänzen.
- **Einteilung importieren** (Teilnehmer › „Import …“, nur vor der Auslosung): einmalig aus Excel oder CSV, damit die Vorsaison nicht neu getippt werden muss. Gebraucht werden die Spalten „Name“ (oder „Vorname“ und „Nachname“) und „Liga“ – oder je Liga ein Blatt namens „A“, „B1“ … Gleiche Namen ordnet Clubwerk sicher zu. Bei ähnlichen Namen (Tippfehler, „Nachname, Vorname“) fragt es nach und schlägt passende Mitglieder vor.
- **Teilnehmer:** Filter „Angemeldet“; je Person sieht man, ob sie Einzel und/oder Doppel spielt und ob sie aus der Vorsaison, aus dem Import, aus der App oder von Hand kommt.
## 3.71.0

**Neues Modul „Turniere“ – erster Teil: die Clubmeisterschaft im Einzel**
- **Einschalten** unter Einstellungen › Module & Erweiterungen („Turniere“, zunächst aus). Neues Recht **„Turniere“** für den Sportwart (Verein › Benutzer & Rechte).
- **Saison anlegen** (Turniere › „+ Neue Saison“): Name, Zahl der Ligen (A, B, C …), Anmeldeschluss und zwei Fristen – „Gruppenphase“ und „Endspiele + Relegation“.
- **Anmeldung in der Mitglieder-App** unter „Turniere“ mit „Ich spiele mit“. Wer neu dabei ist, startet in der untersten Liga; der Sportwart kann umsetzen und auch selbst Spieler eintragen. Nur Mitglieder spielen mit.
- **Auslosung auf Knopfdruck:** Jede Liga wird zufällig in zwei gleich große Gruppen gelost (ab 6 Spielern, sonst eine Gruppe). Neu losen oder zwei Spieler zwischen den Gruppen tauschen geht, solange in der Gruppe noch kein Spiel gewertet ist. Alles steht im Protokoll, alle Spieler bekommen eine Nachricht.
- **Spielen:** jeder gegen jeden, zwei Gewinnsätze, bei 1:1 ein Match-Tiebreak bis 10. In der App tippt der Spieler auf sein Spiel, wählt den Tag und eine freie Zeit – der Platz wird für **beide** gebucht, mit dem Titel „Clubmeisterschaft: Spieler A gegen Spieler B – Gruppe A1 – Gruppenphase“ (bzw. „Halbfinale“, „Finale“, „Relegation A/B“). Verlegen ändert dieselbe Buchung, Absagen storniert sie. Ohne das Modul „Plätze“ tragen die Spieler nur Tag und Uhrzeit ein. Den Gegner kann man direkt aus der App anrufen oder ihm schreiben (wenn die Mitgliederverwaltung eine Nummer kennt).
- **Regeln für die Platzbuchung:** Ein Turnierspiel ist ein Vereinstermin – ohne Gebühr, es zählt nicht zum Kontingent der offenen Buchungen und darf über den normalen Vorlauf hinaus bis zur Frist gebucht werden. Öffnungszeiten, Zeitraster, Sperren und belegte Plätze gelten, und niemand kann zur selben Zeit zwei Plätze haben. Unter „Buchen“ sieht man das Spiel, verlegt und abgesagt wird es aber unter „Turniere“. Die Buchungsart „Clubmeisterschaft“ legt sich beim ersten Spiel selbst an.
- **Ergebnis eintragen** kann einer der beiden Spieler, Satz für Satz (z. B. 6:4 3:6 10:7), dazu „Kampflos“ und „Aufgabe“. Unmögliche Ergebnisse werden abgelehnt (6:5, 8:5, Match-Tiebreak 9:7 …). Korrigieren kann danach nur der Sportwart.
- **Tabelle wie in der DTB-Vorlage:** Siege, dann Satzdifferenz, dann Spieldifferenz; bei Gleichstand entscheidet der direkte Vergleich. Kampflos zählt 6:0 6:0, bei Aufgabe bekommt der Sieger die fehlenden Spiele und Sätze.
- **Endrunde und Relegation setzt Clubwerk von selbst:** Sobald die oberste Liga fertig ist, spielen Erster und Zweiter beider Gruppen über Kreuz das Halbfinale, die Sieger das Finale → **Clubmeister**. Sobald zwei benachbarte Ligen fertig sind, spielt der Letzte jeder Gruppe gegen die Gruppensieger der Liga darunter (Relegation). Nach Fristende beendet der Sportwart die Gruppenphase auf Knopfdruck; offene Spiele zeigt Clubwerk vorher an.
- **Für den Sportwart** (Verwaltung › Turniere): Übersicht mit dem nächsten Schritt und den überfälligen Spielen („Erinnerung schicken“ per Push und E-Mail), Teilnehmer mit Ligen, alle Spiele mit Filter, Tabellen und Bäume zum **Drucken** für den Aushang.
- **Mitglieder-App:** „Dein nächstes Spiel“ als Hauptkarte, meine Spiele, Tabellen und Endrunde. Termine und offene Spiele erscheinen unter „Für mich“. Benachrichtigungen: neues Spiel ausgelost, Frist in 7 Tagen, Ergebnis eingetragen, Termin vereinbart, Erinnerung vom Sportwart.
- **Tablet:** neuer Reiter „Turniere“ mit allen Tabellen, Endrunde und Relegation – nur zum Anschauen, ohne PIN.
- Doppel, Saisonabschluss mit Ehrentafel und der Import einer Einteilung aus Excel folgen in der nächsten Version.

## 3.70.0

**Beregnung und Zugang im neuen Aussehen „Anzeigetafel“ (Etappe D2-7 des Design-Umbaus)**
- **Statuszeile** („Verbunden mit der Bewässerungsanlage“, „Verbunden“) ist jetzt eine runde Pille, die sich der Textlänge anpasst – in der Beregnungs-Webapp, am Tablet und in der Mitglieder-App.
- **Laufende Zonen:** Restzeit, „Start in …“ und „ab 14:30 Uhr“ stehen in der schmalen Zahlenschrift, etwas größer.
- **„Alle Zonen ausschalten“** steht ganz unten und deutlich abgesetzt, nur als roter Umriss – in der Webapp, am Tablet, in der App und in der Verwaltung (dort unter einer Trennlinie).
- **Beregnungs-Webapp:** Der Titel „Bewässerungssteuerung“ passt jetzt am Handy ungekürzt in die Kopfzeile.
- **Zugang (Verwaltung):** Uhrzeiten der Zeitprofile, Sperrzeiträume, Verlauf und „zuletzt“ stehen in der Zahlenschrift; ebenso Zeit und Minuten im Beregnungs-Verlauf.
- Nur das Aussehen ändert sich – keine Abläufe, keine Sicherheits- oder Zugangsregeln.

## 3.69.0

**Helferdienste und Zeiterfassung im neuen Aussehen „Anzeigetafel“ (Etappe D2-6 des Design-Umbaus)**
- **Helferdienste:** Uhrzeiten, Stunden und Datumsziffern stehen überall in der schmalen Zahlenschrift – in der Mitglieder-App (Schichtzeiten, „Meine Stunden“, „Meine Dienste“), am Tablet (Einsatzzeiten, „seit …“, Dauer beim Ausstempeln) und in der Verwaltung (Datumsblöcke, Zeitspalte der Schichten). Die Fortschrittsbalken sind jetzt immer in der Vereinsfarbe; ob etwas fehlt, zeigt weiterhin die rote Zahl daneben.
- **Zeiterfassung am Tablet:** Die Erfolgsmeldung zeigt statt des „✓“-Zeichens ein sauberes Linien-Symbol im runden Feld (auch beim Zurücknehmen). Uhrzeiten und Summen in der Meldung und in den Kacheln stehen in der Zahlenschrift.
- **Zeiterfassung in der Verwaltung:** Datum, Kommen und Gehen in der Einsatzliste stehen in der Zahlenschrift, passend zu den Summen.
- Nur das Aussehen ändert sich – keine Abläufe, keine Stunden, keine Beträge. Die Druckansichten bleiben unverändert.

## 3.68.0

**Verkauf am Tablet im neuen Aussehen „Anzeigetafel“ – Buchen, Warenkorb, Fenster, Veranstaltung und Deckel (Etappe D2-2 des Design-Umbaus)**
- **Buchen:** Die Artikelkacheln haben einen weichen Schatten statt eines harten Rahmens; Preise und Mengen stehen in der schmalen Zahlenschrift. „Mein Konto“, „PIN ändern“ und „Anderes Mitglied“ sind ruhige, runde Knöpfe. Am Handy teilen sich die drei Knöpfe die Zeile, nichts ragt mehr über den Rand.
- **Warenkorb:** Die Auswahl rechts ist jetzt eine eigene Karte. Die Summe steht groß in der Zahlenschrift, „Buchen“ ist der einzige Hauptknopf.
- **Fenster (PIN, Mein Konto, Deckel, Betrag, Bezahlen):** Beträge stehen in der Zahlenschrift; in „Mein Konto“ stehen Datum und Beträge sauber in Spalten, die Beträge rechtsbündig.
- **Veranstaltung und Gäste-Deckel:** Statt eines orangen Kastens gibt es eine ruhige weiße Karte mit einem Farbstrich am Rand (wie die Hinweise in der Verwaltung). Die Deckel-Kacheln sehen aus wie die Mitgliederkacheln; am Handy stehen sie untereinander, damit Namen und Beträge ganz lesbar sind.
- „Gerade oft hier“ zeigt weiterhin nur die Namen, keine Besuchszahl (Datenschutz am Tablet).
- Nur das Aussehen ändert sich – keine Abläufe, keine Beträge.

## 3.67.0

**Neues Aussehen „Anzeigetafel“: Spielbetrieb (Verwaltung, Mitglieder-App, Gast-Seite)**
- **Uhrzeiten und Zähler** (z. B. „10:00 Uhr“, „2/4 können“) stehen jetzt in den schmalen Anzeigetafel-Ziffern, genauso wie die Datumsblöcke, die Quote und die Daten in der Übersicht.
- **Zusagen-Marken (✓/✕)** und die Schalter beim Aufstellen sind jetzt Pillen, die Spielkarten in der Verwaltung haben weiche Schatten statt Rahmen, die Kalender-Marken sind Pillen.
- **Legenden** unter Kalender und Übersicht sind ruhiger: kleiner, mit feiner Trennlinie darüber.
- **Gast-Seite:** Oben steht jetzt „Spieltage“ als Seitentitel. Der Name des Gastes steht klein in der Begrüßung („Hallo …“) statt als riesige Überschrift.
- Nur das Aussehen ändert sich – alle Abläufe sind gleich geblieben.

## 3.66.0

**Gratulationen: Geburtstage und Jubiläen nicht mehr verpassen (Mitglieder)**
- **Neuer Reiter Mitglieder › Gratulationen:** Hier stehen alle Geburtstage und Jubiläen der nächsten 30 Tage, für die der Verein gratuliert – mit Datum, „Nachname, Vorname“, Anlass (z. B. „70. Geburtstag“, „25 Jahre im Verein“) und was geplant ist (z. B. „Blumen“). Was in den letzten 14 Tagen vergessen wurde, bleibt als „vorbei“ stehen, bis es abgehakt ist.
- **Je Anlass abhaken:** „Wer kümmert sich?“, Notiz und „Erledigt“. Ein erledigtes Vereins- oder Abteilungsjubiläum lässt sich gleich als **Ehrung beim Mitglied** eintragen (z. B. „Ehrennadel – 25 Jahre im Verein“).
- **Regeln** unter Mitglieder › Einstellungen › Gratulationen, als einfache Liste: Anlass (Geburtstag, Vereinsjubiläum, Abteilungsjubiläum – für alle oder eine bestimmte Abteilung), wann (z. B. „70, 75, ab 80“ – „ab 80“ heißt mit 80 und danach jedes Jahr) und was. Voreingestellt: Geburtstag 70, 75 und ab 80 jedes Jahr → Blumen; 25 Jahre im Verein → Ehrennadel, 40 → Urkunde, 50 → Ehrenmitglied vorschlagen.
- **Ausnahmen:** Ausgetretene bekommen nie eine Gratulation (auch nicht, wenn sie vor dem Anlass austreten). Möchte jemand keine Gratulation, reicht ein Häkchen beim Mitglied (Reiter „Mitgliedschaft“, Karte Ehrungen) oder „Keine Gratulation gewünscht …“ in der Liste. Anlässe, die keine Regel kennt (z. B. eine Goldene Hochzeit), lassen sich mit „+ Anlass“ von Hand ergänzen. Wer am 29. Februar Geburtstag hat, steht in anderen Jahren am 28. Februar in der Liste.
- **Neues Recht „Gratulationen“** (Verein › Benutzer & Rechte): Nur wer es hat, sieht die Liste und wird erinnert – auch ohne Zugriff auf die übrigen Mitgliederdaten. Auf der Startseite der Verwaltung erscheinen anstehende Gratulationen unter „Zu erledigen“ (bei allen, die zusätzlich das Recht „Mitglieder“ haben); „Ansehen“ führt direkt in den Reiter.
- **Erinnerung einige Tage vorher** (Standard 7 Tage, einstellbar) per E-Mail und/oder Push in der Mitglieder-App – jede Person wählt das selbst unter „Deine Erinnerung“. Dafür muss das eigene Benutzerkonto mit dem eigenen Mitglied verknüpft sein; Push kommt nur mit gekoppelter App. Jede Erinnerung kommt je Anlass genau einmal, auch nach einem Neustart. Der Push-Anlass „Gratulation steht an“ lässt sich unter Mitglieder-App › Benachrichtigungen abschalten.
- **Datenschutz:** Die Erinnerung nennt Name, Anlass und Datum, aber weder Alter noch Geburtsjahr. Im Protokoll stehen nur Bezeichnungen, keine internen Schlüssel. Sind die persönlichen Daten nach einem Neustart noch verschlossen, wartet die Erinnerung, bis sie geöffnet sind. Anonymisieren löscht auch die Gratulationen samt Notizen; die Datenauskunft enthält sie.
- Unter Auswertung bleibt die Karte „Runde Geburtstage & Jubiläen“ als Liste für 12 Monate; die Namen stehen dort jetzt ebenfalls als „Nachname, Vorname“.

## 3.65.0

**Verwaltung im neuen Aussehen „Anzeigetafel“ – Auswertung, Tabellen, Anmeldung, Einstellungen, E-Mail (Etappe D2-3 des Design-Umbaus)**
- **Auswertung:** Die großen Zahlen (Umsatz, Artikel, Buchungen …) stehen jetzt in der schmalen Zahlenschrift wie auf einer Anzeigetafel. Die Leiste mit Bestseller, stärkstem Tag, Stoßzeit und Ø je Buchung sieht aus wie die Spielstandstafel der Übersicht: kleine Beschriftung darüber, große Zahl darunter.
- **Tabellen:** Beträge und Mengen (z. B. in Abrechnung und Konten) stehen in der Zahlenschrift. Die Spaltenüberschriften sind etwas kleiner und ruhiger. Rote Beträge bleiben rot, Zeilenhöhen und Knöpfe bleiben gleich.
- **Anmeldung:** Das Vereinslogo steht auf einer weißen, runden Kachel wie im Seitenmenü, unter „Verwaltung“ steht die doppelte Platzlinie, und der leichte Farbschimmer im Hintergrund reicht jetzt bis ganz nach oben (vorher begann er mit einer Kante). Am Handy hat die Karte rechts und links Abstand zum Rand.
- **Einstellungen › Verein:** Die Farbfelder sind runde Pillen. Neu darunter: eine kleine **Vorschau**, wie Clubwerk die Vereinsfarbe in hell und dunkel berechnet (Knopf und Hauptkarte) – sie wechselt mit, sobald du die Farbe änderst, ohne zu speichern.
- **E-Mail:** Empfänger-Chips und Anhänge als Pillen, Datum in der Zahlenschrift, ruhigere Zwischenüberschriften in der Vorschlagsliste, Mailvorschau als Karte mit weichem Schatten.
- Es ändert sich nur das Aussehen, keine Abläufe.

## 3.64.0

**Mitglieder-App › Buchen: „Freie Zeiten“ als Liste (Etappe D2-1 des Design-Umbaus)**
- **Eine Zeile je Uhrzeit:** Links steht die Uhrzeit groß, daneben je Platz ein rundes Kästchen und rechts kurz „3 frei“, „alle frei“ oder was dort los ist („Training“, „Medenspiel“). Freie Kästchen sind in der Vereinsfarbe, belegte grau und durchgestrichen, die eigene Buchung ist gefüllt. Antippen eines freien Kästchens öffnet dasselbe Buchungsfenster wie bisher.
- **Plätze mit anderem Zeitraster** (z. B. Stundenplätze und Halbstundenplätze) stehen in je einer eigenen Liste, damit die Kästchen immer genau zu ihrer Uhrzeit gehören. Hinweise zu einem Platz (Abteilung, Platzgebühr, Notiz) stehen unter der Liste.
- **Umschalter:** Die Reihenfolge ist jetzt „Freie Zeiten · Kompakt · Ausführlich“. Wer schon etwas gewählt hat, behält seine Wahl.

## 3.63.0

**Neues Aussehen „Anzeigetafel“ – Grundlagen, Vereinsfarbe und Hoher Kontrast (Etappe D1 des Design-Umbaus)**
- **Zahlen wie auf einer Anzeigetafel:** Uhrzeit, Beträge, Kennzahlen und Datumsziffern stehen in einer schmalen, gut lesbaren Zahlenschrift (Barlow Condensed). Sie liegt wie die bisherige Schrift im Paket – Clubwerk lädt nichts aus dem Internet.
- **Ruhigeres Bild überall:** Karten und Kacheln mit weichem Schatten statt Rahmen, rundere Ecken, Umschalter und Reiter als Pillen, ein ganz leichter Schimmer in der Vereinsfarbe im Hintergrund. Unter den Seitentiteln steht eine doppelte Linie wie eine Platzmarkierung. Hinweise in der Verwaltung sind eine ruhige Fläche mit farbigem Strich statt eines roten Kastens. Initialen haben überall die Vereinsfarbe statt bunter Farben je Name.
- **Tablet-Verkauf:** schwebende Kopfleiste aus Glas mit großer Uhr, „Gerade oft hier“ als dunkle Karten in der Vereinsfarbe, die Suche als große Pille, Buchstaben als runde Knöpfe neben „Alle Mitglieder“.
- **Verwaltung › Übersicht:** oben die wichtigsten Zahlen in einer Reihe wie eine Spielstandstafel, darunter „Zu erledigen“ als Karte in der Vereinsfarbe (die drei wichtigsten Hinweise, der Rest unter „Alle zeigen“) und daneben alle Module in einem gleichmäßigen Raster mit Zustand und Zahl. Das Seitenmenü schwebt als Glasleiste; ein Punkt zeigt, wo etwas zu tun ist.
- **Mitglieder-App:** großer Seitentitel mit Linie, Vereinsname klein darüber. Unter „Plätze“ steht die eigene nächste Buchung groß oben („Ändern“ öffnet dasselbe Fenster wie bisher), die Tage als Kacheln mit großen Ziffern, die Leiste unten schwebt als Glas.
- **Vereinsfarbe mit Kontrast-Automatik** (Einstellungen › Verein): Ist die Farbe für Schrift zu hell (z. B. Gelb), dunkelt Clubwerk sie für Schrift und Knöpfe automatisch ab, im dunklen Modus hellt es sie auf – Text bleibt immer gut lesbar. Das gilt auch für E-Mails und den Excel-Export. Neu ist eine **Zweitfarbe** (freiwillig, z. B. aus dem Logo) für einen zweiten, leichten Schimmer. Ohne Änderung bleibt alles beim bisherigen Grün.
- **Hoher Kontrast:** kräftige Ränder, keine Schatten und kein Glas, stärkere Schrift – für die Theke bei Sonnenlicht und für alle, die es deutlicher mögen. Einstellbar in der Verwaltung unter Mein Konto › Darstellung, in der App unter Mein Konto › Darstellung und für alle Tablets unter Einstellungen › Tablet › Darstellung am Tablet. Steht ein Gerät auf „mehr Kontrast“, schaltet Clubwerk von selbst um. Auch „Transparenz reduzieren“ wird beachtet (dann ohne Glas).
- **Design-Prüfstand:** prüft jetzt zusätzlich Hohen Kontrast und zwei Vereinsfarben (Blau und ein helles Gelb), misst den Kontrast auch auf Farbverläufen und meldet Emojis als Symbole und Glas an anderen Stellen als den drei vorgesehenen.

## 3.62.1

**Sicherheitsupdates für verwendete Bausteine**
- **Komprimierung (compression 1.8.2):** Brach ein Browser eine Antwort mittendrin ab, konnte Speicher liegen bleiben. Viele solche Abbrüche hätten den Server ausbremsen können.
- **Annahme von Daten (body-parser 2.4.0, Teil von Express):** Eine gezielt präparierte, gepackte Anfrage konnte den Server beschäftigen. Das betraf auch die Mitglieder-App, wenn sie von außen erreichbar ist.
- **Mailversand (nodemailer 10.2.1):** Ungewöhnlich geschriebene E-Mail-Adressen (mit Anführungszeichen, Klammern oder Semikolon) konnten falsch zerlegt werden, sodass eine Mail an eine andere Adresse gehen konnte als angezeigt.
- An der Bedienung ändert sich nichts.

## 3.62.0

**Mitglieder-App startet mit „Für mich“ (Etappe 16 des Menü-Umbaus)**
- **Neue Startseite „Für mich“:** Wer die App öffnet, sieht sofort, was für ihn ansteht. Unter **Als Nächstes** stehen die eigenen Termine der nächsten 14 Tage (höchstens fünf): Platzbuchungen (auch als Mitspieler), frei gewordene Plätze von der Warteliste, Spieltage mit fehlender Zusage oder mit eigener Aufstellung und eingetragene Helferdienste. Unter **Offen** stehen fehlende Arbeitsstunden, offene Beiträge und Gebühren und die eigenen Mängelmeldungen. Was erledigt ist, fällt weg. Steht nichts an, sagt die Seite das und bietet den nächsten Schritt an (z. B. „Platz buchen“).
- **Jede Zeile führt in den passenden Bereich**, ein Spieltag öffnet sich dort gleich aufgeklappt.
- **Thekenkonto:** Auf Wunsch zeigt „Für mich“ auch, was auf dem Thekenkonto noch offen ist (noch nicht abgerechnete Buchungen). Das ist von Haus aus aus und lässt sich unter Mitglieder-App › Bereiche einschalten.
- **Nur eigene Daten:** Jedes Mitglied sieht nur, was zu ihm gehört, und nur aus Bereichen, die für es freigeschaltet sind. Offene Beiträge sieht nur, wer selbst zahlt. Bereiche, die nur im Vereins-WLAN gehen, erscheinen von unterwegs nicht. Ist ein Modul aus, fehlt nur seine Zeile.
- **Schnell:** Eine einzige Abfrage fragt alle Bereiche gleichzeitig. Braucht einer länger als 1,5 Sekunden, fehlt nur seine Zeile.
- **Untere Leiste:** „Für mich“ steht immer ganz links. Dazu kommen bis zu vier Bereiche, bei mehr Bereichen die ersten drei und „Mehr“. So bleibt es bei höchstens fünf Knöpfen, und keine Beschriftung wird abgeschnitten.
- **Start der App:** Die App öffnet jetzt immer „Für mich“. Ein bisher fest eingestellter Start-Bereich wurde beim Update einmal zurückgesetzt. Wer lieber mit einem bestimmten Bereich starten möchte, wählt ihn unter Mitglieder-App › Bereiche in der Spalte „Start“. Die Möglichkeit „zuletzt genutzter Bereich“ gibt es nicht mehr.

## 3.61.0

**Die Suche findet jetzt auch Datensätze (Etappe 17 des Menü-Umbaus)**
- **Strg/⌘ K findet Mitglieder, Konten, Artikel, Rechnungen, Firmen & Sponsoren, Dienstpläne und Spieltage**, nicht mehr nur Seiten und Einstellungen. Ab zwei Buchstaben fragt die Verwaltung kurz nach dem Tippen beim Server nach und zeigt höchstens fünf Treffer je Art. Groß- und Kleinschreibung und Umlaute spielen keine Rolle, Vor- und Nachname gehen in jeder Reihenfolge, Mitglieder auch über die Mitgliedsnummer, Rechnungen über die Rechnungsnummer.
- **Personen erscheinen als „Nachname, Vorname“** mit einer kurzen Zuordnung (z. B. Nr. und Abteilung, Kategorie eines Artikels, Datum eines Spieltags). Bankdaten, PINs, Kontaktdaten und Beträge zeigt die Suche nie.
- **Ein Klick öffnet den Datensatz:** Mitglieder und Dienstpläne in ihrer eigenen Seite, alles andere in der passenden Liste. Dort ist der Eintrag kurz farbig markiert (Konten zeigen gleich Konto und PIN rechts daneben).
- **Jeder sieht nur, was er darf:** Gefragt werden nur Module, für die der Benutzer das Recht hat. Eine Abteilungsleitung findet nur Mitglieder ihrer eigenen Abteilungen.
- **Tresor gesperrt** (nach einem Neustart, bis sich ein Admin anmeldet): Die Suche zeigt keine Personen und sagt das in einem Hinweis. Mannschaften, Artikel, Firmen und Spieltage findet sie weiter.
- Suchbegriffe landen nicht im Protokoll. Auch mit mehreren Tausend Mitgliedern antwortet die Suche in wenigen Hundertstelsekunden.
- Plätze: Der Hinweis zu Gebühren nennt den neuen Ort „Beiträge & Zahlungen › Offene Posten“.

## 3.60.0

**Mitglieder-App: PIN ändern und Abmelden (Etappe 15 des Menü-Umbaus)**
- **PIN ändern in der App:** Unter „Mehr“ › Mein Konto › **PIN ändern** gibt man die bisherige PIN und zweimal die neue ein. Es ist dieselbe PIN wie am Tablet – die neue gilt sofort an beiden Stellen. Ist der Verkauf nicht eingeschaltet, ist es einfach die PIN der App.
- **Schutz wie beim Anmelden:** Wer die bisherige PIN fünfmal falsch eingibt, muss erst einige Minuten warten, nach 15 Fehlversuchen ist das Handy gesperrt – genau wie bei jeder anderen PIN-Eingabe in der App, auch von unterwegs. Im Protokoll steht „PIN geändert“ mit dem Namen, nie die PIN.
- **Hinweis aufs Handy:** Wird die PIN geändert, bekommen die anderen Geräte des Mitglieds mit eingeschalteten Benachrichtigungen die Nachricht „PIN geändert“ – auch, wenn die PIN am Tablet geändert wurde. Wer es nicht selbst war, merkt es so sofort. Der Anlass steht in der Verwaltung bei den Push-Benachrichtigungen und ist von Haus aus eingeschaltet.
- **Leicht zu erratende PINs gehen nicht mehr:** Wer seine PIN selbst festlegt (in der App, beim Einlösen der Einladung oder am Tablet), kann keine PIN wie 1111, 1234 oder 9876 mehr wählen. Vorhandene PINs gelten weiter.
- **Abmelden:** Unter Mein Konto steht abgesetzt in Rot **Abmelden**. Nach einer Rückfrage („Für die App brauchst du danach eine neue Einladung“) ist genau dieses Handy sofort entkoppelt – wie „Handy entfernen“ in der Verwaltung. Die Freischaltungen des Mitglieds bleiben, mit einer neuen Einladung ist es wieder dabei.

## 3.59.0

**Tablet-Kopfzeile und App-Leiste neu geordnet (Etappe 14 des Menü-Umbaus)**
- **Mitglieder-App:** Unten stehen höchstens fünf Knöpfe. Hat ein Mitglied bis zu fünf Bereiche, sind es alle. Bei mehr Bereichen stehen die **ersten vier** unten, danach kommt **„Mehr“**. Die Reihenfolge ist dieselbe wie im Tablet (Plätze, Spieltage, Dienste, Beregnung, Türen, Mängel, Meine Daten); was der Verein unter Mitglieder-App › Bereiche festgelegt hat, gilt weiter.
- **„Mehr“** öffnet ein Blatt in der App (kein neues Fenster): oben die übrigen Bereiche, darunter **Mein Konto** mit Profilbild, Benachrichtigungen, **Sprache** (stand bisher ganz unten auf jeder Seite) und der Version. Das Profilbild oben rechts öffnet dasselbe Blatt. Ist ein Bereich aus „Mehr“ offen, leuchtet „Mehr“ in der Leiste.
- **Tablet:** Passen nicht alle Reiter in die Kopfzeile, wandern die letzten hinter **„Mehr“** ganz rechts. Der Reiter, auf dem man gerade ist, bleibt immer sichtbar. Nichts wird mehr abgeschnitten.
- **Ein Sperrbildschirm für alle Tablet-Seiten:** Vereinslogo, Vereinsname, „Seite gesperrt“ und das Passwortfeld sehen auf Verkauf, Plätze, Dienste, Stempeln, Mängel und Mitglied werden gleich aus. Nach dem Freischalten erscheint die Reiterleiste sofort (vorher erst nach dem Neuladen).
- Die gespeicherte Reihenfolge der Bereiche, die Startseite und die Tablet-Leiste bleiben unverändert.

## 3.58.0

**Neuer Menüpunkt „Beiträge & Zahlungen“ (Etappe 13 des Menü-Umbaus)**
- **Alles rund ums Geld der Mitglieder hat einen eigenen Menüpunkt** direkt unter „Mitglieder“: Beitragslauf · Lastschriften · Offene Posten · Rechnungen & Mahnungen · Einstellungen. Sehen kann ihn nur, wer das Recht „Einzug“ hat (z. B. der Kassenwart). Der Vorstand ohne dieses Recht sieht ihn nicht, und der Server lehnt solche Aufrufe ab.
- **Menü „Mitglieder“** hat jetzt nur noch Mitglieder · Anträge · Beiträge & Abteilungen · Auswertung · Einstellungen.
- **Beitragslauf in einem Zug:** Nach dem Abrechnen erscheint eine Karte „Beiträge abgerechnet“ mit dem Knopf **„Weiter zum Einzug“**.
- **Lastschriften, Offene Posten und Rechnungen & Mahnungen** sind eigene Reiter statt Umschalter innerhalb einer Seite. „Verkauf einziehen“ steht jetzt als Karte bei den Lastschriften.
- **Einstellungen:** Die Karten „Lastschrift (SEPA)“ und „Rechnungen & Mahnungen“ liegen jetzt unter Beiträge & Zahlungen › Einstellungen. Alle gespeicherten Werte bleiben, wie sie sind.
- Im Einzug-Fenster erscheinen die Rückfragen („Vorabinformation verschicken?“, „Zahlung erfolgt?“ mit Datumsfeld) und beim Verkaufs-Einzug „zu früh“ im selben Fenster statt in einem zweiten.
- Hinweise auf der Übersicht zu Lastschriften sehen nur noch Benutzer, die sie auch erledigen dürfen, und führen direkt an die richtige Stelle. Die Suche findet alle neuen Orte.
- Beiträge, Lastschriften, SEPA-Dateien, Rücklastschriften und Stornos rechnen genau wie vorher.

## 3.57.0

**Mitglieder neu geordnet (Etappe 12 des Menü-Umbaus)**
- **Sieben Reiter in fester Folge:** Mitglieder · Anträge · Beitragslauf · Einzug & Zahlungen · Beiträge & Abteilungen · Auswertung · Einstellungen. „Beitragslauf“ und „Einzug & Zahlungen“ bleiben vorerst, wo sie waren, und ziehen im nächsten Schritt in ein eigenes Menü „Beiträge & Zahlungen“ um.
- **Mitglied öffnen** zeigt jetzt eine eigene Seite mit dem Namen oben und den Reitern Stammdaten · Mitgliedschaft · Zahlung & Familie · Konto & Mandat · Dokumente · Verlauf. „← Alle Mitglieder“ führt zur Liste zurück (Suche und Filter bleiben). Der Austritt steht beim Reiter „Mitgliedschaft“ rechts oben, „PIN zurücksetzen“ und „Profilbild entfernen“ sind eigene Karten, **Löschen und Anonymisieren** stehen abgesetzt in der Karte „Vorsicht“ ganz unten. Entfernen von Beiträgen, Abteilungen und Dokumenten sitzt im jeweiligen Fenster mit Rückfrage.
- **Mitglieder-Liste:** „Aktuell / Mit Hinweis / Ausgetreten / Alle“ sind kleine Filterchips mit Zahl. Rechts oben stehen „Import …“, „Excel“ und „+ Neues Mitglied“. Am Handy zeigt jedes Mitglied nur zwei Zeilen.
- **Neuer Reiter „Beiträge & Abteilungen“:** Beitragsarten, Zusatzbeiträge, Abteilungen und Altersstufen (vorher unter „Beiträge“). Die Zahl offener Altersstufen steht am Reiter.
- **Einstellungen als Karten**, jede mit eigenem „Speichern“: Mitgliedschaft (Nummern, Beitragsjahr, Kündigungsfrist, Lastschrift Pflicht, Abteilungsleitungen) · Beitrittserklärung & Online-Antrag · „Meine Daten“ in der App (bisher ein Reiter bei Verein › Mitglieder-App) · Lastschrift (SEPA) · Rechnungen & Mahnungen · Benachrichtigungen · Datenschutz & Aufbewahrung · Einstellungen übertragen. Der Import liegt bei der Liste, nicht mehr in den Einstellungen.
- **Anschrift** kommt zentral aus Einstellungen › Verein und wird hier nur angezeigt (mit Link zum Ändern). Beitrittserklärung, Rechnungen und Mahnungen nutzen sie wie bisher.
- **Zugang:** Im Mitglied (Konten & PINs) steht das Zeitprofil nur noch zur Ansicht mit Link „ändern unter Zugang › Freischaltungen“.
- Auswertung ohne die reine Verweis-Karte „E-Mail“ (die gibt es unter Verein › E-Mail). Rückfragen beim Austritt und beim Ablehnen eines Antrags erscheinen im selben Fenster.
- Alle gespeicherten Einstellungen, Beiträge und Mitglieder bleiben unverändert. Die Suche findet jeden neuen Ort.

## 3.56.0

**Verkauf und Lager neu geordnet (Etappe 10 des Menü-Umbaus)**
- **Verkauf hat sechs Reiter:** Buchungen · Abrechnung · Veranstaltungen & Deckel · Konten · Auswertung · Einstellungen. Der Gäste-Deckel steht jetzt unter den Veranstaltungen im selben Reiter (alte Links und Lesezeichen führen dorthin).
- **Neu: Verkauf › Einstellungen** mit Karten, jede mit eigenem „Speichern“: Reihenfolge der Kategorien (bisher ein Knopf bei den Artikeln, jetzt gleich mit ▲▼ auf der Karte) · Gemerkte Zuordnungen von Lieferanten-Artikeln (bisher unter Einstellungen › Verkauf) · Gerade oft hier am Tablet (bisher unter Einstellungen › Tablet) · Einstellungen übertragen. Jede Karte sieht nur, wer das passende Recht hat. Die gespeicherten Werte bleiben unverändert.
- **Lager:** Bestellung · Lieferungen · Bestand · Artikel. Der Abgleich Lieferungen ↔ Buchungen ist keine eigene Seite mehr, sondern eine Karte unter „Bestand“. Bei den Artikeln heißen die Knöpfe rechts oben „+ Neuer Artikel“, „Import …“ und „Excel“.
- **Am Handy** zeigen Konten, Buchungen, Abrechnung, Artikel, Bestand und Abgleich zwei Zeilen je Eintrag. Leere Listen sagen, was als Nächstes zu tun ist. Die lange Anleitung der Abrechnung steht einklappbar unter „So geht's“, ihre Knöpfe stehen wie überall rechts neben den Reitern.
- „Einstellungen übertragen“ gibt es jetzt auch für den Verkauf (Datei mit „Gerade oft hier“ und Kategorienreihenfolge, ohne Artikel, Konten und Buchungen).
- An Abrechnung, Storno und Einzug ändert sich nichts. Die Suche findet die neuen Orte.

## 3.55.0

**Plätze neu geordnet (Etappe 9 des Menü-Umbaus)**
- **Sieben Reiter:** Belegung · Serien & Sperren · Buchungen · Gebühren · Auswertung · Plätze & Geräte · Einstellungen. „Buchungsarten“ ist kein eigener Reiter mehr, das „Buchungsprotokoll“ heißt jetzt **Buchungen**.
- **Belegung:** „Tag / Woche“ sind jetzt kleine Filterchips. „+ Buchung“ und „+ Sperre“ stehen rechts oben.
- **Buchungen:** Die Filter (Alle, Mitglieder, Mit Gast …) sind Filterchips, die Liste heißt „Excel“ und steht rechts oben, am Handy zeigt jede Buchung nur zwei Zeilen. „Weitere laden“ statt „Weitere anzeigen“.
- **Gebühren:** „Alle / Offen / Bezahlt“ mit Zahl. Von Hand gebuchte Gebühren haben einen sichtbaren Knopf **Stornieren** (mit Rückfrage, die den Betrag nennt). Gebühren buchen und stornieren darf, wer Plätze buchen darf (Recht „für Mitglieder buchen“), nicht mehr nur, wer Einstellungen ändern darf.
- **Einstellungen als Karten**, jede mit eigenem „Speichern“: Buchen · Mitspieler & Gäste · Warteliste · **Wer darf buchen?** (Mitgliedschaft, Beitragsarten und Sonderrechte jetzt zusammen) · **Buchungsarten** · Tablet & Mitglieder-App · Platzordnung · **Einstellungen übertragen**. Bei ausgeschalteter Warteliste ist nur der Schalter sichtbar. Sonderrechte und Buchungsarten werden im Fenster bearbeitet und gelten sofort.
- **Serie stornieren:** Auswahl („nur dieser Termin / alle folgenden / ganze Serie“) und Rückfrage stehen jetzt im selben Fenster, nicht mehr zwei übereinander.
- **Spielplan-Import:** gleiche Überschriften und gleiche Spalten wie beim Spielbetrieb („Mannschaften“, „Spiele“ mit Heim/Auswärts).
- **Reiterzeile:** Die Knöpfe rechts oben bleiben neben den Reitern, solange beide Platz haben (gilt für alle Seiten mit Reitern); nur bei sehr schmalen Fenstern stehen sie darunter.
- Es heißt überall „Plätze“ und „Mitglieder“ statt „Buchungssystem“ und „Mitgliederverwaltung“. Die Suche findet jede Karte und die wichtigen Knöpfe.
- Bereits gespeicherte Einstellungen, Buchungsarten und Sonderrechte bleiben unverändert.

## 3.54.0

**Buchhaltung neu geordnet (Etappe 11 des Menü-Umbaus)**
- **Vier Reiter in fester Folge:** Rechnungen · Spendenquittungen · Firmen & Sponsoren · Einstellungen. „+ Neue Rechnung“, „Jahresrechnungen …“, „+ Firma anlegen“ und „+ Neue Spendenquittung“ stehen jeweils rechts oben in der Reiterzeile.
- **Rechnungen:** Die Filter „Offen · Überfällig · Bezahlt · Storniert · Alle“ sind kleine Filterchips mit Zahlen. In jeder Zeile stehen sichtbare Knöpfe: „PDF“, „Bezahlt“ (bei offenen Rechnungen) und „Details“ – statt des unbeschrifteten „…“. Im Fenster einer Rechnung steht „Rechnung stornieren“ abgesetzt unten. „Abbrechen“ bei „Zahlung buchen“ führt zurück zur Rechnung statt alles zu schließen.
- **Einstellungen als Karten**, jede mit eigenem „Speichern“: Rechnungen (Nummernkreis, Zahlungsziel, Einleitung, Fußzeile) · Steuer & Finanzamt (Steuernummer, Umsatzsteuer, Bescheid – gilt für Rechnungen und Spendenquittungen) · Spendenquittungen (Zwecke, Unterschrift, Ort, Nummernkreis) · Briefkopf & Bankkonten · Einstellungen übertragen. Die frühere Unterseiten-Auswahl entfällt.
- **Anschrift, E-Mail und Telefon** pflegst du nur noch einmal zentral unter Einstellungen › Verein. Die Buchhaltung zeigt sie im Briefkopf nur an, mit Link zum Ändern; Rechnungen und Spendenquittungen nutzen sie wie bisher. Bankkonten werden ebenfalls zentral gepflegt, die Buchhaltung zeigt sie nur an.
- Listen sind am Handy kompakt. Die Suche findet jeden Reiter, jede Karte und die wichtigsten Aktionen. Es heißt überall „Mitglieder“ statt „Mitgliederverwaltung“.
- Bereits gespeicherte Einstellungen, Rechnungen, Firmen und Quittungen bleiben unverändert; an Beträgen und Steuer ändert sich nichts.

## 3.53.0

**Helferdienste neu geordnet (Etappe 8 des Menü-Umbaus)**
- **Ein Menüpunkt, fünf Reiter:** Übersicht · Dienstpläne · Einsätze · Stunden · Einstellungen. Die Zahl der zu bestätigenden Stunden steht am Reiter „Stunden“ und im Menü.
- **Dienstpläne:** „+ Neuer Dienstplan“ steht rechts oben, „Kommende / Vergangene“ sind kleine Filterchips. Ein Dienstplan öffnet sich als eigene Ansicht mit „← Alle Dienstpläne“ und den Reitern „Schichten“ und „Weitergeben“ (als Vorlage kopieren, in den Verkauf übernehmen).
- **Einsätze** heißen jetzt überall so (vorher „Einzeltermine“).
- **Stunden:** „Stunden nachtragen“ gibt es nur noch hier. Löschen steht im Fenster „Eintrag ändern“, abgesetzt und mit Rückfrage. Ein laufender Eintrag lässt sich erst nach dem Ausstempeln löschen.
- **Einstellungen als Karten**, jede mit eigenem „Speichern“: Soll · Abrechnung · Tablet & App · Befreite Mitglieder · Benachrichtigungen & Kontakt · Einstellungen übertragen. Die frühere lange Karte ist aufgeteilt.
- Löschen von Einsätzen, Schichten und Dienstplänen fragt im selben Fenster nach und sagt, was mit verschwindet.
- Listen sind am Handy kompakt (zwei Zeilen je Eintrag). Die Suche findet jeden Reiter, jede Karte und die wichtigsten Aktionen. Es heißt überall „Mitglieder“ statt „Mitgliederverwaltung“.
- Bereits gespeicherte Einstellungen, Dienstpläne und Stunden bleiben unverändert.

## 3.52.0

**Spielbetrieb neu geordnet (Etappe 7 des Menü-Umbaus)**
- **Ein Menüpunkt, vier Reiter:** Übersicht · Spieltage · Mannschaften · Einstellungen. Die Kachel auf der Startseite führt zur Übersicht.
- **Spieltage:** „Kommende / Vergangene“ und „Liste / Kalender“ sind jetzt kleine Filterchips. „Drucken“, „Rahmenterminplan …“, „Spielplan importieren …“ und „+ Spieltag“ stehen rechts oben; „Drucken“ gibt es in der Liste und im Kalender.
- **Mannschaften:** „+ Mannschaft“ steht rechts oben, der Knopf „Spieler/innen …“ heißt jetzt „Spieler verwalten“.
- **Einstellungen als Karten**, jede mit eigenem „Speichern“: Was Spieler in der App sehen · Aufgaben · Erinnerungen & Nachrichten · **Einstellungen übertragen** (neu, wie in den anderen Modulen). Bei ausgeschalteten Aufgaben und Erinnerungen sind die Felder eingeklappt.
- **Spielplan-Import:** Das Fenster sieht jetzt aus und läuft ab wie bei den Plätzen (Einlesen → Prüfen, Zurück-Knopf, gleiche Texte).
- Es heißt überall „Plätze“ und „Mitglieder“ statt „Buchungssystem“ und „Mitgliederverwaltung“. Die Suche findet jeden Reiter, jede Karte und „Drucken“.
- Bereits gespeicherte Einstellungen, Mannschaften und Spieltage bleiben unverändert.

## 3.51.0

**Zugang neu geordnet (Etappe 6 des Menü-Umbaus)**
- **Neue Reiter:** Bedienen · Freischaltungen · Türen · Zeitprofile · Sperrtage · Verlauf · Einstellungen. „Verlauf“ hieß vorher „Protokoll“, die Sperrtage haben jetzt einen eigenen Reiter.
- **Freischaltungen** sind der einzige Ort für Zeitprofil, „gültig bis“, „auch von unterwegs“ und Sperre. „+ Mitglied freischalten“ steht oben rechts, alles Weitere öffnet sich hinter „Bearbeiten“ in einem einzigen Fenster. „Zugang entziehen“ steht abgesetzt und fragt im selben Fenster nach. In der Mitglieder-App zeigt die Spalte „Türen“ nur noch an und führt mit „ändern“ hierher.
- **Türen, Zeitprofile und Sperrtage:** „+ Tür“, „+ Zeitprofil“ und „+ Sperrzeitraum“ stehen rechts in der Reiterzeile. Türen und Sperrzeiträume bearbeitest du im Fenster und sie werden sofort gespeichert; jedes Zeitprofil hat sein eigenes „Speichern“. „Profil löschen“, „Tür entfernen“ und „Sperrzeitraum aufheben“ fragen vorher nach und sagen, was dann passiert.
- **Einstellungen als Karten**, je mit eigenem „Speichern“: Anbindung (Hersteller) · Sicherheit („nur aus dem Vereinsnetz“, mit Link zu Einstellungen › Erreichbarkeit) · Benachrichtigungen · Einstellungen übertragen. Der Schalter „am Tablet zeigen“ steht zentral unter Einstellungen › Tablet.
- Fehlt die Verbindung zu Home Assistant, führt ein Link direkt zur Anbindung. Am Handy stehen die Listen in zwei Zeilen je Eintrag.
- Die Suche findet jeden Reiter, jede Karte und die Aktionen am neuen Ort.
- Nichts geht verloren: Türen, Zeitprofile, Freischaltungen und Sperrtage bleiben unverändert. Wer nur „Zugang bedienen“ darf, sieht weiterhin nur den Reiter „Bedienen“ mit der Notfall-Sperre.

## 3.50.0

**Beregnung neu geordnet (Etappe 5 des Menü-Umbaus)**
- **Neue Reiter:** Bedienen · Plätze & Zonen · Verlauf · Einstellungen. „Verlauf“ hieß vorher „Protokoll“, „Excel“ steht rechts oben.
- **Einstellungen als Karten**, jede mit eigenem „Speichern“: Anbindung · Wer darf bedienen? · Webapp · Benachrichtigungen · Einstellungen übertragen. Die Vereins-PIN ist jetzt immer zu sehen, mit dem Hinweis, dass sie nur bei „Offen mit Vereins-PIN“ gilt.
- **Bedienen** zeigt nur noch die Plätze und den Not-Stopp. Der Schalter „in der Kopfzeile am Tablet zeigen“ steht zentral unter Einstellungen › Tablet.
- **Plätze & Zonen:** „+ Platz“ oben rechts, „Platz löschen“ abgesetzt und mit Rückfrage; die Zonen sind am Handy übersichtlicher.
- Kürzere Einleitung, die Suche findet jede Karte, die Vereins-PIN, „Platz hinzufügen“ und den Not-Stopp.
- Bereits gespeicherte Einstellungen bleiben unverändert.

## 3.49.0

**Zeiterfassung neu geordnet (Etappe 4 des Menü-Umbaus)**
- Die Zeiterfassung hat jetzt Reiter oben: **Stunden · Personal · Einstellungen**.
- **Stunden:** Monat und Person wählen, Einsätze ansehen und korrigieren. „+ Einsatz nachtragen“, „Monatsnachweis (PDF)“ und „Excel“ stehen rechts in der Reiterzeile.
- **Personal:** eine Liste mit Name, Tätigkeit, PIN (gesetzt), Stundensatz und Status. „+ Person“ rechts, Bearbeiten in einem einzigen Fenster. Die PIN wird nie angezeigt, nur neu gesetzt.
- **Einstellungen:** Monatsnachweis per E-Mail (Empfänger, Testmail, Vormonat jetzt senden) und „Einstellungen übertragen“.
- Nichts geht verloren: Personal, Stundensätze, Einsätze und der Empfänger bleiben unverändert. Die Suche findet die Reiter und Aktionen an ihrem neuen Ort. Am Handy stehen die Listen in zwei Zeilen je Eintrag.

## 3.48.0

**Mängel neu geordnet (Etappe 3 des Menü-Umbaus)**
- **Einstellungen als Karten:** Orte, Benachrichtigungen und Aufbewahrung haben jetzt je ein eigenes „Speichern“. Bisher gab es unten nur einen Knopf für alles.
- **Neu: „Einstellungen übertragen“** als letzte Karte. Orte, E-Mail-Empfänger und Aufbewahrungsfrist lassen sich als Datei sichern und in einem anderen Verein oder nach einer Neuinstallation wieder einspielen.
- **Am Handy** zeigt die Liste je Meldung zwei Zeilen; die Einleitung ist kürzer.
- **Sprache:** Es heißt überall „Mängel“ und „Plätze“ statt „Mängelmelder“ und „Buchungssystem“ (auch in Mails, Meldungen und Hilfetexten).
- Die Suche findet Erledigt, jede Karte, das Feld für E-Mail-Empfänger, „Ort hinzufügen“ und die Übertragung.
- Bereits gespeicherte Einstellungen bleiben unverändert.

## 3.47.0

**Einstellungen neu geordnet (Etappe 2 des Menü-Umbaus)**
- **Einstellungen › Verein:** Hier stehen jetzt Vereinsname, **Anschrift, E-Mail und Telefon**, Farbe, Logo und die Vereinssprache. Wer die Anschrift bisher bei Mitglieder oder Buchhaltung eingetragen hatte, findet sie nach dem Update schon hier. Die Module lesen sie von dort.
- **Einstellungen › Erreichbarkeit (neu):** Vereinsnetz (bisher bei der Mitglieder-App unter „Verbindung“) und „Weitere Adressen“ der Verwaltung stehen zusammen, dazu ein Hinweis zu HTTPS und Tunnel.
- **Einstellungen › Tablet:** Passwort, Leiste am Tablet, Links und Startseite. In der Leiste gibt es jetzt je Modul den Schalter „am Tablet zeigen“ (bisher in den Einstellungen von Beregnung und Zugang; die Einstellung selbst bleibt dieselbe). „Alle Geräte abmelden“ steht abgesetzt in einer eigenen Zeile.
- **Module:** „Einstellungen exportieren“ und „importieren“ sind sichtbare Knöpfe statt im Menü ⋯ versteckt.
- **Mein Konto:** Ein Klick auf den eigenen Namen unten links öffnet eine Seite mit Passwort, Sprache und Hell/Dunkel (nur für dich) und dem E-Mail-Absender (bisher unter E-Mail › Absender). Die kleinen Knöpfe für Sprache und Hell/Dunkel im Namenskasten entfallen.

**Mitglieder-App (Verwaltung)**
- Reiter jetzt: **Mitglieder · Bereiche · Benachrichtigungen · Einstellungen**.
- **Bereiche:** eine einzige Tabelle statt drei Karten: Bereich an/aus, für wen, von unterwegs, beim Freischalten vorgewählt, Start und Reihenfolge – mit einem „Speichern“.
- **Einstellungen:** „Adresse & Aussehen“ (WLAN-Adresse, öffentliche Adresse mit „von unterwegs erreichbar“, Name auf dem Homescreen) und „Sicherheit“. Die lange Anleitung für den Tunnel ist einklappbar.
- **Mitglieder** am Handy: je Mitglied zwei Zeilen; Antippen öffnet die Bereiche dieses Mitglieds.

**Sonst**
- Die Suche findet alle verschobenen Karten an ihrem neuen Ort.
- Hinweistexte nennen die neuen Orte („Einstellungen › Tablet“, „Mitglieder-App › Einstellungen“, „Mein Konto“).
- Beispiel-Adresse im Hinweis zur App ist jetzt ein neutrales „dein-verein.duckdns.org“.

## 3.46.0

**Neue Bausteine für den Umbau der Menüs**
- **Filterchips:** Filter einer Liste (z. B. „Mit offenem Betrag 10“) sehen jetzt wie kleine runde Chips aus, mit der Anzahl daneben. So verwechselt man sie nicht mehr mit den Reitern. Zuerst unter Verkauf › Konten und auf der Seite Mitglieder-App, die anderen Module folgen mit ihrem Umbau.
- **Detailansicht** (vorbereitet, noch nirgends eingesetzt): Öffnet man später z. B. ein Mitglied, ersetzt eine einzige Reiterzeile mit „← Zurück“ die Reiter des Moduls. Die Adresse merkt sich den Datensatz, Neuladen und Suche führen wieder hin.
- **Kompakte Listen am Handy:** Benutzer, Rollen, Protokoll, Sprachen und die Listen der Datensicherung zeigen am Handy je Eintrag nur noch zwei Zeilen: den Namen fett, darunter das Wichtigste, rechts die Knöpfe.

**Aufgeräumt**
- Kürzere Einleitungen auf den Seiten Datensicherung, Benutzer & Rechte, E-Mail und Mitglieder-App. Der Hinweis zur PIN steht jetzt direkt bei „Mitglied freischalten“.
- Datensicherung: nur noch ein grüner Hauptknopf („Jetzt sichern“). „Wiederherstellen …“ und „Entfernen“ in den Listen sind nicht mehr rot neben „Herunterladen“; rot wird es erst in der Rückfrage.
- Einstellungen: „Logo hochladen …“ ist ein normaler Knopf, grün bleibt nur „Speichern“.
- Protokoll: Findet der Filter nichts, steht dort ein Hinweis statt einer leeren Tabelle.

**Design-Prüfstand**
- Neue Regeln aus den Bedienregeln: höchstens ein Hauptknopf je Ansicht, kurze Einleitung, roter Knopf nicht neben einem harmlosen, Listeneinträge am Handy höchstens 96 px hoch, leere Tabellen mit Hinweis. Sie gelten sofort für die allgemeinen Seiten und für jedes Modul, sobald es umgebaut ist.

## 3.45.0

**Neue Rechte: bedienen und einrichten getrennt**
- **Beregnung bedienen:** Wer nur dieses Recht hat, sieht in der Verwaltung unter „Beregnung“ nur den Reiter „Bedienen“. Dort kann er Plätze starten und stoppen, aber nichts einrichten. Wie bisher darf er damit auch die gesperrte Beregnungs-Webapp bedienen.
- **Zugang bedienen (neu):** Türen aus der Ferne öffnen und schließen und die Notfall-Sperre setzen. Freischaltungen, Zeitprofile, Türen und Protokoll bleiben beim Recht „Zugang“.
- **Mitglieder-App einrichten (neu):** Damit stellt man Bereiche, Reiter, Startseite, Name und Benachrichtigungen der App ein. Mitglieder freischalten bleibt beim Recht „Mitglieder anlegen“. Adresse, Vereinsnetz, „von unterwegs“ und Sicherheit bleiben beim Recht „Einstellungen“.
- Auf der Seite „Mitglieder-App“ sieht jeder nur noch die Reiter, die er auch ändern darf, statt ausgegrauter Felder.
- **Niemand verliert etwas:** Wer bisher „Mitglieder anlegen“ hatte (z. B. die Rolle Thekenteam), bekommt „Mitglieder-App einrichten“ beim Update einmal dazu. Bitte unter Benutzer & Rechte prüfen, ob das so gewollt ist.

**Ein Name je Modul**
- In der Verwaltung heißen die Module jetzt **Plätze** (bisher Buchungssystem), **Mitglieder** (bisher Mitgliederverwaltung) und **Mängel** (bisher Mängelmelder). Das gilt auch im Protokoll und bei den Rechten.
- Kurze Namen in der Tablet-Kopfzeile: **Dienste**, **Stempeln** und **Türen**. In der Mitglieder-App heißt „Buchen“ jetzt **Plätze**. Die Kopfzeile passt damit auch mit allen Modulen in eine Zeile.
- **Eine Reihenfolge überall:** Verkauf, Plätze, Spielbetrieb, Helferdienste, Zeiterfassung, Beregnung, Zugang, Mängel, Mitglieder, Buchhaltung. Das Tablet sortiert nicht mehr alphabetisch. Eine eigene Reihenfolge unter Einstellungen › Tablet gilt weiter.

**Verkauf und Lager getrennt**
- Bestellung, Lieferungen, Bestand, Abgleich und Artikel stehen jetzt unter dem neuen Menüpunkt **Lager**. Unter **Verkauf** bleiben Buchungen, Abrechnung, Veranstaltungen, Deckel, Auswertung und Konten. Es ist weiterhin ein Modul. Die Rechte bleiben gleich.

## 3.44.1

- Suche: In der Trefferliste am Rechner liefen lange, mehrzeilige Treffer übereinander. Jetzt steht jeder Treffer sauber untereinander. Der Design-Prüfstand prüft die Trefferliste künftig mit (Rechner und Handy).

## 3.44.0

**Neue Suche in der Verwaltung (Strg/⌘ K)**
- Die Suche findet jetzt nicht nur Seitennamen, sondern auch **Reiter, Einstellungen, einzelne Felder und Aktionen** – z. B. „Tablet-Passwort“, „Gläubiger-ID“, „Import“, „Spielplan“, „Platzordnung“, „Pflichtstunden“.
- Sie versteht **gleichbedeutende Wörter** („Lastschrift“ findet SEPA und Einzug, „Passwort“ auch Kennwort und PIN, „Push“ die Benachrichtigungen) und verzeiht kleine Tippfehler.
- Ein Treffer **springt direkt an die Stelle**: Seite und Reiter öffnen sich, die passende Karte wird ins Bild gerollt und kurz grün umrandet, ein Feld bekommt gleich den Cursor.
- Unter jedem Treffer steht, wo er liegt (z. B. „Mitgliederverwaltung › Einstellungen“). Die Treffer sind nach Seiten, Einstellungen und Aktionen gruppiert.
- Jeder sieht nur, was er auch darf, und nur aus eingeschalteten Modulen. Gesucht wird auch in der eingestellten Sprache.

**Einstellungen ohne Unterseiten**
- Bei Buchungssystem, Buchhaltung und Mitgliederverwaltung stehen die Einstellungen jetzt alle untereinander auf einer Seite statt hinter einem zweiten Umschalter. Wo mehrere Karten zusammengehören, steht eine kleine Abschnittsüberschrift darüber. Der Mitglieder-Import ist damit wieder ohne Suchen zu sehen.

Der Design-Prüfstand springt künftig jeden Sucheintrag an und meldet, wenn ein Ziel (Karte, Knopf, Feld) nicht mehr existiert.

## 3.43.0

**Kleine Fehler aus der Prüfung aller Seiten behoben**
- **Benutzer & Rechte:** Bei Rollen und Benutzern stehen jetzt überall lesbare Namen („E-Mail“, „Buchhaltung“, „Serien & Sperren“ …) statt interner Kürzel wie „email“.
- **Jahreskalender** (Verkauf › Auswertung, Buchungssystem › Auswertung): Eine Woche steht jetzt unter dem Monat, in dem die meisten ihrer Tage liegen. Vorher rutschte z. B. die letzte Oktoberwoche unter „Nov.“.
- **Übersicht:** Die Kachel „Verkauf“ zeigt bei negativem Bestand „negativ“ in Rot statt „Alles gut“.
- **Mitgliederverwaltung › Auswertung:** Mitglieder ohne erfasste Mitgliedsdaten zählen jetzt mit – vorher zeigte die Auswertung z. B. 0 Mitglieder, die Liste 10.
- **Am Handy:** Einstellungen › Module ist wieder lesbar (die Beschreibung steht unter Name und Schalter statt als schmale Wortsäule). In Tabellen ragen Knöpfe nicht mehr aus der Karte (z. B. Sprachen) und Werte überlappen nicht mehr die Beschriftung (Bestandserhebung). Bei Helferdienste › Einzeltermine und Spielbetrieb › Mannschaften stehen die Knöpfe unter dem Text.
- **Hinweistexte** nennen wieder die richtigen Orte (z. B. „Beiträge → Beitragsarten & Abteilungen“ statt „Einstellungen“, „Pflichtstunden …“ statt „Soll …“). Die E-Mail-Seite sagt jetzt richtig, wohin Antworten gehen.
- Der Design-Prüfstand erkennt solche Fehler künftig selbst: Text, der am Handy zur Wortsäule wird, Inhalte, die aus Karte oder Tabellenzelle ragen, und Rechte ohne lesbaren Namen.

## 3.42.0

**Verkauf per Lastschrift einziehen – direkt im Verkauf**
- Unter **Verkauf › Abrechnung** gibt es jetzt „Per Lastschrift einziehen …“ (nur mit Mitgliederverwaltung). Ein Fenster zeigt in einem Rutsch, wer wie viel zahlt (Angehörige beim Zahler), schlägt den frühesten Einzugstag vor und listet klar, was **nicht** per Lastschrift geht (kein oder widerrufenes Mandat, Rechnung/bar, Mannschaften, „Kein Mitglied“) und was dann zu tun ist. Ein Klick erstellt den Einzug, danach direkt Vorabinformation und SEPA-Datei. Beiträge bleiben dabei außen vor. Der Kasten „Verkauf einziehen“ in der Mitgliederverwaltung führt auf denselben Ablauf.
- Schon offene Verkaufs-Posten (z. B. von Hand angelegt) werden in der Vorschau angezeigt und mit eingezogen. Verkauf › Abrechnung zeigt sie zusätzlich in einer eigenen Liste.
- Offene Posten, die erst nach dem Einzugstag fällig sind, werden gemeldet statt still weggelassen. Das Datumsfeld heißt jetzt „Einzugstag wählen“, mit Hinweis, dass ein späterer Tag immer geht.
- **Einzug verwerfen** fragt jetzt, ob der Lauf gleich mit zurückgenommen werden soll. Dann sind die Verkaufskonten wieder offen und Buchungen lassen sich normal stornieren – ohne Gutschrift.
- **Storno einer abgerechneten Buchung** sagt, wo sie abgerechnet ist. Solange aus dem Verkaufs-Einzug nichts eingezogen ist, gibt es „Lauf zurücknehmen und stornieren“ statt einer Gutschrift.
- Neu: **„+ Betrag auf Konto“** unter Verkauf › Abrechnung, um einen freien Betrag mit Text (z. B. Essen) aufs Verkaufskonto zu buchen. Bei „+ Forderung“ in der Mitgliederverwaltung weist die Art „Verkauf“ auf diesen Weg hin.

**SEPA-Nacharbeiten**
- Die Mandatsreferenz eines Mandats, das schon für Lastschriften genutzt wurde, lässt sich nicht mehr ändern (die Bank würde sonst eine Änderungsmeldung erwarten). Eine neue Referenz gibt es über „Neues Mandat …“.
- Fehlt beim Vereinskonto der BIC, erscheint ein Hinweis in den Einstellungen und vor dem Einzug. Er bleibt freiwillig.
- Die Testreihen prüfen jede erzeugte SEPA-Datei gegen das offizielle Schema pain.008 und brechen mit klarer Meldung ab, wenn das Prüfprogramm fehlt.

## 3.41.0

**Neues Modul „Mängelmelder“**

Mitglieder melden kaputte Dinge auf der Anlage direkt in der Mitglieder-App (Bereich „Mängel“) oder am Tablet mit Namen und PIN – mit Ort, kurzer Beschreibung, bis zu 3 Fotos und auf Wunsch „dringend“.
- **Nichts doppelt:** Vor dem Absenden zeigt Clubwerk offene Meldungen zum selben Ort (ohne Namen). Mit „Ja, das ist es“ zählt die vorhandene Meldung „auch gemeldet“ hoch, statt eine neue anzulegen. So sieht der Platzwart, was vielen wichtig ist.
- **Verwaltung:** Neuer Menüpunkt „Mängelmelder“ mit den Reitern Offen, Erledigt und Einstellungen. Status setzen, dem Melder antworten, interne Notiz, Zuständige eintragen. Sortieren nach neu, dringend oder am häufigsten gemeldet.
- **Eigenes Recht „Mängelmelder“:** Ein Platzwart kann nur dieses Modul sehen. Wer das Recht hat, bekommt neue Meldungen per Push (und auf Wunsch per E-Mail).
- **Orte:** Plätze und Geräte aus dem Buchungssystem kommen automatisch, weitere Orte (z. B. Clubhaus, Parkplatz) lassen sich in den Einstellungen pflegen, dazu „Anderer Ort“ mit eigenem Text.
- **Fotos und Datenschutz:** Fotos werden schon im Handy verkleinert, Ortsdaten fallen weg. Sie liegen verschlüsselt im Tresor. Erledigte Meldungen werden nach 12 Monaten mit allen Fotos gelöscht (Frist einstellbar).
- Melder bekommen eine Push-Nachricht, sobald sich der Status ändert oder der Verein antwortet.
- Das Modul ist einzeln nutzbar und unter Einstellungen › Module & Erweiterungen einzuschalten.

## 3.40.3

**Prüfung aller Abrechnungswege bis zur SEPA-Datei**

Alle Wege von der Buchung bis zur SEPA-Datei wurden mit zwei neuen Testreihen durchgespielt: Verkauf am Tablet, in der Verwaltung, bei Veranstaltungen und über den Gäste-Deckel, dazu Beitragsläufe mit allen Rhythmen, Familie, Zahler, Abteilungsbeiträgen und Austritt. Geprüft wurde jeweils mit allen Stornos, Gutschriften, Rücklastschriften und verworfenen Einzügen, und jede SEPA-Datei wurde gegen das offizielle Bankformat geprüft. Dabei sind diese Fehler aufgefallen und behoben:
- **Doppelte Abbuchung verhindert:** Unter Verkauf › Abrechnung ließ sich ein Verkaufs-Einzug der Mitgliederverwaltung zurücknehmen. Die Posten blieben in der Mitgliederverwaltung trotzdem stehen, beim nächsten Lauf wären dieselben Getränke noch einmal abgebucht worden. Das geht jetzt nur noch in der Mitgliederverwaltung (Lauf zurücknehmen).
- **Forderung und Gutschrift gleichen sich aus:** Ergeben die offenen Posten eines Mitglieds genau 0 € (z. B. Verkauf 3 € und Storno −3 €), werden sie mit dem nächsten Einzug als „verrechnet“ gebucht, statt bei jedem Einzug als Problem „Summe 0 €“ aufzutauchen.
- **Beitrag 0 € (befreit)** erzeugt keinen Posten über 0 € mehr. Der Zeitraum gilt trotzdem als abgerechnet.
- **Zahlung höher als offen** wird abgelehnt, statt den Mehrbetrag stillschweigend zu verschlucken. Ein Mehrbetrag kommt als Gutschrift (Minus-Betrag) dazu.
- Klarere Hinweise: Ein Lauf mit storniertem Posten lässt sich nicht zurücknehmen, die Meldung sagt das jetzt auch. Beim Einzug heißt es jetzt „Zahler bleiben offen“ statt „ohne gültiges Mandat“, weil dort auch Guthaben stehen.

## 3.40.2

**Mitglieder-Import: Familie nur, wenn es passt**
- Ein abweichender Zahler macht nicht automatisch eine Familie. Wer einen eigenen Beitrag hat (z. B. ein erwachsenes Kind, für das der Vater zahlt), wird nur mit dem Zahler verknüpft.
- Steht ein Beitrag beim Import auf „nicht übernehmen“, wird die Person dadurch nicht zur Familie.
- In einer Familie darf neben dem Oberhaupt nur ein weiterer Erwachsener sein (der Partner). Wären es mehr, übernimmt Clubwerk keinen davon als Familie und zeigt in der Vorschau „prüfen“ mit einem Hinweis.

## 3.40.1

**Mitglieder-Import aus verein.cloud verbessert**
- Jedes Feld lässt sich jetzt auch bei verein.cloud selbst zuordnen (z. B. eine andere Spalte für Mobil oder ein Feld gar nicht übernehmen). Abteilungen und Beiträge liest Clubwerk weiter automatisch.
- „Hauptverein“ wird nicht mehr als Abteilung angelegt.
- Handynummern, bei denen das alte Programm die führende 0 verloren hat (z. B. 1701234567), bekommen sie wieder.
- Bei den Beitragsarten stehen jetzt alle vorhandenen Beitragsarten zur Auswahl, nicht nur ähnliche. Auch bei gleichem Namen kann man eine andere wählen.
- Der abweichende Zahler wird in der Vorschau angezeigt („Zahler“, mit Hinweis „Familie“, wenn die Person über einen Familienbeitrag mitläuft). Wird der Zahler nicht gefunden, gibt es einen Hinweis.
- Zahlungsart „Lastschrift (AZ: …)“ wird als Lastschrift erkannt.

## 3.40.0

**Mitglieder-Import: erst prüfen, dann übernehmen**
- **Feldabgleich am Beispiel:** Die Vorschau zeigt ein Mitglied aus der Datei mit allen erkannten Feldern (Name, Adresse, Bankverbindung gekürzt, Mandat, Abteilungen, Beiträge). So sieht man vor dem Übernehmen, ob die Spalten richtig ankommen.
- **Beitragsarten werden nicht mehr ungefragt angelegt:** Für jede Beitragsart der Datei zeigt die Vorschau ein Beispielmitglied. Gibt es schon eine ähnliche Beitragsart, muss man wählen: **vorhandene verwenden**, **neu anlegen** oder **nicht übernehmen**. Bei „nicht übernehmen“ wird das Mitglied ohne diesen Beitrag importiert und erscheint mit dem Hinweis „ohne Beitrag“.

**Spendenquittungen: Steuernummer nur einmal eintragen**
- Die Steuernummer bei den Spendenquittungen darf leer bleiben. Dann gilt die Steuernummer unter „Rechnungen“.

**Storno nach storniertem Verkaufs-Posten**
- Wurde der Verkaufs-Posten in der Mitgliederverwaltung schon storniert (auch mit einer älteren Version), lässt sich die zugehörige Buchung im Verkauf jetzt normal stornieren, ohne eine neue Gutschrift. Gibt es noch eine Gutschrift dafür, sagt Clubwerk, dass zuerst die Gutschrift storniert werden muss.

## 3.39.4

**Verkauf und Einzug passen beim Stornieren wieder zusammen**
- Wird in der Mitgliederverwaltung ein Verkaufs-Posten aus einem Verkaufs-Einzug storniert, sind die zugehörigen Verkaufsbuchungen danach wieder **offen**. Bisher blieben sie „abgerechnet“, und ein Storno im Verkauf buchte zusätzlich eine Gutschrift, die Rückbuchung zählte also doppelt.
- Gibt es für diese Buchungen schon eine Gutschrift, sperrt Clubwerk das Stornieren des Postens und sagt, was zuerst zu tun ist.
- Wird eine Gutschrift storniert, nimmt Clubwerk auch die Bestandskorrektur zurück. Bei früher stornierten Gutschriften holt Clubwerk das beim Start einmal nach.

## 3.39.3

**Import aus verein.cloud: Beiträge in allen Spalten**
- verein.cloud lässt in seinen Exporten manchmal Lücken: Ein Beitrag kann z. B. erst in der zehnten Beitragsspalte stehen. Der Import hat bisher nach wenigen leeren Spalten aufgehört zu suchen und solche Beiträge übersehen. Jetzt werden alle Spalten durchgesehen, auch bei Abteilungen.

## 3.39.2

**Bau mit dem neuen Grundsystem repariert**
- Mit 3.39.0/3.39.1 scheiterte bei neueren Home-Assistant-Versionen das „Neu bauen“ („npm: not found“). Home Assistant hatte statt des offiziellen Node.js-Pakets sein eigenes Grundsystem verwendet. Das Grundsystem steht jetzt fest in der Bauanleitung.

## 3.39.1

**Neutrale Beispieltexte**
- Ein Beispielname in einem Eingabefeld der Helferdienste und in Hinweisen wurde durch einen neutralen Namen („Max“) ersetzt. Sonst ändert sich nichts.

## 3.39.0

**Neues Grundsystem: offizielles Node.js-Paket**
- Clubwerk baut jetzt auf dem offiziellen Node.js-Paket auf (Node 22 auf Alpine 3.24), nicht mehr auf dem Home-Assistant-Grundsystem mit Alpine 3.21. Dessen Unterstützung endet am 1. November 2026.
- Damit läuft Clubwerk mit **Node.js v22.23.4**, also mit allen Sicherheitskorrekturen vom 21.10.2026. Der gelbe Hinweis unter Einstellungen › Update verschwindet.
- Künftige Sicherheitskorrekturen von Node.js kommen schon mit einem einfachen **„Neu bauen“**, ohne neues Clubwerk-Paket.
- Beim ersten Bauen lädt Home Assistant das neue Grundsystem einmal aus dem Internet. Das dauert etwas länger als sonst. Danach läuft alles wie gewohnt lokal.

## 3.38.1

**Schutz vor der Node.js-Sicherheitslücke vom Oktober 2026**
- Clubwerk läuft auf Node.js. Am 21.10.2026 wurde dort eine kritische Lücke im Brotli-Entpacker geschlossen. Clubwerk nimmt deshalb keine komprimierten Anfragen mehr an (Verwaltung, Tablet, Mitglieder-App und Beregnungs-Webapp). Die Oberflächen schicken solche Anfragen ohnehin nie, für die Bedienung ändert sich nichts.
- Unter Einstellungen › Update steht jetzt die **Node.js-Version**. Ist sie noch ohne die Korrekturen, erscheint ein Hinweis. Die neue Node.js-Version kommt mit einem späteren Update.

## 3.38.0

**Trainer („Kein Mitglied“) buchen Plätze, öffnen Türen und schalten die Beregnung**
- Auch Konten „Kein Mitglied“ bekommen die Mitglieder-App, mit QR-Code, PIN und Handy-Kopplung wie Mitglieder. Unter Verwaltung › Mitglieder-App lassen sich für sie nur **Buchen**, **Türen** und **Beregnung** anhaken, jeweils einzeln. Meine Daten, Dienste und Spieltage gibt es für sie nicht. Ohne Haken sehen sie keinen Bereich.
- **Plätze:** Trainer buchen in der App und am Tablet nach denselben Regeln wie Mitglieder (Öffnungszeiten, Vorlauf, Höchstdauer). Es gibt aber **keine Gebühren** (weder Gast- noch Platzgebühr) und **kein Kontingent**. Trainer lassen sich als Mitspieler eintragen und können Mitglieder mitnehmen.
- **Abteilungsplätze** (z. B. Padel): Trainer buchen sie nur, wenn die Abteilung bei ihnen eingetragen ist. Das geht unter Buchungssystem › Einstellungen › Mitglieder-App › Sonderrechte, mit dem Haken bei der Abteilung.
- **Türen:** Der Trainer bekommt wie ein Mitglied ein Zeitprofil.

**Gebühr von Hand buchen (Vorstand)**
- Unter Buchungssystem › Gebühren gibt es den Knopf „+ Gebühr buchen“: Person, Betrag, Datum, Text. Bei Mitgliedern entsteht eine Forderung in der Mitgliederverwaltung, die wie ein Beitrag eingezogen wird. Bei Trainern kommt der Betrag aufs Verkaufskonto und wird mit den Getränken unter Abrechnung bezahlt.
- Die Gebühren stehen mit ihrem Stand (offen, bezahlt) in der Gebührenliste. Ein Klick darauf storniert sie. Offene Gebühren aufs Verkaufskonto verhindern das Löschen des Kontos.

## 3.37.0

**Neue Kontoart „Kein Mitglied“ (z. B. Trainer)**
- Unter Verkauf › Mitglieder & Konten gibt es den Typ „Kein Mitglied“. So ein Konto bucht am Tablet wie ein Mitglied: Name in der Namensliste, eigene PIN, offener Betrag. Bezahlt wird unter Verkauf › Abrechnung, bar oder mit Karte.
- „Kein Mitglied“ erscheint nie in der Mitgliederverwaltung, im Beitragslauf, bei Platzbuchung, Spielbetrieb, Helferdiensten oder in der Mitglieder-App. Auf Veranstaltungslisten und beim Übernehmen eines Deckels lässt es sich wählen.

**Mit Mitgliederverwaltung: Mitglieder entstehen nur dort**
- Ist die Mitgliederverwaltung eingeschaltet, legt man unter Verkauf › Konten kein „Mitglied“ mehr an. Das gilt auch für „Liste einfügen“ und den Excel-Import. Ein Mitglied braucht immer Mitgliedsdaten, Beitrag und Zahlungsdaten, und die gibt es nur in der Mitgliederverwaltung.
- Wer sich am Tablet neu einträgt, wird entweder als „Kein Mitglied“ bestätigt oder mit „Ist schon Mitglied …“ einem Mitglied zugeordnet.
- **Deutliche Meldung bei fehlenden Pflichtangaben:** Ganz oben in der Mitgliederliste steht in Rot, wie viele Mitglieder keine Mitgliedsdaten, keinen Beitrag oder keine gültigen Zahlungsdaten haben. Beim Mitglied steht, was genau fehlt. Ältere Konten ohne Mitgliedsdaten lassen sich dort mit einem Knopf in „Kein Mitglied“ umwandeln.
- Ein Mitglied mit Mitgliedsdaten lässt sich nicht in eine andere Kontoart umwandeln, sonst hingen Adresse, Bank und Beiträge unsichtbar an einem Nicht-Mitglied.
- **Beitragslauf:** Getränke werden nur noch für Mitglieder mit Mitgliedsdaten abgerechnet. Konten ohne Daten, Mannschaften und „Kein Mitglied“ bleiben offen und stehen als Hinweis da. Bisher hätte Clubwerk für Konten ohne Daten eine Lastschrift ohne Bankverbindung angesetzt.

**Einstellung „Lastschrift ist Pflicht“**
- Neu unter Mitgliederverwaltung › Einstellungen › Verein. Ist sie eingeschaltet, brauchen neue Mitglieder immer Bankverbindung und SEPA-Mandat. „Rechnung“ und „bar“ lassen sich dann nicht mehr wählen.
- Ausgenommen sind Familienmitglieder und wer über einen Zahler zahlt. Bestehende Mitglieder mit anderer Zahlart erscheinen mit dem Hinweis „Zahlart nicht Lastschrift“.

**Beitragsfrei**
- Für beitragsfreie Mitglieder legt man eine Beitragsart mit 0 € an, zum Beispiel „Beitragsfrei“. Damit hat jedes Mitglied einen Beitrag, und Getränke laufen trotzdem über den Einzug.

## 3.36.0

**Spielbetrieb: Hinweise beim Zuordnen von Spielern**
- Wer für die Altersklasse einer Mannschaft zu jung ist, bekommt einen Hinweis, zum Beispiel „wird 2027 erst 38 (H40)“. Maßgeblich ist das Saisonjahr: Für die Herren 40 im Sommer 2027 darf spielen, wer 2027 40 wird, egal an welchem Tag. Das Saisonjahr kommt aus dem Feld „Saison“ („Sommer 2027“ ergibt 2027, „Winter 2026/27“ ergibt 2027), sonst gilt das laufende Jahr.
- Bei Damenmannschaften gibt es einen Hinweis, wenn ein Mann zugeordnet ist. Jugendmannschaften sind gemischt und bekommen keinen Hinweis.
- Es bleibt bei Hinweisen. Zuordnen und Speichern gehen immer. Die Hinweise stehen in der Spielerauswahl und in der Mannschaftsübersicht.
- Geburtsjahr und Geschlecht kommen aus der Mitgliederverwaltung. Ohne sie gibt es keine Hinweise. Fehlt bei einer Mannschaft mit Altersklasse das Geburtsdatum, steht „Geburtsdatum fehlt“ dabei.

**Mitglieder-App: Buchen übersichtlicher**
- Am Handy stehen Dauer und Art untereinander und werden nicht mehr abgeschnitten.
- „Pflicht · max. 3“ steht ruhig neben „Mitspieler“. Der Hinweis, was zum Buchen fehlt, ist ein schlichter Satz statt eines gelben Kastens.
- „Wiederholen“ ist ein normales Auswahlfeld wie „Dauer“ statt eines eigenen Links. Der Gast-Bereich heißt „Gast hinzufügen“ und schneidet nichts mehr ab.

**Verwaltung**
- **Mitglieder-App › Mitglieder: „zuletzt benutzt“ stimmt wieder.** Bisher zählte nur die PIN-Eingabe. Wer angemeldet blieb, stand tagelang auf einem alten Datum. Jetzt zählt jede Nutzung.
- **Haken in Tabellen** sind überall gleich groß und quadratisch. Bisher wurden sie in Tabellen gestaucht und waren am iPhone riesig. In der Handy-Ansicht sitzen bei „Beregnung“ und „Türen“ Haken und „unterwegs“ zusammen rechts, wie in den anderen Zeilen.
- Der Design-Prüfstand meldet verzerrte Haken jetzt selbst.

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
- **Platzübersicht in der App:** „Jetzt auf der Anlage“ (wer gerade spielt, wer gleich kommt); in den Blöcken stehen die Spieler einzeln („Max M.“).
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
