import SwiftUI
import WebKit

#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// SwiftUI bridge for a WKWebView that loads inline HTML and reports its
/// content height back via a binding once the document settles. Used by
/// `HTMLBlockView` for fenced \`\`\`html previews and by `FileDetailView`
/// for HTML workspace files.
///
/// Sandbox stance: JavaScript is disabled at the `WKPreferences` level, no
/// `baseURL` is supplied (so relative paths and `file://` references don't
/// resolve), and HTTPS subresources (images, stylesheets) are still allowed —
/// banning those would be too restrictive for most demos.
struct WebView {
    let html: String
    @Binding var measuredHeight: CGFloat

    static func makeConfiguration() -> WKWebViewConfiguration {
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = false
        let cfg = WKWebViewConfiguration()
        cfg.defaultWebpagePreferences = prefs
        return cfg
    }

    /// Wraps the raw HTML in a minimal document scaffold that:
    ///   - declares UTF-8 (so emoji and CJK don't render mojibake);
    ///   - sets `prefers-color-scheme` so embedded forms / inputs match the
    ///     surrounding chat theme;
    ///   - resets body margins to 0 so the measured height matches the
    ///     visible content (the default 8px body margin would inflate it).
    static func wrappedDocument(_ rawHTML: String) -> String {
        """
        <!doctype html>
        <html><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root { color-scheme: light dark; }
          html, body { margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
          img, video, iframe { max-width: 100%; height: auto; }
        </style>
        </head><body>
        \(rawHTML)
        </body></html>
        """
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let parent: WebView

        init(parent: WebView) {
            self.parent = parent
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Pull the rendered height once the load settles. Re-queries with a
            // tiny delay so layout has stabilised — without the hop we
            // occasionally read 0 on slow loads.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak webView] in
                webView?.evaluateJavaScript("document.body.scrollHeight") { [weak self] value, _ in
                    guard let height = value as? CGFloat else { return }
                    DispatchQueue.main.async {
                        self?.parent.measuredHeight = max(40, height)
                    }
                }
            }
        }
    }
}

#if os(macOS)
extension WebView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero, configuration: Self.makeConfiguration())
        view.navigationDelegate = context.coordinator
        view.setValue(false, forKey: "drawsBackground")
        view.loadHTMLString(Self.wrappedDocument(html), baseURL: nil)
        return view
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        // Messages and uploaded HTML files are immutable for our purposes;
        // no live document swaps.
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }
}
#else
extension WebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero, configuration: Self.makeConfiguration())
        view.navigationDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.loadHTMLString(Self.wrappedDocument(html), baseURL: nil)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Messages and uploaded HTML files are immutable for our purposes;
        // no live document swaps.
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }
}
#endif
