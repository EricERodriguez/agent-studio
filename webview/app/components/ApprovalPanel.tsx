import React, { useState } from "react";
import { useStudioStore } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";
import type { WorkflowApprovalRequest } from "../types";

/**
 * Full-screen overlay for a pending human handoff approval — replaces the native
 * vscode.window.showWarningMessage modal used in the first cut, which truncated the predecessor's
 * output and had no way to attach instructions. Renders the full, scrollable context and lets the
 * user approve (optionally with instructions folded into the next agent's prompt) or reject.
 */
function ApprovalCard({ request }: { request: WorkflowApprovalRequest }): React.JSX.Element {
  const { tx } = useI18n();
  const removeApprovalRequest = useStudioStore((s) => s.removeApprovalRequest);
  const [instructions, setInstructions] = useState("");

  const respond = (decision: "approve" | "reject") => {
    vscode?.postMessage({
      type: "approvalResponse",
      payload: {
        requestId: request.requestId,
        decision,
        instructions: decision === "approve" ? instructions.trim() || undefined : undefined,
      },
    });
    removeApprovalRequest(request.requestId);
  };

  return (
    <div className="approval-card">
      <div className="approval-card-head">
        <span className="approval-card-title">
          {tx("Approve handoff to", "Aprobar handoff hacia")} “{request.agentName}”
        </span>
      </div>
      <div className="approval-card-label">
        {tx("Previous agent's output", "Output del agente anterior")}
      </div>
      <pre className="approval-card-context">
        {request.context || tx("(no output)", "(sin output)")}
      </pre>
      <label className="approval-card-label" htmlFor={`approval-instructions-${request.requestId}`}>
        {tx(
          "Optional instructions for the next agent (added if you approve)",
          "Instrucciones opcionales para el próximo agente (se agregan si aprobás)",
        )}
      </label>
      <textarea
        id={`approval-instructions-${request.requestId}`}
        className="approval-card-instructions"
        rows={3}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder={tx(
          "e.g. focus only on the API layer, skip the UI for now",
          "ej. enfocate sólo en la capa de API, dejá la UI para después",
        )}
      />
      <div className="approval-card-actions">
        <button className="danger" onClick={() => respond("reject")}>
          {tx("Reject", "Rechazar")}
        </button>
        <button onClick={() => respond("approve")}>
          {tx("Approve", "Aprobar")}
        </button>
      </div>
    </div>
  );
}

export function ApprovalPanel(): React.JSX.Element | null {
  const pendingApprovals = useStudioStore((s) => s.pendingApprovals);

  if (pendingApprovals.length === 0) {
    return null;
  }

  return (
    <div className="approval-overlay">
      {pendingApprovals.map((request) => (
        <ApprovalCard key={request.requestId} request={request} />
      ))}
    </div>
  );
}
