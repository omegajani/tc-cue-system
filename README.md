# QLyst — Timecode- & Cue-System

Browserbasiertes Timecode- und Cue-System für Bühnenproduktionen (Repository:
`tc-cue-system`). Der Server empfängt Timecode aus verschiedenen Quellen und
verteilt Cues, Songpositionen und Aufgabenlisten in Echtzeit per WebSocket an
alle Geräte im lokalen Netzwerk — vom FOH-Rechner bis zum Handy auf der Bühne.

## Funktionen

- **Echtzeit-Timecode** im ganzen Netzwerk (WebSocket), große TC-Anzeige, Cue-Liste
  mit Vorschau und Countdown.
- **Cues & Songpositionen** pro Show, inkl. Show-Reset-Cue und Aufgabenlisten
  (an Cue oder Uhrzeit gekoppelt).
- **Rollenbasierte Ansichten**: jedes Gewerk (Licht/Ton/Bühne/Regie/Video) und
  jede Crew-Position (z. B. Ton → FOH/Monitor/Radioraum) sieht nur die eigenen
  Cues. **Meister** sehen alle Cues ihres Gewerks, **Admin** sieht und bearbeitet
  alles. Anmeldung per **Passwort** (Konfiguration: Show-Tab → „Zugriff / Passwörter").
  Crew-Positionen pflegen Meister/Admin im Edit-Tab.
- **Songliste/Playlist** (Desktop, optional einblendbar) — rahmenlose
  Teleprompter-Ansicht, die zeigt, wo in der Show man sich befindet.
- **Mehrere TC-Quellen** (siehe unten), inkl. **browserunabhängiger** Empfang
  direkt im Server → headless/Autostart-tauglich.
- **Mobil-freundlich** inkl. iOS-Home-Screen-Icon (Web-App „Zum Home-Bildschirm").

## Unterstützte Timecode-Quellen

| Quelle | Hinweis |
| --- | --- |
| Simulator | in der Web-App, mit Transport (Start/Pause/Stop/Seek) |
| Browser-LTC | Audio-Eingang dekodiert LTC im Browser |
| Browser-MTC | Web MIDI im Browser |
| USB-MIDI (Server) | MTC direkt vom USB-Interface, **ohne Browser** |
| Art-Net | ArtTimeCode (UDP 6454) |
| OSC | `/tc`, `/timecode`, … (UDP) |
| RTP-MIDI / AppleMIDI | Netzwerk-MIDI |

Server-Quellen (USB-MIDI, Art-Net, OSC, RTP-MIDI) starten beim Booten automatisch,
wenn sie als Quelle der geladenen Show gespeichert sind — kein Browser nötig.
Der Status im TC-Input zeigt das **echte Signal** an (Gestoppt / Empfangsbereit /
Signal aktiv), nicht nur einen gebundenen Listener.

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

| Datei (macOS) | Linux | Funktion |
| --- | --- | --- |
| `Install.command` | `Install.sh` | Installiert alle benötigten Pakete |
| `Start.command` | `Start.sh` | Startet den Server und öffnet die Web-App |
| `Stop.command` | `Stop.sh` | Stoppt den Server |
| `Update.command` | `Update.sh` | Sichert Shows, lädt Updates von GitHub und installiert sie |

Falls macOS eine `.command`-Datei beim ersten Mal blockiert: Rechtsklick auf die
Datei, **Öffnen** wählen und bestätigen.

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
macOS: ~/Library/Application Support/TC Cue System/shows.json
Linux: ~/.tc-cue-system/shows.json
```

Automatische Sicherungen vor Updates liegen im Unterordner `backups`.

### Show-Daten im Repo (automatischer Abgleich)

Damit alle Rechner dieselbe Show haben, wird `server/data/shows.json` versioniert
mitgeführt. Git-Hooks (`core.hooksPath = .githooks`, von `Install` gesetzt) gleichen
beim Commit (live → Repo) und beim Pull (Repo → live, „neuestes gewinnt" per
Zeitstempel) automatisch ab. Schreibvorgänge erfolgen atomar; eine beschädigte
`shows.json` wird gesichert statt überschrieben.

## Manuell starten

```bash
cd server
npm ci
npm start
```

Die Web-App ist anschließend unter [http://localhost:3000](http://localhost:3000)
erreichbar. Andere Geräte im gleichen Netzwerk verwenden die im Bereich
**Einstellungen > Netzwerk** angezeigte Adresse (zusätzlich Auffindung per Bonjour
`_tccue._tcp`).

### Produktion / Autostart (Linux, headless)

Im Dauerbetrieb läuft der Server als systemd-User-Dienst (`tc-cue-system`); der
`post-merge`-Hook startet ihn nach einem `git pull` automatisch neu. Beim Start
lädt der Server die erste Show und öffnet die gespeicherte TC-Quelle selbst —
ein Browser ist dafür nicht erforderlich.

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

Danach auf GitHub einen Pull Request öffnen.

### Prüfung

```bash
cd server
npm run dev        # Server mit Auto-Reload
npm run typecheck  # TypeScript prüfen (tsc --noEmit)
```

## Projektstruktur

```text
server/       Node.js-Server (TypeScript): Cue-Engine, TC-Eingänge, API, WebSocket
web-ui/       Browser-Oberfläche (eine index.html) inkl. App-Icon
scripts/      Installation, Start/Stop, Updates, Show-Abgleich (sync-show.mjs)
.githooks/    pre-commit / post-merge für den Show-Abgleich
ios/, android/  native Projekt-Gerüste für spätere Weiterentwicklung
```
