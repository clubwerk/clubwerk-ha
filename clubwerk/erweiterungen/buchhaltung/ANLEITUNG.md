# Buchhaltung
<!-- kurz: Rechnungen an Firmen und Mitglieder, Spendenquittungen nach amtlichem Muster und Sponsoren mit Jahrespositionen. -->

## Wofür ist das Modul? {#wofuer}

Die Buchhaltung schreibt Rechnungen an Sponsoren, Firmen und Mitglieder, hält fest, was bezahlt ist, und erinnert per E-Mail an überfällige Beträge. Dazu stellt sie Spendenquittungen (Zuwendungsbestätigungen) nach amtlichem Muster aus: für Geldspenden, Sachspenden und den Verzicht auf Aufwandserstattung. Sponsoren legt ihr einmal an, mit ihren jährlichen Positionen (z. B. Bandenwerbung). Die Jahresrechnungen entstehen dann mit einem Klick.

Das Modul läuft allein. Ohne die Mitgliederverwaltung gibt es Rechnungen und Spendenquittungen nur an Firmen und einmalige Spender, und der Kontoauszug erscheint als eigener Reiter in der Buchhaltung.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Buchhaltung“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Recht vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer Rechnungen und Quittungen bearbeiten soll, das Recht „Buchhaltung“ (z. B. die Kassenwartin).
3. **Bankkonto anlegen:** Unter Einstellungen › Bankkonten mindestens ein Konto des Vereins eintragen. Es steht später auf jeder Rechnung. Ohne Konto erinnert euch ein gelber Hinweis auf der Seite „Rechnungen“.
4. **Vereinsanschrift prüfen:** Anschrift, E-Mail und Telefon stehen im Briefkopf. Ihr pflegt sie einmal zentral unter Einstellungen › Verein.
5. **Postfach einrichten (für den E-Mail-Versand):** Unter Einstellungen › Postfach. Ohne Postfach könnt ihr das PDF herunterladen und ausdrucken.
6. **Buchhaltung › Einstellungen:** Nummernkreis, Zahlungsziel und Steuerangaben eintragen. Für Spendenquittungen zusätzlich die Angaben zum Freistellungsbescheid. Ohne sie bleibt der Knopf „+ Neue Spendenquittung“ gesperrt.

## Verwaltung {#verwaltung}

Die Buchhaltung hat oben vier Reiter in fester Folge: **Rechnungen**, **Spendenquittungen**, **Firmen & Sponsoren** und **Einstellungen**. Die Knöpfe zum Anlegen stehen jeweils rechts oben in der Reiterzeile. Am Reiter „Rechnungen“ zeigt eine Zahl, wie viele Rechnungen überfällig sind.

![Die vier Reiter der Buchhaltung, rechts die Knöpfe zum Anlegen.](bild: seite=bh-rechnungen; ziel=.tabrow; rahmen=#biNew)

### Reiter „Rechnungen“ {#bh-rechnungen}

Hier seht ihr alle Rechnungen und legt neue an.

#### Kennzahlen und Filter

Oben stehen drei Kacheln: **Offen** (Summe und Anzahl der unbezahlten Rechnungen), **Überfällig** (davon die Rechnungen, deren Zahlungsziel verstrichen ist, in Rot) und **Bezahlt** im laufenden Jahr. Darunter filtert ihr die Liste:

- **Status:** Offen, Überfällig, Bezahlt, Storniert oder Alle. An den ersten beiden Knöpfen steht die Anzahl.
- **Jahr:** ein Jahr (bis fünf Jahre zurück) oder „alle“.

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

- **PDF:** öffnet die Rechnung zum Drucken oder Speichern.
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

### Reiter „Einstellungen“ {#bh-einstellungen}

Die Einstellungen bestehen aus fünf Karten untereinander. Jede hat ihr eigenes „Speichern“ und sendet nur ihre Felder. Die Reihenfolge: Rechnungen, Steuer & Finanzamt, Spendenquittungen, Briefkopf & Bankkonten, Einstellungen übertragen.

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

#### Einstellungen übertragen

Exportiert Einstellungen und Firmen (mit Jahrespositionen) als Datei und importiert sie in einer anderen Clubwerk-Installation. Rechnungen, Spendenquittungen und Bankkonten werden nicht übertragen. Beim Import bleiben vorhandene Firmen mit gleichem Namen unverändert.

### Kontoauszug {#kontoauszug}

Zahlungen ordnet ihr den Rechnungen über den **Kontoauszug** zu. Mit der Mitgliederverwaltung liegt er unter Beiträge & Zahlungen › Kontoauszug, ohne sie als fünfter Reiter der Buchhaltung. Wie der Kontoauszug funktioniert, steht in der Anleitung des Kerns. Für die Buchhaltung gilt:

- Eine Zahlung ordnet Clubwerk einer Rechnung zu, wenn im Verwendungszweck die **Rechnungsnummer** steht. Stimmt auch der Betrag, gilt die Zuordnung als sicher. Ist mehr eingegangen, ist sie wahrscheinlich, und der Rest bleibt ohne Zuordnung.
- Reicht der Betrag nicht, gibt es keine automatische Zuordnung. Teilzahlungen bucht ihr von Hand in der Rechnung.
- Eine so bezahlte Rechnung trägt den Zahlungsweg „Kontoauszug“. Wollt ihr sie wieder öffnen oder stornieren, hebt ihr zuerst die Zuordnung im Kontoauszug auf.
- Zum Zuordnen braucht ihr das Recht „Kontoauszüge einlesen und zuordnen“ und zusätzlich „Buchhaltung“.

## Tablet und App {#tablet-app}

Die Buchhaltung hat keine Seite am Tablet und in der Mitglieder-App. Rechnungen und Quittungen verschickt ihr per E-Mail als PDF oder druckt sie aus.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Buchhaltung | Alle vier Reiter: Rechnungen schreiben, verschicken, anmahnen, buchen und stornieren, Firmen verwalten, Spendenquittungen ausstellen, versenden und stornieren, Einstellungen ändern, Rechnungen im Kontoauszug zuordnen (zusätzlich zum Kontorecht) |

Das Recht ist ein einziges. Wer es hat, sieht auch die Namen und Anschriften der Rechnungsempfänger.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Mitglieder:** Rechnungen an Mitglieder stehen als offener Posten in der Mitgliederverwaltung und lassen sich dort einziehen oder als bezahlt buchen. Wird der Posten bezahlt, wird auch die Rechnung bezahlt. Wird er storniert oder wieder offen (z. B. nach einer Rücklastschrift), zieht die Rechnung nach.
- **Kontoauszug (Kern):** ordnet Zahlungseingänge den offenen Rechnungen zu, siehe oben.
- **Einstellungen:** Anschrift (Verein), Bankkonten und Postfach kommen von dort.
- **Übersicht:** zeigt die Zahl offener Rechnungen, die noch fehlenden Jahresrechnungen und eine Warnung bei überfälligen Rechnungen.
- **Suche (Strg/⌘ K):** findet Rechnungen nach Nummer oder Empfänger und Firmen nach Name oder Kundennummer.
- **Datenschutz:** Rechnungen und Quittungen sind Belege und werden nie automatisch gelöscht (Aufbewahrung gesetzlich: Belege 8 Jahre, Bücher 10 Jahre). Die Datenauskunft eines Mitglieds enthält seine Rechnungen und Spenden. Beim Zusammenführen doppelter Mitglieder gehen sie mit. Hat ein Mitglied offene Rechnungen, weist Clubwerk darauf hin. Bezahlte und stornierte Rechnungen bleiben mit dem Namen erhalten.
- **Einrichtungs-Assistent:** enthält den Schritt „Rechnungen und Steuer“.
