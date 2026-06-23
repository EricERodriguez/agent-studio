import React from "react";
import { useStudioStore } from "../store/useStudioStore";
import { filterAgentsByCapabilities, searchAgents } from "../utils/agentFilters";
import { roleColor } from "../utils/roleColor";
import { useI18n } from "../i18n";
import { CapabilityFiltersPanel } from "./CapabilityFiltersPanel";

export function AgentRail(): React.JSX.Element {
  const { tx } = useI18n();
  const agents = useStudioStore((s) => s.agents);
  const selectedAgentId = useStudioStore((s) => s.selectedAgentId);
  const selectAgent = useStudioStore((s) => s.selectAgent);
  const filters = useStudioStore((s) => s.filters);
  const setFilter = useStudioStore((s) => s.setFilter);

  const [search, setSearch] = React.useState("");
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);
  const deferredSearch = React.useDeferredValue(search);

  const visibleAgents = filterAgentsByCapabilities(
    searchAgents(agents, deferredSearch),
    filters,
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
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tx("Search agents…", "Buscar agents…")}
          title={tx(
            "Search agents by name, id, role, or description.",
            "Busca agents por nombre, id, role o descripción.",
          )}
        />
        <div className="agent-rail-tabs">
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
        </div>
      </div>

      <div className="agent-rail-heading">
        <span>
          {tx("Agents", "Agents")} · {visibleAgents.length}
        </span>
      </div>

      <div className="agent-rail-list">
        {visibleAgents.length === 0 ? (
          <p className="field-hint">
            {tx("No matching agents.", "No hay agents coincidentes.")}
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
        )}
      </div>

      <div className="agent-rail-footer">
        <button
          className="agent-rail-footer-toggle"
          onClick={() => setFiltersExpanded((prev) => !prev)}
        >
          <span>{tx("Capability filters", "Filtros de capability")}</span>
          <span>{filtersExpanded ? "▾" : "›"}</span>
        </button>
        {filtersExpanded && <CapabilityFiltersPanel />}
      </div>
    </div>
  );
}
