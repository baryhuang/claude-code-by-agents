import Foundation
import ImageIO

#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// A file the user has selected (or pasted) in the input bar but hasn't sent yet.
/// Held in chat-view state until the user hits send, at which point we upload it
/// and reference it in the outgoing message via a markdown link.
struct PendingAttachment: Identifiable, Sendable, Equatable {
    let id: UUID
    let filename: String
    let contentType: String
    let data: Data

    init(id: UUID = UUID(), filename: String, contentType: String, data: Data) {
        self.id = id
        self.filename = filename
        self.contentType = contentType
        self.data = data
    }

    var isImage: Bool { contentType.hasPrefix("image/") }
    var size: Int { data.count }

    #if os(macOS)
    /// Decode a small thumbnail via ImageIO so we never pay the full-decode
    /// cost of the original bytes (the user may have pasted a 6 MB screenshot).
    /// Returns nil for non-image attachments or if decoding fails.
    func makeThumbnail(maxSide: CGFloat = 40) -> NSImage? {
        guard isImage,
              let cg = Self.makeThumbnailCG(data: data, maxSide: maxSide) else { return nil }
        return NSImage(cgImage: cg, size: NSSize(width: maxSide, height: maxSide))
    }
    #else
    func makeThumbnail(maxSide: CGFloat = 40) -> UIImage? {
        guard isImage,
              let cg = Self.makeThumbnailCG(data: data, maxSide: maxSide) else { return nil }
        return UIImage(cgImage: cg)
    }
    #endif

    private static func makeThumbnailCG(data: Data, maxSide: CGFloat) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let scale: CGFloat = {
            #if os(macOS)
            return NSScreen.main?.backingScaleFactor ?? 2
            #else
            return UIScreen.main.scale
            #endif
        }()
        let pixelSize = Int(maxSide * scale)
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: pixelSize,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }
}
