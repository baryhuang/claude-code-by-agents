import SwiftUI
import UniformTypeIdentifiers

#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// Threshold (in unicode scalars) above which a plain-text paste is converted
/// into a `Pasted-text-<ts>.txt` attachment chip instead of being inserted
/// into the text view. Matches ChatGPT's published behavior (March 2026
/// rollout: pastes over 5000 chars become attachments).
fileprivate let longPasteCharThreshold = 5_000

fileprivate func makeLongTextAttachment(_ text: String) -> PendingAttachment {
    let stamp = Int(Date().timeIntervalSince1970)
    return PendingAttachment(
        filename: "Pasted-text-\(stamp).txt",
        contentType: "text/plain",
        data: Data(text.utf8),
    )
}

/// Plain-text composer for the chat input. Wraps a platform-native text view so
/// we can intercept Return-to-send around IME composition (`hasMarkedText()` /
/// `markedTextRange`) and handle image / file paste — neither of which the
/// stock SwiftUI `TextEditor` exposes.
struct ComposerTextView: View {
    @Binding var text: String
    var height: CGFloat
    var placeholder: String
    var isFocused: FocusState<Bool>.Binding
    var onSend: () -> Void
    /// Paste produced one or more attachments (images, or a long text block
    /// converted into a `Pasted-text-…txt` file per ChatGPT's >5000-char rule).
    var onPasteImages: ([PendingAttachment]) -> Void
    var onPasteFileURLs: ([URL]) -> Void
    /// When the slash-command suggestion popup is showing, ChatView passes a
    /// closure that handles macOS arrow / Tab / Return / Esc selectors before
    /// the composer's normal Return-to-send path. Returns `true` if the key
    /// was consumed; otherwise we fall through to the standard handler.
    var onSlashKey: ((Selector) -> Bool)? = nil

    var body: some View {
        ZStack(alignment: .topLeading) {
            ComposerRepresentable(
                text: $text,
                isFocused: isFocused,
                onSend: onSend,
                onPasteImages: onPasteImages,
                onPasteFileURLs: onPasteFileURLs,
                onSlashKey: onSlashKey,
            )
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
            .frame(height: height)

            if text.isEmpty {
                Text(placeholder)
                    .font(.body)
                    .foregroundStyle(Color.secondary.opacity(0.7))
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .allowsHitTesting(false)
            }
        }
    }
}

// MARK: - macOS

#if os(macOS)

private struct ComposerRepresentable: NSViewRepresentable {
    @Binding var text: String
    var isFocused: FocusState<Bool>.Binding
    var onSend: () -> Void
    var onPasteImages: ([PendingAttachment]) -> Void
    var onPasteFileURLs: ([URL]) -> Void
    var onSlashKey: ((Selector) -> Bool)? = nil

    func makeCoordinator() -> Coordinator {
        Coordinator(
            text: $text,
            isFocused: isFocused,
            onSend: onSend,
            onPasteImages: onPasteImages,
            onPasteFileURLs: onPasteFileURLs,
            onSlashKey: onSlashKey,
        )
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.borderType = .noBorder
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = false
        scroll.autohidesScrollers = true

        let textView = ComposerNSTextView()
        textView.coordinator = context.coordinator
        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.allowsUndo = true
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.font = .systemFont(ofSize: NSFont.systemFontSize)
        textView.textContainerInset = NSSize(width: 8, height: 4)
        textView.drawsBackground = false
        textView.usesFindBar = false
        textView.importsGraphics = false
        textView.isEditable = true
        textView.isSelectable = true
        textView.textContainer?.widthTracksTextView = true
        textView.autoresizingMask = [.width]

        scroll.documentView = textView
        return scroll
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? ComposerNSTextView else { return }
        context.coordinator.update(
            onSend: onSend,
            onPasteImages: onPasteImages,
            onPasteFileURLs: onPasteFileURLs,
            onSlashKey: onSlashKey,
        )
        if textView.string != text {
            // Skip the sync while an IME is composing — overwriting the
            // string wipes the marked-text range and cancels the user's
            // in-flight Chinese / Japanese / Korean composition. The IME
            // will commit through the normal text-change path when the
            // user picks a candidate.
            if !textView.hasMarkedText() {
                textView.string = text
            }
        }

        // Two-way focus binding without re-entering an update cycle.
        let wantsFocus = isFocused.wrappedValue
        let isCurrent = (textView.window?.firstResponder == textView)
        if wantsFocus && !isCurrent {
            DispatchQueue.main.async {
                textView.window?.makeFirstResponder(textView)
            }
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        let text: Binding<String>
        let isFocused: FocusState<Bool>.Binding
        var onSend: () -> Void
        var onPasteImages: ([PendingAttachment]) -> Void
        var onPasteFileURLs: ([URL]) -> Void
        var onSlashKey: ((Selector) -> Bool)?

        init(
            text: Binding<String>,
            isFocused: FocusState<Bool>.Binding,
            onSend: @escaping () -> Void,
            onPasteImages: @escaping ([PendingAttachment]) -> Void,
            onPasteFileURLs: @escaping ([URL]) -> Void,
            onSlashKey: ((Selector) -> Bool)? = nil,
        ) {
            self.text = text
            self.isFocused = isFocused
            self.onSend = onSend
            self.onPasteImages = onPasteImages
            self.onPasteFileURLs = onPasteFileURLs
            self.onSlashKey = onSlashKey
        }

        func update(
            onSend: @escaping () -> Void,
            onPasteImages: @escaping ([PendingAttachment]) -> Void,
            onPasteFileURLs: @escaping ([URL]) -> Void,
            onSlashKey: ((Selector) -> Bool)? = nil,
        ) {
            self.onSend = onSend
            self.onPasteImages = onPasteImages
            self.onPasteFileURLs = onPasteFileURLs
            self.onSlashKey = onSlashKey
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            if text.wrappedValue != textView.string {
                text.wrappedValue = textView.string
            }
        }

        func textDidBeginEditing(_ notification: Notification) {
            if !isFocused.wrappedValue { isFocused.wrappedValue = true }
        }

        func textDidEndEditing(_ notification: Notification) {
            if isFocused.wrappedValue { isFocused.wrappedValue = false }
        }

        // IME-safe Return-to-send. AppKit routes both plain Return and
        // Shift+Return through `insertNewline:` in a regular (non-field-editor)
        // NSTextView, so we can't distinguish via the selector alone. Inspect
        // the current NSEvent's modifier flags: shift held → fall through so
        // AppKit inserts a literal newline; no shift → send. While the IME is
        // composing, `hasMarkedText()` is true and we yield so it can commit.
        func textView(_ textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            // Slash-command popup gets first crack at arrow / Tab / Return / Esc
            // when it's open. If it consumes the key, we stop here.
            if let slash = onSlashKey, slash(commandSelector) { return true }

            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                if textView.hasMarkedText() {
                    return false
                }
                if NSApp.currentEvent?.modifierFlags.contains(.shift) == true {
                    return false
                }
                onSend()
                return true
            }
            return false
        }
    }
}

fileprivate final class ComposerNSTextView: NSTextView {
    fileprivate weak var coordinator: ComposerRepresentable.Coordinator?

    /// Image / file types we want to accept beyond what NSTextView reads by
    /// default. Stock NSTextView's paste validator returns false when the
    /// pasteboard contains only image data — Cmd+V then plays the system
    /// "bonk" sound and `paste(_:)` is never reached. Adding these to the
    /// readable / acceptable-drag types is what makes paste validate.
    private static let extraPasteboardTypes: [NSPasteboard.PasteboardType] = [
        .png,
        .tiff,
        NSPasteboard.PasteboardType("public.jpeg"),
        NSPasteboard.PasteboardType("public.image"),
        .fileURL,
    ]

    override var readablePasteboardTypes: [NSPasteboard.PasteboardType] {
        super.readablePasteboardTypes + Self.extraPasteboardTypes
    }

    override var acceptableDragTypes: [NSPasteboard.PasteboardType] {
        super.acceptableDragTypes + Self.extraPasteboardTypes
    }

    /// Belt-and-suspenders: explicitly enable the Paste menu item whenever the
    /// pasteboard has image data or a file URL. `readablePasteboardTypes` alone
    /// usually suffices, but some macOS releases still gate the menu on a
    /// stricter validator.
    override func validateUserInterfaceItem(_ item: any NSValidatedUserInterfaceItem) -> Bool {
        if item.action == #selector(NSText.paste(_:)) || item.action == #selector(NSTextView.pasteAsPlainText(_:)) {
            if pasteboardHasOurContent() { return true }
        }
        return super.validateUserInterfaceItem(item)
    }

    private func pasteboardHasOurContent() -> Bool {
        let pb = NSPasteboard.general
        guard let types = pb.types else { return false }
        return Self.extraPasteboardTypes.contains(where: { types.contains($0) })
    }

    override func paste(_ sender: Any?) {
        handlePaste(sender: sender)
    }

    /// Pasted with the "Paste and Match Style" command (⌥⇧⌘V) — also a place
    /// users copy images and try to drop them in. Treat the same way.
    override func pasteAsPlainText(_ sender: Any?) {
        handlePaste(sender: sender)
    }

    private func handlePaste(sender: Any?) {
        let pb = NSPasteboard.general
        let types = pb.types?.map(\.rawValue).joined(separator: ", ") ?? "<nil>"
        logInfo("paste", "macOS paste types=[\(types)]")

        // Image data first — covers Preview ⌘C, screenshots, browser drag-to-clipboard.
        if let attachments = Self.imageAttachments(from: pb), !attachments.isEmpty {
            logInfo("paste", "macOS image paste — \(attachments.count) attachment(s)")
            coordinator?.onPasteImages(attachments)
            return
        }

        // File URLs from Finder (or anything that drops file URLs onto the pasteboard).
        if let urls = pb.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
           !urls.isEmpty,
           urls.allSatisfy({ $0.isFileURL }) {
            logInfo("paste", "macOS file URL paste — \(urls.count) url(s)")
            coordinator?.onPasteFileURLs(urls)
            return
        }

        // Long plain-text paste → file attachment, ChatGPT-style. Keeps the
        // composer usable when a user dumps a 50KB log into it.
        if let text = pb.string(forType: .string), text.count >= longPasteCharThreshold {
            logInfo("paste", "macOS long-text paste — \(text.count) chars → file attachment")
            coordinator?.onPasteImages([makeLongTextAttachment(text)])
            return
        }

        logInfo("paste", "macOS paste — falling through to super (text)")
        super.paste(sender)
    }

    private static func imageAttachments(from pb: NSPasteboard) -> [PendingAttachment]? {
        // Try in order of preference: native PNG → JPEG → TIFF → any NSImage.
        // This covers browsers (PNG), Photos.app / Slack (JPEG/PNG), system
        // screenshots (TIFF), and apps that only put NSImage on the pasteboard.
        let stamp = Int(Date().timeIntervalSince1970)
        let jpegType = NSPasteboard.PasteboardType("public.jpeg")

        func makeAttachment(data: Data, contentType: String, ext: String) -> PendingAttachment {
            // Downsample anything over 2000px on the longest side so we can't
            // poison Anthropic's many-image-request limit on the agent side.
            let (finalData, finalType, finalName) = ImageDownsampler.ensureFits(
                data: data,
                contentType: contentType,
                filename: "Pasted-\(stamp).\(ext)",
            )
            return PendingAttachment(filename: finalName, contentType: finalType, data: finalData)
        }

        if let png = pb.data(forType: .png) {
            return [makeAttachment(data: png, contentType: "image/png", ext: "png")]
        }
        if let jpeg = pb.data(forType: jpegType) {
            return [makeAttachment(data: jpeg, contentType: "image/jpeg", ext: "jpg")]
        }
        if let tiff = pb.data(forType: .tiff) {
            // Convert TIFF → PNG so the upload path doesn't ship a 10× larger blob.
            if let rep = NSBitmapImageRep(data: tiff),
               let png = rep.representation(using: .png, properties: [:]) {
                return [makeAttachment(data: png, contentType: "image/png", ext: "png")]
            }
            return [makeAttachment(data: tiff, contentType: "image/tiff", ext: "tiff")]
        }
        // Fallback: some apps drop only NSImage. Convert to PNG via TIFF.
        if let images = pb.readObjects(forClasses: [NSImage.self], options: nil) as? [NSImage],
           let first = images.first,
           let tiff = first.tiffRepresentation,
           let rep = NSBitmapImageRep(data: tiff),
           let png = rep.representation(using: .png, properties: [:]) {
            return [makeAttachment(data: png, contentType: "image/png", ext: "png")]
        }
        return nil
    }
}

#else

// MARK: - iOS

private struct ComposerRepresentable: UIViewRepresentable {
    @Binding var text: String
    var isFocused: FocusState<Bool>.Binding
    var onSend: () -> Void
    var onPasteImages: ([PendingAttachment]) -> Void
    var onPasteFileURLs: ([URL]) -> Void
    /// Currently unused on iOS — slash-command popup keyboard nav uses macOS
    /// NSResponder selectors. Accepted here so the cross-platform call site
    /// in `ComposerTextView` stays uniform.
    var onSlashKey: ((Selector) -> Bool)? = nil

    func makeCoordinator() -> Coordinator {
        Coordinator(
            text: $text,
            isFocused: isFocused,
            onSend: onSend,
            onPasteImages: onPasteImages,
            onPasteFileURLs: onPasteFileURLs,
        )
    }

    func makeUIView(context: Context) -> ComposerUITextView {
        let textView = ComposerUITextView()
        textView.coordinator = context.coordinator
        textView.delegate = context.coordinator
        textView.font = .preferredFont(forTextStyle: .body)
        textView.adjustsFontForContentSizeCategory = true
        textView.backgroundColor = .clear
        textView.textContainerInset = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
        textView.textContainer.lineFragmentPadding = 0
        textView.autocorrectionType = .yes
        textView.smartQuotesType = .no
        textView.smartDashesType = .no
        textView.spellCheckingType = .yes
        textView.returnKeyType = .default
        textView.isScrollEnabled = true
        return textView
    }

    func updateUIView(_ textView: ComposerUITextView, context: Context) {
        context.coordinator.update(
            onSend: onSend,
            onPasteImages: onPasteImages,
            onPasteFileURLs: onPasteFileURLs,
        )
        if textView.text != text {
            // Skip the sync while an IME is composing — assigning text wipes
            // markedTextRange and cancels the user's in-flight Chinese /
            // Japanese / Korean composition. The IME will commit through the
            // normal text-change path when the user picks a candidate.
            // (Same fix as React Native's iOS controlled-input patch.)
            if textView.markedTextRange == nil {
                textView.text = text
            }
        }

        // Auto-PROMOTE to first responder when the binding asks for focus,
        // but DON'T auto-resign when it asks to drop focus — UIKit already
        // dismisses the keyboard naturally on user taps outside / done key,
        // and SwiftUI re-renders can briefly read a stale `false` from the
        // FocusState binding right after the user taps to focus, which
        // would yank the keyboard down before they can type a single
        // character. Mirrors the macOS path above (no auto-resign there
        // either).
        let wantsFocus = isFocused.wrappedValue
        if wantsFocus && !textView.isFirstResponder {
            DispatchQueue.main.async { textView.becomeFirstResponder() }
        }
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        let text: Binding<String>
        let isFocused: FocusState<Bool>.Binding
        var onSend: () -> Void
        var onPasteImages: ([PendingAttachment]) -> Void
        var onPasteFileURLs: ([URL]) -> Void

        init(
            text: Binding<String>,
            isFocused: FocusState<Bool>.Binding,
            onSend: @escaping () -> Void,
            onPasteImages: @escaping ([PendingAttachment]) -> Void,
            onPasteFileURLs: @escaping ([URL]) -> Void,
        ) {
            self.text = text
            self.isFocused = isFocused
            self.onSend = onSend
            self.onPasteImages = onPasteImages
            self.onPasteFileURLs = onPasteFileURLs
        }

        func update(
            onSend: @escaping () -> Void,
            onPasteImages: @escaping ([PendingAttachment]) -> Void,
            onPasteFileURLs: @escaping ([URL]) -> Void,
        ) {
            self.onSend = onSend
            self.onPasteImages = onPasteImages
            self.onPasteFileURLs = onPasteFileURLs
        }

        func textViewDidChange(_ textView: UITextView) {
            if text.wrappedValue != textView.text {
                text.wrappedValue = textView.text
            }
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            if !isFocused.wrappedValue { isFocused.wrappedValue = true }
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            if isFocused.wrappedValue { isFocused.wrappedValue = false }
        }

        // IME-safe Return handling. Soft keyboard's Return inserts a newline
        // (matches iMessage behavior — explicit send button is the way to send
        // from the soft keyboard). Hardware-keyboard Return sends, unless an
        // IME is composing (markedTextRange != nil) in which case Return is
        // delivered to the IME to commit/cancel its candidate.
        func textView(
            _ textView: UITextView,
            shouldChangeTextIn range: NSRange,
            replacementText text: String,
        ) -> Bool {
            guard text == "\n" else { return true }
            // Hardware-keyboard newlines arrive here; soft-keyboard taps also do.
            // We only intercept if the user is on a hardware keyboard (no IME
            // candidates active). On the soft keyboard the user is not actively
            // composing once they've tapped Return, so markedTextRange is nil and
            // we'd accidentally send. Distinguish via `composer` flag set by the
            // hardware-key handler.
            if let composer = textView as? ComposerUITextView,
               composer.consumeHardwareReturn() {
                if textView.markedTextRange == nil {
                    onSend()
                }
                return false
            }
            // Soft-keyboard Return: insert a newline.
            return true
        }
    }
}

fileprivate final class ComposerUITextView: UITextView {
    fileprivate weak var coordinator: ComposerRepresentable.Coordinator?

    /// Set by `pressesBegan` when the user presses Return on a hardware keyboard.
    /// `shouldChangeTextIn` reads and clears it so we can tell hardware Return
    /// (= send) from soft-keyboard Return (= newline) without changing
    /// `returnKeyType` (which would reshape the on-screen Return key).
    private var hardwareReturnPending = false

    func consumeHardwareReturn() -> Bool {
        let was = hardwareReturnPending
        hardwareReturnPending = false
        return was
    }

    // MARK: Hardware Return / Shift+Return

    override var keyCommands: [UIKeyCommand]? {
        // Shift+Return → newline. Without this the system would otherwise treat
        // it the same as plain Return on hardware keyboards.
        let shiftReturn = UIKeyCommand(input: "\r", modifierFlags: .shift, action: #selector(insertHardwareNewline))
        return (super.keyCommands ?? []) + [shiftReturn]
    }

    @objc private func insertHardwareNewline() {
        replace(selectedTextRange ?? textRange(from: endOfDocument, to: endOfDocument)!, withText: "\n")
    }

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        for press in presses {
            guard let key = press.key else { continue }
            if key.keyCode == .keyboardReturnOrEnter && !key.modifierFlags.contains(.shift) {
                hardwareReturnPending = true
                // Single-shot flag: if shouldChangeTextIn doesn't fire on this run loop
                // (e.g. the IME consumed the Return to commit a candidate), clear it
                // so a later soft-keyboard Return doesn't get treated as hardware.
                DispatchQueue.main.async { [weak self] in
                    self?.hardwareReturnPending = false
                }
            }
        }
        super.pressesBegan(presses, with: event)
    }

    // MARK: Paste

    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        if action == #selector(paste(_:)) {
            let pb = UIPasteboard.general
            if pb.hasImages || pb.hasStrings || pb.hasURLs { return true }
        }
        return super.canPerformAction(action, withSender: sender)
    }

    override func paste(_ sender: Any?) {
        let pb = UIPasteboard.general

        if let images = pb.images, !images.isEmpty {
            let stamp = Int(Date().timeIntervalSince1970)
            let attachments: [PendingAttachment] = images.enumerated().compactMap { idx, image in
                let (data, contentType, ext): (Data, String, String) = {
                    if let png = image.pngData() { return (png, "image/png", "png") }
                    if let jpg = image.jpegData(compressionQuality: 0.9) { return (jpg, "image/jpeg", "jpg") }
                    return (Data(), "image/png", "png")
                }()
                guard !data.isEmpty else { return nil }
                let (finalData, finalType, finalName) = ImageDownsampler.ensureFits(
                    data: data,
                    contentType: contentType,
                    filename: "Pasted-\(stamp)-\(idx).\(ext)",
                )
                return PendingAttachment(filename: finalName, contentType: finalType, data: finalData)
            }
            if !attachments.isEmpty {
                coordinator?.onPasteImages(attachments)
                return
            }
        }

        if pb.hasURLs, let urls = pb.urls, !urls.isEmpty,
           urls.allSatisfy({ $0.isFileURL }) {
            coordinator?.onPasteFileURLs(urls)
            return
        }

        // Long plain-text paste → file attachment, ChatGPT-style.
        if let text = pb.string, text.count >= longPasteCharThreshold {
            coordinator?.onPasteImages([makeLongTextAttachment(text)])
            return
        }

        super.paste(sender)
    }
}

#endif
