# Plätze
<!-- kurz: Plätze und Geräte buchen – Mitglieder in der App oder am Tablet, ihr behaltet in der Verwaltung den Überblick. -->

## Wofür ist das Modul? {#wofuer}

Mitglieder buchen Tennisplätze, Padelplätze, Hallen oder Geräte wie die Ballmaschine – in der Mitglieder-App oder am Tablet im Vereinsheim. Clubwerk achtet auf Öffnungszeiten, Zeitraster, Höchstdauer und das Kontingent je Mitglied, kennt Mitspieler und Gäste (mit Gastgebühr) und führt eine Warteliste. Über die Mitspielersuche finden Mitglieder in der App Mitspieler aus dem Verein und kommen mit einem Tipp vom Gesuch zur Buchung. In der Verwaltung seht ihr den Belegungsplan, tragt Training, Mannschaften und Platzsperren ein, übernehmt den Spielplan vom Verband und wertet die Auslastung aus.

Das Modul läuft allein. Ohne die Mitgliederverwaltung kennt es nur Vor- und Nachname und hat keine Zahlungsverfolgung der Gebühren; ohne den Verkauf lassen sich keine Gebühren von Hand aufs Konto buchen.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Plätze“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Rechte vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer mitarbeiten soll, die passenden Rechte (siehe unten), z. B. der Platzwart „Belegung ansehen“ und „Buchungen anderer stornieren“.
3. **Plätze anlegen:** Reiter „Plätze & Geräte“ › „+ Platz“ oder „+ Gerät“. Namen, Öffnungszeiten, Zeitraster und Höchstdauer festlegen.
4. **Regeln prüfen:** Reiter „Einstellungen“ – Vorlauf, Kontingent, Gäste und Gastgebühr sind mit Vorschlagswerten gefüllt. Dort legt ihr auch die **Buchungsarten** an (Training, Medenspiel …).
5. **Tablet und App:** Mitglieder sehen den Bereich „Plätze“ sofort in der App. Am Tablet erscheint er, sobald „Am Tablet im Vereinsheim buchen“ an ist (Standard).
6. **Gästebuchung (freiwillig):** Sollen auch Nichtmitglieder online buchen und mit PayPal oder Karte zahlen, richtet ihr die Buchungsseite ein – Schritt für Schritt im Reiter „Gäste“ weiter unten.

## Verwaltung {#verwaltung}

Im Menü „Plätze“ gibt es acht Reiter: **Belegung**, **Serien & Sperren**, **Buchungen**, **Gebühren**, **Auswertung**, **Mitspielersuche**, **Plätze & Geräte** und **Einstellungen**. Der Reiter „Einstellungen“ erscheint nur mit dem Recht „Plätze einrichten“.

### Reiter „Belegung“ {#bk-belegung}

![Der Belegungsplan für einen Tag: oben die Tage der Woche, darunter alle Plätze nebeneinander mit ihren Buchungen.](bild: seite=bk-belegung; klick=#bkDays button:nth-child(5))

Der Plan zeigt, wer wann auf welchem Platz spielt.

- **Tag oder Woche:** Mit den Schaltern „Tag“ und „Woche“ wechselt ihr zwischen allen Plätzen an einem Tag und einem Platz über sieben Tage (dann wählt ihr den Platz in der Leiste, die Pfeile blättern wochenweise).
- **Tag wählen:** Die Tage der Woche stehen als Kacheln oben, die Pfeile ‹ › blättern wochenweise, im Datumsfeld wählt ihr jeden anderen Tag. „Heute“ springt zurück.
- **Plan lesen:** Jede Spalte ist ein Platz oder Gerät. Eine Buchung ist ein Block in der Farbe ihrer Buchungsart; Sperren sind rot gestreift, nicht buchbare Zeiten (außerhalb der Öffnungszeit) schraffiert. Die rote Linie ist „jetzt“. Heute sind vergangene Stunden eingeklappt – ein Klick auf die Leiste klappt sie auf. Unter dem Plan erklärt eine Legende die Farben.
- **Freie Stelle anklicken:** öffnet „Buchung eintragen“ mit Platz, Tag und Uhrzeit schon ausgefüllt. Nötig ist das Recht „Für andere buchen“.

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
- **Wiederholen** und **Bis:** macht aus der Buchung eine Serie, z. B. jede Woche bis Saisonende. Belegte Tage werden ausgelassen. Nötig ist das Recht „Serien & Sperren“.
- **Notiz (intern):** sehen nur Benutzer in der Verwaltung.

„Speichern“ trägt die Buchung ein. Ist die Zeit schon belegt, sagt Clubwerk das und trägt nichts ein.

#### Sperre eintragen

![Das Fenster „Platz sperren“.](bild: seite=bk-belegung; klick=#bkLock; ziel=dialog)

„+ Sperre“ sperrt einen Platz für eine Zeit, z. B. zur Platzpflege oder für ein Turnier. Platz, Tag, Zeit und Grund angeben; „Wiederholen“ macht eine Serie daraus. Liegen schon Buchungen von Mitgliedern in dieser Zeit, fragt Clubwerk nach: Mit „Sperren und stornieren“ werden sie abgesagt und die Mitglieder per E-Mail (und Push) informiert.

> Für längere Zeiträume wie die Winterpause ist „+ Sperre über Zeitraum“ im Reiter „Serien & Sperren“ bequemer.

#### Eine Buchung öffnen

![Die geöffnete Buchung: Spieler, Gebühr, Notiz und wer sie wann eingetragen hat.](bild: seite=bk-belegung; klick=.bk-blk.buchung; ziel=dialog)

Ein Klick auf einen Block zeigt die Einzelheiten: Spieler, Titel, Gebühr, Notiz und wer die Buchung wann und wo (App, Tablet, Verwaltung, Spielplan-Import) eingetragen hat.

- **Stornieren** fragt nach einem Grund (freiwillig). Das Mitglied bekommt eine E-Mail, eine Gebühr entfällt. Nötig ist das Recht „Stornieren“. Du findest es in den Einzelheiten und auch im Fenster „Bearbeiten“ (Knopf „Stornieren“ links unten).
- **Bearbeiten** öffnet dasselbe Fenster wie beim Eintragen: Platz, Zeit, Mitglied, Mitspieler, Gäste und Buchungsart lassen sich ändern. Gastgebühren werden neu berechnet, neue Mitspieler bekommen die Mail.
- **Platzcode „Zeigen“** (nur auf Plätzen mit Toren, mit dem Recht „Für andere buchen“ oder „Serien & Sperren“): zeigt den Code für die Tastatur am Tor, z. B. um ihn einer Mannschaft ohne App weiterzugeben. Jedes Ansehen steht im Änderungsprotokoll (ohne den Code).

Gehört der Termin zu einer Serie oder Sperre, fragt Clubwerk zuerst, was gemeint ist:

![Die Auswahl bei Serienterminen: nur dieser Termin, dieser und alle folgenden, gesamte Serie.](bild: seite=bk-belegung; klick=#bkV [data-v="woche"]; klick2=.bk-blk.serie; klick3=#bxE; ziel=#askBox)

Beim Stornieren folgt eine Rückfrage, bevor etwas verschwindet. Beim Bearbeiten (Platz, Uhrzeit, Titel, Buchungsart, Notiz) zeigt „Prüfen“ vorher, wie viele Termine betroffen sind und an welchen Tagen der Platz belegt ist.

### Reiter „Serien & Sperren“ {#bk-serien}

![Der Reiter „Serien & Sperren“ mit den aktiven Serien, Sperren und Spielplänen.](bild: seite=bk-serien)

Hier stehen alle wiederkehrenden Termine: Training, Kurse, Mannschaftsspiele und Sperren. Jede Zeile nennt Titel, Wiederholung („jeden Dienstag“), Uhrzeit, Zeitraum, Plätze, wen es betrifft und wie viele Termine noch kommen. „Beenden“ (bei Sperren „Aufheben“) entfernt die kommenden Termine nach einer Rückfrage; vergangene bleiben stehen. Beendete Serien stehen darunter. Die Knöpfe oben brauchen das Recht „Serien & Sperren“.

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

Alle Gast- und Platzgebühren aus Buchungen sowie von Hand gebuchte Gebühren. Oben stehen die Summen **Offen**, **Bezahlt** und **Gesamt** des Geschäftsjahres (meist das Kalenderjahr, sonst z. B. „2026/27“), darunter die Liste (Mitglied, Datum, Platz, Text, Betrag, Status). Mit den Filtern „Alle / Offen / Bezahlt“ und der Jahresauswahl grenzt ihr ein.

Gebühren entstehen beim Buchen als offene Posten und werden mit dem nächsten Einzug abgerechnet. Den Zahlungsstand zeigt Clubwerk aus Beiträge & Zahlungen › Offene Posten. Ohne die Mitgliederverwaltung steht „ohne Zahlungsverfolgung“ da, die Gebühren werden nur aufgelistet. Eine Zeile anklicken öffnet die zugehörige Buchung.

#### + Gebühr buchen

![Das Fenster „Gebühr buchen“.](bild: seite=bk-gebuehren; klick=#feNew; ziel=dialog)

Für eine Gebühr ohne Buchung, z. B. eine Hallenmiete: Person, Betrag (zwischen 0,10 € und 1.000 €), Datum und Text. Bei Mitgliedern entsteht eine Forderung, die wie ein Beitrag eingezogen wird. Bei Trainern („Kein Mitglied“) kommt der Betrag aufs Verkaufskonto. Nötig ist das Recht „Für andere buchen“.

Von Hand gebuchte Gebühren haben in der Zeile den Knopf **Stornieren**; die Rückfrage nennt den Betrag, der offene Posten wird zurückgenommen. Ist die Gebühr schon eingezogen oder bezahlt, storniert ihr sie in den Mitgliedern (dort mit „als Guthaben behalten“ oder „zurücküberwiesen“). Eine Buchung mit bezahlter Gebühr lässt sich nicht mehr ändern, nur stornieren – die Gebühr bleibt dann stehen, das Protokoll vermerkt „Gebühr nicht storniert“.

Gebühren für ein Familienmitglied oder jemanden mit eigenem Zahler („zahlt für“) stehen als offener Posten beim Zahler.

### Reiter „Gäste“ {#bk-gaeste}

![Der Reiter „Gäste“: Verbindung zur Buchungsseite, Kennzahlen, Abweichungen und die Gastbuchungen.](bild: seite=bk-gaeste; hoehe=620)

Hier bucht ihr Plätze für **Nichtmitglieder**. Gäste buchen auf einer eigenen kleinen Buchungsseite (als Link oder Rahmen auf eurer Homepage) und zahlen mit **PayPal oder Debit-/Kreditkarte**. Die Buchungsseite läuft außerhalb des Vereinsheims bei Cloudflare. Clubwerk bleibt von außen unerreichbar: Es ruft die Buchungsseite etwa jede Minute selbst auf, schickt die freien Zeiten und holt neue Buchungen und Stornos ab. Die Buchungsseite kennt keine Mitgliederdaten.

Jede Zahlung prüft Clubwerk danach **selbst bei PayPal** (bezahlt, Betrag, Euro, Buchungsnummer). Erst dann steht die Buchung im Platzplan als „Gastbuchung“, bekommt einen Platzcode für das Tor und der Gast eine Bestätigung per E-Mail mit Code und Storno-Link. Solange der Gast bei PayPal bezahlt, hält Clubwerk die Zeit als „Gastbuchung (Zahlung läuft)“, damit niemand sie in der Zwischenzeit bucht.

Oben steht, ob die Verbindung steht: **verbunden** (grün, mit der Uhrzeit des letzten Abgleichs und „PayPal Sandbox“ bzw. „PayPal Live“), **keine Verbindung** (Internet weg – Gäste können dann nicht buchen, alles andere in Clubwerk läuft weiter), **Tresor gesperrt** (nach einem Neustart wartet der Abgleich, bis sich ein Admin anmeldet; darunter steht, was wartet) oder ein Fehler wie „Signatur“ (Schlüssel passt nicht) oder „PayPal-Umgebung passt nicht“. **Jetzt abgleichen** gleicht sofort ab, **Einrichten** öffnet das Fenster für die Einrichtung, **Auf der Homepage einbinden** zeigt den Link und den Code für den Rahmen.

Darunter drei Kennzahlen: **kommende Gastbuchungen**, **Einnahmen diesen Monat** (abzüglich Erstattungen, mit der Zahl der Buchungen; die PayPal-Gebühr steht in jeder Gastbuchung) und **offene Abweichungen**.

#### Abweichungen

![Karte „Offene Abweichungen“ mit „Trotzdem eintragen“ und „Erledigt“.](bild: seite=bk-gaeste; ziel=[data-card="abweichungen"])

Hier steht alles, was bei einer Zahlung nicht zusammenpasst – etwa ein anderer Betrag bei PayPal, eine Zahlung, die es bei PayPal nicht gibt, oder beim **täglichen Abgleich** mit PayPal (letzte 3 Tage) eine Zahlung ohne Gastbuchung in Clubwerk. Eine Buchung mit Abweichung trägt Clubwerk nicht ein; der Platz bleibt gehalten, bis ihr entscheidet:

- **Trotzdem eintragen** (nur bei „bitte prüfen“): Clubwerk prüft noch einmal bei PayPal, dass bezahlt ist, und trägt die Buchung trotz des anderen Betrags ein – z. B. kurz nach einer Preisänderung. Stimmt der Betrag bei PayPal selbst nicht, lehnt Clubwerk ab.
- **Stornieren** in der Gastbuchung (siehe unten) erstattet das Geld.
- **Erledigt** blendet die Abweichung aus, wenn ihr sie geklärt habt. Das steht im Protokoll.

Gibt es Abweichungen, zeigt auch die Übersicht einen roten Hinweis.

#### Gastbuchungen

![Die Liste der Gastbuchungen mit Filter, Name, Zeit, Platz, Buchungsnummer, Betrag und Status.](bild: seite=bk-gaeste; ziel=#bkBody > .card:has(table.bk-fees))

Die Filter **Kommend**, **Alle**, **Storniert** und **Mit Abweichung** grenzen die Liste ein. Namen stehen als „Nachname, Vorname“. Der Status heißt **Zahlung läuft** (Gast ist gerade bei PayPal), **Zahlung in Prüfung** (PayPal prüft die Zahlung noch – der Platz ist gehalten, einen Code gibt es erst danach), **bezahlt** (mit Platzcode, wenn der Platz Tore hat), **Erstattung läuft**, **storniert**, **abgebrochen**, **Platz war vergeben** (die Zeit war in Clubwerk schon belegt – nichts abgebucht bzw. Geld erstattet) oder **bitte prüfen**.

Eine Zeile anklicken öffnet die Gastbuchung:

![Die geöffnete Gastbuchung mit Kontakt, Betrag, PayPal-Nummern und „Stornieren und erstatten“.](bild: seite=bk-gaeste; klick=tr[data-g]; ziel=dialog)

Ihr seht E-Mail und Handynummer, Betrag und PayPal-Gebühr, die Nummern bei PayPal und welche Mail der Gast bekommen hat. Das Ansehen steht im Protokoll. **Stornieren und erstatten** mit einem Grund (er steht in der Mail an den Gast): Die Buchungsseite erstattet den Betrag über PayPal, Clubwerk prüft die Erstattung, trägt die Buchung aus, macht den Platzcode ungültig und schreibt dem Gast. Das gilt auch, wenn ihr eine Gastbuchung im Platzplan storniert oder eine Sperre sie verdrängt. Verschieben lässt sich eine Gastbuchung nicht – der Gast hat genau diese Zeit bezahlt.

Gäste stornieren selbst über den Link in ihrer Bestätigung, bis zur Stornofrist (Standard 24 Stunden vor Beginn). Danach geht Storno nur über euch.

#### Plätze für Gäste

![Karte „Plätze für Gäste“.](bild: seite=bk-gaeste; ziel=[data-card="plaetze"])

Je Platz legt ihr fest, ob Gäste ihn online buchen dürfen. **Bearbeiten** öffnet das Fenster:

![Das Fenster eines Platzes: für Gäste buchbar, Wochentage, Zeitfenster, Preis je Stunde, Dauer und Vorlauf.](bild: seite=bk-gaeste; klick=[data-gc="3"]; ziel=dialog)

- **Für Gäste (Nichtmitglieder) online buchbar** schaltet den Platz frei.
- **Wochentage** und **Von/Bis**: Gäste sehen nur freie Zeiten in diesem Fenster und innerhalb der Öffnungszeit des Platzes.
- **Preis je Stunde** (1 € bis 500 €) und **Dauer je Buchung** (im Raster des Platzes): Der Preis einer Buchung ist Preis je Stunde × Dauer.
- **Vorlauf**: so viele Tage im Voraus ist der Platz buchbar (1 bis 60). Zeiten, die in weniger als 30 Minuten beginnen, bietet die Buchungsseite nicht mehr an.

Belegte Zeiten – Mitglieder, Serien, Sperren, Turniere – bietet die Buchungsseite nie an.

#### Einrichten

![Das Fenster „Gästebuchung einrichten“: Buchungsseite, Homepage, Fristen und Hinweis zum Datenschutz.](bild: seite=bk-gaeste; klick=#gsCfg; ziel=dialog; hoehe=640)

- **Gästebuchung eingeschaltet**: Ohne den Haken zeigt die Buchungsseite „keine Online-Buchungen“.
- **Adresse der Buchungsseite** (nur `https`), **Homepage, auf der sie eingebettet werden darf** (der Rahmen erscheint nur dort), **Impressum** und **Datenschutz** (Links unten auf der Buchungsseite).
- **Stornieren mit Erstattung bis … Stunden vorher** (0 bis 720) und **Zeit reserviert, während der Gast bezahlt** (5 bis 30 Minuten).
- **Hinweis zum Datenschutz**: erscheint auf der Buchungsseite vor dem Bezahlen. **Vorschlag einsetzen** füllt einen Text mit Zweck, Rechtsgrundlage, PayPal und Cloudflare, Löschfristen und euren Rechten ein – bitte an euren Verein anpassen und von eurem Datenschutzbeauftragten prüfen lassen. **Vereinslogo zeigen** schickt das Logo an die Buchungsseite.
![Unten im Fenster: gemeinsamer Schlüssel und PayPal-Zugang für die Prüfung.](bild: seite=bk-gaeste; klick=#gsCfg; ziel=#gsZugang)

- **Gemeinsamer Schlüssel**: **Schlüssel erzeugen …** (mit eurem Passwort) zeigt den Schlüssel **ein einziges Mal** zum Kopieren; danach steht nur „eingetragen“. Er gehört auf die Buchungsseite (siehe unten). Ein neuer Schlüssel löst eine Sicherheitswarnung aus; bis er auch auf der Buchungsseite steht, ruht die Gästebuchung.
- **PayPal (App „Clubwerk Prüfung“)**: **Umgebung** Sandbox (Test) oder Live (echtes Geld), **Client-ID** und **Secret** dieser App. Clubwerk benutzt sie **nur zum Lesen** (Zahlungen nachsehen, täglicher Abgleich), nie zum Abbuchen oder Erstatten. Das Secret liegt verschlüsselt im Tresor und wird nie angezeigt. **PayPal prüfen** testet den Zugang mit dem Abgleich der letzten 3 Tage. Die Umstellung auf Live fragt nach und löst eine Sicherheitswarnung aus.

#### Auf der Homepage einbinden

![Das Fenster „Auf der Homepage einbinden“ mit Link und Rahmen.](bild: seite=bk-gaeste; klick=#gsEmbed; ziel=dialog)

Entweder einfach den **Link** auf die Homepage setzen oder den **Rahmen** (iframe) samt kleinem Skript für die Höhe einfügen (**Rahmen kopieren**). Am Handy öffnet „Weiter zur Buchung“ die Buchungsseite groß und leitet zum Bezahlen zu PayPal weiter – ohne Popup.

#### Schritt für Schritt: Buchungsseite und PayPal-Sandbox einrichten

Zuerst richtet ihr alles in der **PayPal-Sandbox** ein (Testgeld). Auf Live stellt ihr erst um, wenn alles klappt und der Vorstand zugestimmt hat. Ihr braucht: ein kostenloses Cloudflare-Konto, einen PayPal-Entwicklerzugang (mit dem PayPal-Geschäftskonto des Vereins anmelden), einen PC mit Node.js 22 (Windows, Mac oder WSL) und den Ordner **gaestebuchung** aus dem Clubwerk-Paket.

1. **PayPal-App „Buchungsseite“:** <https://developer.paypal.com> → anmelden → **Apps & Credentials** → oben **Sandbox** wählen → **Create App**, Name „Buchungsseite“, Typ *Merchant*. Client-ID und Secret notieren – sie kommen auf die Buchungsseite.
2. **PayPal-App „Clubwerk Prüfung“:** noch eine App mit demselben Sandbox-Geschäftskonto anlegen und darin unter *Features* **Transaction Search** einschalten. Client-ID und Secret dieser App kommen **nur** in Clubwerk.
3. **Schlüssel erzeugen:** In Clubwerk unter Plätze › Gäste › **Einrichten** auf **Schlüssel erzeugen …** und den Schlüssel kopieren.
4. **Cloudflare vorbereiten:** Auf dem PC im Ordner `gaestebuchung` eine Eingabeaufforderung öffnen und `npx wrangler login` eingeben (öffnet die Anmeldung bei Cloudflare im Browser).
5. **Datenbank anlegen:** `npx wrangler d1 create gaestebuchung` – die angezeigte `database_id` in die Datei `wrangler.toml` eintragen, dann `npx wrangler d1 migrations apply gaestebuchung --remote`.
6. **Client-ID eintragen:** In `wrangler.toml` bei `PAYPAL_CLIENT_ID` die Client-ID der App „Buchungsseite“ einsetzen. `PAYPAL_ENV` bleibt `"sandbox"`.
7. **Geheimnisse nur per Befehl:** `npx wrangler secret put PAYPAL_CLIENT_SECRET` (Secret der App „Buchungsseite“) und `npx wrangler secret put CLUBWERK_SCHLUESSEL` (Schlüssel aus Schritt 3). Diese Werte gehören nie in eine Datei.
8. **Sicherheitsprüfung (Turnstile) gegen Massen-Reservierungen:** Im Cloudflare-Dashboard links **Turnstile** › *Add widget*: Name „Buchungsseite“, als Hostnamen die Adresse der Buchungsseite (z. B. `gaestebuchung.dein-verein.workers.dev` und, falls angelegt, `buchen.dein-verein.de`), Modus *Managed*. Den **Site Key** in `wrangler.toml` bei `TURNSTILE_SITE_KEY` eintragen, den **Secret Key** mit `npx wrangler secret put TURNSTILE_SECRET`. Gäste sehen vor dem Bezahlen ein kleines Feld „Ich bin ein Mensch“, das sich meist von selbst abhakt. Ohne die Schlüssel nimmt die Buchungsseite keine Reservierungen an.
9. **Hochladen:** `npx wrangler deploy` – am Ende steht die Adresse, z. B. `https://gaestebuchung.dein-verein.workers.dev`. Eine eigene Adresse wie `buchen.dein-verein.de` legt ihr bei Cloudflare unter *Workers › gaestebuchung › Settings › Domains & Routes* an.
10. **Webhook bei PayPal:** In der App „Buchungsseite“ unter *Webhooks* → *Add Webhook* → Adresse `https://<eure-adresse>/api/v1/webhook`, Ereignisse *Checkout order approved* und *Payment capture completed, denied, pending, refunded, reversed*. Die **Webhook ID** in `wrangler.toml` bei `PAYPAL_WEBHOOK_ID` eintragen und noch einmal `npx wrangler deploy`.
11. **Clubwerk verbinden:** Im Fenster **Einrichten** die Adresse der Buchungsseite, eure Homepage, Impressum und Datenschutz, Umgebung **Sandbox** sowie Client-ID und Secret der App „Clubwerk Prüfung“ eintragen, **Gästebuchung eingeschaltet** anhaken und speichern. **Jetzt abgleichen** muss „verbunden“ zeigen.
12. **Plätze freigeben:** In der Karte „Plätze für Gäste“ je Platz **Bearbeiten** und „für Gäste buchbar“ einschalten.
13. **Ausprobieren:** Die Buchungsseite öffnen, eine Zeit buchen und mit einem Sandbox-Käufer bezahlen (developer.paypal.com → *Testing Tools* › *Sandbox Accounts*, Typ *Personal*; Testkarten unter *Card Testing*). Nach höchstens einer Minute steht die Buchung im Platzplan und die Bestätigung ist im Postfach.

> Auf Live umstellen: in developer.paypal.com oben **Live** wählen und beide Apps dort neu anlegen, in `wrangler.toml` `PAYPAL_ENV = "live"` sowie die neue Client-ID und Webhook ID eintragen, `npx wrangler secret put PAYPAL_CLIENT_SECRET` mit dem Live-Secret, `npx wrangler deploy`, in Clubwerk Umgebung **Live** mit der Live-App „Clubwerk Prüfung“. Passen die Umgebungen nicht zusammen, hält Clubwerk den Abgleich an.

> PayPal berechnet je Zahlung eine Gebühr (in Deutschland etwa 2,49 % + 0,35 €, für gemeinnützige Vereine auf Antrag weniger). Bei einer Erstattung behält PayPal den festen Anteil. Beides bucht Clubwerk in der Buchführung mit (Zahlweg PayPal).

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

### Reiter „Mitspielersuche“ {#bk-mitspieler}

![Der Reiter „Mitspielersuche“ mit den offenen Gesuchen.](bild: seite=bk-mitspieler; hoehe=460)

Mitglieder stellen in der App unter Plätze › Mitspieler **Gesuche** ein („Doppel, Do 18–20 Uhr, Platz 3 schon gebucht“). Hier seht ihr alle Gesuche mit Mitglied, Spielform und Spielstärke, Termin und Platz, Zusagen („2 von 3“ mit Namen) und Status. Die Filter **Offen** (auch volle), **Gemeldet**, **Erledigt** (Platz gebucht) und **Beendet** (zurückgezogen, abgelaufen, ausgeblendet) grenzen die Liste ein. Ein Gesuch endet zur Startzeit oder wenn die zugehörige Buchung storniert wird.

#### Gesuch ansehen, ausblenden, sperren

![Ein Gesuch mit „Ausblenden“ und „Mitglied für die Mitspielersuche sperren“.](bild: seite=bk-mitspieler; klick=tr[data-ms]; ziel=dialog)

Eine Zeile anklicken zeigt das Gesuch mit Hinweis, Zusagen und Meldungen. Mitglieder können ein Gesuch in der App **melden**; gemeldete Gesuche stehen als Hinweis in der Übersicht. **Ausblenden** nimmt das Gesuch aus der App („Wieder zeigen“ macht das rückgängig). **Mitglied für die Mitspielersuche sperren** blendet dessen offene Gesuche aus; es kann danach keine Gesuche mehr einstellen und nicht mehr zusagen, buchen bleibt möglich. Beides braucht das Recht „Stornieren“ und steht im Protokoll.

![Die Karte „Gesperrt für die Mitspielersuche“.](bild: seite=bk-mitspieler; ziel=[data-card="ms-gesperrt"])

Die Karte **Gesperrt für die Mitspielersuche** listet gesperrte Mitglieder; „Sperre aufheben“ gibt sie wieder frei.

#### Einstellungen der Mitspielersuche

![Die Einstellungen der Mitspielersuche.](bild: seite=bk-mitspieler; ziel=[data-card="ms-einstellungen"])

Der Haken schaltet die Mitspielersuche in der App an oder aus. Dazu kommen die Grenzen **Offene Gesuche je Mitglied** (Vorgabe 3) und **Zusagen je Mitglied und Tag** (Vorgabe 10), die **Spielformen** (eine je Zeile mit der Zahl der gesuchten Mitspieler, z. B. „Doppel: 3“ oder „Training: 1–3“ zum Auswählen) und die **Spielstärken** von niedrig bis hoch (Vorgabe Einsteiger, Freizeit, Mannschaft, Turnier). So passt die Mitspielersuche auch für Padel, Badminton oder Tischtennis. Es gibt keine Einschränkung nach Alter.

> Gesuche und Zusagen werden 90 Tage nach dem Termin gelöscht; die Frist stellt ihr unter Einstellungen › Datenschutz ein.

### Reiter „Plätze & Geräte“ {#bk-plaetze}

![Der Reiter „Plätze & Geräte“ mit Name, Buchbarkeit, Raster, Gastgebühr und kommenden Buchungen.](bild: seite=bk-plaetze)

Alles, was gebucht werden kann. Die Liste zeigt je Zeile Name und Bereich (Hinweise wie „Mitspieler Pflicht“ oder die Abteilung stehen darunter), **Buchbar** (Tage und Zeiten), **Raster** (Zeitraster und Höchstdauer), **Gastgebühr** und die Zahl **kommender** Buchungen. Mit **↑ ↓** legt ihr die Reihenfolge fest – so stehen die Plätze im Plan, in der App und am Tablet. Neue Plätze kommen ans Ende. Alles hier braucht das Recht „Plätze einrichten“.

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

Nur bei **Plätzen** (sobald das Modul Zugang an ist): **Platzcode öffnet diese Tore** – die Türen mit Codetastatur aus dem Modul Zugang, die der Code einer Buchung auf diesem Platz öffnet, meist das Haupttor und genau das Tor dieses Platzes. Ein Tor kann mehrere Plätze bedienen. Ändern darf das nur, wer zusätzlich das Recht „Zugang einrichten“ hat; jede Änderung steht im Protokoll und der Vorstand bekommt eine Sicherheitswarnung. Ohne Tore bekommt der Platz keinen Code.

![Im Fenster eines Platzes: welche Tore der Platzcode öffnet.](bild: seite=bk-plaetze; klick=[data-ed="4"]; ziel=#dialog .bkf:has([data-cd]))

Nur bei **Plätzen** außerdem: **Mitspieler** „optional“ oder „Pflicht“, und **Allein trainieren erlaubt, Bezeichnung** (z. B. „Ballwand“; leer = nein). Nur bei **Geräten**: **Als Mitspieler buchbar** – z. B. die Ballmaschine, die beim Buchen als „Mitspieler“ gewählt wird und im selben Zeitfenster mitgebucht ist.

„Löschen“ geht nur, wenn keine kommenden Buchungen, Serien oder Sperren mehr auf dem Platz liegen; vergangene bleiben im Protokoll und in der Auswertung erhalten. Sonst den Platz auf „inaktiv“ setzen.

### Reiter „Einstellungen“ {#bk-einstellungen}

Die Regeln fürs Buchen, in Karten gegliedert. **Jede Karte hat ihr eigenes „Speichern“.** Nötig ist das Recht „Plätze einrichten“.

#### Buchen

Drei Zahlen und eine Auswahl:

- **Vorlauf (Tage im Voraus):** wie weit Mitglieder im Voraus buchen dürfen (Standard 7).
- **Offene Platzbuchungen je Mitglied** und **Offene Gerätebuchungen je Mitglied:** das Kontingent – wie viele kommende Buchungen jemand gleichzeitig haben darf (Standard 2). So kann niemand alle Plätze blockieren.
- **Stornieren bis … vor Beginn:** bis zum Beginn, 1, 2 oder 6 Stunden oder 1 Tag vorher. Gilt für Mitglieder in App und Tablet; die Verwaltung kann immer stornieren.

Vereinstermine (Training, Medenspiel) ignorieren Vorlauf und Kontingent, siehe „Buchungsarten“.

![Karte „Buchen“: Vorlauf, Kontingent und Stornierfrist.](bild: seite=bk-einstellungen; ziel=[data-card="buchen"])

#### Platzcode

Die Karte erscheint, sobald das Modul Zugang an ist. Jede Buchung auf einem Platz mit Toren – auch jeder einzelne Termin einer Serie oder eines Trainings – bekommt einen eigenen 6-stelligen Zufallscode. **Code gilt ab … vor Beginn** (Standard 15 Minuten) bis zum Ende der Buchung; nach dem Ende öffnet er von außen nicht mehr (innen öffnet der Drehknauf immer). Wird die Buchung verschoben, wandert das Zeitfenster mit. Wird sie storniert, gilt der Code sofort nicht mehr. Wird jemand ausgetragen oder der Platz gewechselt, gibt es einen neuen Code.

![Karte „Platzcode“.](bild: seite=bk-einstellungen; ziel=[data-card="platzcode"])

Den Code sehen nur die Beteiligten: der Buchende und die Mitspieler in der App und in der Mitspieler-Mail, bei Serien der eingetragene Trainer in der App, nach dem Buchen am Tablet der Buchende (dazu eine kurze Mail mit dem Code). Gäste haben keine eigene Adresse in Clubwerk – ihnen gibt der Buchende den Code weiter.

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

Plätze, Buchungsarten und Einstellungen als Datei exportieren und in einer anderen Clubwerk-Installation importieren, z. B. für einen zweiten Verein oder nach einer Neuinstallation (ohne Buchungen, PINs und Passwörter). Beim Import werden gleichnamige Einträge (ohne Groß-/Kleinschreibung) aktualisiert, neue angelegt, nichts wird gelöscht. Die Meldung nennt je Art, wie viele neu und wie viele aktualisiert wurden.

![Karte „Einstellungen übertragen“.](bild: seite=bk-einstellungen; klick=#bkFunc h3; ziel=#bkFunc .card)

## Tablet und App {#tablet-app}

![Der Bereich „Plätze“ in der Mitglieder-App, hier mit den freien Zeiten von morgen.](bild: app=buchung; klick=.vh-days button:nth-child(2); klick2=.bkm-view [data-v="zeiten"])

![Der Reiter „Plätze“ am Tablet im Vereinsheim.](bild: tablet=Plätze; hoehe=560)

**In der App** (Bereich „Plätze“) steht die eigene nächste Buchung groß oben („Ändern“ öffnet sie). Darunter wählt das Mitglied einen Tag bis zum Vorlauf, bei mehreren Bereichen (z. B. Tennis und Padel) den Bereich und eine Ansicht: **Freie Zeiten** (eine Zeile je Uhrzeit, je Platz ein Kästchen), **Kompakt** (alle Plätze nebeneinander) oder **Ausführlich** (breite Spalten mit ganzen Namen, seitlich wischen; die Wahl merkt sich das Handy). Eine Zeile „Jetzt auf der Anlage“ zeigt, wer gerade spielt.

- **Buchen:** freie Stelle antippen, Dauer wählen (nur bis zur nächsten Buchung oder zur Höchstdauer), auf Wunsch Mitspieler, Gäste (mit Namen; der Haken „Mitglied in einem Partnerverein“ spart die Gebühr) oder ein Gerät („Ballmaschine“) bzw. „allein“ (z. B. Ballwand) hinzufügen. Wer das Sonderrecht hat, kann auch für ein anderes Mitglied buchen oder wiederholen. Ein Preisfeld zeigt vorab Gastgebühr und eventuelle Platzgebühr, dann die Platzordnung bestätigen und „Buchen“.
- **Belegte Zeit antippen:** zeigt, wer gebucht hat (je nach Einstellung), und bietet „Vormerken“ für die Warteliste.
- **Platzcode:** Nach dem Buchen zeigt die App den Code groß an („Platzcode fürs Tor“, mit Gültigkeit und Toren), unter „Platzcodes fürs Tor“ (unter „Meine Buchungen“) stehen die Codes aller eigenen Buchungen von heute und morgen, auch als Mitspieler, und bei Trainern die ihrer Serientermine – links Platz und Zeit, rechts der Code.
- **Meine Buchungen:** mit Symbolen für Kalender (die Buchung landet im Handykalender), Ändern und Stornieren (auch im Fenster „Buchung ändern“ ganz unten: „Buchung stornieren“); darunter „Meine Serien“ mit „Beenden“ und „Warteliste“ mit „Entfernen“.
- **Stornieren als Mitspieler:** Jeder eingetragene Mitspieler kann die ganze Buchung stornieren, mit derselben Frist wie der Buchende („Die Buchung von … wird für alle storniert.“). Ändern bleibt beim Buchenden. Eine Gebühr entfällt wie beim Storno durch den Buchenden; der Buchende und die anderen Mitspieler bekommen eine E-Mail und einen Push-Hinweis, das Protokoll nennt, wer storniert hat. Wer weder gebucht hat noch mitspielt, sieht „Gebucht hat … – nur er/sie oder ein Mitspieler kann stornieren.“
- **Push:** Das Mitglied kann sich benachrichtigen lassen, wenn es als Mitspieler eingetragen wird, wenn eine Buchung geändert oder storniert wird (auch durch eine Platzsperre), wenn ein Platz von der Warteliste frei wird und kurz vor dem Spiel (Vorlauf 2 Stunden, einstellbar). Welche Anlässe es gibt, legt der Vorstand unter Mitglieder-App › Benachrichtigungen fest.
- Ist ein Mitglied gesperrt (Mitgliedschaft oder Beitragsart darf nicht buchen), steht oben der Hinweis, sich an den Vorstand zu wenden.

![Der Reiter „Mitspieler“ in der App: eigenes Gesuch, Zusagen und offene Gesuche.](bild: app=buchung; klick=.bkm-tabs [data-tab="ms"])

![Das Fenster „Mitspieler suchen“.](bild: app=buchung; klick=.bkm-tabs [data-tab="ms"]; klick2=#bkmMsNew)

**Mitspieler (Reiter oben im Bereich „Plätze“):**
- **Mitspieler suchen:** Spielform wählen (bei „Training“ auch, wie viele), dann eine eigene, schon gebuchte Buchung oder „noch kein Platz“ mit Tag und Uhrzeit. Spielstärke, LK-Bereich und ein Hinweis (höchstens 140 Zeichen, ohne Links) sind freiwillig. „Gesuch einstellen“ stellt es ein. Sichtbar ist es nur für Mitglieder, die „Plätze“ in der App nutzen dürfen – mit „Nachname, Vorname“ und Foto (wenn für die Platzbuchung freigegeben), nie mit Telefonnummer oder E-Mail.
- **Ich spiele mit:** Die Zusage ist verbindlich, wer zuerst kommt, ist dabei. Hat das Gesuch einen Platz, steht man sofort als Mitspieler in der Buchung (mit denselben Regeln wie beim Buchen, z. B. Kontingent). „Details“ zeigt, wer schon dabei ist, und bietet **Melden**. Eigene Zusagen stehen unter „Meine Zusagen“ mit „Zusage zurückziehen“.
- **Mein Gesuch:** zeigt „2 von 3 gefunden“ und wer wann zugesagt hat („Entfernen“ nimmt eine Zusage heraus). „Bearbeiten“ ändert das Gesuch; gibt es schon Zusagen, bleiben Spielform, Zeit und Platz, wie zugesagt wurde. „Zurückziehen“ beendet es, eine gebuchte Buchung bleibt bestehen.
- **Platz buchen:** Ist ein Gesuch ohne Platz voll, öffnet „Platz buchen“ das Buchungsfenster am richtigen Tag mit Dauer und allen Mitspielern; „Für mich“ erinnert daran. Ist zur Startzeit kein Platz frei, wählt das Mitglied selbst einen. Gebucht wird nach den normalen Regeln, danach ist das Gesuch erledigt.
- **Ich suche auch Mitspieler:** Wer freiwillig Spielstärke und LK angibt, sieht passende Gesuche zuerst (gleiche oder benachbarte Stufe, LK im gesuchten Bereich). Andere sehen diese Angabe nicht; ausschalten löscht sie sofort.
- **Push:** „Jemand spielt mit“ und „Dein Gesuch ist voll“ gehen an den Ersteller, wenn der Vorstand die Anlässe unter Mitglieder-App › Benachrichtigungen freigegeben hat. Für neue Gesuche gibt es keinen Push.

**Am Tablet** (Reiter „Plätze“) sieht man denselben Plan. Eine freie Stelle antippen, den eigenen Namen suchen (erst ab zwei Buchstaben), die **PIN** eingeben und buchen; wer noch keine PIN hat, legt sie gleich fest. Auf einem Platz mit Tor zeigt das Tablet nach dem Buchen ein Fenster mit dem Platzcode, bis „Fertig“ getippt wird – ohne Eingabe schließt es nach etwa einer Minute von selbst, damit der Nächste am Tablet den Code nicht sieht. Eine Buchung antippen und „Stornieren“ geht ebenfalls mit PIN – für den Buchenden und für jeden eingetragenen Mitspieler. Bei Serien fragt das Tablet: „Nur heute“, „Heute und alle folgenden“ oder „Gesamte Serie“. Über dem Plan lassen sich wie in der App weitere Tage bis zum Vorlauf wählen; nach 2 Minuten ohne Eingabe springt das Tablet auf heute zurück.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Belegung ansehen | Belegung, Buchungen, Gebühren, Auswertung und Mitspielersuche ansehen |
| Für andere buchen | Buchungen und Sperren eintragen und bearbeiten, Gebühren von Hand buchen und stornieren |
| Stornieren | Buchungen und Sperren stornieren; Gesuche der Mitspielersuche ausblenden und Mitglieder dafür sperren |
| Serien & Sperren | Serien, Sperren und Spielplan-Import; Wiederholungen im Buchungsfenster |
| Plätze einrichten | Reiter „Plätze & Geräte“ und „Einstellungen“ mit Buchungsarten und Sonderrechten, Einstellungen der Mitspielersuche; die Tore für den Platzcode nur zusammen mit dem Recht „Zugang einrichten“ |
| Gästebuchung | Reiter „Gäste“: Einrichten, Schlüssel, PayPal-Zugang, Plätze für Gäste, Gastbuchung mit Kontakt ansehen, stornieren mit Erstattung, Abweichungen klären. Ansehen dürfen den Reiter alle mit einem Recht der Plätze (ohne Kontaktdaten). |

Mitglieder und Trainer buchen in der App und am Tablet ohne Verwaltungsrecht. Wer nur die Belegung sehen darf, sieht den Plan, kann aber nichts eintragen.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Mitglieder:** Namen, Mitgliedschaft, Beitragsarten und Ämter kommen von dort, ebenso Zahlungsstand und Einzug der Gebühren (Beiträge & Zahlungen › Offene Posten). Beim Zusammenführen doppelter Mitglieder wandern Buchungen, Serien, Warteliste und Gebühren mit. Beim Löschen eines Mitglieds fällt die Warteliste weg und seine Serien laufen als Vereinstermin weiter; vergangene Buchungen bleiben als Verlauf. In der Datenauskunft eines Mitglieds stehen seine Buchungen, Gebühren, Warteliste und Sonderrechte. Die Aufzeichnung dazu erscheint unter Einstellungen › Datenschutz.
- **Verkauf:** Gebühren von Trainern und ohne Mitgliederverwaltung kommen aufs Verkaufskonto und werden dort abgerechnet.
- **Spielbetrieb:** Der Spielplan-Import überträgt Spiele auch an den Spielbetrieb (Spieltage, Mannschaften).
- **Turniere:** Das Modul bucht die Plätze für Spiele (Clubmeisterschaft) und sperrt sie an Turniertagen – mit Vorschau, welche Buchungen betroffen sind. Turnierspiele sind Vereinstermine ohne Gebühr.
- **Zugang:** Türen mit Codetastatur lassen sich je Platz als Tore für den Platzcode wählen. Tippt jemand am Tor einen Code, fragt Zugang bei den Plätzen nach, ob gerade eine Buchung mit diesem Code dieses Tor öffnen darf, und öffnet dann wie aus der App. Ohne Zugang gibt es keine Codes; ohne Plätze öffnet keine Tastatur.
- **Buchhaltung:** Einnahmen und PayPal-Gebühren der Gastbuchungen stehen in der Buchführung (Zahlweg PayPal, Erlösart „Gastbuchungen (PayPal)“), Erstattungen als eigene Buchung.
- **Gästebuchung (Zugang):** Gastbuchungen auf Plätzen mit Toren bekommen einen Platzcode; er steht in der Bestätigungsmail des Gastes. Kontaktdaten der Gäste liegen verschlüsselt im Tresor, ihre Löschfrist steht unter Einstellungen › Datenschutz.
- **Mängel:** Die Plätze und Geräte erscheinen dort automatisch als Orte.
- **Einrichtung und Übersicht:** Der Einrichtungs-Assistent führt durch „Plätze anlegen“ und „Regeln fürs Buchen“. Die Übersicht zeigt offene Gebühren und die Buchungen von heute.
- **Mitglieder-App:** Auf „Für mich“ stehen die eigenen nächsten Buchungen, frei gewordene Plätze von der Warteliste und Buchungen, die eine Platzsperre storniert hat.
