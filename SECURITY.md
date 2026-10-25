# Sicherheit

## Eine Sicherheitslücke melden

Bitte **nicht** als öffentliches Issue melden. Stattdessen auf GitHub im Reiter **Security → Report a vulnerability** eine vertrauliche Meldung anlegen. Hilfreich sind: betroffene Version, Oberfläche (Verwaltung, Tablet, Mitglieder-App, Beregnung), Schritte zum Nachstellen und mögliche Folgen. Geschlossene Lücken stehen im `clubwerk/CHANGELOG.md`.

Unterstützt wird nur die jeweils neueste Version (siehe `PRUEFSUMMEN.md`).

## Grundsätze

- **Lokal zuerst.** Clubwerk läuft als Home-Assistant-Add-on im Vereinsnetz und braucht kein Internet. Von außen erreichbar ist höchstens die Mitglieder-App, wenn der Verein das ausdrücklich einrichtet (z. B. per Tunnel). Verwaltung, Tablet und Beregnung sind nur aus dem Vereinsnetz erreichbar.
- **Verschlüsselt gespeichert.** Persönliche Daten (Adressen, Kontakt-, Geburts- und Bankdaten, Dokumente, Fotos) liegen auf der Festplatte nur verschlüsselt. Komplettsicherungen sind immer verschlüsselt. Passwörter und PINs werden nur als Hash gespeichert.
- **Keine Geheimnisse in Exporten.** Exporte und Sicherungen enthalten keine PINs, Passwörter oder Schlüssel.
- **Prüfbare Pakete.** Jede Version hat eine Prüfsumme in `PRUEFSUMMEN.md`. Die Verwaltung zeigt sie beim Update zum Vergleich an.
- In diesem Repository liegen keine Passwörter oder Vereinsdaten.
