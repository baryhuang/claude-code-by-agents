import SwiftUI

struct RootView: View {
    @Environment(AppRouter.self) private var router

    var body: some View {
        switch router.route {
        case .selector:
            WorkspaceSelectorView()
                .id("selector")
        case .workspace(let entry):
            // Recreate the store whenever the connected workspace changes.
            WorkspaceContainerView(entry: entry)
                .id(entry.workspaceId + ":" + entry.workspaceToken)
        }
    }
}

private struct WorkspaceContainerView: View {
    @Environment(AppRouter.self) private var router
    @State private var store: WorkspaceStore
    let entry: WorkspaceHistoryEntry

    init(entry: WorkspaceHistoryEntry) {
        self.entry = entry
        // Each workspace carries its own (appURL, apiURL) pair; only fall back to the
        // global default when the entry was persisted by an older app version.
        let baseURL = entry.apiURL.flatMap(URL.init(string:))
            ?? entry.resolvedAPIURL
        _store = State(
            initialValue: WorkspaceStore(
                workspaceId: entry.workspaceId,
                token: entry.workspaceToken,
                baseURL: baseURL,
            ),
        )
    }

    var body: some View {
        WorkspaceView()
            .environment(store)
            .task {
                await store.bootstrap()
            }
            .onDisappear {
                store.teardown()
            }
    }
}
