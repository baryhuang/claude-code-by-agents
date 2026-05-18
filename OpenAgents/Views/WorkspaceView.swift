import SwiftUI

/// NavigationSplitView handles 2-pane on regular size class and push/pop on compact automatically —
/// no need to branch manually. Workspace switching uses a full selector view (matching the
/// Electron app's `/?switch=1` flow) instead of a sheet.
struct WorkspaceView: View {
    @Environment(WorkspaceStore.self) private var store

    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            ThreadListView()
                .navigationSplitViewColumnWidth(min: 280, ideal: 320, max: 400)
        } detail: {
            ChatView()
        }
        .navigationSplitViewStyle(.balanced)
    }
}
