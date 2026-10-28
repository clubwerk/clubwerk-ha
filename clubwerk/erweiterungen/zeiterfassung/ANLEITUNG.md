# Zeiterfassung
<!-- kurz: Personal stempelt am Tablet mit PIN – ihr bekommt den Monatsnachweis mit Stunden und Beträgen. -->

## Wofür ist das Modul? {#wofuer}

Angestellte und Helfer, die nach Stunden bezahlt werden (z. B. Reinigung, Platzwart, Hausmeister), stempeln am Tablet mit ihrer eigenen PIN ein und aus. Clubwerk speichert die echten Zeiten und rechnet daraus pro Monat die Stunden und, wenn ein Stundensatz hinterlegt ist, den Betrag. Den Monatsnachweis als PDF (mit Unterschriftsseite je Person) und als Excel-Datei bekommt eure Kassiererin am 1. des Folgemonats automatisch per E-Mail.

Das Modul läuft allein. Es braucht weder die Mitgliederverwaltung noch die Helferdienste: Das Personal wird hier selbst angelegt und muss kein Vereinsmitglied sein. Die ehrenamtlichen Arbeitsstunden der Mitglieder gehören zu „Dienste & Termine“, nicht hierher.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Zeiterfassung“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Recht vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer Stunden und Stundensätze sehen darf, das Recht „Zeiterfassung“.
3. **Personal anlegen:** Reiter „Personal“ › „+ Person“ (Name, Tätigkeit, PIN, Stundensatz).
4. **Postfach einrichten:** Einstellungen › Postfach, damit der Monatsnachweis verschickt werden kann.
5. **Empfänger eintragen:** Reiter „Einstellungen“ › Karte „Monatsnachweis per E-Mail“ (die Adresse der Kassiererin).

Sobald eine aktive Person angelegt ist, erscheint am Tablet der Reiter „Stempeln“. Der Einrichtungs-Assistent (Verein › Einrichtung) führt durch dieselben zwei Schritte „Personal“ und „Monatsnachweis“.

## Verwaltung {#verwaltung}

Die Seite „Zeiterfassung“ hat oben drei Reiter: **Stunden**, **Personal** und **Einstellungen**.

### Reiter „Stunden“ {#zeit}

![Der Reiter „Stunden“: Monat und Person wählen, darunter vier Kennzahlen und die Übersicht aller Personen.](bild: seite=zeit)

Hier seht ihr, wer wann gearbeitet hat. Oben stehen zwei Auswahlfelder, darunter vier Kacheln, darunter die Liste.

- **Monat:** Standard ist der laufende Monat. Zur Auswahl stehen alle Monate, in denen es Einsätze gibt.
- **Person:** „Alle“ zeigt die Übersicht, eine Person zeigt ihre einzelnen Einsätze.

#### Die vier Kennzahlen

| Kachel | Bedeutung |
|---|---|
| Einsätze | Anzahl der abgeschlossenen Einsätze (Kommen und Gehen) |
| Genau | Summe der echten Zeiten |
| Abgerechnet (gerundet) | Die Monatssumme auf die Viertelstunde gerundet |
| Betrag | Abgerechnete Stunden mal Stundensatz. Ohne Stundensatz steht dort „–“. |

> Gerundet wird nur die **Monatssumme** je Person, nicht jeder einzelne Einsatz: Ein Rest bis 3 Minuten wird abgerundet, ab 4 Minuten wird auf die nächste Viertelstunde aufgerundet. Beispiel: 41:08 Std. werden zu 41:15 Std., 41:03 Std. bleiben 41:00 Std.

#### Übersicht „Alle Personen“

Eine Zeile je Person mit **Name**, **Tätigkeit**, **Einsätze**, **genau**, **abgerechnet**, **Satz** und **Betrag**, unten die **Summe**. Wer gerade eingestempelt ist, trägt die Markierung „gerade da“. Wer vergessen hat auszustempeln, trägt „nicht ausgestempelt“ in Rot. Personen, die nicht mehr aktiv sind, stehen weiter da, solange sie in diesem Monat Einsätze haben, und tragen „inaktiv“. „Einsätze“ am Zeilenende öffnet die Einzelansicht der Person.

#### Einzelansicht einer Person

![Die Einsätze einer Person im Monat: Datum, Kommen, Gehen, Dauer und Hinweise, unten die Summe.](bild: seite=zeit; klick=[data-zs])

Die Liste hat die Spalten **Datum**, **Kommen**, **Gehen**, **Dauer** und **Hinweis**. Geht ein Einsatz über Mitternacht, steht hinter „Gehen“ ein „(+1)“. Unter der Liste steht die Summe und daneben, wie viele Stunden abgerechnet werden. Offene Einsätze (noch nicht ausgestempelt) zählen in der Summe nicht mit.

Die Hinweise sind farbige Markierungen:

- **noch da:** Die Person ist gerade eingestempelt.
- **nicht ausgestempelt:** Der Einsatz ist länger als 12 Stunden offen. Das ist fast immer vergessen. Tragt das Ende per „Bearbeiten“ nach.
- **nachgetragen:** Ihr habt den Einsatz selbst eingetragen.
- **korrigiert von … · vorher …:** Ihr habt die gestempelte Zeit geändert. Die ursprüngliche Zeit bleibt sichtbar.
- Daneben steht eure Begründung in Grau.

#### „Bearbeiten“

![Das Fenster „Einsatz bearbeiten“: Kommen, Gehen, Begründung und Löschen.](bild: seite=zeit; klick=[data-zs]; klick2=[data-ze]; ziel=dialog)

In der Zeile öffnet „Bearbeiten“ das Fenster. Oben steht, was ursprünglich gestempelt wurde. Ihr ändert **Kommen** und **Gehen** und tragt eine **Begründung** ein, die auch im Nachweis steht (mindestens drei Buchstaben, z. B. „vergessen auszustempeln“). „Speichern“ übernimmt. „Löschen“ links unten entfernt den Einsatz nach einer Rückfrage; ein Einsatz, der noch läuft, lässt sich erst nach dem Ausstempeln löschen.

Clubwerk lehnt Unmögliches ab: ein Ende vor dem Beginn, Zeiten in der Zukunft, Einsätze über 24 Stunden und Einsätze, die sich mit einem anderen Einsatz derselben Person überschneiden. Jede Änderung steht im Protokoll.

#### „+ Einsatz nachtragen“

![Das Fenster „Einsatz nachtragen“: Person, Kommen, Gehen und Begründung.](bild: seite=zeit; klick=#zAdd; ziel=dialog)

Für Zeiten, die nicht gestempelt wurden (PIN vergessen, Tablet war aus). Person wählen (nur aktive Personen stehen zur Auswahl), **Kommen** und **Gehen** angeben, **Begründung** schreiben, „Speichern“. Der Einsatz erscheint mit der Markierung „nachgetragen“.

#### „Monatsnachweis (PDF)“ und „Excel“

![Rechts oben in der Reiterzeile: „+ Einsatz nachtragen“, „Monatsnachweis (PDF)“ und „Excel“.](bild: seite=zeit; ziel=.tabrow)

Beide Knöpfe stehen rechts in der Reiterzeile.

- **Monatsnachweis (PDF)** gilt für den gewählten Monat: bei „Alle“ eine Übersicht plus je Person eine Seite mit allen Einsätzen und einer Zeile zum Unterschreiben, bei einer gewählten Person nur deren Seite. Auf dem Nachweis stehen auch die Hinweise „nachgetragen“ und „korrigiert“.
- **Excel** liefert alle Personen des Monats als Tabelle: Name, Tätigkeit, Einsätze, Minuten genau, Stunden genau, abgerechnet, Satz und Betrag, dazu ein Blatt mit den einzelnen Einsätzen.

#### Hinweis bei fehlgeschlagenem Versand

Ist der letzte automatische Versand des Monatsnachweises schiefgegangen, steht oben ein roter Balken mit der Ursache und dem Link „Einstellungen →“.

### Reiter „Personal“ {#zeit-personal}

![Der Reiter „Personal“: Name, Tätigkeit, PIN, Stundensatz und Status.](bild: seite=zeit-personal)

Hier legt ihr fest, wer am Tablet stempeln darf. Der Stundensatz ist nur hier und in der Stundenübersicht sichtbar, nie am Tablet. Die Liste hat die Spalten **Name** (Nachname, Vorname), **Tätigkeit**, **PIN** (immer „gesetzt“, die PIN selbst wird nie angezeigt), **Stundensatz** und **Status** (aktiv oder inaktiv). Inaktive Zeilen sind grau.

#### „+ Person“ und „Bearbeiten“

![Das Fenster „Person anlegen“: Name, Tätigkeit, PIN und Stundensatz.](bild: seite=zeit-personal; klick=#zpNew; ziel=dialog)

„+ Person“ legt eine neue Person an, „Bearbeiten“ in der Zeile ändert eine bestehende. Es ist dasselbe Fenster:

- **Name:** Vor- und Nachname.
- **Tätigkeit:** frei, z. B. „Reinigung“ oder „Hausmeister“. Steht am Tablet unter dem Namen.
- **PIN:** 4 bis 6 Ziffern. Beim Bearbeiten bleibt das Feld leer, wenn die PIN gleich bleiben soll. Wer seine PIN vergessen hat, bekommt hier eine neue.
- **Stundensatz in €:** optional, z. B. „14,00“. Leer lassen, wenn kein Betrag berechnet werden soll.
- **aktiv** (nur beim Bearbeiten): Entfernt ihr das Häkchen, erscheint die Person nicht mehr am Tablet. Ihre alten Einsätze bleiben erhalten. So „löscht“ man Personal, das nicht mehr arbeitet.

![Das Fenster einer bestehenden Person mit dem Häkchen „aktiv“.](bild: seite=zeit-personal; klick=[data-zp]; ziel=dialog)

> Ändert ihr den Stundensatz, gilt der neue Satz **ab dem laufenden Monat**. Abgeschlossene Monate behalten ihren alten Satz. Im Fenster stehen unter „Bisherige Sätze“ alle Änderungen mit Monat. Für Monate vor dem ersten eingetragenen Satz gilt der erste Satz, damit nachgetragene Einsätze nicht ohne Betrag bleiben.

### Reiter „Einstellungen“ {#zeit-einstellungen}

Der Reiter besteht aus zwei Karten.

#### Monatsnachweis per E-Mail

![Karte „Monatsnachweis per E-Mail“: Empfänger, Speichern, Testmail und Vormonat jetzt senden.](bild: seite=zeit-einstellungen; ziel=[data-set="mail"])

Am **1. jedes Monats ab 6 Uhr** schickt Clubwerk den Nachweis des Vormonats an den eingetragenen Empfänger. War Home Assistant an diesem Tag aus, wird er beim nächsten Start nachgeholt; bei einem Fehler versucht Clubwerk es stündlich neu. Im Anhang sind das PDF (Übersicht plus je Person eine Seite zum Unterschreiben) und die Excel-Datei. Im Text stehen alle Personen mit abgerechneten und genauen Stunden und dem Betrag. Fehlt bei jemandem das Ende eines Einsatzes, weist die Mail darauf hin.

- **Empfänger:** die E-Mail-Adresse der Kassiererin. Mehrere Adressen trennt ihr mit Komma.
- **Speichern:** übernimmt den Empfänger.
- **Testmail senden:** schickt eine Probe-Mail an den Empfänger, ohne einen Nachweis zu verschicken.
- **[Vormonat] jetzt senden:** schickt den Nachweis des Vormonats sofort, nach einer Rückfrage. Nützlich, wenn ihr einen Fehler korrigiert habt und die Kassiererin den neuen Stand braucht.

Über der Karte steht ein Balken mit dem Stand: grün mit Datum und Empfänger, wenn der letzte Nachweis verschickt wurde, rot bei einem Fehler, gelb, wenn noch kein Postfach eingerichtet ist (dann sind „Testmail senden“ und „jetzt senden“ ausgegraut). Der Versand läuft über das gemeinsame Vereinspostfach unter Einstellungen › Postfach.

#### Einstellungen übertragen

![Karte „Einstellungen übertragen“: Export und Import.](bild: seite=zeit-einstellungen; ziel=[data-set="transfer"])

Exportiert den Empfänger und die aktiven Personen mit Tätigkeit und aktuellem Stundensatz in eine Datei, die ihr in einer anderen Clubwerk-Installation importieren könnt. Zeiten und PINs sind nie dabei. Neue Personen bekommen beim Import eine zufällige PIN; vergebt danach unter „Personal“ die richtige.

## Tablet und App {#tablet-app}

![Der Reiter „Stempeln“ am Tablet: eine Kachel je Person mit Tätigkeit und Stand.](bild: tablet=Stempeln; hoehe=430)

![Das PIN-Fenster nach dem Antippen eines Namens.](bild: tablet=Stempeln; klick=button[data-id="1"]; hoehe=760)

Am Tablet zeigt der Reiter **Stempeln** (Adresse `/zeiterfassung/`) eine Kachel je aktiver Person, nach Nachname sortiert. Rechts steht, wie es um die Person steht: **da**, **nicht da** oder **vergessen**. Darunter steht „seit 08:00 Uhr“ oder „zuletzt gestern 16:30“.

So stempelt man:

1. Eigenen Namen antippen.
2. PIN eingeben und mit „OK“ bestätigen. Die Kreise zeigen, wie viele Ziffern schon getippt sind (die PIN hat 4 bis 6).
3. Clubwerk erkennt selbst, ob die Person kommt oder geht, und zeigt „Hallo“ bzw. „Tschüss“ mit der Uhrzeit. Beim Gehen stehen dort auch die Stunden von heute, beim Kommen und Gehen die Stunden des Monats bisher.

Gut zu wissen:

- **Versehentlich eingestempelt?** Wer innerhalb einer Minute nochmal stempelt, nimmt das Einstempeln zurück („Zurückgenommen“). Es bleibt kein Eintrag.
- **Ausstempeln vergessen?** Nach 12 Stunden gilt der Einsatz als vergessen. Die Kachel wird rot („vergessen“). Beim nächsten Stempeln startet ein neuer Einsatz, und das Tablet sagt, dass der Vorstand das Ende des letzten nachtragen soll. Ihr tragt es dann in der Verwaltung nach (siehe „Bearbeiten“).
- **Falsche PIN:** Nach mehreren Fehlversuchen wird die Person kurz gesperrt (höchstens eine Stunde), bei vielen Fehlversuchen von einem Gerät auch das Gerät. Beides steht im Protokoll, bei Wiederholung bekommt die Verwaltung einen Sicherheitshinweis.
- Nach 12 Sekunden schließt sich die Erfolgsmeldung von selbst, ein offenes PIN-Fenster nach einer Minute.

Eine Mitglieder-App-Seite gibt es für die Zeiterfassung nicht: Das Personal stempelt nur am Tablet.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Zeiterfassung | Stunden sehen, Einsätze nachtragen, ändern und löschen, Personal und PINs verwalten, Stundensätze sehen, Monatsnachweis als PDF und Excel laden, Empfänger und Versand einstellen |

Stempeln am Tablet braucht kein Recht, nur den Namen und die eigene PIN. Das Tablet selbst ist durch das Tablet-Passwort geschützt.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Übersicht:** Die Startseite der Verwaltung zeigt, wie viele Personen angelegt sind und wer gerade da ist, und meldet, wenn jemand seit über 12 Stunden eingestempelt ist, wenn der Versand fehlschlug oder wenn kein Postfach eingerichtet ist.
- **Postfach (Einstellungen):** Der Monatsnachweis wird über das gemeinsame Vereinspostfach verschickt.
- **Datensicherung:** Die Sicherung enthält die Arbeitszeiten des laufenden Monats als Excel-Datei.
- **Datenschutz:** Das Modul steht im Verzeichnis von Verarbeitungstätigkeiten (Einstellungen › Datenschutz): Arbeitszeitnachweise mindestens 2 Jahre, Lohnunterlagen 6 Jahre. Sie werden nicht automatisch gelöscht.
- **Einrichtungs-Assistent:** Enthält die Schritte „Personal“ und „Monatsnachweis“.
- **Dienste & Termine:** Die Ehrenamts-Stunden der Mitglieder laufen dort, getrennt von dieser Zeiterfassung.
