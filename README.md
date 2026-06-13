# TC Cue System

Browserbasiertes Timecode- und Cue-System für Bühnenproduktionen. Die Web-App
verwaltet Shows, Songs, Cues und Aufgabenlisten und zeigt den laufenden
Timecode im lokalen Netzwerk an.

## Auf einem neuen Mac oder Linux installieren

Benötigt werden:

- macOS oder Linux
- [Git](https://git-scm.com/) (ist mit den Xcode Command Line Tools verfügbar)
- [Node.js 18 oder neuer](https://nodejs.org/)
- Zugriff auf dieses GitHub-Repository

Im Terminal:

```bash
git clone https://github.com/omegajani/tc-cue-system.git
cd tc-cue-system
./Install.command
```

Danach kann die App über die Start-Skripte bedient werden:

| Datei | Funktion |
| --- | --- |
| `Install.command` | Installiert alle benötigten Pakete |
| `Start.command` | Startet den Server und öffnet die Web-App |
| `Stop.command` | Stoppt den Server |
| `Update.command` | Sichert Shows, lädt Updates von GitHub und installiert sie |

Falls macOS eine `.command`-Datei beim ersten Mal blockiert: Rechtsklick auf die
Datei, **Öffnen** wählen und bestätigen.

Unter Linux stehen dafür die entsprechenden `.sh`-Skripte zur Verfügung:

| Datei | Funktion |
| --- | --- |
| `Install.sh` | Installiert alle benötigten Pakete |
| `Start.sh` | Startet den Server und öffnet die Web-App |
| `Stop.sh` | Stoppt den Server |
| `Update.sh` | Sichert Shows, lädt Updates von GitHub und installiert sie |

## Updates

Für normale Updates genügt ein Doppelklick auf `Update.command` (macOS) oder
`./Update.sh` (Linux).

Das Update:

1. bricht sicher ab, wenn lokale Code-Änderungen noch nicht gesichert sind,
2. legt eine Sicherung der Shows an,
3. lädt die aktuelle Version vom derzeit verwendeten Git-Branch,
4. installiert geänderte Pakete,
5. startet die Web-App erneut, falls sie vorher lief.

Lokale Shows liegen nicht im Git-Ordner und werden daher durch Updates nicht
überschrieben:

```text
~/Library/Application Support/TC Cue System/shows.json
~/.tc-cue-system/shows.json
```

Automatische Sicherungen vor Updates liegen im Unterordner `backups`.

## Gemeinsam entwickeln

Vor der Arbeit den aktuellen Stand laden:

```bash
git pull --ff-only
```

Änderungen anschließend auf einem eigenen Branch veröffentlichen:

```bash
git switch -c name/meine-aenderung
git add .
git commit -m "Kurze Beschreibung"
git push -u origin name/meine-aenderung
```

Danach auf GitHub einen Pull Request öffnen. So können Änderungen geprüft und
zusammengeführt werden, ohne den stabilen Stand direkt zu verändern.

## Manuell starten

```bash
cd server
npm ci
npm start
```

Die Web-App ist anschließend unter [http://localhost:3000](http://localhost:3000)
erreichbar. Andere Geräte im gleichen Netzwerk verwenden die im Bereich
**Einstellungen > Netzwerk** angezeigte Adresse.

## Entwicklung und Prüfung

```bash
cd server
npm run dev
npm run typecheck
```

## Projektstruktur

```text
server/       Node.js-Server, Cue-Engine, API und WebSocket
web-ui/       Browser-Oberfläche
scripts/      Installation, Start, Stop, Updates und lokale Hilfsskripte
ios/          iOS- und watchOS-Projekte für spätere Weiterentwicklung
```

## Unterstützte Timecode-Quellen

- Simulator in der Web-App
- Browser-LTC
- Browser-MTC / Web MIDI
- RTP-MIDI
- OSC
