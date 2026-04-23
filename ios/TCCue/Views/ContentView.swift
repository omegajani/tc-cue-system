import SwiftUI

struct ContentView: View {
    @EnvironmentObject var client: TCWSClient

    var body: some View {
        TabView {
            LiveView()
                .tabItem { Label("Live", systemImage: "dot.radiowaves.left.and.right") }
            SettingsView()
                .tabItem { Label("Einstellungen", systemImage: "gear") }
        }
        .tint(.green)
    }
}
