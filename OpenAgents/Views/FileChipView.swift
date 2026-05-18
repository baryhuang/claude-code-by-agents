import SwiftUI

/// Inline pill rendered inside chat bubbles where the agent posted a link to a
/// workspace file. Tapping it opens the Content sidebar and navigates to the
/// file's detail view via the shared `ContentSidebarController`.
struct FileChipView: View {
    let fileId: String
    /// Label captured from the markdown link text, typically the filename.
    /// Falls back to a generic label when the agent posted a bare URL.
    let label: String?
    /// True when this chip sits inside an agent (light gray) bubble. Drives
    /// the chip background contrast.
    var onLightBubble: Bool = true

    @Environment(ContentSidebarController.self) private var sidebar

    var body: some View {
        Button {
            sidebar.openFile(id: fileId, label: label)
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "paperclip")
                    .font(.system(size: 10, weight: .semibold))
                Text(label ?? "View file")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .truncationMode(.middle)
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .semibold))
                    .opacity(0.5)
            }
            .foregroundStyle(onLightBubble ? Color.primary : Color.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                Capsule().fill(chipBackground),
            )
            .overlay(
                Capsule().stroke(Color.black.opacity(onLightBubble ? 0.08 : 0), lineWidth: 0.5),
            )
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open file \(label ?? fileId)")
    }

    private var chipBackground: Color {
        onLightBubble ? Color.black.opacity(0.06) : Color.white.opacity(0.22)
    }
}
