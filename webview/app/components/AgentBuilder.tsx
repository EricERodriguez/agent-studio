import React, { useMemo, useState } from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import type {
  AgentDefinition,
  BuilderTab,
  ToolRef,
  SkillRef,
  MCPServerRef,
} from "../types";
import { vscode } from "../hooks/useVsCodeApi";

const tabs: BuilderTab[] = [
  "Identity",
  "Instructions",
  "Context",
  "Handoffs",
  "Capabilities",
  "Source Preview",
];

function generateMarkdown(agent: AgentDefinition): string {
  const frontmatter = {
    name: agent.name,
    description: agent.description,
    role: agent.role,
    tools: agent.capabilities.tools,
    skills: agent.capabilities.skills,
    mcp: agent.capabilities.mcpServers,
    handoffs: agent.handoffs,
    tags: agent.tags,
    context: agent.context,
  };

  const sanitized = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== "";
    }),
  );

  return `---\n${JSON.stringify(sanitized, null, 2)}\n---\n\n${agent.instructions}`;
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AgentBuilder(): React.JSX.Element {
  const selectedAgent = useStudioStore(selectors.selectedAgent);
  const selectedTab = useStudioStore((s) => s.selectedTab);
  const setTab = useStudioStore((s) => s.setTab);
  const allAgents = useStudioStore((s) => s.agents);
  const graph = useStudioStore((s) => s.capabilityGraph);
  const [draft, setDraft] = useState<AgentDefinition | undefined>(
    selectedAgent,
  );

  React.useEffect(() => {
    setDraft(selectedAgent);
  }, [selectedAgent]);

  const markdownPreview = useMemo(
    () => (draft ? generateMarkdown(draft) : ""),
    [draft],
  );

  if (!draft) {
    return (
      <section className="builder">
        <h2>Agent Builder</h2>
        <p>Select or create an agent.</p>
      </section>
    );
  }

  const update = (patch: Partial<AgentDefinition>): void => {
    setDraft({ ...draft, ...patch });
  };

  const toggleMcpServer = (server: MCPServerRef): void => {
    const exists = draft.capabilities.mcpServers.some(
      (current) => current.id === server.id,
    );

    update({
      capabilities: {
        ...draft.capabilities,
        mcpServers: exists
          ? draft.capabilities.mcpServers.filter(
              (current) => current.id !== server.id,
            )
          : [...draft.capabilities.mcpServers, server],
      },
    });
  };

  const renderTab = (): React.JSX.Element => {
    switch (selectedTab) {
      case "Identity":
        return (
          <div className="builder-form">
            <label>
              Name
              <input
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label>
              Description
              <input
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label>
              Role
              <input
                value={draft.role || ""}
                onChange={(e) => update({ role: e.target.value })}
              />
            </label>
            <label>
              Tags (comma separated)
              <input
                value={draft.tags.join(", ")}
                onChange={(e) =>
                  update({ tags: parseCommaList(e.target.value) })
                }
              />
            </label>
          </div>
        );
      case "Instructions":
        return (
          <label className="block-label">
            Instructions
            <textarea
              value={draft.instructions}
              onChange={(e) => update({ instructions: e.target.value })}
              rows={14}
            />
          </label>
        );
      case "Context":
        return (
          <label className="block-label">
            Context
            <textarea
              value={draft.context || ""}
              onChange={(e) => update({ context: e.target.value })}
              rows={10}
            />
          </label>
        );
      case "Handoffs":
        return (
          <label className="block-label">
            Handoff Agent IDs (comma separated)
            <input
              value={draft.handoffs.join(", ")}
              onChange={(e) =>
                update({ handoffs: parseCommaList(e.target.value) })
              }
            />
          </label>
        );
      case "Capabilities":
        return (
          <div className="builder-form">
            <label>
              Tools (ids, comma separated)
              <input
                value={draft.capabilities.tools
                  .map((tool) => tool.id)
                  .join(", ")}
                onChange={(e) =>
                  update({
                    capabilities: {
                      ...draft.capabilities,
                      tools: parseCommaList(e.target.value).map(
                        (id) =>
                          graph.tools.find((tool) => tool.id === id) ||
                          ({ id, label: id, kind: "built-in" } as ToolRef),
                      ),
                    },
                  })
                }
              />
            </label>
            <label>
              Skills (ids, comma separated)
              <input
                value={draft.capabilities.skills
                  .map((skill) => skill.id)
                  .join(", ")}
                onChange={(e) =>
                  update({
                    capabilities: {
                      ...draft.capabilities,
                      skills: parseCommaList(e.target.value).map(
                        (id) =>
                          graph.skills.find((skill) => skill.id === id) ||
                          ({ id, label: id } as SkillRef),
                      ),
                    },
                  })
                }
              />
            </label>
            <label>
              MCP Servers (ids, comma separated)
              <input
                value={draft.capabilities.mcpServers
                  .map((server) => server.id)
                  .join(", ")}
                onChange={(e) =>
                  update({
                    capabilities: {
                      ...draft.capabilities,
                      mcpServers: parseCommaList(e.target.value).map(
                        (id) =>
                          graph.mcpServers.find((server) => server.id === id) ||
                          ({ id, label: id } as MCPServerRef),
                      ),
                    },
                  })
                }
              />
            </label>
            <div className="capability-preview">
              <p>Discovered MCP servers</p>
              {graph.mcpServers.length === 0 ? (
                <p>No MCP servers discovered. Add them to mcp.json.</p>
              ) : (
                graph.mcpServers.map((server) => (
                  <label key={server.id}>
                    <input
                      type="checkbox"
                      checked={draft.capabilities.mcpServers.some(
                        (current) => current.id === server.id,
                      )}
                      onChange={() => toggleMcpServer(server)}
                    />
                    {server.label}
                  </label>
                ))
              )}
            </div>
            <div className="capability-preview">
              <p>Available tools: {graph.tools.length}</p>
              <p>Available skills: {graph.skills.length}</p>
              <p>Discovered MCP servers: {graph.mcpServers.length}</p>
            </div>
          </div>
        );
      case "Source Preview":
        return <pre className="source-preview">{markdownPreview}</pre>;
      default:
        return <div />;
    }
  };

  const hasValidContent =
    draft.name.trim().length > 0 && draft.instructions.trim().length > 0;
  const hasCapabilities =
    draft.capabilities.tools.length +
      draft.capabilities.skills.length +
      draft.capabilities.mcpServers.length >
    0;
  const brokenHandoffs = draft.handoffs.filter(
    (handoffId) =>
      !allAgents.some(
        (agent) => agent.id === handoffId && agent.id !== draft.id,
      ),
  );

  return (
    <section className="builder">
      <div className="builder-header">
        <h2>Agent Builder</h2>
        <div className="tab-row">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={tab === selectedTab ? "active" : ""}
              onClick={() => setTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      {renderTab()}
      <div className="validation-row">
        {!hasValidContent && (
          <span className="validation-error">
            Agent name and instructions are required.
          </span>
        )}
        {hasValidContent && !hasCapabilities && (
          <span className="validation-warning">
            Warning: no capabilities configured.
          </span>
        )}
        {brokenHandoffs.length > 0 && (
          <span className="validation-error">
            Broken handoffs: {brokenHandoffs.join(", ")}
          </span>
        )}
      </div>
      <div className="builder-actions">
        <button
          disabled={!hasValidContent || brokenHandoffs.length > 0}
          onClick={() =>
            vscode?.postMessage({ type: "saveAgent", payload: draft })
          }
        >
          Save
        </button>
        <button onClick={() => setDraft(selectedAgent)}>Cancel</button>
        <button
          onClick={() =>
            vscode?.postMessage({
              type: "openRawAgent",
              payload: { agentId: draft.id },
            })
          }
        >
          Open raw file
        </button>
      </div>
    </section>
  );
}
