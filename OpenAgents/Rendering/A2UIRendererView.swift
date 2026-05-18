import SwiftUI
import SwiftUIJSONRender

/// Renders an A2UI-shaped JSON spec emitted by an agent. The spec format
/// aligns with SwiftUIJSONRender's schema (type/props/children + action),
/// which is structurally A2UI-shaped — a formal A2UI/SwiftUIJSONRender shim
/// gets added here as the two schemas diverge.
///
/// All failure modes (malformed JSON, schema version mismatch, unknown
/// component types) are handled by the underlying `JSONView`:
/// - parse error → error banner inside the bubble
/// - version mismatch → version banner
/// - unknown `type` → small placeholder chip (default `.placeholder` behavior)
///
/// Siblings of a failed/unknown component still render; one bad subtree never
/// blanks the rest of the spec.
struct A2UIRendererView: View {
    /// Raw JSON string emitted by the agent. We pass it through verbatim so
    /// we don't lose fidelity in a re-encode round-trip.
    let json: String

    /// Fired when the user interacts with any action-bearing component in the
    /// spec (button, choice list, confirm dialog, etc). The agent's `action.name`
    /// is round-tripped as `A2UIAction.id`; any params land in `value`.
    var onAction: ((A2UIAction) -> Void)?

    var body: some View {
        JSONView(json)
            .theme(OpenAgentsGoTheme.self)
            .onAction { action in
                onAction?(bridge(action))
            }
    }

    /// Bridge SwiftUIJSONRender's `Action` shape (`name` + `params`) to our
    /// `A2UIAction` (`id` + `value`). The agent decides what the id means;
    /// we never interpret it.
    private func bridge(_ action: SwiftUIJSONRender.Action) -> A2UIAction {
        let value: JSONValue?
        if let params = action.params, !params.isEmpty {
            value = JSONValue.fromAnyCodableDictionary(params)
        } else {
            value = nil
        }
        return A2UIAction(id: action.name, value: value)
    }
}

extension JSONValue {
    /// Best-effort conversion from SwiftUIJSONRender's `[String: AnyCodable]` to
    /// our `JSONValue`. Re-encodes through `JSONEncoder` to avoid handling each
    /// AnyCodable case by hand; the round-trip is robust because `AnyCodable`
    /// itself is JSON-compatible.
    static func fromAnyCodableDictionary(_ dict: [String: AnyCodable]) -> JSONValue? {
        guard let data = try? JSONEncoder().encode(dict) else { return nil }
        return try? JSONDecoder().decode(JSONValue.self, from: data)
    }
}

// MARK: - Previews

#Preview("Prose") {
    A2UIRendererView(json: """
    {
      "type": "Stack",
      "props": { "direction": "vertical", "spacing": 8 },
      "children": [
        { "type": "Heading", "props": { "text": "Hello", "level": 2 } },
        { "type": "Text", "props": { "content": "A simple prose layout." } }
      ]
    }
    """)
    .padding()
}

#Preview("Choice list") {
    A2UIRendererView(json: """
    {
      "type": "Stack",
      "props": { "direction": "vertical", "spacing": 12 },
      "children": [
        { "type": "Heading", "props": { "text": "Pick a date", "level": 2 } },
        { "type": "Button",
          "props": { "label": "Today",
                     "action": { "name": "pick_today" } } },
        { "type": "Button",
          "props": { "label": "Tomorrow",
                     "action": { "name": "pick_tomorrow" } } },
        { "type": "Button",
          "props": { "label": "Custom",
                     "action": { "name": "pick_custom" } } }
      ]
    }
    """) { action in
        print("Action: \\(action.id)")
    }
    .padding()
}

#Preview("Unknown component fallback") {
    A2UIRendererView(json: """
    {
      "type": "Stack",
      "props": { "direction": "vertical", "spacing": 8 },
      "children": [
        { "type": "Heading", "props": { "text": "Mixed render", "level": 2 } },
        { "type": "InteractiveDataExplorer3D",
          "props": { "data": [1, 2, 3] } },
        { "type": "Text",
          "props": { "content": "Sibling rendered fine despite the unknown above." } }
      ]
    }
    """)
    .padding()
}

#Preview("Malformed JSON") {
    A2UIRendererView(json: "not even json")
        .padding()
}
