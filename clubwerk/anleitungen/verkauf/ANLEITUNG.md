# Verkauf und Lager
<!-- kurz: Am Tablet buchen statt Strichliste – Konten, Deckel, Veranstaltungen, Abrechnung, Lieferungen, Bestand und Bestellung. -->

## Wofür ist das Modul? {#wofuer}

Der Verkauf ersetzt die Strichliste an der Theke. Mitglieder tippen am Tablet ihren Namen an, geben ihre PIN ein, tippen ihre Getränke, Snacks oder Bälle an und buchen. Gäste schreiben auf einen Deckel an oder zahlen bar. In der Verwaltung seht ihr alle Buchungen, rechnet die Konten ab, führt Veranstaltungen und wertet den Umsatz aus. Unter **Lager** laufen Lieferungen, Bestand, Inventur und Bestellung.

Das Modul läuft allein. Ohne die Mitgliederverwaltung legt ihr die Konten im Reiter „Konten“ selbst an und rechnet von Hand ab (Excel oder Abtippliste). Mit der Mitgliederverwaltung kommen die Mitglieder von dort, und ihr könnt den Verkauf per Lastschrift einziehen.

Die Verwaltung des Verkaufs hat zwei Menüpunkte im Menü links: **Verkauf** (Buchungen, Abrechnung, Veranstaltungen & Deckel, Konten, Auswertung, Einstellungen) und **Lager** (Bestellung, Lieferungen & Belege, Bestand & Inventur, Artikel). Es ist trotzdem ein einziges Modul mit einem einzigen Schalter.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Verkauf“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Tablet-Passwort festlegen:** Einstellungen › Tablet. Ohne Passwort bleibt das Tablet gesperrt.
3. **Artikel anlegen:** Lager › Artikel. Entweder einzeln mit „+ Neuer Artikel“ oder mit „Import …“ aus einer Excel-Liste.
4. **Reihenfolge der Kategorien** einstellen: Verkauf › Einstellungen. So erscheinen die Kacheln am Tablet.
5. **Konten anlegen:** Verkauf › Konten (mit Mitgliederverwaltung kommen die Mitglieder von dort). Wer am Tablet eintippt, braucht eine PIN, die er beim ersten Buchen selbst festlegt.
6. **Rechte vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer abrechnen, bestellen oder Lieferungen erfassen soll, die passenden Rechte (siehe unten). Dann ist das Tablet einsatzbereit.

## Verwaltung {#verwaltung}

Oben stehen die Reiter des Verkaufs: **Buchungen**, **Abrechnung**, **Veranstaltungen & Deckel**, **Konten**, **Auswertung** und **Einstellungen**. Jeder Reiter erscheint nur, wenn ihr das passende Recht habt. Der Reiter „Konten“ gehört zu den Konten & PINs und hat eine eigene Anleitung.

### Seite „Buchungen“ {#buchungen}

![Die Reiter des Verkaufs, links „Buchungen“.](bild: seite=buchungen; ziel=.tabrow:has(> .drinktabs))

Hier steht jede einzelne Buchung des Zeitraums. Falschbuchungen stornierst du hier, vergessene Buchungen trägst du nach. Die Liste zeigt zuerst 150 Einträge, „Weitere laden“ holt den Rest.

#### Zeitraum und Konto wählen

![Zeitraum und Konto-Filter.](bild: seite=buchungen; ziel=#rng)

Mit **Von** und **Bis** und „Anzeigen“ wählst du den Zeitraum, „Ganze Saison“ geht vom 1. Januar bis heute. Darunter schränkt **Nur Konto** die Liste auf eine Person oder Mannschaft ein. Dann steht dort zusätzlich eine Summe: wie viele Stück und wie viel Geld das Konto im Zeitraum auf der Rechnung hat.

#### Liste

Die Spalten: **Zeit**, **Konto** (bei einer Veranstaltung steht deren Name darunter), **Art**, **Artikel**, **Menge**, **Betrag**. Die Art zeigt, wohin die Buchung geht:

| Art | Bedeutung |
|---|---|
| Konto | auf das Konto einer Person oder Mannschaft, wird mit der Abrechnung bezahlt |
| Verein frei | kostenfrei für den Verein, wird nur gezählt (Bestand stimmt weiter) |
| Gast bar | ein Gast hat bar bezahlt |
| Deckel · offen / bar / Karte / abgeschrieben | Buchung auf einem Gäste-Deckel und sein Stand |
| Veranstaltung / Liste · offen / bar / Karte | Buchung bei einer Veranstaltung |
| von Deckel / Veranstaltung übernommen | wurde auf ein Konto übernommen |
| abgerechnet | steht schon in einer Abrechnung |

Stornierte Buchungen bleiben grau stehen mit dem Vermerk, wer storniert hat.

#### Nachtragen

![Karte „Nachtragen“.](bild: seite=buchungen; ziel=.card:has(#nbSave))

Hier trägst du etwas nach, das am Tablet vergessen wurde: **Konto**, **Artikel**, **Menge** und **Datum**, dann „Nachtragen“. Wählst du als Artikel „freier Betrag“, erscheinen stattdessen **Betrag €** und **Wofür?** (z. B. Startgeld). Nachgetragen wird nur auf aktive Konten.

#### Storno

![Rückfrage beim Stornieren einer Buchung.](bild: seite=buchungen; klick=[data-cx]; ziel=#askBox)

Der Knopf „Storno“ nimmt eine Buchung zurück: Der Betrag verschwindet vom Konto, der Artikel kommt wieder in den Bestand. Ist die Buchung **schon abgerechnet**, sagt Clubwerk dir, in welcher Abrechnung sie steckt. Du hast dann diese Möglichkeiten:

- **Gutschrift buchen:** Der Betrag wird bei der nächsten Abrechnung vom Konto abgezogen.
- **Lauf zurücknehmen und stornieren:** Gibt es einen Verkaufs-Einzug, aus dem noch nichts eingezogen wurde, nimmst du lieber den ganzen Lauf zurück. Die Buchung wird dann normal storniert, die übrigen Konten des Laufs sind wieder offen.
- Ist der zugehörige Posten in der Mitgliederverwaltung schon storniert, wird die Buchung ohne neue Gutschrift storniert.

> Die Kasse am Tablet kann nur nicht abgerechnete Buchungen zurücknehmen („Rückgängig“). Danach ist immer die Verwaltung zuständig. Für gelöschte Konten lehnt Clubwerk das Stornieren ab: Erstattet den Betrag bar und korrigiert den Bestand bei Bedarf unter Lager › Bestand.

### Seite „Abrechnung & Export“ {#abrechnung}

![Die Reiter des Verkaufs mit den Knöpfen der Abrechnung rechts daneben.](bild: seite=abrechnung; ziel=.tabrow:has(> .drinktabs))

Hier rechnet ihr ab: Liste holen, in der Vereinsverwaltung abbuchen, hier als abgerechnet markieren. Die Liste zeigt genau den Stand von „Stand der Liste“. Was danach am Tablet gebucht wird, bleibt für die nächste Abrechnung offen.

#### Knöpfe oben

Die Knöpfe stehen rechts neben den Reitern (siehe Bild oben).

- **Liste aktualisieren** holt den aktuellen Stand.
- **+ Betrag auf Konto** bucht einen freien Betrag mit Text (Essen, Startgeld, eine Kiste fürs Fest) auf ein Konto. Er wird bezahlt wie jede Tablet-Buchung.
- **Abtippliste** öffnet die Liste zum Übertragen von Hand (siehe unten).
- **Alle als abgerechnet markieren** schließt alle Konten der Liste ab. Das darf nur, wer das Recht „Abrechnung“ hat.
- **Excel** lädt die Abrechnung als Excel-Datei: eine Zeile je Konto mit den Mengen je Kategorie, dazu die Blätter „Buchungen“, „Abgleich“ und „Veranstaltungen“ für den gewählten Zeitraum.

![Das Fenster „Betrag auf ein Konto buchen“.](bild: seite=abrechnung; klick=#addAmt; ziel=dialog)

#### So geht's

![Die aufklappbare Kurzanleitung.](bild: seite=abrechnung; klick=details.howto summary; ziel=details.howto)

Unter „So geht's“ steht der Ablauf in drei Schritten: Excel herunterladen oder Abtippliste öffnen, in der Vereinsverwaltung abbuchen, hier die Konten als abgerechnet markieren. Ihr offener Betrag steht danach auf 0.

#### Kennzahlen

![Die vier Kennzahlen oben.](bild: seite=abrechnung; ziel=.kpis)

**Offen gesamt**, **Konten mit offenem Betrag**, **Stand der Liste** (Uhrzeit, bis zu der abgerechnet wird) und **Zuletzt abgerechnet**. Haben Mitglieder noch offene Beträge auf einer Veranstaltungsliste, warnt ein roter Hinweis: Diese Beträge erscheinen erst nach der Übernahme auf die Konten (siehe Veranstaltungen & Deckel) – am besten vor dem Export.

#### Per Lastschrift einziehen

![Karte „Per Lastschrift einziehen“.](bild: seite=abrechnung; ziel=.card:has(#sepaGo))

Diese Karte gibt es nur mit der Mitgliederverwaltung und dem Recht „Mitglieder: Finanzen“. Ein Fenster zeigt in einem Rutsch, wer wie viel zahlt (Angehörige beim Zahler) und schlägt den frühesten Einzugstag vor. Es listet klar auf, was **nicht** per Lastschrift geht (kein oder widerrufenes Mandat, Mannschaften, „Kein Mitglied“) und was dann zu tun ist. Ein Klick erstellt die SEPA-Datei, getrennt von den Beiträgen. Die eingezogenen Konten werden dabei als abgerechnet markiert. Ein verworfener Einzug fragt, ob der Lauf gleich zurückgenommen werden soll.

#### Liste der offenen Konten

Die Tabelle zeigt je Konto: **Konto**, **offen seit**, die Stückzahlen je **Kategorie** (in eurer Reihenfolge), **Betrag** und – mit dem Recht „Abrechnung“ – den Knopf **abgerechnet**. Die Summe steht unten. Mannschaften tragen die Markierung „Mannschaft“. Rot markiert ist, was zusätzlich noch auf einer Veranstaltungsliste offen ist. Mit **abgerechnet** schließt du ein einzelnes Konto ab, Clubwerk fragt vorher nach.

![Rückfrage beim Abrechnen eines Kontos.](bild: seite=abrechnung; klick=[data-settle]; ziel=#askBox)

#### Abtippliste

![Die Abtippliste: Der fertige Buchungstext zum Kopieren (darunter folgen die Konten zum Abhaken).](bild: seite=abrechnung; klick=#abtipp; ziel=#dialog .row:has(#btCopy))

Für die Vereinsverwaltung ohne Einzug: Die Liste ist nach Nachname sortiert, Mannschaften stehen am Ende. Über der Liste steht der fertige **Buchungstext**. Er lässt sich als Vorlage ändern (Platzhalter `{von}`, `{bis}`, `{jahr}`, `{verein}`) und mit „Buchungstext kopieren“ übernehmen. Ein Tipp auf einen Betrag kopiert ihn. Mit dem Kästchen hakst du ab, was schon eingetragen ist (der Haken gilt auf diesem Gerät und nur, solange der Betrag gleich bleibt). „Drucken / als PDF speichern“ macht eine Papierliste.

#### Offene Verkaufs-Posten in der Mitgliederverwaltung

Schon abgerechnete oder von Hand angelegte Posten, die noch nicht bezahlt sind, stehen in einer eigenen Karte (Zahler, Posten, fällig, Betrag). Sie kommen mit dem nächsten Einzug mit. Diese Karte erscheint nur, wenn es solche Posten gibt.

#### Bisherige Abrechnungen

![Karte „Bisherige Abrechnungen“.](bild: seite=abrechnung; klick=.card:has([data-undo]) h3; ziel=.card:has([data-undo]))

Jeder Abrechnungslauf mit Datum, Konten, Betrag und wer ihn gemacht hat. **Rückgängig** macht ihn zurück: Die Beträge sind danach wieder offen. Das geht nicht für Läufe, die als Lastschrift-Einzug entstanden sind (die nimmt man in der Mitgliederverwaltung zurück: „Lauf zurücknehmen“), und auch nicht, wenn ein Mitglied aus dem Lauf inzwischen gelöscht wurde.

#### Auswertung für einen Zeitraum

![Karte „Auswertung für einen Zeitraum“.](bild: seite=abrechnung; klick=#main > .card:last-child h3; ziel=#main > .card:last-child)

Wähle Von und Bis. Die Kennzahlen gelten auch für die Blätter in der Excel-Datei: **Auf Konten gebucht**, **Gäste bar & Deckel**, **Veranstaltungen (Soll)** und **Kostenfrei (Wert)**.

### Seite „Veranstaltungen & Deckel“ {#veranstaltungen}

![Die Reiter des Verkaufs, „Veranstaltungen & Deckel“ ist gewählt.](bild: seite=veranstaltungen; ziel=.tabrow:has(> .drinktabs))

Eine Veranstaltung (Turnier, Sommerfest, Löffelcup …) bekommt eigene Preise und eine eigene Abrechnungsliste. Am Tablet tragen sich die Leute ein und schreiben an, hier wird bezahlt abgehakt. Wer nur das Recht „Abrechnung“ oder „Export“ hat, sieht hier nur die Deckel.

#### Neue Veranstaltung

![Karte „Neue Veranstaltung“.](bild: seite=veranstaltungen; ziel=.card:has(#evAdd))

Name, Datum und – bei **Artikel & Preise übernehmen von** – entweder „alle Artikel zum Normalpreis“ oder eine frühere Veranstaltung mit deren Artikelauswahl und Preisen. „Anlegen“ erstellt sie. Dann prüfst du Artikel & Preise und schaltest sie scharf.

#### Die Karte einer Veranstaltung

![Kopf einer Veranstaltung: Name, Zustand und Knöpfe.](bild: seite=veranstaltungen; ziel=[data-evcard] > .row)

Die Überschrift nennt Name und Datum, dahinter steht der Zustand: **aktiv – Tablet bucht auf diese Liste**, **nicht aktiv** oder **Kasse abgeschlossen**. Rechts davon stehen die Knöpfe (mit dem Recht „Veranstaltungen“):

- **Artikel & Preise (n):** Nur angehakte Artikel erscheinen während der Veranstaltung am Tablet, mit dem Preis aus der rechten Spalte. „alle Artikel“ und „keine“ haken alles an oder ab.
- **Aktivieren / Deaktivieren:** Solange eine Veranstaltung aktiv ist, zeigt das Tablet nur deren Liste und bucht darauf.
- **Kasse zählen & abschließen:** Du trägst das gezählte Bargeld ein (leer lassen, wenn nicht getrennt gezählt). Clubwerk rechnet die Differenz zum Soll aus. Nach dem Abschluss lassen sich offene Beträge weiter abhaken oder übernehmen. Der Knopf heißt dann „Kasse neu zählen“.
- **Löschen:** nur bei nicht aktiven Veranstaltungen. Wurde schon gebucht, verschwindet sie nur aus der Liste, Umsatz und Bestand bleiben in den Auswertungen.

Darunter stehen fünf Kennzahlen: **Umsatz**, **Bar (gehört in die Kasse)** (mit „davon … ohne Namen“ und der gezählten Kasse samt Differenz), **Mit Karte bezahlt**, **Auf Konten übernommen** und **Noch offen**.

![Die fünf Kennzahlen einer Veranstaltung.](bild: seite=veranstaltungen; ziel=[data-evcard] .kpis)

#### Übernehmen auf Konten (Kassierer)

Hat die Liste Mitglieder, die nicht direkt bezahlt haben, erscheint ein Hinweis mit dem Knopf **Übernehmen auf Konten (…)**. Er bucht deren Beträge auf ihre Konten und sie werden mit der nächsten Abrechnung bezahlt (Recht „Übernahme“). Gäste ohne Konto lassen sich nicht übernehmen: Ordne sie erst einem Mitglied zu („Mitglied zuordnen …“) oder kassiere bar.

#### Abrechnungsliste

Die Liste zeigt je Name **Stück**, **Betrag** und **Status** (offen, bar bezahlt, Karte, auf Konten). Mit „Alle / Offen / Bezahlt“ filterst du. Über **+ Hinzufügen** setzt du Namen auf die Liste: ein Mitglied aus der Mitgliederliste oder einen Gast mit freiem Namen. Das Kreuz entfernt einen Namen, der noch nichts gebucht hat.

![Die Abrechnungsliste einer Veranstaltung.](bild: seite=veranstaltungen; ziel=[data-evcard] .evscroll)

Mit **Abrechnen …** öffnest du bei einem offenen Namen das Fenster mit **Bar bezahlt**, **Karte bezahlt** und – bei Gästen ohne Konto – **Mitglied zuordnen …**. Unter der Liste klappen zwei Listen auf: **Zahlungen** (wer wann wie bezahlt hat, mit **Rückgängig**) und **Verkaufte Artikel** (Menge, Umsatz und „Verein frei“).

#### Gäste-Deckel

![Die Kennzahlen der Gäste-Deckel.](bild: seite=veranstaltungen; ziel=#deckelBox .kpis)

Gäste und gegnerische Mannschaften schreiben am Tablet auf einen Deckel an und zahlen vor der Heimfahrt. Hier siehst du, was offen ist: **Offene Deckel**, **Noch offen**, **Heute bar bezahlt**, **Heute mit Karte**. Ist ein Deckel länger als einen Tag offen, warnt ein roter Hinweis („vermutlich vergessen zu bezahlen“).

![Karte „Offen“ mit dem offenen Deckel.](bild: seite=veranstaltungen; klick=#deckelBox .card:has([data-tx]) h3; ziel=#deckelBox .card:has([data-tx]))

Die Karte **Offen** zeigt Name, was angeschrieben ist, wann der Deckel geöffnet wurde und den offenen Betrag. Mit **Abrechnen …** (Recht „Veranstaltungen“ oder „Übernahme“) öffnest du das Fenster:

![Das Fenster „Deckel abrechnen“.](bild: seite=veranstaltungen; klick=[data-tx]; ziel=dialog)

![Deckel auf ein Konto übernehmen.](bild: seite=buchungen; klick=.drinktabs [data-tab="veranstaltungen"]; klick2=[data-tx]; klick3=#txT; ziel=dialog)

![Deckel abschreiben.](bild: seite=veranstaltungen; klick=[data-tx]; klick2=#txW; ziel=dialog)

- **Bar bezahlt** oder **Karte bezahlt:** hakt den Deckel ab.
- **Auf ein Konto übernehmen …:** bucht den Betrag auf ein Konto, z. B. die eigene Mannschaft, die den Gegner eingeladen hat. Bezahlt wird mit der nächsten Abrechnung.
- **Abschreiben …** (rot, abgesetzt): Der Betrag wird nicht mehr kassiert. Die Artikel zählen als kostenfrei, der Bestand stimmt weiter, deine Begründung steht im Protokoll.

![Karte „Geschlossen“.](bild: seite=veranstaltungen; klick=#deckelBox .card:has([data-tr]) h3; ziel=#deckelBox .card:has([data-tr]))

Die Karte **Geschlossen (letzte 30 Tage)** zeigt, wer wann wie bezahlt hat. **Wieder öffnen** nimmt eine Barzahlung zurück, der Deckel ist dann wieder offen.

### Seite „Auswertung“ {#auswertung}

![Die Reiter des Verkaufs, „Auswertung“ ist gewählt.](bild: seite=auswertung; ziel=.tabrow:has(> .drinktabs))

Die Auswertung zeigt Umsatz, verkaufte Artikel und beliebte Zeiten, immer im Vergleich zum Vorjahr. Oben wählst du das **Jahr** und optional eine **Kategorie**. Im laufenden Jahr gilt der Vergleich bis zum heutigen Tag.

![Filter für Jahr und Kategorie.](bild: seite=auswertung; ziel=.filterbar)

#### Kennzahlen

![Die vier Kennzahlen mit Verlauf.](bild: seite=auswertung; ziel=.ds-kpis)

**Umsatz**, **Verkaufte Artikel**, **Buchungen** und **Storniert**, jeweils mit der Veränderung zum Vorjahr in Prozent und einer kleinen Kurve (durchgezogen: dieses Jahr, gestrichelt: Vorjahr).

![Die Leiste mit Bestseller, stärkstem Tag, Stoßzeit und Ø je Buchung.](bild: seite=auswertung; ziel=.ds-hl)

Darunter stehen **Bestseller**, **Stärkster Tag**, **Stoßzeit** und **Ø je Buchung**.

#### Die meistverkauften Artikel und Umsatz nach Kategorie

![Die meistverkauften Artikel.](bild: seite=auswertung; ziel=.card:has(.ds-top))

Die Rangliste zeigt Stückzahl, Anteil an allen Artikeln und die Veränderung zum Vorjahr. Daneben zeigt der Ring den Umsatz nach Kategorie, darunter die Verteilung nach Art (Konto, Gast bar, Veranstaltung, Verein frei).

![Der Ring „Umsatz nach Kategorie“.](bild: seite=auswertung; ziel=.card:has(.ds-donut))

#### Jahreskalender, Monate und Zeiten

![Der Jahreskalender.](bild: seite=auswertung; ziel=.card:has(.ds-heat))

Der Jahreskalender färbt jeden Tag nach der Zahl verkaufter Artikel (hell = wenig, dunkel = viel). Bewegst du die Maus auf einen Tag, steht dort die Zahl.

#### Umsatz je Monat

**Umsatz je Monat** vergleicht die Monate mit dem Vorjahr.

![Umsatz je Monat.](bild: seite=auswertung; ziel=.card:has(.ds-bars))

#### Wann wird gekauft?

**Wann wird gekauft?** zeigt Wochentag und Uhrzeit als Punkte: Je größer der Punkt, desto mehr wurde gekauft.

![Wann wird gekauft?](bild: seite=auswertung; ziel=.card:has(.ds-bub))

### Seite „Einstellungen“ des Verkaufs {#vkeinst}

![Die Reiter des Verkaufs, „Einstellungen“ ist gewählt.](bild: seite=vkeinst; ziel=.tabrow:has(> .drinktabs))

Jede Karte hat ihr eigenes „Speichern“ und ist nur sichtbar, wenn du das nötige Recht hast.

#### Reihenfolge der Kategorien

![Karte „Reihenfolge der Kategorien“.](bild: seite=vkeinst; ziel=#vkCat)

So erscheinen die Kategorien am Tablet (von oben links nach unten rechts) und in Bestand, Abrechnung und Exporten. Mit ▲ und ▼ schiebst du eine Kategorie, „Alphabetisch“ sortiert alle. Die Artikel innerhalb einer Kategorie stehen immer alphabetisch. Die Tablets übernehmen die Reihenfolge beim nächsten Laden. Recht: „Artikel & Preise“.

#### Gemerkte Zuordnungen von Lieferanten-Artikeln

![Karte „Gemerkte Zuordnungen“.](bild: seite=vkeinst; ziel=#vkMap)

Clubwerk merkt sich, welcher Artikel auf dem Beleg zu welchem Artikel am Tablet gehört. Die Tabelle zeigt Lieferant, Artikelnummer, Text auf dem Beleg, Artikel in der App und Gebinde. **Vergessen** löscht nur die Zuordnung, bei der nächsten Rechnung fragt Clubwerk wieder. Recht: „Lieferungen & Belege“.

#### Gerade oft hier am Tablet

![Karte „Gerade oft hier am Tablet“.](bild: seite=vkeinst; ziel=#vkTop)

Oben auf der Startseite des Tablets stehen die Mitglieder mit den meisten Buchungen im Zeitraum. Du stellst ein, **wie viele Namen** (0 blendet das aus) und für **welchen Zeitraum in Tagen**. Die Namen stehen alphabetisch, damit niemand eine Rangliste sieht, und ohne Besuchszahl. Tablets übernehmen die Änderung innerhalb einer Minute. Recht: „Einstellungen“.

#### Einstellungen übertragen

![Karte „Einstellungen übertragen“.](bild: seite=vkeinst; ziel=#vkFunc)

Den Verkauf als Datei sichern oder aus einer Datei übernehmen, z. B. für einen zweiten Verein: alle Artikel (mit Kategorie, Preis, Gebindegröße, Mindest- und Zielbestand, Reihenfolge, Symbol und eigenem Bild), die Kategorienreihenfolge, „Gerade oft hier“ und die Lieferanten-Zuordnungen. Bestand, Buchungen, Lieferungen, Konten, PINs und Passwörter sind nicht dabei. Beim Import werden gleichnamige Einträge (ohne Groß-/Kleinschreibung) aktualisiert, neue angelegt, nichts wird gelöscht. Die Meldung nennt je Art, wie viele neu und wie viele aktualisiert wurden. Ein Artikel mit gleichem Namen wird also nicht doppelt angelegt, sondern mit den Werten aus der Datei überschrieben. Ungültige Einträge werden übersprungen und gemeldet; Bilder dürfen höchstens 2 MB groß sein.

### Seite „Bestellung“ {#bestellung}

![Die Reiter des Lagers, „Bestellung“ ist gewählt.](bild: seite=bestellung; ziel=.tabrow:has(> .drinktabs))

Clubwerk macht einen Vorschlag aus Bestand, Mindestbestand und „bestellen bis“. Du passt die Mengen an und schickst die Bestellung an den Getränkelieferanten oder kopierst den Text.

#### Bestelldaten

![Karte „Bestelldaten“.](bild: seite=bestellung; ziel=.card:has(#oSave))

**Lieferant**, **Kunden-Nr.**, **Lieferadresse**, **Absender (Name)** und **Telefon für Rückfragen** stehen im Bestelltext. „Merken“ speichert sie für das nächste Mal.

#### Was bestellen?

Die Tabelle nennt je Artikel **Bestand**, **Mindest** und **bestellen bis** und die **Gebinde** (Kisten, Kartons), die bestellt werden sollen. Knappe Artikel tragen die Markierung „knapp“ und haben schon eine vorgeschlagene Menge: so viele Gebinde, dass „bestellen bis“ erreicht wird (ohne Angabe doppelt so viel wie der Mindestbestand). Vorgeschlagen wird nur, was schon einmal geliefert wurde. Mindestbestand und „bestellen bis“ stellst du unter Lager › Artikel ein, die Artikelnummern kommen automatisch aus hochgeladenen Rechnungen. Jede Zahl lässt sich ändern.

#### E-Mail

![Karte „E-Mail“.](bild: seite=bestellung; ziel=.card:has(#oSend))

Betreff und Text entstehen aus deinen Mengen und aktualisieren sich beim Tippen. Du kannst sie von Hand ändern. Dazu trägst du **An (Lieferant)** und optional **Kopie an** ein (z. B. den Vorstand).

- **Bestellung jetzt senden:** Clubwerk schickt die E-Mail sofort und vermerkt es im Protokoll. Voraussetzung ist das Vereinspostfach unter Einstellungen › Postfach. Vorher fragt es noch einmal nach, denn gesendet ist gesendet.
- **Text kopieren:** für jedes andere Mailprogramm.
- **In E-Mail-Programm öffnen:** öffnet eine fertige Mail im Mailprogramm des Geräts.

Unter den Knöpfen steht, wann die letzte Bestellung an wen ging.

### Seite „Lieferungen & Belege“ {#lieferungen}

![Die Reiter des Lagers, „Lieferungen & Belege“ ist gewählt.](bild: seite=lieferungen; ziel=.tabrow:has(> .drinktabs))

Rechnungen und Lieferscheine laden und den Bestand gutschreiben, ohne abzutippen.

#### Belege ablegen

![Karte „Rechnungen hier ablegen“.](bild: seite=lieferungen; ziel=#drop)

Ziehe eine oder mehrere Dateien auf die Karte oder nimm **Dateien wählen** (PDF vom Lieferanten, Kassenbon als Foto oder Screenshot). Am Handy und Tablet fotografierst du den Beleg mit **Foto aufnehmen**. **Ohne Beleg erfassen** öffnet die Erfassung von Hand, z. B. für eine Lieferung ohne Papier.

#### Beleg prüfen

![Das Fenster „Lieferung erfassen“ (hier ohne Beleg).](bild: seite=lieferungen; klick=#manual; ziel=dialog)

Clubwerk liest den Beleg und erkennt die Positionen. Bei Fotos und Scans ohne Text hilft die Bilderkennung, sonst trägst du die Gebinde von Hand ein. Im Fenster steht links der Beleg, rechts:

- **Lieferant**, **Lieferdatum**, **Belegart** (Rechnung, Gutschrift, Lieferschein, Kassenbon), **Beleg-Nr.** und **Betrag**.
- Je Position **Auf dem Beleg**, **Menge**, **Artikel in der App** (die Auswahl wirkt wie ein Vorschlag, ein Artikel lässt sich dort auch neu anlegen oder ignorieren), **je Gebinde** und **Einzelartikel**.
- Markierungen helfen: „gemerkt“ (kennt Clubwerk von früher), „bitte zuordnen“ und „bitte Menge prüfen“. Pfand- und Leergutzeilen ignoriert Clubwerk selbst. Eine grüne Meldung bestätigt, wenn die Summe zum Beleg passt, ein Hinweis warnt bei Abweichungen.
- Ist der Beleg schon gespeichert (gleiche Belegnummer), warnt ein roter Hinweis vor doppelter Erfassung.
- Mit **+ Zeile** fügst du eine Position hinzu. Unten steht, wie viele Einzelartikel ins Lager kommen und wie viele Positionen noch keinem Artikel zugeordnet sind.

**Lieferung speichern** schreibt den Bestand gut und merkt sich die Zuordnungen für das nächste Mal. **Verwerfen** wirft den Beleg weg. Bei mehreren Dateien bricht „Alle abbrechen“ den Rest ab.

#### Erfasste Lieferungen

![Karte „Erfasste Lieferungen“.](bild: seite=lieferungen; ziel=#main > .card:last-child)

Die Tabelle zeigt **Lieferdatum**, **Lieferant**, **Beleg** (mit „ansehen“), **Betrag** und **Einzelartikel**. **Positionen** zeigt, was geliefert wurde:

![Die Positionen einer Lieferung.](bild: seite=lieferungen; klick=[data-show]; ziel=dialog)

**Löschen** entfernt eine Lieferung samt Beleg. Der Bestand wird entsprechend wieder reduziert.

### Seite „Bestand & Inventur“ {#bestand}

![Die Reiter des Lagers, „Bestand & Inventur“ ist gewählt.](bild: seite=bestand; ziel=.tabrow:has(> .drinktabs))

Soll-Bestand = Lieferungen − Buchungen ± Bruch und Korrekturen. Bei der Inventur zählst du nach, trägst die Zahl ein und Clubwerk bucht die Differenz als Schwund.

#### Aktueller Bestand und Inventur

Die Tabelle zeigt **Artikel** (mit „nachbestellen“, wenn der Mindestbestand erreicht ist), **Kategorie**, **Soll (Stück)**, **Soll in Gebinden**, **Mindestbestand** und – zum Ausfüllen – **Gezählt: Gebinde** und **Gezählt: Stück**. Ein Minusbestand ist rot. Er heißt meist: Eine Lieferung fehlt noch.

Für die Inventur zählst du, trägst Gebinde und Stück ein (nur ausgefüllte Zeilen werden übernommen), wählst das **Inventur-Datum** und tippst **Inventur speichern**. Clubwerk meldet, wie viele Abweichungen es erfasst hat. Ist eine Abweichung ungewöhnlich groß, fragt es noch einmal nach: vielleicht hat sich jemand vertippt.

#### Bruch oder Korrektur buchen

![Karte „Bruch oder Korrektur buchen“.](bild: seite=bestand; ziel=.card:has(#mvSave))

Eine zerbrochene Kiste oder eine falsche Zahl buchst du hier: **Artikel**, **Grund** („Bruch / verdorben“ oder „Korrektur (+/−)“), **Einzelartikel**, **Datum** und **Notiz**, dann „Buchen“.

#### Letzte Bestandsänderungen

![Karte „Letzte Bestandsänderungen“.](bild: seite=bestand; klick=#main > .card:nth-of-type(5) h3; ziel=#main > .card:nth-of-type(5))

Jede Änderung mit Datum, Artikel, Grund, Menge und Notiz.

#### Abgleich Lieferungen ↔ Buchungen

Was ist geliefert, was gebucht worden? Wähle den Zeitraum, dann zeigt die Tabelle je Artikel: **Geliefert**, **Konten**, **Verein frei**, **Gast bar**, **Veranstaltung**, **Bruch/Korr.**, **Offen** (noch im Lager oder nicht gebucht), **Inventur-Diff.** und **Schwund €**. Klarheit bringt die Inventur.

### Seite „Artikel“ {#artikel}

![Die Reiter des Lagers mit den Knöpfen der Artikel rechts daneben.](bild: seite=artikel; ziel=.tabrow:has(> .drinktabs))

Alle Artikel mit Kategorie, Preis, Gebinde, Bestand, Mindestbestand und „bestellen bis“. Ausgeblendete Artikel sind grau und tragen den Vermerk „ausgeblendet“. Die **Kategorie** fasst Artikel in der Abrechnung zusammen, ihre Reihenfolge stellst du unter Verkauf › Einstellungen ein.

- **+ Neuer Artikel** legt einen Artikel an.
- **Import …** liest Artikel aus Excel ein (siehe unten).
- **Excel** lädt die Artikelliste herunter. Mit dieser Datei (samt ID-Spalte) kannst du sie in Excel pflegen und wieder einlesen.
- **Bearbeiten** (rechts in der Zeile) öffnet den Artikel.

#### Artikel anlegen und bearbeiten

![Das Fenster „Neuer Artikel“.](bild: seite=artikel; klick=#new; ziel=dialog)

- **Name:** so steht er am Tablet. Eine Größe am Ende („Bier 0,33“) steht auf der Kachel in der zweiten Zeile.
- **Kategorie:** vorhandene Kategorien werden vorgeschlagen, neue entstehen mit dem Artikel.
- **Preis €**, **Einzelartikel je Gebinde** (Kiste, Karton, Fass, Packung) und **Mindestbestand** sowie **Bestellen bis**, beide in Einzelartikeln (Flaschen, Tüten, Dosen …). Ohne „Bestellen bis“ gilt das Doppelte des Mindestbestands.
- **Bestand führen:** Ohne Haken wird dieser Artikel nicht gezählt (z. B. Kaffee oder Essen).
- **Auf dem Tablet anzeigen:** Ohne Haken ist der Artikel ausgeblendet. Er bleibt in alten Buchungen erhalten.
- **Darstellung am Tablet:** Wähle ein **Symbol** aus der Sammlung, ein **eigenes Bild** (PNG, JPG, WebP oder SVG bis 2 MB, wird quadratisch auf 384 × 384 Pixel verkleinert, am besten ein Logo oder Foto auf hellem oder transparentem Grund) oder **Ohne**. Dann steht ein Kürzel aus dem Namen auf der Kachel. Die Vorschau zeigt, wie es aussieht.

**Löschen** (nur beim Bearbeiten) nimmt den Artikel aus allen Listen und vom Tablet. Wurde er schon verkauft oder geliefert, bleiben die alten Buchungen für Bestand und Abrechnung erhalten.

#### Artikel aus Excel importieren

![Das Fenster „Artikel aus Excel importieren“.](bild: seite=artikel; klick=#aImp; ziel=dialog)

Erwartet werden die Spalten **Artikel**, **Kategorie**, **Preis**, optional **ID**, **Gebinde**, **Bestand führen**, **Mindestbestand**, **Bestellen bis** und **Aktiv** (auch englische Spaltenköpfe werden erkannt). Ein vorhandener Artikel wird an seiner **ID** erkannt, sonst am Namen. Neue Artikel bekommen immer eine neue ID. Nach dem Auswählen der Datei zeigt eine Vorschau: wie viele **neu** sind, wie viele **abweichen**, wie viele unverändert bleiben oder übersprungen werden. Weicht ein vorhandener Artikel ab, entscheidest du je Artikel: **Bestand behalten** oder **Aus Datei übernehmen**, oder gleich „Überall …“ für alle. Mit dem Häkchen darunter blendest du Artikel aus, die nicht in der Datei stehen. „Übernehmen“ geht erst, wenn alles entschieden ist.

## Tablet und App {#tablet-app}

Der Verkauf läuft am Tablet im Vereinsheim, nicht in der Mitglieder-App. In der App sehen Mitglieder nur, was auf ihrem Thekenkonto offen ist, und nur, wenn der Vorstand das unter Mitglieder-App › Bereiche eingeschaltet hat („Für mich“).

### Buchen am Tablet {#tablet-buchen}

![Die Startseite des Verkaufs am Tablet.](bild: tablet=start)

Oben stehen die Mitglieder, die in letzter Zeit oft hier waren („Gerade oft hier“, alphabetisch). Darunter findest du alle Mitglieder von A bis Z, mit Suchfeld und Buchstabenleiste. Ganz unten stehen Mannschaften, **Verein · kostenfrei**, **Gast · bar zahlen** und **Gäste-Deckel**. Wer neu ist, tippt **Ich bin neu** und trägt seinen Namen ein, der Vorstand bestätigt das später.

1. **Namen antippen.** Dann fragt das Tablet nach der PIN. Wer noch keine hat, legt beim ersten Mal eine fest (4 bis 6 Ziffern, zweimal eingeben, leicht zu erratende wie 1234 gehen nicht). „Später“ ist möglich, buchen geht dann weiter.
2. **Artikel antippen.** Jeder Tipp ist ein Stück, die Zahl steht auf der Kachel. Rechts steht der Warenkorb mit **+** und **−**, „Auswahl leeren“ beginnt von vorn.
3. **Auf mein Konto buchen.** Die Bestätigung zeigt, was gebucht ist und wie viel offen ist.
4. **Rückgängig** ist 20 Sekunden lang möglich. Danach nur noch in der Verwaltung (Storno).

![Buchen: Artikelkacheln und Warenkorb.](bild: tablet=start; klick=#special button.verein; klick2=#cats button[data-a])

Nach 60 Sekunden ohne Eingabe springt das Tablet auf die Startseite zurück, dann ist nichts gebucht. Doppeltes Antippen oder ein WLAN-Aussetzer buchen nie doppelt.

![Die PIN-Eingabe.](bild: tablet=start; klick=#names button[data-id])

Weitere Knöpfe auf der Buchenseite: **Mein Konto** zeigt Datum, Artikel und Betrag der eigenen Buchungen und den offenen Betrag, nur mit PIN. **PIN ändern** gilt sofort auch in der Mitglieder-App. **Anderes Mitglied** bricht ab und geht zurück zur Liste.

### Freier Betrag {#tablet-betrag}

![Das Fenster „Betrag eingeben“.](bild: tablet=start; klick=#special button.gast; klick2=button[data-custom])

Für alles, was nicht auf der Liste steht (Essen, Kuchen, Startgeld, Spende): Ziffern wie an der Kasse eintippen (3-5-0 ergibt 3,50 €), eine Auswahl nennt den Grund. Der Betrag liegt zwischen 0,10 € und 500 €. Für Vereinsbuchungen (kostenfrei) gibt es das nicht.

### Mannschaften, Verein und Gäste {#tablet-konten}

- **Mannschaft:** bucht auf das Mannschaftskonto (PIN vom Vorstand).
- **Verein · kostenfrei:** Die Buchung wird gezählt, aber niemandem berechnet. Der Bestand stimmt weiter.
- **Gast · bar zahlen:** Der Gast zahlt sofort bar. Am Ende steht „Bitte … bar in die Kasse“.
- **Familie und Trainer:** Familienmitglieder buchen standardmäßig über den Hauptzahler und stehen nicht einzeln in der Liste, wenn die Mitgliederverwaltung nichts anderes einstellt. „Kein Mitglied“ (z. B. ein Trainer) bucht wie ein Mitglied mit eigener PIN.

### Gäste-Deckel am Tablet {#tablet-deckel}

![Das Fenster „Neuer Gäste-Deckel“.](bild: tablet=start; klick=#special button.deckel)

Für Gäste und die gegnerische Mannschaft: Name eingeben (zum Beispiel „Gastmannschaft SV Musterdorf“) und **Deckel öffnen**. Ist der Name schon offen, schlägt das Tablet den vorhandenen Deckel vor. Dann wie gewohnt Artikel antippen und **Anschreiben** tippen. Vor der Heimfahrt öffnet man den Deckel wieder und tippt **Jetzt bezahlen** (dort steht dann der Betrag), danach **Bar bezahlt** oder **Mit Karte bezahlt**. Steht nichts auf dem Deckel, heißt der Knopf **Deckel schließen**. Offene Deckel stehen oben auf der Startseite.

![Ein geöffneter Deckel mit Bezahlen-Knopf.](bild: tablet=start; klick=#tabs button[data-tab])

### Veranstaltung am Tablet {#tablet-veranstaltung}

Ist eine Veranstaltung aktiv, zeigt das Tablet nur noch deren Liste mit Namen. Jeder trägt sich mit **+ Namen hinzufügen** ein (ein Mitglied aus der Liste oder frei als Gast) und schreibt auf der Liste an, mit PIN, wenn das Mitglied eine hat. **Barverkauf ohne Namen** (Knopf oben) bucht ohne Namen bar. Bezahlt wird am Ende in der Verwaltung.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Lieferungen & Belege hochladen | Seite „Lieferungen & Belege“, Zuordnungen von Lieferanten-Artikeln |
| Bestand, Inventur & Abgleich | Seite „Bestand & Inventur“ |
| Bestellung vorbereiten (Bestellmail) | Seite „Bestellung“, Bestelldaten und Mail |
| Buchungen stornieren & nachtragen | Seite „Buchungen“, „+ Betrag auf Konto“ |
| Aktuellen Stand ansehen & als Excel exportieren | Abrechnung ansehen, Excel, Abtippliste, Auswertung (z. B. für Kassenprüfer) |
| Abrechnung | Konten als abgerechnet markieren, Abrechnungen zurücknehmen, Buchungstext ändern (schließt „Export“ ein) |
| Veranstaltungen verwalten | Veranstaltungen führen, bar und Karte abhaken, Deckel abrechnen |
| Offene Veranstaltungsbeträge übernehmen (Kassierer) | Beträge auf Konten übernehmen, Deckel auf ein Konto übernehmen oder abschreiben |
| Artikel & Preise | Seite „Artikel“, Reihenfolge der Kategorien |
| Einstellungen | „Gerade oft hier“ und „Einstellungen übertragen“ im Verkauf |

Für die Konten & PINs gibt es das Recht „Mitglieder anlegen & neue bestätigen“. Die Rolle „Kassenwart“ bringt die Rechte für Abrechnung, Export und Übernahme schon mit.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Mitglieder:** Die Mitglieder und ihre Zahler kommen von dort. Verkaufskonten ziehen per Lastschrift mit ein („Per Lastschrift einziehen“), Familienmitglieder zahlen über das Oberhaupt. Mitglieder mit Beitragsart 0 € laufen trotzdem über den Einzug. In der Datenauskunft eines Mitglieds steht sein Verkauf je Monat. Mitglieder mit offenen Beträgen lassen sich nicht löschen.
- **Dienste & Termine:** Aus einem Dienstplan lässt sich eine Veranstaltung im Verkauf anlegen. Der dauerhafte „Thekendienst“ steht am Tablet zum Einstempeln zur Verfügung.
- **Plätze:** Gebühren, die ein Trainer ohne Mitgliedschaft zahlt, landen auf seinem Verkaufskonto und werden mit der Abrechnung bezahlt.
- **Mängel:** Das Meldeformular steht am Tablet neben dem Verkauf.
- **Turniere:** Das Nenngeld läuft in einem eigenen Kassenbericht und nicht in der Verkaufskasse.
- **Datenschutz:** Geld-Daten des Verkaufs löscht Clubwerk nie von selbst, weil dafür gesetzliche Aufbewahrungsfristen gelten.
