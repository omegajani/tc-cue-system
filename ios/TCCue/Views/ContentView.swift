import SwiftUI

struct ContentView: View {
    @State private var selection = 0

    var body: some View {
        TabView(selection: $selection) {
            LiveView()
                .tag(0)
                .tabItem {
                    Label("Live", systemImage: "dot.radiowaves.left.and.right")
                }

            SettingsView()
                .tag(1)
                .tabItem {
                    Label("Einstellungen", systemImage: "gearshape")
                }
        }
        .tint(.orange)
        .font(.custom("Lexend", size: 17, relativeTo: .body))
    }
}
