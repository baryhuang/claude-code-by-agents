import Foundation

enum APIError: LocalizedError, Sendable {
    case notConfigured
    case http(status: Int, body: String)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Workspace API is not configured. Set workspace ID + token first."
        case .http(let status, let body):
            return "HTTP \(status): \(body)"
        case .decoding(let detail):
            return "Failed to decode response: \(detail)"
        case .transport(let detail):
            return detail
        }
    }
}

/// Standard envelope returned by the workspace backend.
struct APIEnvelope<T: Decodable & Sendable>: Decodable, Sendable {
    let code: Int
    let message: String
    let data: T
}
