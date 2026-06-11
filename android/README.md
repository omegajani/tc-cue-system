# TC Cue – Android App

Android-Gegenstück zur iOS-App: zeigt den laufenden Timecode, die aktuelle
Show-Position und Letzter/Aktueller/Nächster Cue live vom TC-Cue-Server.

## Features

- **Live-Ansicht** – Timecode, Position mit Fortschrittsbalken, Cue-Liste
  (letzter / aktueller / nächster Cue) im gleichen Look wie die iOS-App
- **Vibrationsalarm** bei jedem Cue-Fire
- **mDNS-Discovery** – findet Server im Netzwerk automatisch (`_tccue._tcp`)
- **Auto-Reconnect** mit exponentiellem Backoff
- Display bleibt während der Show an

## Build

Voraussetzungen: JDK 17+, Android SDK (Pfad in `local.properties`).

```bash
cd android
./gradlew assembleDebug
```

APK liegt danach unter `app/build/outputs/apk/debug/app-debug.apk`.

Installieren per ADB:

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Verbindung

1. Server starten (`Start.command` bzw. `npm run dev` im `server/`-Ordner)
2. App öffnen → **Einstellungen**
3. Gefundenen Server antippen oder URL manuell eingeben (`<server-ip>:3000`)
4. **Verbinden**

Handy und Server müssen im selben Netzwerk sein.
