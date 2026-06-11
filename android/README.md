# TC Cue – Android App

Android-Gegenstück zur iOS-App: zeigt den laufenden Timecode, die aktuelle
Show-Position und Letzter/Aktueller/Nächster Cue live vom TC-Cue-Server.

## Features

- **Live-Ansicht** – laufender Timecode im Header, Position mit
  Fortschrittsbalken, komplette scrollbare Cue-Liste; bei Cue-Wechsel
  scrollt die Liste automatisch zum aktuellen Cue; Cue gedrückt halten
  zeigt Details (loslassen blendet sie wieder aus)
- **Vibrationsalarm** bei jedem Cue-Fire — auch bei ausgeschaltetem
  Display (Foreground Service hält die Verbindung)
- **Live-Update-Notification** (Android 16+): aktueller Cue mit
  Show-Fortschritt als promoted Notification; auf Samsung One UI 8.5
  als Now-Bar-/Live-Karte
- **mDNS-Discovery** – findet Server im Netzwerk automatisch
  (`_tccue._tcp`); Kandidaten werden per `/api/health` verifiziert,
  damit veraltete mDNS-Caches keine falschen IPs anzeigen
- **Auto-Reconnect** mit exponentiellem Backoff; sofortiger Reconnect,
  wenn die App in den Vordergrund kommt
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
