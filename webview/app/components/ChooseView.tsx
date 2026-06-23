import React from "react";
import { useStudioStore } from "../store/useStudioStore";
import { useI18n } from "../i18n";
import { roleColor } from "../utils/roleColor";
import { filterAgentsByCapabilities } from "../utils/agentFilters";
import { vscode } from "../hooks/useVsCodeApi";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ChooseView(): React.JSX.Element {
  const { tx } = useI18n();
  const agents = useStudioStore((s) => s.agents);
  const workflows = useStudioStore((s) => s.workflows);
  const filters = useStudioStore((s) => s.filters);
  const selectedAgentId = useStudioStore((s) => s.selectedAgentId);
  const selectAgent = useStudioStore((s) => s.selectAgent);
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow);
  const setCenterView = useStudioStore((s) => s.setCenterView);
  const setGraphMode = useStudioStore((s) => s.setGraphMode);
  const setUiPanelOpen = useStudioStore((s) => s.setUiPanelOpen);
  const setTab = useStudioStore((s) => s.setTab);

  const visibleAgents = filterAgentsByCapabilities(agents, filters);

  const openAgent = (agentId: string): void => {
    selectAgent(agentId);
    setTab("Identity");
    setCenterView("editor");
    setUiPanelOpen("inspector", true);
  };

  const openWorkflow = (workflowId: string): void => {
    selectWorkflow(workflowId);
    setGraphMode("workflow");
    setCenterView("graph");
  };

  return (
    <div className="choose-view">
      <h2 className="choose-title">{tx("Choose what to work on", "Elegí con qué trabajar")}</h2>
      <p className="field-hint">
        {tx(
          "Pick an agent to edit, or open a workflow.",
          "Elegí un agent para editar, o abrí un workflow.",
        )}
      </p>

      <div className="choose-section-heading">
        {tx("Agents", "Agents")} · {visibleAgents.length}
      </div>
      {visibleAgents.length === 0 ? (
        <p className="field-hint">
          {tx("No agents match the current filters.", "Ningún agent coincide con los filtros actuales.")}
        </p>
      ) : (
        <div className="choose-agent-grid">
          {visibleAgents.map((agent) => (
            <button
              key={agent.id}
              className={
                agent.id === selectedAgentId ? "choose-card selected" : "choose-card"
              }
              onClick={() => openAgent(agent.id)}
              title={agent.description || agent.name}
            >
              <div className="choose-card-head">
                <span className="choose-card-avatar" style={{ borderColor: roleColor(agent.role) }}>
                  {initials(agent.name)}
                </span>
                <div className="choose-card-title">
                  <span className="choose-card-name">{agent.name}</span>
                  <span className="choose-card-role">{agent.role || tx("no role", "sin role")}</span>
                </div>
                <span className="choose-card-scope">
                  {agent.sourceScope === "global" ? tx("Global", "Global") : tx("Repo", "Repo")}
                </span>
              </div>
              <p className="choose-card-description">
                {agent.description || tx("No description", "Sin descripción")}
              </p>
              <div className="choose-card-foot">
                <span className="choose-card-counts">
                  T·S·M {agent.capabilities.tools.length}/{agent.capabilities.skills.length}/
                  {agent.capabilities.mcpServers.length}
                </span>
                <span className="choose-card-open">{tx("Open", "Abrir")} ›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="choose-section-heading">{tx("Workflows", "Workflows")}</div>
      {workflows.length === 0 ? (
        <p className="field-hint">
          {tx("No workflows yet. Create one from the header.", "Todavía no hay workflows. Crea uno desde el header.")}
        </p>
      ) : (
        <div className="choose-workflow-row">
          {workflows.map((workflow) => (
            <button
              key={workflow.id}
              className="choose-workflow-chip"
              onClick={() => openWorkflow(workflow.id)}
            >
              <span className="choose-workflow-icon">⛓</span>
              <span className="choose-workflow-text">
                <span className="choose-workflow-name">{workflow.name}</span>
                <span className="choose-workflow-meta">
                  {workflow.nodes.length} {tx("steps", "pasos")} ·{" "}
                  {workflow.nodes.filter((node) => node.isEntry).length} {tx("entry", "entrada")} ·{" "}
                  {workflow.sourceScope === "global" ? tx("Global", "Global") : tx("Repo", "Repo")}
                </span>
              </span>
              <span className="choose-card-open">{tx("Open", "Abrir")} ›</span>
            </button>
          ))}
        </div>
      )}

      <div className="choose-section-heading">
        {tx("Export / Import", "Exportar / Importar")}
      </div>
      <div className="export-import-card">
        <p className="field-hint">
          {tx(
            "Move agents between machines or share them with your team: export everything to a folder, scaffold a fresh repo-shaped folder ready to commit, or import agents that were exported earlier.",
            "Movés agents entre máquinas o los compartís con tu equipo: exportá todo a una carpeta, armá una carpeta nueva con forma de repo lista para subir, o importá agents que se exportaron antes.",
          )}
        </p>
        <div className="export-import-actions">
          <button
            type="button"
            title={tx(
              "Write every loaded agent as a .agent.md file into a folder you choose.",
              "Escribe cada agent cargado como un archivo .agent.md en una carpeta que elijas.",
            )}
            onClick={() => vscode?.postMessage({ type: "exportAllAgents" })}
          >
            {tx("Export All Agents", "Exportar Todos los Agents")}
          </button>
          <button
            type="button"
            className="secondary-button"
            title={tx(
              "Create a new folder with a .github/agents structure (plus a short README) containing every loaded agent, ready to become a repo.",
              "Crea una carpeta nueva con estructura .github/agents (y un README breve) con todos los agents cargados, lista para convertirse en un repo.",
            )}
            onClick={() => vscode?.postMessage({ type: "createRepoStructure" })}
          >
            {tx("Create Repo Structure", "Crear Estructura de Repo")}
          </button>
          <button
            type="button"
            className="secondary-button"
            title={tx(
              "Pick a folder with previously exported .agent.md files and import the ones that don't already exist here.",
              "Elegí una carpeta con archivos .agent.md exportados antes e importá los que todavía no existen acá.",
            )}
            onClick={() => vscode?.postMessage({ type: "importAgents" })}
          >
            {tx("Import Agents", "Importar Agents")}
          </button>
        </div>
      </div>
    </div>
  );
}
