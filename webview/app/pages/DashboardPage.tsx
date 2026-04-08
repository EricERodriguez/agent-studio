import React from "react";
import { GraphCanvas } from "../components/GraphCanvas";
import { AgentBuilder } from "../components/AgentBuilder";
import { WorkflowBuilder } from "../components/WorkflowBuilder";
import { InspectorPanel } from "../components/InspectorPanel";
import { useStudioStore } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";

export function DashboardPage(): React.JSX.Element {
  const agents = useStudioStore((s) => s.agents);
  const workflows = useStudioStore((s) => s.workflows);
  const selectedAgentId = useStudioStore((s) => s.selectedAgentId);
  const selectedWorkflowId = useStudioStore((s) => s.selectedWorkflowId);
  const showCapabilityGraph = useStudioStore((s) => s.showCapabilityGraph);
  const filters = useStudioStore((s) => s.filters);
  const graph = useStudioStore((s) => s.capabilityGraph);
  const infoMessage = useStudioStore((s) => s.infoMessage);
  const errorMessage = useStudioStore((s) => s.errorMessage);
  const selectAgent = useStudioStore((s) => s.selectAgent);
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow);
  const toggleCapabilityGraph = useStudioStore((s) => s.toggleCapabilityGraph);
  const setFilter = useStudioStore((s) => s.setFilter);
  const setSelectedCapability = useStudioStore((s) => s.setSelectedCapability);
  const autoLayoutWorkflow = useStudioStore((s) => s.autoLayoutWorkflow);

  const selectedWorkflow = workflows.find(
    (workflow) => workflow.id === selectedWorkflowId,
  );
  const filteredAgents = agents.filter((agent) => {
    if (
      filters.toolId &&
      !agent.capabilities.tools.some((tool) => tool.id === filters.toolId)
    ) {
      return false;
    }
    if (
      filters.skillId &&
      !agent.capabilities.skills.some((skill) => skill.id === filters.skillId)
    ) {
      return false;
    }
    if (
      filters.mcpId &&
      !agent.capabilities.mcpServers.some(
        (server) => server.id === filters.mcpId,
      )
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="layout">
      <header className="header">
        <h1>Agent Studio</h1>
        <div className="header-actions">
          <button onClick={() => vscode?.postMessage({ type: "createAgent" })}>
            Create Agent
          </button>
          <button
            onClick={() => vscode?.postMessage({ type: "createWorkflow" })}
          >
            Create Workflow
          </button>
          <button onClick={() => vscode?.postMessage({ type: "refresh" })}>
            Refresh
          </button>
        </div>
      </header>

      <section className="toolbar">
        <div>
          <label>
            Agent
            <select
              value={selectedAgentId || ""}
              onChange={(e) => selectAgent(e.target.value || undefined)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Workflow
            <select
              value={selectedWorkflowId || ""}
              onChange={(e) => selectWorkflow(e.target.value || undefined)}
            >
              {workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="header-actions">
          <label>
            Tool filter
            <select
              value={filters.toolId || ""}
              onChange={(e) => setFilter("toolId", e.target.value)}
            >
              <option value="">All</option>
              {graph.tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Skill filter
            <select
              value={filters.skillId || ""}
              onChange={(e) => setFilter("skillId", e.target.value)}
            >
              <option value="">All</option>
              {graph.skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            MCP filter
            <select
              value={filters.mcpId || ""}
              onChange={(e) => setFilter("mcpId", e.target.value)}
            >
              <option value="">All</option>
              {graph.mcpServers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={toggleCapabilityGraph}>
            {showCapabilityGraph
              ? "Hide Capability Graph"
              : "Show Capability Graph"}
          </button>
        </div>
      </section>

      {infoMessage && <div className="message info">{infoMessage}</div>}
      {errorMessage && <div className="message error">{errorMessage}</div>}

      <main className="main-grid">
        <div className="column">
          <AgentBuilder />
          <WorkflowBuilder />
        </div>
        <div className="column graph-stack">
          <section className="panel">
            <h2>Agent Graph</h2>
            <p className="field-hint">
              Displays all discovered agents as nodes. Each node shows the agent
              name and its capability counts (T = Tools, S = Skills, M = MCP
              servers). Edges represent handoff relationships — an arrow from
              Agent A to Agent B means A can delegate tasks to B. Click a node
              to open that agent in the builder.
            </p>
            <GraphCanvas mode="agent" />
          </section>
          <section className="panel">
            <div className="panel-title-row">
              <h2>Workflow Graph</h2>
              <p className="field-hint">
                Visualizes the selected workflow as a directed step graph. Each
                node is an agent step; the green-bordered node is the entry
                point. Edges define execution order between steps. Use{" "}
                <strong>Auto Layout</strong> to reposition nodes automatically,
                then <strong>Save Workflow</strong> to persist the layout.
              </p>
              {selectedWorkflow && (
                <>
                  <button
                    onClick={() => autoLayoutWorkflow(selectedWorkflow.id)}
                  >
                    Auto Layout
                  </button>
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
                </>
              )}
            </div>
            <GraphCanvas mode="workflow" />
          </section>
        </div>
        <div className="column">
          <InspectorPanel />
          {showCapabilityGraph && (
            <section className="inspector">
              <h3>Capability Layer</h3>
              <p>
                Tools: {graph.tools.length} | Skills: {graph.skills.length} |
                MCP: {graph.mcpServers.length}
              </p>
              <div>
                <h4>Agent to Tool/Skill/MCP</h4>
                <ul>
                  {filteredAgents.map((agent) => (
                    <li key={agent.id}>
                      {agent.name}
                      {" -> "}
                      {agent.capabilities.tools.length} tools,{" "}
                      {agent.capabilities.skills.length} skills,{" "}
                      {agent.capabilities.mcpServers.length} mcp
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Tools</h4>
                <div className="chip-row">
                  {graph.tools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => setSelectedCapability(tool.id)}
                    >
                      {tool.label} ({tool.kind})
                    </button>
                  ))}
                </div>
                <h4>Skills</h4>
                <div className="chip-row">
                  {graph.skills.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => setSelectedCapability(skill.id)}
                    >
                      {skill.label}
                    </button>
                  ))}
                </div>
                <h4>MCP Servers</h4>
                <div className="chip-row">
                  {graph.mcpServers.map((server) => (
                    <button
                      key={server.id}
                      onClick={() => setSelectedCapability(server.id)}
                    >
                      {server.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
