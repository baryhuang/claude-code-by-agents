import SwiftUI

/// Right-side panel that holds either a workspace-file list or a single-file
/// detail view, swapping based on `ContentSidebarController.selectedFileId`.
/// Mirrors the "Content" sidebar in the React workspace UI.
struct ContentSidebar: View {
    /// Default / minimum width — fits a single column of file cards. The
    /// resize handle in ChatView lets the user grow this up to
    /// `twoColumnWidth` where the list switches to a 2-column grid.
    static let singleColumnWidth: CGFloat = 280
    static let twoColumnWidth: CGFloat = 560

    @Environment(WorkspaceStore.self) private var store
    @Environment(ContentSidebarController.self) private var controller

    @State private var files: [WorkspaceFile] = []
    @State private var loading: Bool = false
    @State private var loadError: String?

    var body: some View {
        VStack(spacing: 0) {
            if let fileId = controller.selectedFileId {
                detailHeader
                Divider()
                FileDetailView(
                    fileId: fileId,
                    labelHint: controller.selectedFileLabelHint,
                )
            } else {
                listHeader
                Divider()
                listBody
            }
        }
        .background(sidebarBackground)
        .task(id: store.workspaceId) {
            await refresh()
        }
    }

    // MARK: - List header (with refresh + close)

    private var listHeader: some View {
        HStack(spacing: 8) {
            Text("Content")
                .font(.headline)
            Spacer()
            Button {
                Task { await refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Refresh files")
            #if os(macOS)
            .help("Refresh")
            #endif

            Button {
                controller.close()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close content sidebar")
            #if os(macOS)
            .help("Close")
            #endif
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    // MARK: - Detail header (back + close)

    private var detailHeader: some View {
        HStack(spacing: 8) {
            Button {
                controller.backToList()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .semibold))
                    Text("Files")
                        .font(.system(size: 13))
                }
                .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to file list")

            Spacer()

            Button {
                controller.close()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close content sidebar")
            #if os(macOS)
            .help("Close")
            #endif
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private var listBody: some View {
        if loading && files.isEmpty {
            loadingState
        } else if let loadError, files.isEmpty {
            errorState(message: loadError)
        } else if files.isEmpty {
            emptyState
        } else {
            fileList
        }
    }

    private var loadingState: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("Loading files…")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(message: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(.orange)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Retry") {
                Task { await refresh() }
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "folder")
                .font(.system(size: 28))
                .foregroundStyle(.tertiary)
            Text("No files yet")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var fileList: some View {
        ScrollView {
            // Adaptive grid: 1 column at minimum sidebar width, 2 columns when
            // the user drags the sidebar wider. SwiftUI computes the column
            // count from `minimum:` and the available width.
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 240), spacing: 8)],
                spacing: 8,
            ) {
                ForEach(sortedFiles) { file in
                    Button {
                        controller.openFile(id: file.id, label: file.basename)
                    } label: {
                        FileCard(file: file)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
        }
    }

    /// Newest first. Files with no createdAt sink to the bottom so the
    /// recent-activity affordance stays correct on the (rare) legacy rows.
    private var sortedFiles: [WorkspaceFile] {
        files.sorted { lhs, rhs in
            switch (lhs.createdAtDate, rhs.createdAtDate) {
            case (let l?, let r?): return l > r
            case (_?, nil):        return true
            case (nil, _?):        return false
            case (nil, nil):       return lhs.filename < rhs.filename
            }
        }
    }

    private var sidebarBackground: Color {
        #if os(macOS)
        Color(.windowBackgroundColor)
        #else
        Color(.systemBackground)
        #endif
    }

    // MARK: - Loading

    private func refresh() async {
        loading = true
        defer { loading = false }
        do {
            files = try await store.listFiles(channel: nil, limit: 100)
            loadError = nil
        } catch {
            loadError = error.localizedDescription
            logError("ui", "ContentSidebar listFiles failed: \(error.localizedDescription)")
        }
    }
}

// MARK: - File card

private struct FileCard: View {
    let file: WorkspaceFile

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            thumbnail
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(file.basename)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    Text(file.kind.label)
                        .font(.system(size: 9, weight: .semibold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(file.kind.tint.opacity(0.18), in: Capsule())
                        .foregroundStyle(file.kind.tint)
                    if file.size > 0 {
                        Text(byteString(file.size))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                if let date = file.createdAtDate {
                    Text(relativeTime(from: date))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.gray.opacity(0.08)),
        )
    }

    @ViewBuilder
    private var thumbnail: some View {
        switch file.kind {
        case .image:
            AuthorizedAsyncImage(fileId: file.id)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        default:
            ZStack {
                Rectangle()
                    .fill(.gray.opacity(0.18))
                Image(systemName: file.kind.systemImage)
                    .font(.system(size: 18))
                    .foregroundStyle(file.kind.tint)
            }
        }
    }

    private func byteString(_ size: Int) -> String {
        let f = ByteCountFormatter()
        f.allowedUnits = [.useKB, .useMB, .useGB]
        f.countStyle = .file
        return f.string(fromByteCount: Int64(size))
    }

    /// "3d ago", "12m ago" — same shape the React sidebar uses.
    private func relativeTime(from date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f.localizedString(for: date, relativeTo: Date())
    }
}

