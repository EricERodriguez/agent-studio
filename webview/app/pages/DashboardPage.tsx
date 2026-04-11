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
  const selectedTab = useStudioStore((s) => s.selectedTab);
  const showCapabilityGraph = useStudioStore((s) => s.showCapabilityGraph);
  const filters = useStudioStore((s) => s.filters);
  const graph = useStudioStore((s) => s.capabilityGraph);
  const infoMessage = useStudioStore((s) => s.infoMessage);
  const errorMessage = useStudioStore((s) => s.errorMessage);
  const selectAgent = useStudioStore((s) => s.selectAgent);
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow);
  const toggleCapabilityGraph = useStudioStore((s) => s.toggleCapabilityGraph);
  const setCapabilityGraphVisible = useStudioStore(
    (s) => s.setCapabilityGraphVisible,
  );
  const uiPanels = useStudioStore((s) => s.uiPanels);
  const toggleUiPanel = useStudioStore((s) => s.toggleUiPanel);
  const setUiPanelOpen = useStudioStore((s) => s.setUiPanelOpen);
  const setFilter = useStudioStore((s) => s.setFilter);
  const setSelectedCapability = useStudioStore((s) => s.setSelectedCapability);
  const setActiveCapabilityPane = useStudioStore(
    (s) => s.setActiveCapabilityPane,
  );
  const autoLayoutWorkflow = useStudioStore((s) => s.autoLayoutWorkflow);
  const [agentSearch, setAgentSearch] = React.useState("");
  const [workflowSearch, setWorkflowSearch] = React.useState("");
  const [capabilitySearch, setCapabilitySearch] = React.useState("");
  const [isToolbarExpanded, setIsToolbarExpanded] = React.useState(true);
  const didMountRef = React.useRef(false);
  const toolbarRef = React.useRef<HTMLElement | null>(null);
  const agentBuilderRef = React.useRef<HTMLElement | null>(null);
  const workflowBuilderRef = React.useRef<HTMLElement | null>(null);
  const agentGraphRef = React.useRef<HTMLElement | null>(null);
  const workflowGraphRef = React.useRef<HTMLElement | null>(null);
  const inspectorRef = React.useRef<HTMLElement | null>(null);

  const scrollToSection = React.useCallback(
    (ref: React.RefObject<HTMLElement | null>) => {
      window.requestAnimationFrame(() => {
        ref.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [],
  );

  const deferredAgentSearch = React.useDeferredValue(agentSearch.trim());
  const deferredWorkflowSearch = React.useDeferredValue(workflowSearch.trim());
  const deferredCapabilitySearch = React.useDeferredValue(
    capabilitySearch.trim(),
  );

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

  const activeFilters: Array<{
    key: "toolId" | "skillId" | "mcpId";
    label: string;
    value: string;
  }> = [];

  if (filters.toolId) {
    activeFilters.push({
      key: "toolId",
      label: "Tool",
      value:
        graph.tools.find((tool) => tool.id === filters.toolId)?.label ||
        filters.toolId,
    });
  }

  if (filters.skillId) {
    activeFilters.push({
      key: "skillId",
      label: "Skill",
      value:
        graph.skills.find((skill) => skill.id === filters.skillId)?.label ||
        filters.skillId,
    });
  }

  if (filters.mcpId) {
    activeFilters.push({
      key: "mcpId",
      label: "MCP",
      value:
        graph.mcpServers.find((server) => server.id === filters.mcpId)?.label ||
        filters.mcpId,
    });
  }

  const hasActiveFilters = activeFilters.length > 0;

  const agentMatches = React.useMemo(() => {
    if (!deferredAgentSearch) {
      return [];
    }
    const query = deferredAgentSearch.toLowerCase();
    return agents
      .filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.id.toLowerCase().includes(query) ||
          agent.description.toLowerCase().includes(query) ||
          agent.role?.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [agents, deferredAgentSearch]);

  const workflowMatches = React.useMemo(() => {
    if (!deferredWorkflowSearch) {
      return [];
    }
    const query = deferredWorkflowSearch.toLowerCase();
    return workflows
      .filter(
        (workflow) =>
          workflow.name.toLowerCase().includes(query) ||
          workflow.id.toLowerCase().includes(query) ||
          workflow.description?.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [deferredWorkflowSearch, workflows]);

  const capabilityMatches = React.useMemo(() => {
    if (!deferredCapabilitySearch) {
      return [];
    }
    const query = deferredCapabilitySearch.toLowerCase();
    return [
      ...graph.tools
        .filter(
          (tool) =>
            tool.label.toLowerCase().includes(query) ||
            tool.id.toLowerCase().includes(query),
        )
        .map((tool) => ({
          id: tool.id,
          label: tool.label,
          detail: tool.kind,
          kind: "tool" as const,
        })),
      ...graph.skills
        .filter(
          (skill) =>
            skill.label.toLowerCase().includes(query) ||
            skill.id.toLowerCase().includes(query),
        )
        .map((skill) => ({
          id: skill.id,
          label: skill.label,
          detail: "skill",
          kind: "skill" as const,
        })),
      ...graph.mcpServers
        .filter(
          (server) =>
            server.label.toLowerCase().includes(query) ||
            server.id.toLowerCase().includes(query),
        )
        .map((server) => ({
          id: server.id,
          label: server.label,
          detail: "mcp",
          kind: "mcp" as const,
        })),
    ].slice(0, 9);
  }, [deferredCapabilitySearch, graph.mcpServers, graph.skills, graph.tools]);

  const clearAllFilters = (): void => {
    setFilter("toolId", undefined);
    setFilter("skillId", undefined);
    setFilter("mcpId", undefined);
  };

  const focusCapabilityResult = (
    kind: "tool" | "skill" | "mcp",
    id: string,
  ): void => {
    setCapabilityGraphVisible(true);
    setUiPanelOpen("agentBuilder", true);
    setUiPanelOpen("inspector", true);
    setSelectedCapability(id);
    setActiveCapabilityPane(kind);
    setFilter("toolId", kind === "tool" ? id : undefined);
    setFilter("skillId", kind === "skill" ? id : undefined);
    setFilter("mcpId", kind === "mcp" ? id : undefined);
    scrollToSection(agentBuilderRef);
  };

  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (selectedTab === "Capabilities" && uiPanels.agentBuilder) {
      scrollToSection(agentBuilderRef);
    }
  }, [scrollToSection, selectedTab, uiPanels.agentBuilder]);

  React.useEffect(() => {
    if (!didMountRef.current) {
      return;
    }

    if (selectedWorkflowId && uiPanels.workflowBuilder) {
      scrollToSection(workflowBuilderRef);
    }
  }, [scrollToSection, selectedWorkflowId, uiPanels.workflowBuilder]);

  React.useEffect(() => {
    if (!didMountRef.current) {
      return;
    }

    if (
      selectedAgentId &&
      selectedTab !== "Capabilities" &&
      uiPanels.agentBuilder
    ) {
      scrollToSection(agentBuilderRef);
    }
  }, [scrollToSection, selectedAgentId, selectedTab, uiPanels.agentBuilder]);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-copy">
          <span className="header-kicker">Orchestration Workspace</span>
          <h1>Agent Studio</h1>
          <p className="header-subtitle">
            Build agents, model handoffs, and run execution workflows.
          </p>
          <div className="header-metrics">
            <span className="metric-chip">Agents: {agents.length}</span>
            <span className="metric-chip">Workflows: {workflows.length}</span>
            <span className="metric-chip">
              Capabilities:{" "}
              {graph.tools.length +
                graph.skills.length +
                graph.mcpServers.length}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            title="Create a new agent and open it in the builder."
            onClick={() => vscode?.postMessage({ type: "createAgent" })}
          >
            Create Agent
          </button>
          <button
            title="Create a new workflow graph starting from a default entry step."
            onClick={() => vscode?.postMessage({ type: "createWorkflow" })}
          >
            Create Workflow
          </button>
          <button
            title="Reload agents, workflows, and capabilities from disk."
            onClick={() => vscode?.postMessage({ type: "refresh" })}
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="toolbar" ref={toolbarRef}>
        <div className="section-toggle-row">
          <h2 className="toolbar-title">Workspace Controls</h2>
          <button
            className="secondary-button"
            title="Expand or collapse Quick Search, Context Selection, and Capability Filters."
            onClick={() => {
              const willOpen = !isToolbarExpanded;
              setIsToolbarExpanded(willOpen);
              if (willOpen) {
                scrollToSection(toolbarRef);
              }
            }}
          >
            {isToolbarExpanded ? "Collapse" : "Expand"}
          </button>
        </div>

        {isToolbarExpanded && (
          <>
            <div className="toolbar-section search-section">
              <div className="toolbar-title-row">
                <h2 className="toolbar-title">Quick Search</h2>
                <p className="field-hint">
                  Jump directly to agents, workflows, or capabilities without
                  hunting through the full lists.
                </p>
              </div>
              <div className="search-grid">
                <label>
                  Find agent
                  <input
                    title="Search agents by name, id, role, or description."
                    type="search"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Search agents"
                  />
                </label>
                <label>
                  Find workflow
                  <input
                    title="Search workflows by name, id, or description."
                    type="search"
                    value={workflowSearch}
                    onChange={(e) => setWorkflowSearch(e.target.value)}
                    placeholder="Search workflows"
                  />
                </label>
                <label>
                  Find capability
                  <input
                    title="Search tools, skills, or MCP servers and jump to the matching filter context."
                    type="search"
                    value={capabilitySearch}
                    onChange={(e) => setCapabilitySearch(e.target.value)}
                    placeholder="Search tools, skills, MCP"
                  />
                </label>
              </div>
              <div className="search-results-grid">
                <div className="search-result-card">
                  <h3>Agent Results</h3>
                  {deferredAgentSearch ? (
                    agentMatches.length > 0 ? (
                      <div className="chip-row">
                        {agentMatches.map((agent) => (
                          <button
                            key={agent.id}
                            className="search-result-chip"
                            title={`Select agent ${agent.name} in the builder and inspector.`}
                            onClick={() => selectAgent(agent.id)}
                          >
                            {agent.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="field-hint">No matching agents.</p>
                    )
                  ) : (
                    <p className="field-hint">Type a name, role, or id.</p>
                  )}
                </div>
                <div className="search-result-card">
                  <h3>Workflow Results</h3>
                  {deferredWorkflowSearch ? (
                    workflowMatches.length > 0 ? (
                      <div className="chip-row">
                        {workflowMatches.map((workflow) => (
                          <button
                            key={workflow.id}
                            className="search-result-chip"
                            title={`Select workflow ${workflow.name} in the workflow editor and graph.`}
                            onClick={() => selectWorkflow(workflow.id)}
                          >
                            {workflow.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="field-hint">No matching workflows.</p>
                    )
                  ) : (
                    <p className="field-hint">Type a workflow name or id.</p>
                  )}
                </div>
                <div className="search-result-card">
                  <h3>Capability Results</h3>
                  {deferredCapabilitySearch ? (
                    capabilityMatches.length > 0 ? (
                      <div className="chip-row">
                        {capabilityMatches.map((capability) => (
                          <button
                            key={`${capability.kind}-${capability.id}`}
                            className="search-result-chip"
                            title={`Focus ${capability.kind} ${capability.label} in the capability layer.`}
                            onClick={() =>
                              focusCapabilityResult(
                                capability.kind,
                                capability.id,
                              )
                            }
                          >
                            {capability.label} ({capability.detail})
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="field-hint">No matching capabilities.</p>
                    )
                  ) : (
                    <p className="field-hint">
                      Search a tool, skill, or MCP id.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="toolbar-section">
              <div className="toolbar-title-row">
                <h2 className="toolbar-title">Context Selection</h2>
                <p className="field-hint">
                  Choose the active agent and workflow before editing or
                  running.
                </p>
              </div>
              <div className="toolbar-row">
                <label>
                  Agent
                  <select
                    title="Choose which agent is active in the builder and inspector."
                    value={selectedAgentId || ""}
                    onChange={(e) => selectAgent(e.target.value || undefined)}
                  >
                    <option value="">No agent selected</option>
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
                    title="Choose which workflow is active in the workflow editor and graph."
                    value={selectedWorkflowId || ""}
                    onChange={(e) =>
                      selectWorkflow(e.target.value || undefined)
                    }
                  >
                    <option value="">No workflow selected</option>
                    {workflows.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="toolbar-section filter-section">
              <div className="toolbar-title-row">
                <h2 className="toolbar-title">Capability Filters</h2>
                <p className="field-hint">
                  Narrow the capability layer by tool, skill, and MCP server.
                </p>
              </div>

              <div className="filter-grid">
                <label>
                  Tool filter
                  <select
                    title="Show only agents connected to the selected tool in the capability layer."
                    value={filters.toolId || ""}
                    onChange={(e) => setFilter("toolId", e.target.value)}
                  >
                    <option value="">All tools</option>
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
                    title="Show only agents connected to the selected skill in the capability layer."
                    value={filters.skillId || ""}
                    onChange={(e) => setFilter("skillId", e.target.value)}
                  >
                    <option value="">All skills</option>
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
                    title="Show only agents connected to the selected MCP server in the capability layer."
                    value={filters.mcpId || ""}
                    onChange={(e) => setFilter("mcpId", e.target.value)}
                  >
                    <option value="">All MCP servers</option>
                    {graph.mcpServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="filter-actions">
                <button
                  className="secondary-button"
                  title="Remove every active capability filter and show the full agent list again."
                  onClick={clearAllFilters}
                  disabled={!hasActiveFilters}
                >
                  Clear Filters
                </button>
                <button
                  title="Show or hide the capability relationship panel on the right."
                  onClick={toggleCapabilityGraph}
                >
                  {showCapabilityGraph
                    ? "Hide Capability Graph"
                    : "Show Capability Graph"}
                </button>
              </div>

              <div className="filter-feedback">
                <span className="metric-chip">
                  Showing {filteredAgents.length} of {agents.length} agents
                </span>
                {hasActiveFilters && (
                  <div className="active-filter-chips">
                    {activeFilters.map((filter) => (
                      <button
                        key={filter.key}
                        className="filter-chip"
                        title={`Remove the ${filter.label} filter.`}
                        onClick={() => setFilter(filter.key, undefined)}
                      >
                        {filter.label}: {filter.value} x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {infoMessage && <div className="message info">{infoMessage}</div>}
      {errorMessage && <div className="message error">{errorMessage}</div>}

      <main className="main-grid">
        <div className="column">
          <section className="panel collapsible-shell" ref={agentBuilderRef}>
            <div className="section-toggle-row">
              <h2>Agent Builder</h2>
              <button
                className="secondary-button"
                title="Expand or collapse Agent Builder section."
                onClick={() => {
                  const willOpen = !uiPanels.agentBuilder;
                  toggleUiPanel("agentBuilder");
                  if (willOpen) {
                    scrollToSection(agentBuilderRef);
                  }
                }}
              >
                {uiPanels.agentBuilder ? "Collapse" : "Expand"}
              </button>
            </div>
            {uiPanels.agentBuilder && <AgentBuilder />}
          </section>

          <section className="panel collapsible-shell" ref={workflowBuilderRef}>
            <div className="section-toggle-row">
              <h2>Workflow Editor</h2>
              <button
                className="secondary-button"
                title="Expand or collapse Workflow Editor section."
                onClick={() => {
                  const willOpen = !uiPanels.workflowBuilder;
                  toggleUiPanel("workflowBuilder");
                  if (willOpen) {
                    scrollToSection(workflowBuilderRef);
                  }
                }}
              >
                {uiPanels.workflowBuilder ? "Collapse" : "Expand"}
              </button>
            </div>
            {uiPanels.workflowBuilder && <WorkflowBuilder />}
          </section>
        </div>
        <div className="column graph-stack">
          <section className="panel collapsible-shell" ref={agentGraphRef}>
            <div className="section-toggle-row">
              <h2>Agent Graph</h2>
              <button
                className="secondary-button"
                title="Expand or collapse Agent Graph section."
                onClick={() => {
                  const willOpen = !uiPanels.agentGraph;
                  toggleUiPanel("agentGraph");
                  if (willOpen) {
                    scrollToSection(agentGraphRef);
                  }
                }}
              >
                {uiPanels.agentGraph ? "Collapse" : "Expand"}
              </button>
            </div>
            {uiPanels.agentGraph && (
              <>
                <p className="field-hint">
                  Displays all discovered agents as nodes. Each node shows the
                  agent name and its capability counts (T = Tools, S = Skills, M
                  = MCP servers). Edges represent handoff relationships — an
                  arrow from Agent A to Agent B means A can delegate tasks to B.
                  Click a node to open that agent in the builder.
                </p>
                <GraphCanvas mode="agent" />
              </>
            )}
          </section>
          <section className="panel collapsible-shell" ref={workflowGraphRef}>
            <div className="section-toggle-row">
              <h2>Workflow Graph</h2>
              <button
                className="secondary-button"
                title="Expand or collapse Workflow Graph section."
                onClick={() => {
                  const willOpen = !uiPanels.workflowGraph;
                  toggleUiPanel("workflowGraph");
                  if (willOpen) {
                    scrollToSection(workflowGraphRef);
                  }
                }}
              >
                {uiPanels.workflowGraph ? "Collapse" : "Expand"}
              </button>
            </div>
            <div className="panel-title-row">
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
                    title="Automatically reposition workflow nodes to a clean layout."
                    onClick={() => autoLayoutWorkflow(selectedWorkflow.id)}
                  >
                    Auto Layout
                  </button>
                  <button
                    title="Persist current workflow nodes, edges, and layout to disk."
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
            {uiPanels.workflowGraph && <GraphCanvas mode="workflow" />}
          </section>
        </div>
        <div className="column">
          <section className="panel collapsible-shell" ref={inspectorRef}>
            <div className="section-toggle-row">
              <h2>Inspector</h2>
              <button
                className="secondary-button"
                title="Expand or collapse Inspector section."
                onClick={() => {
                  const willOpen = !uiPanels.inspector;
                  toggleUiPanel("inspector");
                  if (willOpen) {
                    scrollToSection(inspectorRef);
                  }
                }}
              >
                {uiPanels.inspector ? "Collapse" : "Expand"}
              </button>
            </div>
            {uiPanels.inspector && <InspectorPanel />}
          </section>

          {showCapabilityGraph && uiPanels.inspector && (
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
                      title={`Inspect which agents use the tool ${tool.label}.`}
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
                      title={`Inspect which agents use the skill ${skill.label}.`}
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
                      title={`Inspect which agents use the MCP server ${server.label}.`}
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
