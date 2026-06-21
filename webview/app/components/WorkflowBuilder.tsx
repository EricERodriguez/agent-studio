import React, { useState, useEffect } from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";

export function WorkflowBuilder(): React.JSX.Element {
  const { tx } = useI18n();
  const selectedWorkflow = useStudioStore(selectors.selectedWorkflow);
  const agents = useStudioStore((s) => s.agents);
  const workflowRun = useStudioStore((s) => s.workflowRun);
  const addWorkflowStep = useStudioStore((s) => s.addWorkflowStep);
  const removeWorkflowStep = useStudioStore((s) => s.removeWorkflowStep);
  const setWorkflowEntryStep = useStudioStore((s) => s.setWorkflowEntryStep);
  const updateWorkflowMeta = useStudioStore((s) => s.updateWorkflowMeta);

  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [runMode, setRunMode] = useState<"chat" | "plan">("chat");

  const selectedWorkflowRun =
    selectedWorkflow && workflowRun?.workflowId === selectedWorkflow.id
      ? workflowRun
      : undefined;

  useEffect(() => {
    if (selectedWorkflow) {
      setName(selectedWorkflow.name);
      setDescription(selectedWorkflow.description ?? "");
    }
  }, [selectedWorkflow?.id]);

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentToAdd) {
      setSelectedAgentToAdd(agents[0].id);
    }
  }, [agents]);

  if (!selectedWorkflow) {
    return (
      <section className="panel">
        <h2>{tx("Workflow Editor", "Editor de Workflow")}</h2>
        <p className="field-hint">
          {tx(
            "Select a workflow from the toolbar above, or create one with the Create Workflow button.",
            "Selecciona un workflow desde la barra superior o crea uno con el botón Create Workflow.",
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>{tx("Workflow Editor", "Editor de Workflow")}</h2>
      <p className="field-hint">
        {tx(
          "A workflow is a directed graph of agent steps. Add agents as steps, mark one as the entry point, then draw connections between steps in the Workflow Graph by dragging from one node's handle to another.",
          "Un workflow es un graph dirigido de steps de agents. Agrega agents como steps, marca uno como punto de entrada y luego dibuja conexiones entre steps en el Workflow Graph arrastrando desde un handle a otro nodo.",
        )}
      </p>

      <label>
        {tx("Name", "Nombre")}
        <input
          title="Workflow name shown in the sidebar and dashboard."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => updateWorkflowMeta(selectedWorkflow.id, { name })}
        />
      </label>

      <label>
        {tx("Description", "Descripción")}
        <input
          title="Optional description to explain the purpose of this workflow."
          value={description}
          placeholder={tx("Optional description", "Descripción opcional")}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            updateWorkflowMeta(selectedWorkflow.id, { description })
          }
        />
      </label>

      <label>
        {tx("Scope", "Scope")}
        <select
          title="Choose whether this workflow belongs to the current repository or is available globally."
          value={selectedWorkflow.sourceScope || "repository"}
          onChange={(e) =>
            updateWorkflowMeta(selectedWorkflow.id, {
              sourceScope: e.target.value as "repository" | "global",
            })
          }
        >
          <option value="repository">
            {tx("Repository", "Repositorio")}
          </option>
          <option value="global">{tx("Global", "Global")}</option>
        </select>
        <small className="field-hint">
          {tx(
            "Repository workflows are saved in the current repo. Global workflows are available across repos.",
            "Los workflows de repositorio se guardan en el repo actual. Los globales están disponibles en cualquier repo.",
          )}
        </small>
      </label>

      <div className="helper-card">
        <strong>{tx("Steps", "Steps")}</strong>{" "}
        {tx(
          "— each step runs a specific agent. The",
          "— cada step ejecuta un agent específico. El",
        )}{" "}
        <em>{tx("Entry", "Entry")}</em>{" "}
        {tx(
          "step is where the workflow starts. Connections between steps define the execution order (draw them in the graph on the right).",
          "step es donde empieza el workflow. Las conexiones entre steps definen el orden de ejecución (dibújalas en el graph de la derecha).",
        )}
      </div>

      <div className="inline-form-row">
        <label className="grow">
          {tx("Add Agent as Step", "Agregar Agent como Step")}
          <select
            title="Pick an agent to add as a new workflow step."
            value={selectedAgentToAdd}
            onChange={(e) => setSelectedAgentToAdd(e.target.value)}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.id})
              </option>
            ))}
          </select>
        </label>
        <button
          title="Add the selected agent as a new step in this workflow."
          onClick={() => {
            if (selectedAgentToAdd) {
              addWorkflowStep(selectedWorkflow.id, selectedAgentToAdd);
            }
          }}
          disabled={!selectedAgentToAdd}
        >
          {tx("Add Step", "Agregar Step")}
        </button>
      </div>

      {selectedWorkflow.nodes.length === 0 ? (
        <p className="field-hint">
          {tx(
            "No steps yet. Select an agent above and click Add Step.",
            "Todavía no hay steps. Selecciona un agent arriba y haz click en Add Step.",
          )}
        </p>
      ) : (
        <ul className="compact-list step-list">
          {selectedWorkflow.nodes.map((node) => {
            const agent = agents.find((a) => a.id === node.agentId);
            return (
              <li key={node.id} className="removable-chip-row step-item">
                <span className="step-item-name">
                  {agent?.name ?? node.agentId}
                </span>
                {node.isEntry ? (
                  <span className="skill-tag selected">Entry</span>
                ) : (
                  <button
                    title={tx(
                      "Make this step the workflow entry point.",
                      "Convierte este step en el punto de entrada del workflow.",
                    )}
                    onClick={() =>
                      setWorkflowEntryStep(selectedWorkflow.id, node.id)
                    }
                  >
                    {tx("Set Entry", "Definir Entry")}
                  </button>
                )}
                <button
                  title={tx(
                    "Remove this step and any connected edges from the workflow.",
                    "Quita este step y cualquier arista conectada del workflow.",
                  )}
                  onClick={() =>
                    removeWorkflowStep(selectedWorkflow.id, node.id)
                  }
                >
                  {tx("Remove", "Quitar")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="field-hint">
        {tx(
          "To connect steps: in the Workflow Graph on the right, hover a node to reveal its handles, then drag from one handle to another node to create an edge.",
          "Para conectar steps: en el Workflow Graph de la derecha, pasa por encima de un nodo para mostrar sus handles y luego arrastra desde un handle a otro nodo para crear una arista.",
        )}
      </p>

      <div className="helper-card" style={{ marginBottom: 8 }}>
        <strong>{tx("Execution", "Ejecución")}</strong>{" "}
        {tx(
          "- Run in Chat mode to open each step agent in order, or in Plan mode to generate a step-by-step execution plan without opening chat.",
          "- Ejecuta en modo Chat para abrir cada agent step en orden, o en modo Plan para generar un plan de ejecución paso a paso sin abrir chat.",
        )}
      </div>

      <div className="inline-form-row">
        <label>
          {tx("Run mode", "Modo de ejecución")}
          <select
            title="Choose whether the workflow opens agents in chat or generates a plan only."
            value={runMode}
            onChange={(e) => setRunMode(e.target.value as "chat" | "plan")}
          >
            <option value="chat">Chat</option>
            <option value="plan">Plan</option>
          </select>
        </label>
        <button
          title="Execute the workflow using the selected run mode."
          disabled={selectedWorkflowRun?.status === "running"}
          onClick={() =>
            vscode?.postMessage({
              type: "runWorkflow",
              payload: { workflowId: selectedWorkflow.id, mode: runMode },
            })
          }
        >
          {selectedWorkflowRun?.status === "running"
            ? tx("Running...", "Ejecutando...")
            : tx("Run Workflow", "Ejecutar Workflow")}
        </button>
      </div>

      {selectedWorkflowRun && (
        <div className="capability-preview run-status">
          <h4>
            {tx("Run Status", "Estado de ejecución")}:{" "}
            {selectedWorkflowRun.status.toUpperCase()} (
            {selectedWorkflowRun.mode})
          </h4>
          <ul className="compact-list">
            {selectedWorkflowRun.steps.map((step, index) => (
              <li key={`${step.nodeId}-${index}`}>
                <strong>{index + 1}.</strong> {step.agentName} - {step.status}
                {step.message ? ` (${step.message})` : ""}
              </li>
            ))}
          </ul>
          {selectedWorkflowRun.planText && (
            <pre className="source-preview">{selectedWorkflowRun.planText}</pre>
          )}
          {selectedWorkflowRun.error && (
            <p className="field-hint">
              {tx("Error", "Error")}: {selectedWorkflowRun.error}
            </p>
          )}
        </div>
      )}

      <button
        title="Persist the current workflow definition to disk."
        onClick={() =>
          vscode?.postMessage({
            type: "saveWorkflow",
            payload: selectedWorkflow,
          })
        }
      >
        {tx("Save Workflow", "Guardar Workflow")}
      </button>
      <button
        title="Delete this workflow from the workspace."
        className="danger"
        onClick={() =>
          vscode?.postMessage({
            type: "deleteWorkflow",
            payload: { workflowId: selectedWorkflow.id },
          })
        }
      >
        {tx("Delete Workflow", "Borrar Workflow")}
      </button>
    </section>
  );
}
