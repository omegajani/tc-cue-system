import Foundation
import Network

struct DiscoveredServer: Identifiable, Equatable {
    let id: String
    let name: String
    let host: String
    let port: Int
    var url: String { "\(host):\(port)" }
}

@MainActor
final class BonjourDiscovery: ObservableObject {
    @Published var servers: [DiscoveredServer] = []

    private var browser: NWBrowser?

    func start() {
        let params = NWParameters()
        params.includePeerToPeer = true
        browser = NWBrowser(for: .bonjour(type: "_tccue._tcp", domain: "local."), using: params)

        browser?.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor in
                self?.handle(results)
            }
        }
        browser?.start(queue: .main)
    }

    func stop() {
        browser?.cancel()
        browser = nil
        servers = []
    }

    private func handle(_ results: Set<NWBrowser.Result>) {
        if results.isEmpty { servers = []; return }

        var discovered: [DiscoveredServer] = []
        for result in results {
            // Read IP and port directly from the TXT record — no NWConnection resolution needed
            guard case .bonjour(let txtRecord) = result.metadata else { continue }
            let dict = txtRecord.dictionary
            guard let ip = dict["ip"], !ip.isEmpty,
                  let portStr = dict["port"], let port = Int(portStr)
            else { continue }

            let server = DiscoveredServer(
                id: "\(ip):\(port)",
                name: "TC Cue System",
                host: ip,
                port: port
            )
            discovered.append(server)
        }

        if !discovered.isEmpty {
            servers = discovered
        }
    }
}
