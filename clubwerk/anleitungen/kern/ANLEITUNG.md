# Clubwerk Grundlagen
<!-- kurz: Verwaltung, Einrichtung, Konten, Mitglieder-App, Rechte, Sicherung, Nachrichten und Einstellungen – alles, was für den ganzen Verein gilt. -->

## Wofür ist das Modul? {#wofuer}

Das ist der Kern von Clubwerk. Er gehört zu jeder Installation und enthält alles, was nicht zu einem einzelnen Modul gehört: die Übersicht, den Einrichtungs-Assistenten, Konten und PINs, die Verwaltung der Mitglieder-App, Benutzer und Rechte, die Datensicherung, das Protokoll, Nachrichten an Mitglieder, den Kontoauszug und die Einstellungen für den ganzen Verein.

Die Module (Verkauf, Plätze, Mängel …) schaltet ihr unter Einstellungen › Module ein. Der Kern läuft auch ganz ohne Module. Ihr erreicht ihn in der Verwaltung über „Übersicht“ und die Menügruppe „Verein“.

## Einrichten {#einrichten}

1. **Erster Start:** Öffnet Clubwerk in der Home-Assistant-Seitenleiste. Ihr seht „Willkommen bei Clubwerk“. Wählt die Sprache und tippt „Einrichtung starten“. (Mit „Demo ausprobieren“ lernt ihr Clubwerk vorher mit erfundenen Daten kennen.)
2. **Admin-Konto anlegen:** Name, Benutzername und Passwort (mindestens 8 Zeichen). Dieses Konto hat alle Rechte.
3. **Assistent durcharbeiten:** Er führt durch Verein, Tablet, Module, Sicherheit, Postfach und Sicherungen (siehe „Einrichtung“ unten). Jeder Punkt lässt sich überspringen und später nachholen.
4. **Weitere Benutzer anlegen:** Unter Benutzer & Rechte bekommt jeder ein eigenes Konto mit den Rechten, die er braucht.

> Zwei Dinge sollten sofort erledigt sein: ein **Sicherungspasswort** festlegen (Datensicherung) und das **Notfallblatt** ausdrucken. Ohne sie ist eine Sicherung wertlos.

## Verwaltung {#verwaltung}

Links steht das Menü. Oben im Menü sucht ihr mit **Suchen** (Tastenkürzel Strg K bzw. ⌘K) nach Seiten, Einstellungen, Aktionen und Personen. Unten steht euer Name: Ein Klick öffnet „Mein Konto“, daneben öffnet das Tablet-Symbol die Tablet-Seite in einem neuen Tab und der Pfeil meldet euch ab. Über **Verwaltung** in der Kopfzeile des Tablets meldet Clubwerk nach einer Minute ohne Eingabe ab; eine Anmeldung direkt in der Verwaltung (zum Beispiel in der Seitenleiste von Home Assistant) bleibt davon unberührt, auch im selben Browser. Oben rechts öffnet das **„?“** die Anleitung des Bereichs, in dem ihr gerade seid, als PDF.

### Seite „Übersicht“ {#uebersicht}

![Die Übersicht: Begrüßung, Fortschritt der Einrichtung, „Zu erledigen“ und das Raster der Module.](bild: seite=uebersicht)

Die Übersicht ist eure Startseite. Sie zeigt, was heute wichtig ist.

#### Einrichtung zu … % fertig

Eine Zeile mit Balken. „Alle Punkte“ öffnet die Seite „Einrichtung“, „Einrichtung fortsetzen“ springt zum nächsten offenen Punkt. Sie verschwindet, sobald alles erledigt ist.

#### Zu erledigen

![Die Karte „Zu erledigen“ mit farbigen Hinweisen. Rote Hinweise stehen oben.](bild: seite=uebersicht; ziel=.todo)

Hier stehen Hinweise aus dem Kern und allen Modulen: fehlendes Sicherungspasswort, ausgeschaltete Verschlüsselung, fehlendes Vereinsnetz, neue Einträge vom Tablet zum Bestätigen, knapper Bestand und vieles mehr. Rot ist dringend, gelb ist ein Hinweis. Sechs Hinweise sind sichtbar, „Alle zeigen“ klappt den Rest auf. Der Link am Zeilenende führt direkt dorthin, wo ihr es erledigt. Ihr seht nur Hinweise, die ihr mit euren Rechten auch erledigen dürft.

#### Raster der Module

![Das Raster der Module: Name, Zustand und die wichtigste Zahl.](bild: seite=uebersicht; ziel=.mods2)

Jedes eingeschaltete Modul hat eine Kachel mit Zustand (Läuft, Hinweis, Störung) und seiner wichtigsten Zahl. Ein Klick öffnet das Modul. Darunter stehen, wenn es etwas gibt, „Bestand knapp“ und „Letzte Lieferungen“ des Verkaufs.

> Am Handy öffnet das Symbol links oben mit „Menü“ die Menüleiste.

### Seite „Einrichtung“ {#einrichtung}

![Die Seite „Einrichtung“: offene, erledigte und ausgeblendete Punkte.](bild: seite=einrichtung; ziel=.card:has(.wizbar))

Die Checkliste für alles, was zur Einrichtung gehört. Oben steht „Einrichtung zu … % fertig“. Die Punkte sind in drei Listen sortiert: **Offen**, **Erledigt** und **Ausgeblendet**. Zu den Punkten gehören die allgemeinen Schritte (Sprache, Admin-Konto, Verein, „Wie nutzt ihr Clubwerk?“, Module wählen, Sicherheit, Postfach, Mitglieder-App, Vereinsnetz, Sicherungen) und die Schritte eurer Module (zum Beispiel „Artikel und Preise“ beim Verkauf oder „Plätze anlegen“ bei den Plätzen). Jedes Modul meldet seine Schritte selbst.

- **Einrichten** öffnet den Assistenten an diesem Punkt.
- **Ansehen** bei einem erledigten Punkt zeigt die Einstellung noch einmal.
- **Ausblenden** nimmt einen Punkt aus der Checkliste, wenn ihr ihn nicht braucht. „Wieder zeigen“ holt ihn zurück.
- **Assistent noch einmal durchgehen** startet von vorn.

![Der Assistent an einem Schritt: Fortschritt oben, die passende Einstellung darunter, „Später“ und „Weiter“ unten.](bild: seite=einrichtung; klick=[data-wgo="sicherheit"])

Im Assistenten seht ihr oben „Schritt x von y“ mit dem Fortschritt und eine kurze Erklärung. Darunter steht genau die Karte der Einstellung, alles andere ist ausgeblendet. Mit **Weiter** geht es zum nächsten Schritt, mit **Später** bleibt der Punkt offen, **Zurück** geht einen Schritt zurück, **Einrichtung beenden** schließt den Assistenten. Die Schritte „Module wählen“ und „Fertig“ haben eine eigene Ansicht.

> In einer Demo-Installation steht oben eine Leiste „Demo – alle Daten sind erfunden“. „Demo beenden und einrichten …“ löscht alle Beispieldaten restlos (mit eurem Passwort bestätigen). Danach beginnt die echte Einrichtung.

**Ohne Tablet:** Im Schritt „Wie nutzt ihr Clubwerk?“ wählt ihr „Mit Tablet im Vereinsheim“ oder „Ohne Tablet“. Mit Tablet legt ihr gleich das Passwort fest, mit dem jedes Tablet einmal freigeschaltet wird.

### Seite „Mitglieder & Konten“ {#konten}

![Die vier Zahlen oben: aktive Mitglieder, Mannschaften, PINs, offene Beträge.](bild: seite=konten; ziel=.kpis)

![Suche und Filter über der Liste.](bild: seite=konten; ziel=.filterbar)

Hier verwaltet ihr die **Konten für den Verkauf am Tablet**: wer wie viel offen hat, wer eine PIN hat, Mannschaften und Sonderkonten. Mit der Mitgliederverwaltung heißt die Seite „Konten & PINs“ und steht im Menü „Verkauf“. Dann legt ihr Mitglieder dort an; hier entstehen nur „Kein Mitglied“-Konten (zum Beispiel Trainer) und Mannschaften. Ohne Mitgliederverwaltung gibt es nur Vor- und Nachname.

#### Oben: Knöpfe und Zahlen

- **+ Neues Mitglied** (bzw. „+ Neues Konto“) legt einen Eintrag an: Name, Typ und bei Mannschaften die PIN.
- **Import …** liest eine Excel-Datei mit Vorname und Nachname (optional Typ und PIN). Eine Vorlage könnt ihr herunterladen; vorab seht ihr, wie viele Einträge neu sind.
- **Liste einfügen …** legt viele Namen auf einmal an (ein Name pro Zeile).
- Vier Zahlen: aktive Mitglieder, Mannschaften & Gruppen, Mit PIN geschützt, Offen auf Konten.

![Neues Konto anlegen: Name und Typ.](bild: seite=konten; klick=#mNew; ziel=dialog)

#### Neu am Tablet eingetragen

Trägt sich jemand am Tablet mit „Ich bin neu“ ein, steht er in einer gelben Karte. Ihr könnt den Namen anpassen und **Bestätigen**, mit **Ist schon Mitglied …** auf ein vorhandenes Konto zusammenführen (die Buchungen wandern mit) oder, wenn er noch nichts gebucht hat, **Löschen**.

#### Diese Saison nicht da

Eine Karte mit Mitgliedern, die seit Saisonbeginn nichts gebucht haben. **Entfernen** löscht Einträge ohne Buchungen, wer früher gebucht hat, wird nur **Ausgeblendet** (die alten Abrechnungen bleiben). Wer noch etwas offen hat, muss erst abgerechnet werden.

#### Liste und Konto

Die Liste hat die Spalten **Name** (als „Nachname, Vorname“), **Typ**, **PIN** (gesetzt, ohne, gesperrt, bei Mannschaften „vom Vorstand“), **Zuletzt da** und **Offen**. Oben suchen und filtern ihr: Alle, Mitglieder, Kein Mitglied, Mannschaften, Sonderkonten, Mit offenem Betrag, Ausgeblendet.

![Das Konto rechts neben der Liste: offener Betrag, PIN und Aktionen.](bild: seite=konten; klick=tr[data-sel]; ziel=#mDetail)

Ein Klick auf einen Namen zeigt rechts das Konto (am Handy in einem Fenster):
- **Buchungen** öffnet die Buchungen dieser Person.
- **Bearbeiten** ändert Name, Typ und PIN (bei Mannschaften vergibt nur der Vorstand die PIN). „Auf dem Tablet anzeigen“ blendet ein Konto aus. In dem Fenster stehen auch die Freischaltungen der Mitglieder-App und „Löschen“.
- **PIN zurücksetzen:** Beim nächsten Mal legt die Person am Tablet eine neue PIN fest. Bis dahin sind Buchen und Stornieren von Plätzen am Tablet gesperrt.

Sonderkonten sind **Verein (kostenfrei)** und **Gast (bar)**.

### Seite „Mitglieder-App“ {#app}

Hier richtet ihr die App für Mitglieder ein. Ein Mitglied bekommt **eine Einladung** (QR-Code, E-Mail oder Brief), nutzt **eine PIN** und sieht, was ihr freigeschaltet habt. Die PIN gilt auch am Tablet. Die Seite hat vier Reiter, die ihr je nach Recht seht.

### Reiter „Mitglieder“ {#app-mitglieder}

![Reiter „Mitglieder“: Mitglied freischalten.](bild: seite=app; klick=[data-sec="mitglieder"]; ziel=.card:has(#apGo))

#### Mitglied freischalten

Mitglied wählen, die gewünschten Bereiche ankreuzen und **Freischalten & einladen …** tippen. Es öffnet sich die Wahl, wie die Einladung zum Mitglied kommt.

![Die Einladung: QR-Code am Bildschirm, per E-Mail oder als Brief.](bild: seite=app; klick=[data-sec="mitglieder"]; klick2=[data-aq]; ziel=#askBox)

- **QR-Code hier am Bildschirm:** Das Mitglied scannt ihn mit der Handy-Kamera, am besten direkt vor Ort. Er gilt einmal und nur kurze Zeit (einstellbar). Danach legt das Mitglied seine App-PIN fest. Den Code nicht abfotografieren: Wer ihn zuerst scannt, bekommt den Zugang.
- **Per E-Mail schicken:** persönlicher Link, gilt einige Tage. Braucht ein Postfach und die Adresse in der Mitgliederverwaltung.
- **Einladungsbrief drucken:** QR-Code mit Anleitung auf Papier.
- **Türen und Beregnung jetzt freigeben:** erscheint nur, wenn ein Handy von unterwegs ohne SMS-Code gekoppelt wurde.

#### Freigeschaltete Mitglieder

Die Liste zeigt je Mitglied den Handy-Zustand (Handy freigeschaltet, QR-Code offen, Einladung abgelaufen, gesperrt) und je Bereich ein Häkchen zum Freischalten. Die Filter „mit Handy“, „ohne Handy“, „eingeladen“, „warten auf WLAN“ und „alte Adresse“ helfen beim Aufräumen. Am Zeilenende lädt der Brief-Knopf neu ein, der Papierkorb entfernt: **Nur Handy entfernen** (mit neuem QR-Code ist das Mitglied wieder dabei) oder **Ganz aus der App entfernen**. **Einladungen verschicken …** lädt viele auf einmal per E-Mail oder als Briefe ein.

> Ein neuer QR-Code oder die Freischaltung eines neuen Bereichs kann das alte Handy aus Sicherheitsgründen abmelden. Dann einfach neu einladen.

### Reiter „Bereiche“ {#app-bereiche}

![Reiter „Bereiche“: welche Bereiche die App zeigt, für wen und in welcher Reihenfolge.](bild: seite=app; klick=[data-sec="bereiche"])

Eine Tabelle für alle Bereiche der App, ein „Speichern“ für alles:
- **Schalter:** Aus = der Bereich ist für alle weg, die Freischaltungen bleiben.
- **Für wen:** „alle Mitglieder“ oder „nur ausgewählte“ mit Anzahl.
- **Unterwegs:** Ohne Haken funktioniert der Bereich nur im Vereins-WLAN (nur mit dem Recht „Einstellungen“).
- **Beim Freischalten:** „vorwählen“ kreuzt den Bereich bei neuen Mitgliedern von selbst an.
- **Start** und **↑ ↓:** Startbereich und Reihenfolge. Von Haus aus öffnet die App „Für mich“.

„Für mich“ steht immer ganz vorn. Es ist die Startseite der App mit den Karten „Neu für dich“, „Als Nächstes“, „Zu erledigen“ und „Mein Konto“. Offene Antworten zu Terminen und Spieltagen erscheinen nur als Hinweis („Termine: n Antworten offen“, „Spieltage: n Rückmeldungen offen“), ohne Knöpfe und ohne Zeitgrenze. Wer ein Thekenkonto hat, kann es unten per Häkchen auch unter „Für mich“ anzeigen lassen.

### Reiter „Benachrichtigungen“ {#app-push}

![Reiter „Benachrichtigungen“: Anlässe eines Moduls.](bild: seite=app; klick=[data-sec="push"]; ziel=#pushCard > div:nth-of-type(2))

![Testnachricht an ein Mitglied.](bild: seite=app; klick=[data-sec="push"]; ziel=.row:has(#pshWho))

Push sind kurze Hinweise aufs Handy (auf dem iPhone nur in der Home-Bildschirm-App ab iOS 16.4). Oben steht, wie viele Handys angemeldet sind. Je Modul kreuzt ihr an, bei welchen **Anlässen** ein Hinweis kommt (zum Beispiel neue Nachricht, Erinnerung an einen Termin, neue Mängelmeldung); manche haben eine Vorlaufzeit. Jedes Mitglied schaltet Push nur je Handy ein oder aus, was ihr freigebt, entscheidet ihr. Unten sendet **Testnachricht an** einen Hinweis an ein Mitglied. „Zuletzt gesendet“ zeigt die letzten Hinweise und ob sie ankamen. Gesendet werden nur Titel und ein Satz, nie etwas, wofür man eine PIN braucht.

### Reiter „Einstellungen“ {#app-einstellungen}

Hier liegen die Karten zur Adresse und Sicherheit der App.

#### Adresse & Aussehen

![Karte „Adresse & Aussehen“: Adresse im Vereins-WLAN, Name auf dem Homescreen und Zugang von unterwegs.](bild: seite=app; klick=[data-sec="einstellungen"]; ziel=#apSet)

- **Adresse im Vereins-WLAN:** unter dieser Adresse erreichen Handys die App. Sie landet im QR-Code. Leer = die Adresse, unter der ihr die Verwaltung gerade offen habt. Adressen mit „.local“ öffnen manche Handys nicht, besser ohne „.local“ oder mit IP-Adresse.
- **Name auf dem Homescreen:** höchstens 20 Zeichen.
- **Öffentliche Adresse** und **Von unterwegs erreichbar:** für den Zugang von außen über einen Cloudflare Tunnel. Nur die Mitglieder-App wird erreichbar, Verwaltung, Tablet und Beregnung bleiben im Vereins-WLAN. Die Schritte zur Einrichtung stehen aufklappbar auf der Karte. **Verbindung prüfen** testet den Weg, **Testen ↗** öffnet die App.

Ist ein Tunnel an, erscheint die Karte **Tunnel-Quelle**: Ihr legt fest, von welcher Adresse im Home-Assistant-Netz der Tunnel kommen darf. Das verhindert, dass sich ein anderes Add-on als Tunnel ausgibt (empfohlen).

#### Sicherheit

![Karte „Sicherheit“: Gültigkeit der Einladungen und Warn-Adresse.](bild: seite=app; klick=[data-sec="einstellungen"]; ziel=#apSec)

Wie lange QR-Code (1 Stunde, 1 Tag oder 7 Tage) und E-Mail/Brief (2, 7 oder 14 Tage) gelten, an wen die Warnung bei einem gesperrten Handy geht und ob der QR-Code auch als Link zum Weiterschicken angeboten wird (weniger sicher). Nach 5 falschen PINs ist das Handy 5 Minuten gesperrt, ab dem 10. Fehlversuch 30 Minuten, danach ganz: Dann hilft nur ein neuer QR-Code.

#### Bestätigung per SMS

Ein zweiter Faktor für Einladungen von unterwegs: ein LTE-USB-Stick mit SIM-Karte am Home-Assistant-Rechner schickt einen Code per SMS an die Handynummer aus der Mitgliederverwaltung. **Anschlüsse suchen**, Anschluss wählen, **Speichern**, **SMS-Bestätigung einschalten**, mit **Test-SMS senden** prüfen. Ohne SMS schalten sich Türen und Beregnung bei Kopplung von unterwegs erst im Vereins-WLAN frei.

### Seite „Nachrichten“ {#email}

Hier schreibt ihr Nachrichten an Mitglieder, Gruppen und Adressen. Drei **Wege** stehen zur Wahl, auch kombiniert: **E-Mail**, **In der Mitglieder-App** und **Push-Hinweis aufs Handy**. Für E-Mails braucht ihr ein Postfach (Einstellungen › Postfach), sonst gehen nur Nachrichten in die App und Entwürfe. Ohne Mitgliederverwaltung sind es nur die Adressen, die ihr eintippt.

### Reiter „Neue Nachricht“ {#email-neu}

![Eine neue Nachricht: Absender, Empfänger, Weg, Betreff, Text und Anhänge.](bild: seite=email; tab=neu)

Von oben nach unten:
- **Von:** Absender ist immer das Vereinspostfach, so landen Mails nicht im Spam. Empfänger sehen euren Namen. „ändern“ öffnet „Mein Konto“ (Antwort-Adresse und Unterschrift).
- **An:** Gruppen (zum Beispiel Abteilungen), einzelne Mitglieder, Verteiler und freie Adressen. Beim Tippen erscheinen Vorschläge. Mehrere Adressen trennt ihr mit Komma. Rote Empfänger haben keine Adresse.
- **Weg:** E-Mail, In der Mitglieder-App, Push-Hinweis. Mitglieder ohne E-Mail-Adresse bekommen nichts per E-Mail, dafür „In der Mitglieder-App“ wählen.
- **Ohne eigene Adresse an den Zahler:** Kinder ohne Adresse erreichen so die Eltern.
- **Kopie an mich.**
- **In der App sichtbar:** wie lange die Nachricht in der App steht (Vorgabe, 1 bis 24 Monate).
- **Oben anheften:** bleibt in der App ganz oben, bis ihr sie löst.
- **Betreff** und **Text** mit Werkzeugleiste: fett, kursiv, unterstrichen, Überschriften, Listen, Zitat, Trennlinie, Link. **Platzhalter …** fügt zum Beispiel die Briefanrede oder den Vornamen ein, die für jeden Empfänger ersetzt werden. **Vorlage …** setzt eine gespeicherte Vorlage ein.
- **＋ Datei anhängen** oder Dateien hineinziehen: bis 10 MB je Datei, insgesamt 20 MB.
- Unten: **Als Vorlage speichern**, **Verwerfen**, **Vorschau** („So sieht es bei … aus“) und **Senden …**. Vor dem Senden fragt Clubwerk mit der Zahl der Empfänger nach.

Die Nachricht wird beim Schreiben automatisch als Entwurf gespeichert.

> Der Push-Anlass „Nachrichten vom Verein“ muss unter Mitglieder-App › Benachrichtigungen freigegeben sein, sonst kommt nur die Nachricht in der App.

### Reiter „Entwürfe“ {#email-entwuerfe}

![Der Reiter „Entwürfe“.](bild: seite=email; tab=entwuerfe)

Alles, was ihr angefangen habt. Ein Klick auf einen Entwurf öffnet ihn zum Weiterschreiben, **Verwerfen** löscht ihn.

### Reiter „Gesendet“ {#email-gesendet}

![Der Reiter „Gesendet“: Betreff, Absender, Zeitpunkt, Zahl der Empfänger und Weg.](bild: seite=email; tab=gesendet)

Jede gesendete Nachricht mit Betreff, Absender, Zeitpunkt, Empfängerzahl und Weg. Unten stellt ihr ein, wie lange Nachrichten in der App standardmäßig bleiben (1 bis 24 Monate).

![Die Zustellung einer Nachricht: wer erreicht wurde.](bild: seite=email; tab=gesendet; klick=.ml-row)

Ein Klick öffnet die Nachricht mit Text, Anhängen und der **Zustellung**: wie viele bekamen sie per E-Mail, in der App, per Push, wer wurde nicht erreicht und warum (keine Adresse, ungültig, fehlgeschlagen). **Fehlgeschlagene erneut senden** versucht es noch einmal. **Weiterverwenden** öffnet eine Kopie als neuen Entwurf, **Aus der App nehmen** lässt sie bei den Mitgliedern sofort verschwinden (E-Mails bleiben), **Löschen** entfernt sie samt Liste.

### Reiter „Verteiler“ {#email-verteiler}

![Neuer Verteiler: eine gespeicherte Empfängerliste.](bild: seite=email; tab=verteiler; klick=button.btn.primary; ziel=dialog)

Gespeicherte Empfängerlisten wie „Vorstand“, „Trainer“ oder „Sponsoren“. Gruppen darin bleiben aktuell: Wer neu in eine Abteilung kommt, ist automatisch dabei. Bearbeiten und Löschen gehen in der Liste.

### Reiter „Vorlagen“ {#email-vorlagen}

![Der Reiter „Vorlagen“: wiederkehrende Texte.](bild: seite=email; tab=vorlagen)

Wiederkehrende Nachrichten wie die Einladung zur Mitgliederversammlung. **Verwenden** öffnet sie als neue Nachricht, **Bearbeiten** ändert Name, Betreff und Text, **＋ Neue Vorlage** legt eine an. Platzhalter wie `{briefanrede}` werden je Empfänger ersetzt.

### Seite „Kontoauszug“ {#kontoauszug}

![Die Seite „Kontoauszug“: Datei ablegen, Filter und Liste der Buchungen.](bild: seite=kontoauszug; klick=[data-f="nicht"])

Hier lest ihr den Kontoauszug aus dem Online-Banking ein, und Clubwerk ordnet **Zahlungseingänge und Rücklastschriften** den offenen Beiträgen und Rechnungen zu. Die Seite steht bei „Beiträge & Zahlungen“ (ohne Mitgliederverwaltung bei der Buchhaltung). Es gibt keine Verbindung zur Bank, nur den Datei-Upload. Die Datei selbst wird nie gespeichert.

- **Datei ablegen:** CAMT-Datei (XML oder ZIP), Sparkassen-„CSV-CAMT“ oder ein CSV-Export, mehrere Dateien auf einmal, bis 5 MB je Datei. Bereits eingelesene Buchungen erkennt Clubwerk wieder. Abbuchungen werden übersprungen.
- **Unbekanntes CSV:** Dann öffnet sich „Spalten zuordnen“: Vereinskonto wählen und sagen, welche Spalte Datum, Betrag, Name, IBAN, Verwendungszweck und Soll/Haben enthält. Beim nächsten Mal merkt sich Clubwerk die Zuordnung.
- **Zuletzt eingelesen:** zeigt bis zu welchem Datum der Auszug reicht.

#### Filter und Liste

Drei Filter: **Zu prüfen** (Clubwerk hat einen Vorschlag), **Nicht zugeordnet** (kein Vorschlag, oder als „gehört nicht zu Clubwerk“ markiert) und **Zugeordnet**. Die Spalten: Von, Vorschlag bzw. Zugeordnet zu, Datum, Verwendungszweck, Betrag. Ein Vorschlag trägt die Marke sicher, wahrscheinlich oder vielleicht.

- **Übernehmen** nimmt den einzigen Vorschlag an. **Alle sicheren übernehmen (n)** oben rechts erledigt alle eindeutigen auf einmal.
- **Prüfen …** und **Zuordnen …** öffnen das Fenster zum Zuordnen.
- **Aufheben** nimmt eine Zuordnung zurück, Posten, Einzug und Rechnung stehen danach wieder wie vorher.

![Zahlung zuordnen: Vorschläge und Suche von Hand.](bild: seite=kontoauszug; klick=[data-f="nicht"]; klick2=[data-kchk]; ziel=dialog)

#### Zuordnen und Rücklastschriften

Im Fenster seht ihr Datum, Betrag, Zahler und Verwendungszweck, darunter die **Vorschläge** und die Suche **Von Hand zuordnen**. Bei einer **Rücklastschrift** stellt ihr zusätzlich die **Gebühr für den Zahler** ein und ob das **Mandat gesperrt** wird. **Gehört nicht zu Clubwerk** versteckt die Buchung; sie wird nach der Löschfrist (Einstellungen › Datenschutz, Vorgabe 90 Tage) gelöscht.

> Zum Zuordnen braucht ihr das Recht „Kontoauszug“ und zusätzlich „Einzug“ bzw. „Buchhaltung“. Sonst seht ihr die Buchungen nur.

### Seite „Benutzer & Rechte“ {#benutzer}

Jeder meldet sich mit eigenem Benutzernamen an, so ist nachvollziehbar, wer was geändert hat. **Rollen** bündeln Rechte, zum Beispiel für den Kassenwart.

### Reiter „Benutzer“ {#benutzer-benutzer}

![Reiter „Benutzer“: Name, Zugang, letzte Anmeldung.](bild: seite=benutzer; tab=benutzer)

Die Liste zeigt je Benutzer Name, Benutzername, die Rollen oder „alle Rechte“ und die letzte Anmeldung. Gesperrte Benutzer sind grau.

![Neuer Benutzer: Mitglied wählen oder manuell anlegen, dann Zugang vergeben.](bild: seite=benutzer; tab=benutzer; klick=#uNew; ziel=dialog)

**+ Neuer Benutzer:**
- **Mitglied auswählen** (der Benutzername entsteht automatisch) oder **Manuell anlegen** mit Vor- und Nachname.
- **Start-Passwort** (mindestens 8 Zeichen) persönlich weitergeben.
- **Zugang:** „Nach Rollen“ (Rollen ankreuzen, dazu einzelne Zusatzrechte) oder „Alle Rechte“ (wie das Adminkonto; mit eigenem Passwort bestätigen).
- **Abteilungen:** bei Rollen mit „eigene Abteilung“ legt ihr fest, für welche Abteilungen sie gelten.

Beim Bearbeiten: **Zugang aktiv** sperrt oder öffnet ein Konto, **Neues Passwort vergeben** und **Benutzer löschen** (die Protokolleinträge bleiben). Das **Adminkonto** hat immer alle Rechte und kann weder gesperrt noch gelöscht werden.

### Reiter „Rollen“ {#benutzer-rollen}

![Reiter „Rollen“: gebündelte Rechte.](bild: seite=benutzer; tab=rollen)

Eine Rolle hat einen Namen, eine Beschreibung und Rechte. Die Liste zeigt, wie viele Benutzer sie haben.

![Rolle bearbeiten: Name, Beschreibung, „Nur eigene Abteilungen“ und Rechte.](bild: seite=benutzer; tab=rollen; klick=[data-r]; ziel=dialog)

**Nur Mitglieder der eigenen Abteilungen** ist für Abteilungsleitungen gedacht: Sie sehen nur die Mitglieder ihrer Abteilung (gilt für die Rechte „Mitglieder“ und „Nachrichten“). Eine Rolle, die Benutzer hat, lässt sich nicht löschen.

### Seite „Datensicherung“ {#sicherung}

![Die Datensicherung: Kennzahlen und Karten.](bild: seite=sicherung; ziel=.kpis)

Jede Nacht entsteht eine **verschlüsselte Komplettsicherung** mit allem, was Clubwerk enthält (Datenbank, Belege, Bilder, Module). Öffnen lässt sie sich nur mit dem **Sicherungspasswort**. Oben zeigen drei Kacheln die letzte Sicherung, die **Probe-Wiederherstellung** (einmal im Monat automatisch) und die **Sicherungsziele**. Gelbe oder rote Hinweise darüber melden Probleme.

#### Verschlüsselung der persönlichen Daten

![Karte „Verschlüsselung der persönlichen Daten“ (Tresor).](bild: seite=sicherung; ziel=#vaultCard)

Der **Tresor** speichert Adressen, Bankdaten, Geburtsdaten, Dokumente, Fotos und ähnliches nur verschlüsselt. Namen, Konten und Buchungen bleiben lesbar, damit der Betrieb nach einem Neustart sofort läuft. Aufklappbar steht, was genau geschützt wird.
- **Verschlüsselung einschalten:** Passwort eingeben, dann zeigt Clubwerk einmalig den **Wiederherstellungscode**. Druckt **zwei Blätter** (eins für den Vorsitz, eins für den Kassenwart), bewahrt sie verschlossen und nicht im Vereinsheim auf. Zur Probe tippt ihr danach einige Zeichen des Codes ab.
- **Nach einem Neustart** sind die Daten verschlossen, bis sich ein Admin anmeldet. Ist das nicht möglich, öffnet der Wiederherstellungscode mit eurem Passwort sie. Bis dahin laufen Tablet, Buchungen, Türen und Beregnung weiter, E-Mails warten.
- **Neuen Wiederherstellungscode erzeugen** (zum Beispiel beim Vorstandswechsel; der alte gilt dann nicht mehr) und **Verschlüsselung ausschalten** brauchen euer Passwort.

#### Jetzt

![Karte „Jetzt“: sofort sichern, prüfen, herunterladen.](bild: seite=sicherung; ziel=.card:has(#bkRun))

**Jetzt sichern**, **Letzte Sicherung prüfen** und **Letzte Komplettsicherung herunterladen**. Die Datei (`.cwbackup`) ist verschlüsselt und eignet sich als zweites Exemplar außer Haus, zum Beispiel auf einem USB-Stick.

#### Sicherungspasswort

![Karte „Sicherungspasswort“.](bild: seite=sicherung; ziel=.card:has(#bkPwSet))

Das Passwort verschlüsselt alle Sicherungen, mindestens 10 Zeichen. **Ohne das Passwort ist eine Sicherung wertlos.** Nach dem Festlegen druckt ihr das **Notfallblatt**: Passwort, Orte der Sicherungen und die Schritte zur Wiederherstellung nach einem Totalausfall. Beim **Ändern** bleiben ältere Sicherungen mit dem alten Passwort lesbar, hebt also das alte Blatt auf. Festlegen und ändern darf nur ein Benutzer mit allen Rechten.

#### Zeitplan & Aufbewahrung

![Karte „Zeitplan & Aufbewahrung“.](bild: seite=sicherung; ziel=.card:has(#bkHour))

Uhrzeit der nächtlichen Sicherung und wie viele tägliche, wöchentliche und monatliche Sicherungen bleiben. „Zusätzlich lesbare Auszüge hochladen“ legt unverschlüsselte Excel-Dateien der Module mit ab. Das ist bequem, aber nicht verschlüsselt.

#### Sicherungsziele

![Karte „Sicherungsziele“: wohin die Nachtsicherung zusätzlich geht.](bild: seite=sicherung; ziel=.card:has(#tgAdd))

Wohin die Komplettsicherung jede Nacht zusätzlich geht. Am sichersten sind zwei Ziele an verschiedenen Orten. **Ziel hinzufügen …** kennt WebDAV (Nextcloud, NAS, Storage Box), SFTP und FTP/FTPS (zum Beispiel FRITZ!Box); **Dropbox verbinden …** richtet Dropbox ein. Je Ziel gibt es **Testen**, **Bearbeiten** (auch eigene Aufbewahrung) und **Entfernen**. Alte unverschlüsselte Dateien früherer Versionen in Dropbox lassen sich löschen.

#### Wiederherstellen

![Karte „Wiederherstellen“: Sicherungen hier und auf den Zielen.](bild: seite=sicherung; ziel=.card:has(#bkUp))

Eine Komplettsicherung ersetzt beim nächsten Neustart **alles**. Der aktuelle Stand wird vorher beiseitegelegt. Wählt die Sicherung in der Liste (hier oder auf einem Ziel) und tippt **Wiederherstellen …**, oder ladet eine Datei mit **Komplettsicherung hochladen …**, zum Beispiel nach einer Neuinstallation. Danach „Jetzt neu starten“. Nur ein Benutzer mit allen Rechten darf das.

#### Datenbank-Schnappschüsse

Zusätzlich sichert Clubwerk jede Nacht nur die Datenbank (die letzten 14 Nächte), praktisch, um einen Fehler der letzten Tage schnell rückgängig zu machen. **Schnappschuss jetzt** legt einen an, **.db-Datei einspielen …** lädt einen hoch, jeder Eintrag lässt sich herunterladen oder wiederherstellen.

### Seite „Protokoll“ {#protokoll}

![Das Protokoll: Zeit, Wer, Aktion und Details.](bild: seite=protokoll; fuelle=#aq::Nachricht)

Wer hat wann was geändert? Die letzten 500 Einträge: Anmeldungen, Stornos, Übertragungen, Abschlüsse, Preisänderungen, Lieferungen, Sicherungen. Das Feld **Filtern** sucht nach Name oder Aktion. Fehlgeschlagene Anmeldungen sind grau. Geheimnisse (Passwörter, PINs) und Nachrichtentexte stehen nie darin. Ältere Einträge löscht Clubwerk nach den Fristen unter Einstellungen › Datenschutz.

### Seite „Einstellungen“ {#einstellungen}

Alles, was für den ganzen Verein gilt. Die Bereiche stehen als Reiter oben. Was ihr seht, hängt von euren Rechten ab.

### Bereich „Verein“ {#einstellungen-verein}

![Karte „Verein“: Name, Farben und Anschrift.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#clubColor))

- **Vereinsname, Straße, PLZ und Ort, E-Mail, Telefon:** stehen auf Rechnungen, Mitgliedsunterlagen und Bescheinigungen. Alle Module lesen sie von hier.
- **Vereinsfarbe** und **Zweitfarbe** (freiwillig): Die Vereinsfarbe gilt für Tablet, Verwaltung, Mitglieder-App, Beregnung und Excel. Ist sie für Schrift zu hell, dunkelt Clubwerk sie automatisch ab (im dunklen Modus hellt es auf). Die Vorschau zeigt hell und dunkel.

![Karte „Vereinslogo“.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#logoPrev))

**Vereinslogo:** SVG, PNG, JPG oder WebP, bis 2 MB. Nach dem Hochladen schlägt Clubwerk die Farben aus dem Logo vor; ein Klick übernimmt eine als Vereinsfarbe.

![Karte „Vereinssprache“.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#clubLangBody))

**Vereinssprache:** Für Tablet, Mitglieder-App, E-Mails, Excel und PDF, und die Vorgabe für alle. Jeder kann für sich in „Mein Konto“ eine andere wählen.

### Bereich „Bankkonten“ {#einstellungen-bank}

![Karte „Bankkonten“.](bild: seite=einstellungen; klick=[data-sec="bank"]; ziel=.card:has(#bankBody))

Die Bankkonten des Vereins, gemeinsam für Buchhaltung, Lastschriften und Kontoauszug. **+ Bankkonto** legt eines an: Bezeichnung, Kontoinhaber, IBAN, BIC, Kreditinstitut, **Standardkonto** und optional Abteilungen (Rechnungen dieser Abteilungen nennen dieses Konto). Inaktive Konten bleiben erhalten.

### Bereich „Postfach“ {#einstellungen-mail}

![Karte „Postfach“: SMTP-Zugang und Testmail.](bild: seite=einstellungen; klick=[data-sec="mail"]; ziel=#mailCard)

Ein Postfach für alle Module: Server (SMTP), Port (meist 587, manchmal 465), Absender-Adresse, Benutzer und Passwort. Die Daten findet ihr beim Anbieter unter „SMTP“ bzw. „Postausgangsserver“; bei Gmail ein App-Passwort verwenden. **Postfach speichern**, dann **Testmail senden**. Das Passwort wird nie wieder angezeigt und steht in keinem Export.

### Bereich „Erreichbarkeit“ {#einstellungen-erreichbar}

![Karte „Vereinsnetz“.](bild: seite=einstellungen; klick=[data-sec="erreichbar"]; ziel=#apNet)

- **Vereinsnetz:** Welche Netze als Vereinsheim gelten (zum Beispiel `192.168.10.0/24`, mit Komma). Leer = jede private Adresse. Mit eurem Netz kommen Gast-WLAN oder VPN nicht an Verwaltung und Tablet. „Mein Netz übernehmen“ trägt das aktuelle Netz ein. Die Home-Assistant-Seitenleiste funktioniert immer. „Direkte Verbindungen aus dem Internet erlauben“ ist nicht empfohlen.
- **Weitere Adressen:** Namen, unter denen die Verwaltung erreichbar ist, zum Beispiel eine eigene DuckDNS-Adresse. Schutz gegen Angriffe über fremde Webseiten.
- **Verschlüsselung und Zugang von außen:** zeigt, ob HTTPS an ist (in Home Assistant unter Add-on › Konfiguration „HTTPS für alle Geräte“). Den Zugang von unterwegs richtet ihr unter Mitglieder-App › Einstellungen ein.

### Bereich „Datenschutz“ {#einstellungen-datenschutz}

![Karte „Löschfristen“: je Datenart eine Frist.](bild: seite=einstellungen; klick=[data-sec="datenschutz"]; ziel=.card:has(#dsBody))

**Löschfristen:** Clubwerk löscht einmal am Tag, was älter als die Frist ist (zum Beispiel Anmeldungen, Türöffnungen, Beregnung, Rundmails, Änderungsprotokoll). Ins Protokoll kommt nur die Anzahl. Jede Zeile zeigt, wie viele Einträge beim nächsten Lauf wegfallen. Geld und Arbeitszeiten löscht Clubwerk nie von selbst. **Speichern** übernimmt, **Jetzt löschen** startet den Lauf sofort. Die Fristen sind Vorschläge; stimmt sie im Zweifel mit eurem Datenschutzbeauftragten ab.

![Karte „Datenschutzhinweis in der Mitglieder-App“.](bild: seite=einstellungen; klick=[data-sec="datenschutz"]; ziel=.card:has(#dsNotice))

**Datenschutzhinweis in der Mitglieder-App:** Mitglieder sehen den Text beim nächsten Öffnen der App (und nach jeder Änderung) und jederzeit unter „Mein Konto“. **Vorlage einsetzen** füllt einen Mustertext. Leer = kein Hinweis.

**Verzeichnis von Verarbeitungstätigkeiten:** **Verzeichnis drucken** erzeugt eine Vorlage nach Art. 30 DSGVO aus allen eingeschalteten Modulen. Verantwortliche und genutzte Dienste ergänzt ihr selbst.

### Bereich „Tablet“ {#einstellungen-tablet}

![Karte „Tablet im Vereinsheim“: mit oder ohne Tablet.](bild: seite=einstellungen; klick=[data-sec="tablet"]; ziel=#tmCard)

**Tablet im Vereinsheim:** „Mit Tablet“ oder „Ohne Tablet“. Ohne Tablet führt die Tablet-Adresse direkt zur Anmeldung der Verwaltung, es gibt keine Tablet-Seiten und kein Tablet-Passwort. Beim Einschalten legt ihr zuerst das Passwort fest. Ausschalten meldet alle Tablets ab.

![Karte „Passwort für das Tablet“.](bild: seite=einstellungen; klick=[data-sec="tablet"]; ziel=#tpCard)

**Passwort für das Tablet** (mindestens 8 Zeichen): **Pflicht**, solange das Tablet an ist. Jedes Gerät gibt es einmal ein und bleibt dann bis zu 400 Tage freigeschaltet. Ein neues Passwort oder **Alle Geräte abmelden …** sperrt alle bisherigen Geräte, praktisch, wenn das Passwort die Runde gemacht hat.

![Karte „Leiste am Tablet“: Reihenfolge, Sichtbarkeit und Start-Reiter.](bild: seite=einstellungen; klick=[data-sec="tablet"]; ziel=.card:has(#toRows))

**Leiste am Tablet:** Die Module und Links in der Kopfzeile, von links nach rechts. Der Schalter „am Tablet zeigen“ wirkt sofort. Reihenfolge und **Start-Reiter** (öffnet sich beim Aufruf und nach 30 Sekunden ohne Eingabe) gelten nach **Speichern**.

**Darstellung am Tablet:** Wie das Gerät, Hell, Dunkel oder **Hoher Kontrast** (kräftige Ränder und stärkere Schrift, gut bei Sonnenlicht an der Theke). Gilt für alle Tablets.

**Links in der Kopfzeile:** Bis zu 8 eigene Links (Beschriftung und Adresse), die oben neben „Verwaltung“ erscheinen. Manche Seiten verbieten das Einbetten, dann bleibt der Bereich leer.

**Tablet & Home Assistant:** die Adresse des Tablets (`…:3100`) und der Hinweis auf die Kennzahlen für Home Assistant.

### Bereich „Module“ {#einstellungen-module}

![Eine Zeile der Modulliste: Beschreibung, Knöpfe „Anleitung (PDF)“ und „Demo“, Version, Status und Schalter.](bild: seite=einstellungen; klick=[data-sec="module"]; ziel=#modList .mrow:nth-child(4))

Alle Module mit Beschreibung, Version, Status und dem **Schalter „Aktiv“**. Aus heißt ausgeblendet; die Daten bleiben. Je Modul gibt es:
- **Anleitung (PDF):** öffnet die Anleitung des Moduls in einem neuen Tab. Das **„?“** oben rechts springt direkt an die passende Stelle.
- **Demo:** probiert das Modul mit erfundenen Beispieldaten in einem neuen Tab aus, getrennt von euren Daten und ohne etwas zu schalten oder zu senden. Es läuft nur eine Demo zugleich. Sie endet beim Schließen des Tabs, mit „Demo beenden“, nach 30 Minuten ohne Nutzung oder beim Neustart, und wird restlos gelöscht.
- **Einstellungen exportieren / importieren …:** nimmt die Einstellungen eines Moduls mit in eine andere Clubwerk-Installation (ohne PINs, Schlüssel und Daten).
- **⋯ Deinstallieren …:** löscht Modul und Daten, aber erst nach einer **Pflicht-Sicherung**, die ihr herunterladen müsst, und der Eingabe des Modulnamens. Mit **Installieren** kommt ein Modul später zurück, auf Wunsch mit den gesicherten Daten.
- **Erweiterung einspielen (ZIP) …:** lädt ein zusätzliches Modul hoch (nur mit allen Rechten). Es läuft erst nach „Prüfen & freigeben …“ mit eurem Passwort und einem Neustart, denn eine Erweiterung ist Programmcode.

### Bereich „Sprachen“ {#einstellungen-sprache}

![Karte „Sprachen“: vorhandene Sprachen und der Weg zu einer neuen.](bild: seite=einstellungen; klick=[data-sec="sprache"]; ziel=.card:has(#langBody))

Die Tabelle zeigt alle Sprachen mit Code, Herkunft und Vollständigkeit. Deutsch und Englisch sind dabei. Für **eine neue Sprache oder eine bessere Übersetzung**: Vorlage als JSON (für eine KI) oder Excel herunterladen, übersetzen lassen und mit **Datei importieren …** zurückspielen. Dasselbe geht, um einzelne Begriffe anzupassen (zum Beispiel „Spieler“ statt „Mitglieder“). Große Dateien dürfen in Teilen kommen.

### Bereich „Update“ {#einstellungen-update}

![Karte „Update von Clubwerk“.](bild: seite=einstellungen; klick=[data-sec="update"]; ziel=#updCard)

Nur mit allen Rechten. Die Karte zeigt die installierte Version, ein bereitliegendes Paket, das letzte Update und die Node.js-Version (mit Hinweis, wenn „Neu bauen“ in Home Assistant nötig ist). **ZIP-Paket hochladen …**: Clubwerk prüft das Paket und zeigt die Prüfsumme zum Vergleich mit `PRUEFSUMMEN.md`. Mit dem eigenen Passwort startet „Update auf … einspielen“, davor legt Clubwerk automatisch eine Sicherung an. Home Assistant baut danach die neue Version (2 bis 10 Minuten). Die alte Version bleibt als **Reserve**; **Zurück auf …** geht zurück, die Daten bleiben. Updates gehen nur, wenn die Verwaltung über die Home-Assistant-Seitenleiste offen ist.

### Seite „Mein Konto“ {#konto}

![Karte „Mein Passwort“.](bild: seite=konto; ziel=.card:has(#savePw))

Alles, was nur für euch gilt. Ihr erreicht die Seite über euren Namen unten im Menü.

- **Mein Passwort:** aktuelles und neues Passwort.

![Karte „Anzeige in diesem Browser“: Sprache und Darstellung.](bild: seite=konto; ziel=.card:has(#themeSel))

- **Anzeige in diesem Browser:** eure Sprache (Standard: wie der Verein) und die Darstellung: Wie das Gerät, Hell, Dunkel oder Hoher Kontrast. Gilt sofort und nur in diesem Browser.
- **Mein E-Mail-Absender** (mit dem Recht „Nachrichten“): Antwort-Adresse und Unterschrift für eure Nachrichten.

## Tablet und App {#tablet-app}

![Die Startseite „Für mich“ in der Mitglieder-App.](bild: app=start)

**Mitglieder-App:** Mit dem QR-Code und der PIN am Handy öffnet sich die App. Das Symbol oben (Profilbild) und „Mehr“ unten öffnen „Mein Konto“: Profilbild, Benachrichtigungen, Sprache, Darstellung, **PIN ändern** (mit der bisherigen PIN; sie gilt auch am Tablet) und **Abmelden** (entkoppelt nur dieses Handy; danach braucht es eine neue Einladung). Die App bleibt immer in sich und öffnet nie ein neues Fenster. Die Rubrik **Nachrichten** zeigt die Mitteilungen des Vereins: neueste zuerst, Ungelesenes fett, Angeheftetes oben.

![Das Blatt „Mein Konto“ in der App.](bild: app=mehr)

![Nachrichten in der Mitglieder-App.](bild: app=nachrichten)

**Tablet:** Das Tablet im Vereinsheim öffnet ihr im Browser unter der Tablet-Adresse (`…:3100`) und gebt einmal das Passwort für das Tablet ein. Danach bleibt das Gerät freigeschaltet. Oben zeigt die Kopfzeile die Module in der Reihenfolge, die ihr unter Einstellungen › Tablet festgelegt habt. Das Tablet kehrt nach 30 Sekunden ohne Eingabe zum Start-Reiter zurück, und jede Aktion mit Namen verlangt die Mitglieder-PIN. Wer noch keine PIN hat, legt sie beim ersten Mal am Tablet fest.

![Die Startseite des Tablets mit der Kopfzeile.](bild: tablet=start; hoehe=520)

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Einstellungen | Einstellungen, Datensicherung, Protokoll, Einrichtung, Update, Mitglieder-App (Adresse, Sicherheit, SMS, Push-Anlässe), Module ein- und ausschalten und Demo starten |
| Benutzer | Benutzer und Rollen verwalten (Seite „Benutzer & Rechte“) |
| Mitglieder-App einrichten (App) | Bereiche, Reiter, Benachrichtigungen und Name der App ändern; Adresse und Sicherheit nur mit „Einstellungen“ |
| Mitglieder anlegen & neue bestätigen (Konten) | Konten und PINs verwalten, Neueinträge vom Tablet bestätigen, Mitglieder in der App freischalten |
| Nachrichten (E-Mail) | Nachrichten an Mitglieder schreiben (E-Mail, App, Push) |
| Kontoauszug | Kontoauszüge einlesen und zuordnen (zusätzlich „Einzug“ bzw. „Buchhaltung“) |
| Module (Deinstallieren) | Module deinstallieren und wieder installieren (mit Pflicht-Sicherung) |

Das **Adminkonto** hat immer alle Rechte, ebenso Benutzer mit „Alle Rechte“. Das Sicherungspasswort, Sicherungsziele, Wiederherstellen und Updates darf nur ein Benutzer mit allen Rechten. „Mein Konto“ und die Übersicht stehen jedem angemeldeten Benutzer offen.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Alle Module** melden ihre Hinweise an die Übersicht, ihre Schritte an die Einrichtung, ihre Bereiche an die Mitglieder-App, ihre Anlässe an die Push-Liste, ihre Löschfristen an den Datenschutz, ihre Daten an die Auskunft und ihre Seiten an die Suche.
- **Mitglieder:** Mit der Mitgliederverwaltung entstehen Mitglieder nur dort. Nachrichten erreichen Gruppen und Abteilungen, Einladungen lesen die Adresse und Handynummer von dort, Abteilungsleitungen sehen nur ihre Abteilung. Der Kontoauszug ordnet Beiträge und Rücklastschriften zu.
- **Buchhaltung:** Der Kontoauszug ordnet auch Rechnungen zu; die Bankkonten gelten für beide.
- **Verkauf:** Die Konten und PINs am Tablet; ohne Mitgliederverwaltung sind die Konten selbst die Mitglieder.
- **Zugang und Beregnung:** Die Freischaltung in der App beachtet das Vereinsnetz. Ohne WLAN oder SMS-Bestätigung schalten sich beide erst im Vereins-WLAN frei.
