import Foundation
import Observation

/// Lightweight in-app debug log. Anything in the app can call `DebugLog.shared.log(.info, ...)`
/// and see the entries in the Debug Log sheet (⌘⌥L). Bounded buffer (last 500 entries).
@MainActor
@Observable
final class DebugLog {
    static let shared = DebugLog()

    enum Level: String, Sendable {
        case info, warn, error
    }

    struct Entry: Identifiable, Sendable {
        let id = UUID()
        let date = Date()
        let level: Level
        let category: String
        let message: String
    }

    private(set) var entries: [Entry] = []
    private let maxEntries = 500

    private init() {}

    /// Append directly without writing to stderr (the free `logInfo`/`logWarn`/`logError`
    /// helpers handle the stderr write; this just buffers for the in-app sheet).
    func appendOnly(level: Level, category: String, message: String) {
        let entry = Entry(level: level, category: category, message: message)
        entries.append(entry)
        if entries.count > maxEntries {
            entries.removeFirst(entries.count - maxEntries)
        }
    }

    func clear() { entries = [] }
}

/// Convenience free functions so call sites read tighter than DebugLog.shared.log(.info, …).
/// These are nonisolated — they hop to the MainActor for the buffered entry, while the stderr
/// write happens immediately on the caller's context for guaranteed ordering in the system log.
nonisolated func logInfo(_ category: String, _ message: String) {
    log(.info, category: category, message)
}
nonisolated func logWarn(_ category: String, _ message: String) {
    log(.warn, category: category, message)
}
nonisolated func logError(_ category: String, _ message: String) {
    log(.error, category: category, message)
}

private nonisolated func log(_ level: DebugLog.Level, category: String, _ message: String) {
    // Synchronous stderr write for ordered system-log output
    let prefix = "[\(level.rawValue.uppercased())][\(category)]"
    FileHandle.standardError.write(Data("\(prefix) \(message)\n".utf8))
    // UI buffer update on the main actor
    Task { @MainActor in
        DebugLog.shared.appendOnly(level: level, category: category, message: message)
    }
}
