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
  const [newToolId, setNewToolId] = useState("");
  const [newToolLabel, setNewToolLabel] = useState("");
  const [newToolKind, setNewToolKind] = useState<ToolRef["kind"]>("built-in");

  React.useEffect(() => {
    setDraft(selectedAgent);
    setNewToolId("");
    setNewToolLabel("");
    setNewToolKind("built-in");
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

  const addToolFromForm = (): void => {
    const id = newToolId.trim();
    if (!id) {
      return;
    }

    const tool: ToolRef = {
      id,
      label: newToolLabel.trim() || id,
      kind: newToolKind,
    };

    const existingIndex = draft.capabilities.tools.findIndex(
      (current) => current.id === id,
    );

    const tools =
      existingIndex >= 0
        ? draft.capabilities.tools.map((current, index) =>
            index === existingIndex ? tool : current,
          )
        : [...draft.capabilities.tools, tool];

    update({
      capabilities: {
        ...draft.capabilities,
        tools,
      },
    });

    setNewToolId("");
    setNewToolLabel("");
    setNewToolKind("built-in");
  };

  const toggleSkill = (skill: SkillRef): void => {
    const exists = draft.capabilities.skills.some(
      (current) => current.id === skill.id,
    );

    update({
      capabilities: {
        ...draft.capabilities,
        skills: exists
          ? draft.capabilities.skills.filter(
              (current) => current.id !== skill.id,
            )
          : [...draft.capabilities.skills, skill],
      },
    });
  };

  const removeSkill = (skillId: string): void => {
    update({
      capabilities: {
        ...draft.capabilities,
        skills: draft.capabilities.skills.filter(
          (current) => current.id !== skillId,
        ),
      },
    });
  };

  const renderTab = (): React.JSX.Element => {
    switch (selectedTab) {
      case "Identity":
        return (
          <div className="builder-form">
            <label>
              Agent ID
              <input value={draft.id} readOnly />
            </label>
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
        const handoffCandidates = allAgents.filter(
          (agent) => agent.id !== draft.id,
        );

        return (
          <div className="builder-form">
            <div className="helper-card">
              <p>Define which agents this agent can delegate a task to.</p>
              <p>
                When a handoff is configured, the current agent can transfer
                control to the next agent to continue the flow.
              </p>
            </div>
            <label className="block-label">
              Handoff Agents
              <select
                multiple
                value={draft.handoffs}
                onChange={(e) => {
                  const selected = Array.from(
                    e.target.selectedOptions,
                    (opt) => opt.value,
                  );
                  update({ handoffs: selected });
                }}
                size={Math.min(Math.max(handoffCandidates.length, 3), 8)}
              >
                {handoffCandidates.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.id})
                  </option>
                ))}
              </select>
            </label>
            <small className="field-hint">
              Tip: use Ctrl/Cmd + click to select multiple agents.
            </small>
          </div>
        );
      case "Capabilities":
        return (
          <div className="builder-form">
            <div className="helper-card">
              <p>
                Tools are the actions an agent can execute (for example,
                searching code, editing files, or running commands).
              </p>
              <p>
                Available tools are loaded from the capabilities declared in all
                currently loaded agents and merged into a shared catalog.
              </p>
              <p>
                Use tool IDs in this field. If you add or edit agent files,
                refresh the dashboard to rebuild the catalog.
              </p>
              <p>
                Skills are discovered from agent capabilities and installed
                skill folders (for example <code>.agents/skills</code> in the
                current workspace and common global VS Code skills paths).
              </p>
              <p>
                Skills are reusable guidance packs that help an agent perform
                specialized tasks with better quality and consistency.
              </p>
            </div>
            <div className="capability-form-grid">
              <div className="helper-card">
                <p>Add or update a Tool</p>
                <label>
                  Tool ID
                  <input
                    value={newToolId}
                    onChange={(e) => setNewToolId(e.target.value)}
                    placeholder="ex: run_in_terminal"
                  />
                </label>
                <label>
                  Tool label
                  <input
                    value={newToolLabel}
                    onChange={(e) => setNewToolLabel(e.target.value)}
                    placeholder="ex: Run in Terminal"
                  />
                </label>
                <label>
                  Tool kind
                  <select
                    value={newToolKind}
                    onChange={(e) =>
                      setNewToolKind(e.target.value as ToolRef["kind"])
                    }
                  >
                    <option value="built-in">built-in</option>
                    <option value="extension">extension</option>
                    <option value="mcp">mcp</option>
                  </select>
                </label>
                <button onClick={addToolFromForm} disabled={!newToolId.trim()}>
                  Add Tool
                </button>
              </div>
              <div className="helper-card">
                <p>Install Skills</p>
                <p>
                  Install skills in the current repo under
                  <code> .agents/skills </code>
                  or globally in your user skills folders.
                </p>
                <p>
                  Example command:
                  <code> npx skills add softaworks/agent-toolkit </code>
                </p>
                <p>
                  After installation, click <strong>Refresh</strong> and Agent
                  Studio will detect them automatically.
                </p>
              </div>
            </div>
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
            <div className="capability-preview">
              <p>Select skills (tag multi-select)</p>
              {graph.skills.length === 0 ? (
                <p>
                  No discovered skills yet. Install a skill in
                  <code> .agents/skills </code>
                  or in a global skills path, then refresh.
                </p>
              ) : (
                <div className="chip-row">
                  {graph.skills.map((skill) => {
                    const selected = draft.capabilities.skills.some(
                      (current) => current.id === skill.id,
                    );
                    return (
                      <button
                        key={skill.id}
                        className={
                          selected ? "skill-tag selected" : "skill-tag"
                        }
                        onClick={() => toggleSkill(skill)}
                      >
                        {skill.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <small className="field-hint">
                Click tags to add or remove multiple skills quickly.
              </small>
            </div>
            <div className="capability-preview">
              <p>Selected skills for this agent</p>
              {draft.capabilities.skills.length === 0 ? (
                <p>No skills selected.</p>
              ) : (
                <div className="chip-row removable-chip-row">
                  {draft.capabilities.skills.map((skill) => (
                    <span key={skill.id} className="selected-chip">
                      {skill.label} ({skill.id})
                      <button onClick={() => removeSkill(skill.id)}>
                        Remove
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
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
              <p>Discovered tools</p>
              {graph.tools.length === 0 ? (
                <p>No tools discovered yet.</p>
              ) : (
                <ul className="compact-list">
                  {graph.tools.map((tool) => (
                    <li key={tool.id}>
                      <strong>{tool.label}</strong> ({tool.id}) - {tool.kind}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
