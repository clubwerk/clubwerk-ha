# Plätze
<!-- kurz: Plätze und Geräte buchen – Mitglieder in der App oder am Tablet, ihr behaltet in der Verwaltung den Überblick. -->

## Wofür ist das Modul? {#wofuer}

Mitglieder buchen Tennisplätze, Padelplätze, Hallen oder Geräte wie die Ballmaschine – in der Mitglieder-App oder am Tablet im Vereinsheim. Clubwerk achtet auf Öffnungszeiten, Zeitraster, Höchstdauer und das Kontingent je Mitglied, kennt Mitspieler und Gäste (mit Gastgebühr) und führt eine Warteliste. In der Verwaltung seht ihr den Belegungsplan, tragt Training, Mannschaften und Platzsperren ein, übernehmt den Spielplan vom Verband und wertet die Auslastung aus.

Das Modul läuft allein. Ohne die Mitgliederverwaltung kennt es nur Vor- und Nachname und hat keine Zahlungsverfolgung der Gebühren; ohne den Verkauf lassen sich keine Gebühren von Hand aufs Konto buchen.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Plätze“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Rechte vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer mitarbeiten soll, die passenden Rechte (siehe unten), z. B. der Platzwart „Belegung ansehen“ und „Buchungen anderer stornieren“.
3. **Plätze anlegen:** Reiter „Plätze & Geräte“ › „+ Platz“ oder „+ Gerät“. Namen, Öffnungszeiten, Zeitraster und Höchstdauer festlegen.
4. **Regeln prüfen:** Reiter „Einstellungen“ – Vorlauf, Kontingent, Gäste und Gastgebühr sind mit Vorschlagswerten gefüllt. Dort legt ihr auch die **Buchungsarten** an (Training, Medenspiel …).
5. **Tablet und App:** Mitglieder sehen den Bereich „Plätze“ sofort in der App. Am Tablet erscheint er, sobald „Am Tablet im Vereinsheim buchen“ an ist (Standard).

## Verwaltung {#verwaltung}

Im Menü „Plätze“ gibt es sieben Reiter: **Belegung**, **Serien & Sperren**, **Buchungen**, **Gebühren**, **Auswertung**, **Plätze & Geräte** und **Einstellungen**. Der Reiter „Einstellungen“ erscheint nur mit dem Recht „Plätze, Buchungsarten & Einstellungen“.

### Reiter „Belegung“ {#bk-belegung}

![Der Belegungsplan für einen Tag: oben die Tage der Woche, darunter alle Plätze nebeneinander mit ihren Buchungen.](bild: seite=bk-belegung; klick=#bkDays button:nth-child(5))

Der Plan zeigt, wer wann auf welchem Platz spielt.

- **Tag oder Woche:** Mit den Schaltern „Tag“ und „Woche“ wechselt ihr zwischen allen Plätzen an einem Tag und einem Platz über sieben Tage (dann wählt ihr den Platz in der Leiste, die Pfeile blättern wochenweise).
- **Tag wählen:** Die Tage der Woche stehen als Kacheln oben, die Pfeile ‹ › blättern wochenweise, im Datumsfeld wählt ihr jeden anderen Tag. „Heute“ springt zurück.
- **Plan lesen:** Jede Spalte ist ein Platz oder Gerät. Eine Buchung ist ein Block in der Farbe ihrer Buchungsart; Sperren sind rot gestreift, nicht buchbare Zeiten (außerhalb der Öffnungszeit) schraffiert. Die rote Linie ist „jetzt“. Heute sind vergangene Stunden eingeklappt – ein Klick auf die Leiste klappt sie auf. Unter dem Plan erklärt eine Legende die Farben.
- **Freie Stelle anklicken:** öffnet „Buchung eintragen“ mit Platz, Tag und Uhrzeit schon ausgefüllt. Nötig ist das Recht „für Mitglieder buchen“.

![Die Leiste der Wochenansicht: Platz wählen, Woche mit den Pfeilen und im Datumsfeld wechseln.](bild: seite=bk-belegung; klick=#bkV [data-v="woche"]; ziel=.bk-bar)

#### Buchung eintragen

![Das Fenster „Buchung eintragen“: Platz, Datum, Zeit, Buchungsart, Titel und „Wer spielt“.](bild: seite=bk-belegung; klick=#bkNew; ziel=dialog)

Der Knopf „+ Buchung“ steht rechts oben.

- **Platz / Gerät, Datum, Zeit:** Wird der Beginn geändert, rückt das Ende mit – die Dauer bleibt.
- **Buchungsart:** Name und Farbe, z. B. Training oder Medenspiel. Wählbar sind alle Buchungsarten, die ihr nutzen dürft. „– ohne –“ ist eine ganz normale Buchung.
- **Titel / Grund:** freiwillig, z. B. „Training Jugend“.
- **Mitglied (bucht):** für wen die Buchung gilt. „– Verein –“ ist eine Vereinsbuchung (dann braucht sie eine Buchungsart oder einen Titel). Für Mitglieder gelten Kontingent und Gebühren wie bei einer Buchung in der App.
- **Mitspieler:** aus der Liste wählen; sie erscheinen als Kärtchen und lassen sich mit × wieder entfernen.

![„Weitere Angaben“ aufgeklappt: Gäste, Wiederholen und interne Notiz.](bild: seite=bk-belegung; klick=#bkNew; klick2=#bdMore; ziel=dialog)

Hinter **„Weitere Angaben“** stehen die seltenen Felder:

- **Gäste:** Namen mit Komma getrennt. Je Gast fällt die Gastgebühr an, als offener Posten beim buchenden Mitglied. Mit dem Haken „Gäste aus Partnerverein“ entfällt sie.
- **Wiederholen** und **Bis:** macht aus der Buchung eine Serie, z. B. jede Woche bis Saisonende. Belegte Tage werden ausgelassen. Nötig ist das Recht „Serien & Sperren anlegen“.
- **Notiz (intern):** sehen nur Benutzer in der Verwaltung.

„Speichern“ trägt die Buchung ein. Ist die Zeit schon belegt, sagt Clubwerk das und trägt nichts ein.

#### Sperre eintragen

![Das Fenster „Platz sperren“.](bild: seite=bk-belegung; klick=#bkLock; ziel=dialog)

„+ Sperre“ sperrt einen Platz für eine Zeit, z. B. zur Platzpflege oder für ein Turnier. Platz, Tag, Zeit und Grund angeben; „Wiederholen“ macht eine Serie daraus. Liegen schon Buchungen von Mitgliedern in dieser Zeit, fragt Clubwerk nach: Mit „Sperren und stornieren“ werden sie abgesagt und die Mitglieder per E-Mail (und Push) informiert.

> Für längere Zeiträume wie die Winterpause ist „+ Sperre über Zeitraum“ im Reiter „Serien & Sperren“ bequemer.

#### Eine Buchung öffnen

![Die geöffnete Buchung: Spieler, Gebühr, Notiz und wer sie wann eingetragen hat.](bild: seite=bk-belegung; klick=.bk-blk.buchung; ziel=dialog)

Ein Klick auf einen Block zeigt die Einzelheiten: Spieler, Titel, Gebühr, Notiz und wer die Buchung wann und wo (App, Tablet, Verwaltung, Spielplan-Import) eingetragen hat.

- **Stornieren** fragt nach einem Grund (freiwillig). Das Mitglied bekommt eine E-Mail, eine Gebühr entfällt. Nötig ist das Recht „Buchungen anderer stornieren“.
- **Bearbeiten** öffnet dasselbe Fenster wie beim Eintragen: Platz, Zeit, Mitglied, Mitspieler, Gäste und Buchungsart lassen sich ändern. Gastgebühren werden neu berechnet, neue Mitspieler bekommen die Mail.

Gehört der Termin zu einer Serie oder Sperre, fragt Clubwerk zuerst, was gemeint ist:

![Die Auswahl bei Serienterminen: nur dieser Termin, dieser und alle folgenden, gesamte Serie.](bild: seite=bk-belegung; klick=#bkDays button:nth-child(3); klick2=.bk-blk.serie; klick3=#bxE; ziel=#askBox)

Beim Stornieren folgt eine Rückfrage, bevor etwas verschwindet. Beim Bearbeiten (Platz, Uhrzeit, Titel, Buchungsart, Notiz) zeigt „Prüfen“ vorher, wie viele Termine betroffen sind und an welchen Tagen der Platz belegt ist.

### Reiter „Serien & Sperren“ {#bk-serien}

![Der Reiter „Serien & Sperren“ mit den aktiven Serien, Sperren und Spielplänen.](bild: seite=bk-serien)

Hier stehen alle wiederkehrenden Termine: Training, Kurse, Mannschaftsspiele und Sperren. Jede Zeile nennt Titel, Wiederholung („jeden Dienstag“), Uhrzeit, Zeitraum, Plätze, wen es betrifft und wie viele Termine noch kommen. „Beenden“ (bei Sperren „Aufheben“) entfernt die kommenden Termine nach einer Rückfrage; vergangene bleiben stehen. Beendete Serien stehen darunter. Die Knöpfe oben brauchen das Recht „Serien & Sperren anlegen“.

#### + Serie

![Das Fenster „Neue Serie“.](bild: seite=bk-serien; klick=#srNew; ziel=dialog)

Eine Serie reserviert Plätze regelmäßig, z. B. „Training Herren“ jeden Dienstag 19–21 Uhr auf Platz 1 und 2.

- **Buchungsart** und **Titel:** Ohne Titel heißt die Serie wie die Buchungsart oder das Mitglied.
- **Erster Tag, Letzter Tag, Plätze:** In welchem Zeitraum und auf welchen Plätzen (mehrere möglich).
- **Wiederholung:** täglich, wöchentlich, alle 2 bis 4 Wochen oder monatlich – am gleichen Tag (z. B. jeden 15.) oder am gleichen Wochentag (z. B. 2. Dienstag). Bei wöchentlich wählt ihr die **Wochentage**.
- **Beginn, Ende** und optional **Mitglied / Trainer.**

„Prüfen“ zeigt vorab, wie viele Termine entstehen und an welchen Tagen der Platz schon belegt ist (diese Tage werden ausgelassen). Erst „Serie anlegen“ trägt sie ein.

#### + Sperre über Zeitraum

![Das Fenster „Sperre über einen Zeitraum“.](bild: seite=bk-serien; klick=#srLock; ziel=dialog)

Aufgebaut wie die Serie, aber ohne Buchungsart-Pflicht: Platzpflege im Frühjahr, Winterpause, ein Turnierwochenende. Die Vorschau zeigt, welche Buchungen von Mitgliedern betroffen sind – sie werden mit „Sperren“ storniert und die Mitglieder informiert.

#### Spielplan importieren

![Das Fenster „Spielplan importieren“: Tabelle einfügen oder Datei wählen.](bild: seite=bk-serien; klick=#srImp; ziel=dialog)

Die Heimspiele der Mannschaften landen ohne Tipparbeit im Belegungsplan.

1. Auf der Verbandsseite (z. B. nuLiga „Begegnungen“) die Tabelle markieren, kopieren und in das Feld einfügen. Oder eine Datei wählen: CSV, Excel oder Kalender (.ics, z. B. von fussball.de).
2. „Einlesen“. Im Fenster „Spielplan prüfen“ stehen oben euer Vereinsname (danach richtet sich „Heimspiel“) und eine Buchungsart. Darunter je Mannschaft die Plätze und die Dauer – Clubwerk schlägt sie aus der Liga vor („6er“ = drei Plätze, fünf Stunden) und merkt sich eure Vorgaben. In der Spieleliste sind neue Heimspiele angehakt; Spiele ohne Uhrzeit, vergangene und schon eingetragene sind grau.
3. „Prüfen“ zeigt, wie viele Spiele neu oder verlegt sind, welche Buchungen von Mitgliedern auf Spielzeiten liegen (werden storniert) und ob gleichzeitige Spiele auf andere Plätze verteilt wurden. Dann „Übernehmen“.

Ein späterer Import erkennt verlegte Spiele und verschiebt sie. Ist das Modul „Spielbetrieb“ eingeschaltet, übernimmt es dabei auch die Auswärtsspiele als Spieltage.

### Reiter „Buchungen“ {#bk-protokoll}

![Der Reiter „Buchungen“, hier gefiltert auf „Mit Gast“: Filter, Suche, Jahr, Platz und die Liste.](bild: seite=bk-protokoll; klick=#lgF [data-f="gast"])

Das Protokoll aller Buchungen eines Jahres, auch stornierter und Sperren, nach Tag gruppiert. Die Spalten:

| Spalte | Inhalt |
|---|---|
| Spieler / Buchungsart | Die Spieler mit Foto oder Initialen; bei Vereinsbuchungen Titel oder Buchungsart. Der farbige Streifen links ist die Farbe der Buchungsart |
| Platz | Platz oder Gerät, dazu Kärtchen für Buchungsart, Sperre, Serie, Gäste und Gebühr |
| Termin | Uhrzeit und Tag |
| Status | Anstehend, Läuft gerade, Abgeschlossen oder Storniert (mit wer, wann und warum) |
| Eingetragen | Wann, und über App, Tablet oder Verwaltung |

- **Filter:** Alle · Mitglieder · Mit Gast · Buchungsarten · Sperren · Storniert.
- **Suche** nach Name, Platz oder Buchungsart; **Jahr**, **Platz** und **Sortierung** (nach Termin oder nach Eintragung) darunter.
- **Excel** (rechts oben) lädt die gefilterte Liste als Tabelle herunter.
- Eine Zeile anklicken öffnet die Buchung wie im Belegungsplan, mit Stornieren und Bearbeiten. Angezeigt werden zunächst 200 Einträge, „Weitere laden“ holt mehr.

### Reiter „Gebühren“ {#bk-gebuehren}

![Der Reiter „Gebühren“ mit drei Summen und der Liste der Gebühren.](bild: seite=bk-gebuehren)

Alle Gast- und Platzgebühren aus Buchungen sowie von Hand gebuchte Gebühren. Oben stehen die Summen **Offen**, **Bezahlt** und **Gesamt** des Jahres, darunter die Liste (Mitglied, Datum, Platz, Text, Betrag, Status). Mit den Filtern „Alle / Offen / Bezahlt“ und der Jahresauswahl grenzt ihr ein.

Gebühren entstehen beim Buchen als offene Posten und werden mit dem nächsten Einzug abgerechnet. Den Zahlungsstand zeigt Clubwerk aus Beiträge & Zahlungen › Offene Posten. Ohne die Mitgliederverwaltung steht „ohne Zahlungsverfolgung“ da, die Gebühren werden nur aufgelistet. Eine Zeile anklicken öffnet die zugehörige Buchung.

#### + Gebühr buchen

![Das Fenster „Gebühr buchen“.](bild: seite=bk-gebuehren; klick=#feNew; ziel=dialog)

Für eine Gebühr ohne Buchung, z. B. eine Hallenmiete: Person, Betrag (zwischen 0,10 € und 1.000 €), Datum und Text. Bei Mitgliedern entsteht eine Forderung, die wie ein Beitrag eingezogen wird. Bei Trainern („Kein Mitglied“) kommt der Betrag aufs Verkaufskonto. Nötig ist das Recht „für Mitglieder buchen“.

Von Hand gebuchte Gebühren haben in der Zeile den Knopf **Stornieren**; die Rückfrage nennt den Betrag, der offene Posten wird zurückgenommen.

### Reiter „Auswertung“ {#bk-auswertung}

Die Auslastung im Jahresvergleich. Oben wählt ihr **Jahr** und **Platz**; alles wird mit dem Vorjahr verglichen (grün besser, rot schlechter). Im laufenden Jahr zählt die Auslastung bis heute.

#### Kennzahlen

Vier Kacheln: **Gebuchte Stunden**, **Auslastung** (gebuchte im Verhältnis zur buchbaren Zeit, ohne Sperren), **Buchungen** und **Storniert**. Die Kurve zeigt die zwölf Monate, gestrichelt das Vorjahr.

![Die vier Kennzahlen mit Kurve und Vergleich zum Vorjahr.](bild: seite=bk-auswertung; ziel=.bk-kpis)

Darunter stehen die Höhepunkte: Stoßzeit, beliebtester Tag, beliebtester Platz sowie durchschnittliche Dauer und Vorlauf einer Buchung.

![Die Höhepunkte des Jahres.](bild: seite=bk-auswertung; ziel=.bk-hl)

#### Auslastung je Platz und Verwendung

Links die Auslastung jedes Platzes (der Strich ist das Vorjahr) und darunter, wie viele Spieler, Buchungen mit Gästen und Buchungen mit Buchungsart es gab. Rechts zeigt der Ring, wofür die Plätze genutzt werden: normale Buchungen, Training, Medenspiele …

![Die Auslastung je Platz und die Verwendung nach Art und Buchungsart.](bild: seite=bk-auswertung; ziel=.bk-two)

#### Jahreskalender, Monate, Rangliste

Der Jahreskalender färbt jeden Tag nach gebuchten Stunden (je dunkler und röter, desto mehr). Darunter zeigen Balken die Stunden je Monat gegen das Vorjahr und „Wer spielt am meisten?“ die Rangliste der Spieler.

![Das Jahr als Kalender: jedes Feld ist ein Tag.](bild: seite=bk-auswertung; ziel=.bk-heatwrap)

#### Wann wird gespielt?

Je Wochentag und Uhrzeit ein Kreis: je größer und dunkler, desto mehr gebuchte Stunden im Jahr. Das hilft bei Öffnungszeiten und beim Planen von Training.

![„Wann wird gespielt?“: Größe und Farbe zeigen die gebuchten Stunden je Wochentag und Uhrzeit.](bild: seite=bk-auswertung; klick=.bk-bub > .bc:last-child; ziel=.bk-bub)

### Reiter „Plätze & Geräte“ {#bk-plaetze}

![Der Reiter „Plätze & Geräte“ mit Name, Buchbarkeit, Raster, Gastgebühr und kommenden Buchungen.](bild: seite=bk-plaetze)

Alles, was gebucht werden kann. Die Liste zeigt je Zeile Name und Bereich (Hinweise wie „Mitspieler Pflicht“ oder die Abteilung stehen darunter), **Buchbar** (Tage und Zeiten), **Raster** (Zeitraster und Höchstdauer), **Gastgebühr** und die Zahl **kommender** Buchungen. Mit **↑ ↓** legt ihr die Reihenfolge fest – so stehen die Plätze im Plan, in der App und am Tablet. Neue Plätze kommen ans Ende. Alles hier braucht das Recht „Plätze, Buchungsarten & Einstellungen“.

![Das Fenster zum Bearbeiten eines Platzes.](bild: seite=bk-plaetze; klick=[data-ed]; ziel=dialog)

#### + Platz und + Gerät

Beide öffnen dasselbe Fenster, das mit „Bearbeiten“ auch einen bestehenden Platz öffnet:

- **Name** und **Bereich:** Der Bereich ist der Reiter in der App, z. B. „Tennis“ und „Padel“. Alle Plätze eines Bereichs stehen nebeneinander.
- **Art:** Platz oder Gerät.
- **Buchbar an** (Wochentage), **Von / Bis** (Öffnungszeit).
- **Zeitraster:** in welchen Schritten gebucht wird (15 Minuten bis 2 Stunden).
- **Höchstdauer am Stück** (bis 8 Stunden).
- **Anzahl:** bei Geräten, wie viele gleichzeitig buchbar sind (zwei Ballmaschinen = 2).
- **Gastgebühr je Gast:** leer = der Standard aus den Einstellungen.
- **Hinweis für Mitglieder:** erscheint beim Buchen, z. B. „Sand – nach dem Spiel abziehen“.
- **Gehört der Abteilung** (erscheint, sobald es Abteilungen gibt): Mitglieder der Abteilung buchen kostenlos; für **andere Mitglieder** wählt ihr „buchen mit Platzgebühr“ (Betrag je Person) oder „dürfen nicht buchen“.
- **Aktiv:** inaktive Plätze sind nicht buchbar und nicht im Plan.

Nur bei **Plätzen**: **Mitspieler** „optional“ oder „Pflicht“, und **Allein trainieren erlaubt, Bezeichnung** (z. B. „Ballwand“; leer = nein). Nur bei **Geräten**: **Als Mitspieler buchbar** – z. B. die Ballmaschine, die beim Buchen als „Mitspieler“ gewählt wird und im selben Zeitfenster mitgebucht ist.

„Löschen“ geht nur, wenn keine kommenden Buchungen, Serien oder Sperren mehr auf dem Platz liegen; vergangene bleiben im Protokoll und in der Auswertung erhalten. Sonst den Platz auf „inaktiv“ setzen.

### Reiter „Einstellungen“ {#bk-einstellungen}

Die Regeln fürs Buchen, in Karten gegliedert. **Jede Karte hat ihr eigenes „Speichern“.** Nötig ist das Recht „Plätze, Buchungsarten & Einstellungen“.

#### Buchen

Drei Zahlen und eine Auswahl:

- **Vorlauf (Tage im Voraus):** wie weit Mitglieder im Voraus buchen dürfen (Standard 7).
- **Offene Platzbuchungen je Mitglied** und **Offene Gerätebuchungen je Mitglied:** das Kontingent – wie viele kommende Buchungen jemand gleichzeitig haben darf (Standard 2). So kann niemand alle Plätze blockieren.
- **Stornieren bis … vor Beginn:** bis zum Beginn, 1, 2 oder 6 Stunden oder 1 Tag vorher. Gilt für Mitglieder in App und Tablet; die Verwaltung kann immer stornieren.

Vereinstermine (Training, Medenspiel) ignorieren Vorlauf und Kontingent, siehe „Buchungsarten“.

![Karte „Buchen“: Vorlauf, Kontingent und Stornierfrist.](bild: seite=bk-einstellungen; ziel=[data-card="buchen"])

#### Mitspieler & Gäste

- **Mitspieler höchstens**, **Gäste höchstens** je Buchung.
- **Gastgebühr je Gast (Standard):** gilt, wo am Platz keine eigene steht. Sie ist ein offener Posten beim buchenden Mitglied und entfällt bei einer Stornierung.
- **Mitspieler zählen beim Kontingent mit:** Wer mitspielt, kann dann nicht gleichzeitig selbst buchen.
- **Mitspieler bekommen eine E-Mail**, wenn sie eingetragen werden.

![Karte „Mitspieler & Gäste“.](bild: seite=bk-einstellungen; ziel=[data-card="mitspieler"])

#### Warteliste

Ist sie an, kann sich ein Mitglied eine belegte Zeit vormerken und bekommt eine E-Mail (und Push), sobald sie frei wird – in der App steht dann „Platz frei geworden“ mit dem Hinweis, schnell zu buchen. **Einträge je Mitglied** begrenzt die Zahl der Vormerkungen (Standard 3). Ist die Warteliste aus, bleibt nur der Schalter.

![Karte „Warteliste“.](bild: seite=bk-einstellungen; ziel=[data-card="warteliste"])

#### Wer darf buchen?

Mit der Mitgliederverwaltung legt ihr hier fest, wer buchen darf – die buchende Person **und** alle Mitspieler:

- **Mitgliedschaft:** aktiv, Ehrenmitglied, passiv / unterstützend, ruhend (Standard: aktiv und Ehrenmitglied).
- **Beitragsarten, die nicht buchen dürfen:** z. B. „Fördermitglied“.

Die Verwaltung kann immer für jeden buchen.

**Sonderrechte in der Mitglieder-App** gelten einzelnen Mitgliedern, z. B. Trainern. Unter der Karte steht die Liste mit Mitglied und Rechten; Stift und Papierkorb ändern oder entziehen sie.

![Karte „Wer darf buchen?“ mit Mitgliedschaft, Beitragsarten und Sonderrechten.](bild: seite=bk-einstellungen; ziel=[data-card="wer"])

Mit **„+ Sonderrecht“** wählt ihr ein Mitglied und erlaubt ihm in der App:

- **Serien anlegen** (wöchentlich bis zu einem Jahr, belegte Termine werden übersprungen),
- **für andere buchen** (z. B. für ein Mitglied ohne Handy; Kontingent, Regeln und Gebühren gelten dann für dieses Mitglied),
- **mit allen Buchungsarten buchen** (auch künftigen) oder nur mit einzelnen, die ihr anhakt,
- bei Trainern („Kein Mitglied“): **die Plätze bestimmter Abteilungen buchen**, ohne Gebühren und Kontingent.

Änderungen gelten sofort und müssen nicht gespeichert werden.

![Das Fenster „Sonderrecht vergeben“.](bild: seite=bk-einstellungen; klick=#rtNew; ziel=dialog)

#### Buchungsarten

Eine Buchungsart kennzeichnet Vereinsbuchungen mit Name und Farbe, z. B. Training, Medenspiel, Kurs, Turnier oder Platzpflege. Die Liste zeigt Name, **wer sie nutzen darf** und die Zahl kommender Termine. „Bearbeiten“ öffnet das Fenster, „+ Neue Buchungsart“ legt eine neue an.

![Karte „Buchungsarten“: Name, wer buchen darf und kommende Termine.](bild: seite=bk-einstellungen; klick=#lbList tr:last-child td:first-child; ziel=[data-card="arten"])

#### Buchungsart anlegen und bearbeiten

Im Fenster legt ihr fest:

![Das Fenster „Neue Buchungsart“ mit Farbe, Vorschau und der Wahl, wer sie nutzen darf.](bild: seite=bk-einstellungen; klick=#lbNew; klick2=#lbU [data-u="auswahl"]; ziel=dialog)

- **Name**, **Reihenfolge**, **Farbe** (20 Farben oder „Eigene“) mit **Vorschau.** Die Schrift passt sich der Farbe an, damit sie lesbar bleibt.
- **Wer darf mit dieser Buchungsart buchen?**
  - *Nur Verwaltung:* Mitglieder sehen sie in der App nicht.
  - *Alle Mitglieder:* jeder, der buchen darf, kann sie in der App wählen (z. B. „Clubmeisterschaft“).
  - *Bestimmte Ämter & Personen:* nur Mitglieder mit einem der gewählten Ämter (aus der Mitgliederverwaltung, z. B. „Trainer“) oder einzeln gewählte Personen.
- **Vereinstermin:** ohne Höchstdauer, Kontingent, Vorlauf und Gebühren – z. B. ein Medenspiel über fünf Stunden, drei Wochen im Voraus, Gegner als Gäste ohne Gastgebühr.
- **Aktiv:** inaktive Buchungsarten sind nicht mehr wählbar, bestehende Termine behalten sie.
- **Löschen** geht nur, solange die Buchungsart nicht verwendet wird; sonst auf „inaktiv“ setzen.

#### Tablet & Mitglieder-App

- **Am Tablet im Vereinsheim buchen:** Name und PIN genügen, die Regeln sind dieselben wie in der App. Aus: Das Tablet zeigt den Plan, aber gebucht wird nur in der App.
- **Namen in der Belegung für alle Mitglieder sichtbar:** Aus: Mitglieder sehen nur „belegt“.
- **In der App „Jetzt auf der Anlage“ zeigen:** die Zeile über dem Plan, wer gerade spielt und wer gleich kommt.

Von unterwegs buchen geht, sobald die Mitglieder-App von außen erreichbar ist (Verein › Mitglieder-App).

![Karte „Tablet & Mitglieder-App“.](bild: seite=bk-einstellungen; klick=[data-card="app"] h3; ziel=[data-card="app"])

#### Platzordnung

Ein Text (z. B. „Bitte nur mit Tennisschuhen spielen“), der vor jeder Buchung erscheint und mit dem Haken „Ich halte mich an die Platzordnung“ bestätigt werden muss. Leer lassen, wenn ihr keine braucht.

![Karte „Platzordnung“.](bild: seite=bk-einstellungen; klick=[data-card="ordnung"] h3; ziel=[data-card="ordnung"])

#### Einstellungen übertragen

Plätze, Buchungsarten und Einstellungen als Datei exportieren und in einer anderen Clubwerk-Installation importieren, z. B. für einen zweiten Verein oder nach einer Neuinstallation (ohne Buchungen, PINs und Passwörter). Beim Import werden die bisherigen Einstellungen ersetzt; Plätze und Buchungsarten mit gleichem Namen bleiben, wie sie sind.

![Karte „Einstellungen übertragen“.](bild: seite=bk-einstellungen; klick=#bkFunc h3; ziel=#bkFunc .card)

## Tablet und App {#tablet-app}

![Der Bereich „Plätze“ in der Mitglieder-App, hier mit den freien Zeiten von morgen.](bild: app=buchung; klick=.vh-days button:nth-child(2); klick2=.bkm-view [data-v="zeiten"])

![Der Reiter „Plätze“ am Tablet im Vereinsheim.](bild: tablet=Plätze; hoehe=560)

**In der App** (Bereich „Plätze“) steht die eigene nächste Buchung groß oben („Ändern“ öffnet sie). Darunter wählt das Mitglied einen Tag bis zum Vorlauf, bei mehreren Bereichen (z. B. Tennis und Padel) den Bereich und eine Ansicht: **Freie Zeiten** (eine Zeile je Uhrzeit, je Platz ein Kästchen), **Kompakt** (alle Plätze nebeneinander) oder **Ausführlich** (breite Spalten mit ganzen Namen, seitlich wischen; die Wahl merkt sich das Handy). Eine Zeile „Jetzt auf der Anlage“ zeigt, wer gerade spielt.

- **Buchen:** freie Stelle antippen, Dauer wählen (nur bis zur nächsten Buchung oder zur Höchstdauer), auf Wunsch Mitspieler, Gäste (mit Namen; der Haken „Mitglied in einem Partnerverein“ spart die Gebühr) oder ein Gerät („Ballmaschine“) bzw. „allein“ (z. B. Ballwand) hinzufügen. Wer das Sonderrecht hat, kann auch für ein anderes Mitglied buchen oder wiederholen. Ein Preisfeld zeigt vorab Gastgebühr und eventuelle Platzgebühr, dann die Platzordnung bestätigen und „Buchen“.
- **Belegte Zeit antippen:** zeigt, wer gebucht hat (je nach Einstellung), und bietet „Vormerken“ für die Warteliste.
- **Meine Buchungen:** mit Symbolen für Kalender (die Buchung landet im Handykalender), Ändern und Stornieren; darunter „Meine Serien“ mit „Beenden“ und „Warteliste“ mit „Entfernen“.
- **Push:** Das Mitglied kann sich benachrichtigen lassen, wenn es als Mitspieler eingetragen wird, wenn eine Buchung geändert oder storniert wird (auch durch eine Platzsperre), wenn ein Platz von der Warteliste frei wird und kurz vor dem Spiel (Vorlauf 2 Stunden, einstellbar). Welche Anlässe es gibt, legt der Vorstand unter Mitglieder-App › Benachrichtigungen fest.
- Ist ein Mitglied gesperrt (Mitgliedschaft oder Beitragsart darf nicht buchen), steht oben der Hinweis, sich an den Vorstand zu wenden.

**Am Tablet** (Reiter „Plätze“) sieht man denselben Plan. Eine freie Stelle antippen, den eigenen Namen suchen (erst ab zwei Buchstaben), die **PIN** eingeben und buchen; wer noch keine PIN hat, legt sie gleich fest. Eine Buchung antippen und „Stornieren“ geht ebenfalls mit PIN. Bei Serien fragt das Tablet: „Nur heute“, „Heute und alle folgenden“ oder „Gesamte Serie“. Über dem Plan lassen sich wie in der App weitere Tage bis zum Vorlauf wählen; nach 2 Minuten ohne Eingabe springt das Tablet auf heute zurück.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Plätze: Belegung ansehen | Belegung, Buchungen, Gebühren und Auswertung ansehen |
| Plätze: für Mitglieder buchen, Einzelbuchungen mit Buchungsart | Buchungen und Sperren eintragen und bearbeiten, Gebühren von Hand buchen und stornieren |
| Plätze: Buchungen anderer stornieren | Buchungen und Sperren stornieren |
| Plätze: Serien & Sperren anlegen und beenden | Serien, Sperren und Spielplan-Import; Wiederholungen im Buchungsfenster |
| Plätze: Plätze, Buchungsarten & Einstellungen | Reiter „Plätze & Geräte“ und „Einstellungen“ mit Buchungsarten und Sonderrechten |

Mitglieder und Trainer buchen in der App und am Tablet ohne Verwaltungsrecht. Wer nur die Belegung sehen darf, sieht den Plan, kann aber nichts eintragen.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Mitglieder:** Namen, Mitgliedschaft, Beitragsarten und Ämter kommen von dort, ebenso Zahlungsstand und Einzug der Gebühren (Beiträge & Zahlungen › Offene Posten). Beim Zusammenführen doppelter Mitglieder wandern Buchungen, Serien, Warteliste und Gebühren mit. Beim Löschen eines Mitglieds fällt die Warteliste weg und seine Serien laufen als Vereinstermin weiter; vergangene Buchungen bleiben als Verlauf. In der Datenauskunft eines Mitglieds stehen seine Buchungen, Gebühren, Warteliste und Sonderrechte. Die Aufzeichnung dazu erscheint unter Einstellungen › Datenschutz.
- **Verkauf:** Gebühren von Trainern und ohne Mitgliederverwaltung kommen aufs Verkaufskonto und werden dort abgerechnet.
- **Spielbetrieb:** Der Spielplan-Import überträgt Spiele auch an den Spielbetrieb (Spieltage, Mannschaften).
- **Turniere:** Das Modul bucht die Plätze für Spiele (Clubmeisterschaft) und sperrt sie an Turniertagen – mit Vorschau, welche Buchungen betroffen sind. Turnierspiele sind Vereinstermine ohne Gebühr.
- **Mängel:** Die Plätze und Geräte erscheinen dort automatisch als Orte.
- **Einrichtung und Übersicht:** Der Einrichtungs-Assistent führt durch „Plätze anlegen“ und „Regeln fürs Buchen“. Die Übersicht zeigt offene Gebühren und die Buchungen von heute.
- **Mitglieder-App:** Auf „Für mich“ stehen die eigenen nächsten Buchungen, frei gewordene Plätze von der Warteliste und Buchungen, die eine Platzsperre storniert hat.
