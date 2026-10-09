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
  alles. Anmeldung per **Passwort** (Konfiguration: Einstellungen → Programm →
  „Team & Zugang"). Crew-Positionen pflegen Admin und Meister (eigenes Gewerk)
  ebenfalls dort.
- **Alles speichert sofort**, dazu **Sicherungen** je Show (Show-Tab): von Hand oder
  automatisch vor dem Löschen, vor Updates und höchstens stündlich vor Änderungen.
  Auch gelöschte Shows lassen sich wiederherstellen.
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

Die Quelle ist eine Programm-Einstellung (Einstellungen → Programm →
Timecode-Eingang) und gilt unabhängig von der geladenen Show. Server-Quellen
(USB-MIDI, Art-Net, OSC, RTP-MIDI) startet der Server selbst — auch beim Booten,
mit den gespeicherten Ports, kein Browser nötig.
Der Status im TC-Input zeigt das **echte Signal** an (Gestoppt / Empfangsbereit /
Signal aktiv), nicht nur einen gebundenen Listener.

## Automatischer Showwechsel

Laufen mehrere Produktionen im Wechsel, kann der Tonstack die passende Show selbst
laden. Jede Show bekommt dafür im Show-Tab unter **„Automatisch laden durch"** einen
Auslöser; **„Auslöser lernen"** übernimmt den nächsten eingehenden Befehl, man muss
also keine Notennummer raten.

| Weg | Beispiel |
| --- | --- |
| **OSC** (UDP, Standard-Port 9001) | `/qlyst/show/load "SPOOKY"` · `/qlyst/show/SPOOKY` · `/qlyst/show/index 2` |
| **MIDI-Note** | Note On, z. B. Note 60 für Show A, 61 für Show B |
| **Programmwechsel** | Program Change 1 / 2 (DiGiCo-Macro, Zuspieler, Medienserver) |
| **HTTP** | `curl -X POST -H 'Content-Type: application/json' -d '{"show":"SPOOKY"}' http://<server>:3000/api/control/trigger` |

Der Steuer-Eingang läuft **unabhängig von der Timecode-Quelle** – ein Auslöser kommt
also auch an, wenn der Timecode per Art-Net hereinkommt. Einstellungen dazu:
**Einstellungen → Programm → Fernsteuerung** (Port, MIDI-Eingang, Status und die
zuletzt empfangenen Befehle zum Mitlesen beim Einrichten).

Drei Schutzmechanismen:

1. **Kein Wechsel, solange Timecode läuft** – ein Fehlsignal während der Vorstellung
   wird abgelehnt und im Protokoll vermerkt.
2. **Kein Wechsel**, wenn die Show bereits geladen ist.
3. **Entprellung**: kurz aufeinanderfolgende Befehle lösen nur einen Wechsel aus.

Beim automatischen Wechsel werden die Haken aller Aufgabenlisten zurückgesetzt, und
alle Geräte wechseln mit und zeigen kurz „Show gewechselt: …".

Hinweis: Die Schnittstelle hat keine Anmeldung – jedes Gerät im Netz kann solche
Befehle senden.

## Einstellungen: was gilt wo?

| Ebene | Gespeichert | Wer ändert | Inhalt |
| --- | --- | --- | --- |
| **Programm** | Server, `config.json` im Datenordner (nicht im Git) | Admin (Meister: eigene Crew-Positionen) | Timecode-Eingang inkl. Ports, Fernsteuerung, Passwörter, Crew-Positionen, aktive Show |
| **Show** | Server, `shows.json` (im Git) | Admin; Cues/Listen auch Meister/Positionen (gefiltert) | Name, Datum, Framerate, Auslöser für den automatischen Wechsel, Songs, Cues, Aufgabenlisten |
| **Dieses Gerät** | Browser (`localStorage`) | jede Person für sich | Anzeige, Schriftgröße, Cue-Vorschau, Show-Modus, Flash, Alarmton, Songliste, Anmeldung |

Tabs: **Live · Cues · Show · Einstellungen**. Der Show-Tab ist bei aktivem
Zugangsschutz dem Admin vorbehalten; „Einstellungen" sehen alle — Positionen und
Meister nur den Bereich „Dieses Gerät" (Meister zusätzlich die eigenen
Crew-Positionen).

Die aktive Show merkt sich der Server; lädt der Admin eine andere Show, wechseln
alle verbundenen Geräte automatisch mit.

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

Lokale Daten liegen nicht im Git-Ordner und werden daher durch Updates nicht
überschrieben:

```text
macOS: ~/Library/Application Support/TC Cue System/
Linux: ~/.tc-cue-system/

  shows.json       Shows (Cues, Songs, Aufgabenlisten)
  config.json      Programm-Einstellungen inkl. Passwörter
  backups/         Sicherungen (backups/shows/<Show-ID>/… je Show)
```

Beim ersten Start einer Version mit `config.json` übernimmt der Server
TC-Eingang, Passwörter und Crew-Positionen aus der ersten Show und entfernt sie
aus `shows.json` (damit auch aus dem Git).

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
lädt der Server die zuletzt aktive Show und öffnet die gespeicherte TC-Quelle
selbst — ein Browser ist dafür nicht erforderlich.

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
