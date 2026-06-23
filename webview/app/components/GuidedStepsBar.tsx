import React from "react";
import { useStudioStore } from "../store/useStudioStore";
import { useI18n } from "../i18n";

export function GuidedStepsBar(): React.JSX.Element {
  const { tx } = useI18n();
  const centerView = useStudioStore((s) => s.centerView);
  const setCenterView = useStudioStore((s) => s.setCenterView);
  const selectedAgentId = useStudioStore((s) => s.selectedAgentId);

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
    </div>
  );
}
