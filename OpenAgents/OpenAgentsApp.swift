import SwiftUI
import SwiftUIJSONRender

@main
struct OpenAgentsApp: App {
    init() {
        // SwiftUIJSONRender's built-in component catalog is registered lazily
        // via a private static let — nothing accesses it on its own, so the
        // registry stays empty and JSONView falls back to "Unsupported"
        // placeholders for everything. Force the init here so Stack / Button
        // / Heading / etc. resolve.
        SwiftUIJSONRender.initializeJSONRender()
    }

    #if os(iOS)
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var pushSink = PushSink()
    #endif
    @State private var router = AppRouter()
    @State private var debugLogOpen: Bool = false
    @State private var settingsOpen: Bool = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(router)
                #if os(iOS)
                .environment(pushSink)
                .task {
                    appDelegate.pushSink = pushSink
                    pushSink.router = router
                }
                #endif
                .onOpenURL { url in
                    // Triggered when another app hands us a file via iOS
                    // "Open in…" / Share Sheet, macOS "Open With", or
                    // drag-onto-dock-icon. The router buffers it until the
                    // chat view drains it into the composer.
                    router.ingestExternalURL(url)
                }
                .sheet(isPresented: $debugLogOpen) {
                    DebugLogSheet(isPresented: $debugLogOpen)
                }
                .sheet(isPresented: $settingsOpen) {
                    SettingsSheet(isPresented: $settingsOpen)
                        .environment(router)
                }
                .onAppCommand(.openDebugLog) {
                    debugLogOpen = true
                }
                .onAppCommand(.openSettings) {
                    settingsOpen = true
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        // Trigger a fresh load when the app becomes active so users
                        // returning to the app don't see stale data.
                        NotificationCenter.default.post(name: AppCommand.refresh.notification, object: nil)
                    }
                }
        }
        #if os(macOS)
        .defaultSize(width: 1100, height: 760)
        .windowResizability(.contentSize)
        .commands {
            OpenAgentsCommands()
        }
        #endif
    }
}
