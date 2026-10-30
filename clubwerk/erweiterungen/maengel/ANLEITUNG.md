# Mängel
<!-- kurz: Mitglieder melden Defekte auf der Anlage mit Foto – ihr arbeitet sie ab. -->

## Wofür ist das Modul? {#wofuer}

Mitglieder melden kaputte oder gefährliche Dinge auf der Anlage: ein gerissenes Netz, einen tropfenden Wasserhahn, eine lose Linie. Sie tun das in der Mitglieder-App oder am Tablet, mit Ort, kurzer Beschreibung und bis zu drei Fotos. In der Verwaltung seht ihr alle Meldungen auf einen Blick, weist sie jemandem zu, antwortet dem Melder und setzt den Status. Wer schon gemeldet wurde, wird nicht doppelt gemeldet.

Das Modul läuft allein. Ohne die Mitgliederverwaltung melden nur Konten, die in der App angemeldet sind; ohne Plätze gibt es nur die Orte, die ihr selbst anlegt.

## Einrichten {#einrichten}

1. **Einstellungen › Module:** Schalter bei „Mängel“ einschalten. Mit „Demo“ könnt ihr das Modul vorher mit erfundenen Daten ausprobieren.
2. **Recht vergeben:** Unter Einstellungen › Benutzer & Rechte bekommt, wer Meldungen bearbeiten soll, das Recht „Mängel“ (z. B. der Platzwart).
3. **Orte anlegen:** Reiter „Einstellungen“ › „Orte“ (siehe unten). Das ist alles; Mitglieder sehen den Bereich „Mängel“ sofort in der App.

## Verwaltung {#verwaltung}

Die Seite „Mängel“ hat oben drei Reiter: **Offen**, **Erledigt** und **Einstellungen**.

### Seite „Mängel“ {#maengel}

![Die Seite „Mängel“ mit dem Reiter „Offen“: links die Meldung, rechts Datum, Status und Zuständiger.](bild: seite=maengel; tab=offen)

Der Reiter ganz links zeigt in Klammern, wie viele Meldungen noch offen sind. Dringende Meldungen tragen eine rote Markierung.

### Reiter „Offen“ {#maengel-offen}

Die Liste zeigt je Meldung ein Vorschaubild, den Ort, die ersten Zeilen der Beschreibung und die Spalten **Gemeldet** (Datum, Uhrzeit und Melder), **Auch gemeldet** (so oft haben weitere Mitglieder „Ja, das ist es“ gesagt), **Status** und **Zuständig**.

- **Sortieren:** „Neueste zuerst“, „Dringende zuerst“ oder „Am häufigsten gemeldet“. So seht ihr, was den Mitgliedern wichtig ist.
- **Meldung öffnen:** auf die Zeile oder den Stift am Zeilenende tippen.

![Die geöffnete Meldung: Fotos, Beschreibung, Status, Zuständiger, Antwort und interne Notiz.](bild: seite=maengel; tab=offen; klick=tr[data-sel]; ziel=dialog)

In der geöffneten Meldung seht ihr die Fotos (antippen für die Großansicht) und die Beschreibung. Darunter stellt ihr ein:

- **Status:** Neu, In Arbeit, Erledigt oder Abgelehnt (z. B. bei einer doppelten Meldung).
- **Zuständig:** wer sich kümmert. Zur Auswahl stehen alle Benutzer mit dem Recht „Mängel“.
- **Antwort an den Melder:** erscheint in der Mitglieder-App und geht als Mitteilung aufs Handy. Auch alle, die „Ja, das ist es“ gesagt haben, bekommen sie.
- **Interne Notiz:** sehen nur Benutzer mit dem Recht „Mängel“.

„Speichern“ übernimmt alles. „Meldung löschen“ entfernt die Meldung samt Fotos endgültig; für erledigte Meldungen ist das nicht nötig, sie verschwinden nach der eingestellten Frist von selbst.

> Wer eine Meldung nur auf „Erledigt“ setzt, hält die Liste sauber und der Melder wird informiert. Löschen solltet ihr nur Unsinn oder Testmeldungen.

### Reiter „Erledigt“ {#maengel-erledigt}

![Der Reiter „Erledigt“ mit abgeschlossenen und abgelehnten Meldungen.](bild: seite=maengel; tab=erledigt)

Hier liegen erledigte und abgelehnte Meldungen mit dem Abschlussdatum. Sie lassen sich wie offene Meldungen öffnen und ändern, z. B. wenn ein Fehler zurückkommt. Oben steht, nach wie vielen Monaten sie samt Fotos gelöscht werden.

### Reiter „Einstellungen“ {#maengel-einstellungen}

Der Reiter besteht aus vier Karten.

#### Orte

Aus dieser Liste wählen Mitglieder beim Melden. „+ Ort hinzufügen“ legt einen neuen an, mit den Pfeilen sortiert ihr, „Entfernen“ löscht ihn aus der Liste. Ist das Modul „Plätze“ aktiv, stehen dessen Plätze und Geräte automatisch vor euren Orten. „Anderer Ort“ mit eigenem Text ist immer dabei. Danach „Speichern“.

![Karte „Orte“: eigene Orte anlegen, sortieren und entfernen.](bild: seite=maengel; tab=einstellungen; ziel=[data-card="orte"])

#### Benachrichtigungen

Bei neuen Meldungen bekommen alle Benutzer mit dem Recht „Mängel“ eine Push-Nachricht, wenn ihr Konto mit einem Mitglied verknüpft ist und dieses Mitglied Benachrichtigungen in der App eingeschaltet hat. Zusätzlich lässt sich E-Mail einschalten (an die Adresse des verknüpften Mitglieds) und eine Liste weiterer Empfänger eintragen, getrennt mit Komma, z. B. die Adresse des Hausmeisters.

![Karte „Benachrichtigungen“: E-Mail und weitere Empfänger.](bild: seite=maengel; tab=einstellungen; ziel=[data-card="benachrichtigungen"])

#### Aufbewahrung

„Erledigte Meldungen löschen nach“ … Monaten (Standard 12). Gelöscht wird die ganze Meldung mit allen Fotos, auch abgelehnte. Offene Meldungen bleiben immer.

![Karte „Aufbewahrung“: Frist in Monaten.](bild: seite=maengel; tab=einstellungen; ziel=[data-card="aufbewahrung"])

#### Einstellungen übertragen

Orte und Einstellungen als Datei exportieren und in einer anderen Clubwerk-Installation importieren (ohne Meldungen und Fotos). Beim Import werden gleichnamige Einträge (ohne Groß-/Kleinschreibung) aktualisiert, neue angelegt, nichts wird gelöscht. Die Meldung nennt je Art, wie viele neu und wie viele aktualisiert wurden.

## Tablet und App {#tablet-app}

![Das Meldeformular in der Mitglieder-App.](bild: app=maengel; klick=#mgNew)

![Der Reiter „Mängel“ am Tablet.](bild: tablet=Mängel; hoehe=430)

**In der App** (Bereich „Mängel“) wählt das Mitglied den Ort, beschreibt das Problem, hängt bis zu drei Fotos an (Kamera oder Galerie; Ortsdaten werden entfernt) und kann „Dringend“ ankreuzen, z. B. bei Verletzungsgefahr. Gibt es zum selben Ort schon offene Meldungen, fragt die App „Ist es eine davon?“. Bei „Ja, das ist es“ wird nichts doppelt gemeldet, sondern „auch gemeldet“ hochgezählt. Unter „Meine Meldungen“ sieht das Mitglied Status und Antwort des Vereins.

**Am Tablet** (Reiter „Mängel“) wählt man den Namen, gibt die Mitglieder-PIN ein und meldet genauso. Ohne PIN geht es nicht.

## Rechte {#rechte}

| Recht | Was es erlaubt |
|---|---|
| Mängel | Meldungen sehen und bearbeiten, Push bei neuen Meldungen, Orte und Einstellungen ändern |

Melden darf jeder, der die Mitglieder-App nutzt, auch Konten ohne Mitglied (z. B. Trainer).

## Zusammenspiel mit anderen Modulen {#zusammenspiel}

- **Plätze:** Deren Plätze und Geräte erscheinen automatisch als Orte.
- **Mitglieder:** Der Melder erscheint als „Nachname, Vorname“; in der Datenauskunft eines Mitglieds stehen seine Meldungen, beim Zusammenführen doppelter Mitglieder gehen sie mit. Austritte löschen Meldungen nicht, die Aufbewahrungsfrist gilt weiter.
- **Datenschutz:** Die Aufbewahrungsfrist erscheint auch in Einstellungen › Datenschutz.
