import Foundation

enum RelativeTime {
    /// "5m", "2h", "Yesterday", "May 1" — iMessage-style.
    static func format(_ date: Date, reference: Date = Date()) -> String {
        let interval = reference.timeIntervalSince(date)
        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86_400 { return "\(Int(interval / 3600))h" }

        let cal = Calendar.current
        if cal.isDateInYesterday(date) { return "Yesterday" }

        let weekDiff = cal.dateComponents([.day], from: date, to: reference).day ?? 0
        if weekDiff < 7 {
            let f = DateFormatter()
            f.dateFormat = "EEEE"
            return f.string(from: date)
        }
        let f = DateFormatter()
        f.dateFormat = "M/d/yy"
        return f.string(from: date)
    }
}
