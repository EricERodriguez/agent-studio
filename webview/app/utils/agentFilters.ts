import type { AgentDefinition } from "../types";

interface CapabilityFilters {
  toolId?: string;
  skillId?: string;
  mcpId?: string;
  scope?: "repository" | "global";
}

export function filterAgentsByCapabilities(
  agents: AgentDefinition[],
  filters: CapabilityFilters,
): AgentDefinition[] {
  return agents.filter((agent) => {
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
}

export function searchAgents(
  agents: AgentDefinition[],
  query: string,
): AgentDefinition[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return agents;
  }
  return agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(trimmed) ||
      agent.id.toLowerCase().includes(trimmed) ||
      agent.description.toLowerCase().includes(trimmed) ||
      agent.role?.toLowerCase().includes(trimmed),
  );
}
