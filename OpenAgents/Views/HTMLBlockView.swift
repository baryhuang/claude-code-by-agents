import SwiftUI

/// Renders a fenced \`\`\`html block as an inline interactive preview inside a
/// chat bubble. Mirrors the visual treatment of `CodeBlockView` (rounded
/// container, on-bubble background) but the body is a sandboxed WKWebView
/// instead of monospace source.
///
/// Web view sandbox stance lives in `WebView`.
struct HTMLBlockView: View {
    let html: String
    /// True when this block sits inside an agent (light gray) bubble; false on
    /// user (blue) bubbles. Used to pick a contrasting container background.
    var onLightBubble: Bool = true

    /// Cap on the rendered web view height. Long pages scroll inside the
    /// block rather than blowing out the chat. Empirically ~400pt fits a
    /// typical interactive demo without dominating the chat scroll.
    private static let maxRenderedHeight: CGFloat = 400

    /// Reported height of the rendered document. Starts small so the bubble
    /// doesn't reserve a giant slot during the first paint.
    @State private var measuredHeight: CGFloat = 80

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Image(systemName: "globe")
                    .font(.system(size: 9))
                Text("html")
                    .font(.caption2.monospaced())
            }
            .foregroundStyle(.secondary)
            .padding(.bottom, 4)

            WebView(html: html, measuredHeight: $measuredHeight)
                .frame(height: min(measuredHeight, Self.maxRenderedHeight))
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .padding(8)
        .background(
            (onLightBubble ? Color.black.opacity(0.06) : Color.white.opacity(0.18)),
            in: RoundedRectangle(cornerRadius: 8, style: .continuous),
        )
    }
}
