import SwiftUI

/// Deterministic color palette for agent avatars — index by stable hash so the same agent
/// always gets the same color across renders.
enum AgentPalette {
    static let colors: [Color] = [
        Color(red: 0.95, green: 0.40, blue: 0.45), // red
        Color(red: 0.99, green: 0.65, blue: 0.30), // orange
        Color(red: 0.95, green: 0.80, blue: 0.35), // yellow
        Color(red: 0.45, green: 0.78, blue: 0.50), // green
        Color(red: 0.30, green: 0.74, blue: 0.92), // cyan
        Color(red: 0.30, green: 0.50, blue: 0.95), // blue
        Color(red: 0.65, green: 0.45, blue: 0.95), // purple
        Color(red: 0.95, green: 0.45, blue: 0.78), // pink
        Color(red: 0.40, green: 0.65, blue: 0.55), // teal
    ]

    static func color(for agentName: String) -> Color {
        var hash: UInt64 = 5381
        for byte in agentName.utf8 {
            hash = ((hash << 5) &+ hash) &+ UInt64(byte)
        }
        return colors[Int(hash % UInt64(colors.count))]
    }
}
