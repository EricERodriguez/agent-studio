import React from "react";
import { GraphCanvas } from "../components/GraphCanvas";
import { AgentBuilder } from "../components/AgentBuilder";
import { WorkflowBuilder } from "../components/WorkflowBuilder";
import { InspectorPanel } from "../components/InspectorPanel";
import { useStudioStore } from "../store/useStudioStore";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";

export function DashboardPage(): React.JSX.Element {
  const { language, setLanguage, tx } = useI18n();
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
    if (
      filters.scope &&
      (agent.sourceScope || "repository") !== filters.scope
    ) {
      return false;
    }
    return true;
  });

  const activeFilters: Array<{
    key: "toolId" | "skillId" | "mcpId" | "scope";
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

  if (filters.scope) {
    activeFilters.push({
      key: "scope",
      label: tx("Scope", "Scope"),
      value:
        filters.scope === "global"
          ? tx("Global", "Global")
          : tx("Repository", "Repositorio"),
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
    setFilter("scope", undefined);
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
          <span className="header-kicker">
            {tx("Orchestration Workspace", "Workspace de orquestación")}
          </span>
          <h1>Agent Studio</h1>
          <p className="header-subtitle">
            {tx(
              "Build agents, model handoffs, and run execution workflows.",
              "Crea agents, modela handoffs y ejecuta workflows.",
            )}
          </p>
          <div className="header-metrics">
            <span className="metric-chip">
              {tx("Agents", "Agents")}: {agents.length}
            </span>
            <span className="metric-chip">
              {tx("Workflows", "Workflows")}: {workflows.length}
            </span>
            <span className="metric-chip">
              {tx("Capabilities", "Capabilities")}:{" "}
              {graph.tools.length +
                graph.skills.length +
                graph.mcpServers.length}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <label className="language-switcher">
            <span>{tx("Language", "Idioma")}</span>
            <select
              title={tx(
                "Choose the dashboard language.",
                "Elige el idioma del dashboard.",
              )}
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "es")}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
          <button
            title={tx(
              "Create a new agent and open it in the builder.",
              "Crea un nuevo agent y ábrelo en el builder.",
            )}
            onClick={() => vscode?.postMessage({ type: "createAgent" })}
          >
            {tx("Create Agent", "Crear Agent")}
          </button>
          <button
            title={tx(
              "Create a new workflow graph starting from a default entry step.",
              "Crea un nuevo graph de workflow empezando desde un step de entrada por defecto.",
            )}
            onClick={() => vscode?.postMessage({ type: "createWorkflow" })}
          >
            {tx("Create Workflow", "Crear Workflow")}
          </button>
          <button
            title={tx(
              "Reload agents, workflows, and capabilities from disk.",
              "Recarga agents, workflows y capabilities desde disco.",
            )}
            onClick={() => vscode?.postMessage({ type: "refresh" })}
          >
            {tx("Refresh", "Recargar")}
          </button>
        </div>
      </header>

      <section className="toolbar" ref={toolbarRef}>
        <div className="section-toggle-row">
          <h2 className="toolbar-title">
            {tx("Workspace Controls", "Controles del workspace")}
          </h2>
          <button
            className="secondary-button"
            title={tx(
              "Expand or collapse Quick Search, Context Selection, and Capability Filters.",
              "Expande o colapsa Quick Search, Context Selection y Capability Filters.",
            )}
            onClick={() => {
              const willOpen = !isToolbarExpanded;
              setIsToolbarExpanded(willOpen);
              if (willOpen) {
                scrollToSection(toolbarRef);
              }
            }}
          >
            {isToolbarExpanded
              ? tx("Collapse", "Colapsar")
              : tx("Expand", "Expandir")}
          </button>
        </div>

        {isToolbarExpanded && (
          <>
            <div className="toolbar-section search-section">
              <div className="toolbar-title-row">
                <h2 className="toolbar-title">
                  {tx("Quick Search", "Búsqueda rápida")}
                </h2>
                <p className="field-hint">
                  {tx(
                    "Jump directly to agents, workflows, or capabilities without hunting through the full lists.",
                    "Salta directo a agents, workflows o capabilities sin recorrer listas completas.",
                  )}
                </p>
              </div>
              <div className="search-grid">
                <label>
                  {tx("Find agent", "Buscar agent")}
                  <input
                    title={tx(
                      "Search agents by name, id, role, or description.",
                      "Busca agents por nombre, id, role o descripción.",
                    )}
                    type="search"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder={tx("Search agents", "Buscar agents")}
                  />
                </label>
                <label>
                  {tx("Find workflow", "Buscar workflow")}
                  <input
                    title={tx(
                      "Search workflows by name, id, or description.",
                      "Busca workflows por nombre, id o descripción.",
                    )}
                    type="search"
                    value={workflowSearch}
                    onChange={(e) => setWorkflowSearch(e.target.value)}
                    placeholder={tx("Search workflows", "Buscar workflows")}
                  />
                </label>
                <label>
                  {tx("Find capability", "Buscar capability")}
                  <input
                    title={tx(
                      "Search tools, skills, or MCP servers and jump to the matching filter context.",
                      "Busca Tool, Skill o MCP server y salta al contexto de filtro correspondiente.",
                    )}
                    type="search"
                    value={capabilitySearch}
                    onChange={(e) => setCapabilitySearch(e.target.value)}
                    placeholder={tx(
                      "Search tools, skills, MCP",
                      "Buscar Tool, Skill, MCP",
                    )}
                  />
                </label>
              </div>
              <div className="search-results-grid">
                <div className="search-result-card">
                  <h3>{tx("Agent Results", "Resultados de Agent")}</h3>
                  {deferredAgentSearch ? (
                    agentMatches.length > 0 ? (
                      <div className="chip-row">
                        {agentMatches.map((agent) => (
                          <button
                            key={agent.id}
                            className="search-result-chip"
                            title={tx(
                              `Select agent ${agent.name} in the builder and inspector.`,
                              `Selecciona el agent ${agent.name} en el builder y el inspector.`,
                            )}
                            onClick={() => selectAgent(agent.id)}
                          >
                            {agent.name}{" "}
                            <span className="scope-badge">
                              {agent.sourceScope === "global"
                                ? tx("Global", "Global")
                                : tx("Repo", "Repo")}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="field-hint">
                        {tx(
                          "No matching agents.",
                          "No hay agents coincidentes.",
                        )}
                      </p>
                    )
                  ) : (
                    <p className="field-hint">
                      {tx(
                        "Type a name, role, or id.",
                        "Escribe un nombre, role o id.",
                      )}
                    </p>
                  )}
                </div>
                <div className="search-result-card">
                  <h3>{tx("Workflow Results", "Resultados de Workflow")}</h3>
                  {deferredWorkflowSearch ? (
                    workflowMatches.length > 0 ? (
                      <div className="chip-row">
                        {workflowMatches.map((workflow) => (
                          <button
                            key={workflow.id}
                            className="search-result-chip"
                            title={tx(
                              `Select workflow ${workflow.name} in the workflow editor and graph.`,
                              `Selecciona el workflow ${workflow.name} en el editor y el graph.`,
                            )}
                            onClick={() => selectWorkflow(workflow.id)}
                          >
                            {workflow.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="field-hint">
                        {tx(
                          "No matching workflows.",
                          "No hay workflows coincidentes.",
                        )}
                      </p>
                    )
                  ) : (
                    <p className="field-hint">
                      {tx(
                        "Type a workflow name or id.",
                        "Escribe un nombre o id de workflow.",
                      )}
                    </p>
                  )}
                </div>
                <div className="search-result-card">
                  <h3>
                    {tx("Capability Results", "Resultados de Capability")}
                  </h3>
                  {deferredCapabilitySearch ? (
                    capabilityMatches.length > 0 ? (
                      <div className="chip-row">
                        {capabilityMatches.map((capability) => (
                          <button
                            key={`${capability.kind}-${capability.id}`}
                            className="search-result-chip"
                            title={tx(
                              `Focus ${capability.kind} ${capability.label} in the capability layer.`,
                              `Enfoca ${capability.kind} ${capability.label} en la capa de capabilities.`,
                            )}
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
                      <p className="field-hint">
                        {tx(
                          "No matching capabilities.",
                          "No hay capabilities coincidentes.",
                        )}
                      </p>
                    )
                  ) : (
                    <p className="field-hint">
                      {tx(
                        "Search a tool, skill, or MCP id.",
                        "Busca un id de Tool, Skill o MCP.",
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="toolbar-section">
              <div className="toolbar-title-row">
                <h2 className="toolbar-title">
                  {tx("Context Selection", "Selección de contexto")}
                </h2>
                <p className="field-hint">
                  {tx(
                    "Choose the active agent and workflow before editing or running.",
                    "Elige el agent y el workflow activos antes de editar o ejecutar.",
                  )}
                </p>
              </div>
              <div className="toolbar-row">
                <label>
                  {tx("Agent", "Agent")}
                  <select
                    title={tx(
                      "Choose which agent is active in the builder and inspector.",
                      "Elige qué agent está activo en el builder y el inspector.",
                    )}
                    value={selectedAgentId || ""}
                    onChange={(e) => selectAgent(e.target.value || undefined)}
                  >
                    <option value="">
                      {tx("No agent selected", "Ningún agent seleccionado")}
                    </option>
                    <optgroup label={tx("Repository", "Repositorio")}>
                      {agents
                        .filter((agent) => agent.sourceScope !== "global")
                        .map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label={tx("Global", "Global")}>
                      {agents
                        .filter((agent) => agent.sourceScope === "global")
                        .map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </label>
                <label>
                  {tx("Workflow", "Workflow")}
                  <select
                    title={tx(
                      "Choose which workflow is active in the workflow editor and graph.",
                      "Elige qué workflow está activo en el editor y el graph.",
                    )}
                    value={selectedWorkflowId || ""}
                    onChange={(e) =>
                      selectWorkflow(e.target.value || undefined)
                    }
                  >
                    <option value="">
                      {tx(
                        "No workflow selected",
                        "Ningún workflow seleccionado",
                      )}
                    </option>
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
                <h2 className="toolbar-title">
                  {tx("Capability Filters", "Filtros de Capability")}
                </h2>
                <p className="field-hint">
                  {tx(
                    "Narrow the capability layer by tool, skill, and MCP server.",
                    "Acota la capa de capabilities por Tool, Skill y MCP server.",
                  )}
                </p>
              </div>

              <div className="filter-grid">
                <label>
                  {tx("Tool filter", "Filtro de Tool")}
                  <select
                    title={tx(
                      "Show only agents connected to the selected tool in the capability layer.",
                      "Muestra solo los agents conectados al Tool seleccionado en la capa de capabilities.",
                    )}
                    value={filters.toolId || ""}
                    onChange={(e) => setFilter("toolId", e.target.value)}
                  >
                    <option value="">
                      {tx("All tools", "Todos los Tools")}
                    </option>
                    {graph.tools.map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {tool.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tx("Skill filter", "Filtro de Skill")}
                  <select
                    title={tx(
                      "Show only agents connected to the selected skill in the capability layer.",
                      "Muestra solo los agents conectados al Skill seleccionado en la capa de capabilities.",
                    )}
                    value={filters.skillId || ""}
                    onChange={(e) => setFilter("skillId", e.target.value)}
                  >
                    <option value="">
                      {tx("All skills", "Todos los Skills")}
                    </option>
                    {graph.skills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tx("MCP filter", "Filtro de MCP")}
                  <select
                    title={tx(
                      "Show only agents connected to the selected MCP server in the capability layer.",
                      "Muestra solo los agents conectados al MCP server seleccionado en la capa de capabilities.",
                    )}
                    value={filters.mcpId || ""}
                    onChange={(e) => setFilter("mcpId", e.target.value)}
                  >
                    <option value="">
                      {tx("All MCP servers", "Todos los MCP servers")}
                    </option>
                    {graph.mcpServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tx("Scope filter", "Filtro de Scope")}
                  <select
                    title={tx(
                      "Show only repository agents, only global agents, or both.",
                      "Muestra solo agents de repositorio, solo globales, o ambos.",
                    )}
                    value={filters.scope || ""}
                    onChange={(e) =>
                      setFilter("scope", e.target.value || undefined)
                    }
                  >
                    <option value="">{tx("All scopes", "Todos los scopes")}</option>
                    <option value="repository">
                      {tx("Repository only", "Solo repositorio")}
                    </option>
                    <option value="global">
                      {tx("Global only", "Solo global")}
                    </option>
                  </select>
                </label>
              </div>

              <div className="filter-actions">
                <button
                  className="secondary-button"
                  title={tx(
                    "Remove every active capability filter and show the full agent list again.",
                    "Quita todos los filtros de capability activos y vuelve a mostrar la lista completa de agents.",
                  )}
                  onClick={clearAllFilters}
                  disabled={!hasActiveFilters}
                >
                  {tx("Clear Filters", "Limpiar filtros")}
                </button>
                <button
                  title={tx(
                    "Show or hide the capability relationship panel on the right.",
                    "Muestra u oculta el panel de relaciones de capabilities a la derecha.",
                  )}
                  onClick={toggleCapabilityGraph}
                >
                  {showCapabilityGraph
                    ? tx("Hide Capability Graph", "Ocultar Capability Graph")
                    : tx("Show Capability Graph", "Mostrar Capability Graph")}
                </button>
              </div>

              <div className="filter-feedback">
                <span className="metric-chip">
                  {tx("Showing", "Mostrando")} {filteredAgents.length}{" "}
                  {tx("of", "de")} {agents.length} {tx("agents", "agents")}
                </span>
                {hasActiveFilters && (
                  <div className="active-filter-chips">
                    {activeFilters.map((filter) => (
                      <button
                        key={filter.key}
                        className="filter-chip"
                        title={tx(
                          `Remove the ${filter.label} filter.`,
                          `Quita el filtro ${filter.label}.`,
                        )}
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
              <h2>{tx("Agent Builder", "Builder de Agent")}</h2>
              <button
                className="secondary-button"
                title={tx(
                  "Expand or collapse Agent Builder section.",
                  "Expande o colapsa la sección Builder de Agent.",
                )}
                onClick={() => {
                  const willOpen = !uiPanels.agentBuilder;
                  toggleUiPanel("agentBuilder");
                  if (willOpen) {
                    scrollToSection(agentBuilderRef);
                  }
                }}
              >
                {uiPanels.agentBuilder
                  ? tx("Collapse", "Colapsar")
                  : tx("Expand", "Expandir")}
              </button>
            </div>
            {uiPanels.agentBuilder && <AgentBuilder />}
          </section>

          <section className="panel collapsible-shell" ref={workflowBuilderRef}>
            <div className="section-toggle-row">
              <h2>{tx("Workflow Editor", "Editor de Workflow")}</h2>
              <button
                className="secondary-button"
                title={tx(
                  "Expand or collapse Workflow Editor section.",
                  "Expande o colapsa la sección Editor de Workflow.",
                )}
                onClick={() => {
                  const willOpen = !uiPanels.workflowBuilder;
                  toggleUiPanel("workflowBuilder");
                  if (willOpen) {
                    scrollToSection(workflowBuilderRef);
                  }
                }}
              >
                {uiPanels.workflowBuilder
                  ? tx("Collapse", "Colapsar")
                  : tx("Expand", "Expandir")}
              </button>
            </div>
            {uiPanels.workflowBuilder && <WorkflowBuilder />}
          </section>
        </div>
        <div className="column graph-stack">
          <section className="panel collapsible-shell" ref={agentGraphRef}>
            <div className="section-toggle-row">
              <h2>{tx("Agent Graph", "Graph de Agents")}</h2>
              <button
                className="secondary-button"
                title={tx(
                  "Expand or collapse Agent Graph section.",
                  "Expande o colapsa la sección Graph de Agents.",
                )}
                onClick={() => {
                  const willOpen = !uiPanels.agentGraph;
                  toggleUiPanel("agentGraph");
                  if (willOpen) {
                    scrollToSection(agentGraphRef);
                  }
                }}
              >
                {uiPanels.agentGraph
                  ? tx("Collapse", "Colapsar")
                  : tx("Expand", "Expandir")}
              </button>
            </div>
            {uiPanels.agentGraph && (
              <>
                <p className="field-hint">
                  {tx(
                    "Displays all discovered agents as nodes. Each node shows the agent name and its capability counts (T = Tools, S = Skills, M = MCP servers). Edges represent handoff relationships and clicking a node opens that agent in the builder.",
                    "Muestra todos los agents descubiertos como nodos. Cada nodo muestra el nombre del agent y sus cantidades de capabilities (T = Tools, S = Skills, M = MCP servers). Las aristas representan handoffs y al hacer click en un nodo se abre ese agent en el builder.",
                  )}
                </p>
                <GraphCanvas mode="agent" />
              </>
            )}
          </section>
          <section className="panel collapsible-shell" ref={workflowGraphRef}>
            <div className="section-toggle-row">
              <h2>{tx("Workflow Graph", "Graph de Workflow")}</h2>
              <button
                className="secondary-button"
                title={tx(
                  "Expand or collapse Workflow Graph section.",
                  "Expande o colapsa la sección Graph de Workflow.",
                )}
                onClick={() => {
                  const willOpen = !uiPanels.workflowGraph;
                  toggleUiPanel("workflowGraph");
                  if (willOpen) {
                    scrollToSection(workflowGraphRef);
                  }
                }}
              >
                {uiPanels.workflowGraph
                  ? tx("Collapse", "Colapsar")
                  : tx("Expand", "Expandir")}
              </button>
            </div>
            <div className="panel-title-row">
              <p className="field-hint">
                {tx(
                  "Visualizes the selected workflow as a directed step graph. Each node is an agent step; the green-bordered node is the entry point. Edges define execution order between steps. Use Auto Layout to reposition nodes automatically, then Save Workflow to persist the layout.",
                  "Visualiza el workflow seleccionado como un graph dirigido de steps. Cada nodo es un step de agent; el nodo con borde verde es el punto de entrada. Las aristas definen el orden de ejecución entre steps. Usa Auto Layout para reubicar nodos automáticamente y luego Save Workflow para guardar el layout.",
                )}
              </p>
              {selectedWorkflow && (
                <>
                  <button
                    title={tx(
                      "Automatically reposition workflow nodes to a clean layout.",
                      "Reubica automáticamente los nodos del workflow en un layout ordenado.",
                    )}
                    onClick={() => autoLayoutWorkflow(selectedWorkflow.id)}
                  >
                    {tx("Auto Layout", "Auto Layout")}
                  </button>
                  <button
                    title={tx(
                      "Persist current workflow nodes, edges, and layout to disk.",
                      "Guarda en disco los nodos, aristas y layout actuales del workflow.",
                    )}
                    onClick={() =>
                      vscode?.postMessage({
                        type: "saveWorkflow",
                        payload: selectedWorkflow,
                      })
                    }
                  >
                    {tx("Save Workflow", "Guardar Workflow")}
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
              <h2>{tx("Inspector", "Inspector")}</h2>
              <button
                className="secondary-button"
                title={tx(
                  "Expand or collapse Inspector section.",
                  "Expande o colapsa la sección Inspector.",
                )}
                onClick={() => {
                  const willOpen = !uiPanels.inspector;
                  toggleUiPanel("inspector");
                  if (willOpen) {
                    scrollToSection(inspectorRef);
                  }
                }}
              >
                {uiPanels.inspector
                  ? tx("Collapse", "Colapsar")
                  : tx("Expand", "Expandir")}
              </button>
            </div>
            {uiPanels.inspector && <InspectorPanel />}
          </section>

          {showCapabilityGraph && uiPanels.inspector && (
            <section className="inspector">
              <h3>{tx("Capability Layer", "Capa de Capabilities")}</h3>
              <p>
                Tools: {graph.tools.length} | Skills: {graph.skills.length} |
                MCP: {graph.mcpServers.length}
              </p>
              <div>
                <h4>
                  {tx("Agent to Tool/Skill/MCP", "Agent a Tool/Skill/MCP")}
                </h4>
                <ul>
                  {filteredAgents.map((agent) => (
                    <li key={agent.id}>
                      {agent.name}
                      {" -> "}
                      {agent.capabilities.tools.length} Tools,{" "}
                      {agent.capabilities.skills.length} Skills,{" "}
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
