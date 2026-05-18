import SwiftUI

#if os(macOS)
import AppKit
typealias PlatformImage = NSImage
#else
import UIKit
typealias PlatformImage = UIImage
#endif

/// `AsyncImage` doesn't accept custom headers, but the workspace file
/// endpoint requires `X-Workspace-Token`. This small loader bridges that
/// gap: pre-built `URLRequest` from `WorkspaceStore.authorizedFileDownloadRequest`,
/// fetched via the shared session, cached in `URLCache.shared` so flipping
/// the sidebar open repeatedly doesn't re-download the same thumbnails.
struct AuthorizedAsyncImage: View {
    let fileId: String
    /// Whether the loaded image should fill the frame (cover, used for
    /// thumbnails) or fit inside (used for the detail view). The default
    /// is fill so existing sidebar thumbnails keep their crop behavior.
    var contentMode: ContentMode = .fill

    @Environment(WorkspaceStore.self) private var store
    @State private var phase: LoadPhase = .loading

    private enum LoadPhase {
        case loading
        case loaded(PlatformImage)
        case failed
    }

    var body: some View {
        ZStack {
            switch phase {
            case .loading:
                Rectangle()
                    .fill(.gray.opacity(0.12))
                ProgressView()
                    .controlSize(.small)
            case .failed:
                Rectangle()
                    .fill(.gray.opacity(0.12))
                Image(systemName: "photo")
                    .foregroundStyle(.tertiary)
            case .loaded(let image):
                imageView(image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            }
        }
        .task(id: fileId) {
            await load()
        }
    }

    private func load() async {
        do {
            let request = await store.authorizedFileDownloadRequest(fileId: fileId)
            let (data, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                phase = .failed
                return
            }
            #if os(macOS)
            if let img = NSImage(data: data) {
                phase = .loaded(img)
            } else {
                phase = .failed
            }
            #else
            if let img = UIImage(data: data) {
                phase = .loaded(img)
            } else {
                phase = .failed
            }
            #endif
        } catch {
            phase = .failed
        }
    }

    @ViewBuilder
    private func imageView(_ image: PlatformImage) -> Image {
        #if os(macOS)
        Image(nsImage: image)
        #else
        Image(uiImage: image)
        #endif
    }
}
