import SwiftUI

/// Mirrors the Electron app's selector view. Handles both first-launch (no current workspace) and
/// the switch flow (with a "back to current workspace" affordance).
struct WorkspaceSelectorView: View {
    @Environment(AppRouter.self) private var router

    @State private var urlInput: String = ""
    @State private var error: String?
    @State private var history: [WorkspaceHistoryEntry] = []
    @State private var dropdownOpen: Bool = false
    @State private var settingsOpen: Bool = false

    // Advanced API URL override — empty = derived from the workspace URL above.
    @State private var advancedOpen: Bool = false
    @State private var apiURLInput: String = ""

    private var topRecents: [WorkspaceHistoryEntry] { Array(history.prefix(3)) }

    var body: some View {
        ZStack(alignment: .top) {
            Color.clear
            VStack(spacing: 28) {
                header
                if !topRecents.isEmpty {
                    recentChipsRow
                }
                connectForm
                if router.isSwitching {
                    Button {
                        router.returnToCurrent()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.left")
                            Text("Back to current workspace")
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                hint
            }
            .padding(32)
            .frame(maxWidth: 460)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .overlay(alignment: .topTrailing) {
            Button {
                settingsOpen = true
            } label: {
                Image(systemName: "gear")
                    .padding(8)
            }
            .buttonStyle(.plain)
            .background(.regularMaterial, in: Circle())
            .padding(.top, 16)
            .padding(.trailing, 16)
            .help("Settings")
        }
        .sheet(isPresented: $settingsOpen) {
            SettingsSheet(isPresented: $settingsOpen)
        }
        .onAppear {
            history = WorkspaceHistory.shared.entries()
        }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(spacing: 12) {
            AppLogoView()
                .frame(width: 64, height: 64)
                .padding(.top, 24)
            Text("Claude Code Agentrooms")
                .font(.title3.weight(.semibold))
            Text(router.isSwitching
                 ? "Select a workspace or paste a new URL."
                 : "Paste your workspace URL to get started.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    private var recentChipsRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("RECENT WORKSPACES")
                .font(.caption.weight(.medium))
                .foregroundStyle(.tertiary)
                .padding(.leading, 4)
            FlowLayout(spacing: 8) {
                ForEach(topRecents) { entry in
                    WorkspaceChip(entry: entry) {
                        connectFromHistory(entry)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Re-connect to a previously-used workspace. Carries forward whatever (app URL, API URL)
    /// pair was stored with the entry.
    private func connectFromHistory(_ entry: WorkspaceHistoryEntry) {
        router.connect(
            workspaceId: entry.workspaceId,
            token: entry.workspaceToken,
            name: entry.name,
            appURL: entry.resolvedAppURL,
            apiURL: entry.resolvedAPIURL,
        )
    }

    private var connectForm: some View {
        VStack(alignment: .leading, spacing: 8) {
            // URL input with link icon and dropdown chevron — matches the Electron field
            HStack(spacing: 0) {
                Image(systemName: "link")
                    .foregroundStyle(.secondary)
                    .padding(.leading, 12)
                TextField(
                    "",
                    text: $urlInput,
                    prompt: Text("https://workspace.openagents.org/abc?token=…")
                        .foregroundStyle(.tertiary),
                )
                    .textFieldStyle(.plain)
                    .padding(.leading, 8)
                    .padding(.vertical, 12)
                    .onSubmit(handleConnect)
                    .onChange(of: urlInput) { _, _ in
                        error = nil
                        dropdownOpen = false
                    }
                    #if os(iOS)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    #endif
                if !history.isEmpty {
                    Button {
                        dropdownOpen.toggle()
                    } label: {
                        Image(systemName: "chevron.down")
                            .rotationEffect(.degrees(dropdownOpen ? 180 : 0))
                            .foregroundStyle(.secondary)
                            .padding(12)
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
            .overlay(alignment: .topLeading) {
                if dropdownOpen && !history.isEmpty {
                    historyDropdown
                        .offset(y: 50)
                        .zIndex(10)
                }
            }

            advancedSection

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 4)
            }

            Button(action: handleConnect) {
                HStack {
                    Text("Connect to Workspace").fontWeight(.medium)
                    Image(systemName: "arrow.right")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(urlInput.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    /// Collapsed by default. Override the API URL only — the app URL is already in the
    /// workspace URL field above, so requiring it twice would be confusing. The API URL
    /// is stored together with the workspace entry.
    private var advancedSection: some View {
        DisclosureGroup(isExpanded: $advancedOpen) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Override the backend API URL when it differs from the workspace URL above (self-hosted setups). Saved together with this workspace.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 2)

                advancedField(
                    label: "API URL",
                    placeholder: WorkspaceURLs.defaultAPIURL.absoluteString,
                    text: $apiURLInput,
                )
            }
            .padding(.top, 8)
        } label: {
            Text("Advanced")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
        }
    }

    private func advancedField(label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.tertiary)
            TextField("", text: text, prompt: Text(placeholder).foregroundStyle(.tertiary))
                .textFieldStyle(.plain)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
                .font(.caption.monospaced())
                #if os(iOS)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                #endif
        }
    }

    private var historyDropdown: some View {
        VStack(spacing: 0) {
            ForEach(history) { entry in
                Button {
                    dropdownOpen = false
                    connectFromHistory(entry)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "clock")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.displayName)
                                .font(.callout)
                                .foregroundStyle(.primary)
                            Text(entry.workspaceId)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if entry.id != history.last?.id {
                    Divider().padding(.leading, 36)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.platformPanel)
                .shadow(color: .black.opacity(0.15), radius: 12, y: 4),
        )
    }

    private var hint: some View {
        Text(.init("Get a workspace URL by running `openagents workspace create`"))
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
    }

    // MARK: - Actions

    private func handleConnect() {
        error = nil
        dropdownOpen = false
        let trimmed = urlInput.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        guard let parsed = WorkspaceHistory.parseWorkspaceURL(trimmed) else {
            error = "Please enter a valid workspace URL or ID."
            return
        }
        guard !parsed.token.isEmpty else {
            error = "URL must include a token parameter (e.g. ?token=…)."
            return
        }

        // App URL comes from the parsed workspace URL (or the canonical default).
        // API URL: Advanced override wins; otherwise derive from the app URL.
        let appURL = parsed.appURL ?? WorkspaceURLs.defaultAppURL
        let apiOverride = apiURLInput.trimmingCharacters(in: .whitespaces)

        let apiURL: URL
        if !apiOverride.isEmpty {
            guard let url = URL(string: apiOverride), url.scheme == "http" || url.scheme == "https" else {
                error = "API URL must be a valid http(s) URL."
                return
            }
            apiURL = url
        } else {
            apiURL = WorkspaceURLs.deriveAPIURL(fromApp: appURL)
        }

        router.connect(
            workspaceId: parsed.workspaceId,
            token: parsed.token,
            appURL: appURL,
            apiURL: apiURL,
        )
    }
}

// MARK: - WorkspaceChip

private struct WorkspaceChip: View {
    let entry: WorkspaceHistoryEntry
    let action: () -> Void

    private var fullURL: String {
        "https://workspace.openagents.org/\(entry.workspaceId)?token=\(entry.workspaceToken)"
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(entry.displayName)
                    .font(.caption)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.regularMaterial, in: Capsule())
            .overlay(Capsule().stroke(.secondary.opacity(0.2), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .help(fullURL)
    }
}

// MARK: - Helpers

private extension Color {
    /// Material-like opaque panel colour (used for the dropdown background).
    static var platformPanel: Color {
        #if os(macOS)
        Color(NSColor.controlBackgroundColor)
        #else
        Color(UIColor.secondarySystemBackground)
        #endif
    }
}

/// Renders the running app's icon — uses NSApp.applicationIconImage on macOS, falls back to a
/// rounded gradient tile on iOS (where there's no equivalent runtime API for own-icon access).
private struct AppLogoView: View {
    var body: some View {
        #if os(macOS)
        if let nsImage = NSApp.applicationIconImage {
            Image(nsImage: nsImage)
                .resizable()
                .interpolation(.high)
                .aspectRatio(contentMode: .fit)
        } else {
            placeholderTile
        }
        #else
        placeholderTile
        #endif
    }

    private var placeholderTile: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.white),
            )
    }
}

// MARK: - FlowLayout (wraps recent chips when they overflow)

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var totalHeight: CGFloat = 0
        var lineHeight: CGFloat = 0
        var x: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                totalHeight += lineHeight + spacing
                x = 0
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        totalHeight += lineHeight
        return CGSize(width: maxWidth.isFinite ? maxWidth : x, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                y += lineHeight + spacing
                x = bounds.minX
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
