import Foundation
import ImageIO
import UniformTypeIdentifiers

#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// Local image downsampling so we never upload an image that will trip
/// Anthropic's "many-image request" limit (longest side > 2000px → entire
/// conversation breaks until /compact or new session). Applied at every paste
/// / picker / file-import ingest site.
enum ImageDownsampler {
    /// Anthropic's many-image-request limit is 2000px on the longest side.
    /// We target that exactly so screenshots from Retina displays (typ.
    /// 2880×1800) stop poisoning conversations.
    static let maxLongestSide: Int = 2000

    /// If the image already fits, returns the input unchanged. Otherwise
    /// downsamples to fit and re-encodes as PNG (lossless — screenshots and
    /// UI captures don't tolerate JPEG artifacts well). Returns the (possibly
    /// new) data, content type, and filename. Filename keeps its base name;
    /// if the extension changed we update it accordingly.
    ///
    /// Non-image inputs are returned unchanged. Decoding errors fall through
    /// to the original bytes — the upload may then fail Anthropic's check, but
    /// we don't want to silently drop user content.
    static func ensureFits(
        data: Data,
        contentType: String,
        filename: String,
    ) -> (Data, String, String) {
        guard contentType.hasPrefix("image/") else {
            return (data, contentType, filename)
        }
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = props[kCGImagePropertyPixelWidth] as? Int,
              let height = props[kCGImagePropertyPixelHeight] as? Int else {
            return (data, contentType, filename)
        }
        if max(width, height) <= maxLongestSide {
            return (data, contentType, filename)
        }

        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxLongestSide,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return (data, contentType, filename)
        }

        let pngData = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(pngData, UTType.png.identifier as CFString, 1, nil) else {
            return (data, contentType, filename)
        }
        CGImageDestinationAddImage(dest, cg, nil)
        guard CGImageDestinationFinalize(dest) else {
            return (data, contentType, filename)
        }

        let newName: String = {
            // Keep the original base name; force a .png extension since we
            // re-encoded. This makes the filename honest (.jpg of a re-encoded
            // PNG is misleading and confuses downstream tools).
            let base = (filename as NSString).deletingPathExtension
            return base.isEmpty ? filename : "\(base).png"
        }()

        return (pngData as Data, "image/png", newName)
    }
}
