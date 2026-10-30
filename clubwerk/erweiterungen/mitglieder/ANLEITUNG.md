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
- **Nr.** (die Mitgliedsnummer), **Alter** und **Abteilungen**.
- **Beitrag:** die Beitragsart. Bei Familienmitgliedern steht „Familie“ mit dem Namen des Oberhaupts.
- **Zahlung:** Lastschrift, Rechnung oder bar. Zahlt jemand anderes, steht „über Name“. Ein „+3“ zeigt, für wie viele Angehörige diese Person mitzahlt.
- **Hinweise:** gelbe Markierungen, wo etwas fehlt oder zu prüfen ist, z. B. „Altersstufe prüfen“ oder „Mandat widerrufen“.

Oben seht ihr einen **roten Warnkasten**, wenn Mitglieder Pflichtangaben fehlen (Mitgliedsdaten, Beitrag, Bankverbindung oder SEPA-Mandat). „Anzeigen“ springt in den Filter „Mit Hinweis“. Wer Pflichtangaben fehlen, fehlt im Beitragslauf.

Zum Suchen und Filtern gibt es:

- die **Suche** nach Name, Nummer, E-Mail oder Ort,
- die **Filter** „Aktuell“, „Mit Hinweis“, „Ausgetreten“ und „Alle“ (jeweils mit der Anzahl) sowie je ein Auswahlfeld für **Abteilung** und **Beitrag**.

Ein Klick auf eine Zeile öffnet das Mitglied. „← Alle Mitglieder“ führt zurück, mit den zuletzt gesetzten Filtern.

#### + Neues Mitglied

![Das Fenster „Neues Mitglied“.](bild: seite=mitglieder; klick=#mvNew; ziel=dialog)

Ein Mitglied wird nur **vollständig** angelegt: Name, Geburtsdatum, Eintritt, Anschrift, E-Mail, Handy, Beitrag, Abteilung und Zahlart. Bei Lastschrift gehören Kontoinhaber (Clubwerk schlägt den Namen vor), IBAN und das Datum des SEPA-Mandats dazu. Dazu kommt die **unterschriebene Beitrittserklärung** als PDF oder Foto (Datei wählen oder ins Feld ziehen).

- Die **Mitgliedsnummer** vergibt Clubwerk selbst, wenn das Feld leer bleibt.
- Beim **Beitrag** sind nur die Arten wählbar, die zum Alter passen; die übrigen sind ausgegraut. Dafür zuerst das Geburtsdatum eintragen.
- Ist in den Einstellungen „Lastschrift ist Pflicht“ gesetzt, gibt es nur die Zahlart Lastschrift.
- Soll das neue Mitglied am Tablet unterschreiben, nehmt stattdessen „+ Beitrittserklärung“ im Reiter „Anträge“.

#### Import …

![Das Import-Fenster: erst die Datei wählen.](bild: seite=mitglieder; klick=#mvImp; ziel=dialog)

Der Import übernimmt Mitglieder aus **S-Verein/SPG-Verein**, **WISO Mein Verein**, **verein.cloud** oder einer eigenen Liste (CSV, TXT oder Excel). Er läuft in drei Schritten:

1. **Datei wählen.** Clubwerk erkennt das Programm an den Spaltenköpfen und schlägt vor, welche Spalte wohin gehört. Rechts stehen als Beispiel die Werte einer Person. Wo der Vorschlag nicht passt, stellt ihr die Spalte selbst ein. Unten tragt ihr ein, bis wann die Beiträge im alten Programm schon abgerechnet sind („Beiträge bisher abgerechnet bis“) und ob die SEPA-Mandate schon benutzt wurden. So rechnet der nächste Beitragslauf nichts doppelt ab.
2. **Vorschau.** Kacheln zeigen, wie viele Personen neu angelegt oder ergänzt werden. Darunter prüft ihr, was Clubwerk nicht allein entscheiden kann. Bei „ähnlich benannten“ Abteilungen und Beitragsarten ist die Wahl Pflicht.
3. **Übernehmen.** Vorhandene Personen (auch aus dem Verkauf) erkennt Clubwerk an Nummer oder Namen und ergänzt sie; PINs bleiben erhalten. Zahler und Familien werden verknüpft. „Zurück zur Zuordnung“ geht jederzeit einen Schritt zurück.

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

### Mitglied öffnen {#mitglied}

![Ein geöffnetes Mitglied: oben Name und Eckdaten, darunter „← Alle Mitglieder“ und die Reiter.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detailrow)

Über dem Reiter steht der Name; darunter eine Zeile mit Nummer, Alter, Status, geplantem Austritt, „zahlt über …“ oder „Familie von …“ und dem Hinweis, wenn Änderungswünsche aus der App vorliegen. Die Reiter heißen **Stammdaten**, **Mitgliedschaft**, **Zahlung & Familie**, **Konto & Mandat**, **Dokumente** und **Verlauf**. Wer nur eine Abteilung betreut, sieht nur „Stammdaten“, „Mitgliedschaft“, „Dokumente“ und „Verlauf“.

Fehlen Pflichtangaben, steht oben ein roter Kasten. Bei einer Person, die gar kein Vereinsmitglied ist (etwa ein Trainer), wandelt der Knopf **In „Kein Mitglied“ umwandeln …** sie um. Ihr Konto bleibt im Verkauf, in der Mitgliederliste erscheint sie nicht mehr.

### Mitglied › Stammdaten {#mitglied-stamm}

Der erste Reiter hat drei Karten und darunter einen gemeinsamen „Speichern“-Knopf.

#### Person

![Karte „Person“.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(1))

Anrede, Titel, Vorname, Nachname, Geburtsdatum, Geschlecht (männlich oder weiblich), Mitgliedsnummer und **Status**: aktiv, passiv/fördernd, Ehrenmitglied oder ruhend.

#### Anschrift & Kontakt

![Karte „Anschrift & Kontakt“.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

Straße, PLZ, Ort, Adresszusatz, Land, E-Mail, Mobil, Telefon und die **Briefanrede** (z. B. „Liebe Anna“). Dazu das Eintrittsdatum, die Schlüsselnummer und **Notizen**, die nur der Vorstand sieht.

#### Einwilligungen

![Karte „Einwilligungen“.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(3))

Je Einwilligung ein Häkchen mit Datum („seit …“), z. B. für Fotos. Welche es gibt, legt ihr unter „Einstellungen“ fest.

#### Weitere Karten und Knöpfe

- **Tablet-PIN:** zeigt, ob das Mitglied eine PIN hat. „PIN zurücksetzen“ löscht sie; beim nächsten Mal legt das Mitglied am Tablet eine neue fest.
- **Profilbild:** erscheint, wenn das Mitglied in der App eines hochgeladen hat. „Profilbild entfernen …“ löscht es.
- **Vorsicht:** „Löschen …“ geht nur, wenn nichts mehr am Mitglied hängt (gedacht für versehentlich oder doppelt angelegte). „Anonymisieren …“ gibt es erst nach dem Austritt. Es löscht Name, Anschrift, Konto, Dokumente und Verlauf unwiderruflich; für die Statistik bleiben Geburtsjahr, Geschlecht, Ein- und Austritt und Abteilungen. Zur Sicherheit tippt ihr dabei das Wort ANONYMISIEREN.
- **Datenauskunft** (Knopf rechts in der Reiterzeile): lädt eine Datei mit allem, was Clubwerk über die Person gespeichert hat, auch aus anderen Modulen. Ohne das Recht „Bankdaten“ bleibt die IBAN darin unkenntlich.

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

Der Knopf **Austritt …** rechts in der Reiterzeile trägt den Austritt ein: Datum (vorgeschlagen ist das Ende des Beitragsjahres), Eingang der Kündigung, Grund und auf Wunsch das Kündigungsschreiben als Datei. Ihr entscheidet, ob Beiträge und Abteilungen zum Austritt enden und ob Angehörige mit austreten. Bis zum Austrittstag bleibt alles wie bisher. Danach verschwindet das Mitglied am Tablet und in der App; die Daten bleiben bis zum Anonymisieren. Ein noch nicht wirksamer Austritt lässt sich mit **Austritt zurücknehmen** widerrufen, ein vollzogener mit **Wiedereintritt …** (das Mitglied bekommt eine neue Nummer und braucht bei Lastschrift ein neues Mandat).

### Mitglied › Zahlung & Familie {#mitglied-zahlung}

Hier gibt es zwei **getrennte** Zuordnungen, nebeneinander in zwei Karten.

#### Wer zahlt?

![Karte „Wer zahlt?“ mit der Zahlergruppe.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .mv-two > div:nth-child(1))

Das ist eine reine Geldbeziehung: Beiträge, Zusatzbeiträge und Verkauf laufen über das Konto und Mandat des **Zahlers**. Das kann auch ein Vater für sein erwachsenes Kind sein. Darunter steht die Zahlergruppe. Bei „Verkauf am Tablet“ stellt ihr ein, ob ein Angehöriger am Tablet über den Hauptzahler bucht oder einen eigenen Eintrag hat. Die **Zahlungsart** (Lastschrift, Rechnung, bar) gilt für den Zahler.

#### Familienmitgliedschaft

![Karte „Familienmitgliedschaft“.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .mv-two > div:nth-child(2))

Ein **Oberhaupt** mit Familienbeitrag deckt Partner/in und Kinder ab. Erlaubt sind ein/e Partner/in und beliebig viele Kinder bis 18 Jahre (einstellbar). Wer zugeordnet ist, braucht keine eigene Beitragsart; Zusatzbeiträge der Abteilungen bleiben je Person. Am Oberhaupt fügt ihr Angehörige über „Angehörige/n hinzufügen …“ hinzu; „Lösen“ nimmt sie wieder heraus. Bei einem Angehörigen wählt ihr unter „Familienmitgliedschaft bei“ das Oberhaupt.

#### Forderungen & Zahlungen

![Karte „Forderungen & Zahlungen“ eines Zahlers.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

Alle Posten des Zahlers (Spalten Position, Fällig, Art, Status, Betrag). „Bezahlt“, „Ändern“ und „Stornieren“ wirken hier wie unter „Offene Posten“ (siehe dort). „+ Forderung“ in der Reiterzeile legt einen neuen Posten an, „Rechnung (PDF)“ druckt die offenen Posten als Rechnung.

#### Mahnungen

![Die Karte „Mahnungen“ eines Zahlers mit Mahnhistorie.](bild: seite=mitglieder/mitglied/11; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .card:last-child)

Die bisherigen Mahnschreiben (Datum, Schreiben, Betrag, Gebühr). „Mahnsperre …“ stoppt Mahnungen für alle Posten dieses Zahlers (mit Grund und optionalem Datum, z. B. bei vereinbarter Ratenzahlung). Gab es zwei Rücklastschriften, steht hier der Hinweis, dass der Zahler nicht mehr eingezogen wird; „Wieder einziehen …“ hebt das auf.

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

Hier liegen Beitrittserklärung, SEPA-Mandat, Kündigung, Nachweise und Schriftverkehr als Dateien. Mit **Dokument ablegen** wählt ihr die Art, optional eine Bezeichnung und die Datei (PDF, Foto, Word oder Text, bis 15 MB). In der **Ablage** öffnet „Öffnen …“ die Datei oder löscht sie. Die Dokumente liegen nur auf dem Vereinsrechner und sind in der Datensicherung enthalten. Bei Familienmitgliedern liegen Beitrittserklärung und Mandat beim Oberhaupt.

### Mitglied › Verlauf {#mitglied-verlauf}

![Die Karte „Änderungsverlauf“.](bild: seite=mitglieder/mitglied/7; tab=verlauf; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

Oben steht, ob ein Handy für die Mitglieder-App freigeschaltet ist (und wann es zuletzt benutzt wurde). Darunter der **Änderungsverlauf**: jedes geänderte Feld mit Zeitpunkt, vorher, nachher und wer es geändert hat.

### Reiter „Anträge“ {#mv-antraege}

![Der Reiter „Anträge“ mit einer neuen Beitrittserklärung und zwei Änderungswünschen.](bild: seite=mv-antraege)

Hier laufen Beitrittserklärungen und Änderungswünsche ein. Die Zahl am Reiter zeigt, wie viele auf euch warten. Die Knöpfe oben rechts:

- **Formular (PDF):** das leere Papierformular zum Ausdrucken.
- **Online-Antrag …:** schaltet den Antrag über die Adresse der Mitglieder-App ein und zeigt den Link zum Kopieren (er endet auf `/p/mitglieder/`). Gegen Missbrauch schützen eine Falle für automatische Formulare, eine Mindest-Ausfüllzeit und eine Begrenzung je Gerät und Tag.
- **+ Beitrittserklärung:** ihr erfasst die Daten, das neue Mitglied unterschreibt am Tablet mit einem Code.

#### Beitrittserklärung erfassen

![Das Fenster „Beitrittserklärung erfassen“.](bild: seite=mv-antraege; klick=#aNew; ziel=dialog)

Ihr tragt Personen, Anschrift, Mitgliedschaft und SEPA-Mandat ein. Für eine **Familie** fügt ihr mit „+ Person (Familie)“ Partner/in und Kinder hinzu; dann gilt der Familienbeitrag und der/die Antragsteller/in wird Hauptzahler. Am Ende steht „Code fürs Tablet erzeugen“ (der Code gilt drei Stunden). Am Tablet tippt das neue Mitglied „Mitglied werden“ › „Ich habe einen Code“, prüft seine Daten, setzt die Häkchen für die Einwilligungen und unterschreibt Beitrittserklärung und SEPA-Mandat. Mit dem Häkchen „Nach der Unterschrift sofort als Mitglied übernehmen“ ist es danach gleich angelegt und bekommt eine Willkommens-E-Mail mit Mitgliedsnummer und Mandatsreferenz.

#### Warten auf Bestätigung

Unterschriebene Anträge (vom Tablet oder online) warten hier. „Prüfen & annehmen“ öffnet sie:

![Die Beitrittserklärung zum Prüfen: Personen, Zuordnung zum Bestand und Beitrag.](bild: seite=mv-antraege; klick=[data-ap]; ziel=#dialog .split table)

Zu jeder Person schlägt Clubwerk vor, ob sie **neu angelegt** oder mit einem vorhandenen Mitglied **zusammengeführt** wird (z. B. wenn jemand schon im Verkauf geführt wird), und welcher Beitrag gilt. Rechts im Fenster steht die unterschriebene Erklärung als PDF mit Prüfwert. „Annehmen & Mitglieder anlegen“ legt alles an; „Ablehnen“ lehnt ab (mit internem Grund). Die Abteilungsleitung kann einen Antrag nur befürworten, annehmen muss ihn dann die Vereinsverwaltung.

#### Warten auf Unterschrift am Tablet

Anträge mit Code, die noch nicht unterschrieben sind. „Neuer Code“ erzeugt einen frischen (nach drei Stunden läuft er ab), „Ansehen“ zeigt den Antrag, im Fenster löscht „Antrag löschen …“ ihn.

#### Änderungen & Meldungen

Wünsche aus der Mitglieder-App und Meldungen der Abteilungsleitungen:

- **Datenänderung** (z. B. neue Anschrift): „Übernehmen“ zeigt alt und neu zur Bestätigung, „Ablehnen“ schickt dem Mitglied auf Wunsch eine E-Mail mit Grund.
- **Neue Bankverbindung:** mit der Unterschrift des Mitglieds. Beim Übernehmen entsteht ein neues Mandat (Erstlastschrift); das unterschriebene Mandat wird als PDF abgelegt und dem Mitglied geschickt.
- **Kündigung:** Clubwerk schlägt den frühestmöglichen Austrittstag nach Kündigungsfrist und Beitragsjahr vor, ihr bestätigt oder ändert ihn. Das Mitglied bekommt eine Bestätigung per E-Mail.
- **Ein-, Austritt und Rückkehr in eine Abteilung** meldet die Abteilungsleitung; „Bestätigen“ übernimmt sie.

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
- **Arbeitsstunden im Jahr:** leer = Vorgabe des Moduls „Dienste & Termine“, 0 = keine.
- **Mindest- und Höchstalter:** Hinweis im Beitragslauf und Vorschlag bei neuen Anträgen.
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

Wer älter wird und nicht mehr in seinen Beitrag passt, aus dem Familienbeitrag herauswächst oder in eine höhere Stufe des Zusatzbeitrags kommt, steht hier mit Anlass, bisherigem und neuem Beitrag und Datum. **Umstellen** schaltet ab dem nächsten Zeitraum auf den neuen Beitrag, **So belassen** merkt sich die Entscheidung. Bis dahin läuft der bisherige Beitrag weiter.

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

Die Tabelle nach Altersgruppe und Geschlecht, wie sie der Landessportbund verlangt. „Excel zum 01.01.“ lädt sie als Datei. Mitglieder ohne Geburtsdatum zählt Clubwerk nicht mit und weist darauf hin.

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
- **Beitragsjahr beginnt am 1.:** der Monat, mit dem euer Beitragsjahr anfängt.
- **Kündigungsfrist (Monate):** Grundlage für den frühesten Austrittstermin.
- **Lastschrift ist Pflicht:** Neue Mitglieder brauchen dann Bankverbindung und SEPA-Mandat, „Rechnung“ und „bar“ sind nicht mehr wählbar. Ausgenommen sind Familienmitglieder und wer über einen Zahler zahlt. Bestehende Mitglieder mit anderer Zahlart erscheinen unter „Mit Hinweis“.
- **Ein- und Austritte der Abteilungsleitungen bestätigt die Vereinsverwaltung:** Meldet eine Abteilungsleitung ein neues Mitglied, einen Austritt oder eine Rückkehr, landet das unter „Anträge“ und gilt erst nach Bestätigung durch einen Admin.

#### Beitrittserklärung & Online-Antrag

![Karte „Beitrittserklärung & Online-Antrag“.](bild: seite=mv-einstellungen; ziel=[data-set="antrag"])

Hier schaltet ihr ein, wo man Mitglied werden kann: **am Tablet** („Mitglied werden“) und **online** über die Adresse der Mitglieder-App. Außerdem:

- **Begrüßung** oben im Formular, **Hinweis zu Beitrag & Fälligkeit**, **Hinweis Arbeitseinsatz** und ein **Link zur Satzung**.
- **Einwilligungen:** je Zeile Kurzname, Text auf dem Formular und „Pflicht“. „+ Einwilligung“ legt eine an; „+ Vorlage …“ bietet übliche Texte (Fotos, Presse & Aushang, Geburtstag im Vereinsheft) zum Anpassen an. Erst mit „Speichern“ gelten Änderungen.

![Die Vorlagen für Einwilligungen.](bild: seite=mv-einstellungen; klick=#eConsTpl; ziel=dialog)

#### „Meine Daten“ in der App

![Karte „Meine Daten“ in der App.](bild: seite=mv-einstellungen; ziel=#eApp)

Legt fest, was Mitglieder in der App **sehen** (Beitrag, Posten, Anschrift, Kontakt, Geburtsdatum, Bankverbindung, Einwilligungen) und was sie **ändern** dürfen (Anschrift, Kontakt, Bankverbindung, Einwilligungen, Kündigung). Änderungen an Daten bestätigt immer der Vorstand. Sind die Einwilligungen in der App ausgeblendet, widerrufen Mitglieder sie formlos beim Vorstand.

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

**Vorschau** zeigt, was entstünde: je Zahler die Positionen mit Art, Fälligkeit und Betrag, Summe und Warnungen (z. B. fehlende Angaben). Mit den Häkchen nehmt ihr einzelne Positionen heraus. **Beiträge abrechnen** erzeugt die Posten. Danach führt „Weiter zum Einzug“ zu den Lastschriften; wer per Rechnung oder bar zahlt, bekommt seine Rechnung unter „Rechnungen & Mahnungen“.

#### Bisherige Läufe

Jeder Lauf steht mit Datum, Art, Stichtag, Zahl der Positionen und Summe in der Liste. „Posten“ zeigt die Posten des Laufs. Solange nichts davon eingezogen ist, macht **Lauf zurücknehmen …** ihn rückgängig (auch die Verkaufskonten stehen dann wieder offen).

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
- **Stornieren** (bei bezahlten Posten): mit Grund. Bei einem Beitrag könnt ihr den Zeitraum beim nächsten Beitragslauf neu abrechnen lassen. Kam das Geld laut Kontoauszug an, wählt ihr, ob es als Guthaben bleibt oder zurücküberwiesen wurde.
- **+ Forderung** (oben rechts) legt einen neuen Posten an:

![Das Fenster „Forderung anlegen“.](bild: seite=mv-posten; klick=#cNew; ziel=dialog)

Ihr wählt das Mitglied, tragt Text, Betrag (mit Minus als Gutschrift), Fälligkeit und Art ein. Für Angehörige landet die Forderung beim Zahler. Verkaufsbeträge besser im Verkauf unter „Abrechnung“ auf das Konto buchen.

Der Filter **Im Einzug** zeigt Posten in einer eingereichten Lastschrift. Dort markiert ihr sie und bucht **Zahlung erfolgt** mit dem Datum der Gutschrift. Zahlungseingänge ordnet der Kontoauszug den Posten zu (siehe Kern-Anleitung).

### Reiter „Rechnungen & Mahnungen“ {#mv-mahnung}

![Rechnungen und Mahnungen: wer jetzt dran ist.](bild: seite=mv-mahnung; ziel=#fBody)

Der Reiter hat vier Teile. Oben warnt ein Kasten, wenn der letzte Kontoauszug älter als 7 Tage ist oder Buchungen noch keinem Posten zugeordnet sind. Dann zuerst den Kontoauszug einlesen, sonst bekommt jemand eine Mahnung, der schon gezahlt hat.

#### Rechnungen

Für Zahler mit **Rechnung oder bar** (und Zahler, die nach zwei Rücklastschriften nicht mehr eingezogen werden). Je Zahler stehen Zahl der Posten und Betrag in der Liste. „PDF“ zeigt die Rechnung, **Ausgewählte per E-Mail senden** verschickt sie mit dem PDF.

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

**In der App** („Meine Daten“) sieht jedes Mitglied seine Mitgliedschaft mit Beiträgen und Abteilungen, die Familie, seine Zahlungen mit Stand (offen, wird abgebucht, bezahlt), Anschrift, Kontakt und Bankverbindung. Was sichtbar ist und was geändert werden darf, legt ihr unter „Einstellungen“ fest. Das Mitglied kann:

- **Kontaktdaten ändern.** Der Vorstand bestätigt die Änderung. Eine neue E-Mail-Adresse bestätigt das Mitglied mit seiner PIN.
- **Eine neue Bankverbindung** auf dem Handy per Unterschrift als neues SEPA-Mandat erteilen. Der Vorstand übernimmt es.
- **Einwilligungen** erteilen oder widerrufen (gilt sofort, mit PIN).
- **Die Datenauskunft** anfordern: Sie kommt als PDF per E-Mail.
- **Kündigen**, wenn das erlaubt ist. Die App nennt den frühesten Austrittstermin; Familien wählen, wer mit kündigt.

Unterschriften, Kündigung und Änderungen, die Geld oder E-Mail betreffen, verlangen die PIN des Mitglieds.

![Das Fenster „Neue Bankverbindung“ mit Unterschriftsfeld.](bild: app=mitglieder; klick=#mdBank)

**Am Tablet** erscheint der Reiter „Mitglied werden“, wenn er eingeschaltet ist. Interessierte füllen die Beitrittserklärung selbst aus und unterschreiben mit dem Finger, oder geben den **Code** der Verwaltung ein. Aus Datenschutzgründen löscht das Tablet nach 4 Minuten ohne Eingabe und 25 Sekunden nach dem Absenden alles. Wer schon Mitglied ist, bucht am Tablet wie bisher mit seiner PIN; die PIN setzt die Verwaltung beim Mitglied zurück.

**Online:** Über die Adresse der Mitglieder-App (`/p/mitglieder/`) gibt es den gleichen Antrag fürs Handy, wenn „Online-Antrag“ eingeschaltet ist.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Mitglieder | Mitglieder sehen und ändern, Anträge und Änderungswünsche bearbeiten, dazu Beiträge & Abteilungen, Auswertung, Einstellungen, Import, Excel, Datenauskunft, Löschen und Anonymisieren |
| Häkchen „Nur eigene Abteilung(en)“ (in der Rolle) | Zusatz bei „Mitglieder“ für Abteilungsleitungen: nur die eigene Abteilung, nur die Reiter „Mitglieder“ und „Anträge“, am Mitglied ohne „Zahlung & Familie“ und „Konto & Mandat“, ohne Import und Excel |
| Bankdaten | Bankverbindung und SEPA-Mandat vollständig sehen und ändern (sonst ist die IBAN unkenntlich) |
| Einzug | Menü „Beiträge & Zahlungen“: Beitragslauf, Lastschriften, Offene Posten, Rechnungen & Mahnungen, Einstellungen, Forderungen, Mahnsperren |
| Dokumente | Reiter „Dokumente“ am Mitglied: ansehen und hochladen |
| Gratulationen | Reiter „Gratulationen“, Abhaken und Erinnerungen |

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Verkauf:** Die Mitglieder sind die Personen im Verkauf. Mit diesem Modul liegt die Kontenliste („Konten & PINs“) im Verkauf. Der Beitragslauf kann Verkaufskonten mit abbuchen, „Verkauf einziehen“ zieht sie per Lastschrift ein, die Posten-Art „Verkauf“ gibt es dann. Wer über einen Zahler zahlt, bucht am Tablet auf dessen Namen. Ohne das Modul Verkauf entfallen diese Auswahlen.
- **Dienste & Termine:** Nicht geleistete Arbeitsstunden rechnet der Beitragslauf ab; die Stunden je Beitragsart legt ihr bei der Beitragsart fest.
- **Buchhaltung:** Rechnungen an Mitglieder erscheinen hier als offener Posten (zahlbar per Lastschrift oder Überweisung). Wird der Posten bezahlt oder storniert, übernimmt die Buchhaltung den Stand.
- **Plätze:** Gebühren für Plätze und Gäste werden zu Forderungen und wie ein Beitrag eingezogen. Ämter aus diesem Modul können Rechte beim Platzbuchen bestimmen.
- **Spielbetrieb:** Geburtsjahr und Geschlecht kommen von hier (für Altersklassen).
- **Nachrichten:** Empfänger lassen sich nach Abteilung, Amt oder Beitragsart wählen.
- **Mitglieder-App:** „Meine Daten“ und der Online-Antrag.
- **Kontoauszug und Bankkonten (Kern):** Eingelesene Kontoauszüge buchen Posten als bezahlt und erfassen Rücklastschriften. Das Konto für Lastschriften wählt ihr aus den Bankkonten.
- **Datenschutz (Kern):** Die Datenauskunft sammelt die Daten aller Module. Anonymisierte Mitglieder bleiben in der Statistik, Buchungen laufen unter „Anonym …“.
- **Einrichtung und Übersicht (Kern):** Die Einrichtung führt durch die ersten Schritte. Die Übersicht warnt vor neuen Anträgen, fehlendem Mandat, anstehenden Altersstufen, lange ausgetretenen Mitgliedern und vor Lastschriften, die noch als bezahlt zu buchen sind.
