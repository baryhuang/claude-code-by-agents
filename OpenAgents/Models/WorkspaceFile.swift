import Foundation

/// A file stored in the workspace's shared object storage. Mirrors the
/// `GET /v1/files` response shape — the backend returns snake_case fields,
/// hence the explicit `CodingKeys`.
struct WorkspaceFile: Identifiable, Decodable, Sendable, Equatable {
    let id: String
    let filename: String
    let contentType: String
    let size: Int
    let uploadedBy: String?
    let channelName: String?
    /// Status is returned by `GET /v1/files` but omitted from
    /// `GET /v1/files/{id}/info` — keep it optional so a single model decodes
    /// both endpoint shapes without a separate DTO.
    let status: String?
    /// ISO-8601 string from the backend, or nil for legacy rows. Sort the
    /// list using `createdAtDate` rather than the raw string.
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case filename
        case contentType = "content_type"
        case size
        case uploadedBy = "uploaded_by"
        case channelName = "channel_name"
        case status
        case createdAt = "created_at"
    }

    /// Path-style filename split — chat shows the basename, the file detail
    /// view shows the full path. Files are flat (no real folders); "folder"
    /// structure is naming convention only.
    var basename: String {
        (filename as NSString).lastPathComponent
    }

    var createdAtDate: Date? {
        guard let raw = createdAt else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: raw) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: raw)
    }

    /// Quick classification driving the sidebar's preview treatment — image
    /// thumbnail, text card, etc. We check content type first then fall back
    /// to extension since some uploads land with `application/octet-stream`.
    enum Kind { case image, text, pdf, audio, video, archive, code, other }

    var kind: Kind {
        let ct = contentType.lowercased()
        if ct.hasPrefix("image/") { return .image }
        if ct.hasPrefix("audio/") { return .audio }
        if ct.hasPrefix("video/") { return .video }
        if ct == "application/pdf" { return .pdf }
        if ct.hasPrefix("text/") || ct.contains("json") || ct.contains("xml") { return .text }
        let ext = (filename as NSString).pathExtension.lowercased()
        switch ext {
        case "png", "jpg", "jpeg", "gif", "webp", "heic", "svg": return .image
        case "pdf":                                              return .pdf
        case "txt", "md", "log", "json", "xml", "csv", "yaml":   return .text
        case "swift", "py", "js", "ts", "tsx", "go", "rs", "rb": return .code
        case "mp3", "wav", "m4a", "flac":                        return .audio
        case "mp4", "mov", "m4v", "webm":                        return .video
        case "zip", "tar", "gz", "7z":                           return .archive
        default:                                                 return .other
        }
    }
}

/// `GET /v1/files` response payload — the backend wraps it in the standard
/// envelope (`code`, `message`, `data`), so we decode `WorkspaceFileListResponse`
/// as `T` in `APIEnvelope<T>`.
struct WorkspaceFileListResponse: Decodable, Sendable {
    let files: [WorkspaceFile]
    let total: Int
}
