import SwiftUI

/// Single-file detail panel that lives inside `ContentSidebar` when the user
/// taps a file in the list or a file chip in a chat message. Renders the
/// file's content according to its declared type:
///   - image: scaled-to-fit thumbnail via `AuthorizedAsyncImage`
///   - text/code: UTF-8 decoded body in a scrollable monospace block
///   - html: sandboxed `WebView`
///   - other: a stub card with filename + size
///
/// The back button is owned by `ContentSidebar`, not by this view — that way
/// the same header chrome works for list and detail.
struct FileDetailView: View {
    let fileId: String
    /// Label that was on the chat chip (typically the basename). Used as a
    /// placeholder title until the authoritative metadata arrives. Pass nil
    /// when arriving from the file list (we already have the WorkspaceFile).
    let labelHint: String?

    @Environment(WorkspaceStore.self) private var store

    @State private var info: WorkspaceFile?
    @State private var loadInfoError: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            titleBlock
            Divider()
                .padding(.bottom, 6)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .task(id: fileId) {
            await loadInfo()
        }
    }

    // MARK: - Title block

    @ViewBuilder
    private var titleBlock: some View {
        let display = info?.basename ?? labelHint ?? "File"
        VStack(alignment: .leading, spacing: 2) {
            Text(display)
                .font(.system(size: 14, weight: .semibold))
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            if let info {
                HStack(spacing: 6) {
                    Text(info.kind.label)
                        .font(.system(size: 9, weight: .semibold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(info.kind.tint.opacity(0.18), in: Capsule())
                        .foregroundStyle(info.kind.tint)
                    if info.size > 0 {
                        Text(byteString(info.size))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(.bottom, 8)
    }

    // MARK: - Content router by kind

    @ViewBuilder
    private var content: some View {
        if let info {
            switch info.kind {
            case .image:
                imageContent
            case .text, .code:
                TextFileContent(fileId: fileId)
            case .pdf:
                fallbackContent(message: "PDF preview is coming soon.", systemImage: "doc.richtext")
            default:
                fallbackContent(message: "Preview not available for this file type.", systemImage: info.kind.systemImage)
            }
        } else if let loadInfoError {
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle")
                    .foregroundStyle(.orange)
                Text(loadInfoError)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    Task { await loadInfo() }
                }
                .buttonStyle(.bordered)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var imageContent: some View {
        ScrollView {
            AuthorizedAsyncImage(fileId: fileId, contentMode: .fit)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
    }

    private func fallbackContent(message: String, systemImage: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 36))
                .foregroundStyle(.tertiary)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    // MARK: - Data loading

    private func loadInfo() async {
        do {
            info = try await store.fetchFileInfo(fileId: fileId)
            loadInfoError = nil
        } catch {
            loadInfoError = error.localizedDescription
            logError("ui", "FileDetailView fetchFileInfo failed: \(error.localizedDescription)")
        }
    }

    private func byteString(_ size: Int) -> String {
        let f = ByteCountFormatter()
        f.allowedUnits = [.useKB, .useMB, .useGB]
        f.countStyle = .file
        return f.string(fromByteCount: Int64(size))
    }
}

// MARK: - Text / code content

/// Fetches a text or source file's bytes and renders them as selectable
/// monospaced text. Files larger than the cap render a truncation notice so
/// we don't pin huge buffers in memory just to scroll through a log dump.
private struct TextFileContent: View {
    let fileId: String

    @Environment(WorkspaceStore.self) private var store

    @State private var phase: Phase = .loading

    private static let maxBytes = 512 * 1024  // 512 KB

    private enum Phase {
        case loading
        case loaded(text: String, truncated: Bool)
        case htmlLoaded(String)
        case failed(String)
    }

    var body: some View {
        ZStack {
            switch phase {
            case .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .loaded(let text, let truncated):
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        if truncated {
                            HStack(spacing: 6) {
                                Image(systemName: "scissors")
                                Text("Showing the first \(TextFileContent.maxBytes / 1024) KB")
                            }
                            .font(.caption2)
                            .foregroundStyle(.orange)
                        }
                        Text(text)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(8)
                }
            case .htmlLoaded(let html):
                HTMLFileBody(html: html)
            case .failed(let message):
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task(id: fileId) {
            await fetch()
        }
    }

    private func fetch() async {
        do {
            let request = await store.authorizedFileDownloadRequest(fileId: fileId)
            let (data, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                phase = .failed("HTTP \(http.statusCode)")
                return
            }
            let contentType = (response as? HTTPURLResponse)?
                .value(forHTTPHeaderField: "Content-Type")?
                .lowercased() ?? ""

            let truncated = data.count > Self.maxBytes
            let slice = truncated ? data.prefix(Self.maxBytes) : data
            guard let text = String(data: slice, encoding: .utf8) else {
                phase = .failed("File is not valid UTF-8 text.")
                return
            }

            if contentType.contains("text/html") {
                phase = .htmlLoaded(text)
            } else {
                phase = .loaded(text: text, truncated: truncated)
            }
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Sandboxed `WebView` wrapper for HTML files in the detail panel. Caps
/// rendered height generously so HTML artifacts don't get cut off.
private struct HTMLFileBody: View {
    let html: String

    @State private var measuredHeight: CGFloat = 200

    var body: some View {
        ScrollView {
            WebView(html: html, measuredHeight: $measuredHeight)
                .frame(height: max(measuredHeight, 200))
                .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - File-kind styling (shared with ContentSidebar)

extension WorkspaceFile.Kind {
    var label: String {
        switch self {
        case .image:   return "IMG"
        case .text:    return "TXT"
        case .pdf:     return "PDF"
        case .audio:   return "AUD"
        case .video:   return "VID"
        case .archive: return "ZIP"
        case .code:    return "CODE"
        case .other:   return "FILE"
        }
    }
    var systemImage: String {
        switch self {
        case .image:   return "photo"
        case .text:    return "doc.text"
        case .pdf:     return "doc.richtext"
        case .audio:   return "waveform"
        case .video:   return "play.rectangle"
        case .archive: return "archivebox"
        case .code:    return "chevron.left.forwardslash.chevron.right"
        case .other:   return "doc"
        }
    }
    var tint: Color {
        switch self {
        case .image:   return .purple
        case .text:    return .blue
        case .pdf:     return .red
        case .audio:   return .pink
        case .video:   return .orange
        case .archive: return .brown
        case .code:    return .green
        case .other:   return .gray
        }
    }
}
