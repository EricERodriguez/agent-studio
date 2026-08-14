import React from "react";
import { createPortal } from "react-dom";
import { useStudioStore } from "../store/useStudioStore";
import { filterAgentsByCapabilities, searchAgents } from "../utils/agentFilters";
import { roleColor } from "../utils/roleColor";
import { useI18n } from "../i18n";
import { CapabilityFiltersPanel } from "./CapabilityFiltersPanel";
import { vscode } from "../hooks/useVsCodeApi";

export function AgentRail(): React.JSX.Element {
  const { tx } = useI18n();
  const agents = useStudioStore((s) => s.agents);
  const workflows = useStudioStore((s) => s.workflows);
  const selectedAgentId = useStudioStore((s) => s.selectedAgentId);
  const selectAgent = useStudioStore((s) => s.selectAgent);
  const filters = useStudioStore((s) => s.filters);
  const setFilter = useStudioStore((s) => s.setFilter);
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow);
  const setGraphMode = useStudioStore((s) => s.setGraphMode);
  const setCenterView = useStudioStore((s) => s.setCenterView);
  const resourceRailMode = useStudioStore((s) => s.resourceRailMode);
  const setResourceRailMode = useStudioStore((s) => s.setResourceRailMode);

  const [search, setSearch] = React.useState("");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [flyoutPos, setFlyoutPos] = React.useState<{ left: number; bottom: number } | null>(
    null,
  );
  const footerToggleRef = React.useRef<HTMLButtonElement | null>(null);
  const deferredSearch = React.useDeferredValue(search);

  // The flyout is rendered through a portal into <body> — `.agent-rail` has
  // overflow-y:auto so it would otherwise clip (and horizontally scroll for)
  // anything positioned past its own box, no matter the z-index.
  const toggleFilters = (): void => {
    if (!filtersOpen) {
      const rect = footerToggleRef.current?.getBoundingClientRect();
      if (rect) {
        setFlyoutPos({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
      }
    }
    setFiltersOpen((prev) => !prev);
  };

  const activeFilterCount =
    (filters.toolId ? 1 : 0) +
    (filters.skillId ? 1 : 0) +
    (filters.mcpId ? 1 : 0) +
    (filters.scope ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const visibleAgents = filterAgentsByCapabilities(
    searchAgents(agents, deferredSearch),
    filters,
  );
  const visibleWorkflows = workflows.filter((workflow) =>
    `${workflow.name} ${workflow.id} ${workflow.description || ""}`
      .toLowerCase()
      .includes(deferredSearch.trim().toLowerCase()),
  );

  const scopeTabs: Array<{
    key: "all" | "repository" | "global";
    label: string;
  }> = [
    { key: "all", label: tx("All", "Todos") },
    { key: "repository", label: tx("Repo", "Repo") },
    { key: "global", label: tx("Global", "Global") },
  ];

  return (
    <div className="agent-rail">
      <div className="agent-rail-search">
        <div
          className="resource-rail-toggle"
          role="tablist"
          aria-label={tx("Resource type", "Tipo de recurso")}
        >
          <button
            role="tab"
            aria-selected={resourceRailMode === "agents"}
            className={resourceRailMode === "agents" ? "active" : ""}
            onClick={() => setResourceRailMode("agents")}
          >
            {tx("Agents", "Agents")}
          </button>
          <button
            role="tab"
            aria-selected={resourceRailMode === "workflows"}
            className={resourceRailMode === "workflows" ? "active" : ""}
            onClick={() => setResourceRailMode("workflows")}
          >
            {tx("Workflows", "Workflows")}
          </button>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            resourceRailMode === "agents"
              ? tx("Search agents…", "Buscar agents…")
              : tx("Search workflows…", "Buscar workflows…")
          }
          title={tx(
            resourceRailMode === "agents"
              ? "Search agents by name, id, role, or description."
              : "Search workflows by name, id, or description.",
            resourceRailMode === "agents"
              ? "Busca agents por nombre, id, role o descripción."
              : "Busca workflows por nombre, id o descripción.",
          )}
        />
        {resourceRailMode === "agents" && <div className="agent-rail-tabs">
          {scopeTabs.map((scopeTab) => (
            <button
              key={scopeTab.key}
              className={
                (scopeTab.key === "all" && !filters.scope) ||
                filters.scope === scopeTab.key
                  ? "agent-rail-tab active"
                  : "agent-rail-tab"
              }
              onClick={() =>
                setFilter(
                  "scope",
                  scopeTab.key === "all" ? undefined : scopeTab.key,
                )
              }
            >
              {scopeTab.label}
            </button>
          ))}
        </div>}
      </div>

      <div className="agent-rail-heading">
        <span>
          {resourceRailMode === "agents" ? tx("Agents", "Agents") : tx("Workflows", "Workflows")} · {resourceRailMode === "agents" ? visibleAgents.length : visibleWorkflows.length}
        </span>
      </div>

      <div className="agent-rail-list">
        {resourceRailMode === "agents" && (visibleAgents.length === 0 ? (
          <p className="agent-rail-empty">
            {tx(
              "No agents match the current filters.",
              "Ningún agent coincide con los filtros actuales.",
            )}
          </p>
        ) : (
          visibleAgents.map((agent) => (
            <button
              key={agent.id}
              className={
                agent.id === selectedAgentId
                  ? "agent-rail-row selected"
                  : "agent-rail-row"
              }
              onClick={() => selectAgent(agent.id)}
              title={agent.description || agent.name}
            >
              <span
                className="agent-rail-dot"
                style={{ background: roleColor(agent.role) }}
              />
              <span className="agent-rail-row-text">
                <span className="agent-rail-row-name">{agent.name}</span>
                <span className="agent-rail-row-role">
                  {agent.role || tx("no role", "sin role")}
                </span>
              </span>
              <span className="agent-rail-row-counts">
                {agent.capabilities.tools.length}/
                {agent.capabilities.skills.length}/
                {agent.capabilities.mcpServers.length}
              </span>
            </button>
          ))
        ))}
        {resourceRailMode === "workflows" && (visibleWorkflows.length === 0 ? (
          <p className="agent-rail-empty">
            {tx("No workflows match this search.", "Ningún workflow coincide con esta búsqueda.")}
          </p>
        ) : (
          visibleWorkflows.map((workflow) => (
            <button
              key={workflow.id}
              className="agent-rail-row workflow-rail-row"
              onClick={() => {
                selectWorkflow(workflow.id);
                setGraphMode("workflow");
                setCenterView("graph");
              }}
              title={workflow.description || workflow.name}
            >
              <span className="agent-rail-dot workflow-rail-dot">⛓</span>
              <span className="agent-rail-row-text">
                <span className="agent-rail-row-name">{workflow.name}</span>
                <span className="agent-rail-row-role">
                  {workflow.nodes.length} {tx("steps", "pasos")} · {workflow.sourceScope === "global" ? tx("Global", "Global") : tx("Repo", "Repo")}
                </span>
              </span>
              <span className="agent-rail-row-counts">{workflow.edges.length}</span>
            </button>
          ))
        ))}
      </div>

      <div className="agent-rail-footer">
        {resourceRailMode === "workflows" && <button
          className="agent-rail-footer-toggle highlighted"
          onClick={() => vscode?.postMessage({ type: "createWorkflow" })}
          title={tx("Create a workflow independent of the current agent editor.", "Crea un workflow independiente del editor de agents actual.")}
        >
          <span className="agent-rail-footer-toggle-label">+ {tx("New workflow", "Nuevo workflow")}</span>
        </button>}
        {resourceRailMode === "agents" && <button
          ref={footerToggleRef}
          className={
            filtersOpen || hasActiveFilters
              ? "agent-rail-footer-toggle highlighted"
              : "agent-rail-footer-toggle"
          }
          onClick={toggleFilters}
          title={tx(
            "Filter agents by tool, skill, MCP server, or scope.",
            "Filtra agents por Tool, Skill, MCP server o scope.",
          )}
        >
          <span className="agent-rail-footer-toggle-label">
            <span className="agent-rail-footer-toggle-icon">⛃</span>
            {tx("Capability filters", "Filtros de capability")}
            {hasActiveFilters && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </span>
          <span>{filtersOpen ? "▾" : "›"}</span>
        </button>}
      </div>

      {resourceRailMode === "agents" && filtersOpen &&
        flyoutPos &&
        createPortal(
          <>
            <div
              className="capability-filters-backdrop"
              onClick={() => setFiltersOpen(false)}
            />
            <CapabilityFiltersPanel
              onClose={() => setFiltersOpen(false)}
              style={{ left: flyoutPos.left, bottom: flyoutPos.bottom }}
            />
          </>,
          document.body,
        )}
    </div>
  );
}
