# Spielbetrieb
<!-- kurz: Mannschaften, Spieltage, Zu- und Absagen und Aufstellung – die Spieler melden sich in der App, der Mannschaftsführer stellt auf. -->

## Wofür ist das Modul? {#wofuer}

Euer Verein hat Mannschaften, die an Spieltagen gegen andere Vereine antreten. Das Modul sammelt dafür alles an einer Stelle: die Mannschaften mit Mannschaftsführer und Meldeliste, die Spieltage (per Import vom Verband oder von Hand) und die Rückmeldungen der Spieler. Jeder Spieler sagt in der Mitglieder-App mit einem Fingertipp „ich kann“ oder „ich kann nicht“. Eine Ampel zeigt je Spieltag, ob genug Spieler zusammenkommen. Der Mannschaftsführer stellt in der App auf und verschickt die Aufstellung. Der Sportwart behält in der Verwaltung alle Mannschaften im Blick.

Das Modul läuft allein. Ohne die Mitgliederverwaltung gibt es nur Vor- und Nachname, Push-Nachrichten und keine E-Mails. Ohne Plätze werden Heimspiele nicht als Platzbelegung eingetragen.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Spielbetrieb“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Recht vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer Mannschaften und Spielplan pflegt, das Recht „Spielbetrieb“ (z. B. der Sportwart). Mannschaftsführer brauchen **kein** Konto in der Verwaltung, sie arbeiten in der App.
3. **Mannschaften anlegen:** Reiter „Mannschaften“ › „+ Mannschaft“ (siehe unten). Oder den Spielplan importieren – dabei entstehen die Mannschaften von selbst.
4. **Spieler zuordnen:** Je Mannschaft „Spieler verwalten“. Wer in einer aktiven Mannschaft steht oder sie führt, sieht in der Mitglieder-App den Bereich „Spieltage“.
5. **Spieltage holen:** Reiter „Spieltage“ › „Spielplan importieren …“. Schon vor dem Spielplan geht der Rahmenterminplan des Verbands („Rahmenterminplan …“).

## Verwaltung {#verwaltung}

Die Seite „Spielbetrieb“ hat oben vier Reiter: **Übersicht**, **Spieltage**, **Mannschaften** und **Einstellungen**.

### Seite „Spielbetrieb“ {#spielbetrieb}

![Die Seite „Spielbetrieb“ mit den vier Reitern.](bild: seite=spielbetrieb; tab=uebersicht; ziel=.tabs)

Welche Aufgabe wo liegt: Rückmeldungen ansehen und nachhaken in der **Übersicht**, Termine und Aufstellungen in den **Spieltagen**, Teams und Spieler in den **Mannschaften**, Schalter für die App in den **Einstellungen**.

### Reiter „Übersicht“ {#spielbetrieb-uebersicht}

Die Seite für den Sportwart: Wer hat schon geantwortet, wo wird es knapp?

#### Kennzahlen

![Die vier Kennzahlen oben.](bild: seite=spielbetrieb; tab=uebersicht; ziel=.kpis)

- **Rückmeldequote:** Wie viel Prozent der Zu- und Absagen für die nächsten Termine schon da sind.
- **Spieltage in den nächsten 14 Tagen:** wie viele Spiele bald anstehen.
- **Zu wenige Zusagen:** Spiele der nächsten 14 Tage, für die noch nicht genug Spieler können. Die Karte wird dann hervorgehoben.
- **Offene Absage-Anfragen:** Aufgestellte, die wieder absagen möchten und auf die Entscheidung des Mannschaftsführers warten.

#### Braucht Aufmerksamkeit

![Die Karte „Braucht Aufmerksamkeit“ mit den Punkten, um die sich jemand kümmern sollte.](bild: seite=spielbetrieb; tab=uebersicht; ziel=.sp-al)

Hier stehen nur Dinge, bei denen etwas zu tun ist: ein roter Punkt für zu wenige Zusagen, ein gelber für „Aufstellung noch nicht verschickt“ (wenn der Spieltag nahe ist) und für offene Absage-Anfragen. „Öffnen“ springt in den Spieltag. Ist alles in Ordnung, steht dort „Alles im grünen Bereich“.

#### Eine Karte je Mannschaft

![Die Rückmelde-Matrix einer Mannschaft: Spieler untereinander, die nächsten Termine nebeneinander.](bild: seite=spielbetrieb; tab=uebersicht; ziel=.sp-dt .card)

Oben stehen Name, Liga, Mannschaftsführer („MF“), Stellvertreter („Stv.“), Zahl der Spieler und die Mindestzahl. Rechts zeigt die Karte, wie viel Prozent „beantwortet“ sind, und „Offene erinnern“ schickt allen, die noch nicht geantwortet haben, eine Push-Nachricht (eine Nachricht je Person mit der Zahl offener Termine).

Darunter die **Matrix**: je Zeile ein Spieler (mit Nummer der Meldeliste, Gäste mit „Gast“), je Spalte einer der nächsten Termine mit Datum und „Heim“, „ausw.“, „vorl.“ (vorläufiger Termin) oder „Z/A“. Der Punkt vor dem Datum ist die Ampel. Ein Klick aufs Datum öffnet den Spieltag. In den Zellen steht ✓ (kann), ✕ (kann nicht) oder · (offen). Ein Ring zeigt: **grün** aufgestellt, **gelb** Ersatz, **rot** Absage-Anfrage. Ganz rechts zählt „offen“, in der letzten Zeile steht „Zusagen / benötigt“. Eine Legende unter den Karten erklärt die Zeichen.

> Mannschaften ohne Spieler oder ohne anstehende Termine sammelt eine eigene Karte am Ende, damit die Übersicht nicht mit leeren Tabellen voll wird.

### Reiter „Spieltage“ {#spielbetrieb-spieltage}

![Der Reiter „Spieltage“ als Liste: Datum, Begegnung und Zusagen.](bild: seite=spielbetrieb; tab=spieltage)

Oben wählt ihr die **Mannschaft** („Alle Mannschaften“ oder eine einzelne), die Ansicht **Liste** oder **Kalender** und in der Liste **Kommende** oder **Vergangene**. Die Knöpfe rechts oben sind „Drucken“, „Rahmenterminplan …“, „Spielplan importieren …“ und „+ Spieltag“.

Jede Zeile der Liste zeigt links die Ampel (grün genug Zusagen, rot zu wenige, grau abgesagt oder vergangen), das Datum mit Wochentag und Beginn, die Begegnung („Herren gegen TC Nachbarort“), Heim- oder Auswärtsspiel, Liga und Mannschaftsführer, ggf. „Aufstellung verschickt“. Rechts stehen Zähler: „3 von 4 können“, „2 offen“, „4 aufgestellt“, „1 Absage-Anfrage“, bei vergangenen Spielen das Ergebnis. Ein Klick auf die Zeile öffnet den Spieltag.

#### Kalender

![Die Kalenderansicht: ein Monat je Spalte, ein Tag je Zeile.](bild: seite=spielbetrieb; tab=spieltage; klick=[data-cal="1"]; ziel=.sp-calw)

Der Kalender zeigt das Jahr wie der Rahmenterminplan des Verbands: je Monat eine Spalte, je Tag eine Zeile, heute ist umrandet. Jedes Spiel ist eine kleine Marke mit Mannschaft und **H** (Heim) oder **A** (Auswärts), grün bei genug Zusagen, rot bei zu wenigen, gestrichelt als vorläufiger Termin („RT“, „Z/A“), durchgestrichen als abgesagt. Antippen öffnet den Spieltag. Oben wählt ihr das Jahr. „Drucken“ gibt den Kalender auf einer A4-Seite quer aus.

#### Spieltag öffnen

![Das Fenster eines Spieltags: Rückmeldungen, Aufstellung, Treffpunkt und Aufgaben.](bild: seite=spielbetrieb; tab=spieltage; klick=.sp-g; ziel=dialog)

Das Fenster zeigt oben Mannschaft, Gegner, Datum und Ort und die Zähler („3 von mindestens 4 können“, „1 kann nicht“, „2 offen“, „4 spielen · 1 Ersatz“). In der Tabelle steht jeder Spieler der Mannschaft:

- **Nr.:** Platz in der Meldeliste.
- **Spieler:** Name, dazu Kennzeichen: „Gast“, „Aushilfe“ (kommt aus einer anderen Mannschaft) und „spielt in …“ (an diesem Tag schon in einer anderen Mannschaft aufgestellt). Eine Notiz des Spielers steht darunter.
- **Verfügbarkeit:** offen, kann (mit „ab …/bis …“) oder kann nicht. Ihr könnt sie hier auch **für den Spieler eintragen**, z. B. wenn er telefonisch zusagt.
- **Aufstellung:** „–“, „spielt“ oder „Ersatz“. Wer an diesem Tag schon woanders spielt, ist gesperrt – ein Spieler spielt höchstens einmal am Tag.
- **Absage:** Möchte ein Aufgestellter absagen, ist die Zeile gelb. „Absage bestätigen“ nimmt ihn heraus (ihr müsst dann Ersatz aufstellen), „ablehnen“ lässt ihn aufgestellt. Er bekommt eine Antwort aufs Handy.

Darunter:

- **Aushilfe aus einer anderen Mannschaft:** Spieler einer anderen Mannschaft auswählen und „Als Ersatz aufstellen“.
- **Treffpunkt & Hinweise:** Uhrzeit, Ort, Ergebnis und ein „Hinweis an die Mannschaft“ (z. B. „bitte weiße Kleidung“). „Treffpunkt speichern“ übernimmt das.
- **Aufgaben:** nur sichtbar, wenn eingeschaltet (siehe Einstellungen). Je Aufgabe (z. B. Fahrer) wählt ihr einen Spieler, „entfernen“ löscht sie, „+ Fahrer“ legt eine neue an.

Die Knöpfe unten: **Spieltag ändern …** (Gegner, Datum, Beginn, Ort, Status, Ergebnis), **Offene erinnern** (Push an alle ohne Antwort), **Aufstellung verschicken** (fragt nach, geht als Push und – mit Mitgliederverwaltung und eingeschalteter E-Mail – als E-Mail mit Kalendereintrag an alle Aufgestellten und Ersatzspieler) und **Schließen**.

> Wird ein Spieltag verlegt oder abgesagt, bekommt die Mannschaft eine Nachricht. Eine bereits verschickte Aufstellung ändert ihr einfach und verschickt sie neu.

#### Neuer Spieltag und Spieltag ändern

![Das Fenster „Neuer Spieltag“.](bild: seite=spielbetrieb; tab=spieltage; klick=#spNew; ziel=dialog)

Mannschaft und Gegner, Datum und Beginn, Heim oder Auswärts und bei Auswärtsspielen der Spielort (Anlage, Straße, Ort). Beim Ändern kommen **Status** (geplant oder abgesagt) und **Ergebnis** dazu, außerdem „Löschen“ – dabei gehen Rückmeldungen und Aufstellung verloren, deshalb fragt Clubwerk nach.

#### Spielplan importieren

![Das Fenster „Spielplan importieren“: Tabelle einfügen oder Datei wählen.](bild: seite=spielbetrieb; tab=spieltage; klick=#spImp; ziel=dialog)

So kommen die Spiele des Verbands ohne Abtippen ins System:

1. Auf der Seite des Verbands die Tabelle mit den Begegnungen markieren (von „Datum“ bis zum letzten Spiel), kopieren und in das Feld einfügen – z. B. nuLiga „Begegnungen“. Oder eine Datei wählen: CSV, Excel oder Kalender (.ics, z. B. fussball.de „Spielplan exportieren“).
2. „Einlesen“ zeigt die Prüfseite: oben euer Vereinsname (für „Heimspiel“ – bei einer Änderung wird neu gelesen), die Zahl der erkannten Spiele und Heimspiele. Je erkannter Mannschaft wählt ihr, ob sie **neu angelegt** wird oder zu einer **vorhandenen** gehört. In der Liste der Spiele hakt ihr ab, was übernommen wird; jede Zeile trägt die Kennzeichen „neu“, „verlegt“ oder „schon eingetragen“. Übernommen werden nur kommende Spiele des eigenen Vereins, auch die Auswärtsspiele.
3. Mit Plätzen: „Heimspiele auch bei den Plätzen als Platzbelegung eintragen“.
4. „X Spieltage übernehmen“. Danach steht in der Meldung, was passiert ist: neu, aus vorläufigen Terminen entstanden, verlegt, Mannschaften angelegt.

Ihr könnt den Import jederzeit wiederholen: Bereits eingetragene Spiele bleiben unberührt, verlegte werden angepasst und die Rückmeldungen bleiben erhalten.

#### Rahmenterminplan

![Das Fenster „Rahmenterminplan importieren“.](bild: seite=spielbetrieb; tab=spieltage; klick=#spRtp; ziel=dialog)

Der Verband veröffentlicht lange vor dem Spielplan den Rahmenterminplan als PDF mit den Spieltagen je Altersklasse. Ihr wählt die PDF, prüft auf der nächsten Seite je Mannschaft die vorgeschlagene **Altersklasse** (aus Name und Liga erraten, änderbar, „nicht übernehmen“ ist möglich) und seht die erkannten Termine ab heute. Mit dem Haken „Zusatz- und Ausweichtage (Z/A) auch abfragen“ kommen diese gestrichelt dazu. „Für X Mannschaften übernehmen“ legt **vorläufige Termine** an.

Vorläufige Termine sind in der Liste grau und heißen „Rahmentermin“. Die Spieler sehen sie erst, wenn ihr oben auf dem Reiter im gelben Hinweis „**Abfrage starten**“ klickt. Dann erscheinen sie in der App, alle Spieler bekommen eine Push-Nachricht und melden „kann“ oder „kann nicht“. Kommt später der Spielplan, wird aus jedem vorläufigen Termin der echte Spieltag – die Rückmeldungen bleiben. Termine ohne Spiel entfallen; wer „kann“ gemeldet hatte, bekommt die Nachricht „spielfrei“.

![Der gelbe Hinweis mit dem Knopf „Abfrage starten“.](bild: seite=spielbetrieb; tab=spieltage; ziel=.banner)

Ein vorläufiger Termin hat ein einfacheres Fenster: nur Rückmeldungen, kein Treffpunkt und keine Aufstellung. Dort gibt es „Offene erinnern“ und „Termin löschen“.

### Reiter „Mannschaften“ {#spielbetrieb-mannschaften}

![Der Reiter „Mannschaften“: eine Karte je Mannschaft mit der Meldeliste.](bild: seite=spielbetrieb; tab=mannschaften)

Jede Mannschaft ist eine Karte: Name, darunter Altersklasse, Liga, Saison, Mindestzahl, Mannschaftsführer und Stellvertreter, darunter die Meldeliste als kleine Schilder mit Nummer und Name. Nicht aktive Mannschaften sind gekennzeichnet. Ein gelbes Schild hinter einem Namen ist ein **Hinweis** (kein Verbot): „wird 2027 erst 38 (H40)“ bei zu jungen Spielern in einer Altersklasse, „männlich – Damenmannschaft“ bei den Damen, „Geburtsdatum fehlt“. Maßgeblich ist das Saisonjahr aus dem Feld „Saison“ („Sommer 2027“ ergibt 2027, „Winter 2026/27“ ergibt 2027), sonst das laufende Jahr. Die Hinweise brauchen die Mitgliederverwaltung (Geburtsdatum, Geschlecht); Jugendmannschaften sind gemischt und bekommen keinen Hinweis.

#### Mannschaft anlegen und bearbeiten

![Das Fenster „Neue Mannschaft“.](bild: seite=spielbetrieb; tab=mannschaften; klick=#tmNew; ziel=dialog)

- **Name:** z. B. „Herren 40 I“. Dieselbe Mannschaft (gleiche Altersklasse und Nummer) lässt sich nicht doppelt anlegen; Clubwerk schlägt „Herren 30 II“ vor. „Damen 40“ und „Herren 40“ sind zwei Mannschaften.
- **Liga** und **Saison:** nur zur Anzeige und für die Hinweise.
- **Altersklasse (Rahmenterminplan):** z. B. H40, D, HL H30 – wird für den Rahmenterminplan gebraucht.
- **Mindestens Spieler pro Spieltag:** Ab dieser Zahl an Zusagen wird die Ampel grün.
- **Mannschaftsführer** und **Stellvertreter:** aus den Mitgliedern. Beide stellen in der App auf – ohne Konto in der Verwaltung.
- **Aktiv:** Nicht aktive Mannschaften verschwinden aus der App, bleiben aber erhalten.

„Löschen“ fragt genau nach, was mitgeht: Spieltage mit Rückmeldungen, die Meldeliste und Gastspieler, die nur in dieser Mannschaft sind. „Nicht aktiv“ behält alles.

#### Spieler verwalten

![Das Fenster „Spieler/innen“: links suchen, rechts die Meldeliste.](bild: seite=spielbetrieb; tab=mannschaften; klick=[data-pl]; ziel=dialog)

Links sucht ihr Mitglieder und Gastspieler und holt sie mit **+** in die Mannschaft. Rechts steht die **Meldeliste** (Nummer 1 oben), die ihr mit ▲ und ▼ umsortiert; ✕ nimmt jemanden heraus. Eine Person kann in mehreren Mannschaften spielen. „Speichern“ übernimmt die Liste. Wer dadurch in keiner Mannschaft mehr steht, wird gemeldet.

**Gastspieler/innen** sind keine Vereinsmitglieder (z. B. bei einer Spielgemeinschaft mit dem Nachbarverein). „+ Gastspieler/in anlegen“ verlangt Vor- und Nachname, optional Verein und Handynummer. Gäste haben kein Konto und keine App. Stattdessen bekommt jeder Gast einen **persönlichen Link**: Der Link-Knopf kopiert ihn (z. B. für WhatsApp), mit dem Stift ändert ihr Angaben und seht, wann der Link zuletzt geöffnet wurde. „Neuer Link …“ macht den alten ungültig, „Ganz entfernen …“ löscht den Gast aus allen Mannschaften. Ein Gastlink verfällt nach 12 Monaten ohne Nutzung oder wenn der Gast in keiner aktiven Mannschaft mehr steht.

> Für den Link braucht die Mitglieder-App eine Adresse von außen (Mitglieder-App › Einstellungen).

### Reiter „Einstellungen“ {#spielbetrieb-einstellungen}

Vier Karten, jede mit eigenem „Speichern“. Abgeschaltete Bereiche (Aufgaben, Erinnerungen) bleiben eingeklappt, bis ihr sie einschaltet.

#### Was Spieler in der App sehen

![Karte „Was Spieler in der App sehen“.](bild: seite=spielbetrieb; tab=einstellungen; ziel=[data-card="sehen"])

- **Wer sonst kann:** Spieler sehen die Namen der anderen, die für einen Spieltag zugesagt haben.
- **Aufstellung:** Spieler sehen, wer aufgestellt ist. Der Mannschaftsführer sieht immer alles.
- **Mannschaftsführer mit Handynummer:** Oben in „Spieltage“ steht, wen man bei Fragen anruft (mit Knopf „Anrufen“). Die Nummer kommt aus den Mitgliedern.
- **„kann ab …“ / „kann bis …“ anbieten:** Spieler können ihre Zusage mit einer Uhrzeit versehen, z. B. wenn jemand später kommt.

#### Aufgaben

![Karte „Aufgaben“ mit der Liste der Aufgabenarten.](bild: seite=spielbetrieb; tab=einstellungen; ziel=[data-card="aufgaben"])

Mit „Aufgaben je Spieltag“ verteilt der Mannschaftsführer Aufgaben wie Fahrer oder Kuchen mitbringen; Spieler können offene Aufgaben in der App selbst übernehmen. In der Liste legt ihr mit „+ Aufgabe“ die Arten an (vorgegeben sind Fahrer bei Auswärtsspielen, Bewirtung bei Heimspielen sowie Bälle mitbringen und Spielbericht eintragen bei jedem Spiel) und stellt je Aufgabe ein, ob sie „bei jedem Spiel“, „nur bei Heimspielen“ oder „nur bei Auswärtsspielen“ gilt. „Entfernen“ löscht die Art aus der Liste.

#### Erinnerungen & Nachrichten

![Karte „Erinnerungen & Nachrichten“.](bild: seite=spielbetrieb; tab=einstellungen; ziel=[data-card="erinnerungen"])

- **Automatische Erinnerungen:** Spieler ohne Antwort bekommen vor dem Spieltag eine Push-Nachricht („Spieler erinnern … Tage vorher“, Standard 7). Der Mannschaftsführer bekommt eine Warnung, wenn zu wenige können („Mannschaftsführer warnen … Tage vorher“, Standard 5).
- **Wichtige Nachrichten auch per E-Mail:** Aufstellung und Absage-Anfragen zusätzlich per E-Mail an die Adresse aus den Mitgliedern, mit Kalendereintrag. Push kommt immer. Ohne Mitgliederverwaltung gibt es nur Push.

Welche Push-Nachrichten es gibt, legt der Vorstand unter Mitglieder-App › Benachrichtigungen fest. Das Modul bringt diese Anlässe mit: „Du bist aufgestellt“, „Aufstellung verschickt“, „Absage-Anfrage“, „Antwort auf Absage“, „Spieltag verlegt/abgesagt“, „Bitte Verfügbarkeit melden“, „Zu wenige Spieler“, „Vorläufige Termine“ und „Aufgabe übernommen/zugeteilt“.

#### Einstellungen übertragen

![Karte „Einstellungen übertragen“: exportieren und importieren.](bild: seite=spielbetrieb; tab=einstellungen; ziel=#spFunc)

Mannschaften (ohne Spieler und Spieltage) und Einstellungen als Datei exportieren und in einer anderen Clubwerk-Installation importieren, z. B. für einen zweiten Verein oder nach einer Neuinstallation. Es sind keine PINs oder Passwörter enthalten; Spieler und Spieltage ordnet ihr danach neu zu bzw. importiert sie neu. Beim Import werden gleichnamige Einträge (ohne Groß-/Kleinschreibung) aktualisiert, neue angelegt, nichts wird gelöscht. Die Meldung nennt je Art, wie viele neu und wie viele aktualisiert wurden.

## Tablet und App {#tablet-app}

Am Tablet gibt es dieses Modul nicht. Gearbeitet wird in der Mitglieder-App im Bereich **Spieltage**. Er erscheint für alle, die in einer aktiven Mannschaft spielen oder sie führen. Auf der Startseite „Für mich“ steht unter „Zu erledigen“ nur ein Hinweis „Spieltage: n Rückmeldungen offen“, ohne ✓/✕-Knöpfe und ohne Zeitgrenze. Antippen führt in den Bereich „Spieltage“, dort wird geantwortet.

#### Für Spieler

![Der Bereich „Spieltage“ in der App: eine Zeile je Spieltag mit ✓ und ✕.](bild: app=spielbetrieb)

Oben steht die Mannschaft mit Liga und der Mannschaftsführer (sonst Stellvertreter) mit „Anrufen“. Darunter eine Zeile je Spieltag: Datum, Begegnung, Uhrzeit, Heim oder auswärts und rechts **✓** (ich kann) und **✕** (ich kann nicht). Nochmal tippen nimmt die Antwort zurück. Antippen der Zeile klappt Details auf: Treffpunkt, Spielort, wer kann, wer aufgestellt ist (je nach Einstellung) und die Aufgaben („Übernehme ich“ / „Abgeben“). Mit „Uhrzeit angeben“ bietet man „ab“ und „bis“ und einen Hinweis an. Ist man aufgestellt, steht dort „Du spielst“ mit dem Treffpunkt und dem Knopf **Kann doch nicht – Absage anfragen**; der Mannschaftsführer muss bestätigen, bis dahin bleibt man aufgestellt. Ersatzspieler können direkt absagen. Eine Anfrage lässt sich mit „Absage zurücknehmen“ widerrufen.

Spielt jemand in mehreren Mannschaften, wählt er oben die Mannschaft. In „Alle“ steht jeder Tag nur einmal („Herren + Herren 30“): ein ✓/✕ gilt für alle Mannschaften dieses Tages, aufgeklappt antwortet man einzeln. Bei drei oder mehr offenen Terminen erscheint „Alle ✓ / Alle ✕“. Wer an einem Tag schon aufgestellt ist, sieht in der anderen Mannschaft „spielt in …“ statt ✓/✕. Unten steht, wie oft man in dieser Saison gespielt hat.

#### Für Mannschaftsführer

![Das Fenster des Mannschaftsführers: Spieler aufstellen, Treffpunkt eintragen, Aufstellung verschicken.](bild: app=spielbetrieb; klick=.sb-rh; klick2=[data-lead])

Der Mannschaftsführer (und sein Stellvertreter) sieht in jedem Spieltag zusätzlich die Ampel und den Knopf **Aufstellung**. Das Fenster liegt in der App, es öffnet nie ein neues Browserfenster. Es zeigt die Spieler, wer kann zuerst, und je Spieler **spielt / Ersatz / –**. Dazu: Absage-Anfragen bestätigen oder ablehnen, Aushilfe aus einer anderen Mannschaft als Ersatz holen, Gastspieler anlegen und ihren Link teilen (über das Teilen-Menü des Handys), für Gäste die Antwort selbst eintragen, Treffpunkt, Ergebnis und Hinweis speichern, Aufgaben zuteilen, „Offene erinnern“ und **Aufstellung verschicken**. Bei vorläufigen Terminen gibt es nur die Rückmeldungen („Rückmeldungen · Gäste eintragen“).

#### Für Gastspieler

Gäste öffnen ihren persönlichen Link. Das ist eine eigene, einfache Seite „Spieltage“ ohne Anmeldung und ohne App: eine Zeile je Tag mit ✓ und ✕, „Alle ✓ / Alle ✕“ bei vielen offenen Terminen. Der Mannschaftsführer sieht die Antwort sofort.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Spielbetrieb | Die Seite „Spielbetrieb“ in der Verwaltung: Mannschaften und Spieler pflegen, Spielplan und Rahmenterminplan importieren, Spieltage ändern, aufstellen und Aufstellungen verschicken, Einstellungen ändern (Sportwart) |

Mitglieder in der App brauchen kein Recht: Zu- und Absagen darf, wer in einer Mannschaft steht. Aufstellen darf nur der Mannschaftsführer (und sein Stellvertreter) seiner Mannschaft.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Mitglieder:** Spieler, Mannschaftsführer und Stellvertreter kommen aus der Mitgliederverwaltung; Namen erscheinen als „Nachname, Vorname“. Sie liefert Handynummer, E-Mail-Adresse, Geburtsdatum und Geschlecht (für die Hinweise). In der Datenauskunft eines Mitglieds stehen seine Mannschaften, Zusagen, Aufstellungen und Aufgaben; beim Zusammenführen doppelter Mitglieder gehen die Verweise mit, und beim Löschen zeigt Clubwerk „Spielt in: …“ als Grund, warum es noch nicht geht.
- **Plätze:** Der Spielplan-Import kann Heimspiele zugleich als Platzbelegung eintragen.
- **Nachrichten:** Jede aktive Mannschaft ist eine Empfängergruppe („Mannschaft Herren 40“) mit Mannschaftsführer und Stellvertreter.
- **Mitglieder-App:** „Für mich“ zeigt unter „Zu erledigen“ nur den Hinweis „Spieltage: n Rückmeldungen offen“ (ohne Knöpfe) und führt in den Bereich „Spieltage“.
- **Datenschutz und Einrichtung:** Das Modul meldet sich im Verzeichnis der Verarbeitungstätigkeiten, im Einrichtungs-Assistenten (Schritt „Mannschaften“) und in der Suche (Strg/⌘ K findet Spieltage, Mannschaften und die Aktionen dieser Seite).
