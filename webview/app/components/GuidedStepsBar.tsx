import React from "react";
import { useStudioStore } from "../store/useStudioStore";
import { useI18n } from "../i18n";

export function GuidedStepsBar(): React.JSX.Element {
  const { tx } = useI18n();
  const centerView = useStudioStore((s) => s.centerView);
  const setCenterView = useStudioStore((s) => s.setCenterView);
  const selectedAgentId = useStudioStore((s) => s.selectedAgentId);
  const agentDraftStatus = useStudioStore((s) => s.agentDraftStatus);
  const requestAgentSave = useStudioStore((s) => s.requestAgentSave);

  const steps: Array<{
    key: "choose" | "editor" | "graph" | "inspect";
    label: string;
    disabled?: boolean;
  }> = [
    { key: "choose", label: tx("Choose", "Elegir") },
    { key: "editor", label: tx("Edit", "Editar"), disabled: !selectedAgentId },
    { key: "graph", label: tx("Graph", "Grafo") },
    { key: "inspect", label: tx("Inspect", "Inspeccionar"), disabled: !selectedAgentId },
  ];

  return (
    <div className="guided-steps-bar">
      <div className="guided-steps">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            {index > 0 && <span className="guided-step-sep">›</span>}
            <button
              className={
                centerView === step.key ? "guided-step active" : "guided-step"
              }
              disabled={step.disabled}
              onClick={() => setCenterView(step.key)}
            >
              <span className="guided-step-index">{index + 1}</span>
              {step.label}
            </button>
          </React.Fragment>
        ))}
      </div>
      <div className="guided-steps-right">
        <div className="center-toggle">
          <button
            className={centerView === "editor" ? "active" : ""}
            disabled={!selectedAgentId}
            title={tx("Show the agent editor.", "Muestra el editor del agent.")}
            onClick={() => setCenterView("editor")}
          >
            {tx("Editor", "Editor")}
          </button>
          <button
            className={centerView === "graph" ? "active" : ""}
            title={tx(
              "Show the agent or workflow graph.",
              "Muestra el grafo de agents o de workflow.",
            )}
            onClick={() => setCenterView("graph")}
          >
            {tx("Graph", "Grafo")}
          </button>
        </div>
        <button
          className="guided-save-pill"
          disabled={!selectedAgentId || !agentDraftStatus.valid}
          title={tx(
            "Save the currently selected agent.",
            "Guarda el agent seleccionado actualmente.",
          )}
          onClick={() => requestAgentSave()}
        >
          {!agentDraftStatus.valid
            ? tx("Fix errors", "Corregir errores")
            : agentDraftStatus.dirty
              ? tx("Save", "Guardar")
              : tx("Saved", "Guardado")}
        </button>
      </div>
    </div>
  );
}
