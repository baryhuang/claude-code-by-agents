import Foundation
import Observation

/// Coordinates open/closed state and current-file selection for the chat's
/// right-hand Content sidebar. Owned by `ChatView` and surfaced through
/// `@Environment` so deeply-nested views (e.g. a `FileChipView` inside a
/// `MessageBubble`) can drive navigation without prop-drilling.
///
/// State model:
///   - `isPresented == false`              → sidebar hidden
///   - `isPresented == true` &&
///     `selectedFileId == nil`             → file list
///   - `isPresented == true` &&
///     `selectedFileId != nil`             → file detail
@MainActor
@Observable
final class ContentSidebarController {
    var isPresented: Bool = false
    var selectedFileId: String? = nil

    /// Best-guess label for the selected file, captured from the chip's
    /// markdown link text. The detail view uses it as a placeholder title
    /// while it fetches authoritative metadata.
    var selectedFileLabelHint: String? = nil

    /// Toggle the sidebar without changing what it's pointing at — used by the
    /// chat header / toolbar buttons. Closing keeps the previously-selected
    /// file so reopening returns to the same view.
    func toggle() {
        isPresented.toggle()
    }

    /// Open the sidebar to the file list, regardless of prior state. Called
    /// when the user opens the sidebar from the toolbar (vs. opening a chip).
    func showList() {
        selectedFileId = nil
        selectedFileLabelHint = nil
        isPresented = true
    }

    /// Open the sidebar focused on a specific file. Called from file chips
    /// in chat messages.
    func openFile(id: String, label: String?) {
        selectedFileId = id
        selectedFileLabelHint = label
        isPresented = true
    }

    /// Back from detail to list. Sidebar stays open.
    func backToList() {
        selectedFileId = nil
        selectedFileLabelHint = nil
    }

    /// Fully close the sidebar (xmark button).
    func close() {
        isPresented = false
    }
}
