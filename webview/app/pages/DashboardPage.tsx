import React from "react";
import { GraphCanvas } from "../components/GraphCanvas";
import { AgentBuilder } from "../components/AgentBuilder";
import { ChooseView } from "../components/ChooseView";
import { InspectView } from "../components/InspectView";
import { InspectorPanel } from "../components/InspectorPanel";
import { AgentRail } from "../components/AgentRail";
import { GuidedStepsBar } from "../components/GuidedStepsBar";
import { ApprovalPanel } from "../components/ApprovalPanel";
import { ObjectivePanel } from "../components/ObjectivePanel";
import { useStudioStore } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";

export function DashboardPage(): React.JSX.Element {
  const { uiLanguage, setUiLanguage, tx } = useI18n();
  const agents = useStudioStore((s) => s.agents);
  const workflows = useStudioStore((s) => s.workflows);
  const graph = useStudioStore((s) => s.capabilityGraph);
  const infoMessage = useStudioStore((s) => s.infoMessage);
  const errorMessage = useStudioStore((s) => s.errorMessage);
  const centerView = useStudioStore((s) => s.centerView);
  const uiPanels = useStudioStore((s) => s.uiPanels);

  const showInspectorColumn = centerView === "editor" || centerView === "graph";

  return (
    <div className="layout">
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">◆</span>
          <span className="header-title">Agent Studio</span>
          <div className="header-metrics">
            <span className="metric-chip">
              {agents.length} {tx("agents", "agentes")}
            </span>
            <span className="metric-chip">
              {workflows.length} {tx("workflows", "workflows")}
            </span>
            <span className="metric-chip">
              {graph.tools.length + graph.skills.length + graph.mcpServers.length}{" "}
              {tx("capabilities", "capacidades")}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <div className="lang-toggle">
            <button
              className={uiLanguage === "en" ? "active" : ""}
              title={tx("Switch the dashboard to English.", "Cambia el dashboard a inglés.")}
              onClick={() => setUiLanguage("en")}
            >
              EN
            </button>
            <button
              className={uiLanguage === "es" ? "active" : ""}
              title={tx("Switch the dashboard to Spanish.", "Cambia el dashboard a español.")}
              onClick={() => setUiLanguage("es")}
            >
              ES
            </button>
          </div>
          <button
            title={tx(
              "Create a new agent and open it in the builder.",
              "Crea un nuevo agent y ábrelo en el builder.",
            )}
            onClick={() => vscode?.postMessage({ type: "createAgent" })}
          >
            <span className="header-btn-icon">+</span>
            {tx("Agent", "Agent")}
          </button>
          <button
            className="secondary-button"
            title={tx(
              "Create a new workflow graph starting from a default entry step.",
              "Crea un nuevo graph de workflow empezando desde un step de entrada por defecto.",
            )}
            onClick={() => vscode?.postMessage({ type: "createWorkflow" })}
          >
            {tx("Workflow", "Workflow")}
          </button>
          <button
            className="secondary-button header-icon-button"
            title={tx(
              "Reload agents, workflows, and capabilities from disk.",
              "Recarga agents, workflows y capabilities desde disco.",
            )}
            onClick={() => vscode?.postMessage({ type: "refresh" })}
          >
            ⟳
          </button>
        </div>
      </header>

      <GuidedStepsBar />

      {infoMessage && <div className="message info">{infoMessage}</div>}
      {errorMessage && <div className="message error">{errorMessage}</div>}

      <main
        className={
          showInspectorColumn
            ? uiPanels.inspector
              ? "agent-zone-grid"
              : "agent-zone-grid inspector-collapsed"
            : "agent-zone-grid no-inspector"
        }
      >
        <AgentRail />

        <div className="center-stage">
          {centerView === "choose" && <ChooseView />}
          {centerView === "editor" && <AgentBuilder />}
          {centerView === "graph" && <GraphCanvas />}
          {centerView === "inspect" && <InspectView />}
        </div>

        {showInspectorColumn && (
          <div className="inspector-column">
            <InspectorPanel />
          </div>
        )}
      </main>

      <ApprovalPanel />
      <ObjectivePanel />
    </div>
  );
}
