import SwiftUI

/// Agent picker sheet — creates a new thread with the selected master + participants.
/// Mirrors NewThreadDialog from the Electron app.
struct NewThreadSheet: View {
    @Binding var isPresented: Bool
    @Environment(WorkspaceStore.self) private var store

    @State private var selected: Set<String> = []
    @State private var master: String?

    private var onlineAgents: [Agent] { store.onlineAgents }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("New Thread")
                        .font(.headline)
                    Text(onlineAgents.count > 1
                         ? "Pick which agents join this conversation."
                         : "Start a new conversation with your agent.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 12)

            Divider()

            // Scrollable agent list
            ScrollView {
                VStack(spacing: 6) {
                    if onlineAgents.isEmpty {
                        Text("No agents are currently online.")
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                    }
                    ForEach(onlineAgents) { agent in
                        AgentRow(
                            agent: agent,
                            isSelected: selected.contains(agent.agentName),
                            isMaster: master == agent.agentName,
                            multipleAgents: onlineAgents.count > 1,
                            toggle: { toggle(agent) },
                            setMaster: { master = agent.agentName },
                        )
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }

            Divider()

            // Footer (pinned)
            HStack {
                Spacer()
                Button("Cancel") { isPresented = false }
                    .keyboardShortcut(.cancelAction)
                Button("Start Thread") { createThread() }
                    .buttonStyle(.borderedProminent)
                    .disabled(selected.isEmpty)
                    .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
        }
        #if os(macOS)
        .frame(minWidth: 420, idealWidth: 460, minHeight: 360, idealHeight: 480, maxHeight: 640)
        #else
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #endif
        .task { await store.refreshDiscovery() }
    }

    private func toggle(_ agent: Agent) {
        let name = agent.agentName
        if selected.contains(name) {
            selected.remove(name)
            if master == name {
                master = selected.first
            }
        } else {
            selected.insert(name)
            if master == nil { master = name }
        }
    }

    private func createThread() {
        guard let chosenMaster = master ?? selected.first else { return }
        let participants = Array(selected)
        isPresented = false
        Task { await store.createThread(master: chosenMaster, participants: participants) }
    }
}

private struct AgentRow: View {
    let agent: Agent
    let isSelected: Bool
    let isMaster: Bool
    let multipleAgents: Bool
    let toggle: () -> Void
    let setMaster: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 10) {
                // Checkbox
                ZStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(isSelected ? Color.blue : .clear)
                        .frame(width: 18, height: 18)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(isSelected ? Color.blue : .secondary.opacity(0.5), lineWidth: 1.5),
                        )
                    if isSelected {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }

                // Avatar
                RoundedRectangle(cornerRadius: 6)
                    .fill(AgentPalette.color(for: agent.agentName))
                    .frame(width: 28, height: 28)
                    .overlay(
                        Text(agent.initials)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white),
                    )

                Text(agent.agentName)
                    .font(.body)
                    .lineLimit(1)
                Spacer()

                if multipleAgents && isSelected {
                    if isMaster {
                        Label("lead", systemImage: "star.fill")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.orange)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(.orange.opacity(0.15), in: Capsule())
                    } else {
                        Button("set lead", action: setMaster)
                            .buttonStyle(.borderless)
                            .font(.caption)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? Color.gray.opacity(0.12) : .clear),
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(.gray.opacity(isSelected ? 0.2 : 0.0), lineWidth: 1),
            )
            .contentShape(Rectangle())
            .opacity(isSelected ? 1.0 : 0.65)
        }
        .buttonStyle(.plain)
    }
}
