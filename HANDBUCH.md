# Handbuch – TC Cue System

Dieses Handbuch beschreibt die wichtigsten Schritte für Installation, Start und
Bedienung des TC Cue Systems.

## 1) Installation auf einem Mac

1. Repository klonen:

   ```bash
   git clone https://github.com/omegajani/tc-cue-system.git
   cd tc-cue-system
   ```

2. Installation starten:

   ```bash
   ./Install.command
   ```

3. Falls macOS die Datei beim ersten Start blockiert: Rechtsklick auf
   `Install.command`, dann **Öffnen** wählen und bestätigen.

## 2) Programm starten und stoppen

- Start: `Start.command`
- Stop: `Stop.command`
- Update: `Update.command`

Nach dem Start ist die Web-Oberfläche standardmäßig unter
`http://localhost:3000` erreichbar.

## 3) Mit anderen Geräten verbinden

1. Auf dem Server die Web-App öffnen.
2. Zu **Einstellungen > Netzwerk** wechseln.
3. Die dort angezeigte Netzwerkadresse auf den anderen Geräten verwenden.

Wichtig: Alle Geräte müssen im selben Netzwerk sein.

## 4) Grundbedienung in der Web-App

1. Show auswählen oder anlegen.
2. Songs und Cues verwalten.
3. Timecode-Quelle auswählen (z. B. Simulator, LTC, MTC/MIDI, RTP-MIDI, OSC).
4. Cues live verfolgen bzw. auslösen.

## 5) Screenshot der Oberfläche

![TC Cue System – Beispielansicht](./Bildschirmfoto%202026-04-23%20um%2014.01.18.png)

