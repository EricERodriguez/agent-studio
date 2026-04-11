import React, { useState, useEffect } from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";

export function WorkflowBuilder(): React.JSX.Element {
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
        <h2>Workflow Editor</h2>
        <p className="field-hint">
          Select a workflow from the toolbar above, or create one with the{" "}
          <strong>Create Workflow</strong> button.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Workflow Editor</h2>
      <p className="field-hint">
        A workflow is a directed graph of agent steps. Add agents as steps, mark
        one as the entry point, then draw connections between steps in the
        Workflow Graph by dragging from one node's handle to another.
      </p>

      <label>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => updateWorkflowMeta(selectedWorkflow.id, { name })}
        />
      </label>

      <label>
        Description
        <input
          value={description}
          placeholder="Optional description"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            updateWorkflowMeta(selectedWorkflow.id, { description })
          }
        />
      </label>

      <div className="helper-card">
        <strong>Steps</strong> — each step runs a specific agent. The{" "}
        <em>Entry</em> step is where the workflow starts. Connections between
        steps define the execution order (draw them in the graph on the right).
      </div>

      <div className="inline-form-row">
        <label className="grow">
          Add Agent as Step
          <select
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
          onClick={() => {
            if (selectedAgentToAdd) {
              addWorkflowStep(selectedWorkflow.id, selectedAgentToAdd);
            }
          }}
          disabled={!selectedAgentToAdd}
        >
          Add Step
        </button>
      </div>

      {selectedWorkflow.nodes.length === 0 ? (
        <p className="field-hint">
          No steps yet. Select an agent above and click{" "}
          <strong>Add Step</strong>.
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
                    onClick={() =>
                      setWorkflowEntryStep(selectedWorkflow.id, node.id)
                    }
                  >
                    Set Entry
                  </button>
                )}
                <button
                  onClick={() =>
                    removeWorkflowStep(selectedWorkflow.id, node.id)
                  }
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="field-hint">
        To connect steps: in the Workflow Graph on the right, hover a node to
        reveal its handles, then drag from one handle to another node to create
        an edge.
      </p>

      <div className="helper-card" style={{ marginBottom: 8 }}>
        <strong>Execution</strong> - Run in <em>Chat</em> mode to open each step
        agent in order, or in <em>Plan</em> mode to generate a step-by-step
        execution plan without opening chat.
      </div>

      <div className="inline-form-row">
        <label>
          Run mode
          <select
            value={runMode}
            onChange={(e) => setRunMode(e.target.value as "chat" | "plan")}
          >
            <option value="chat">Chat</option>
            <option value="plan">Plan</option>
          </select>
        </label>
        <button
          disabled={selectedWorkflowRun?.status === "running"}
          onClick={() =>
            vscode?.postMessage({
              type: "runWorkflow",
              payload: { workflowId: selectedWorkflow.id, mode: runMode },
            })
          }
        >
          {selectedWorkflowRun?.status === "running"
            ? "Running..."
            : "Run Workflow"}
        </button>
      </div>

      {selectedWorkflowRun && (
        <div className="capability-preview run-status">
          <h4>
            Run Status: {selectedWorkflowRun.status.toUpperCase()} (
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
            <p className="field-hint">Error: {selectedWorkflowRun.error}</p>
          )}
        </div>
      )}

      <button
        onClick={() =>
          vscode?.postMessage({
            type: "saveWorkflow",
            payload: selectedWorkflow,
          })
        }
      >
        Save Workflow
      </button>
    </section>
  );
}
