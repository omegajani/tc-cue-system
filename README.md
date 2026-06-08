# TC Cue System

Theater-Timecode-basiertes Cue-System für Bühnenproduktionen. Ein Node.js-Server empfängt Timecode (LTC, MTC, RTP-MIDI, OSC oder Simulator), feuert Cues automatisch zum richtigen TC-Zeitpunkt und sendet diese per WebSocket an verbundene iOS-Clients.

![App Screenshot](Bildschirmfoto%202026-04-23%20um%2014.01.18.png)

## Komponenten

```
tc-cue-system/
├── server/        Node.js + TypeScript — TC-Ingestion, Cue-Engine, WebSocket-Broker
├── web-ui/        Browser-Oberfläche — Show- und Cue-Verwaltung, Simulator
├── ios/           Xcode-Projekt
│   ├── TCCue          iOS-App (Verbindung, Live-Ansicht, Einstellungen)
│   ├── TCCueWatch     watchOS-Begleit-App
│   └── TCCueWidget    Live Activity / Dynamic Island
```

## Server

### Voraussetzungen

- Node.js 18+

### Starten

```bash
cd server
npm install
npm run dev      # Entwicklung (hot reload)
npm start        # Produktion
```

Server läuft auf **Port 3000**. Web-UI erreichbar unter `http://localhost:3000`.

### TC-Quellen

| Quelle | Beschreibung |
|--------|-------------|
| Simulator | Im Web-UI steuerbar (Start / Pause / Stop / Seek) |
| LTC (Browser) | Browser dekodiert LTC-Audio, POST an `/api/tc/browser-tick` |
| MTC (Web MIDI) | Browser empfängt MTC via Web MIDI API, POST an `/api/tc/midi-tick` |
| RTP-MIDI | Direkt am Server über Netzwerk-MIDI |
| OSC | OSC-Timecode-Input |

### API-Endpunkte (Auswahl)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/api/simulator/start` | TC starten (optional `{ tc }`) |
| `POST` | `/api/simulator/stop` | TC stoppen + Engine reset |
| `POST` | `/api/simulator/pause` | TC pausieren |
| `POST` | `/api/simulator/seek` | Zu TC-Position springen `{ tc }` |
| `POST` | `/api/engine/reset` | Gefeuerte Cues zurücksetzen |
| `POST` | `/api/engine/fps` | FPS setzen `{ fps: 24|25|29.97|30 }` |
| `GET`  | `/api/health` | Serverstatus |

### WebSocket-Events

```jsonc
// Server → Client
{ "type": "TC_UPDATE", "tc": "01:00:10:00", "currentCue": {...}, "nextCue": {...} }
{ "type": "CUE_FIRE",  "tc": "...", "cue": {...}, "previousCue": {...}, "nextCue": {...} }
{ "type": "CUE_WARNING", "tc": "...", "cue": {...}, "secondsUntil": 10 }
```

## iOS-App

### Voraussetzungen

- Xcode 16+
- iOS 17+ Gerät
- Apple Developer Account

### Bauen & Installieren

1. `ios/TCCue.xcodeproj` in Xcode öffnen
2. Team in den Signing-Einstellungen aller Targets setzen
3. **TCCue**-Schema wählen, Gerät auswählen, bauen

### Features

- **Bonjour-Discovery** — Server im lokalen Netzwerk automatisch finden
- **Live-Ansicht** — aktueller Cue, nächster Cue, laufender TC
- **Live Activity / Dynamic Island** — Cue-Info auf dem Sperrbildschirm
- **Haptisches Feedback** bei neuen Cues
- **watchOS-App** — Cue-Info und Haptik am Handgelenk
