# Buchhaltung
<!-- kurz: Rechnungen, Spendenquittungen, Ausgaben mit Beleg, Kassenbuch und Einnahmen-Überschuss-Rechnung. -->

## Wofür ist das Modul? {#wofuer}

Die Buchhaltung schreibt Rechnungen an Sponsoren, Firmen und Mitglieder, hält fest, was bezahlt ist, und erinnert per E-Mail an überfällige Beträge. Dazu stellt sie Spendenquittungen (Zuwendungsbestätigungen) nach amtlichem Muster aus: für Geldspenden, Sachspenden und den Verzicht auf Aufwandserstattung. Sponsoren legt ihr einmal an, mit ihren jährlichen Positionen (z. B. Bandenwerbung). Die Jahresrechnungen entstehen dann mit einem Klick.

Außerdem erfasst der Kassenwart hier alles, was Geld kostet: **Ausgaben mit Beleg** (Foto oder PDF), vom Bankkonto oder aus der Kasse. Das **Kassenbuch** zeigt je Kasse, was bar rein- und rausging, mit Kassensturz und Festschreibung je Monat. Der Reiter **EÜR** ist die Einnahmen-Überschuss-Rechnung je Sphäre.

Das Modul läuft allein. Ohne die Mitgliederverwaltung gibt es Rechnungen und Spendenquittungen nur an Firmen und einmalige Spender, und der Kontoauszug erscheint als eigener Reiter in der Buchhaltung.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Buchhaltung“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Recht vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer Rechnungen und Quittungen bearbeiten soll, das Recht „Buchhaltung“ (z. B. die Kassenwartin).
3. **Bankkonto anlegen:** Unter Einstellungen › Bankkonten mindestens ein Konto des Vereins eintragen. Es steht später auf jeder Rechnung. Ohne Konto erinnert euch ein gelber Hinweis auf der Seite „Rechnungen“.
4. **Vereinsanschrift prüfen:** Anschrift, E-Mail und Telefon stehen im Briefkopf. Ihr pflegt sie einmal zentral unter Einstellungen › Verein.
5. **Postfach einrichten (für den E-Mail-Versand):** Unter Einstellungen › Postfach. Ohne Postfach könnt ihr das PDF herunterladen und ausdrucken.
6. **Buchhaltung › Einstellungen:** Nummernkreis, Zahlungsziel und Steuerangaben eintragen. Für Spendenquittungen zusätzlich die Angaben zum Freistellungsbescheid. Ohne sie bleibt der Knopf „+ Neue Spendenquittung“ gesperrt.
7. **Ausgaben und Kasse:** Der Kassenwart bekommt das Recht „Ausgaben“, Kassenprüfer das Recht „Kassenprüfung“ (nur ansehen). Unter Einstellungen › Ausgaben & Kasse den Anfangsbestand der vorgegebenen Kasse eintragen, bei Bedarf weitere Kassen anlegen und Konto und Sphäre je Ausgabeart unter Einstellungen › Buchführung festlegen.

## Verwaltung {#verwaltung}

Die Buchhaltung hat oben Reiter in fester Folge: **Rechnungen**, **Spendenquittungen**, **Firmen & Sponsoren**, **Ausgaben**, **Kassenbuch**, **EÜR** und **Einstellungen**. Wer nur „Ausgaben“ oder „Kassenprüfung“ hat, sieht nur Ausgaben, Kassenbuch und EÜR (und mit „Ausgaben“ die Einstellungen der Ausgaben). Die Knöpfe zum Anlegen stehen jeweils rechts oben in der Reiterzeile. Am Reiter „Rechnungen“ zeigt eine Zahl, wie viele Rechnungen überfällig sind.

![Die Reiter der Buchhaltung, rechts die Knöpfe zum Anlegen.](bild: seite=bh-rechnungen; ziel=.tabrow; rahmen=#biNew)

### Reiter „Rechnungen“ {#bh-rechnungen}

Hier seht ihr alle Rechnungen und legt neue an.

#### Kennzahlen und Filter

Oben stehen drei Kacheln: **Offen** (Summe und Anzahl der unbezahlten Rechnungen), **Überfällig** (davon die Rechnungen, deren Zahlungsziel verstrichen ist, in Rot) und **Bezahlt** im laufenden Geschäftsjahr (nach Zahltag). Darunter filtert ihr die Liste:

- **Status:** Offen, Überfällig, Bezahlt, Storniert oder Alle. An den ersten beiden Knöpfen steht die Anzahl.
- **Jahr:** ein Jahr (bis fünf Jahre zurück, nach Rechnungsdatum) oder „alle“. Beginnt euer Geschäftsjahr nicht am 1. Januar, heißt das Feld „Geschäftsjahr“ und zeigt z. B. „2026/27“.

Ist ein Kontoauszug eingelesen, steht unter den Filtern, bis zu welchem Tag er reicht. So mahnt niemand, wer schon gezahlt hat.

![Rechnungsliste mit Kennzahlen, Statusfilter und Jahresauswahl.](bild: seite=bh-rechnungen; klick=#biS [data-f="alle"]; rahmen=[data-paid]; ziel=#main)

#### Die Liste

| Spalte | Inhalt |
|---|---|
| Empfänger | Name der Firma bzw. „Nachname, Vorname“ des Mitglieds. Darunter: Mitglied oder Firma, Leistungszeitraum, „verschickt“ und „2× erinnert“ |
| Nr. | Fortlaufende Rechnungsnummer, z. B. R-2026-0001 |
| Datum, Fällig | Rechnungsdatum und Zahlungsziel (überfällig in Rot) |
| Betrag | Gesamtbetrag inklusive Umsatzsteuer |
| Status | Offen, Überfällig, Bezahlt (mit Zahlungsdatum) oder Storniert |

Am Zeilenende stehen **PDF** (öffnet die Rechnung), **Bezahlt** (bei offenen Rechnungen, im Bild markiert) und **Details**. Bei Rechnungen an Mitglieder, die als offener Posten in der Mitgliederverwaltung stehen, fehlt „Bezahlt“. Die bucht ihr dort (siehe Zusammenspiel).

#### Neue Rechnung

„+ Neue Rechnung“ öffnet das Fenster. Oben wählt ihr, ob die Rechnung **an Firma / Sponsor** oder **an Mitglied** geht, und dann den Empfänger aus der Liste. Fehlt die Firma noch, führt der Link „Firma anlegen →“ zur Firmenliste.

![Das Fenster „Neue Rechnung“ mit Empfänger, Daten, Konto und Positionen.](bild: seite=bh-rechnungen; klick=#biNew; ziel=dialog)

- **Rechnungsdatum und Zahlbar bis:** Das Zahlungsziel ergibt sich aus der Einstellung (Standard 14 Tage) und folgt dem Rechnungsdatum.
- **Leistungszeitraum:** z. B. „Saison 2026/27“. Steht auf der Rechnung und in der Liste.
- **Abteilung (optional):** erscheint, wenn es Abteilungen gibt. Bei einer Abteilung steht deren Bankkonto auf der Rechnung.
- **Konto auf der Rechnung:** Vorgabe ist das Konto der Abteilung, sonst das Standardkonto. Ihr könnt es ändern. Die Rechnung behält später das Konto vom Rechnungstag, auch wenn ihr das Konto in den Einstellungen ändert.
- **Positionen:** je Zeile Leistung, Menge, Preis netto und Umsatzsteuer (19 %, 7 % oder ohne). „+ Position“ fügt eine Zeile hinzu, das Kreuz entfernt sie. Darunter rechnet das Fenster Netto, Umsatzsteuer je Satz und Gesamt mit. Wählt ihr eine Firma, deren Jahrespositionen hinterlegt sind, übernimmt das Fenster sie als Vorschlag.
- **Hinweis auf der Rechnung (optional):** ein freier Text, z. B. ein Dank.
- **Gleich per E-Mail an den Empfänger senden:** verschickt die Rechnung als PDF. Gesperrt, solange kein Postfach eingerichtet ist.

Mit „Rechnung erstellen“ ist die Rechnung angelegt und nummeriert. Die Nummern laufen je Jahr (R-2026-0001, -0002 …). Ist **Kleinunternehmer** eingestellt, entfallen die Spalte „USt“ und die Steuer. Auf der Rechnung steht dann der Hinweis nach § 19 UStG. Eine Rechnung an ein **Mitglied** steht zusätzlich als offener Posten bei den Mitgliedern und lässt sich dort per Lastschrift einziehen oder überweisen.

> Rechnungen lassen sich nach dem Erstellen nicht mehr ändern. Bei einem Fehler storniert ihr sie (siehe unten) und schreibt eine neue.

#### Details einer Rechnung

„Details“ zeigt die Positionen, den Status (bei Bezahlten mit Datum und Zahlungsweg), wann die Rechnung verschickt wurde und an welche Adresse. Je nach Lage bietet das Fenster diese Knöpfe an:

![Das Fenster einer Rechnung mit Positionen, Status und Knöpfen.](bild: seite=bh-rechnungen; klick=[data-inv]; ziel=dialog)

- **PDF:** öffnet die Rechnung zum Drucken oder Speichern. Neben der Bankverbindung steht ein **QR-Code für die Banking-App** mit Empfänger, IBAN, Betrag und Rechnungsnummer (nicht bei Lastschrift und Gutschrift).
- **Per E-Mail senden** bzw. **Erneut senden:** schickt die Rechnung mit PDF an die hinterlegte Adresse. Fehlt die Adresse oder das Postfach, sagt Clubwerk das.
- **Erinnerung senden:** nur bei überfälligen, offenen Rechnungen. Es geht eine freundliche Zahlungserinnerung mit neuem PDF raus. Jede weitere trägt die Zählung („2. Zahlungserinnerung“), und die Liste merkt sich, wie oft erinnert wurde.
- **Als bezahlt buchen:** öffnet das Fenster „Zahlung buchen“ (siehe unten). Bei Mitgliedsrechnungen mit offenem Posten fehlt der Knopf.
- **Wieder offen:** macht eine als bezahlt gebuchte Firmenrechnung wieder offen, z. B. nach einem Tippfehler.
- **Rechnung stornieren:** unten links, nach kurzer Begründung (mindestens drei Zeichen). Die Nummer bleibt vergeben, die Rechnung zählt nicht mehr als offen und trägt auf dem PDF den Hinweis „storniert“. Eine Rechnung, die per Kontoauszug als bezahlt gilt, lässt sich erst stornieren, nachdem dort die Zuordnung aufgehoben ist.

#### Zahlung buchen

Das Fenster fragt, **wann** das Geld eingegangen ist und **wie** es gezahlt wurde (Überweisung, bar, Lastschrift oder verrechnet). „Bezahlt“ bucht und setzt die Rechnung auf bezahlt. Der Knopf „Bezahlt“ in der Liste öffnet dasselbe Fenster.

![Das Fenster „Zahlung buchen“.](bild: seite=bh-rechnungen; klick=[data-paid]; ziel=dialog)

#### Jahresrechnungen

„Jahresrechnungen …“ schreibt für alle Firmen mit hinterlegten Jahrespositionen auf einmal eine Rechnung, und zwar je Firma und Jahr nur einmal. Ihr wählt das **Jahr**, das **Rechnungsdatum** und den **Leistungszeitraum**. In der Liste setzt ihr Haken bei den Firmen, die eine Rechnung bekommen. Bereits abgerechnete Firmen sind grau mit dem Vermerk der Rechnungsnummer. „Gleich per E-Mail verschicken“ sendet jede Rechnung an die Adresse der Firma. Firmen ohne E-Mail-Adresse sind markiert, ihre Rechnung entsteht trotzdem, ihr druckt sie aus. Der Knopf unten zählt mit, wie viele Rechnungen entstehen.

![Das Fenster „Jahresrechnungen“ mit der Auswahl der Firmen.](bild: seite=bh-rechnungen; klick=#biYear; ziel=dialog)

> Die Positionen pflegt ihr bei der Firma. Ändert sich der Preis für Bandenwerbung, ändert ihr ihn einmal dort, vor dem nächsten Jahreslauf.

### Reiter „Spendenquittungen“ {#bh-spenden}

Hier stellt ihr Zuwendungsbestätigungen für Spenden aus.

![Der Reiter „Spendenquittungen“ mit Kennzahlen und Liste.](bild: seite=bh-spenden; ziel=#main)

Drei Kacheln zeigen, was im laufenden Jahr bestätigt wurde: **Bestätigt** (alle aktiven Quittungen), **Geldspenden** und **Sachspenden & Verzicht**, jeweils mit Anzahl. Wählt ihr oben ein anderes **Jahr**, gelten die beiden letzten Kacheln für dieses Jahr.

Die Liste hat die Spalten **Nr.** (z. B. SQ-2026-0001), **Spender** (mit „Mitglied“, „Firma“ oder „einmaliger Spender“ und dem Vermerk „verschickt“), **Art**, **Tag der Zuwendung** und **Betrag**. Am Zeilenende stehen:

- **PDF:** die Quittung auf einer A4-Seite, mit Betrag in Worten und den Angaben zum Freistellungsbescheid.
- **Senden:** schickt die Quittung per E-Mail. Der Knopf ist gesperrt, wenn keine Adresse hinterlegt oder kein Postfach eingerichtet ist.
- **Storno:** nur, wenn eine Quittung falsch ausgestellt wurde. Ihr begründet kurz, die Nummer bleibt vergeben, die Zeile erscheint grau mit der Marke „storniert“.

#### Neue Spendenquittung

![Das Fenster „Neue Spendenquittung“ für eine Geldspende.](bild: seite=bh-spenden; klick=#bdNew; ziel=dialog)

Oben wählt ihr den **Spender**: ein Mitglied, eine Firma oder einen **einmaligen Spender**. Für den einmaligen Spender tragt ihr Name, Anschrift und optional eine E-Mail-Adresse ein. Für Mitglieder und Firmen nutzt Clubwerk die hinterlegte Anschrift. Fehlt sie, bekommt ihr einen Hinweis, denn ohne vollständige Anschrift ist die Quittung nicht gültig.

Danach wählt ihr die **Art**:

- **Geldspende:** Betrag und Tag der Zuwendung (nicht in der Zukunft).
- **Sachspende:** Wert, Tag und eine genaue Beschreibung (was, Alter, Zustand, ursprünglicher Kaufpreis). Dazu die **Herkunft** (Privatvermögen, Betriebsvermögen oder keine Angabe) und ob Unterlagen zur Wertermittlung vorliegen.
- **Verzicht auf Erstattung:** der verzichtete Betrag und die Beschreibung der Aufwendungen, z. B. Fahrtkosten zu einem Turnier. Der Anspruch muss vorher vertraglich oder per Satzung bzw. Vorstandsbeschluss eingeräumt worden sein, das steht auch im Fenster.

![Dasselbe Fenster für eine Sachspende mit Beschreibung und Herkunft.](bild: seite=bh-spenden; klick=#bdNew; klick2=#dKind button[data-k="sach"]; ziel=dialog)

„Spendenquittung erstellen“ legt die Quittung an und öffnet gleich das PDF. Fehlen Angaben, sagt Clubwerk genau, welche.

> Die Spendenquittung ist nur gültig, solange der Bescheid nicht älter als 5 Jahre ist (Feststellungsbescheid: 3 Jahre). Das Datum tragt ihr in den Einstellungen ein.

### Reiter „Firmen & Sponsoren“ {#bh-firmen}

Hier legt ihr Firmen einmal an und verwendet sie bei jeder Rechnung und Spende wieder.

![Der Reiter „Firmen & Sponsoren“ mit der Firmenliste.](bild: seite=bh-firmen; ziel=#main; rahmen=#bpNew)

Das Suchfeld „Firma suchen“ filtert nach Name, Ort und Ansprechperson. Die Liste zeigt:

| Spalte | Inhalt |
|---|---|
| Firma | Name, darunter PLZ und Ort (und „inaktiv“) |
| Ansprechperson | Name und E-Mail-Adresse |
| Jahresbetrag | Summe der Jahrespositionen inklusive Umsatzsteuer |
| Offen | Summe der offenen Rechnungen |
| Zuletzt | Jahr der letzten Jahresrechnung, sonst Zahl der bisherigen Rechnungen |

**Rechnung** öffnet das Fenster „Neue Rechnung“, schon mit der Firma und ihren Jahrespositionen. **Bearbeiten** öffnet die Firma.

#### Firma anlegen und bearbeiten

![Das Fenster einer Firma mit Anschrift, Jahrespositionen und Notiz.](bild: seite=bh-firmen; klick=[data-ed]; ziel=dialog)

- **Stammdaten:** Firma bzw. Name, Kundennummer, Abteilung, Ansprechperson, E-Mail (für den Rechnungsversand), Telefon, USt-IdNr., Anschrift. Das Land bleibt leer, wenn die Firma in Deutschland sitzt.
- **Jahrespositionen:** was die Firma jedes Jahr bekommt, z. B. Bandenwerbung, Trikotwerbung oder eine Anzeige im Vereinsheft. Leer lassen, wenn nur einzeln abgerechnet wird.
- **Notiz (intern):** sehen nur Benutzer mit dem Recht „Buchhaltung“. Sie liegt verschlüsselt im Tresor.
- **Aktiv:** inaktive Firmen bekommen keine Jahresrechnung und lassen sich nicht auswählen. Gedacht für Sponsoren, die aufgehört haben.
- **Löschen:** nur, solange es keine Rechnung und keine Spendenquittung für die Firma gibt. Sonst setzt ihr sie auf inaktiv.

### Reiter „Ausgaben“ {#bh-ausgaben}

Hier steht alles, was der Verein bezahlt hat – mit Beleg, vom Bankkonto oder aus einer Kasse. Oben drei Kennzahlen für das gewählte Jahr: alle Ausgaben, davon vom Bankkonto (mit der Zahl noch nicht mit dem Kontoauszug abgeglichener) und aus der Kasse (mit der Zahl der Eigenbelege).

![Der Reiter „Ausgaben“ mit Kennzahlen, Vorschlägen und Liste.](bild: seite=bh-ausgaben; ziel=#main; rahmen=#axNew)

#### Zu erfassen

Die Karte zeigt Lieferungen aus dem Verkauf (Rechnung oder Kassenbon mit Betrag) und Abbuchungen aus dem Kontoauszug, zu denen es noch keine Ausgabe gibt. „Erfassen …“ öffnet das Fenster mit Datum, Betrag und Empfänger schon eingetragen. Den Beleg einer Lieferung übernimmt Clubwerk, eine Abbuchung wird gleich im Kontoauszug zugeordnet. So wird nichts doppelt erfasst. Abbuchungen erscheinen nur mit dem Recht „Kontoauszug“.

#### Die Liste

Filter: **Gebucht**, **Storniert**, **Alle**, dazu Jahr (bzw. Geschäftsjahr) und Ausgabeart. Je Ausgabe: Empfänger mit Zweck und Art, Nummer (A-2026-0001 …), Datum, bezahlt von (Bankkonto oder Kasse, „Kontoauszug“ = abgeglichen), Betrag und ob es einen Beleg oder einen Eigenbeleg gibt. „Details“ öffnet die Ausgabe.

#### Neue Ausgabe

![Das Fenster „Neue Ausgabe“.](bild: seite=bh-ausgaben; klick=#axNew; ziel=dialog)

- **Bezahlt am**, **Betrag (€, brutto)**, **Empfänger** (Firmen aus „Firmen & Sponsoren“ werden vorgeschlagen), **Ausgabeart** und **Wofür** sind Pflicht.
- **Umsatzsteuer:** nur, wenn in den Einstellungen der Vorsteuerabzug eingeschaltet ist.
- **Bezahlt von:** Bankkonto oder Kasse. Eine Kasse kann nicht ins Minus gehen, und in einem festgeschriebenen Monat lässt sich nichts mehr buchen.
- **Beleg:** „Foto aufnehmen“ (am Handy oder Tablet öffnet sich die Kamera) oder „Datei wählen“ (JPG, PNG, HEIC oder PDF, höchstens 15 MB). Fotos werden vor dem Hochladen verkleinert. Gibt es keinen Beleg, begründet ihr das mit „Kein Beleg vorhanden …“ als **Eigenbeleg**.

> Der Beleg wird beim Speichern eingefroren (Prüfsumme) und liegt verschlüsselt im Tresor. Er lässt sich danach nicht mehr ersetzen; wurde die Datei verändert, meldet Clubwerk das beim Öffnen.

#### Details und Storno

![Das Fenster einer Ausgabe mit Belegfoto.](bild: seite=bh-ausgaben; klick=[data-ax]; ziel=dialog)

Das Fenster zeigt alle Angaben, das Belegfoto und „Beleg öffnen“. Eine Ausgabe wird nie gelöscht: „Ausgabe stornieren“ (mit Begründung) lässt Nummer und Beleg stehen, die Ausgabe zählt aber nicht mehr. Bei einer Barausgabe kommt das Geld rechnerisch mit Datum von heute in die Kasse zurück. Ist die Ausgabe mit einer Abbuchung verknüpft, hebt ihr zuerst im Kontoauszug die Zuordnung auf.

### Reiter „Kassenbuch“ {#bh-kasse}

Das Kassenbuch zeigt je Kasse und Monat jede Bewegung mit laufendem Bestand: Bareinnahmen der Module (Verkauf bar, Veranstaltungen, Nenngeld, bar bezahlte Rechnungen und Posten – je Tag und Art zusammengefasst), Barausgaben, Geldtransit, Umbuchungen, Kassendifferenzen und Stornos. Oben wählt ihr die Kasse und den Monat, darunter stehen Anfangsbestand, Einnahmen und Ausgaben sowie der Bestand laut Kassenbuch.

![Das Kassenbuch der Thekenkasse mit Bestand und Kassensturz.](bild: seite=bh-kasse; ziel=#main; rahmen=#kbCount)

#### Kassensturz

![Das Fenster „Kassensturz“ mit Zählprotokoll.](bild: seite=bh-kasse; klick=#kbCount; ziel=dialog)

Geld zählen und je Schein und Münze die Anzahl eintragen. Clubwerk zeigt den Bestand laut Kassenbuch und die Differenz. Weicht das Gezählte ab, braucht es eine Begründung; die Differenz wird als eigene Buchung „Kassendifferenz laut Kassensturz“ gebucht. Die Kassenstürze des Monats stehen unter dem Kassenbuch.

#### Geldtransit

![Das Fenster „Geldtransit“.](bild: seite=bh-kasse; klick=#kbMove; ziel=dialog)

„Von der Bank in die Kasse“ (z. B. Wechselgeld), „Aus der Kasse zur Bank“ (Einzahlung) oder „An andere Kasse“. Einzelne Buchungen lassen sich mit dem ✕ in der Zeile stornieren (mit Begründung, Gegenbuchung von heute).

#### Monat festschreiben

Ist ein Monat vorbei, schreibt ihr ihn fest („Monat festschreiben …“), am besten nach einem Kassensturz. Die Monate werden der Reihe nach abgeschlossen. Danach ist der Monat unveränderlich: Kommt später noch etwas mit Datum in diesem Monat dazu, erscheint es als „Nachtrag zu festgeschriebenen Monaten“ im nächsten offenen Monat. Die Übersicht erinnert, solange der Vormonat offen ist.

#### PDF und Excel

Unter der Liste: das Kassenbuch des Monats als PDF oder Excel-Tabelle, z. B. für die Kassenprüfung.

### Reiter „EÜR“ {#bh-euer}

![Die Einnahmen-Überschuss-Rechnung je Sphäre.](bild: seite=bh-euer; ziel=#main; hoehe=560)

Die Einnahmen-Überschuss-Rechnung für das gewählte (Geschäfts-)Jahr: je Sphäre (ideeller Bereich, Vermögensverwaltung, Zweckbetrieb, wirtschaftlicher Geschäftsbetrieb) die Einnahmen und Ausgaben je Erlös- bzw. Ausgabeart und der Überschuss. Gezählt wird nach Zahlungstag und nur, was durch Clubwerk läuft. Die Sphäre je Art legt ihr unter Einstellungen › Buchführung fest. Liegen die Einnahmen im Zweckbetrieb oder im wirtschaftlichen Geschäftsbetrieb über der Freigrenze, erscheint ein Hinweis. „Excel“ lädt die Auswertung herunter. Mit Vorsteuerabzug steht die gezahlte Vorsteuer unter „Ausgaben“.

### Reiter „Einstellungen“ {#bh-einstellungen}

Die Einstellungen bestehen aus Karten untereinander. Jede hat ihr eigenes „Speichern“ und sendet nur ihre Felder. Die Reihenfolge: Rechnungen, Steuer & Finanzamt, Spendenquittungen, Briefkopf & Bankkonten, Ausgaben & Kasse (Ausgaben, Ausgabearten, Kassen, Bareinnahmen je Kasse), Einstellungen übertragen.

#### Rechnungen

![Karte „Rechnungen“.](bild: seite=bh-einstellungen; ziel=[data-set="rechnungen"])

- **Nummernkreis:** Vorsilbe der Rechnungsnummern (Standard „R-“). Die Nummern laufen je Jahr: R-2026-0001, -0002 …
- **Zahlungsziel (Tage):** wie viele Tage nach dem Rechnungsdatum bezahlt werden soll (Standard 14).
- **Einleitungstext:** steht über den Positionen, z. B. „Vielen Dank für Ihre Unterstützung!“
- **Fußzeile (optional):** unten auf jeder Rechnung, z. B. Vorstand und Registergericht.

#### Steuer & Finanzamt

![Karte „Steuer & Finanzamt“.](bild: seite=bh-einstellungen; ziel=[data-set="steuer"])

Die Angaben gelten für Rechnungen und Spendenquittungen. Werbeleistungen sind beim Verein in der Regel umsatzsteuerpflichtig. Im Zweifel fragt eure Steuerberatung.

- **Steuernummer** und **USt-IdNr.** (optional) stehen auf den Rechnungen.
- **Umsatzsteuer (Vorgabe):** der Satz, den neue Positionen bekommen (19 %, 7 % oder ohne).
- **Kleinunternehmer:** schaltet die Umsatzsteuer aus (§ 19 UStG). Auf den Rechnungen steht der Hinweis.
- **Finanzamt**, **Steuernummer (beim Finanzamt)** (leer = wie bei den Rechnungen), **Art des Bescheids** (Freistellungsbescheid oder Feststellungsbescheid), **Datum des Bescheids** und **Veranlagungszeitraum:** die Pflichtangaben auf der Spendenquittung.

> Fehlen die Angaben zum Bescheid, zeigt die Seite „Spendenquittungen“ einen gelben Hinweis „Eintragen →“. Ein Klick darauf springt direkt zu dieser Karte.

#### Spendenquittungen

![Karte „Spendenquittungen“.](bild: seite=bh-einstellungen; ziel=[data-set="spenden"])

- **Nummernkreis:** Vorsilbe der Quittungsnummern (Standard „SQ-“).
- **Ort der Ausstellung:** leer = Ort des Vereins.
- **Begünstigte Zwecke:** der steuerbegünstigte Zweck, wie im Bescheid, z. B. „Förderung des Sports“.
- **Unterschrift (Name)** und **Funktion:** wer die Quittung unterschreibt, z. B. die Kassenwartin.

#### Briefkopf & Bankkonten

Die Karte ist nur eine Anzeige. Anschrift, E-Mail und Telefon im Briefkopf kommen aus Einstellungen › Verein, die Bankkonten aus Einstellungen › Bankkonten. Die Links führen dorthin. Die Tabelle zeigt jedes Konto mit IBAN und den Abteilungen, für die es gilt („alle“, wenn keine eingeschränkt ist). Das Standardkonto trägt die Marke „Standard“.

#### Ausgaben

![Karte „Ausgaben“.](bild: seite=bh-einstellungen; ziel=#bsAus)

- **Nummernkreis:** Vorsilbe der Ausgabennummern (Standard „A-“), je Jahr fortlaufend.
- **Verein ist vorsteuerabzugsberechtigt:** Standard aus – dann werden Ausgaben brutto erfasst. Eingeschaltet wählt ihr je Ausgabe den Steuersatz, die Vorsteuer geht mit in den DATEV-Export.

#### Ausgabearten

![Karte „Ausgabearten“.](bild: seite=bh-einstellungen; ziel=#bsTypes; hoehe=420)

Vorgegeben sind Arten wie Wareneinkauf Getränke, Platzpflege und Anlage, Strom, Verbandsbeiträge oder Trainer. Ihr könnt sie umbenennen, stilllegen und neue mit einer Sphäre anlegen. Konto und Sphäre je Art stellt ihr unter Einstellungen › Buchführung ein.

#### Kassen

![Karte „Kassen“.](bild: seite=bh-einstellungen; ziel=#bsCash)

Eine Kasse ist vorgegeben, weitere legt ihr mit „+ Kasse“ an (Name, Beginn, Anfangsbestand). Der Anfangsbestand lässt sich ändern, solange in der Kasse noch nichts gebucht ist. Die **Hauptkasse** bekommt alle Bareinnahmen ohne eigene Zuordnung. Stilllegen geht nur mit leerer Kasse.

#### Bareinnahmen je Kasse

Nur mit mehr als einer Kasse: Je Erlösart (z. B. Turnier-Nenngeld) wählt ihr, in welche Kasse das Bargeld fließt. Ohne Auswahl landet es in der Hauptkasse.

#### Einstellungen übertragen

Exportiert Einstellungen, Firmen (mit Jahrespositionen), Ausgabearten und Kassen als Datei und importiert sie in einer anderen Clubwerk-Installation. Rechnungen, Spendenquittungen, Ausgaben, Kassenbuchungen und Bankkonten werden nicht übertragen. Beim Import werden gleichnamige Einträge (ohne Groß-/Kleinschreibung) aktualisiert, neue angelegt, nichts wird gelöscht. Die Meldung nennt je Art, wie viele neu und wie viele aktualisiert wurden.

### Kontoauszug {#kontoauszug}

Zahlungen ordnet ihr den Rechnungen über den **Kontoauszug** zu. Mit der Mitgliederverwaltung liegt er unter Beiträge & Zahlungen › Kontoauszug, ohne sie als eigener Reiter der Buchhaltung. Wie der Kontoauszug funktioniert, steht in der Anleitung des Kerns. Für die Buchhaltung gilt:

- Eine Zahlung ordnet Clubwerk einer Rechnung zu, wenn im Verwendungszweck die **Rechnungsnummer** steht. Stimmt auch der Betrag, gilt die Zuordnung als sicher. Ist mehr eingegangen, ist sie wahrscheinlich, und der Rest bleibt ohne Zuordnung.
- Reicht der Betrag nicht, gibt es keine automatische Zuordnung. Teilzahlungen bucht ihr von Hand in der Rechnung.
- Eine so bezahlte Rechnung trägt den Zahlungsweg „Kontoauszug“. Wollt ihr sie wieder öffnen oder stornieren, hebt ihr zuerst die Zuordnung im Kontoauszug auf.
- Zum Zuordnen braucht ihr das Recht „Kontoauszüge einlesen und zuordnen“ und zusätzlich „Buchhaltung“.
- **Abbuchungen:** Mit der Buchhaltung behält der Kontoauszug auch Abbuchungen. Passt eine zu einer Ausgabe vom Bankkonto (gleicher Betrag, bis 14 Tage Abstand, Empfänger im Namen), schlägt Clubwerk sie vor. Andere Abbuchungen erscheinen unter Ausgaben › Zu erfassen.

## Tablet und App {#tablet-app}

Die Buchhaltung hat keine Seite am Tablet und in der Mitglieder-App. Rechnungen und Quittungen verschickt ihr per E-Mail als PDF oder druckt sie aus. Belegfotos nehmt ihr in der Verwaltung am Handy oder Tablet mit „Foto aufnehmen“ auf.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Buchhaltung | Rechnungen, Spendenquittungen, Firmen & Sponsoren und ihre Einstellungen: schreiben, verschicken, anmahnen, buchen und stornieren, Rechnungen und Ausgaben im Kontoauszug zuordnen (zusätzlich zum Kontorecht) |
| Ausgaben und Kassenbuch erfassen | Ausgaben mit Beleg erfassen und stornieren, Kassensturz, Geldtransit, Monate festschreiben, Ausgabearten und Kassen einrichten (der Kassenwart) |
| Kassenprüfung | Ausgaben mit Belegen, Kassenbuch und EÜR nur ansehen und herunterladen |

Wer „Buchhaltung“ hat, sieht auch die Namen und Anschriften der Rechnungsempfänger.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Mitglieder:** Rechnungen an Mitglieder stehen als offener Posten in der Mitgliederverwaltung und lassen sich dort einziehen oder als bezahlt buchen. Wird der Posten bezahlt, wird auch die Rechnung bezahlt. Wird er storniert oder wieder offen (z. B. nach einer Rücklastschrift), zieht die Rechnung nach.
- **Kontoauszug (Kern):** ordnet Zahlungseingänge den offenen Rechnungen und Abbuchungen den Ausgaben zu, siehe oben.
- **Verkauf:** Lieferungen mit Betrag erscheinen unter Ausgaben › Zu erfassen; bare Verkäufe stehen im Kassenbuch.
- **Buchführung (Einstellungen):** Ausgaben, Geldtransit und Kassendifferenzen laufen mit in den DATEV-Buchungsstapel; Konto und Sphäre je Ausgabeart stellt ihr dort ein.
- **Alle Module mit Bargeld:** Ihre Bareinnahmen erscheinen im Kassenbuch (Hauptkasse oder die gewählte Kasse).
- **Einstellungen:** Anschrift (Verein), Bankkonten und Postfach kommen von dort.
- **Übersicht:** zeigt die Zahl offener Rechnungen, die noch fehlenden Jahresrechnungen, eine Warnung bei überfälligen Rechnungen und – mit dem Recht „Ausgaben“ – einen Hinweis, solange der Vormonat einer Kasse nicht festgeschrieben ist.
- **Suche (Strg/⌘ K):** findet Rechnungen nach Nummer oder Empfänger und Firmen nach Name oder Kundennummer.
- **Datenschutz:** Rechnungen, Quittungen und Ausgabenbelege sind Belege und werden nie automatisch gelöscht (Aufbewahrung gesetzlich: Belege 8 Jahre, Bücher 10 Jahre). Die Datenauskunft eines Mitglieds enthält seine Rechnungen und Spenden. Beim Zusammenführen doppelter Mitglieder gehen sie mit. Hat ein Mitglied offene Rechnungen, weist Clubwerk darauf hin. Bezahlte und stornierte Rechnungen bleiben mit dem Namen erhalten.
- **Einrichtungs-Assistent:** enthält den Schritt „Rechnungen und Steuer“.
