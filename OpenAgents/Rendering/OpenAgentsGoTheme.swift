import SwiftUI
import SwiftUIJSONRender

/// Theme applied to A2UI-rendered specs so they feel native inside Go's
/// iMessage-style bubbles. Pulls from system tokens (system accent, primary/
/// secondary text, default fonts) so the result tracks light/dark mode and
/// the user's macOS accent-color preference automatically.
struct OpenAgentsGoTheme: JSONRenderTheme {
    // Brand — track the system accent color so buttons match the user
    // bubble tint and the app's general affordance color.
    static var primaryColor: Color { .accentColor }
    static var secondaryColor: Color { .secondary }

    // Surfaces — keep the inner card light so it blends with the bubble it
    // sits inside, rather than drawing a hard secondary background. The
    // bubble already provides the surrounding chrome.
    static var backgroundColor: Color { .clear }
    static var surfaceColor: Color { Color.primary.opacity(0.04) }

    // Type — system body / headline align with the rest of the chat. The
    // heading is bumped to title3 so a "Pick a time of day" headline reads
    // as a header rather than a single bold line.
    static var headingFont: Font { .title3.weight(.semibold) }
    static var bodyFont: Font { .body }
    static var captionFont: Font { .footnote }

    // Corner radii — buttons land at 14pt (pill-ish, iOS-native), cards
    // at 14pt (softer than the bubble), and any large surfaces at 18pt
    // to match MessageBubble exactly.
    static var radiusSM: CGFloat { 14 }
    static var radiusMD: CGFloat { 14 }
    static var radiusLG: CGFloat { 18 }

    // Spacing — tighten the defaults a notch so the spec doesn't dominate
    // a single bubble.
    static var spacingXS: CGFloat { 4 }
    static var spacingSM: CGFloat { 8 }
    static var spacingMD: CGFloat { 12 }
    static var spacingLG: CGFloat { 18 }

    // Subtle alert backgrounds (lighter than the SwiftUIJSONRender default
    // so they sit calmer next to chat content).
    static var alertBackgroundOpacity: Double { 0.08 }
    static var alertBorderOpacity: Double { 0.18 }
}
