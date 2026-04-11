import React from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";

export function InspectorPanel(): React.JSX.Element {
  const { tx } = useI18n();
  const selectedAgent = useStudioStore(selectors.selectedAgent);
  const capabilityGraph = useStudioStore((s) => s.capabilityGraph);
  const selectedCapabilityId = useStudioStore((s) => s.selectedCapabilityId);

  if (selectedCapabilityId) {
    const tool = capabilityGraph.tools.find(
      (item) => item.id === selectedCapabilityId,
    );
    const skill = capabilityGraph.skills.find(
      (item) => item.id === selectedCapabilityId,
    );
    const mcp = capabilityGraph.mcpServers.find(
      (item) => item.id === selectedCapabilityId,
    );
    const title =
      tool?.label ||
      skill?.label ||
      mcp?.label ||
      tx("Capability", "Capability");
    const users =
      capabilityGraph.usage.tools[selectedCapabilityId] ||
      capabilityGraph.usage.skills[selectedCapabilityId] ||
      capabilityGraph.usage.mcpServers[selectedCapabilityId] ||
      [];

    return (
      <aside className="inspector">
        <h3>{title}</h3>
        <p>
          {tx("Used by", "Usado por")} {users.length} {tx("agents", "agents")}
        </p>
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
        <h3>{tx("Inspector", "Inspector")}</h3>
        <p>
          {tx(
            "Select an agent, node, or capability to inspect details.",
            "Selecciona un agent, nodo o capability para inspeccionar detalles.",
          )}
        </p>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <h3>{selectedAgent.name}</h3>
      <p>
        {selectedAgent.description || tx("No description", "Sin descripción")}
      </p>
      <p>
        <strong>{tx("Role", "Role")}:</strong> {selectedAgent.role || "n/a"}
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
        <button
          title={tx(
            "Open this agent directly in chat to use it immediately.",
            "Abre este agent directamente en chat para usarlo de inmediato.",
          )}
          onClick={() =>
            vscode?.postMessage({
              type: "openInChat",
              payload: { agentId: selectedAgent.id },
            })
          }
        >
          {tx("Open in Chat", "Abrir en Chat")}
        </button>
        <button
          title={tx(
            "Open this agent in Agent Builder for editing.",
            "Abre este agent en Agent Builder para editarlo.",
          )}
          onClick={() =>
            vscode?.postMessage({
              type: "editAgent",
              payload: { agentId: selectedAgent.id },
            })
          }
        >
          {tx("Edit", "Editar")}
        </button>
        <button
          title={tx(
            "Reveal the source file that defines this agent.",
            "Muestra el archivo fuente que define este agent.",
          )}
          onClick={() =>
            vscode?.postMessage({
              type: "openRawAgent",
              payload: { agentId: selectedAgent.id },
            })
          }
        >
          {tx("Reveal File", "Mostrar archivo")}
        </button>
      </div>
    </aside>
  );
}
