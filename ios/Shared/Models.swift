import Foundation
import SwiftUI

// MARK: - Server Models

struct CueModel: Codable, Identifiable, Equatable {
    let id: String
    let tc: String
    let title: String
    let message: String
    let color: String       // hex "#rrggbb"

    var swiftUIColor: Color {
        Color(hex: color) ?? .accentColor
    }
}

struct ShowPositionModel: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let startTc: String
    let endTc: String
}

struct TCUpdateEvent: Codable {
    let type: String
    let tc: String
    let previousCue: CueModel?
    let currentCue: CueModel?
    let nextCue: CueModel?
    let currentPosition: ShowPositionModel?
}

struct CueFireEvent: Codable {
    let type: String
    let tc: String
    let cue: CueModel
    let previousCue: CueModel?
    let nextCue: CueModel?
}

struct WSTypeSniff: Codable {
    let type: String
}

// MARK: - Connection State

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
}

// MARK: - Color Helper

extension Color {
    init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if h.hasPrefix("#") { h = String(h.dropFirst()) }
        guard h.count == 6, let val = UInt64(h, radix: 16) else { return nil }
        let r = Double((val >> 16) & 0xFF) / 255
        let g = Double((val >> 8)  & 0xFF) / 255
        let b = Double( val        & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
