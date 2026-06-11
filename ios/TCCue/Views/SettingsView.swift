import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var client: TCWSClient
    @AppStorage("serverURL") private var serverURL = TCWSClient.defaultServerURL
    @AppStorage("hapticsEnabled") private var hapticsEnabled = true
    @AppStorage("screenFlashEnabled") private var screenFlashEnabled = true
    @AppStorage("liveActivityEnabled") private var liveActivityEnabled = true

    @StateObject private var discovery = BonjourDiscovery()
    @State private var testResult: TestResult?
    @State private var isTesting = false

    var body: some View {
        NavigationStack {
            Form {
                connectionSection

                if !discovery.servers.isEmpty {
                    discoveredServersSection
                }

                feedbackSection
                statusSection
            }
            .navigationTitle("Einstellungen")
            .onAppear {
                discovery.start()
            }
            .onDisappear {
                discovery.stop()
            }
            .onChange(of: serverURL) { _, _ in
                testResult = nil
            }
        }
    }

    private var connectionSection: some View {
        Section("Server") {
            TextField("192.168.1.10:3000", text: $serverURL)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

            Button {
                connect()
            } label: {
                Label("Verbinden", systemImage: "link")
            }
            .disabled(serverURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Button {
                testConnection()
            } label: {
                Label(isTesting ? "Teste Verbindung..." : "Verbindung testen", systemImage: "bolt.horizontal")
            }
            .disabled(isTesting || serverURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            if let testResult {
                Label(testResult.message, systemImage: testResult.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(testResult.success ? .green : .red)
            }
        }
    }

    private var discoveredServersSection: some View {
        Section("Im Netzwerk gefunden") {
            ForEach(discovery.servers) { server in
                Button {
                    serverURL = server.url
                    connect()
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(server.name)
                                .foregroundStyle(.primary)
                            Text(server.url)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private var feedbackSection: some View {
        Section("Cue-Feedback") {
            Toggle("Haptisches Feedback", isOn: $hapticsEnabled)
            Toggle("Bildschirmflash", isOn: $screenFlashEnabled)
            Toggle("Live Activity", isOn: $liveActivityEnabled)
        }
    }

    private var statusSection: some View {
        Section("Status") {
            LabeledContent("Verbindung") {
                Text(statusText)
                    .foregroundStyle(statusColor)
            }

            LabeledContent("Timecode") {
                Text(client.currentTc)
                    .font(.body.monospaced())
                    .monospacedDigit()
            }

            if client.connectionState != .disconnected {
                Button("Verbindung trennen", role: .destructive) {
                    client.disconnect()
                }
            }

            if let error = client.lastError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
    }

    private var statusText: String {
        switch client.connectionState {
        case .connected: "Verbunden"
        case .connecting: "Verbindet..."
        case .disconnected: "Getrennt"
        }
    }

    private var statusColor: Color {
        switch client.connectionState {
        case .connected: .green
        case .connecting: .yellow
        case .disconnected: .red
        }
    }

    private func connect() {
        let value = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        serverURL = value
        client.connect(serverURL: value)
    }

    private func testConnection() {
        guard let url = healthURL else {
            testResult = TestResult(success: false, message: "Ungültige Server-Adresse")
            return
        }

        isTesting = true
        testResult = nil
        var request = URLRequest(url: url)
        request.timeoutInterval = 5

        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                isTesting = false
                guard error == nil,
                      let response = response as? HTTPURLResponse,
                      response.statusCode == 200,
                      let data,
                      let health = try? JSONDecoder().decode(HealthResponse.self, from: data),
                      health.ok
                else {
                    testResult = TestResult(success: false, message: "Server nicht erreichbar")
                    return
                }

                testResult = TestResult(success: true, message: "Server erreichbar - \(health.tc)")
            }
        }.resume()
    }

    private var healthURL: URL? {
        var address = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        address = address.replacingOccurrences(of: "ws://", with: "http://")
        address = address.replacingOccurrences(of: "wss://", with: "https://")
        if !address.hasPrefix("http://") && !address.hasPrefix("https://") {
            address = "http://\(address)"
        }
        guard var components = URLComponents(string: address) else { return nil }
        components.path = "/api/health"
        components.query = nil
        components.fragment = nil
        return components.url
    }
}

private struct TestResult {
    let success: Bool
    let message: String
}

private struct HealthResponse: Codable {
    let ok: Bool
    let tc: String
}
