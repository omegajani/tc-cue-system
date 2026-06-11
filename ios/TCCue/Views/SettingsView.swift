import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var client: TCWSClient

    @State private var serverURL: String = TCWSClient.defaultServerURL
    @State private var pingResult: String? = nil
    @State private var pinging = false
    @StateObject private var discovery = BonjourDiscovery()

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
                    LabeledContent("Timecode") {
                        Text(client.currentTc)
                            .font(.system(.body, design: .monospaced))
                            .foregroundStyle(client.connectionState == .connected ? .green : .secondary)
                    }
                    if let error = client.lastError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
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
            .onChange(of: serverURL) { _, _ in pingResult = nil }
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
        guard let url = healthURL else {
            pingResult = "✗ Ungültige URL"
            pinging = false
            return
        }
        var request = URLRequest(url: url, timeoutInterval: 5)
        request.timeoutInterval = 5
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                pinging = false
                if let error {
                    pingResult = "✗ Nicht erreichbar: \(error.localizedDescription)"
                    return
                }
                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode),
                      let data,
                      let health = try? JSONDecoder().decode(HealthResponse.self, from: data),
                      health.ok
                else {
                    pingResult = "✗ Kein TC-Cue-Server unter dieser Adresse"
                    return
                }
                let state = health.state == "running" ? "Timecode läuft" : "Timecode gestoppt"
                pingResult = "✓ Server erreichbar · \(state) · \(health.tc)"
            }
        }.resume()
    }

    private var healthURL: URL? {
        var address = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        address = address.replacingOccurrences(of: "ws://", with: "http://")
        address = address.replacingOccurrences(of: "wss://", with: "https://")
        if !address.hasPrefix("http://") && !address.hasPrefix("https://") {
            address = "http://" + address
        }
        guard var components = URLComponents(string: address) else { return nil }
        components.path = "/api/health"
        components.query = nil
        components.fragment = nil
        return components.url
    }

    private func saveAndConnect() {
        UserDefaults.standard.set(serverURL, forKey: "serverURL")
        pingServer()
        Task { @MainActor in
            client.onCueFire = { [weak client] cue, next in
                HapticManager.alarm()
                WatchBridge.shared.send(cue: cue, nextCue: next, event: "fire")
                LiveActivityManager.shared.update(
                    cue: cue, nextCue: next,
                    currentTc: client?.currentTc ?? "--:--:--:--"
                )
            }
            client.connect(serverURL: serverURL)
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

private struct HealthResponse: Codable {
    let ok: Bool
    let tc: String
    let state: String
    let fps: Double
}
