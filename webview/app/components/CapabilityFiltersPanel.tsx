import React from "react";
import { useStudioStore } from "../store/useStudioStore";
import { filterAgentsByCapabilities } from "../utils/agentFilters";
import { useI18n } from "../i18n";

interface CapabilityFiltersPanelProps {
  onClose: () => void;
  style?: React.CSSProperties;
}

export function CapabilityFiltersPanel({
  onClose,
  style,
}: CapabilityFiltersPanelProps): React.JSX.Element {
  const { tx } = useI18n();
  const agents = useStudioStore((s) => s.agents);
  const filters = useStudioStore((s) => s.filters);
  const graph = useStudioStore((s) => s.capabilityGraph);
  const setFilter = useStudioStore((s) => s.setFilter);

  const filteredAgents = filterAgentsByCapabilities(agents, filters);

  const activeFilters: Array<{
    key: "toolId" | "skillId" | "mcpId" | "scope";
    label: string;
    value: string;
  }> = [];

  if (filters.toolId) {
    activeFilters.push({
      key: "toolId",
      label: tx("Tool", "Tool"),
      value:
        graph.tools.find((tool) => tool.id === filters.toolId)?.label ||
        filters.toolId,
    });
  }

  if (filters.skillId) {
    activeFilters.push({
      key: "skillId",
      label: tx("Skill", "Skill"),
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
        graph.mcpServers.find((server) => server.id === filters.mcpId)
          ?.label || filters.mcpId,
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

  const clearAllFilters = (): void => {
    setFilter("toolId", undefined);
    setFilter("skillId", undefined);
    setFilter("mcpId", undefined);
    setFilter("scope", undefined);
  };

  const activeBorder = "var(--studio-accent-soft-border, rgba(79,143,247,0.4))";

  return (
    <div className="capability-filters-flyout" style={style}>
      <div className="capability-filters-flyout-head">
        <span className="capability-filters-flyout-title">
          {tx("Capability", "Capability")}
        </span>
        <button
          className="capability-filters-flyout-close"
          title={tx("Close.", "Cerrar.")}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <p className="capability-filters-flyout-sub">
        {tx(
          "Narrow the capability layer by tool, skill, and MCP server.",
          "Acota la capa de capabilities por Tool, Skill y MCP server.",
        )}
      </p>

      <div className="capability-filters-flyout-fields">
        <label>
          <span className="capability-filters-flyout-label">
            {tx("Tool filter", "Filtro de Tool")}
          </span>
          <select
            title={tx(
              "Show only agents connected to the selected tool.",
              "Muestra solo los agents conectados al Tool seleccionado.",
            )}
            value={filters.toolId || ""}
            onChange={(e) => setFilter("toolId", e.target.value)}
            style={filters.toolId ? { borderColor: activeBorder } : undefined}
          >
            <option value="">{tx("All tools", "Todos los Tools")}</option>
            {graph.tools.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="capability-filters-flyout-label">
            {tx("Skill filter", "Filtro de Skill")}
          </span>
          <select
            title={tx(
              "Show only agents connected to the selected skill.",
              "Muestra solo los agents conectados al Skill seleccionado.",
            )}
            value={filters.skillId || ""}
            onChange={(e) => setFilter("skillId", e.target.value)}
            style={filters.skillId ? { borderColor: activeBorder } : undefined}
          >
            <option value="">{tx("All skills", "Todos los Skills")}</option>
            {graph.skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="capability-filters-flyout-label">
            {tx("MCP filter", "Filtro de MCP")}
          </span>
          <select
            title={tx(
              "Show only agents connected to the selected MCP server.",
              "Muestra solo los agents conectados al MCP server seleccionado.",
            )}
            value={filters.mcpId || ""}
            onChange={(e) => setFilter("mcpId", e.target.value)}
            style={filters.mcpId ? { borderColor: activeBorder } : undefined}
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
          <span className="capability-filters-flyout-label">
            {tx("Scope filter", "Filtro de Scope")}
          </span>
          <select
            title={tx(
              "Show only repository agents, only global agents, or both.",
              "Muestra solo agents de repositorio, solo globales, o ambos.",
            )}
            value={filters.scope || ""}
            onChange={(e) => setFilter("scope", e.target.value || undefined)}
            style={filters.scope ? { borderColor: activeBorder } : undefined}
          >
            <option value="">{tx("All scopes", "Todos los scopes")}</option>
            <option value="repository">
              {tx("Repository only", "Solo repositorio")}
            </option>
            <option value="global">{tx("Global only", "Solo global")}</option>
          </select>
        </label>
      </div>

      <div className="capability-filters-flyout-footer">
        <div className="capability-filters-flyout-summary">
          <span className="metric-chip">
            {tx("Showing", "Mostrando")} {filteredAgents.length}{" "}
            {tx("of", "de")} {agents.length} {tx("agents", "agents")}
          </span>
          <button
            className="capability-filters-clear"
            title={tx(
              "Remove every active capability filter.",
              "Quita todos los filtros de capability activos.",
            )}
            onClick={clearAllFilters}
            disabled={!hasActiveFilters}
          >
            {tx("Clear Filters", "Limpiar filtros")}
          </button>
        </div>
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
                {filter.label}: {filter.value} ✕
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
