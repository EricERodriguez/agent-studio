import React, { useState } from "react";
import { useStudioStore } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";

/**
 * Full-screen overlay asking what a CLI-mode run should do — replaces
 * vscode.window.showInputBox, which is a single-line native input too cramped for a real task
 * description (a real user hit this trying to write a multi-line objective).
 */
export function ObjectivePanel(): React.JSX.Element | null {
  const { tx } = useI18n();
  const pendingObjective = useStudioStore((s) => s.pendingObjective);
  const setPendingObjective = useStudioStore((s) => s.setPendingObjective);
  const [objective, setObjective] = useState("");

  if (!pendingObjective) {
    return null;
  }

  const respond = (value: string | undefined) => {
    vscode?.postMessage({
      type: "objectiveResponse",
      payload: { requestId: pendingObjective.requestId, objective: value },
    });
    setPendingObjective(undefined);
    setObjective("");
  };

  return (
    <div className="approval-overlay">
      <div className="approval-card">
        <div className="approval-card-head">
          <span className="approval-card-title">
            {tx("What should", "¿Qué debería hacer")} “{pendingObjective.workflowName}”{" "}
            {tx("do?", "?")}
          </span>
        </div>
        <label className="approval-card-label" htmlFor="objective-textarea">
          {tx(
            "Describe the task or user story for this run",
            "Describí la tarea o historia de usuario para esta corrida",
          )}
        </label>
        <textarea
          id="objective-textarea"
          className="approval-card-instructions"
          rows={6}
          autoFocus
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder={tx(
            "e.g. Review the repo and propose 3 small improvements, then implement them",
            "ej. Revisá el repo y proponé 3 mejoras chicas, después implementalas",
          )}
        />
        <div className="approval-card-actions">
          <button className="danger" onClick={() => respond(undefined)}>
            {tx("Cancel", "Cancelar")}
          </button>
          <button disabled={!objective.trim()} onClick={() => respond(objective.trim())}>
            {tx("Start run", "Iniciar corrida")}
          </button>
        </div>
      </div>
    </div>
  );
}
