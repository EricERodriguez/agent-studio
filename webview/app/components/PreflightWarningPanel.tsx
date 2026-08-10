import React from "react";
import { useStudioStore } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";

/**
 * A dashboard-hosted confirmation for preflight warnings. Native VS Code modals did not surface
 * reliably from the Extension Development Host while the dashboard webview was active.
 */
export function PreflightWarningPanel(): React.JSX.Element | null {
  const { tx } = useI18n();
  const pendingWarning = useStudioStore((s) => s.pendingPreflightWarning);
  const setPendingWarning = useStudioStore((s) => s.setPendingPreflightWarning);

  if (!pendingWarning) {
    return null;
  }

  const respond = (proceed: boolean) => {
    vscode?.postMessage({
      type: "preflightWarningResponse",
      payload: { requestId: pendingWarning.requestId, continue: proceed },
    });
    setPendingWarning(undefined);
  };

  return (
    <div className="approval-overlay">
      <div className="approval-card">
        <div className="approval-card-head">
          <span className="approval-card-title">
            {tx("Preflight warning for", "Advertencia previa para")} “{pendingWarning.workflowName}”
          </span>
        </div>
        <div className="approval-card-label">
          {tx("Review this before starting the agents", "Revisá esto antes de iniciar los agentes")}
        </div>
        <ul className="approval-card-context">
          {pendingWarning.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
        <div className="approval-card-actions">
          <button className="danger" onClick={() => respond(false)}>
            {tx("Cancel", "Cancelar")}
          </button>
          <button onClick={() => respond(true)}>
            {tx("Continue anyway", "Continuar de todos modos")}
          </button>
        </div>
      </div>
    </div>
  );
}
