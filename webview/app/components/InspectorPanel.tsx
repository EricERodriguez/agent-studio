import React from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";

export function InspectorPanel(): React.JSX.Element {
  const selectedAgent = useStudioStore(selectors.selectedAgent);
  const capabilityGraph = useStudioStore((s) => s.capabilityGraph);
  const selectedCapabilityId = useStudioStore((s) => s.selectedCapabilityId);

  if (selectedCapabilityId) {
    const tool = capabilityGraph.tools.find((item) => item.id === selectedCapabilityId);
    const skill = capabilityGraph.skills.find((item) => item.id === selectedCapabilityId);
    const mcp = capabilityGraph.mcpServers.find((item) => item.id === selectedCapabilityId);
    const title = tool?.label || skill?.label || mcp?.label || "Capability";
    const users =
      capabilityGraph.usage.tools[selectedCapabilityId] ||
      capabilityGraph.usage.skills[selectedCapabilityId] ||
      capabilityGraph.usage.mcpServers[selectedCapabilityId] ||
      [];

    return (
      <aside className="inspector">
        <h3>{title}</h3>
        <p>Used by {users.length} agents</p>
        <ul>
          {users.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      </aside>
    );
  }

  if (!selectedAgent) {
    return (
      <aside className="inspector">
        <h3>Inspector</h3>
        <p>Select an agent, node, or capability to inspect details.</p>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <h3>{selectedAgent.name}</h3>
      <p>{selectedAgent.description || "No description"}</p>
      <p>
        <strong>Role:</strong> {selectedAgent.role || "n/a"}
      </p>
      <p>
        <strong>Tools:</strong> {selectedAgent.capabilities.tools.length}
      </p>
      <p>
        <strong>Skills:</strong> {selectedAgent.capabilities.skills.length}
      </p>
      <p>
        <strong>MCP:</strong> {selectedAgent.capabilities.mcpServers.length}
      </p>
      <div className="inspector-actions">
        <button onClick={() => vscode?.postMessage({ type: "openInChat", payload: { agentId: selectedAgent.id } })}>Open in Chat</button>
        <button onClick={() => vscode?.postMessage({ type: "editAgent", payload: { agentId: selectedAgent.id } })}>Edit</button>
        <button onClick={() => vscode?.postMessage({ type: "openRawAgent", payload: { agentId: selectedAgent.id } })}>Reveal File</button>
      </div>
    </aside>
  );
}
