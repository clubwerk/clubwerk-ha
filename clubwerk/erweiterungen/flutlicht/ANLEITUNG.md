# Flutlicht
<!-- kurz: Licht der Plätze automatisch zur Buchung oder per Handy schalten – geht immer von selbst wieder aus. -->

## Wofür ist das Modul? {#wofuer}

Clubwerk schaltet das Flutlicht eurer Plätze. Ist ein Platz für die Zeit nach Einbruch der Dunkelheit gebucht, geht das Licht kurz vorher an und nach dem Spiel wieder aus. Freigeschaltete Mitglieder schalten es im WLAN des Vereinsheims mit der Mitglieder-App ein, am Vereinstablet mit Namen und PIN, und die Verwaltung jederzeit von Hand. Das Licht geht immer von selbst wieder aus, spätestens zur Nachtruhe. Auf Wunsch berechnet Clubwerk ein Lichtgeld je angefangene Viertelstunde.

Das Modul läuft auch allein. Ohne das Modul „Plätze“ gibt es keine Automatik, nur das Schalten von Hand. Ohne die Mitgliederverwaltung erscheinen Namen nur als Vor- und Nachname.

### Was brauche ich? {#was-brauche-ich}

- **Home Assistant** mit einem **Schaltaktor je Platz**, der dort als Schalter (`switch.*`) oder Licht (`light.*`) erscheint. Welcher Hersteller, ist egal (z. B. Shelly, KNX, Homematic, Zigbee-Relais).
- Der Schaltaktor schaltet ein **Lastschütz**, das die Strahler versorgt. Strahler ziehen viel Strom; ein kleines Relais allein reicht dafür nicht.
- **Einbau und Anschluss nur durch eine Elektrofachkraft.** Am Mast und im Verteiler liegt Netzspannung.
- Empfehlung: In Home Assistant zusätzlich eine kleine Automatisierung „Licht länger als 4 Stunden an → aus“. Sie hält das Licht aus, falls Clubwerk einmal gar nicht läuft.

## Einrichten {#einrichten}

1. **Schalter in Home Assistant einrichten:** Jeder Platz hat einen Schalter, der in Home Assistant funktioniert (Einstellungen › Geräte & Dienste).
2. **Einstellungen › Module:** Schalter bei „Flutlicht“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
3. **Rechte vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer alles einrichten soll, das Recht „Flutlicht“. Wer nur schalten soll (z. B. der Platzwart), bekommt „Flutlicht bedienen“.
4. **Lichtanlagen anlegen:** Reiter „Anlagen“ › „+ Lichtanlage“. Je Platz Name, Schalter und Platz wählen. Danach unter „Bedienen“ einmal ein- und ausschalten.
5. **Zeiten einstellen:** Reiter „Zeiten“: Standort für den Sonnenuntergang und die Nachtruhe.
6. **Mitglieder freischalten:** Unter Mitglieder-App den Bereich „Licht“ für die Mitglieder freischalten, die schalten dürfen. Am Tablet erscheint „Licht“, wenn ihr es unter Einstellungen › Tablet einschaltet.

## Verwaltung {#verwaltung}

Das Menü „Flutlicht“ hat fünf Reiter: **Bedienen**, **Anlagen**, **Zeiten**, **Verlauf** und **Einstellungen**. Wer nur das Recht „Flutlicht bedienen“ hat, sieht nur „Bedienen“.

So funktioniert das Schalten: Eine Lichtanlage brennt, solange es dafür einen Grund gibt, z. B. eine Buchung oder ein Mitglied, das eingeschaltet hat. Jeder Grund hat ein festes Ende, das Clubwerk speichert. Auch nach einem Neustart oder Update geht das Licht deshalb pünktlich aus.

### Seite „Bedienen“ {#flutlicht}

![Die Seite „Bedienen“: die Karte „Heute“ und darunter die Lichtanlagen.](bild: seite=flutlicht)

#### Heute

![Karte „Heute“: ab wann es dunkel ist, Nachtruhe, Automatik und Lichtgeld.](bild: seite=flutlicht; ziel=.card:has(.vh-kv))

Die Karte zeigt, ab wann heute Licht möglich ist (**Dunkel ab**), wann die **Nachtruhe** beginnt, ob die **Automatik** aus der Platzbuchung läuft und das **Lichtgeld**. Können Mitglieder, Tablet und Automatik gerade nicht schalten (Nachtruhe, Sperrtag, außerhalb der Saison), steht der Grund darunter.

#### Lichtanlagen

Jede Lichtanlage ist eine Kachel. Brennt das Licht, ist sie farbig hinterlegt und zeigt, bis wann („An bis 20:30 Uhr · noch 42 Min.“) und warum („Buchung Becker, Anna“, „Vereinsbuchung“, „App: …“). Ist es aus, steht dort, wann die Automatik es als Nächstes einschaltet.

- **Einschalten:** öffnet ein Fenster, in dem ihr die Dauer wählt (30 Minuten bis 8 Stunden). Aus der Verwaltung geht das auch vor der Dunkelheit, nach der Nachtruhe und ohne Lichtgeld.
- **+30 Min.:** verlängert das Licht (die Minutenzahl stellt ihr in den Einstellungen ein).
- **Ausschalten:** schaltet sofort aus, auch Licht für eine Buchung.

![Fenster „Einschalten“: wie lange das Licht brennen soll.](bild: seite=flutlicht; klick=[data-a="on"]; ziel=dialog)

Ist ein Schalter in Home Assistant nicht erreichbar, ist die Kachel grau und Einschalten nicht möglich.

#### Alles aus

„Alles aus“ (mit Rückfrage) schaltet sofort jedes Licht aus und beendet alle laufenden Zeiten. Die Automatik schaltet für dieselben Buchungen nicht erneut ein, erst für die nächste Buchung.

### Reiter „Anlagen“ {#flutlicht-anlagen}

![Der Reiter „Anlagen“: alle Lichtanlagen mit Schalter, Platz, Vorlauf und Nachlauf.](bild: seite=flutlicht-anlagen)

Die Liste zeigt jede Lichtanlage mit **Name**, **Schalter in Home Assistant**, **Platz**, **Vorlauf** und **Nachlauf**. Die Reihenfolge gilt auch in App und Tablet; mit ↑ und ↓ verschiebt ihr eine Anlage. Fehlt ein Schalter in Home Assistant, steht dahinter „fehlt“.

#### + Lichtanlage / Bearbeiten

![Fenster „Lichtanlage bearbeiten“: Name, Schalter, Platz, Vorlauf und Nachlauf.](bild: seite=flutlicht-anlagen; klick=[data-ed="0"]; ziel=dialog)

- **Name:** so heißt die Anlage überall (bis 30 Zeichen), meist wie der Platz.
- **Schalter in Home Assistant:** ein `switch.*` oder `light.*`. Ein Schalter gehört zu genau einer Lichtanlage und zu keinem anderen Modul.
- **Platz (für die Automatik):** der Platz aus dem Modul „Plätze“. Je Platz gibt es genau eine Lichtanlage; belegte Plätze sind in der Auswahl gesperrt. „Kein Platz“ heißt: nur von Hand (z. B. ein Trainingsfeld ohne Buchung).
- **Vorlauf:** so viele Minuten vor einer Buchung geht das Licht an (0 bis 30). Manche Strahler brauchen einige Minuten, bis sie hell sind.
- **Nachlauf:** so lange bleibt es nach dem Ende der Buchung an (0 bis 30).

Beim Bearbeiten steht unten abgesetzt **Lichtanlage löschen …** (mit Rückfrage). Der Verlauf bleibt erhalten.

> Ändert ihr die Schalter, bekommt der Vorstand zur Sicherheit eine Mitteilung mit „vorher“ und „jetzt“.

### Reiter „Zeiten“ {#flutlicht-zeiten}

#### Dunkelheit

![Karte „Dunkelheit“: Sonnenuntergang aus dem Standort, Versatz und Vorschau.](bild: seite=flutlicht-zeiten; ziel=.card:has(#flSrc))

Clubwerk rechnet den Sonnenuntergang selbst aus dem **Breiten- und Längengrad** eures Platzes (ohne Internet). Alternativ übernimmt es ihn aus Home Assistant (`sun.sun`). Mit dem **Versatz** legt ihr fest, ab wann Licht möglich ist, z. B. „-30“ = eine halbe Stunde vor Sonnenuntergang. Unter den Feldern steht, was das heute und in vier Wochen bedeutet. Vorher schalten weder Automatik noch Mitglieder.

#### Nachtruhe

![Karte „Nachtruhe“: Uhrzeit je Wochentag.](bild: seite=flutlicht-zeiten; ziel=.card:has(#flQ1))

Je Wochentag die Uhrzeit, zu der alles ausgeht, was Mitglieder, Tablet und Automatik eingeschaltet haben (zwischen 17:00 und 24:00 Uhr; Vorgabe 22:00 Uhr). Bis 6 Uhr morgens bleibt dann alles aus. Wird ein Licht in dieser Zeit in Home Assistant eingeschaltet, schaltet Clubwerk es wieder aus. Nur die Verwaltung darf nach der Nachtruhe einschalten, mit fester Dauer.

#### Saison

Ist „Licht nur in der Saison“ angehakt, schalten Mitglieder, Tablet und Automatik nur zwischen den beiden Tagen (z. B. 01.04. bis 31.10.; auch über den Jahreswechsel möglich). Außerhalb schaltet nur die Verwaltung.

#### Sperrzeiträume

![Karte „Sperrzeiträume“: Tage, an denen das Licht aus bleibt.](bild: seite=flutlicht-zeiten; ziel=#flBBox)

An Sperrtagen schalten weder Mitglieder noch Automatik, z. B. bei Wartung der Masten. „+ Sperrzeitraum“ steht oben rechts; im Fenster tragt ihr **Von**, **Bis** und optional einen **Grund** ein. Beim Bearbeiten hebt **Sperrzeitraum aufheben …** die Sperre wieder auf.

### Reiter „Verlauf“ {#flutlicht-verlauf}

![Der Reiter „Verlauf“: Schaltzeiten des Monats, Betriebsstunden und Ereignisse.](bild: seite=flutlicht-verlauf; hoehe=520)

#### Schaltzeiten

Oben wählt ihr den **Monat**. Spalten: **Lichtanlage**, **Zeit** (von–bis; „brennt“, solange es läuft), **Dauer**, **Auslöser** (Automatik, App, Tablet, Verwaltung oder „außerhalb von Clubwerk“, mit Namen und Grund für das Ende) und **Lichtgeld** mit Stand (offen, bezahlt, storniert). „Excel“ oben rechts lädt den Monat als Tabelle herunter.

Mit **Stornieren** nehmt ihr ein Lichtgeld zurück (mit Rückfrage), z. B. nach einer Fehlbedienung. Steckt der Posten schon in einem Einzug, lehnt Clubwerk ab und sagt, was zu tun ist.

#### Betriebsstunden

Wie lange jede Lichtanlage im Jahr gebrannt hat, z. B. für die Wartung der Strahler. Überschneiden sich zwei Gründe (Buchung und Verlängerung), zählt die Zeit nur einmal.

#### Ereignisse

Störungen („Home Assistant antwortet nicht“, mit „Behoben“, sobald es wieder geht), Abschaltungen zur Nachtruhe, „Alles aus“ und abgelehnte Versuche.

### Reiter „Einstellungen“ {#flutlicht-einstellungen}

#### Anbindung

„Verbindung testen“ prüft, ob Home Assistant antwortet, wie viele Schalter es gibt und ob jede Lichtanlage erreichbar ist.

#### Wer darf schalten?

![Karte „Wer darf schalten?“: Automatik, App, Tablet, Höchstdauer und Verlängern.](bild: seite=flutlicht-einstellungen; ziel=.card:has(#flWA))

- **Automatik:** gebuchte Plätze nach Einbruch der Dunkelheit beleuchten (braucht das Modul „Plätze“).
- **Mitglieder in der App:** nur freigeschaltete, nur im WLAN des Vereinsheims. Die Zahl in Klammern nennt, wie viele freigeschaltet sind.
- **Am Tablet:** mit Namen und App-PIN, nur freigeschaltete.
- **Höchstens am Stück:** längste Dauer, die Mitglieder auf einmal wählen können (15 bis 240 Minuten, Vorgabe 90).
- **Verlängern um:** Minuten für den Knopf „+30 Min.“ (5 bis 120).

#### Lichtgeld

![Karte „Lichtgeld“: Betrag je angefangene Viertelstunde und ab welcher Uhrzeit.](bild: seite=flutlicht-einstellungen; ziel=.card:has(#flFee))

Standardmäßig aus. Eingeschaltet berechnet Clubwerk für jede **angefangene Viertelstunde** ab der eingestellten **Uhrzeit** den Betrag. Gebucht wird wie die Platzgebühr: als offener Posten in den Mitgliedern bzw. bei Trainern und ohne Mitgliederverwaltung aufs Verkaufskonto. So wird gerechnet:

| Fall | Wer zahlt | Was zählt |
|---|---|---|
| Automatik, Einzelbuchung | wer gebucht hat | nur die gebuchte Zeit; Vorlauf und Nachlauf sind frei |
| Buchung storniert, während das Licht brennt | wer gebucht hat | nur bis zum Storno |
| App oder Tablet | wer eingeschaltet hat | bis zum Ausschalten (höchstens bis zum geplanten Ende) |
| Verlängern eines fremden Lichts | wer verlängert | nur die zusätzliche Zeit |
| Verwaltung, Serien, Mannschafts-, Vereins- und Turnierbuchungen | niemand | – |

Beispiel: 18:55 bis 20:30 Uhr mit 0,50 € ab 18:00 Uhr sind 7 angefangene Viertelstunden, also 3,50 €. Es gilt der Betrag, der beim Einschalten eingestellt war.

#### Benachrichtigungen

Lässt sich ein Licht nicht schalten, kann Clubwerk aufs Handy melden: der Name des Handys in Home Assistant (Mitteilungsdienst „notify“). Leer = keine Meldung. Clubwerk versucht es in jedem Fall weiter.

#### Einstellungen übertragen

Lichtanlagen, Zeiten und Einstellungen als Datei exportieren und in einer anderen Installation importieren. Die Zuordnung zu Plätzen, der Verlauf und Lichtgeld sind nicht dabei.

## Tablet und App {#tablet-app}

![Der Bereich „Licht“ in der Mitglieder-App.](bild: app=flutlicht)

**In der App** (Bereich „Licht“) sehen freigeschaltete Mitglieder alle Lichtanlagen. Oben steht, ob das Handy im Vereins-WLAN ist und ab wann Licht möglich ist. „Einschalten“ öffnet ein Fenster mit 30, 60 oder 90 Minuten, der Uhrzeit, zu der das Licht ausgeht, und dem voraussichtlichen Lichtgeld. Ein Mitglied schaltet nur aus, was es selbst eingeschaltet hat (oder seine eigene Buchung); fremdes Licht kann es verlängern. Fremde Namen erscheinen nie, nur „für eine Buchung“. Ist Lichtgeld eingeschaltet, zeigt die Karte „Lichtgeld“ die eigenen letzten Posten.

Schalten geht nur im WLAN des Vereinsheims, nie über das Internet, auch nicht mit der Ausnahme „auch unterwegs“.

![Die Seite „Licht“ am Tablet.](bild: tablet=Licht; hoehe=560)

**Am Tablet** gibt es den Reiter „Licht“, wenn ihr ihn unter Einstellungen › Tablet eingeschaltet habt. Nach dem Antippen wählt man die Dauer, gibt die ersten Buchstaben seines Namens ein und tippt die App-PIN. Es erscheinen nur freigeschaltete Mitglieder mit gekoppeltem Handy. Die Fehlversuchs-Bremse ist dieselbe wie bei den Türen: nach 10 falschen PINs in 24 Stunden schaltet sich das Tablet für das Licht ab, und der Vorstand bekommt eine Warnung.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Flutlicht | Alles im Menü „Flutlicht“: Lichtanlagen, Zeiten, Verlauf, Lichtgeld stornieren und Einstellungen; außerdem Bedienen |
| Flutlicht bedienen | Nur die Seite „Bedienen“: Licht ein- und ausschalten, verlängern, „Alles aus“. Nichts einrichten |

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Plätze:** liefert die Plätze und die Buchungen für die Automatik. Ohne das Modul gibt es nur Schalten von Hand.
- **Mitglieder:** Lichtgeld wird als offener Posten (Art „sonstiges“) gebucht und läuft mit dem nächsten Einzug. In der Datenauskunft eines Mitglieds stehen seine Schaltzeiten.
- **Verkauf:** Ohne Mitgliederverwaltung und für Trainer landet das Lichtgeld auf dem Verkaufskonto und wird mit dem Verkauf abgerechnet.
- **Mitglieder-App und Tablet:** Freischaltung, Kopplung und PIN laufen über die Mitglieder-App.
- **Übersicht:** zeigt Lichtanlagen und „Licht an“ und warnt bei Störungen oder fehlendem Standort.
- **Einrichtung:** Der Einrichtungs-Assistent führt durch „Lichtanlagen anlegen“ und „Dunkelheit und Nachtruhe“.
- **Datenschutz:** Unter Einstellungen › Datenschutz stellt ihr ein, wie lange Namen im Verlauf bleiben (3 bis 60 Monate, Standard 24). Danach entfernt Clubwerk die Namen; Dauer und Betriebsstunden bleiben.
- **Andere Module mit Home Assistant:** Ein Schalter kann nur in einem Modul verwendet werden.
