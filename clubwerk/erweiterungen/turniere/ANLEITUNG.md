# Turniere
<!-- kurz: Clubmeisterschaft, LK-Turniertag und eigene Turniere wie das Dorfturnier – mit Auslosung, Spielplan, Ergebnissen und Monitor. -->

## Wofür ist das Modul? {#wofuer}

Das Modul „Turniere“ hat drei Teile, die ihr einzeln oder zusammen nutzt:

- **Clubmeisterschaft:** Das ganze Jahr über in Ligen (A, B, C …). Die Mitglieder melden sich in der Mitglieder-App an, ihr lost die Gruppen aus, sie vereinbaren ihre Spiele selbst und tragen die Ergebnisse ein. Am Ende kommen die Clubmeister in die Ehrentafel.
- **Turniertag:** Ein LK-Turnier aus nuLiga am Turniertag. Ihr importiert die Datei, checkt die Spieler ein, verteilt die Plätze und tragt die Ergebnisse ein.
- **Turnierplaner:** Eigene Turniere wie das Dorfturnier, für Tennis oder Fußball. Gruppen und Endrunde, jeder gegen jeden, K.-o. mit Setzliste oder Schleifchenturnier. Mit Spielplan, Tabellen und einem Monitor zum Aufhängen.

Alles läuft ohne Mitgliederverwaltung (die Namen kommen dann aus der Clubwerk-Liste oder werden frei eingetippt) und ohne das Modul „Plätze“ (dann gibt es keine Platzbuchung und keine Sperren).

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Turniere“ einschalten. Mit „Demo“ könnt ihr alles vorher mit erfundenen Daten ausprobieren.
2. **Recht vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer Turniere leiten soll, das Recht „Turniere“ (z. B. der Sportwart).
3. **Los geht es:** Für die Clubmeisterschaft auf der Seite „Clubmeisterschaft“ eine Saison anlegen. Für ein LK-Turnier auf „Turniertag“ die nuLiga-Dateien importieren. Für ein Dorfturnier auf „Turnierplaner“ ein neues Turnier anlegen.
4. **Optional:** Damit Links und QR-Codes für Spieler funktionieren, muss unter Mitglieder-App die Adresse der App eingetragen sein.

## Verwaltung {#verwaltung}

Im Menü gibt es drei Seiten: **Clubmeisterschaft**, **Turniertag** und **Turnierplaner**. Jede hat oben ihre Reiter.

### Seite „Clubmeisterschaft“ {#turniere}

Die Seite hat sechs Reiter: Übersicht, Teilnehmer, Spiele, Tabellen, Ehrentafel und Einstellungen. Unter dem Titel steht in einer Zeile, wo die Saison gerade steht (zum Beispiel „Gruppenphase bis 31.10.“). Gibt es noch keine Saison, legt ihr sie mit „+ Neue Saison“ an.

![Die sechs Reiter der Seite „Clubmeisterschaft“.](bild: seite=turniere; tab=uebersicht; ziel=#tuTabs .tabs)

### Reiter „Übersicht“ {#turniere-uebersicht}

Oben vier Kennzahlen: **Angemeldet**, **Offene Spiele**, **Überfällig** und **Gewertet**. Darunter die Karten.

![Die vier Kennzahlen der Übersicht.](bild: seite=turniere; tab=uebersicht; ziel=.kpis)

#### Nächster Schritt

Die Karte sagt, was jetzt zu tun ist, und hat den passenden Knopf dazu. Der Weg einer Saison:

1. **Anmeldung läuft:** Die Mitglieder melden sich in der App an. „Teilnehmer ansehen“ springt zum Reiter „Teilnehmer“.
2. **Auslosen:** „Einzel-Gruppen auslosen“, bei Doppel danach „Doppelpartner auslosen“ und „Doppel-Gruppen auslosen“.
3. **Gruppenphase:** Die Karte zählt, wie viele Spiele gewertet sind. Endrunde und Relegation setzt Clubwerk von selbst, sobald eine Liga fertig ist. Nach Fristende beendet ihr die Gruppenphase mit „Gruppenphase beenden …“. Offene Spiele zeigt Clubwerk vorher an. Was offen bleibt, gilt als ausgefallen und zählt nicht in der Tabelle.
4. **Saison abschließen …:** Am Ende. Vorher zeigt Clubwerk die Clubmeister, wer durch die Relegation die Liga wechselt und ob noch Spiele offen sind.

![Die Karte „Nächster Schritt“ mit dem Knopf für den aktuellen Schritt.](bild: seite=turniere; tab=uebersicht; ziel=[data-card="naechster"])

#### Überfällige Spiele

Erscheint nur, wenn Spiele nach ihrer Frist noch offen sind. Pro Zeile schickt die Glocke eine **Erinnerung** (Push in die App und E-Mail, wenn die Mitgliederverwaltung eine Adresse kennt). „Alle erinnern“ erinnert alle auf einmal.

#### Saison

Die Daten der Saison: Name, Ligen, Doppel-Ligen, Anmeldeschluss und die beiden Fristen. Mit „Saison bearbeiten“ ändert ihr sie. Sind mehrere Saisons vorhanden, wählt ihr oben rechts die Saison.

![Die Karte „Saison“ mit den Fristen.](bild: seite=turniere; tab=uebersicht; ziel=[data-card="saison"])

**„+ Neue Saison“** öffnet das Fenster zum Anlegen:

![Das Fenster „Neue Saison“.](bild: seite=turniere; tab=uebersicht; klick=#tuNew; ziel=dialog)

- **Name** und **Ligen:** Wie viele Ligen es gibt (A, B, C …).
- **Doppel-Ligen:** Je zwei benachbarte Einzel-Ligen bilden eine Doppel-Liga, vorgegeben ist „A+B, C+D“. Eine Liga allein (z. B. „E“) spielt mit Partnern aus der eigenen Liga. Leer lassen heißt: kein Doppel.
- **Anmeldeschluss, Frist Gruppenphase, Frist Endspiele + Relegation:** Bis dahin sollen die Spiele gespielt sein. Die Fristen sehen auch die Spieler in der App.
- **Einteilung übernehmen:** Gibt es eine abgeschlossene Saison, übernehmt ihr deren Einteilung samt Relegation: Der Sieger aus der unteren Liga steigt auf, der Verlierer aus der oberen ab. Angemeldet ist damit noch niemand; wer sich in der App anmeldet, behält seine Liga.

Bei einer bestehenden Saison gibt es im Bearbeiten-Fenster zusätzlich „Saison löschen“. Dabei verschwinden Anmeldungen, Gruppen, Spiele und Ergebnisse, gebuchte Plätze werden storniert.

### Reiter „Teilnehmer“ {#turniere-teilnehmer}

![Die Teilnehmerliste einer Liga mit Gruppe, Einzel/Doppel und Herkunft der Anmeldung.](bild: seite=turniere; tab=teilnehmer; klick=#tuLf [data-f="B"]; ziel=#tuTabs .card)

Oben stehen **Filter** (Alle, Angemeldet, je Liga) mit der Zahl der Personen. Die Liste zeigt **Name**, **Liga**, **Gruppe**, **Spielt** (Einzel und/oder Doppel) und **Eingetragen** (in der App, aus der Vorsaison, importiert oder von Hand).

- **Liga ändern:** Direkt in der Zeile in der Auswahl. Neu Angemeldete stehen in der untersten Liga; wer woanders hingehört, wird vor der Auslosung umgesetzt.
- **Einzel und Doppel:** Häkchen in der Zeile. Nach der Auslosung stehen sie als Text da.
- **Austragen:** Der Mülleimer am Zeilenende. Wer schon in einer Gruppe oder einem Paar ist, lässt sich nicht mehr austragen.

Die Knöpfe oben rechts:

- **+ Spieler eintragen:** Meldet ein Mitglied von Hand an (Namen suchen, Liga, Einzel/Doppel wählen). Das Fenster bleibt offen, damit ihr gleich mehrere eintragen könnt.
- **Import …:** Nur vor der Auslosung. Liest die Einteilung der Vorsaison aus Excel (.xlsx) oder CSV ein, damit nichts neu getippt werden muss. Gebraucht werden die Spalten „Name“ (oder „Vorname“ und „Nachname“) und „Liga“, oder je Liga ein Blatt namens „A“, „B1“ …. Gleiche Namen ordnet Clubwerk sicher zu, bei ähnlichen Namen fragt es nach und schlägt Mitglieder vor.

![Das Fenster „Spieler eintragen“.](bild: seite=turniere; tab=teilnehmer; klick=#tuAdd; ziel=dialog)

#### Auslosung Einzel

Jede Liga wird zufällig auf ihre Gruppen verteilt, gleich groß (± 1). Ab 6 Spielern gibt es zwei Gruppen, sonst eine. Alle bekommen eine Nachricht in der App. Danach gibt es:

- **Spieler tauschen …:** Zwei Spieler derselben Liga wechseln die Gruppe.
- **Liga neu auslosen …:** Lost eine Liga neu. Beides geht nur, solange in der Gruppe noch kein Spiel gewertet ist.

![Die Karte „Auslosung Einzel“.](bild: seite=turniere; tab=teilnehmer; klick=[data-card="auslosung"] h3; ziel=[data-card="auslosung"])

#### Doppel

Nur sichtbar, wenn es Doppel-Ligen gibt. Erst lost ihr die **Partner** aus: Jede Person aus der oberen Liga bekommt einen Partner aus der unteren. Wer übrig bleibt, steht unter „Ohne Partner“. Mit „Paar bilden …“ macht ihr daraus von Hand ein Paar (ein Dreier-Team gibt es nicht). Dann lost ihr die **Paare in Gruppen**. Bis dahin lässt sich ein Paar mit dem Mülleimer auflösen; „Partner neu losen …“ und „Doppel-Gruppen neu losen …“ wiederholen die Auslosung, solange noch nichts gespielt ist.

![Die Karte „Doppel“ mit den Paaren je Doppel-Liga.](bild: seite=turniere; tab=teilnehmer; klick=[data-card="doppel"] h3; ziel=[data-card="doppel"])

### Reiter „Spiele“ {#turniere-spiele}

Filter oben: **Offen**, **Überfällig**, **Gewertet** und **Alle**, je mit Zahl. Die Spalten: **Spiel**, **Runde** (z. B. „Gruppe A1“, „Halbfinale“, „Relegation A/B“), **Termin** (mit Uhrzeit und Platz oder die Frist) und **Ergebnis** (der Stand oder „offen“ bzw. „überfällig“). Auf die Zeile oder den Stift tippen, um ein Spiel zu öffnen:

![Das Fenster zum Eintragen oder Korrigieren eines Ergebnisses.](bild: seite=turniere; tab=spiele; klick=tr[data-sel]; ziel=dialog)

- **Wertung:** „Gespielt“ (Satz für Satz, z. B. 6:4 3:6 10:7), „Kampflos (w. o.)“ (dann wählt ihr den Gewinner), „Aufgabe“ (wer aufgegeben hat, plus der Stand) oder „Ausgefallen (zählt nicht)“.
- **Erinnerung schicken:** Erinnert beide Spieler, solange das Spiel offen ist.
- **Ergebnis löschen:** Das Spiel ist danach wieder offen.

Unmögliche Ergebnisse (6:5, 8:5, Match-Tiebreak 9:7 …) lehnt Clubwerk ab. Spieler können ihr Ergebnis nur einmal selbst eintragen; korrigieren könnt danach nur ihr. Ist die Saison abgeschlossen, lässt sich nichts mehr ändern.

> Die Tabelle rechnet wie die DTB-Vorlage: erst Siege, dann Satzdifferenz, dann Spieldifferenz, bei Gleichstand der direkte Vergleich. „Kampflos“ zählt 6:0 6:0, bei „Aufgabe“ bekommt der Sieger die fehlenden Spiele und Sätze.

### Reiter „Tabellen“ {#turniere-tabellen}

Alle Gruppentabellen, die Endrunde und die Relegation, so wie sie auch die Mitglieder sehen. Oben rechts steht **Drucken** für den Aushang am Schwarzen Brett.

- **Gruppentabellen** je Liga und Gruppe, bei Doppel je Doppel-Liga. Die Plätze, die weiterkommen, sind markiert.
- **Endrunde:** Im Einzel spielt nur die oberste Liga: Erster und Zweiter beider Gruppen spielen über Kreuz das Halbfinale, die Sieger das Finale, daraus wird der **Clubmeister**. Im Doppel hat jede Doppel-Liga ihre eigene Endrunde.
- **Relegation:** Der Letzte jeder Gruppe spielt gegen die Gruppensieger der Liga darunter, sobald beide Ligen fertig sind. Der Sieger bestimmt die Einteilung der nächsten Saison.

![Die beiden Gruppen einer Liga mit Tabellen. Wer weiterkommt, ist markiert.](bild: seite=turniere; tab=tabellen; ziel=.tabbody > div:nth-of-type(4))

![Die Endrunde der obersten Liga als Baum bis zum Clubmeister.](bild: seite=turniere; tab=tabellen; ziel=.tabbody > div:nth-of-type(2))

### Reiter „Ehrentafel“ {#turniere-ehrentafel}

![Die Ehrentafel mit Jahr, Titel und Clubmeistern.](bild: seite=turniere; tab=ehrentafel)

Hier stehen alle Clubmeister mit **Name**, **Jahr** und **Titel**. Beim Saisonabschluss trägt Clubwerk sie von selbst ein (diese Einträge lassen sich nicht löschen). Frühere Jahre aus der Zeit vor Clubwerk ergänzt ihr mit **+ Eintrag**:

![Das Fenster „Ehrentafel ergänzen“.](bild: seite=turniere; tab=ehrentafel; klick=#tuHon; ziel=dialog)

Jahr, Titel (z. B. „Clubmeister Einzel“ oder „Clubmeister Doppel A+B“) und Name(n). Eigene Einträge entfernt ihr mit dem Mülleimer.

### Reiter „Einstellungen“ {#turniere-einstellungen}

#### Platzbuchung

„Platz je Spiel“ legt fest, wie lange ein Platz für ein Spiel gebucht wird (1 bis 3 Stunden). Mit dem Modul „Plätze“ buchen die Spieler den Platz in der App. Die Buchung gilt als Vereinstermin: ohne Gebühr, ohne Kontingent und ohne Vorlauf, Öffnungszeiten, Sperren und belegte Plätze gelten weiter. Ohne das Modul „Plätze“ tragen sie nur Tag und Uhrzeit ein.

![Karte „Platzbuchung“.](bild: seite=turniere; tab=einstellungen; ziel=[data-card="platzbuchung"])

#### Einstellungen übertragen

Alle Einstellungen des Moduls (auch die von Turniertag und Turnierplaner) als Datei exportieren und in einer anderen Clubwerk-Installation importieren, ohne Saisons, Spieler und Ergebnisse.

![Karte „Einstellungen übertragen“.](bild: seite=turniere; tab=einstellungen; ziel=#tuFunc)

### Seite „Turniertag“ {#turniertag}

Für ein LK-Turnier. Der Ablauf: Dateien aus nuLiga importieren, Spieler einchecken, Plätze verteilen, Matches starten, Ergebnisse eintragen, am Ende das Turnier beenden. Sechs Reiter: Zentrale, Zeitplan, Check-in, Ergebnisse, Plätze und Einstellungen. Gibt es noch keinen Turniertag, steht dort der Knopf „nuLiga-Dateien importieren …“. Mehrere Turniere am selben Wochenende werden ein Turniertag. Gibt es mehrere Turniertage, wählt ihr oben rechts den Turniertag.

> In nuLiga exportiert ihr die XML-Datei je Turnier (Turnier-Export). Dazu könnt ihr die Meldeliste als CSV hinzunehmen, sie bringt die genaue LK und „bar“ als Zahlungsart. Übernommen werden nur Name, Verein, LK, Geschlecht, Geburtsjahr und die nuLiga-Nummern, keine Anschriften, E-Mails oder Telefonnummern.

### Reiter „Zentrale“ {#turniertag-zentrale}

![Die Turnierzentrale: jeder Platz mit laufendem und nächstem Match.](bild: seite=turniertag; tab=zentrale; ziel=.tl-courts)

Die Schaltzentrale am Turniertag. Oben **Laufend**, **Warteschlange**, **Gespielt** (von allen Matches) und **Größter Verzug**.

- **Platzkarten:** Je Platz das laufende Match (mit Spielzeit und Knopf „Ergebnis“) und das nächste mit voraussichtlicher Uhrzeit. „bereit“ heißt: Beide Spieler sind eingecheckt, nicht abwesend und nicht noch auf einem anderen Platz. Dann startet „Match starten“ das Match und hält die Startzeit fest. Rot markiert ist ein Match, das mehr als 15 Minuten über Plan liegt.
- **Warteschlange:** Matches ohne Platz. Der Stift öffnet das Match zum Zuweisen.

Oben rechts stehen die Knöpfe für den ganzen Turniertag:

- **Freie Plätze belegen:** Setzt bereite Matches auf freie Plätze, die für die automatische Verteilung freigegeben sind (Reiter „Plätze“).
- **Ursprüngliche Planung …:** Stellt für alle noch nicht begonnenen Matches Platz und Uhrzeit aus nuLiga wieder her. Gespielte und laufende Matches bleiben.
- **Neu einlesen …:** Für neue Dateien desselben Turniers, zum Beispiel nach einer Nachmeldung. Vorher zeigt Clubwerk, was sich ändert (neue und geänderte Spieler, geänderte Planung, entfallene Matches). Check-in, Zahlungen, Ergebnisse und eure Umplanungen bleiben.
- **+ Turniertag …:** Importiert einen weiteren Turniertag.

![Das Fenster „Erneut aus nuLiga importieren“.](bild: seite=turniertag; tab=zentrale; klick=#tlAgain; ziel=dialog)

Ein Klick auf ein Match öffnet das Match-Fenster:

![Das Match-Fenster: Platz und Uhrzeit ändern, starten oder das Ergebnis eintragen.](bild: seite=turniertag; tab=zentrale; klick=.tl-names; ziel=dialog)

- **Platz und Uhrzeit** ändern und mit „Speichern“ übernehmen. Ohne Platz kommt das Match in die Warteschlange.
- **Paarung festlegen …:** Für Folgerunden, bei denen nuLiga die Paarung noch nicht kennt. Ein neuer Import überschreibt die Paarung, solange das Match nicht gespielt ist.
- **Match starten** und **Start zurücknehmen**.
- **Ergebnis …** (bei gespielten Matches „Ergebnis ändern …“). Hier könnt ihr auch kampflos, Aufgabe und Korrekturen eintragen. Die Spieler selbst tragen ihr Ergebnis am Tablet nur einmal ein.

![Das Ergebnisfenster: Wertung und Sätze.](bild: seite=turniertag; tab=zentrale; klick=[data-res]; ziel=dialog)

### Reiter „Zeitplan“ {#turniertag-zeitplan}

![Der Zeitplan: je Platz eine Spalte, die rote Linie zeigt die Uhrzeit jetzt.](bild: seite=turniertag; tab=zeitplan)

Je Platz eine Spalte mit allen Matches nach Uhrzeit; die rote Linie zeigt „jetzt“. Läuft ein Match länger, rutschen die folgenden Matches desselben Platzes und derselben Spieler (mit Pause) nach hinten und sind markiert: gelb ab 5, rot ab 15 Minuten. Bei mehreren Tagen wählt ihr oben den Tag, am Handy Platz für Platz. Ein Klick auf ein Match öffnet das Match-Fenster.

### Reiter „Check-in“ {#turniertag-checkin}

![Check-in mit Kassenbericht, Suche und Filtern. Hier ist „Nicht bezahlt“ gewählt.](bild: seite=turniertag; tab=checkin; klick=#tlCf [data-f="unbezahlt"]; ziel=#tlTabs .tabbody)

Oben der **Kassenbericht** für das Nenngeld: gesamt, bar, digital und offen. Er läuft getrennt von der Verkaufskasse. Darunter **Suche** (Name oder Verein), **Sortierung** (Nachname, Startzeit oder LK) und Filter: Alle, Nicht eingecheckt, Eingecheckt, Abwesend, Nicht bezahlt. Die Spalten: **Name** (ein Zeitwunsch aus nuLiga, etwa „bitte nur vormittags“, ist markiert), **Verein**, **LK**, **Erstes Match** und **Status**. Das Häkchen am Zeilenende checkt sofort ein.

Ein Klick auf die Zeile öffnet die Spielerkarte:

![Die Spielerkarte mit Konkurrenzen, erstem Match, Check-in, Nenngeld und QR-Code.](bild: seite=turniertag; tab=checkin; klick=tr[data-p]; ziel=dialog)

- **Einchecken**, **Check-in zurücknehmen**.
- **Abwesend** und **Wieder da:** Wer abwesend ist, hält seine Matches an; sie warten, bis er wieder da ist.
- **Bar bezahlt**, **Digital bezahlt**, **Zahlung zurücknehmen** für das Nenngeld.
- **QR-Code der Spielerseite:** Zeigt den QR-Code für dieses Turnier (siehe „Tablet und App“).

Oben rechts druckt **QR-Codes drucken** die Codes aller Spieler auf einen Bogen zum Ausschneiden.

### Reiter „Ergebnisse“ {#turniertag-ergebnisse}

![Die Ergebnisliste je Konkurrenz und Runde.](bild: seite=turniertag; tab=ergebnisse; ziel=#tlTabs .card)

Alle Matches je Konkurrenz und Runde, in der Reihenfolge von nuLiga. So tippt ihr die Ergebnisse nach dem Turnier bequem in nuLiga ab. **Drucken** gibt die Liste aus; ein Klick auf eine Zeile öffnet das Match.

### Reiter „Plätze“ {#turniertag-plaetze}

![Die Plätze des Turniertags mit Zuordnung zum Buchungssystem.](bild: seite=turniertag; tab=plaetze; ziel=#tlTabs .card)

Die Plätze kommen aus den Platznamen in nuLiga. Pro Platz:

- **Platz im Buchungssystem:** Ordnet ihn einem Platz des Moduls „Plätze“ zu. Nur so kann Clubwerk ihn sperren.
- **Automatisch verteilen:** Nur Plätze mit „ja“ belegt „Freie Plätze belegen“ in der Zentrale.
- **+ Platz** legt weitere an, etwa „Halle Platz A“ für ein Turnier in einer fremden Halle. Solche Plätze sperren nichts. Von Hand angelegte Plätze entfernt der Mülleimer.

![Das Fenster „Platz anlegen“.](bild: seite=turniertag; tab=plaetze; klick=#tlAddC; ziel=dialog)

#### Sperre im Buchungssystem

Mit **Plätze sperren …** sperrt Clubwerk die zugeordneten Plätze für die Turniertage in der Zeit von/bis. Vorher zeigt es, welche Buchungen storniert würden; die Mitglieder bekommen Bescheid. **Sperre ändern …** und **Sperre aufheben** gibt es danach. Ohne das Modul „Plätze“ fehlt die Karte.

![Karte „Sperre im Buchungssystem“.](bild: seite=turniertag; tab=plaetze; ziel=[data-card="sperre"])

### Reiter „Einstellungen“ {#turniertag-einstellungen}

#### Zeitplan

„Dauer je Match“ (45 bis 120 Minuten) und „Pause zwischen zwei Matches“ (keine bis 60 Minuten). Daraus rechnet Clubwerk die voraussichtlichen Uhrzeiten.

![Karte „Zeitplan“.](bild: seite=turniertag; tab=einstellungen; ziel=[data-card="zeitplan"])

#### Datenschutz

Namen, Vereine und LK von Spielern fremder Vereine löscht Clubwerk nach der „Löschfrist“ (7 Tage bis 1 Jahr, vorgegeben 30 Tage) nach dem letzten Turniertag. Eigene Mitglieder (die Vereinsnummer des Veranstalters) bleiben. Die Frist steht auch unter Einstellungen › Datenschutz.

![Karte „Datenschutz“.](bild: seite=turniertag; tab=einstellungen; ziel=[data-card="datenschutz"])

#### Fernseher im Clubhaus

Die Adresse der Fernseher-Anzeige: Im Browser des Fernsehers öffnen (im Vereins-WLAN, einmal mit dem Tablet-Passwort freischalten). Sie zeigt am Turniertag alle Plätze, Verzug, Warteschlange und die letzten Ergebnisse und aktualisiert sich selbst. „Adresse kopieren“ legt sie in die Zwischenablage.

![Karte „Fernseher im Clubhaus“.](bild: seite=turniertag; tab=einstellungen; ziel=[data-card="fernseher"])

#### Turniertag

Hier ändert ihr den **Namen** des Turniertags und seht, aus welchen Dateien er importiert wurde. **Turnier beenden …** schließt den Tag ab: Die Spieler-Links gelten nicht mehr, Sperren im Buchungssystem fallen weg, Ergebnisse bleiben für die Ergebnisliste. **Turnier wieder öffnen** macht das rückgängig. **Turniertag löschen** entfernt Spieler, Check-in, Nenngeld und Ergebnisse und hebt Sperren auf.

![Karte „Turniertag“.](bild: seite=turniertag; tab=einstellungen; ziel=[data-card="turniertag"])

### Seite „Turnierplaner“ {#turnierplaner}

Für eigene Turniere wie das Dorfturnier, für Tennis oder Fußball. Zwei Reiter: **Turniere** (die Liste) und **Ehrentafel**. Jedes Turnier hat eine eigene Seite mit fünf Reitern (siehe unten).

### Reiter „Turniere“ {#turnierplaner-turniere}

![Die Liste der Turniere mit Tag, Art und Stand.](bild: seite=turnierplaner; tab=turniere)

Die Liste zeigt **Turnier**, **Tag** mit Beginn, **Art** (Sportart und Spielform) und **Stand**: noch nicht ausgelost, ausgelost, heute, nicht beendet oder beendet. Ein Klick auf die Zeile öffnet das Turnier. Mit **+ Neues Turnier** legt ihr eins an:

![Das Fenster „Neues Turnier“ mit der Vorschau, wie viele Gruppen und Spiele es werden und wann das Turnier endet.](bild: seite=turnierplaner; tab=turniere; klick=#ftNew; ziel=dialog)

- **Name**, **Sportart** (Tennis oder Fußball), **Spielform**, **Tag** und **Beginn**.
- **Plätze** bzw. **Spielfelder** und **Mannschaften (etwa):** Daraus rechnet Clubwerk schon im Fenster die Vorschau: Gruppen, Spiele und das voraussichtliche Ende.
- **Spielzeit** und **Pause** in Minuten. Die Sportart setzt sinnvolle Werte: Tennis 20 Minuten Spielzeit und 5 Minuten Pause, Fußball 12 und 3.
- **Gruppengröße** bei „Gruppen + Endrunde“, **Runden** beim Schleifchenturnier.

Die vier Spielformen:

| Spielform | So läuft es |
|---|---|
| Gruppen + Endrunde | Das klassische Dorfturnier. Die Gruppen entstehen aus der Zahl der Mannschaften, auch bei ungleichen Zahlen (z. B. 28 Mannschaften = vier Vierer- und vier Dreiergruppen, nie „Platz frei“). Danach spielen die Besten über Kreuz die Endrunde. |
| Jeder gegen jeden | Jede Mannschaft spielt einmal gegen jede. |
| K.-o. mit Setzliste | Gesetzte treffen spät aufeinander; fehlen Gegner, bekommen die Besten ein Freilos. |
| Schleifchenturnier | Je Runde neue Doppelpartner, die sich nicht wiederholen, solange es geht. Gezählt werden die gewonnenen Spiele je Person. |

### Reiter „Ehrentafel“ {#turnierplaner-ehrentafel}

![Die Ehrentafel der Turniere: Sieger, Zweiter und Dritter je Jahr.](bild: seite=turnierplaner; tab=ehrentafel)

Beim Beenden eines Turniers kommen Sieger, Zweiter und Dritter automatisch hierher, sortiert nach Jahr. **Drucken** gibt die Tafel aus.

### Ein Turnier öffnen {#turnier}

Ein Klick auf ein Turnier in der Liste öffnet seine Seite. Oben steht, wie es läuft („Tennis · Gruppen + Endrunde · Ende etwa 15:40 Uhr“), darüber führt „Alle Turniere“ zurück zur Liste. Die Reiter: Zentrale, Spielplan, Tabellen (beim Schleifchenturnier „Rangliste“), Mannschaften (beim Schleifchenturnier „Teilnehmer“) und Einstellungen. Ein typischer Ablauf: Mannschaften eintragen, im Spielplan auslosen, am Turniertag in der Zentrale starten, Ergebnisse eintragen, in den Einstellungen beenden.

### Reiter „Zentrale“ {#turnier-zentrale}

![Die Zentrale des Dorfturniers: jedes Spielfeld mit laufendem und nächstem Spiel.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=zentrale; ziel=#ftCentral)

Wie beim Turniertag: oben **Laufend**, **Gespielt**, **Größter Verzug** und **Ende etwa**; darunter jedes Spielfeld mit dem laufenden Spiel (mit Restzeit, die von selbst herunterzählt) und dem nächsten. Ein Warnhinweis zeigt Gleichstände, die nur ein Los entscheidet. Mit **Los ziehen** lost Clubwerk die Reihenfolge aus und schreibt es ins Protokoll.

- **Nächste Spiele starten:** Startet auf jedem freien Platz das nächste Spiel.
- **Nachrücken:** Ist ein Platz früher frei, kommt das nächste bereite Spiel nach vorne. Läuft ein Spiel länger, rutschen die folgenden nach hinten.
- **Spiel öffnen** (Klick auf die Paarung): Platz und Uhrzeit ändern, starten, Start zurücknehmen oder das Ergebnis eintragen.

![Das Fenster zum Eintragen des Ergebnisses: Tore bzw. Spiele und bei Gleichstand im K.-o. Neunmeterschießen oder Tiebreak.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=zentrale; klick=[data-res]; ziel=dialog)

Das Ergebnis tragen **nur ihr** ein (hier oder am Tablet mit dem Code der Turnierleitung), nicht die Mannschaften. Bei Fußball sind Unentschieden möglich; im K.-o. entscheidet bei Gleichstand das Neunmeterschießen (Tennis: Tiebreak bis 7), das nicht für Tabellen zählt. Bei Wertung auf Sätze gibt es wie bei der Clubmeisterschaft auch „Kampflos“ und „Aufgabe“.

### Reiter „Spielplan“ {#turnier-spielplan}

**Vor der Auslosung** zeigt der Reiter die Karte „Auslosung“: eine Vorschau, wie viele Gruppen und Spiele es werden, und den Knopf **Auslosen**. Mit „Mit Setzliste“ bekommt jede Gruppe einen Gesetzten.

![Der Spielplan vor der Auslosung (Schleifchenturnier): Vorschau und Knopf „Auslosen“.](bild: seite=turnierplaner/turnier/2; tabkey=detail_turnier; tab=spielplan)

**Nach der Auslosung** steht hier jedes Spiel nach Uhrzeit mit **Zeit**, **Spielfeld**, **Runde**, **Spiel** und **Ergebnis**. Filter: Alle, Offen, Gespielt. Niemand spielt zweimal hintereinander; die Gruppen verteilen sich über die Plätze.

Knöpfe oben rechts (solange noch nicht gespielt wird):

- **Tauschen …:** Zwei Mannschaften aus verschiedenen Gruppen wechseln die Gruppe; Spielfelder und Uhrzeiten bleiben.
- **Neu auslosen …:** Gruppen, Paarungen und Zeitplan entstehen neu.
- **Zeitplan neu berechnen:** Nach geänderten Zeiten.
- Läuft das Turnier schon, steht dort **Ursprünglicher Spielplan …**: Alle Spiele, die noch nicht begonnen haben, gehen zurück auf Platz und Uhrzeit aus der Auslosung.
- **Drucken** gibt den Spielplan für den Aushang aus.

### Reiter „Tabellen“ {#turnier-tabellen}

![Eine Gruppentabelle mit Spielen, Siegen, Toren, Differenz und Punkten.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=tabellen; ziel=.ft-groups > .card:first-child)

Die Gruppentabellen und die Endrunde (beim K.-o.-Turnier der Turnierbaum, beim Schleifchenturnier die **Rangliste**). Die Tabelle zählt Punkte, dann Differenz, dann mehr Tore bzw. Spiele, dann den direkten Vergleich, zuletzt das Los. Diese Reihenfolge ist in den Einstellungen änderbar. Die Endrunde füllt sich von selbst, sobald eine Gruppe fertig ist, und die Sieger rücken automatisch vor. Ein Klick auf ein Spiel im Baum öffnet es. Ist das Turnier beendet, steht oben die Karte „Sieger“. **Drucken** gibt alles aus.

![Die Endrunde als Turnierbaum.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=tabellen; ziel=.ft-tree)

### Reiter „Mannschaften“ {#turnier-mannschaften}

![Die Teilnehmer eines Schleifchenturniers vor der Auslosung, oben rechts „Import …“ und „+ Teilnehmer“.](bild: seite=turnierplaner/turnier/2; tabkey=detail_turnier; tab=mannschaften; ziel=#main .tabbody)

Die Liste zeigt **Mannschaft**, **Spieler**, **Gruppe** (vor der Auslosung die **Setzliste**) und **Status** („da“ oder „offen“, bei Startgeld auch bar, digital oder offen). Ist ein Startgeld eingestellt, stehen oben die Kennzahlen **Startgeld gesamt**, **Bar**, **Digital** und **Offen** (eigener Kassenbericht).

Knöpfe oben rechts, vor der Auslosung:

- **+ Mannschaft** (beim Schleifchenturnier „+ Teilnehmer“): Name, Setzliste (Gesetzte treffen im K.-o. spät aufeinander) und freiwillig die Spieler, je Zeile einer, auch Gäste. Nach dem Speichern öffnet sich gleich das Fenster für die nächste.
- **Import …:** Excel oder CSV. Eine Spalte mit den Namen genügt (Kopfzeile „Name“ oder „Mannschaft“, sonst die erste Spalte); weitere Spalten werden als Spieler übernommen. Schon vorhandene Namen erkennt Clubwerk.
- **QR-Codes drucken:** Druckt für jede Mannschaft einen QR-Code, mit dem sie ihr Spiel aufs Handy bekommt.

![Das Fenster „Teilnehmer eintragen“ (bei Mannschaften mit Setzliste und Spielern).](bild: seite=turnierplaner/turnier/2; tabkey=detail_turnier; tab=mannschaften; klick=#ftAdd; ziel=dialog)

Ein Klick auf eine vorhandene Mannschaft öffnet dasselbe Fenster: Name und Spieler ändern, **Ist da** und **Nicht mehr da**, Startgeld **bar** oder **digital** bezahlt, **QR-Code** und **Entfernen** (nur vor der Auslosung). Nach der Auslosung lassen sich Mannschaften nur noch umbenennen. Nachtragen geht nach „Auslosung aufheben …“ (Einstellungen), solange noch kein Ergebnis steht.

### Reiter „Einstellungen“ {#turnier-einstellungen}

Hier steht alles Weitere. Ist das Turnier beendet, sind die Felder gesperrt, bis ihr es wieder öffnet.

#### Turnier

Name, Tag, Beginn, **Spätestes Ende** (ist das voraussichtliche Ende später, warnt Clubwerk), **Startgeld** je Mannschaft bzw. Person (leer = kein Startgeld) und die **Spielform**. Die Sportart ist festgelegt.

![Karte „Turnier“.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; ziel=[data-card="turnier"])

#### Spielzeit und Wertung

Alles lässt sich einzeln ändern: Spielzeit, Pause, Pause nach der Vorrunde und zwischen den K.-o.-Runden, Punkte für Sieg, Unentschieden und Niederlage, Bezeichnung (Platz, Spielfeld oder Feld), Wertung (auf Zeit mit Tore bzw. Spiele oder auf Sätze), Gleichstand im K.-o. (Tiebreak bis 7, Neunmeterschießen oder keiner), Gruppengröße, wie viele je Gruppe weiterkommen, Spiel um Platz 3 und die **Reihenfolge bei Gleichstand** (mit Pfeilen sortieren; das Los steht immer zuletzt). Ändert sich die Zeit, bevor gespielt wird, rechnet Clubwerk den Zeitplan neu.

![Karte „Spielzeit und Wertung“.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; ziel=[data-card="spielzeit"])

#### Plätze

Namen der Plätze bzw. Spielfelder ändern, mit „+ Platz“ weitere anlegen oder unbenutzte entfernen. Mit dem Modul „Plätze“ könnt ihr jeden einem Platz des Buchungssystems zuordnen (frei = sperrt nichts, z. B. eine Halle).

![Karte „Plätze“.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; ziel=[data-card="plaetze"])

#### Sperre im Buchungssystem

Wie beim Turniertag: Die zugeordneten Plätze werden von/bis gesperrt, vorher seht ihr die Buchungen, die storniert würden.

![Karte „Sperre im Buchungssystem“.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; klick=[data-card="sperre"] h3; ziel=[data-card="sperre"])

#### Monitor zum Aufhängen

Ein Link ohne Anmeldung, nur zum Ansehen. Im Browser des Fernsehers öffnen: Die Anzeige wechselt selbst zwischen laufenden Spielen mit Restzeit, nächsten Spielen, Tabellen, Turnierbaum und letzten Ergebnissen, groß lesbar, hell oder dunkel. Am Handy steht alles untereinander. **Adresse kopieren**, **QR-Code** und **Link erneuern …** (macht den alten Link und gedruckte QR-Codes ungültig). Der Link braucht die Adresse der Mitglieder-App.

#### Code der Turnierleitung

Ergebnisse tragen nur die Turnierleitung ein, hier in der Verwaltung oder am Tablet. Am Tablet fragt Clubwerk dafür diesen Code ab (4 bis 6 Ziffern). Mit **Code festlegen** vergebt ihr ihn, **Code entfernen** nimmt ihn zurück. Der Code wird nicht wieder angezeigt, also merken! Ohne Code geht am Tablet nur Ansehen.

![Karte „Code der Turnierleitung“.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; klick=[data-card="code"] h3; ziel=[data-card="code"])

#### Abschluss

- **Auslosung aufheben …:** Löscht Gruppen, Spiele und Zeitplan, solange noch nichts gespielt wurde. Danach könnt ihr Mannschaften nachtragen und neu auslosen.
- **Turnier beenden …:** Vorher seht ihr die Platzierungen und offene Spiele. Danach kommen Sieger, Zweiter und Dritter in die Ehrentafel, die Sperre fällt weg und Ergebnisse sind gesperrt. **Wieder öffnen** hebt das auf.
- **Turnier löschen:** Entfernt Mannschaften, Spielplan und Ergebnisse.

![Karte „Abschluss“.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; klick=[data-card="abschluss"] h3; ziel=[data-card="abschluss"])

## Tablet und App {#tablet-app}

![Der Reiter „Turniere“ am Tablet: heutiger Turniertag, Plätze und Tabellen.](bild: tablet=Turniere; hoehe=620)

![Der Bereich „Turniere“ in der Mitglieder-App: Dein nächstes Spiel und Meine Spiele.](bild: app=turniere)

**Am Tablet** (Reiter „Turniere“, ohne PIN) sieht man die Tabellen, die Endrunde und die Relegation der Clubmeisterschaft und die Ehrentafel. Am Turniertag erscheint darüber, was heute läuft:

- **LK-Turniertag:** „Einchecken“ (Namen suchen, einchecken und Nenngeld bar oder digital bezahlen), „Ergebnis eintragen“ (Match antippen, Sätze eingeben; ein Ergebnis lässt sich am Tablet nur einmal eintragen, Kampflos und Aufgabe trägt ihr in der Verwaltung ein) und die Plätze: antippen zeigt das laufende und das nächste Match zum Starten.
- **Dorfturnier und andere freie Turniere:** Plätze mit laufendem und nächstem Spiel, Tabellen und Turnierbaum zum Ansehen. „Ergebnis eintragen“ und „Nächste Spiele starten“ gehen nur mit dem **Code der Turnierleitung** (Ziffernblock); er gilt auf dem Tablet 15 Minuten nach der letzten Eingabe.

**In der Mitglieder-App** (Bereich „Turniere“, für alle Mitglieder sichtbar, solange eine Saison existiert):

- **Anmelden:** Während der Anmeldung steht oben „Ich spiele mit“, bei Doppel mit Häkchen für Einzel und Doppel, mit „Anmeldung ändern“ oder „Abmelden“ später. Nur Mitglieder spielen mit.
- **Dein nächstes Spiel** als große Karte, darunter **Meine Spiele** mit Stand: offen, Termin oder überfällig. Die Reiter „Meine Spiele“, „Tabellen“ und „Endrunde“ zeigen auch Relegation und Ehrentafel.
- **Termin wählen:** Auf das Spiel tippen, Tag wählen, dann eine freie Zeit (mit „Plätze“ wird der Platz für beide gebucht, sonst trägt man nur die Uhrzeit ein). „Verlegen“ ändert dieselbe Buchung, „Termin absagen“ storniert sie. Der Gegner bekommt jedes Mal Bescheid und lässt sich direkt anrufen oder anschreiben (wenn die Mitgliederverwaltung eine Nummer kennt).
- **Ergebnis eintragen:** Satz für Satz, dazu „Kampflos“ und „Aufgabe“. Eintragen kann einer der Spieler, korrigieren nur der Sportwart.
- **Für mich:** Anstehende Spiele, „Ergebnis eintragen“, „Termin vereinbaren“ und offene Anmeldungen erscheinen auch unter „Für mich“.
- **Benachrichtigungen:** neues Spiel ausgelost, Frist in 7 Tagen, Ergebnis eingetragen, Spieltermin vereinbart, Erinnerung vom Sportwart. Jedes Mitglied schaltet sie einzeln in der App.

**Ohne App und Konto:**

- **Spielerseite beim LK-Turnier:** Der QR-Code vom Check-in öffnet eine Seite nur zum Ansehen mit dem nächsten Match (wann, wo, gegen wen), dem Ablauf des eigenen Platzes und den eigenen Ergebnissen. Sie gilt nur für dieses Turnier und bis zu seinem Ende.
- **Mannschaftsseite im Dorfturnier:** Der QR-Code einer Mannschaft zeigt ihre Spiele, die Tabelle und die Endrunde.
- **Monitor und Fernseher:** Siehe „Fernseher im Clubhaus“ (Turniertag) und „Monitor zum Aufhängen“ (Turnierplaner).

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Turniere | Die Seiten „Clubmeisterschaft“, „Turniertag“ und „Turnierplaner“ sehen und bearbeiten: Saisons, Auslosungen, Ergebnisse, Check-in, Turniere anlegen, Einstellungen ändern |

Mitspielen darf jedes Mitglied, das die App nutzt. Am Tablet braucht man für das Ansehen nichts, für Ergebnisse im Dorfturnier den Code der Turnierleitung.

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Plätze:** Spieler der Clubmeisterschaft buchen ihren Platz direkt aus der App (als Vereinstermin, ohne Gebühr und Kontingent). Bei Turniertag und Turnierplaner sperrt Clubwerk Plätze für die Turnierzeit und storniert dabei Buchungen mit Nachricht an die Mitglieder. Verlegt oder storniert die Platzverwaltung eine Buchung, zieht das Spiel mit.
- **Mitglieder:** Für Namen, Telefonnummer des Gegners und E-Mail-Erinnerungen. In der Datenauskunft eines Mitglieds stehen seine Anmeldungen und Spiele, beim Zusammenführen doppelter Mitglieder wandern sie mit. In der Mitglieder-Übersicht steht, wo jemand angemeldet ist oder offene Spiele hat.
- **Start- und Übersichtsseite:** Zeigt offene Turnierspiele und weist darauf hin, wenn die Anmeldung vorbei ist (Gruppen auslosen) oder Spiele überfällig sind.
- **Benachrichtigungen und Mitglieder-App:** Push-Nachrichten und der Bereich in der App. Die Adresse der App wird für QR-Codes und den Monitor gebraucht.
- **Datenschutz:** Die Löschfristen (Spieler fremder Vereine beim Turniertag, Spielernamen im Turnierplaner) und das Verzeichnis der Verarbeitungstätigkeiten stehen unter Einstellungen › Datenschutz.
