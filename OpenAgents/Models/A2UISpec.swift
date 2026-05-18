import Foundation

/// A declarative UI specification emitted by an agent, intended to be
/// rendered by the client into native views. The decoder accepts any `type`
/// string and any prop shape, so the renderer is the sole authority on what's
/// actually drawable. Unknown types decode fine — they fall through to a
/// placeholder at render time rather than blocking the whole tree.
struct A2UISpec: Decodable, Sendable, Equatable {
    let schemaVersion: String?
    let root: A2UIComponent
}

/// A single node in the spec tree. `type` is an opaque discriminator; the
/// renderer maps it to a view (or to a fallback for unknown types). `props`
/// and `action.value` are kept as `JSONValue` so unknown components remain
/// introspectable without losing fidelity.
struct A2UIComponent: Decodable, Sendable, Equatable {
    let type: String
    let id: String?
    let props: JSONValue?
    let children: [A2UIComponent]?
    let action: A2UIAction?
}

/// Action descriptor on interactive components. `id` is round-tripped verbatim
/// back to the agent as part of the tool-call result; the client does not
/// interpret it. `value` carries any extra payload the agent wants delivered
/// alongside the user's interaction.
struct A2UIAction: Decodable, Sendable, Equatable {
    let id: String
    let value: JSONValue?
}
