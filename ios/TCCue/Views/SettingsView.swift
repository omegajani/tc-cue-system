import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var client: TCWSClient

    @State private var serverURL: String = UserDefaults.standard.string(forKey: "serverURL") ?? ""
    @State private var role: String = UserDefaults.standard.string(forKey: "role") ?? "all"
    @State private var pingResult: String? = nil
    @State private var pinging = false
    @StateObject private var discovery = BonjourDiscovery()

    private let roles = ["all", "buehne", "licht", "ton", "regie"]
    private let roleLabels = ["all": "Alle", "buehne": "Bühne", "licht": "Licht", "ton": "Ton", "regie": "Regie"]

    var body: some View {
        NavigationStack {
            Form {
                // ── Server ───────────────────────────────────────────────
                // ── Bonjour Discovery ────────────────────────────────────
                if !discovery.servers.isEmpty {
                    Section {
                        ForEach(discovery.servers) { server in
                            Button {
                                serverURL = server.url
                                saveAndConnect()
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(server.name)
                                            .foregroundStyle(.primary)
                                        Text(server.url)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if serverURL == server.url {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.green)
                                    }
                                }
                            }
                        }
                    } header: {
                        Label("Im Netzwerk gefunden", systemImage: "antenna.radiowaves.left.and.right")
                    }
                }

                // ── Manuell ──────────────────────────────────────────────
                Section {
                    HStack {
                        Text("Server-URL")
                        Spacer()
                        TextField("192.168.1.x:3000", text: $serverURL)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.URL)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                            .foregroundStyle(.secondary)
                    }

                    Picker("Rolle", selection: $role) {
                        ForEach(roles, id: \.self) { r in
                            Text(roleLabels[r] ?? r).tag(r)
                        }
                    }
                } header: {
                    Text("Verbindung")
                }

                // ── Connect / Disconnect ─────────────────────────────────
                Section {
                    if client.connectionState == .connected {
                        Button(role: .destructive) {
                            client.disconnect()
                        } label: {
                            Label("Trennen", systemImage: "xmark.circle")
                        }
                    } else {
                        Button {
                            saveAndConnect()
                        } label: {
                            Label(
                                client.connectionState == .connecting ? "Verbinde…" : "Verbinden",
                                systemImage: "network"
                            )
                        }
                        .disabled(serverURL.isEmpty)
                    }

                    Button {
                        pingServer()
                    } label: {
                        Label(pinging ? "Teste…" : "Verbindung testen", systemImage: "bolt.horizontal")
                    }
                    .disabled(serverURL.isEmpty || pinging)

                    if let result = pingResult {
                        Text(result)
                            .font(.caption)
                            .foregroundStyle(result.hasPrefix("✓") ? .green : .red)
                    }
                }

                // ── Status ───────────────────────────────────────────────
                Section {
                    LabeledContent("Status") {
                        Text(statusLabel)
                            .foregroundStyle(statusColor)
                    }
                    LabeledContent("Server") {
                        Text(client.serverURL.isEmpty ? "–" : client.serverURL)
                            .foregroundStyle(.secondary)
                    }
                    LabeledContent("Rolle") {
                        Text(roleLabels[client.role] ?? client.role)
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Status")
                }

                // ── Network hint ─────────────────────────────────────────
                Section {
                    NetworkHintView()
                } header: {
                    Text("Netzwerk")
                }
            }
            .navigationTitle("Einstellungen")
            .navigationBarTitleDisplayMode(.large)
            .onAppear { discovery.start() }
            .onDisappear { discovery.stop() }
        }
    }

    private var statusLabel: String {
        switch client.connectionState {
        case .connected: return "Verbunden"
        case .connecting: return "Verbinde…"
        case .disconnected: return "Getrennt"
        }
    }

    private var statusColor: Color {
        switch client.connectionState {
        case .connected: return .green
        case .connecting: return .yellow
        case .disconnected: return .red
        }
    }

    private func pingServer() {
        pinging = true
        pingResult = nil
        var base = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if !base.hasPrefix("http") { base = "http://" + base }
        guard let url = URL(string: base + "/api/health") else {
            pingResult = "✗ Ungültige URL"
            pinging = false
            return
        }
        var request = URLRequest(url: url, timeoutInterval: 5)
        request.timeoutInterval = 5
        URLSession.shared.dataTask(with: request) { data, resp, err in
            DispatchQueue.main.async {
                pinging = false
                if let err {
                    pingResult = "✗ \(err.localizedDescription)"
                } else if let data, let json = try? JSONDecoder().decode([String: Bool].self, from: data), json["ok"] == true {
                    pingResult = "✓ Server erreichbar"
                } else {
                    pingResult = "✗ Unerwartete Antwort"
                }
            }
        }.resume()
    }

    private func saveAndConnect() {
        UserDefaults.standard.set(serverURL, forKey: "serverURL")
        UserDefaults.standard.set(role, forKey: "role")
        Task { @MainActor in
            client.onCueFire = { [weak client] cue, next in
                HapticManager.fireCue(alertType: cue.alertType)
                WatchBridge.shared.send(cue: cue, nextCue: next, event: "fire")
                LiveActivityManager.shared.update(
                    cue: cue, nextCue: next,
                    currentTc: client?.currentTc ?? "--:--:--:--",
                    isWarning: false, warningSeconds: 0
                )
            }
            client.onCueWarning = { [weak client] cue, sec in
                HapticManager.warnCue()
                WatchBridge.shared.send(cue: cue, nextCue: nil, event: "warning", secondsUntil: sec)
                LiveActivityManager.shared.update(
                    cue: client?.currentCue, nextCue: cue,
                    currentTc: client?.currentTc ?? "--:--:--:--",
                    isWarning: true, warningSeconds: sec
                )
            }
            client.connect(serverURL: serverURL, role: role)
        }
    }
}

// Fetches and displays the server's LAN IPs
struct NetworkHintView: View {
    @State private var urls: [String] = []

    var body: some View {
        Group {
            if urls.isEmpty {
                Text("Server-URL aus dem Browser-Einstellungs-Panel kopieren.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Verfügbare Server-URLs:")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ForEach(urls, id: \.self) { url in
                        Text(url)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.green)
                    }
                }
            }
        }
        .onAppear { fetchNetworkInfo() }
    }

    private func fetchNetworkInfo() {
        // Try common local addresses
        let stored = UserDefaults.standard.string(forKey: "serverURL") ?? ""
        guard !stored.isEmpty else { return }
        var base = stored
        if !base.hasPrefix("http") { base = "http://" + base }
        guard let url = URL(string: base + "/api/network") else { return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data,
                  let json = try? JSONDecoder().decode(NetworkResponse.self, from: data)
            else { return }
            DispatchQueue.main.async { urls = json.urls }
        }.resume()
    }

    struct NetworkResponse: Codable {
        let urls: [String]
    }
}
