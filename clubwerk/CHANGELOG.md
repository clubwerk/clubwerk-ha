# Änderungen

## 3.13.0
- **Saubere Adressen am Tablet:** Statt `/x/mitglieder/` heißen die Seiten jetzt wie ihre Reiter – `/plaetze/`, `/helferdienste/`, `/mitglied-werden/`, `/zeiterfassung/`, `/beregnung/`, `/zugang/`, Verkauf auch unter `/verkauf`. Alte Adressen mit `/x/…/` (Lesezeichen, gespeicherte Tablets) leiten automatisch weiter; auch über die Home-Assistant-Seitenleiste funktioniert alles wie bisher.
- **Start-Reiter einstellbar:** Unter Einstellungen → Tablet & Kopfzeile → „Leiste am Tablet“ (bisher „Reihenfolge am Tablet“) legt ein Auswahlknopf „Start“ fest, welcher Reiter beim Aufruf der Adresse (`…:3100`) erscheint – direkt unter dieser Adresse, ohne Weiterleitung. Dorthin kehrt das Tablet auch nach 30 Sekunden ohne Eingabe zurück. Vorgabe bleibt Verkauf; ist das Start-Modul abgeschaltet, erscheint wieder Verkauf.
- Erweiterungen können im Manifest unter `tablet.pfad` ihre Adresse festlegen (siehe ERWEITERUNGEN.md).
- **Mitglieder-App – Vereins-WLAN auch über die öffentliche Adresse erkannt:** Wer im Vereins-WLAN die App über die öffentliche Adresse (z. B. `app.tc-frickhofen.org`) öffnet, wurde bisher wie „unterwegs“ behandelt, weil die Anfrage über Cloudflare kommt – Beregnung zeigte „Nur im Vereins-WLAN“. Clubwerk ermittelt jetzt regelmäßig die Internet-Adresse des Vereinsanschlusses und erkennt Handys im Vereins-WLAN daran (IPv4 gleich bzw. IPv6 im selben Netz). Die erkannte Adresse steht unter Mitglieder-App → „Von unterwegs nutzbar“.
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
