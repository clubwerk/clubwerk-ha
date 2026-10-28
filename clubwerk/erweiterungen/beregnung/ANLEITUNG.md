# Beregnung
<!-- kurz: Plätze per Handy, Tablet oder Verwaltung beregnen – Zonen laufen nacheinander, alles steht im Verlauf. -->

## Wofür ist das Modul? {#wofuer}

Mit dem Modul startet ihr die manuelle Beregnung eurer Plätze, ohne zum Ventilschrank zu gehen: in der Mitglieder-App, am Vereinstablet, in der Verwaltung oder in einer eigenen Webapp fürs Handy. Ein Platz kann mehrere Zonen haben. Sie laufen nacheinander, damit der Wasserdruck reicht. Ein Not-Stopp schaltet alles sofort aus, und im Verlauf steht, wer wann was beregnet hat. Die Zeitpläne der Steuerung selbst bleiben beim Hersteller.

Das Modul läuft allein. Ihr braucht nur eine Steuerung, die Clubwerk schalten kann: entweder über Home Assistant (viele Hersteller) oder bei Hunter Hydrawise direkt mit einem API-Key. Ohne die Mitgliederverwaltung bedient ihr die Beregnung mit der Vereins-PIN oder mit einem Benutzerkonto.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Beregnung“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren; die Demo schaltet nie echte Ventile.
2. **Steuerung anbinden:** In Home Assistant die Integration eures Herstellers hinzufügen (jede Zone erscheint dort als Ventil oder Schalter). In Clubwerk dann unter Beregnung › Einstellungen › „Anbindung“ den Hersteller wählen.
3. **Plätze und Zonen anlegen:** Reiter „Plätze & Zonen“, „+ Platz“, Zonen zuordnen und Laufzeiten eintragen.
4. **Wer darf bedienen?** Vereins-PIN festlegen oder die Bedienung auf freigeschaltete Mitglieder oder Benutzer beschränken (Reiter „Einstellungen“).
5. **Testen:** Reiter „Bedienen“, einen Platz starten und gleich wieder stoppen. Läuft das Ventil, ist alles bereit.

> Der Einrichtungs-Assistent (Menüpunkt „Einrichtung“) führt durch die Schritte „Anbindung“ und „Plätze und Zonen“.

## Verwaltung {#verwaltung}

Die Seite „Beregnung“ hat oben vier Reiter: **Bedienen**, **Plätze & Zonen**, **Verlauf** und **Einstellungen**. Wer nur das Recht „Beregnung bedienen“ hat, sieht allein den Reiter „Bedienen“.

### Seite „Beregnung“ {#beregnung}

![Die Seite „Beregnung“ mit dem Reiter „Bedienen“.](bild: seite=beregnung; tab=bedienen)

Unter der Überschrift steht ein Satz zum Zweck der Seite, darunter die Reiter.

### Reiter „Bedienen“ {#beregnung-bedienen}

Hier steuert ihr die Beregnung, in derselben Darstellung wie in der Mitglieder-App und am Tablet.

#### Karte „Plätze“

Jeder Platz ist eine Kachel mit Name und Untertitel (z. B. „Sand“). Rechts steht der Knopf **▶ Starten**. Gestartet wird nur über diesen Knopf, nicht über die ganze Kachel.

- **Läuft ein Platz,** zeigt die Kachel den Namen der Zone („Nord läuft“) und den Countdown. Mit **■ Stoppen** schaltet ihr nur diesen Platz aus.
- **Wartet ein Platz,** steht „Start in 4:30“. Es läuft immer nur eine Zone gleichzeitig; weitere Plätze stellen sich hinten an und rücken nach, sobald ein Platz fertig ist oder gestoppt wird.
- **Gesperrte Plätze** zeigen „ab 14:30 Uhr“. Das ist die Sperre nach einer Beregnung (siehe Einstellungen › „Wer darf bedienen?“).
- Läuft die Automatik der Steuerung, steht dort „Automatik läuft“. Auch diesen Lauf könnt ihr stoppen.
- Unter den Kacheln steht, wann die nächste automatische Beregnung ist, falls ihr dafür unter Einstellungen › „Webapp“ einen Sensor gewählt habt.

![Karte „Plätze“: Kacheln mit „Starten“-Knopf und der Knopf „Alle Zonen ausschalten“.](bild: seite=beregnung; tab=bedienen; ziel=.card)

Besteht keine Verbindung zur Anlage, erscheint oben ein roter Hinweis („Keine Verbindung zur Bewässerungsanlage“), die Kacheln sind ausgegraut und nichts lässt sich starten. So ist es auch in den Bildern dieser Anleitung, denn die Demo ist nicht mit einer echten Anlage verbunden. Die Anzeige aktualisiert sich von selbst, alle 5 Sekunden, solange etwas läuft.

#### Alle Zonen ausschalten

Der rote Knopf **■ Alle Zonen ausschalten** unter den Kacheln ist der Not-Stopp. Nach einer Rückfrage beendet er laufende und geplante Beregnungen sofort. Er erscheint erst, wenn es Plätze gibt, und ist ohne Verbindung zur Anlage ausgegraut. Gelingt das Abschalten nicht überall, meldet Clubwerk das ausdrücklich, damit niemand glaubt, das Wasser sei aus.

### Reiter „Plätze & Zonen“ {#beregnung-plaetze}

![Der Reiter „Plätze & Zonen“ mit dem Knopf „+ Platz“ oben rechts.](bild: seite=beregnung; tab=plaetze; rahmen=#bAddPl)

Oben zeigt ein grünes Band, wie viele schaltbare Zonen Clubwerk gefunden hat („Verbunden – 5 schaltbare Zonen gefunden“). Ein rotes Band meldet, dass die Steuerung nicht antwortet (wie im Bild, denn die Demo hat keine echte Anlage); dann zuerst Einstellungen › „Anbindung“ prüfen.

#### Karte „Plätze & Zonen“

Jeder Platz ist ein eigener Kasten. **+ Platz** (oben rechts) legt einen neuen an. Pro Platz gibt es:

- **Name** (bis 30 Zeichen), z. B. „Platz 1“. So heißt die Kachel überall.
- **Untertitel:** Text unter dem Namen. Bleibt er leer, schreibt Clubwerk selbst etwas wie „Erst Vorne, dann Hinten · je 2 min“.
- **Pfeile ↑ ↓:** Reihenfolge der Plätze. Sie gilt in allen Oberflächen.
- **Zonen:** Pro Zone wählt ihr das **Gerät** (das Ventil oder den Schalter aus Home Assistant), eine **Bezeichnung** (bis 20 Zeichen, z. B. „Vorne“) und die **Minuten** (Komma erlaubt, 0,5 bis 60). **Entfernen** nimmt die Zone heraus, **+ Zone** fügt eine hinzu. Mehrere Zonen laufen nacheinander in der angezeigten Reihenfolge.
- **Platz löschen:** nach einer Rückfrage. Gelöscht ist er erst nach „Speichern“.

Bei der direkten Hydrawise-Anbindung tragt ihr statt des Geräts die **Zonennummer** ein, also den Anschluss am Controller (1, 2, 3 …).

„Speichern“ unten übernimmt alles. Eine Zone läuft mindestens 10 Sekunden und höchstens 60 Minuten.

> Stellt die Standard-Laufzeit der Zone in der Hersteller-App mindestens so lang ein wie hier. Clubwerk schaltet nach der eingestellten Zeit selbst wieder aus, die Steuerung ist nur die Sicherung dahinter.

### Reiter „Verlauf“ {#beregnung-verlauf}

![Der Reiter „Verlauf“ mit der Monatsauswahl und dem Knopf „Excel“.](bild: seite=beregnung; tab=verlauf; rahmen=a.btn)

Der Verlauf zeigt je Monat, was manuell beregnet wurde. Den **Monat** wählt ihr links über der Tabelle, **Excel** (oben rechts) lädt den Monat als Tabelle herunter. Die Spalten:

| Spalte | Inhalt |
|---|---|
| Zeitpunkt | Datum und Uhrzeit |
| Aktion | Start, Stopp, Fehler oder Freischaltung |
| Platz | welcher Platz betroffen war |
| Minuten | geplante Laufzeit bei einem Start |
| Wer | Name des Mitglieds oder Benutzers; bei der Vereins-PIN „Vereins-PIN“, bei „Stoppen ohne PIN“ „ohne PIN“, bei Automatik oder Abschalten des Moduls „System“ |
| Hinweis | z. B. „2 Zonen nacheinander“ oder die Fehlermeldung der Steuerung |

Fehler erscheinen auch auf der Übersicht („neuer Fehler heute“). Sobald ihr den Verlauf angesehen habt, verschwindet dieser Hinweis, bis ein neuer Fehler kommt. Der Verlauf wird nach der Frist unter Einstellungen › Datenschutz gelöscht (Vorgabe 12 Monate).

### Reiter „Einstellungen“ {#beregnung-einstellungen}

Der Reiter besteht aus fünf Karten, jede mit eigenem „Speichern“.

#### Anbindung

Hier wählt ihr den **Hersteller der Steuerung**: Hunter Hydrawise (über Home Assistant oder direkt mit API-Key), Rain Bird, Rachio, OpenSprinkler, Orbit B-hyve, Gardena, Shelly-Relais an Magnetventilen, ESPHome oder „Anderer Hersteller“. Das Band oben zeigt, ob die Verbindung steht.

- **Über Home Assistant:** Unter dem Feld steht, welche Integration ihr in Home Assistant hinzufügen müsst. Danach erscheinen die Zonen als Auswahl in „Plätze & Zonen“. Ist die Liste leer, hat das Add-on keinen Zugriff auf Home Assistant; dann das Add-on neu bauen und starten.
- **Direkt mit Hydrawise:** Den **API-Key** tragt ihr ein (aus hydrawise.com › Konto › Einstellungen). Er bleibt auf dem Server und ist im Browser nie sichtbar. „Key löschen“ entfernt ihn nach einer Rückfrage; danach schaltet Clubwerk nichts mehr.
- **Hersteller wechseln:** Ändert sich dabei die Art der Anbindung (Home Assistant oder direkt), fragt Clubwerk nach, denn die Plätze müssen danach neu angelegt werden.

![Karte „Anbindung“: Hersteller wählen und Verbindung prüfen.](bild: seite=beregnung; tab=einstellungen; ziel=[data-card="anbindung"])

#### Wer darf bedienen?

Hier bestimmt ihr, wie die Beregnung bedient wird.

- **Offen mit Vereins-PIN (eigene Webapp):** Jeder im Vereins-WLAN öffnet die Webapp und bedient mit der gemeinsamen Vereins-PIN.
- **Nur freigeschaltete Mitglieder (Mitglieder-App):** Nur Mitglieder, die unter „Mitglieder-App“ für die Beregnung freigeschaltet sind, mit ihrem eigenen Handy. Im Verlauf steht der Name.
- **Gesperrt – nur Benutzer mit Passwort:** Anmelden können sich Benutzer mit dem Recht „Beregnung bedienen“ (unter Benutzer & Rechte, auch Konten, die sonst nichts dürfen).
- **Sperre nach einer Beregnung (Minuten, 0 = aus):** Nach einem Lauf kann derselbe Platz so lange nicht gestartet werden. Die Kachel zeigt „ab 14:30 Uhr“. Das verhindert, dass der Platz mehrfach hintereinander gewässert wird.
- **Roter Stopp-Knopf funktioniert ohne PIN:** Stoppen geht dann ohne PIN-Eingabe, damit im Notfall niemand suchen muss.
- **Vereins-PIN (4 bis 8 Ziffern):** Hier steht „festgelegt“ oder „noch nicht festgelegt“. Zum Ändern die neue PIN eintragen und speichern; die alte PIN wird nie angezeigt. Sie gilt nur bei „Offen mit Vereins-PIN“.

Mitglieder mit Freischaltung in der Mitglieder-App bedienen die Beregnung dort in jedem Modus. Nach 20 falschen PIN-Eingaben ist die PIN-Eingabe für alle kurz gesperrt, und ihr bekommt eine Sicherheitsmeldung.

![Karte „Wer darf bedienen?“: Bedienung, Sperre, Stopp ohne PIN und Vereins-PIN.](bild: seite=beregnung; tab=einstellungen; ziel=[data-card="bedienen"])

#### Webapp

Die Webapp ist eine eigene Seite fürs Handy. Ihre Adresse steht in der Karte (`http://<Adresse von Home Assistant>:5000`). Im Browser öffnen und „Zum Home-Bildschirm“ wählen, dann liegt sie wie eine App auf dem Handy.

- **Name auf dem Homescreen** (bis 20 Zeichen) und **Untertitel** (bis 40 Zeichen) bestimmen, wie die Webapp heißt und was in ihrer Kopfzeile steht.
- **Anzeige „nächste automatische Beregnung“ (optional):** Nur mit Home Assistant. Dort wählt ihr einen Sensor, dessen Wert unter den Kacheln erscheint.

![Karte „Webapp“: Name, Untertitel und Sensor für die nächste Beregnung.](bild: seite=beregnung; tab=einstellungen; ziel=[data-card="webapp"])

#### Benachrichtigungen

Nur mit Home Assistant als Anbindung. Bei **„Bei Störung benachrichtigen“** tragt ihr den Namen des Home-Assistant-Dienstes ein (`notify.…`, z. B. `mobile_app_handy_platzwart`). Er schickt eine Nachricht ans Handy, wenn eine Zone nicht startet oder sich nicht ausschalten lässt. Bei der direkten Hydrawise-Anbindung gibt es diese Karte nur als Hinweis.

![Karte „Benachrichtigungen“.](bild: seite=beregnung; tab=einstellungen; ziel=[data-card="benachrichtigungen"])

#### Einstellungen übertragen

Anbindung, Plätze mit Zonen, Bedienung und Webapp als Datei exportieren und in einer anderen Clubwerk-Installation importieren, z. B. nach einer Neuinstallation. Vereins-PIN und API-Key sind nicht enthalten.

![Karte „Einstellungen übertragen“.](bild: seite=beregnung; tab=einstellungen; ziel=#bFunc)

## Tablet und App {#tablet-app}

![Der Bereich „Beregnung“ in der Mitglieder-App.](bild: app=beregnung)

![Der Reiter „Beregnung“ am Tablet.](bild: tablet=Beregnung; hoehe=430)

Überall sieht die Beregnung gleich aus: dieselben Kacheln mit „▶ Starten“ und „■ Stoppen“ und oben eine Statuszeile „Verbunden mit der Bewässerungsanlage“. Der Unterschied liegt nur in der Anmeldung:

- **Mitglieder-App:** Der Bereich „Beregnung“ erscheint nur für Mitglieder, die ihr unter Mitglieder-App freigeschaltet habt (auch Konten „Kein Mitglied“, z. B. Trainer). Das Handy ist gekoppelt, deshalb geht Starten und Stoppen ohne PIN. Im Vereins-WLAN ist der Bereich frei. Von unterwegs ist er gesperrt („Nur im Vereins-WLAN“), außer ihr gebt einem Mitglied die Ausnahme „auch unterwegs“; dann fragt die App beim Starten nach der PIN. Stoppen geht immer ohne PIN. Aus Sicherheitsgründen sind höchstens 10 Starts je Minute möglich.
- **Tablet:** Der Reiter „Beregnung“ erscheint, wenn er unter Einstellungen › Tablet eingeschaltet ist. Beim Starten fragt das Tablet jedes Mal nach der Vereins-PIN, es merkt sie sich nie. Ist die Bedienung auf „Nur freigeschaltete Mitglieder“ gestellt, zeigt das Tablet den Reiter nicht.
- **Webapp (eigener Port):** Je nach Bedienung gibt sie nach der Vereins-PIN frei, zeigt „Mitglieder-App“ (gesperrt) oder verlangt Benutzername und Passwort. Die PIN bleibt nur im Speicher der Seite. Die Webapp ist nur aus dem Vereinsnetz erreichbar, nie über den Tunnel.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Beregnung | Plätze und Zonen einrichten, Einstellungen ändern, Verlauf ansehen, Plätze starten und stoppen |
| Beregnung bedienen | Plätze starten und stoppen (Reiter „Bedienen“ in der Verwaltung und die gesperrte Webapp), sonst nichts |

Wer die Beregnung in der Mitglieder-App bedienen darf, legt ihr nicht über ein Recht fest, sondern unter Mitglieder-App › Bereiche.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Home Assistant:** Die Ventile kommen von dort. Ohne Home Assistant geht nur die direkte Hydrawise-Anbindung.
- **Mitglieder-App und Mitgliederverwaltung:** Der Bereich „Beregnung“ lässt sich je Mitglied freischalten; der Name steht im Verlauf. In der Datenauskunft eines Mitglieds stehen seine Beregnungen.
- **Datenschutz:** Die Frist für den Verlauf erscheint auch unter Einstellungen › Datenschutz und im Verzeichnis der Verarbeitungstätigkeiten.
- **Übersicht:** Zeigt Plätze, heute gestartete Beregnungen, was gerade läuft, fehlende Verbindung, fehlende Vereins-PIN und neue Fehler.
- **Datensicherung:** Der Verlauf des Monats liegt als Excel in der Sicherung.
- **Sicher beim Ausschalten:** Schaltet ihr das Modul aus oder startet Clubwerk neu (Update), werden laufende Zonen sofort abgeschaltet, statt offen zu bleiben.
