# Mitglieder
<!-- kurz: Stammdaten, Familien, Beiträge, Lastschrift-Einzug und Mahnungen – die Mitgliederverwaltung des Vereins. -->

## Wofür ist das Modul? {#wofuer}

Hier liegt alles, was der Verein über seine Mitglieder weiß: Name, Anschrift, Abteilungen, Beitrag, Bankverbindung und SEPA-Mandat, Familien, Ehrungen und Ämter. Daraus rechnet das Modul die Beiträge ab, zieht sie per SEPA-Lastschrift ein, schreibt Rechnungen und Mahnungen und führt die Beitrittserklärungen digital. Mitglieder sehen und ändern ihre Daten selbst in der Mitglieder-App („Meine Daten“).

Das Modul hat in der Seitenleiste **zwei Menüpunkte**: **Mitglieder** (Personen, Anträge, Gratulationen, Beiträge & Abteilungen, Auswertung, Einstellungen) und **Beiträge & Zahlungen** (Beitragslauf, Lastschriften, Offene Posten, Rechnungen & Mahnungen, Kontoauszug, Einstellungen).

Alle anderen Module arbeiten mit denselben Personen. Ohne dieses Modul gibt es überall nur Vor- und Nachnamen; Beiträge, Familien und Lastschriften gibt es dann nicht.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Mitglieder“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Rechte vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer mitarbeiten soll, die passenden Rechte (siehe Abschnitt „Rechte“). Für Abteilungsleitungen gibt es in den Rollen das Häkchen „Nur eigene Abteilung(en)“.
3. **Beiträge und Abteilungen anlegen:** Reiter „Beiträge & Abteilungen“. Vorlagen gibt es bewusst nicht, denn jeder Verein rechnet anders.
4. **Vereinskonto und Lastschrift:** Das Konto unter Einstellungen › Bankkonten eintragen, Gläubiger-ID und Mandatsreferenz unter „Beiträge & Zahlungen › Einstellungen“.
5. **Mitglieder übernehmen:** per „Import …“ aus der bisherigen Verwaltung oder einzeln mit „+ Neues Mitglied“.

> Die „Einrichtung“ in der Seitenleiste führt Schritt für Schritt durch Beiträge, Vereinskonto, Lastschrift, Mitgliedschaft und Import und hakt Erledigtes ab.

## Verwaltung {#verwaltung}

### Reiter „Mitglieder“ {#mitglieder}

![Die Mitgliederliste, hier gefiltert auf „Hofmann“: Reiter oben, Knöpfe rechts, Warnkasten, Filter und die Liste.](bild: seite=mitglieder; fuelle=#mvQ::Hofmann)

Die Seite zeigt alle Mitglieder als Liste, nach Nachname und Vorname sortiert. Die Spalten:

- **Name** („Nachname, Vorname“), darunter bei Austritt das Datum oder bei passiven, ruhenden und Ehrenmitgliedern der Status.
- **Nr.** (die Mitgliedsnummer), **Alter** und **Abteilungen**. Ein Klick auf die Überschrift **Name**, **Nr.** oder **Alter** sortiert die Liste, ein zweiter Klick dreht um (▲/▼); am Handy gibt es dafür das Feld „Sortieren“. Mitglieder ohne Nummer oder Geburtsdatum stehen immer am Ende. Clubwerk merkt sich die Wahl je Gerät.
- **Beitrag:** die Beitragsart. Bei Familienmitgliedern steht „Familie“ mit dem Namen des Oberhaupts.
- **Zahlung:** Lastschrift, Rechnung oder bar. Zahlt jemand anderes, steht „über Name“. Ein „+3“ zeigt, für wie viele Angehörige diese Person mitzahlt.
- **Hinweise:** gelbe Schilder unter dem Namen, wo etwas fehlt oder zu prüfen ist, z. B. „Altersstufe prüfen“ oder „Mandat widerrufen“.

Oben seht ihr einen **roten Warnkasten**, wenn Mitglieder Pflichtangaben fehlen (Mitgliedsdaten, Beitrag, Bankverbindung oder SEPA-Mandat). „Anzeigen“ springt in den Filter „Mit Hinweis“. Wer Pflichtangaben fehlen, fehlt im Beitragslauf.

Zahlen zwei Mitglieder gegenseitig füreinander (oder läuft eine längere Kette im Kreis, z. B. aus einem älteren Import), steht oben ein zweiter roter Kasten **„Zahlungsweg ungültig: … zahlen gegenseitig füreinander“**; die Betroffenen tragen den Hinweis „Zahlungsweg ungültig“, auch am Mitglied selbst. Der Beitragslauf überspringt sie, bis der Weg repariert ist. **Reparieren …** öffnet ein Fenster: Ihr wählt, **wer selbst zahlt**; die anderen zahlen danach über diese Person (Familienmitglieder immer über ihr Oberhaupt), ebenso alle, die bisher über ein Mitglied des Kreises zahlten. Jede Änderung steht im Verlauf und im Protokoll. Beim Start ändert Clubwerk daran nichts von selbst.

![Fenster „Zahlungsweg reparieren“: wer zahlt selbst?](bild: seite=mitglieder; klick=[data-ring]; ziel=dialog)

Auch ein **fehlendes Geburtsdatum** steht in der Liste als Hinweis „Geburtsdatum fehlt“ (Filter „Mit Hinweis“) und unter Einstellungen › Datenqualität. Solche Mitglieder fehlen in der LSB-Meldung und gelten bei Altersstufen und im Familientarif als erwachsen; der Beitragslauf warnt davor in der Vorschau.

Zum Suchen und Filtern gibt es:

- die **Suche** nach Name, Nummer, E-Mail oder Ort. Sie findet auch frühere Namen: Wer nach „Müller“ sucht, findet Anna Schmidt, die früher Müller hieß – der Treffer zeigt „Schmidt, Anna (früher Müller)“. Das gilt auch für die Suche oben in der Verwaltung,
- die **Filter** „Aktuell“, „Mit Hinweis“, „Ausgetreten“ und „Alle“ (jeweils mit der Anzahl) sowie je ein Auswahlfeld für **Abteilung** und **Beitrag**.

Ein Klick auf eine Zeile öffnet das Mitglied. „← Alle Mitglieder“ führt zurück, mit den zuletzt gesetzten Filtern.

#### + Neues Mitglied

![Das Fenster „Neues Mitglied“.](bild: seite=mitglieder; klick=#mvNew; ziel=dialog)

Pflichtfelder tragen den Zusatz „(Pflicht)“ – in der ganzen Verwaltung gleich. Ein Mitglied wird nur **vollständig** angelegt: Name, Geburtsdatum, Eintritt, Anschrift, E-Mail, Handy, Beitrag, Abteilung und Zahlart. Bei Lastschrift gehören Kontoinhaber (Clubwerk schlägt den Namen vor), IBAN und das Datum des SEPA-Mandats dazu. Dazu kommt die **unterschriebene Beitrittserklärung** als PDF oder Foto (Datei wählen oder ins Feld ziehen).

- Die **Mitgliedsnummer** vergibt Clubwerk selbst, wenn das Feld leer bleibt.
- **Erstes Jahr:** „wie Beitragsart (Vorgabe)“, „frei (Anfänger)“, „anteilig berechnen“ oder „voll berechnen“. Sieht die Beitragsart oder der Zusatzbeitrag der gewählten Abteilung „Eintrittsjahr frei“ vor, fragt das Fenster ausdrücklich „Anfänger oder Vereinswechsler?“: Anfänger zahlen im ersten Jahr nichts, wer aus einem anderen Verein wechselt, zahlt anteilig.
- Beim **Beitrag** sind nur die Arten wählbar, die zum Alter passen; die übrigen sind ausgegraut. Dafür zuerst das Geburtsdatum eintragen.
- Ist in den Einstellungen „Lastschrift ist Pflicht“ gesetzt, gibt es nur die Zahlart Lastschrift.
- Soll das neue Mitglied am Tablet unterschreiben, nehmt stattdessen „+ Beitrittserklärung“ im Reiter „Anträge“.
- **Von Mitglied übernehmen …** (Knopf oben im Fenster): spart das Abtippen, wenn jemand zu einem vorhandenen Mitglied gehört. Ihr sucht das Mitglied (Anzeige „Nachname, Vorname“) und setzt Haken, was ins Formular soll: Anschrift, Nachname und Telefon Festnetz sind vorgewählt, E-Mail und Handy nicht. „Übernehmen“ füllt nur das Formular aus; gespeichert wird erst mit „Anlegen“. **Bankdaten werden nie übernommen.** Stattdessen wählt ihr im selben Fenster „Zur Familie von … hinzufügen“ oder „Zahlt über …“. Dann braucht das neue Mitglied keinen eigenen Beitrag (Familie) bzw. kein eigenes Konto; es zahlt über das Oberhaupt bzw. den Zahler. Es gelten die Familienregeln (siehe „Familienmitgliedschaft“): Clubwerk meldet es, wenn schon ein/e Partner/in da ist oder ein „Kind“ älter als 18 Jahre ist. Kinder brauchen keine E-Mail und kein Handy.
- **Willkommens-E-Mail senden** (Häkchen unten im Fenster): ist vorbelegt, sobald eine E-Mail-Adresse eingetragen und ein Postfach eingerichtet ist; sonst ausgegraut mit dem Grund. Text und Betreff legt ihr unter Einstellungen › „Willkommens-E-Mail“ fest. Hat ein neues Familienmitglied (z. B. ein Kind) keine eigene Adresse, geht die Mail an das Oberhaupt. Bei Lastschrift hängt Clubwerk Mandatsreferenz und Gläubiger-ID an, die Beitrittserklärung kommt als PDF in den Anhang.
- **Einladung zur Mitglieder-App mitsenden** (darunter, vorbelegt aus): steckt den persönlichen Link zum Freischalten gleich in die Willkommens-E-Mail. Das geht nur mit eigener Adresse. Teilt sich das neue Mitglied die Adresse mit anderen (z. B. dem Oberhaupt), bekommt nach der Regel der Mitglieder-App nur eines die Einladung per E-Mail; dann ist das Häkchen ausgegraut („E-Mail-Adresse gehört zu … – bitte per QR-Code freischalten“). Ohne eingetragene Adresse der Mitglieder-App fehlt das Häkchen. Mit App-Einladung erscheint darunter **„Anleitung als PDF anhängen“** (vorbelegt an): die zweiseitige Anleitung „Mitglieder-App einrichten“ geht mit.
- Dasselbe gilt für **„Partner/in neu anlegen“** und **„Kind neu anlegen“** (Reiter „Zahlung & Familie“).
- Dieselbe Übernahme gibt es oben in der Karte „Anschrift & Kontakt“ eines vorhandenen Mitglieds (Reiter „Stammdaten“) und bei „+ Beitrittserklärung“ im Reiter „Anträge“ (dort ohne Familie und Zahler).

#### Import …

![Das Import-Fenster: erst die Datei wählen.](bild: seite=mitglieder; klick=#mvImp; ziel=dialog)

Der Import übernimmt Mitglieder aus **S-Verein/SPG-Verein**, **WISO Mein Verein**, **verein.cloud** oder einer eigenen Liste (CSV, TXT oder Excel). Er läuft in drei Schritten:

1. **Datei wählen.** Clubwerk erkennt das Programm an den Spaltenköpfen und schlägt vor, welche Spalte wohin gehört. Rechts stehen als Beispiel die Werte einer Person. Wo der Vorschlag nicht passt, stellt ihr die Spalte selbst ein. Unten tragt ihr ein, bis wann die Beiträge im alten Programm schon abgerechnet sind („Beiträge bisher abgerechnet bis“) und ob die SEPA-Mandate schon benutzt wurden. So rechnet der nächste Beitragslauf nichts doppelt ab.
2. **Vorschau.** Kacheln zeigen, wie viele Personen neu angelegt oder ergänzt werden. Darunter prüft ihr, was Clubwerk nicht allein entscheiden kann. Bei „ähnlich benannten“ Abteilungen und Beitragsarten ist die Wahl Pflicht.
3. **Übernehmen.** Vorhandene Personen (auch aus dem Verkauf) erkennt Clubwerk an Nummer oder Namen und ergänzt sie; PINs bleiben erhalten. Zahler und Familien werden verknüpft. „Zurück zur Zuordnung“ geht jederzeit einen Schritt zurück.
   Würde ein „Abweichender Zahler“ einen Kreis schließen (A zahlt über B, B über A), verknüpft Clubwerk diese Zeile nicht: Die Vorschau warnt davor, und nach dem Übernehmen steht sie mit Zeile und Grund unter „Nicht verknüpft“. Den Zahler legt ihr danach beim Mitglied fest.

Im ersten Schritt legt **Erstes Jahr neuer Mitglieder** fest, wie das erste Beitragsjahr der neu angelegten Personen berechnet wird (Vorgabe: wie Beitragsart). Bereits vorhandene Mitglieder behalten ihre Einstellung.

Die Vorschau hat vier Prüfkarten:

- **Ähnliche Namen im Bestand** (z. B. „Benni“ und „Benedikt“): zusammenführen oder als neues Mitglied anlegen.
- **Abteilungen aus der Datei:** eine vorhandene zuordnen, neu anlegen oder nicht übernehmen.
- **Beitragsarten aus der Datei:** ebenso. „Nicht übernehmen“ heißt, das Mitglied kommt ohne diesen Beitrag. Dazu kommt „zusammenführen mit …“ (siehe unten).
- **Feldabgleich am Beispiel:** so landen die Spalten einer Person in Clubwerk.

**Beitragsarten zusammenführen.** Führt das alte Programm dieselbe Beitragsart unter mehreren Namen (z. B. „Jugend bis 18“ und „Jugendliche bis 18“), wählt ihr bei einer davon „zusammenführen mit „…““. Die gewählte ist das Ziel: Sie wird neu angelegt, auf Wunsch unter neuem Namen („neu anlegen als“), oder ihr legt sie auf eine vorhandene Beitragsart. Alle Mitglieder der zusammengeführten Arten landen in der Zielart, jedes genau einmal.

- Sehen Beitragsarten gleich aus (gleicher Betrag, Rhythmus und Abteilung, ähnlicher Name), schlägt Clubwerk das Zusammenführen vor: Ein blauer Hinweis steht oben, die Gruppe ist farbig gefasst und mit „ähnlich“ gekennzeichnet.
- Es gelten Betrag, Rhythmus, Altersgrenzen, Familie und Abteilung der Zielart. Weicht etwas ab, nennt ein gelber Warnkasten, wer künftig wie viel zahlt. Ohne den Haken „Verstanden – so übernehmen“ wird nichts übernommen.
- Ketten sind erlaubt (A mit B, B mit C), Kreise nicht.
- Die Zeile „Ergebnis“ zeigt vor dem Übernehmen, welche Beitragsarten neu entstehen und mit wie vielen Mitgliedern.

#### Excel

![Das Fenster „Mitgliederliste als Excel“ mit den wählbaren Spalten.](bild: seite=mitglieder; klick=#mvXls; ziel=dialog)

Lädt die Liste als Excel-Datei herunter, mit den Spalten, die ihr ankreuzt. Es gilt der Filter der Liste (z. B. nur eine Abteilung).

#### Dokumente (ZIP) …

![Das Fenster „Dokumente als ZIP“ mit Anzahl, Größe und Passwortfeld.](bild: seite=mitglieder; klick=#mvZip; ziel=dialog)

Lädt alle Dokumente der Mitglieder, die **gerade in der Liste stehen**, als eine ZIP-Datei herunter – also alle oder nur die gefilterten (Suche, Abteilung, Beitrag, „Ausgetreten“ …). Im ZIP gibt es einen Ordner je Mitglied („Nachname, Vorname“; bei gleichen Namen mit Mitgliedsnummer) und die Datei „Übersicht.xlsx“ mit Mitglied, Nummer, Dokument, Art, Datum, Größe und Herkunft. Enthalten ist alles, was am Mitglied unter „Dokumente“ steht, auch Schlüsselprotokolle (nur mit dem Recht „Schlüssel“).

- Das Fenster zeigt vorher, wie viele Mitglieder und Dokumente es sind und wie groß das ZIP etwa wird.
- Zum Herunterladen gebt ihr **euer eigenes Passwort** ein. Der Export steht im Protokoll (Anzahl und Auswahl, keine Inhalte), und alle mit dem Recht „Sicherheitswarnungen“ bekommen sofort eine Warnung.
- Höchstens 10 solche Exporte je Stunde und Benutzer, höchstens 2 GB je ZIP – sonst die Liste eingrenzen und in Teilen exportieren.
- Wer nur eine Abteilung betreut, bekommt nur die Mitglieder seiner Abteilung(en).

### Mitglied öffnen {#mitglied}

Auf einem breiten Bildschirm (ab 1500 Pixel, etwa ein großer Monitor) steht rechts neben der Liste eine Karte: Ein Klick auf einen Namen zeigt dort das Wichtigste – Geburtsdatum, Eintritt, Abteilungen, Beitrag, Zahlung, „Abgerechnet bis“, offene Posten, Kontakt und Hinweise. **Öffnen** (oder ein Doppelklick auf den Namen) öffnet das Mitglied, die Knöpfe darunter springen gleich in den passenden Reiter. Die Spalten „Zahlung“ und „Hinweise“ der Liste entfallen dann, beides steht in der Karte. Auf schmaleren Bildschirmen, am Tablet und am Handy öffnet ein Klick das Mitglied direkt.

![Ein geöffnetes Mitglied: oben Name und Eckdaten, darunter „← Alle Mitglieder“ und die Reiter.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detailrow)

Über dem Reiter steht der Name; darunter eine Zeile mit Nummer, Alter, Status, geplantem Austritt, „zahlt über …“ oder „Familie von …“ und dem Hinweis, wenn Änderungswünsche aus der App vorliegen. Hatte das Mitglied früher einen anderen Namen, steht dort zuerst „früher …“. Die Reiter heißen **Stammdaten**, **Mitgliedschaft**, **Zahlung & Familie**, **Konto & Mandat**, **Dokumente** und **Verlauf**. Wer nur eine Abteilung betreut, sieht nur „Stammdaten“, „Mitgliedschaft“, „Dokumente“ und „Verlauf“.

Fehlen Pflichtangaben, steht oben ein roter Kasten. Bei einer Person, die gar kein Vereinsmitglied ist (etwa ein Trainer), wandelt der Knopf **In „Kein Mitglied“ umwandeln …** sie um. Ihr Konto bleibt im Verkauf, in der Mitgliederliste erscheint sie nicht mehr.

### Mitglied › Stammdaten {#mitglied-stamm}

Der erste Reiter hat drei Karten und darunter einen gemeinsamen „Speichern“-Knopf.

#### Person

![Karte „Person“.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(1))

Anrede, Titel, Vorname, Nachname, Geburtsdatum, Geschlecht (männlich oder weiblich), Mitgliedsnummer und **Status**: aktiv, passiv/fördernd, Ehrenmitglied oder ruhend.

**Namensänderung:** Ändert ihr Vor- oder Nachnamen, fragt Clubwerk beim Speichern, ob es eine **Namensänderung** ist (etwa nach Hochzeit oder Scheidung) oder nur eine **Korrektur** (Tippfehler). Bei einer Namensänderung merkt sich Clubwerk den bisherigen Namen mit Datum; bei einer Korrektur nicht. Heißt der Kontoinhaber der Bankverbindung bisher genau wie das Mitglied, steht im Fenster zusätzlich „Kontoinhaber auch auf den neuen Namen ändern?“ (vorausgewählt). Mandatsreferenz und Mandat bleiben dabei gültig, es braucht kein neues Mandat. Die Frage sieht nur, wer das Recht „Bankdaten“ hat. Es ist dasselbe Fenster wie beim Übernehmen einer Namensänderung aus der App (Bild im Reiter „Anträge“).


Frühere Namen stehen unten in der Karte unter **Frühere Namen** („Nachname, Vorname“ und „bis“ mit Datum). Ist einer versehentlich entstanden oder soll der Name nicht mehr erscheinen, entfernt ihn **Entfernen …**. Der Name verschwindet dann ganz: aus der Suche, dem Verlauf, erledigten Änderungswünschen, der Datenauskunft und dem Protokoll. Im Verlauf steht nur „Früherer Name entfernt“. Das lässt sich nicht rückgängig machen. Unterschriebene Dokumente (etwa ein Mandat unter dem alten Namen) und schon gesendete E-Mails bleiben, wie sie sind.

#### Anschrift & Kontakt

![Karte „Anschrift & Kontakt“.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

Straße, PLZ, Ort, Adresszusatz, Land, E-Mail, Handy, Telefon (Festnetz) und die **Briefanrede** (z. B. „Liebe Anna“). Dazu das Eintrittsdatum, die Schlüsselnummer und **Notizen**, die nur der Vorstand sieht.

Mit **Von Mitglied übernehmen …** (Knopf oben in der Karte) holt ihr Anschrift, Nachname, Telefon (Festnetz), E-Mail oder Handy von einem anderen Mitglied ins Formular – gespeichert wird erst mit „Speichern“, Bankdaten werden nie übernommen. Statt der Bankverbindung könnt ihr dort auch „Zur Familie von … hinzufügen“ oder „Zahlt über …“ wählen; das wird beim Speichern gesetzt.

**Umzug:** Ändert ihr die Anschrift und wohnen andere aktive Mitglieder unter der bisherigen Anschrift, fragt Clubwerk beim Speichern: „Unter derselben Anschrift wohnen auch: …“ – mit einem Haken je Person (Nachname, Vorname). Wer abgehakt bleibt, bekommt die neue Anschrift ebenfalls. Ohne Haken ändert sich nur dieses Mitglied; „Abbrechen“ speichert nichts. Jede Änderung steht im Verlauf der Person und im Protokoll.

#### Einwilligungen

![Karte „Einwilligungen“.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(3))

Je Einwilligung ein Häkchen mit Datum („seit …“), z. B. für Fotos. Welche es gibt, legt ihr unter „Einstellungen“ fest.

#### Weitere Karten und Knöpfe

- **Tablet-PIN:** zeigt, ob das Mitglied eine PIN hat. „PIN zurücksetzen“ löscht sie; beim nächsten Mal legt das Mitglied am Tablet eine neue fest. Das Mitglied kann am Tablet „Andere dürfen für mich buchen“ einschalten (dann geht Buchen ohne PIN, aber ohne Einsicht); in der Kontenverwaltung steht dazu die Pille „Buchen ohne PIN erlaubt“, und der Vorstand kann es dort ausschalten.
- **Willkommens-E-Mail:** zeigt, wann sie zuletzt gesendet wurde und an welche Adresse sie geht. „Willkommens-E-Mail senden …“ fragt nach und bietet dabei an, die Einladung zur Mitglieder-App mitzuschicken. Jeder Versand steht im Verlauf des Mitglieds und im Protokoll. Jede so gesendete Mail steht mit vollem Text unter Nachrichten › Gesendet › Automatisch.

![Karte „Willkommens-E-Mail“ am Mitglied.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=#sWel)

- **Profilbild:** erscheint, wenn das Mitglied in der App eines hochgeladen hat. „Profilbild entfernen …“ löscht es.
- **Vorsicht:** „Löschen …“ geht nur, wenn nichts mehr am Mitglied hängt (gedacht für versehentlich oder doppelt angelegte). „Anonymisieren …“ gibt es erst nach dem Austritt. Es löscht Name, frühere Namen, Anschrift, Konto, Dokumente und Verlauf unwiderruflich; für die Statistik bleiben Geburtsjahr, Geschlecht, Ein- und Austritt und Abteilungen. Zur Sicherheit tippt ihr dabei das Wort ANONYMISIEREN.
- **Datenauskunft** (Knopf rechts in der Reiterzeile): lädt eine Datei mit allem, was Clubwerk über die Person gespeichert hat, auch frühere Namen und Daten aus anderen Modulen. Ohne das Recht „Bankdaten“ bleibt die IBAN darin unkenntlich.

### Mitglied › Mitgliedschaft {#mitglied-mitgliedschaft}

Der Reiter hat vier Karten: Beiträge, Abteilungen, Ehrungen und Ämter & Funktionen.

#### Beiträge

![Karte „Beiträge“ eines Mitglieds.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(1))

Welche Beitragsarten das Mitglied hat, mit Betrag, Rhythmus, „ab“, „bis“ und **abgerechnet bis**. Passt eine Beitragsart nicht (mehr) zum Alter, steht dort „passt nicht zum Alter“. „+ Beitrag“ ordnet eine weitere Art zu, „Bearbeiten“ ändert sie:

![Das Fenster „Beitrag zuordnen“.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; klick=#fAdd; ziel=dialog)

- **Ab / Bis:** Beginn und Ende (leer = unbefristet).
- **Abweichender Betrag:** gilt statt des Betrags der Beitragsart, z. B. bei einer Ermäßigung.
- **Abgerechnet bis:** setzt der Beitragslauf selbst. Nur ändern, wenn ihr außerhalb von Clubwerk abgerechnet habt.
- **Beitrag entfernen …:** nur sinnvoll, solange nichts abgerechnet ist. Sonst ein Ende eintragen.

Unter der Liste steht das **erste Jahr** mit seinem Zeitraum (Beitragsjahr des Eintritts) und der Wahl: „wie Beitragsart (Vorgabe)“, „frei (Anfänger)“, „anteilig berechnen“ oder „voll berechnen“. Sie gilt für alle Beiträge und Zusatzbeiträge des Mitglieds im ersten Jahr. **Ändern …** geht, solange im ersten Jahr nichts abgerechnet ist. Ist ein Teil schon als beitragsfrei vermerkt („abgerechnet bis“ ohne Posten), fragt Clubwerk, ob der Vermerk zurückgenommen werden soll; der nächste Beitragslauf berechnet den Zeitraum dann mit Vorschau. Jede Änderung steht im Verlauf des Mitglieds und im Protokoll.

Ist das Mitglied Familienmitglied, hat es keinen eigenen Beitrag; er steckt im Familienbeitrag des Oberhaupts.

#### Abteilungen

![Karte „Abteilungen“ eines Mitglieds.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

Je Abteilung stehen Status, Eintritt, Austritt und der **Zusatzbeitrag** (nach Alter, „fest“ oder „befreit“). „+ Abteilung“ und „Bearbeiten“ öffnen das Fenster dazu:

![Das Fenster „Abteilung zuordnen“.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; klick=#dAdd; ziel=dialog)

Der Zusatzbeitrag richtet sich normalerweise automatisch nach dem Alter. Ihr könnt ihn aber auf eine feste Beitragsart setzen oder das Mitglied **befreien** (z. B. einen Trainer). Wer die Abteilung verlässt, bekommt besser ein Austrittsdatum, als entfernt zu werden. Dann stimmt die Statistik.

Wechselt jemand durch sein Alter in eine andere Beitragsart, steht oben auf dem Reiter ein gelber **Altersstufen-Hinweis** mit „So belassen“ und „Umstellen“. Bis zur Entscheidung läuft der bisherige Beitrag weiter.

#### Ehrungen und Ämter & Funktionen

![Die Karten „Ehrungen“ und „Ämter & Funktionen“.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; ziel=.detbody > .mv-two)

Zwei Karten nebeneinander. Mit „+ Ehrung“ und „+ Amt“ tragt ihr Bezeichnung und Datum ein, „Entfernen“ löscht den Eintrag. Ämter (z. B. Kassenwart) stehen auch anderen Modulen zur Verfügung, etwa für Rechte beim Platzbuchen. Unter „Ehrungen“ gibt es außerdem das Häkchen **Keine Gratulation gewünscht** (siehe Reiter „Gratulationen“).

#### Austritt

![Das Fenster „Austritt“.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; klick=#mvExit; ziel=dialog)

Der Knopf **Austritt …** rechts in der Reiterzeile trägt den Austritt ein: Datum (vorgeschlagen ist der früheste Termin nach Kündigungsfrist und Geschäftsjahr, gerechnet ab dem Eingang der Kündigung), Eingang der Kündigung, Grund und auf Wunsch das Kündigungsschreiben als Datei. Ihr entscheidet, ob Beiträge und Abteilungen zum Austritt enden und ob Angehörige mit austreten. Das Häkchen **Angehörige mit austreten lassen** nennt alle, die über das Mitglied zahlen oder zu seiner Familie gehören; mit Häkchen treten sie zum selben Tag aus, ihre Beiträge und Abteilungen enden wie beim Mitglied. Ohne Häkchen fragt Clubwerk nach, bevor das Mitglied allein austritt. Tritt das letzte Kind oder der Partner einer Familie aus, weist das Fenster darauf hin, dass das Oberhaupt danach allein im Familienbeitrag ist. Ein Mitglied, über das noch andere zahlen, lässt sich nicht anonymisieren. Bis zum Austrittstag bleibt alles wie bisher. Danach verschwindet das Mitglied am Tablet und in der App; die Daten bleiben bis zum Anonymisieren. Ein noch nicht wirksamer Austritt lässt sich mit **Austritt zurücknehmen** widerrufen, ein vollzogener mit **Wiedereintritt …** (das Mitglied bekommt eine neue Nummer und braucht bei Lastschrift ein neues Mandat).

Unter **Bestätigung an das Mitglied** wählt ihr, ob das Mitglied eine E-Mail bekommt: **Standardtext senden** (vorgewählt, Text aus Einstellungen › „Austrittsbestätigung“), **Vor dem Versenden anpassen** (Betreff und Text mit den eingesetzten Werten erscheinen im Fenster und lassen sich nur für dieses Mal ändern) oder **Keine E-Mail** (z. B. bei einem Todesfall). Darunter steht, an welche Adresse die Mail geht; ohne eigene Adresse geht sie an das Familienoberhaupt, sonst an den Zahler. Fehlt eine Adresse oder ist kein Postfach eingerichtet, bleibt nur „Keine E-Mail“ mit dem Grund. Der Versand steht im Verlauf des Mitglieds und im Protokoll; klappt er nicht, ist der Austritt trotzdem eingetragen und die Meldung nennt den Grund. Meldet eine Abteilungsleitung den Austritt, wählt die Vereinsverwaltung beim Bestätigen. Jede so gesendete Mail steht mit vollem Text unter Nachrichten › Gesendet › Automatisch.

### Mitglied › Zahlung & Familie {#mitglied-zahlung}

Hier gibt es zwei **getrennte** Zuordnungen, nebeneinander in zwei Karten.

#### Wer zahlt?

![Karte „Wer zahlt?“ mit der Zahlergruppe.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .mv-two > div:nth-child(1))

Das ist eine reine Geldbeziehung: Beiträge, Zusatzbeiträge und Verkauf laufen über das Konto und Mandat des **Zahlers**. Das kann auch ein Vater für sein erwachsenes Kind sein. Darunter steht die Zahlergruppe. Bei „Verkauf am Tablet“ stellt ihr ein, ob ein Angehöriger am Tablet über den Hauptzahler bucht oder einen eigenen Eintrag hat. Die **Zahlungsart** (Lastschrift, Rechnung, bar) gilt für den Zahler.

Ein Zahlungsweg endet immer bei jemandem, der selbst zahlt. Wer über ein Mitglied zahlen soll, das selbst (auch über andere) über diese Person zahlt, wird abgelehnt – die Meldung steht direkt am Feld „Zahler“. Dieselbe Prüfung gilt beim Anlegen, bei „Von Mitglied übernehmen …“, bei Familie, Beitrittserklärung, Import und Zusammenführen.

#### Familienmitgliedschaft

![Karte „Familienmitgliedschaft“.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .mv-two > div:nth-child(2))

Ein **Oberhaupt** mit Familienbeitrag deckt Partner/in und Kinder ab. Erlaubt sind ein/e Partner/in und beliebig viele Kinder bis 18 Jahre (einstellbar). Wer zugeordnet ist, braucht keine eigene Beitragsart; Zusatzbeiträge der Abteilungen bleiben je Person. Am Oberhaupt fügt ihr vorhandene Mitglieder über „Angehörige/n hinzufügen …“ hinzu; „Lösen“ nimmt sie wieder heraus. Noch nicht erfasste Angehörige legt ihr mit **„Partner/in neu anlegen“** oder **„Kind neu anlegen“** an: Das Formular „Neues Mitglied“ öffnet sich, vorbelegt mit Anschrift, Nachname und Telefon Festnetz des Oberhaupts, der Familie und der Zahlung über das Oberhaupt. Gibt es schon eine/n Partner/in, ist „Partner/in neu anlegen“ gesperrt (mit Begründung); ein Kind über 18 Jahre meldet das Formular deutlich. Namen stehen überall als „Nachname, Vorname“. Bei einem Angehörigen wählt ihr unter „Familienmitgliedschaft bei“ das Oberhaupt.

#### Forderungen & Zahlungen

![Karte „Forderungen & Zahlungen“ eines Zahlers.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

Alle Posten des Zahlers (Spalten Position, Fällig, Art, Status, Betrag). „Bezahlt“, „Ändern“ und „Stornieren“ wirken hier wie unter „Offene Posten“ (siehe dort). „+ Forderung“ in der Reiterzeile legt einen neuen Posten an, „Rechnung (PDF)“ druckt die offenen Posten als Rechnung.

#### Mahnungen

![Die Karte „Mahnungen“ eines Zahlers mit Mahnhistorie.](bild: seite=mitglieder/mitglied/11; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .card:last-child)

Die bisherigen Mahnschreiben (Datum, Schreiben, Betrag, Gebühr). „Mahnsperre …“ stoppt Mahnungen für alle Posten dieses Zahlers (mit Grund und optionalem Datum, z. B. bei vereinbarter Ratenzahlung). Gab es zwei Rücklastschriften, steht hier der Hinweis, dass der Zahler nicht mehr eingezogen wird; „Wieder einziehen …“ hebt das auf. Per E-Mail verschickte Mahnungen stehen mit vollem Text unter Nachrichten › Gesendet › Automatisch.

### Mitglied › Konto & Mandat {#mitglied-konto}

![Die Karten „Bankverbindung“ und „SEPA-Lastschriftmandat“.](bild: seite=mitglieder/mitglied/7; tab=konto; tabkey=detail_mitglied)

Oben steht die **Bankverbindung** (Kontoinhaber, IBAN mit Prüfung, BIC, Kreditinstitut), daneben das Schild „Mandat gültig“ oder der Grund, warum nicht. Die Karte **SEPA-Lastschriftmandat** hat Mandatsreferenz, Datum der Unterschrift und „zuletzt benutzt“.

- Noch nie benutzt heißt: Die nächste Lastschrift ist eine **Erstlastschrift**. Bei einem Mandat aus der bisherigen Verwaltung tragt ihr „zuletzt benutzt“ ein, dann ist sie eine Folgelastschrift.
- Eine einmal benutzte Mandatsreferenz lässt sich nicht mehr ändern (die Bank kennt sie). Für eine neue Bankverbindung oder ein neu unterschriebenes Formular gibt es **Neues Mandat …**.
- **Mandat widerrufen** sperrt Lastschriften von diesem Konto; „Widerruf aufheben“ nimmt es zurück.
- Ein Mandat **verfällt**, wenn es 36 Monate nicht benutzt wurde.

Bei Familienmitgliedern und Mitgliedern mit abweichendem Zahler ist der Reiter grau: Konto und Mandat gehören dem Oberhaupt bzw. Zahler. Ohne das Recht „Bankdaten“ ist die IBAN unkenntlich.

### Mitglied › Dokumente {#mitglied-dokumente}

![Der Reiter „Dokumente“: Dokument ablegen und die Ablage.](bild: seite=mitglieder/mitglied/7; tab=dokumente; tabkey=detail_mitglied)

Hier liegen Beitrittserklärung, SEPA-Mandat, Kündigung, Nachweise und Schriftverkehr als Dateien. Mit **Dokument ablegen** wählt ihr die Art, optional eine Bezeichnung und die Datei (PDF, Foto, Word oder Text, bis 15 MB). In der **Ablage** öffnet „Öffnen …“ die Datei oder löscht sie. **Alle Dokumente als ZIP** (rechts über der Ablage) lädt alle Dokumente dieses Mitglieds auf einmal herunter, mit einer Übersicht als Excel; das steht im Protokoll. Die Dokumente liegen nur auf dem Vereinsrechner und sind in der Datensicherung enthalten. Bei Familienmitgliedern liegen Beitrittserklärung und Mandat beim Oberhaupt.

### Mitglied › Ausweis {#mitglied-ausweis}

![Der Reiter „Ausweis“: Stand und ausgestellte Ausweise, einer davon gesperrt.](bild: seite=mitglieder/mitglied/12; tab=ausweis; tabkey=detail_mitglied)

Den Reiter gibt es, wenn der Mitgliedsausweis eingeschaltet ist (Einstellungen › Mitgliedsausweis). Oben steht, ob der Ausweis gilt und ob ein Foto darauf ist. Ein Foto erscheint nur, wenn das Mitglied sein Profilbild in der App selbst für den Mitgliedsausweis freigibt. Die Liste **Ausgestellte Ausweise** zeigt je Ausweis die Seriennummer, wann er ausgestellt wurde, bis wann er gilt und ob er gültig oder gesperrt ist. Den Ausweis stellt das Handy des Mitglieds selbst aus, sobald es in der App „Meine Daten“ › „Ausweis“ öffnet, und erneuert ihn von selbst.

**Ausweis sperren / neu ausstellen …** (oben rechts) macht die Seriennummer sofort ungültig, etwa nach einem verlorenen Handy. Öffnet das Mitglied die App wieder mit Netz, bekommt es einen neuen Ausweis mit neuer Seriennummer. Bei einem verlorenen Handy das Mitglied zusätzlich neu zur App einladen, dann verliert das alte Handy den Zugang. Sperren steht im Protokoll und im Verlauf des Mitglieds. Nach einem Austritt gilt der Ausweis ab dem Tag nach dem Austritt nicht mehr, ohne dass ihr etwas tun müsst.

### Mitglied › Verlauf {#mitglied-verlauf}

![Die Karte „Änderungsverlauf“.](bild: seite=mitglieder/mitglied/7; tab=verlauf; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

Oben steht, ob ein Handy für die Mitglieder-App freigeschaltet ist (und wann es zuletzt benutzt wurde). Darunter der **Änderungsverlauf**: jedes geänderte Feld mit Zeitpunkt, vorher, nachher und wer es geändert hat.

### Reiter „Anträge“ {#mv-antraege}

![Der Reiter „Anträge“ mit einer neuen Beitrittserklärung und zwei Änderungswünschen.](bild: seite=mv-antraege)

Hier laufen Beitrittserklärungen und Änderungswünsche ein. Die Zahl am Reiter zeigt, wie viele auf euch warten. Die Knöpfe oben rechts:

- **Formular (PDF):** das leere Papierformular zum Ausdrucken. Wo man aus festen Möglichkeiten wählt, stehen Kästchen zum Ankreuzen (Geschlecht, Partner/in oder Kind mit der Altersgrenze aus den Einstellungen, Beitragsart, Einwilligungen). „Ort, Datum“ bleibt frei; erst das online oder am Tablet unterschriebene PDF trägt Wohnort und Datum der Unterschrift ein.
- **Online-Antrag …:** schaltet den Antrag über die Adresse der Mitglieder-App ein und zeigt den Link zum Kopieren (er endet auf `/p/mitglieder/`). Gegen Missbrauch schützen eine Falle für automatische Formulare, eine Mindest-Ausfüllzeit und eine Begrenzung je Gerät und Tag.
- **+ Beitrittserklärung:** ihr erfasst die Daten, das neue Mitglied unterschreibt am Tablet mit einem Code.

#### Beitrittserklärung erfassen

![Das Fenster „Beitrittserklärung erfassen“.](bild: seite=mv-antraege; klick=#aNew; ziel=dialog)

Ihr tragt Personen, Anschrift, Mitgliedschaft und SEPA-Mandat ein (mit „Von Mitglied übernehmen …“ holt ihr Anschrift, Nachname, E-Mail und Handy von einem vorhandenen Mitglied). Für eine **Familie** fügt ihr mit „+ Person (Familie)“ Partner/in und Kinder hinzu; dann gilt der Familienbeitrag und der/die Antragsteller/in wird Hauptzahler. Am Ende steht „Code fürs Tablet erzeugen“ (der Code gilt drei Stunden). Am Tablet tippt das neue Mitglied „Mitglied werden“ › „Ich habe einen Code“, prüft seine Daten, setzt die Häkchen für die Einwilligungen und unterschreibt Beitrittserklärung und SEPA-Mandat. Mit dem Häkchen „Nach der Unterschrift sofort als Mitglied übernehmen“ ist es danach gleich angelegt und bekommt eine Willkommens-E-Mail mit Mitgliedsnummer und Mandatsreferenz.

#### Warten auf Bestätigung

Unterschriebene Anträge (vom Tablet oder online) warten hier. „Prüfen & annehmen“ öffnet sie:

![Die Beitrittserklärung zum Prüfen: Personen, Zuordnung zum Bestand und Beitrag.](bild: seite=mv-antraege; klick=[data-ap]; ziel=#dialog .split table)

Zu jeder Person schlägt Clubwerk vor, ob sie **neu angelegt** oder mit einem vorhandenen Mitglied **zusammengeführt** wird (z. B. wenn jemand schon im Verkauf geführt wird), und welcher Beitrag gilt. Rechts im Fenster steht die unterschriebene Erklärung als PDF mit Prüfwert. Unter „Eintritt zum“ wählt ihr das **erste Jahr**; sieht eine gewählte Beitragsart oder Abteilung „Eintrittsjahr frei“ vor, muss die Frage „Anfänger oder Vereinswechsler?“ beantwortet sein. „Annehmen & Mitglieder anlegen“ legt alles an; „Ablehnen“ lehnt ab (mit internem Grund). Die Abteilungsleitung kann einen Antrag nur befürworten, annehmen muss ihn dann die Vereinsverwaltung.

#### Warten auf Unterschrift am Tablet

Anträge mit Code, die noch nicht unterschrieben sind. „Neuer Code“ erzeugt einen frischen (nach drei Stunden läuft er ab), „Ansehen“ zeigt den Antrag, im Fenster löscht „Antrag löschen …“ ihn.

#### Änderungen & Meldungen

Wünsche aus der Mitglieder-App und Meldungen der Abteilungsleitungen:

- **Datenänderung** (z. B. neue Anschrift): „Übernehmen“ zeigt alt und neu zur Bestätigung, „Ablehnen“ schickt dem Mitglied auf Wunsch eine E-Mail mit Grund.
- **Namensänderung:** das Mitglied meldet einen neuen Vor- oder Nachnamen. „Übernehmen“ zeigt bisher und neu und fragt wie in den Stammdaten nach Namensänderung oder Korrektur und gegebenenfalls nach dem Kontoinhaber. Der bisherige Name bleibt als früherer Name; das Mitglied bekommt eine Bestätigung per E-Mail.
- **Neue Bankverbindung:** mit der Unterschrift des Mitglieds. Beim Übernehmen entsteht ein neues Mandat (Erstlastschrift); das unterschriebene Mandat wird als PDF abgelegt und dem Mitglied geschickt.
- **Kündigung:** Clubwerk schlägt den frühestmöglichen Austrittstag vor: das Ende des Geschäftsjahres unter Einhaltung der Kündigungsfrist (Frist 0 und Geschäftsjahr = Kalenderjahr: Kündigung bis 31.12. → Austritt zum 31.12.; Frist 3 Monate: Eingang bis 30.09.). Dasselbe Datum nennt die App beim Kündigen und die Eingangsbestätigung per E-Mail. Ein angefangenes Beitragsjahr wird voll berechnet; ihr bestätigt oder ändert ihn. Beim Bestätigen wählt ihr wie beim Austritt: Standardtext senden, vor dem Versenden anpassen oder keine E-Mail.
- **Ein-, Austritt und Rückkehr in eine Abteilung** meldet die Abteilungsleitung; „Bestätigen“ übernimmt sie. Beim Austritt wählt ihr dabei die Bestätigung an das Mitglied.
- **Bescheinigung angefordert:** ein Mitglied möchte eine Mitgliedsbescheinigung, etwa für das Bonusprogramm der Krankenkasse. In der Zeile stehen das Jahr, der Hinweis des Mitglieds und – bei Familien – wer sie angefordert hat und an wen sie geht. „Unterschreiben …“ öffnet das Fenster dazu (siehe unten), „Ablehnen“ fragt nach einem Grund für die E-Mail.

![Fenster „Namensänderung von …“: bisher und neu, Namensänderung oder Korrektur, darunter der Kontoinhaber.](bild: seite=mv-antraege; klick=[data-cok="16"]; ziel=dialog)

#### Mitgliedsbescheinigung unterschreiben

![Das Fenster „Mitgliedsbescheinigung“: Angaben, Name und Funktion und das Unterschriftsfeld.](bild: seite=mv-antraege; klick=[data-cok="12"]; ziel=#ceForm)

Rechts seht ihr die Bescheinigung als PDF-Vorschau. Sie enthält nur, was der Verein kennt: Name, Geburtsdatum, Anschrift, „Mitglied seit“, Status (aktiv, passiv …), die Abteilungen in diesem Jahr und den Zeitraum der Mitgliedschaft im gewählten Jahr – keine Aussage über Training oder Teilnahme. Oben steht euer Briefkopf aus Einstellungen › Verein (Logo, Name, Anschrift; Telefon, E-Mail und Webseite in der Fußzeile).

Links tragt ihr **Name** und **Funktion** ein (Clubwerk merkt sich eure Funktion für das nächste Mal) und unterschreibt mit Finger oder Maus im Feld; „Löschen“ fängt neu an. Die Unterschrift steht nur auf dieser Bescheinigung und wird sonst nirgends gespeichert. **Unterschreiben & senden** erzeugt das PDF mit Ort, Datum, Vereinsstempel und Unterschrift, legt es unter Dokumente des Mitglieds ab, schickt es per E-Mail und zeigt es in der App. Bei einer Familie geht die E-Mail an das Familienoberhaupt. Ohne Vereinsstempel lässt sich nicht unterschreiben – das Fenster weist darauf hin. Name, Funktion und Unterschrift sind Pflicht: Fehlt etwas, steht die Meldung rot direkt am Feld. Lässt sich die E-Mail nicht senden, sagt das Fenster es; die Bescheinigung liegt dann trotzdem in der App.

Unterschreiben dürft ihr nur mit dem Recht „Mitglieder“ ohne Einschränkung auf eine Abteilung. Abteilungsleitungen sehen die Anfragen ihrer Abteilung mit Vorschau, unterschreiben und ablehnen aber nicht.

#### Archiv

„Alle Anträge anzeigen“ listet auch angenommene und abgelehnte Anträge.

### Reiter „Gratulationen“ {#mv-gratulationen}

![Der Reiter „Gratulationen“: anstehende Anlässe und die eigene Erinnerung.](bild: seite=mv-gratulationen)

Eine Liste der Geburtstage und Jubiläen der nächsten 30 Tage: Name, Datum, Anlass, geplante Gratulation (z. B. „Blumen“), wer sich kümmert und der Stand („heute“, „vorbei“, „erledigt“). „Offen“ und „Alle“ filtern. Der Reiter erscheint nur mit dem Recht „Gratulationen“.

#### Anlass bearbeiten

![Das Fenster „Gratulation“ zum Bearbeiten.](bild: seite=mv-gratulationen; klick=[data-cg]; ziel=dialog)

„Bearbeiten“ öffnet den Anlass. Ihr tragt ein, **wer sich kümmert**, und eine Notiz, und hakt **Erledigt** ab. Bei Jubiläen kann das Häkchen „Als Ehrung beim Mitglied eintragen“ die Ehrung gleich im Mitglied speichern. „Keine Gratulation gewünscht …“ nimmt die Person aus allen Anlässen heraus (rückgängig beim Mitglied). Selbst angelegte Anlässe lassen sich löschen.

#### + Anlass

![Das Fenster „Anlass ergänzen“.](bild: seite=mv-gratulationen; klick=#cgNew; ziel=dialog)

Für Anlässe, die keine Regel kennt, etwa eine Goldene Hochzeit: Mitglied, Datum, Anlass und Gratulation.

#### Deine Erinnerung

Jeder mit dem Recht „Gratulationen“ wählt für sich, ob er einige Tage vor jedem Anlass eine **E-Mail** oder eine **Push-Nachricht** in der Mitglieder-App bekommt (je Anlass einmal). Dafür muss das Benutzerkonto unter Benutzer & Rechte mit dem eigenen Mitglied verknüpft sein. Die Regeln selbst stehen unter „Einstellungen“.

### Reiter „Beiträge & Abteilungen“ {#mv-stamm}

Diese Seite ist die Preisliste des Vereins. Oben rechts stehen die Knöpfe **+ Abteilung**, **+ Zusatzbeitrag** und **+ Beitragsart**. Die Zahl am Reiter zeigt, wie viele Mitglieder gerade die Altersstufe wechseln.

#### Beiträge Hauptverein

![Die Beitragsarten des Hauptvereins.](bild: seite=mv-stamm; ziel=#cBody > div:nth-child(1))

Je Beitragsart: Bezeichnung, Betrag, Rhythmus (jährlich, halbjährlich, vierteljährlich, monatlich, einmalig) mit der Regel fürs Eintrittsjahr, Altersgrenzen, ob es ein **Familienbeitrag** ist, Arbeitsstunden, ob sie auf der Beitrittserklärung steht, und die Zahl der Mitglieder. Mit ↑ und ↓ legt ihr die Reihenfolge fest; so erscheinen die Arten auch in Auswahlfeldern und auf dem Formular.

![Das Fenster „Neue Beitragsart“.](bild: seite=mv-stamm; klick=#fNew; ziel=dialog)

Die Felder im Fenster:

- **Art:** „Beitrag Hauptverein“ oder „Zusatzbeitrag einer Abteilung“.
- **Bezeichnung** (wie auf dem Formular) und **Betrag**.
- **Rhythmus:** jährlich bis monatlich oder „einmalig“, z. B. für eine Aufnahmegebühr.
- **Im Eintrittsjahr:** „anteilig (volle Monate)“, „voller Betrag“ oder „Eintrittsjahr frei“.

> Tipp „Eintrittsjahr frei“: Frei ist nur das **Beitragsjahr, in das der Eintritt in den Verein fällt** – nie ein späteres. Das freie Jahr ist für **Anfänger** gedacht: Wer aus einem anderen Verein wechselt, bekommt am Mitglied „Erstes Jahr: anteilig berechnen“ (oder „voll berechnen“). Bei einem Beitragsjahr vom 01.05. bis 30.04. heißt das: Eintritt im März → frei bis 30.04. desselben Jahres; Eintritt im Juli → frei bis 30.04. des Folgejahres. Ab dem nächsten 01.05. wird ganz normal berechnet und eingezogen, egal ob jährlich, halbjährlich, vierteljährlich oder monatlich, auch bei Zusatzbeiträgen und in Familien. Bekommt jemand seinen Beitrag erst später (später zugeordnet, neue Altersstufe, später in eine Abteilung eingetragen), gibt es kein weiteres freies Jahr. Der Beitragslauf vermerkt die freie Zeit als „abgerechnet bis“, ohne Posten; am Mitglied steht darunter „Eintrittsjahr frei – nächster Beitrag ab …“. Maßgeblich ist das **Beitragsjahr** (Einstellungen › „Beitragsjahr beginnt am 1.“), nicht das Geschäftsjahr.
- **Arbeitsstunden im Jahr:** leer = Vorgabe des Moduls „Dienste & Termine“, 0 = keine.
- **ab … Jahre** und **bis einschließlich … Jahre:** Hinweis im Beitragslauf und Vorschlag bei neuen Anträgen. Gerechnet wird mit dem Alter zu Beginn des Beitragszeitraums; unter dem Feld steht, was die Obergrenze bedeutet („bis einschließlich 18 → gilt bis zum Tag vor dem 19. Geburtstag“). Überall steht dieselbe Schreibweise: „ab 19“, „bis einschl. 18“, „12 bis einschl. 18“. Überschneiden sich die Altersbereiche zweier Beitragsarten gleicher Art (z. B. „Jugendliche bis 19“ und „Erwachsene ab 19“), warnt das Fenster („Überschneidet sich mit … – meintest du bis einschließlich 18?“; Speichern bleibt möglich) und Einstellungen › Datenqualität zeigt es als Hinweis. Bei einer Überschneidung gilt immer die höhere Stufe, auch beim Vorschlag für Kinder, die aus dem Familienbeitrag herauswachsen.
- **Familienbeitrag:** gilt für den Hauptzahler und alle Angehörigen.
- **Auf der Beitrittserklärung zur Auswahl:** nur diese Arten bieten Neue am Tablet und online an.
- **Aktiv** und **Hinweis (intern)**. „Beitragsart löschen …“ gibt es nur, wenn kein Mitglied sie mehr hat. Eine Art, die schon abgerechnet wurde, deaktiviert ihr besser.

#### Zusatzbeiträge der Abteilungen

![Die Zusatzbeiträge der Abteilungen.](bild: seite=mv-stamm; ziel=#cBody > div:nth-child(2))

Zusatzbeiträge zahlt jede Person, die der Abteilung angehört, zusätzlich zum Beitrag des Hauptvereins, und zwar den Betrag **ihres Alters**. Dafür legt ihr je Abteilung mehrere Beiträge mit Altersgrenzen an (z. B. „Tennis Jugend“ bis 17 und „Tennis Erwachsene“ ab 18). In Familien zahlt der Hauptzahler den Zusatzbeitrag nur für die Angehörigen, die in der Abteilung sind.

#### Abteilungen

![Die Abteilungen.](bild: seite=mv-stamm; ziel=#cBody > div:nth-child(3))

Name, Fachverband und Zahl der Mitglieder. „+ Abteilung“ legt eine neue an (Name, Fachverband, Reihenfolge); inaktive Abteilungen werden nicht mehr zur Auswahl angeboten, leere lassen sich löschen.

#### Altersstufen

![Die Karte „Altersstufen“ mit zwei Vorschlägen.](bild: seite=mv-stamm; ziel=#cAges)

Wer älter wird und nicht mehr in seinen Beitrag passt, aus dem Familienbeitrag herauswächst oder in eine höhere Stufe des Zusatzbeitrags kommt, steht hier – ebenso ein Oberhaupt, das allein im Familienbeitrag ist (**Familienbeitrag ohne Angehörige**: keine Angehörigen mehr oder alle treten aus; „ab“ ist dann der Zeitraum nach dem letzten Austritt). Die Liste nennt Anlass, bisherigen und neuen Beitrag und Datum. **Umstellen** schaltet ab dem nächsten Zeitraum auf den neuen Beitrag, **So belassen** merkt sich die Entscheidung. Bis dahin läuft der bisherige Beitrag weiter.

### Reiter „Auswertung“ {#mv-auswertung}

Zahlen für den Vorstand und die Verbände. Das **Stichtag**-Feld oben bestimmt, für welchen Tag die Zahlen gelten.

#### Kacheln, Abteilungen, Ein- und Austritte

![Mitglieder am Stichtag, Durchschnittsalter und Geschlecht.](bild: seite=mv-auswertung; ziel=#mvBody > div:nth-child(2))

![Abteilungen sowie Ein- und Austritte je Jahr.](bild: seite=mv-auswertung; ziel=#mvBody > .mv-two)

- **Kacheln:** Mitglieder am Stichtag, Durchschnittsalter und Geschlecht.
- **Abteilungen:** Mitglieder je Abteilung.
- **Ein- und Austritte:** je Jahr mit Saldo, dazu „Austritt angekündigt“.

#### Bestandserhebung (Landessportbund)

![Die Bestandserhebung für den Landessportbund.](bild: seite=mv-auswertung; ziel=#mvBody > div:nth-child(4))

Die Tabelle nach Altersgruppe und Geschlecht, wie sie der Landessportbund verlangt. „Excel zum 01.01.“ lädt sie als Datei. Mitglieder ohne Geburtsdatum zählt Clubwerk nicht mit. Der Hinweis nennt sie mit Namen (Klick öffnet das Mitglied), „In der Liste anzeigen“ zeigt genau diese Mitglieder in der Mitgliederliste.

#### Runde Geburtstage & Jubiläen

![Runde Geburtstage und Jubiläen der nächsten zwölf Monate.](bild: seite=mv-auswertung; ziel=#mvBody > div:nth-child(5))

Die Anlässe der nächsten zwölf Monate mit Datum und Jahren. Die Planung dazu steht im Reiter „Gratulationen“.

#### Einwilligungen

![Wie viele Mitglieder den Einwilligungen zugestimmt haben.](bild: seite=mv-auswertung; ziel=#mvBody > div:nth-child(6))

Zeigt je Einwilligung (z. B. Fotos), wie viele zugestimmt haben und wie viele nicht. „Liste (Excel)“ lädt die Namen herunter, z. B. für den Pressewart.

### Reiter „Einstellungen“ {#mv-einstellungen}

Die Karten stehen untereinander; jede hat ihr eigenes „Speichern“.

#### Mitgliedschaft

![Karte „Mitgliedschaft“.](bild: seite=mv-einstellungen; ziel=[data-set="mitgliedschaft"])

- **Mitgliedsnummern ab:** die erste automatisch vergebene Nummer.
- **Neue Nummer:** „ab dem Startwert“ vergibt nie eine Nummer unter dem Startwert; „nach höchster Nummer“ vergibt die höchste vorhandene Nummer plus 1, auch wenn der Startwert höher oder niedriger liegt (praktisch nach einem Import mit eigenen Nummern). Eine schon vergebene Nummer bekommt in beiden Fällen nie jemand zweimal. Verglichen wird der Zahlenteil: „007“ zählt als 7, Nummern ohne Ziffern werden übersprungen.
- **Beitragsjahr beginnt am 1.:** der Monat, mit dem euer Beitragsjahr anfängt – der Zeitraum der Mitgliedsbeiträge.
- **Geschäftsjahr beginnt am 1.:** der Monat, mit dem euer Geschäftsjahr anfängt (meist Januar). Es gilt für Kündigungen, Jahresauswertungen (z. B. „eingegangen“ unter Beiträge & Zahlungen) und DATEV und ist dasselbe Feld wie unter Einstellungen › Buchführung. Beitragsjahr und Geschäftsjahr dürfen verschieden sein, etwa Beiträge Mai bis April und Geschäftsjahr Januar bis Dezember.
- **Kündigungsfrist (Monate):** Grundlage für den frühesten Austrittstermin; ausgetreten wird zum Ende des Geschäftsjahres.
- **Lastschrift ist Pflicht:** Neue Mitglieder brauchen dann Bankverbindung und SEPA-Mandat, „Rechnung“ und „bar“ sind nicht mehr wählbar. Ausgenommen sind Familienmitglieder und wer über einen Zahler zahlt. Bestehende Mitglieder mit anderer Zahlart erscheinen unter „Mit Hinweis“.
- **Ein- und Austritte der Abteilungsleitungen bestätigt die Vereinsverwaltung:** Meldet eine Abteilungsleitung ein neues Mitglied, einen Austritt oder eine Rückkehr, landet das unter „Anträge“ und gilt erst nach Bestätigung durch einen Admin.

#### Beitrittserklärung & Online-Antrag

![Karte „Beitrittserklärung & Online-Antrag“.](bild: seite=mv-einstellungen; ziel=[data-set="antrag"])

Hier schaltet ihr ein, wo man Mitglied werden kann: **am Tablet** („Mitglied werden“) und **online** über die Adresse der Mitglieder-App. Außerdem:

- **Begrüßung** oben im Formular, **Hinweis zu Beitrag & Fälligkeit**, **Hinweis Arbeitseinsatz** und ein **Link zur Satzung**.
- **Einwilligungen:** je Zeile Kurzname, Text auf dem Formular und „Pflicht“. „+ Einwilligung“ legt eine an; „+ Vorlage …“ bietet übliche Texte (Fotos, Presse & Aushang, Geburtstag im Vereinsheft) zum Anpassen an. Erst mit „Speichern“ gelten Änderungen.

![Die Vorlagen für Einwilligungen.](bild: seite=mv-einstellungen; klick=#eConsTpl; ziel=dialog)

#### Willkommens-E-Mail

![Karte „Willkommens-E-Mail“.](bild: seite=mv-einstellungen; ziel=#eWel)

Betreff und Text der Mail, die neue Mitglieder bekommen – beim Annehmen einer Beitrittserklärung, beim Anlegen mit dem Häkchen und über den Knopf am Mitglied. Die **Platzhalter** setzt ihr per Klick an der Schreibstelle ein: {Vorname}, {Nachname}, {Mitgliedsnummer}, {Verein}, {Eintritt}, {Beitrag}. Unbekannte Platzhalter meldet Clubwerk, bevor gespeichert wird; Betreff und Text dürfen nicht leer sein. **Vorschau …** zeigt die Mail mit Beispielwerten. Bei Lastschrift hängt Clubwerk Mandatsreferenz und Gläubiger-ID immer selbst an – dieser Teil lässt sich nicht ändern. **Standardtext wiederherstellen …** setzt den mitgelieferten Text wieder ein. Der Text wird nicht übersetzt; er geht so hinaus, wie ihr ihn schreibt. Jede Änderung steht mit Vorher und Nachher im Protokoll.

#### Austrittsbestätigung

![Karte „Austrittsbestätigung“.](bild: seite=mv-einstellungen; ziel=#eAus)

Betreff und Text der Mail, die ein Mitglied zum Austritt bekommt – wenn ihr einen Austritt eintragt, eine Kündigung aus der Mitglieder-App bestätigt oder einen Austritt der Abteilungsleitung bestätigt. **Platzhalter:** {Vorname}, {Nachname}, {Mitgliedsnummer}, {Verein}, {Austritt} (Austrittsdatum), {Kündigungseingang} und {Personen} (alle, die mit austreten, z. B. „Anna und Max Beispiel“). Vorschau, Prüfung der Platzhalter, „Standardtext wiederherstellen …“ und Protokoll wie bei der Willkommens-E-Mail. Im Austritt-Fenster entscheidet ihr jedes Mal, ob dieser Text geht, ob ihr ihn vorher anpasst oder ob keine E-Mail geht.

#### „Meine Daten“ in der App

![Karte „Meine Daten“ in der App.](bild: seite=mv-einstellungen; ziel=#eApp)

Legt fest, was Mitglieder in der App **sehen** (Beitrag, Posten, Anschrift, Kontakt, Geburtsdatum, Bankverbindung, Einwilligungen) und was sie **ändern** oder anfordern dürfen (Anschrift, Kontakt, Bankverbindung, Einwilligungen, Kündigung, Mitgliedsbescheinigung, Namensänderung). Änderungen an Daten bestätigt immer der Vorstand. Sind die Einwilligungen in der App ausgeblendet, widerrufen Mitglieder sie formlos beim Vorstand.

#### Bescheinigung für die Krankenkasse

![Karte „Bescheinigung für die Krankenkasse“ mit dem Vereinsstempel.](bild: seite=mv-einstellungen; ziel=#eStamp)

Hier ladet ihr einmal den **Vereinsstempel** hoch (PNG oder JPG, höchstens 2 MB; am besten ein eingescannter Stempel als PNG mit durchsichtigem Hintergrund). Er kommt auf jede Mitgliedsbescheinigung, weil manche Krankenkassen einen Stempel verlangen. „Anderen Stempel hochladen …“ ersetzt ihn, „Entfernen“ löscht ihn – dann lassen sich keine Bescheinigungen mehr unterschreiben. Ob Mitglieder die Bescheinigung in der App anfordern dürfen, legt ihr bei „Meine Daten“ in der App fest.

#### Mitgliedsausweis

![Karte „Mitgliedsausweis“ in den Einstellungen.](bild: seite=mv-einstellungen; ziel=#eAusweis)

**Mitgliedsausweis in der App anbieten** schaltet den Ausweis für alle Mitglieder ein. Jeder Ausweis hat einen signierten QR-Code. Er liegt auf dem Handy und geht auch ohne Netz; der Code gilt 30 Tage, dann holt die App mit Netz einen neuen. Name oder Geburtsdatum stehen nicht im Code.

- **Foto auf dem Ausweis:** „wenn das Mitglied es für den Ausweis wählt“ oder „nie“.
- **Gültig bis:** Ende des Beitragsjahres oder des Geschäftsjahres. Bei einer Kündigung gilt der Ausweis nur bis zum Austrittstag.
- **Auf dem Ausweis zeigen:** Abteilungen, Altersstufe (die Beitragsart) und „Mitglied seit“.
- **Alle Ausweise sperren …** macht alle bisherigen Codes sofort ungültig; jedes Handy holt beim nächsten Öffnen einen neuen Ausweis.
- **Schlüssel wechseln …** erzeugt einen neuen Signaturschlüssel. Bisherige Codes gelten bis zu ihrem Ablauf weiter. Der Schlüssel liegt im Tresor; ist der Tresor nach einem Neustart gesperrt, gelten die Ausweise weiter, nur neue warten, bis sich ein Admin anmeldet.

Prüfen können Mitglieder, denen ihr unter **Mitglieder-App** beim Mitglied den Schalter **Ausweise prüfen** gebt (Bereich „Meine Daten“), zum Beispiel Thekendienst oder Trainer. Prüfungen werden nicht gespeichert.

#### Benachrichtigungen

![Karte „Benachrichtigungen“.](bild: seite=mv-einstellungen; ziel=[data-set="benachrichtigung"])

Die E-Mail-Adressen (mit Komma getrennt), die über neue Anträge und App-Änderungen informiert werden.

#### Gratulationen

![Karte „Gratulationen“ mit den Regeln.](bild: seite=mv-einstellungen; ziel=#eCg)

Die Regeln: je Zeile **Anlass** (Geburtstag, Vereinsjubiläum, Abteilungsjubiläum), **Wann** in Jahren („70, 75, ab 80“ heißt: mit 70, 75 und ab 80 jedes Jahr) und **Was** (z. B. „Blumen“). Darunter stellt ihr ein, wie viele Tage vorher erinnert wird, und seht, wer erinnert wird.

#### Datenschutz & Aufbewahrung

![Karte „Datenschutz & Aufbewahrung“.](bild: seite=mv-einstellungen; ziel=[data-set="daten"])

Nach dem Austritt braucht der Verein Name und Anschrift meist nur noch kurz. Mit **Erinnern nach … Jahren** meldet Clubwerk Mitglieder, die so lange ausgetreten sind, und bietet **Liste ansehen …** an. Dort könnt ihr alle ohne offene Forderung auf einmal **anonymisieren** (zur Bestätigung ANONYMISIEREN eintippen). Beträge und Buchungen bleiben für die gesetzliche Aufbewahrung (Belege 8 Jahre, Bücher 10 Jahre).

#### Einstellungen übertragen

Exportiert Einstellungen, Beitragsarten und Abteilungen als Datei und liest sie in einer anderen Clubwerk-Installation ein (ohne Mitglieder). Beim Import werden gleichnamige Einträge (ohne Groß-/Kleinschreibung) aktualisiert, neue angelegt, nichts wird gelöscht. Die Meldung nennt je Art, wie viele neu und wie viele aktualisiert wurden.

### Menü „Beiträge & Zahlungen“ {#zahlungen}

Dieser zweite Menüpunkt gehört zum Modul und erscheint nur mit dem Recht „Einzug“. Oben auf jeder Seite stehen **vier Kacheln**:

![Die Kacheln: offen, davon überfällig, im Einzug und eingegangen im laufenden Jahr.](bild: seite=mv-beitraege; ziel=.kpis)

**Offen** (alle unbezahlten Posten), **davon überfällig**, **im Einzug** (in einer eingereichten Lastschrift) und **eingegangen** im laufenden Jahr. Der übliche Weg: Beitragslauf, Lastschrift erstellen und bei der Bank einreichen, Zahlung buchen, bei Bedarf mahnen.

### Reiter „Beitragslauf“ {#mv-beitraege}

![Die Karte „Beitragslauf“ mit der Vorschau darunter.](bild: seite=mv-beitraege; klick=#rPrev; ziel=#fBody)

Der Beitragslauf erzeugt die Beiträge als **offene Posten**: für alle Mitglieder, anteilig nach Eintritt, jeden Zeitraum nur einmal. Ihr wählt:

- **Abrechnen bis:** der Stichtag (vorgeschlagen ist heute).
- **Nur Zahlungsart:** alle oder nur Lastschrift, Rechnung oder bar.
- **Verkauf mit abbuchen:** nimmt die offenen Verkaufskonten der Mitglieder mit (nur mit dem Modul Verkauf).
- **Nicht geleistete Arbeitsstunden mit abrechnen:** nur mit dem Modul „Dienste & Termine“.

**Vorschau** zeigt, was entstünde: je Zahler die Positionen mit Art, Fälligkeit und Betrag, Summe und Warnungen (z. B. fehlende Angaben). Beitragsfreie Zeiträume im Eintrittsjahr nennt ein Hinweis mit dem Tag, ab dem der Beitrag folgt; mit einem Stichtag im nächsten Beitragsjahr seht ihr diese Beiträge schon in der Vorschau. Mit den Häkchen nehmt ihr einzelne Positionen heraus. Mitglieder mit ungültigem Zahlungsweg (Kreis) überspringt der Lauf; die Warnung nennt sie, bis sie repariert sind. **Beiträge abrechnen** erzeugt die Posten. Danach führt „Weiter zum Einzug“ zu den Lastschriften; wer per Rechnung oder bar zahlt, bekommt seine Rechnung unter „Rechnungen & Mahnungen“.

#### Bisherige Läufe

Jeder Lauf steht mit Datum, Art, Stichtag, Zahl der Positionen und Summe in der Liste. „Posten“ zeigt die Posten des Laufs. Solange nichts davon eingezogen ist, macht **Lauf zurücknehmen …** ihn rückgängig (auch die Verkaufskonten stehen dann wieder offen).

#### Eintrittsjahr frei: zu weit vermerkt

Diese Karte erscheint nur, wenn ein Beitragslauf früherer Versionen bei „Eintrittsjahr frei“ mehr als das Eintrittsjahr frei vermerkt hat (der Beitrag begann später als der Eintritt). Die Liste nennt je Mitglied („Nachname, Vorname“) den Beitrag, den Eintritt, bis wann frei vermerkt wurde und ab wann wieder berechnet wird. Von selbst ändert sich nichts. **Korrigieren** setzt „abgerechnet bis“ nach einer Rückfrage auf das Ende des Eintrittsjahres zurück und trägt das im Verlauf des Mitglieds und im Protokoll ein. Die Beiträge entstehen erst im nächsten Beitragslauf, mit Vorschau. Berücksichtigt werden nur Zeiträume, die ein Beitragslauf von Clubwerk ohne Posten vermerkt hat und die danach niemand mit „Abgerechnet bis für alle setzen“ geändert hat.

#### „Abgerechnet bis“ für alle setzen

![Vorschau „Abgerechnet bis“ mit Zahlen, Hinweisen und Liste.](bild: seite=mv-beitraege; klick=#bkPrev; ziel=#bkOut)

Für den Umstieg aus einem anderen Programm: Wurden die Beiträge bis zu einem Tag schon dort abgerechnet oder eingezogen (dort oft „gebucht bis“), tragt ihr das hier für alle auf einmal ein. Der nächste Beitragslauf berechnet diese Zeit dann nicht noch einmal. Es entstehen **keine Posten**, und vorhandene Posten bleiben, wie sie sind – nur der Stand „abgerechnet bis“ ändert sich.

- **Abgerechnet bis:** vorgeschlagen ist das Ende des letzten Beitragsjahres.
- **Beitragsarten** und **Abteilungen:** nichts angehakt heißt alle. Zusatzbeiträge der Abteilungen zählen mit (auch die von Familienangehörigen, die das Oberhaupt zahlt).
- **Auch zurücksetzen:** Normalerweise geht der Stand nur vorwärts. Mit diesem Häkchen wird er genau auf das Datum gesetzt, auch wenn schon später abgerechnet ist. Dann berechnet der nächste Lauf die Zeit danach noch einmal – Vorsicht, sonst zahlen Mitglieder doppelt. Hinter Posten, die Clubwerk selbst schon berechnet hat, geht es nie zurück.

**Vorschau** zeigt, wie viele Zuordnungen bei wie vielen Mitgliedern sich ändern, von welchem auf welches Datum, wer übersprungen wird (schon später abgerechnet, ausgetreten, beginnt erst später, befreit, über die Familie abgedeckt, ohne Beitrag) und wie viel ein Beitragslauf bis zum Datum dadurch nicht mehr berechnet. Hinweise warnen, wenn das Datum in der Zukunft oder mitten in einem Beitragszeitraum liegt. Die Listen klappt ihr auf oder holt sie mit **Liste als Excel**.

**Setzen …** öffnet die Sicherheitsabfrage: ihr tippt **SETZEN** ein und bestätigt mit eurem **eigenen Passwort**. Hat sich seit der Vorschau etwas geändert, verlangt Clubwerk eine neue Vorschau. Das dürfen nur Benutzer mit dem Recht „Beitragslauf, Lastschriften …“.

Unter **Bisherige Änderungen „abgerechnet bis“** steht jede Änderung. Die letzte lässt sich mit **Zurücknehmen …** (mit Passwort) rückgängig machen, solange danach kein Beitragslauf gelaufen ist; was jemand seitdem einzeln geändert hat, bleibt. Ein Beitragslauf von **vor** einer solchen Änderung lässt sich erst zurücknehmen, wenn die Änderung zurückgenommen ist. Jede Änderung steht im Protokoll, in der Historie der Mitglieder und im Änderungsjournal (Buchführung).

### Reiter „Lastschriften“ {#mv-einzug}

#### Neuer Einzug

![Karte „Neuer Einzug“ nach „Prüfen“.](bild: seite=mv-einzug; klick=#kPrev; ziel=#fBody > div:nth-child(1))

Ein Einzug fasst die fälligen Posten je Zahler zu **einer Lastschrift** zusammen. Erst- und Folgelastschriften trennt Clubwerk selbst. Ihr wählt den **Einzugstag**; vorgeschlagen ist der früheste Tag, der die Frist für die Vorabinformation einhält (ein späterer geht immer). **Prüfen** zeigt, was eingezogen wird: Zahler, Konto, Mandat, Art (Erst/Folge), Posten und Betrag. Häkchen nehmen einzelne Zahler heraus. Rote und gelbe Hinweise nennen, was nicht geht: kein Bankarbeitstag, zu früh, Zahler ohne gültiges Mandat, Posten erst nach dem Einzugstag fällig. Zahler mit Rechnung oder bar tauchen hier nicht auf. **Einzug erstellen** legt den Einzug an und öffnet ihn.

#### Einzüge

![Die Liste der Einzüge.](bild: seite=mv-einzug; ziel=#fBody > div:nth-child(3))

In der Liste stehen Termin, Status (erstellt, verbucht, verworfen), Zahl der Lastschriften, Summe und ob die Vorabinformation raus ist. **Details** öffnet den Einzug:

- **SEPA-Datei herunterladen:** die Datei (pain.008.001.08) lädt ihr im Online-Banking unter „Sammellastschrift / SEPA-Datei hochladen“ hoch.
- **Vorabinformation per E-Mail:** schickt jedem Zahler Betrag, Termin, Mandatsreferenz und Gläubiger-ID. Wer keine E-Mail hat, bekommt per **Briefe für Mitglieder ohne E-Mail** ein PDF zum Ausdrucken.
- **Rücklastschrift:** je Zahler erfasst ihr sie mit Grund, Gebühr zum Weiterberechnen und auf Wunsch gleich der Sperre des Mandats. Die Posten werden wieder offen, die Gebühr kommt als Posten dazu. Nach zwei Rücklastschriften wird der Zahler nicht mehr eingezogen; er zahlt dann per Überweisung und wird gemahnt.
- **Zahlung erfolgt:** bucht alle Lastschriften ohne Rücklastschrift als bezahlt. Erst tun, wenn nichts mehr zurückkommt (meist nach 1–2 Wochen). Auf der Übersicht erinnert Clubwerk daran.
- **Verwerfen:** nur, wenn die Datei **nicht** bei der Bank eingereicht wurde. Die Posten werden wieder offen, auf Wunsch wird der Lauf mit zurückgenommen.

Darunter stehen die Zahler des Einzugs (Name, E-Mail, Posten, Betrag) mit dem Knopf **Rücklastschrift**:

![Das Fenster „Rücklastschrift erfassen“.](bild: seite=mv-einzug; klick=[data-kopen]; klick2=[data-ret]; ziel=dialog)

#### Verkauf einziehen

![Die Karte „Verkauf einziehen“.](bild: seite=mv-einzug; ziel=#fBody > div:nth-child(2))

Nur mit dem Modul Verkauf. Zieht die offenen Verkaufskonten der Mitglieder getrennt von den Beiträgen ein, jederzeit und in einem Ablauf bis zur SEPA-Datei. Das Fenster zeigt, wer per Lastschrift zahlt und wer nicht (mit dem Grund und dem, was ihr tun könnt, z. B. bar kassieren). Die Konten gelten damit als abgerechnet. Denselben Weg gibt es im Verkauf unter „Abrechnung“.

### Reiter „Offene Posten“ {#mv-posten}

![Die Filter „Offen“, „Überfällig“, „Im Einzug“, „Bezahlt“ und „Alle“ über der Liste.](bild: seite=mv-posten; klick=[data-f="ueber"]; ziel=.filterbar)

Alle Forderungen und Gutschriften der Mitglieder mit ihrem Stand. Oben filtern die Chips **Offen**, **Überfällig**, **Im Einzug**, **Bezahlt** und **Alle**; rechts steht Zahl und Summe. In der Liste: Zahler, Position, Fälligkeit, Art (Beitrag, Verkauf, Arbeitsstunden, Aufnahme, Rücklastschrift, Mahngebühr, Sonstiges), Status und Betrag. Ein roter Status nennt die Mahnstufe; „Mahnsperre“ zeigt eine Sperre. Dieselbe Liste steht beim Zahler im Reiter „Zahlung & Familie“ (Karte „Forderungen & Zahlungen“).

![Das Fenster „Zahlung erfassen“.](bild: seite=mv-posten; klick=[data-f="ueber"]; klick2=[data-cpay]; ziel=dialog)

- **Bezahlt:** erfasst eine Zahlung mit Betrag, Datum und Zahlungsweg (Überweisung, bar, Lastschrift, verrechnet). Zahlt jemand weniger, ist es eine **Teilzahlung**, der Rest bleibt offen.
- **Ändern:** Text, Betrag und Fälligkeit ändern; außerdem **Posten stornieren …** und die **Mahnsperre** für diesen Posten.
- **Stornieren** (bei bezahlten Posten): mit Grund. Bei einem Beitrag könnt ihr den Zeitraum beim nächsten Beitragslauf neu abrechnen lassen. Weil das Geld schon beim Verein ist (Kontoauszug, Lastschrift, bar oder Überweisung), wählt ihr, ob es als Guthaben bleibt oder zurücküberwiesen wurde.
- **+ Forderung** (oben rechts) legt einen neuen Posten an:

![Das Fenster „Forderung anlegen“.](bild: seite=mv-posten; klick=#cNew; ziel=dialog)

Ihr wählt das Mitglied, tragt Text, Betrag (mit Minus als Gutschrift), Fälligkeit und Art ein. Für Angehörige landet die Forderung beim Zahler. Verkaufsbeträge besser im Verkauf unter „Abrechnung“ auf das Konto buchen.

Der Filter **Im Einzug** zeigt Posten in einer eingereichten Lastschrift. Dort markiert ihr sie und bucht **Zahlung erfolgt** mit dem Datum der Gutschrift. Zahlungseingänge ordnet der Kontoauszug den Posten zu (siehe Kern-Anleitung).

### Reiter „Rechnungen & Mahnungen“ {#mv-mahnung}

![Rechnungen und Mahnungen: wer jetzt dran ist.](bild: seite=mv-mahnung; ziel=#fBody)

Der Reiter hat vier Teile. Oben warnt ein Kasten, wenn der letzte Kontoauszug älter als 7 Tage ist oder Buchungen noch keinem Posten zugeordnet sind. Dann zuerst den Kontoauszug einlesen, sonst bekommt jemand eine Mahnung, der schon gezahlt hat.

#### Rechnungen

Für Zahler mit **Rechnung oder bar** (und Zahler, die nach zwei Rücklastschriften nicht mehr eingezogen werden). Je Zahler stehen Zahl der Posten und Betrag in der Liste. „PDF“ zeigt die Rechnung, **Ausgewählte per E-Mail senden** verschickt sie mit dem PDF.

Rechnungen und Mahnungen tragen neben der Bankverbindung einen **QR-Code für die Banking-App**. Wer ihn scannt, hat Empfänger, IBAN, Betrag und Rechnungsnummer schon ausgefüllt. Weil die Rechnungsnummer so unverändert im Verwendungszweck steht, ordnet der Kontoauszug die Zahlung sicher zu.

#### Mahnungen – jetzt fällig

Der Mahnlauf: Clubwerk zeigt, wer jetzt ein Schreiben bekommt, mit der **Stufe je Posten** (z. B. Zahlungserinnerung, 1. Mahnung, 2. Mahnung), Fälligkeit, Zahl der Posten, offenem Betrag und Gebühr. Ihr haltet Häkchen und wählt:

- **E-Mails senden:** das Schreiben geht als PDF an alle mit E-Mail-Adresse.
- **Briefe als PDF:** ein Sammel-PDF für alle ohne E-Mail. Danach fragt Clubwerk, ob die Briefe gedruckt sind.

Erst nach dem Versand (bzw. nach „Briefe gedruckt“) bucht Clubwerk Stufe und Gebühr. Hat sich zwischendurch etwas geändert (z. B. eine Zahlung), wird dieser Zahler übersprungen und genannt. Zahler mit Lastschrift-Mandat werden nicht gemahnt; ihre Posten kommen in den nächsten Einzug.

#### Letzte Mahnung ohne Zahlung

Wer die letzte Stufe erreicht hat und dessen Frist abgelaufen ist, steht hier. Was dann geschieht, entscheidet der Vorstand; „Öffnen“ springt zum Mitglied.

#### Mahnsperren

Alle gesetzten Sperren mit Grund und Datum. „Aufheben“ nimmt eine Sperre zurück. Gesetzt werden sie beim Zahler (Reiter „Zahlung & Familie“) oder am einzelnen Posten.

### Reiter „Kontoauszug“ {#mv-kontoauszug}

Der Kontoauszug liest die Bankumsätze ein und ordnet sie den offenen Posten zu, auch Rücklastschriften. Er gehört zum Kern von Clubwerk; die Anleitung dazu steht dort. Hier zeigen die Mahnungen und die Posten an, ob der Kontoauszug aktuell ist.

### Reiter „Einstellungen“ (Beiträge & Zahlungen) {#mv-zeinst}

#### Lastschrift (SEPA)

![Karte „Lastschrift (SEPA)“.](bild: seite=mv-zeinst; ziel=[data-set="sepa"])

- **Name als Zahlungsempfänger** und die **Vereinsanschrift** (diese ändert ihr unter Einstellungen › Verein).
- **Gläubiger-ID:** bekommt der Verein von der Bundesbank.
- **Mandatsreferenz = Kürzel + Nr.:** das Kürzel ist der Anfang jeder Mandatsreferenz; dahinter steht die Mitgliedsnummer.
- **Vorabinformation (Tage vorher):** so früh kündigt ihr die Lastschrift an. Davon hängt der früheste Einzugstag ab.
- **Verwendungszweck der Lastschrift:** Vorlage für den Text auf dem Kontoauszug des Mitglieds (höchstens 140 Zeichen). Platzhalter: {Jahr}, {Posten} (die Beitragsarten ohne Zeitraum, z. B. „Erwachsene, Tennis“), {Nr} (Mitgliedsnummer), {Name}, {Verein}. Leer bleibt die Vorgabe „Mitgliedsbeitrag {Jahr}: {Posten} · Mitgl.-Nr. {Nr}“. Die Vorlage gilt, wenn ein Beitrag in der Lastschrift steckt; der Verkaufs-Einzug nennt nur die Posten.
- **Konto für Lastschriften:** eines der Vereinskonten (Einstellungen › Bankkonten); sonst das Standardkonto.
- **Verkaufs-Einzug üblich am:** Tag und Monat für den Einzug der Verkaufskonten.
- **Gebühr Rücklastschrift:** der Betrag, den ihr bei einer Rücklastschrift weiterberechnet.

Fehlt der BIC beim Vereinskonto, weist Clubwerk darauf hin: Das ist erlaubt, manche Banken verlangen ihn aber.

#### Rechnungen

![Karte „Rechnungen“.](bild: seite=mv-zeinst; ziel=[data-set="rechnung"])

Ein **Zusatz** erscheint auf Rechnungen und Mahnungen, z. B. Steuernummer oder Vereinsregister.

#### Mahnungen

![Eine Mahnstufe mit Bezeichnung, Tagen, Gebühr und Text.](bild: seite=mv-zeinst; ziel=#eLv > div:nth-child(1))

Die **Zahlungsfrist** in den Schreiben (Tage) und bis zu fünf **Mahnstufen**. Je Stufe: **Bezeichnung**, **Tage** (die erste kommt so viele Tage nach der Fälligkeit, jede weitere so viele Tage nach der vorigen), **Gebühr** (fällt einmal je Schreiben an) und der **Text**. Im Text ersetzt Clubwerk `{name}`, `{betrag}` (offen gesamt) und `{frist}`. „+ Stufe“ fügt eine hinzu, „Letzte Stufe entfernen“ nimmt die letzte weg.

#### Einstellungen übertragen

Wie im Reiter „Einstellungen“ unter „Mitglieder“: die Einstellungen als Datei sichern oder in einer anderen Installation einlesen.

## Tablet und App {#tablet-app}

![„Meine Daten“ in der Mitglieder-App.](bild: app=mitglieder)

![Der Reiter „Mitglied werden“ am Tablet.](bild: tablet=Mitglied werden; hoehe=430)

**In der App** („Meine Daten“, oben rechts über den Profil-Knopf unter „Mein Konto“) sieht jedes Mitglied seine Mitgliedschaft mit Beiträgen und Abteilungen, die Familie, seine Zahlungen mit Stand (offen, wird abgebucht, bezahlt), Anschrift, Kontakt und Bankverbindung. Was sichtbar ist und was geändert werden darf, legt ihr unter „Einstellungen“ fest. Das Mitglied kann:

- **Kontaktdaten ändern.** Der Vorstand bestätigt die Änderung. Eine neue E-Mail-Adresse bestätigt das Mitglied mit seiner PIN.
- **Eine Namensänderung melden** („Mein Name hat sich geändert“ in der Karte „Kontakt“), etwa nach Hochzeit oder Scheidung: neuer Vor- und Nachname. Der Vorstand bestätigt die Änderung, bis dahin steht oben „Beim Vorstand in Bearbeitung: Namensänderung“. Das gilt für jedes Mitglied selbst, auch für Familienmitglieder.
- **Eine neue Bankverbindung** auf dem Handy per Unterschrift als neues SEPA-Mandat erteilen. Der Vorstand übernimmt es.
- **Einwilligungen** erteilen oder widerrufen (gilt sofort, mit PIN).
- **Die Datenauskunft** anfordern: Sie kommt als PDF per E-Mail.
- **Eine Mitgliedsbescheinigung** anfordern (Karte „Bescheinigung für die Krankenkasse“): Jahr wählen (laufendes oder voriges, soweit man da Mitglied war) und auf Wunsch einen Hinweis schreiben, etwa den Namen der Krankenkasse. Das Familienoberhaupt kann sie auch für die Familienmitglieder anfordern. Die Karte zeigt, ob sie beim Vorstand liegt, fertig ist (mit „Ansehen“) oder abgelehnt wurde (mit Grund). Ist sie fertig, kommt eine Push-Nachricht, wenn der Verein das freigegeben hat.
- **Überweisen:** Wer per Rechnung oder bar zahlt oder eine Mahnung bekommen hat, findet unter „Zahlungen“ den Knopf „Überweisen“. Er zeigt einen QR-Code für die Banking-App und Empfänger, IBAN, Betrag und Verwendungszweck zum Kopieren. Offene Posten ohne Rechnungsnummer bekommen dabei eine, damit der Kontoauszug die Zahlung erkennt. Wer per Lastschrift zahlt, sieht den Knopf nicht.
- **Kündigen**, wenn das erlaubt ist. Die App nennt den frühesten Austrittstermin; Familien wählen, wer mit kündigt.

Unterschriften, Kündigung und Änderungen, die Geld oder E-Mail betreffen, verlangen die PIN des Mitglieds.

![Das Fenster „Neue Bankverbindung“ mit Unterschriftsfeld.](bild: app=mitglieder; klick=#mdBank)

![Das Blatt „Bescheinigung anfordern“ mit Jahr und Hinweis.](bild: app=mitglieder; klick=#mdCert)

![Das Blatt „Mein Name hat sich geändert“ mit Vor- und Nachname.](bild: app=mitglieder; klick=#mdName)

**Mitgliedsausweis:** Ist er eingeschaltet, hat „Meine Daten“ die Reiter **Mitgliedschaft** und **Ausweis**. Die Karte zeigt Vereinsname, Foto (nur wenn freigegeben), „Nachname, Vorname“, Nummer, „Mitglied seit“, Abteilungen, Altersstufe, Status, „gültig bis“, den QR-Code und eine laufende Uhr mit Sekunden. Uhr und wandernder Glanzstreifen zeigen, dass es kein Bildschirmfoto ist. Die Karte liegt auf dem Handy: Ohne Netz zeigt die Seite „Keine Verbindung“ den Knopf **Mitgliedsausweis zeigen**. In „Für mich“ führt die Zeile **Mitgliedsausweis zeigen** direkt zur Karte. Wer ausgetreten ist, sieht „Deine Mitgliedschaft ist am … beendet“ ohne Code; „Abmelden“ löscht die Karte vom Handy.

![Der Mitgliedsausweis in der App.](bild: app=mitglieder; klick=[data-tab="ausweis"])

**Ausweise prüfen:** Mit dem Schalter „Ausweise prüfen“ kommt der Reiter **Prüfen** dazu. **Kamera starten** und den QR-Code des anderen Handys davor halten. Das Ergebnis steht groß da, mit Symbol und Text: **Gültig** (mit Foto, Name, Nummer, Status, Abteilungen, „gültig bis“), **Abgelaufen**, **Nicht mehr Mitglied**, **Ausweis gesperrt** oder **Ungültiger Code**. Stimmt das Foto mit der Person überein, gilt der Ausweis. Eine Mitgliedsnummer lässt sich bewusst nicht eintippen. Nach vielen ungültigen Codes sperrt die Prüfung eine Weile und der Vorstand bekommt eine Sicherheitswarnung. Die Kamera geht nur, wenn die App über https geöffnet ist (Adresse des Vereins).

![Der Reiter „Prüfen“ in der App.](bild: app=mitglieder; klick=[data-tab="pruefen"])

**Am Tablet** erscheint der Reiter „Mitglied werden“, wenn er eingeschaltet ist. Interessierte füllen die Beitrittserklärung selbst aus und unterschreiben mit dem Finger, oder geben den **Code** der Verwaltung ein. Aus Datenschutzgründen löscht das Tablet nach 4 Minuten ohne Eingabe und 25 Sekunden nach dem Absenden alles. Wer schon Mitglied ist, bucht am Tablet wie bisher mit seiner PIN; die PIN setzt die Verwaltung beim Mitglied zurück.

**Online:** Über die Adresse der Mitglieder-App (`/p/mitglieder/`) gibt es den gleichen Antrag fürs Handy, wenn „Online-Antrag“ eingeschaltet ist.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Mitglieder | Mitglieder sehen und ändern, Anträge und Änderungswünsche bearbeiten, Mitgliedsbescheinigungen unterschreiben (nicht mit „Nur eigene Abteilung(en)“), dazu Beiträge & Abteilungen, Auswertung, Einstellungen, Import, Excel, Datenauskunft, Löschen und Anonymisieren |
| Häkchen „Nur eigene Abteilung(en)“ (in der Rolle) | Zusatz bei „Mitglieder“ für Abteilungsleitungen: nur die eigene Abteilung, nur die Reiter „Mitglieder“ und „Anträge“, am Mitglied ohne „Zahlung & Familie“ und „Konto & Mandat“, ohne Import und Excel |
| Bankdaten | Bankverbindung und SEPA-Mandat vollständig sehen und ändern (sonst ist die IBAN unkenntlich) |
| Einzug | Menü „Beiträge & Zahlungen“: Beitragslauf, Lastschriften, Offene Posten, Rechnungen & Mahnungen, Einstellungen, Forderungen, Mahnsperren |
| Dokumente | Reiter „Dokumente“ am Mitglied: ansehen und hochladen |
| Gratulationen | Reiter „Gratulationen“, Abhaken und Erinnerungen |
| Schalter „Ausweise prüfen“ (Mitglieder-App › Mitglied, Bereich „Meine Daten“) | in der eigenen App Mitgliedsausweise anderer mit der Kamera prüfen – kein Recht in der Verwaltung |

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Verkauf:** Die Mitglieder sind die Personen im Verkauf. Mit diesem Modul liegt die Kontenliste („Konten & PINs“) im Verkauf. Der Beitragslauf kann Verkaufskonten mit abbuchen, „Verkauf einziehen“ zieht sie per Lastschrift ein, die Posten-Art „Verkauf“ gibt es dann. Wer über einen Zahler zahlt, bucht am Tablet auf dessen Namen. Ohne das Modul Verkauf entfallen diese Auswahlen.
- **Dienste & Termine:** Nicht geleistete Arbeitsstunden rechnet der Beitragslauf ab; die Stunden je Beitragsart legt ihr bei der Beitragsart fest.
- **Buchhaltung:** Rechnungen an Mitglieder erscheinen hier als offener Posten (zahlbar per Lastschrift oder Überweisung). Wird der Posten bezahlt oder storniert, übernimmt die Buchhaltung den Stand.
- **Plätze:** Gebühren für Plätze und Gäste werden zu Forderungen und wie ein Beitrag eingezogen. Ämter aus diesem Modul können Rechte beim Platzbuchen bestimmen.
- **Spielbetrieb:** Geburtsjahr und Geschlecht kommen von hier (für Altersklassen).
- **Nachrichten:** Empfänger lassen sich nach Abteilung, Amt oder Beitragsart wählen.
- **Mitglieder-App:** „Meine Daten“, der Mitgliedsausweis (mit der Zeile „Mitgliedsausweis zeigen“ in „Für mich“) und der Online-Antrag. Das Profilbild aus „Mein Konto“ erscheint auf dem Ausweis, wenn das Mitglied „Mitgliedsausweis“ ankreuzt.
- **Kontoauszug und Bankkonten (Kern):** Eingelesene Kontoauszüge buchen Posten als bezahlt und erfassen Rücklastschriften. Das Konto für Lastschriften wählt ihr aus den Bankkonten.
- **Datenschutz (Kern):** Die Datenauskunft sammelt die Daten aller Module. Anonymisierte Mitglieder bleiben in der Statistik, Buchungen laufen unter „Anonym …“.
- **Einrichtung und Übersicht (Kern):** Die Einrichtung führt durch die ersten Schritte. Die Übersicht warnt vor neuen Anträgen, fehlendem Mandat, anstehenden Altersstufen, lange ausgetretenen Mitgliedern und vor Lastschriften, die noch als bezahlt zu buchen sind.
