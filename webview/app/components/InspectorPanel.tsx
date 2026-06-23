import React from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";
import { roleColor } from "../utils/roleColor";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function InspectorPanel(): React.JSX.Element {
  const { tx } = useI18n();
  const selectedAgent = useStudioStore(selectors.selectedAgent);
  const inspectorOpen = useStudioStore((s) => s.uiPanels.inspector);
  const setUiPanelOpen = useStudioStore((s) => s.setUiPanelOpen);
  const setCenterView = useStudioStore((s) => s.setCenterView);

  if (!inspectorOpen) {
    return (
      <button
        className="inspector-collapsed-handle"
        onClick={() => setUiPanelOpen("inspector", true)}
        title={tx("Expand Inspector.", "Expandir Inspector.")}
      >
        <span className="inspector-collapsed-arrow">‹</span>
        <span className="inspector-collapsed-label">
          {tx("Inspector", "Inspector")}
        </span>
        <span className="inspector-collapsed-dot" />
      </button>
    );
  }

  return (
    <aside className="inspector">
      <div className="inspector-header-row">
        <span className="inspector-title">{tx("Inspector", "Inspector")}</span>
        <button
          className="inspector-collapse-btn"
          title={tx("Collapse Inspector.", "Colapsar Inspector.")}
          onClick={() => setUiPanelOpen("inspector", false)}
        >
          ›
        </button>
      </div>

      {!selectedAgent ? (
        <p className="field-hint inspector-body-empty">
          {tx(
            "Select an agent, node, or capability to inspect details.",
            "Selecciona un agent, nodo o capability para inspeccionar detalles.",
          )}
        </p>
      ) : (
        <>
          <div className="inspector-body">
            <div className="inspector-card-head">
              <span
                className="inspector-avatar"
                style={{
                  borderColor:
                    selectedAgent.sourceScope === "global"
                      ? "rgba(243,201,65,0.4)"
                      : "rgba(63,185,80,0.4)",
                }}
              >
                {initials(selectedAgent.name)}
              </span>
              <div className="inspector-card-title">
                <span className="inspector-card-name">{selectedAgent.name}</span>
                <span className="inspector-card-meta">
                  {selectedAgent.sourceScope === "global"
                    ? tx("Global", "Global")
                    : tx("Repository", "Repositorio")}
                  {" · "}
                  {selectedAgent.role || tx("no role", "sin role")}
                </span>
              </div>
            </div>

            {selectedAgent.shadowedAgent && (
              <p className="message warning" title={selectedAgent.shadowedAgent.sourcePath}>
                {tx(
                  `This agent id also exists as a ${selectedAgent.shadowedAgent.sourceScope} agent, which is shadowed and ignored.`,
                  `Este id de agent también existe como agent ${selectedAgent.shadowedAgent.sourceScope === "global" ? "global" : "de repositorio"}, que queda oculto e ignorado.`,
                )}
              </p>
            )}

            <p className="inspector-description">
              {selectedAgent.description || tx("No description", "Sin descripción")}
            </p>

            <div className="inspector-stat-grid">
              <div className="inspector-stat-box">
                <div className="inspector-stat-value">
                  {selectedAgent.capabilities.tools.length}
                </div>
                <div className="inspector-stat-label">{tx("Tools", "Tools")}</div>
              </div>
              <div className="inspector-stat-box">
                <div className="inspector-stat-value">
                  {selectedAgent.capabilities.skills.length}
                </div>
                <div className="inspector-stat-label">{tx("Skills", "Skills")}</div>
              </div>
              <div className="inspector-stat-box">
                <div className="inspector-stat-value">
                  {selectedAgent.capabilities.mcpServers.length}
                </div>
                <div className="inspector-stat-label">MCP</div>
              </div>
            </div>

            <div className="inspector-section-heading">
              {tx("capabilities", "capacidades")}
            </div>
            <div className="chip-row inspector-cap-chips">
              {selectedAgent.capabilities.tools.length === 0 ? (
                <span className="field-hint">
                  {tx("No tools configured.", "Sin Tools configurados.")}
                </span>
              ) : (
                selectedAgent.capabilities.tools.slice(0, 8).map((tool) => (
                  <span key={tool.id} className="inspector-cap-chip">
                    {tool.id}
                  </span>
                ))
              )}
            </div>

            <div className="inspector-section-heading">
              {tx("Handoffs", "Handoffs")}
            </div>
            <div className="inspector-handoff-list">
              {selectedAgent.handoffs.length === 0 ? (
                <span className="field-hint">
                  {tx("No handoffs configured.", "Sin handoffs configurados.")}
                </span>
              ) : (
                selectedAgent.handoffs.map((handoff) => {
                  const target = handoff.agent;
                  return (
                    <div key={target} className="inspector-handoff-row">
                      <span className="inspector-handoff-arrow">⇄</span>
                      {handoff.label || target}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="inspector-footer">
            <button
              className="inspector-open-chat"
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
            <div className="inspector-footer-row">
              <button
                className="secondary-button"
                title={tx(
                  "Open this agent in Agent Builder for editing.",
                  "Abre este agent en Agent Builder para editarlo.",
                )}
                onClick={() => setCenterView("editor")}
              >
                {tx("Edit", "Editar")}
              </button>
              <button
                className="secondary-button"
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
          </div>
        </>
      )}
    </aside>
  );
}
