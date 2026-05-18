import Foundation

/// A parsed intermediate step — extracted from a status/thinking message's content.
/// Mirrors the React app's `parseStepContent` in `intermediate-steps.tsx`.
enum ParsedStep: Sendable, Equatable {
    case thinking(text: String?)               // "thinking..." placeholder OR thinking with content
    case toolCall(tool: String, summary: String?, args: String?)
    case compacting(text: String)
    case status(text: String)
}

enum StepParser {
    /// Parse the content of an agent status/thinking message into a structured step.
    /// Handles the "Claude adapter" and "Codex adapter" formats produced by the workspace agents.
    static func parse(content: String, messageType: String) -> ParsedStep {
        // Already-typed thinking message — no need to parse markers
        if messageType == "thinking" {
            let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
            return .thinking(text: trimmed.isEmpty ? nil : trimmed)
        }

        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)

        // Bare "thinking..." / "thinking" placeholder
        if trimmed.lowercased() == "thinking..." || trimmed.lowercased() == "thinking" {
            return .thinking(text: nil)
        }

        // Claude adapter: **Thinking:**\n{content}
        if let match = trimmed.range(of: #"^\*\*Thinking:\*\*\s*\n?([\s\S]+)$"#, options: .regularExpression) {
            let body = String(trimmed[match])
                .replacingOccurrences(of: #"^\*\*Thinking:\*\*\s*\n?"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return .thinking(text: body.isEmpty ? nil : body)
        }

        // Claude adapter: **Using tool:** `ToolName`\n```\n{args}\n```
        if let toolName = firstCapture(in: trimmed, pattern: #"\*\*Using tool:\*\*\s*`([^`]+)`"#) {
            let args = firstCapture(in: trimmed, pattern: #"```([\s\S]*?)```"#)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let display = cleanToolName(toolName)
            let summary = args.flatMap { extractToolSummary(tool: display, args: $0) }
            return .toolCall(tool: display, summary: summary, args: args)
        }

        // Codex adapter: **Running:** `command`
        if let cmd = firstCapture(in: trimmed, pattern: #"\*\*Running:\*\*\s*`([^`]+)`"#) {
            return .toolCall(tool: "Bash", summary: cmd, args: nil)
        }

        // Codex adapter: **Editing:** `filename`
        if let file = firstCapture(in: trimmed, pattern: #"\*\*Editing:\*\*\s*`([^`]+)`"#) {
            return .toolCall(tool: "Edit", summary: file, args: nil)
        }

        // Compaction
        if trimmed.range(of: "compact", options: .caseInsensitive) != nil {
            return .compacting(text: trimmed)
        }

        return .status(text: trimmed)
    }

    /// `mcp__openagents-workspace__workspace_status` → `workspace_status`
    private static func cleanToolName(_ name: String) -> String {
        if let m = firstCapture(in: name, pattern: #"^mcp__[^_]+__(.+)$"#) { return m }
        if let m = firstCapture(in: name, pattern: #"^mcp_[^_]+--.+?__(.+)$"#) { return m }
        return name
    }

    /// Pull a short summary out of a tool's args dict — file path, command, status, etc.
    private static func extractToolSummary(tool: String, args: String) -> String? {
        if ["Write", "Read", "Edit"].contains(tool),
           let path = firstCapture(in: args, pattern: #"'file_path':\s*'([^']+)'"#) {
            return path
        }
        if tool == "Bash",
           let cmd = firstCapture(in: args, pattern: #"'command':\s*'([^']+)'"#) {
            return String(cmd.prefix(80))
        }
        if let status = firstCapture(in: args, pattern: #"'status':\s*'([^']+)'"#) { return status }
        if let snippet = firstCapture(in: args, pattern: #"'content':\s*'([^']{0,60})"#) {
            return snippet + (snippet.count >= 60 ? "..." : "")
        }
        if let pat = firstCapture(in: args, pattern: #"'pattern':\s*'([^']+)'"#) { return pat }
        return args.count > 60 ? String(args.prefix(60)) + "..." : args
    }

    /// Run an NSRegularExpression and return the first capture group's string, if any.
    private static func firstCapture(in input: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]) else {
            return nil
        }
        let range = NSRange(input.startIndex..., in: input)
        guard let match = regex.firstMatch(in: input, options: [], range: range),
              match.numberOfRanges > 1,
              let captureRange = Range(match.range(at: 1), in: input) else {
            return nil
        }
        return String(input[captureRange])
    }
}
