# Zugang
<!-- kurz: Türen, Tore und Schlösser per Handy öffnen – mit Zeitprofil, Sperrtagen und Verlauf. -->

## Wofür ist das Modul? {#wofuer}

Mitglieder öffnen Türen, Tore und Schlösser des Vereinsheims mit dem Handy: in der Mitglieder-App, mit ihrer persönlichen PIN. Ihr legt fest, wer überhaupt öffnen darf, an welchen Wochentagen und zu welchen Uhrzeiten, und an welchen Tagen niemand hinein soll (z. B. bei der Grundreinigung). Jede Öffnung steht im Verlauf, auch abgelehnte Versuche. Optional lässt sich am Vereinstablet öffnen, und in der Verwaltung könnt ihr Türen aus der Ferne bedienen.

Clubwerk schaltet die Geräte über Home Assistant. Welcher Hersteller dahinter steckt (z. B. Nuki, Yale, tedee, Shelly), ist egal. Das Modul läuft allein; ohne die Mitgliederverwaltung gibt es Namen nur als Vor- und Nachname.

## Einrichten {#einrichten}

1. **Geräte in Home Assistant einrichten:** Die Schlösser, Türöffner oder Torantriebe müssen in Home Assistant bereits laufen (Einstellungen › Geräte & Dienste). Welche Integration zu eurem Hersteller passt, steht im Reiter „Einstellungen“.
2. **Einstellungen › Module:** Schalter bei „Zugang“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
3. **Rechte vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer alles einrichten soll, das Recht „Zugang“. Wer nur Türen aus der Ferne öffnen darf (z. B. der Hausmeister), bekommt „Zugang bedienen“.
4. **Türen anlegen:** Reiter „Türen“ › „+ Tür“. Danach unter „Bedienen“ einmal testweise öffnen.
5. **Zeitprofile prüfen:** Es gibt schon „Mitglied“ (täglich 07:00–23:00) und „Rund um die Uhr“. Eigene Zeiten legt ihr im Reiter „Zeitprofile“ an.
6. **Mitglieder freischalten:** Reiter „Freischaltungen“ › „+ Mitglied freischalten“. Das Mitglied scannt den QR-Code mit dem Handy und legt seine PIN fest. Fertig – die Türen erscheinen in der App.

## Verwaltung {#verwaltung}

Das Menü „Zugang“ hat sieben Seiten, die oben als Reiter erscheinen: **Bedienen**, **Freischaltungen**, **Türen**, **Zeitprofile**, **Sperrtage**, **Verlauf** und **Einstellungen**. Wer nur das Recht „Zugang bedienen“ hat, sieht nur „Bedienen“.

### Seite „Bedienen“ {#zugang}

![Die Seite „Bedienen“: oben die Türen zum Öffnen, darunter die Notfall-Karte.](bild: seite=zugang)

Hier öffnet und schließt ihr Türen aus der Ferne, z. B. wenn jemand vor der Tür steht und sein Handy vergessen hat. Dieselbe Seite zeigt auch, ob mit den Schlössern alles in Ordnung ist.

#### Türen

Jede Tür ist eine Kachel mit Namen, Zustand (z. B. „abgeschlossen“) und Knöpfen. Schlösser haben „Aufschließen“ und „Abschließen“, Türöffner nur „Öffnen“, Tore „Öffnen“ und „Schließen“. Ist ein Schloss nicht erreichbar, ist die Kachel ausgegraut; blockiert es, ist sie als Warnung markiert.

Vor jedem Befehl fragt Clubwerk nach. Danach wird die Tür sofort geschaltet und im Verlauf vermerkt.

![Die Rückfrage vor dem Öffnen aus der Ferne.](bild: seite=zugang; klick=#zRemote .vh-acts button; ziel=#askBox)

> Clubwerk schließt nie von selbst ab. Wer aufgeschlossen hat, schließt auch wieder zu. In der Übersicht erscheint ein Hinweis, solange ein Schloss offen ist.

Gibt es noch keine Türen, führt ein Knopf direkt zum Reiter „Türen“. Fehlt die Verbindung zu Home Assistant, steht oben ein roter Hinweis mit einem Link zur Prüfung in den Einstellungen.

#### Notfall

![Karte „Notfall“: „Sofort alle sperren“ stoppt das Öffnen für alle Mitglieder.](bild: seite=zugang; ziel=.card:has(#zBlockAll))

„Sofort alle sperren“ stoppt das Öffnen in der App und am Tablet für alle Mitglieder, z. B. bei einem verlorenen Handy oder bei Missbrauch. Vorher fragt Clubwerk nach. Die Fernbedienung oben funktioniert weiter. Solange die Sperre gilt, steht auf der Seite ein roter Hinweis, und der Knopf heißt „Sperre für alle aufheben“. Jede Sperre steht im Verlauf (Aktion „Sperre“) und im Protokoll der Verwaltung.

### Reiter „Freischaltungen“ {#zugang-freischaltungen}

![Der Reiter „Freischaltungen“: wer Türen öffnen darf, mit Handy, Zeitprofil und letzter Nutzung.](bild: seite=zugang-freischaltungen)

Hier legt ihr fest, wer Türen in der Mitglieder-App öffnen darf. Das ist der einzige Ort dafür; in der Mitglieder-App und bei den Mitgliedern steht das Zeitprofil nur zur Ansicht, mit einem Link hierher.

#### Liste „Freigeschaltet“

Die Überschrift zeigt in Klammern, wie viele freigeschaltet sind. Spalten:

- **Mitglied:** „Nachname, Vorname“. Gesperrte Mitglieder tragen die rote Markierung „gesperrt“ und stehen abgeblendet.
- **Handy:** „Handy freigeschaltet“ (Handy ist gekoppelt), „QR-Code offen“ (Einladung verschickt, noch nicht gescannt), „QR-Code abgelaufen“ oder „ohne Handy“.
- **Zeitprofil:** Name des Profils, dahinter bei Bedarf „bis <Datum>“ und „auch unterwegs“.
- **zuletzt:** wann das Mitglied zuletzt geöffnet hat (am Handy ausgeblendet).

Mit den Filtern über der Liste (**Alle**, **mit Handy**, **ohne Handy**, **gesperrt**, jeweils mit Anzahl) findet ihr z. B. alle, die noch keinen QR-Code gescannt haben. „gesperrt“ erscheint nur, wenn es gesperrte Mitglieder gibt.

Pro Zeile gibt es **QR-Code** (nur wenn noch kein Handy gekoppelt ist; zeigt einen neuen Einladungscode) und **Bearbeiten**.

#### + Mitglied freischalten

![Fenster „Mitglied freischalten“: Mitglied wählen, es bekommt das Standardprofil.](bild: seite=zugang-freischaltungen; klick=#zMemNew; ziel=dialog)

Der Knopf steht oben rechts in der Reiterzeile. Ihr wählt ein Mitglied (Trainer ohne Mitgliedschaft sind mit „(Trainer)“ gekennzeichnet) und klickt „Freischalten“. Das Mitglied bekommt das Standardprofil. Danach erscheint der QR-Code für die Mitglieder-App. Wer schon ein gekoppeltes Handy hat, braucht keinen neuen Code.

> Den QR-Code nicht fotografieren oder weiterschicken. Wer ihn zuerst scannt, bekommt den Zugang.

#### Bearbeiten

![Fenster zum Bearbeiten einer Freischaltung: Zeitprofil, Gültigkeit, unterwegs, Sperre.](bild: seite=zugang-freischaltungen; klick=[data-me]; ziel=dialog)

Alles zu einem Mitglied steht in einem Fenster:

- **Zeitprofil:** welches Profil gilt (siehe Reiter „Zeitprofile“).
- **Gültig bis:** danach ist die Freischaltung vorbei. Leer heißt unbegrenzt. Praktisch für Gäste oder Aushilfen.
- **Auch von unterwegs öffnen:** erlaubt dem Mitglied das Öffnen außerhalb des Vereinsnetzes. Das wirkt nur, wenn im Reiter „Einstellungen“ „Öffnen nur aus dem Vereinsnetz“ ausgeschaltet ist.
- **Gesperrt:** die Freischaltung bleibt, aber öffnen geht nicht. Sinnvoll, wenn jemand vorübergehend nicht hinein soll.
- **Zugang entziehen …:** nimmt die Türen sofort aus der App. Clubwerk fragt im selben Fenster nach; andere Bereiche des Mitglieds (z. B. Beregnung) bleiben.

![Rückfrage beim Entziehen des Zugangs.](bild: seite=zugang-freischaltungen; klick=[data-me]; klick2=#zmDel; ziel=dialog)

„Speichern“ übernimmt alle Änderungen.

### Reiter „Türen“ {#zugang-tueren}

![Der Reiter „Türen“: alle Türen mit Art, Gerät und Türkontakt.](bild: seite=zugang-tueren)

Die Liste zeigt jede Tür mit **Name**, **Art**, dem **Gerät in Home Assistant** und dem **Türkontakt**. Die Reihenfolge gilt auch in der App; mit den Pfeilen ↑ und ↓ schiebt ihr eine Tür nach oben oder unten, das wird sofort gespeichert. Bis zu 50 Türen sind möglich.

Fehlt die Verbindung zu Home Assistant, steht oben ein roter Hinweis.

#### + Tür / Bearbeiten

![Fenster „Tür anlegen“: Name, Art, Gerät, Türkontakt.](bild: seite=zugang-tueren; klick=#zDAdd; ziel=dialog)

„+ Tür“ steht oben rechts. Im Fenster stellt ihr ein:

- **Name:** so heißt die Tür in der App (bis 30 Zeichen), z. B. „Haustür“.
- **Art:** **Schloss** (aufschließen und abschließen), **Türöffner (Impuls)** (ein Relais, das kurz schaltet) oder **Tor / Antrieb** (öffnen und schließen).
- **Gerät in Home Assistant:** die Auswahl zeigt nur passende Geräte. Der Hersteller aus dem Reiter „Einstellungen“ filtert die Liste. Ein Gerät, das ein anderes Modul schon nutzt (z. B. die Beregnung), lässt sich nicht noch einmal verwenden.
- **Türkontakt (optional):** ein Sensor, der meldet, ob die Tür offen steht. Damit klappt auch die Meldung „Tür zu lange offen“.
- **Impuls (Sekunden):** nur bei Türöffnern. So lange bleibt das Relais an (1 bis 30 Sekunden, Standard 3).

![Eine Tür vom Typ „Türöffner (Impuls)“ hat zusätzlich das Feld „Impuls (Sekunden)“.](bild: seite=zugang-tueren; klick=[data-de="2"]; ziel=dialog)

Beim Bearbeiten steht unten abgesetzt **Tür entfernen …**. Clubwerk fragt im selben Fenster nach; die Tür verschwindet aus der App und aus den Zeitprofilen.

> Wenn ihr die Türen ändert, bekommt der Vorstand zur Sicherheit eine Mitteilung mit „vorher“ und „jetzt“. So fällt auf, wenn jemand unbefugt ein anderes Gerät einträgt.

### Reiter „Zeitprofile“ {#zugang-profile}

![Der Reiter „Zeitprofile“: ein Profil mit Türen, Wochentagen und Zeiten.](bild: seite=zugang-profile; ziel=[data-prof="0"])

Ein Zeitprofil sagt, **welche Türen** ein Mitglied öffnen darf und **wann**. Jedes Profil ist eine eigene Karte mit eigenem „Speichern“. Jedes Mitglied hat genau ein Profil.

#### Eine Profilkarte

- **Name:** bis 30 Zeichen, z. B. „Jugend“ oder „Trainer“.
- **Standard bei neuer Freischaltung:** dieses Profil bekommt jedes neu freigeschaltete Mitglied. Es gibt immer genau ein Standardprofil.
- **Türen:** „Alle (auch künftige)“ oder einzelne Türen. Bei „Alle“ gilt das Profil auch für Türen, die ihr später anlegt. Türen, die nicht im Profil stehen, sehen die Mitglieder in der App gar nicht.
- **Zeiten je Wochentag:** pro Tag eine Zeile, z. B. `07:00–23:00`. Mehrere Zeitfenster trennt ihr mit Komma (`07:00–12:00, 14:00–22:00`). Leer oder „geschlossen“ heißt: an diesem Tag geht nichts. „ganztägig“ gilt rund um die Uhr. Fenster über Mitternacht sind erlaubt (z. B. `18:00–02:00`).
- **Montag auf alle Tage übertragen** und **Montag auf Mo–Fr übertragen:** spart Tipparbeit, wenn jeden Tag dasselbe gelten soll.
- **Profil löschen …:** Clubwerk fragt vorher nach. Mitglieder mit diesem Profil bekommen das Standardprofil. Das letzte Profil lässt sich nicht löschen.

![Das Profil „Rund um die Uhr“: alle Türen, jeden Tag ganztägig.](bild: seite=zugang-profile; ziel=[data-prof="1"])

Versteht Clubwerk eine Zeitangabe nicht, sagt es genau, welche Zeile gemeint ist („bitte z. B. 07:00–23:00“).

#### + Zeitprofil

„+ Zeitprofil“ steht oben rechts. Das neue Profil heißt zunächst „Neues Profil“, gilt für alle Türen und täglich von 07:00 bis 23:00. Anpassen und „Speichern“.

> Ändert ihr ein Profil, gilt das sofort für alle Mitglieder, die es haben.

### Reiter „Sperrtage“ {#zugang-sperrtage}

![Der Reiter „Sperrtage“: Zeiträume, an denen niemand öffnen kann.](bild: seite=zugang-sperrtage)

An Sperrtagen öffnet die App für niemanden, z. B. bei Platzsanierung, Grundreinigung oder Betriebsferien. Die Liste zeigt **Zeitraum** und **Grund**. Die Fernbedienung in der Verwaltung funktioniert weiter. In der Mitglieder-App sehen Mitglieder an diesen Tagen „Heute gesperrt“ mit dem Grund.

#### + Sperrzeitraum / Bearbeiten

![Fenster „Sperrzeitraum“: von, bis und Grund.](bild: seite=zugang-sperrtage; klick=[data-be]; ziel=dialog)

„+ Sperrzeitraum“ steht oben rechts. Ihr tragt **Von** und **Bis** ein (für einen einzelnen Tag beides gleich) und optional einen **Grund**. „Bis“ darf nicht vor „Von“ liegen. Es wird sofort gespeichert. Beim Bearbeiten hebt **Sperrzeitraum aufheben …** (mit Rückfrage) die Sperre wieder auf. Bis zu 50 Zeiträume sind möglich.

### Reiter „Verlauf“ {#zugang-verlauf}

![Der Reiter „Verlauf“: Monatsauswahl und die Einträge (hier der erste Eintrag mit „Abgelehnt“ und seinem Grund).](bild: seite=zugang-verlauf; ziel=#zLog tr:has(.pill.a))

Der Verlauf zeigt, wer wann welche Tür geöffnet, geschlossen oder gesperrt hat, auch abgelehnte Versuche. Oben wählt ihr den **Monat**. Spalten:

- **Zeitpunkt**, **Tür** und **Wer** (Name des Mitglieds oder des Benutzers der Verwaltung).
- **Aktion:** Aufgeschlossen, Abgeschlossen, Geöffnet, **Abgelehnt** (mit Grund in „Hinweis“, z. B. „Jetzt nicht – wieder möglich ab morgen 14:00 Uhr.“), **Fehler** (Tür hat nicht reagiert), **Freischaltung**, **Alarm** (Tür zu lange offen) und **Sperre** (Notfall-Sperre oder Abschaltung am Tablet).
- **Hinweis:** z. B. „am Tablet“ oder „Fernbedienung aus der Verwaltung“.

„Excel“ (oben rechts) lädt den gewählten Monat als Tabelle herunter. Die nächtliche Datensicherung legt den laufenden Monat ebenfalls als Excel-Datei bei.

> Der Verlauf enthält Namen und Uhrzeiten und wird nach der eingestellten Frist automatisch gelöscht (Standard 30 Tage, siehe „Zusammenspiel“).

### Reiter „Einstellungen“ {#zugang-einstellungen}

Der Reiter besteht aus vier Karten.

#### Anbindung

![Karte „Anbindung“: Hersteller wählen.](bild: seite=zugang-einstellungen; ziel=.card:has(#zVendor))

Hier wählt ihr den **Hersteller** (Nuki, Matter, Yale, tedee, SwitchBot, HomeKit, Shelly, ESPHome oder „Gemischt / anderer Hersteller“). Das filtert nur die Geräteliste im Reiter „Türen“, damit sie kürzer wird. Darunter steht, welche Integration ihr in Home Assistant hinzufügen müsst. Schlösser erscheinen dort als `lock.*`, Türöffner als `switch.*` oder `button.*`, Tore als `cover.*`. „Gemischt“ zeigt alle Geräte.

#### Sicherheit

![Karte „Sicherheit“: Öffnen nur aus dem Vereinsnetz.](bild: seite=zugang-einstellungen; ziel=.card:has(#zWlan))

„Öffnen nur aus dem Vereinsnetz“ ist standardmäßig an: Anfragen aus dem Internet werden abgelehnt, nur wer im Vereins-WLAN ist, kann öffnen. Welche Adressen als Vereinsnetz gelten, stellt ihr zentral unter Einstellungen › Erreichbarkeit ein (mit dem Recht „Einstellungen“; der Link steht auf der Karte). Schaltet ihr die Option aus und erlaubt einem Mitglied „Auch von unterwegs öffnen“, geht das Öffnen auch über das Internet.

> Lasst die Option eingeschaltet, solange es nicht nötig ist. Wer unterwegs aufschließen kann, kann das auch mit einem gestohlenen Handy und bekannter PIN.

#### Benachrichtigungen

![Karte „Benachrichtigungen“: Empfänger und Zeit für „Tür zu lange offen“.](bild: seite=zugang-einstellungen; ziel=.card:has(#zNotify))

Clubwerk kann euch aufs Handy melden, wenn eine Tür sich nicht öffnen oder abschließen ließ oder zu lange offen steht:

- **Bei Störung oder offener Tür melden an:** der Name des Handys in Home Assistant (der Mitteilungsdienst „notify“, z. B. `mobile_app_handy_vorstand`). Leer = keine Meldung.
- **Tür länger offen als … Minuten melden:** 0 = aus. Das klappt nur bei Türen mit Türkontakt und meldet jede offene Tür einmal. Im Verlauf erscheint dazu ein Eintrag „Alarm“.

#### Einstellungen übertragen

Unten auf der Seite: Türen, Zeitprofile, Sperrtage und Einstellungen als Datei exportieren und in einer anderen Clubwerk-Installation importieren. Freischaltungen, Verlauf, PINs und Schlüssel sind nicht dabei.

## Tablet und App {#tablet-app}

![Der Bereich „Türen“ in der Mitglieder-App.](bild: app=zugang)

![Die Seite „Türen“ am Tablet.](bild: tablet=Türen; hoehe=560)

**In der App** (Bereich „Türen“) sieht das Mitglied nur die Türen, die sein Zeitprofil erlaubt. Oben steht, ob die Verbindung zu den Schlössern steht. Jede Tür zeigt ihren Zustand und die passenden Knöpfe. Beim Antippen fragt die App nach der persönlichen PIN, danach wird geöffnet (oder auf- und abgeschlossen). Ist das Öffnen gerade nicht erlaubt, ist die Kachel grau und nennt den Grund: z. B. „Jetzt nicht – wieder möglich ab morgen 14:00 Uhr.“, „Heute gesperrt: Grundreinigung Clubhaus“ oder „Der Zugang ist vom Vorstand vorübergehend für alle gesperrt.“ Unter den Kacheln steht das eigene Zeitprofil mit seinen Zeiten und, falls gesetzt, „gültig bis“. Die Ansicht aktualisiert sich alle paar Sekunden von selbst.

Damit ein Mitglied den Bereich in der App überhaupt sieht, muss er freigeschaltet sein (Reiter „Freischaltungen“). Unter Mitglieder-App › Bereiche stellt ihr zusätzlich ein, ob „Türen“ von unterwegs erreichbar ist. Voreinstellung: nein, nur im Vereins-WLAN.

**Am Tablet** (optional) gibt es den Reiter „Türen“ in der Kopfzeile, wenn ihr ihn unter Einstellungen › Tablet mit „am Tablet zeigen“ eingeschaltet habt und mindestens eine Tür existiert. Wer öffnen will, tippt eine Tür an, gibt die ersten Buchstaben seines Namens ein, wählt sich aus und tippt die App-PIN. Die PIN merkt sich das Tablet nie. Es erscheinen nur freigeschaltete Mitglieder mit gekoppeltem Handy, die nicht gesperrt sind. Zeitprofile, Sperrtage und die Notfall-Sperre gelten genauso wie in der App.

![Am Tablet: Name wählen und PIN eingeben.](bild: tablet=Türen; klick=[data-d]; hoehe=700)

> Das Tablet schützt sich selbst. Nach 3 falschen PINs für denselben Namen (oder 5 am selben Gerät) innerhalb von 15 Minuten gibt es 30 Minuten Pause. Nach 10 falschen PINs innerhalb von 24 Stunden schaltet sich das Öffnen am Tablet ganz ab, und der Vorstand bekommt eine Warnung. Einschalten könnt ihr es wieder unter Einstellungen › Tablet. Die App funktioniert weiter.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Zugang | Alles im Menü „Zugang“: Freischaltungen, Türen, Zeitprofile, Sperrtage, Verlauf und Einstellungen; außerdem Fernöffnung und Notfall-Sperre |
| Zugang bedienen | Nur die Seite „Bedienen“: Türen aus der Ferne öffnen und schließen, Notfall-Sperre setzen und aufheben. Nichts einrichten |

Einstellungen › Erreichbarkeit (Vereinsnetz) ändert nur, wer das Recht „Einstellungen“ hat.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Mitglieder-App:** Türen sind ein Bereich der App; Freischaltung, QR-Code und PIN laufen über sie. Auch Trainer ohne Mitgliedschaft können freigeschaltet werden, wenn ihr den Bereich für sie erlaubt habt.
- **Mitglieder:** Namen erscheinen als „Nachname, Vorname“. In der Datenauskunft eines Mitglieds stehen seine Türöffnungen.
- **Einrichtung:** Der Einrichtungs-Assistent führt durch „Anbindung der Türen“ und „Türen anlegen“.
- **Übersicht:** Die Startseite zeigt Türen, Freigeschaltete, „Heute geöffnet“ und offene Türen, und warnt bei fehlender Verbindung, blockierten oder aufgeschlossenen Schlössern und bei der Notfall-Sperre.
- **Tablet:** Der Schalter „am Tablet zeigen“ steht zentral unter Einstellungen › Tablet.
- **Datenschutz:** Unter Einstellungen › Datenschutz stellt ihr ein, wie lange Türöffnungen gespeichert bleiben (7 bis 365 Tage, Standard 30). Danach löscht Clubwerk sie jeden Tag von selbst. Das Verzeichnis der Verarbeitungstätigkeiten enthält den Zweck „Zutritt zu Vereinsheim und Anlage“.
- **Beregnung und andere Module mit Home Assistant:** Ein Gerät kann nur in einem Modul verwendet werden; Clubwerk lehnt doppelte Zuordnungen ab.
- **Datensicherung:** Die nächtliche Sicherung legt das Türprotokoll des laufenden Monats als Excel-Datei bei.
