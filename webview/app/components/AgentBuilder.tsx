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
  const activeCapabilityPane = useStudioStore((s) => s.activeCapabilityPane);
  const setActiveCapabilityPane = useStudioStore(
    (s) => s.setActiveCapabilityPane,
  );
  const allAgents = useStudioStore((s) => s.agents);
  const graph = useStudioStore((s) => s.capabilityGraph);
  const [draft, setDraft] = useState<AgentDefinition | undefined>(
    selectedAgent,
  );
  const [newToolId, setNewToolId] = useState("");
  const [newToolLabel, setNewToolLabel] = useState("");
  const [newToolKind, setNewToolKind] = useState<ToolRef["kind"]>("built-in");

  const applyToolTemplate = (tool: ToolRef): void => {
    setNewToolId(tool.id);
    setNewToolLabel(tool.label);
    setNewToolKind(tool.kind);
  };

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

  const removeMcpServer = (serverId: string): void => {
    update({
      capabilities: {
        ...draft.capabilities,
        mcpServers: draft.capabilities.mcpServers.filter(
          (current) => current.id !== serverId,
        ),
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

  const toggleTool = (tool: ToolRef): void => {
    const exists = draft.capabilities.tools.some(
      (current) => current.id === tool.id,
    );

    update({
      capabilities: {
        ...draft.capabilities,
        tools: exists
          ? draft.capabilities.tools.filter((current) => current.id !== tool.id)
          : [...draft.capabilities.tools, tool],
      },
    });
  };

  const removeTool = (toolId: string): void => {
    update({
      capabilities: {
        ...draft.capabilities,
        tools: draft.capabilities.tools.filter(
          (current) => current.id !== toolId,
        ),
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
              <input
                value={draft.id}
                readOnly
                title="Unique agent identifier used in files and references."
              />
            </label>
            <label>
              Name
              <input
                title="Human-friendly name shown in the sidebar and dashboard."
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label>
              Description
              <input
                title="Short summary of what this agent does and when to use it."
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label>
              Role
              <input
                title="Optional role label used as quick context in the sidebar."
                value={draft.role || ""}
                onChange={(e) => update({ role: e.target.value })}
              />
            </label>
            <label>
              Tags (comma separated)
              <input
                title="Optional labels that help group or find agents later."
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
              title="Core behavior instructions for the agent. This is the main prompt content."
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
              title="Extra context, constraints, or project-specific notes for this agent."
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
                title="Choose which other agents this agent can delegate work to."
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
            <div className="tab-row">
              <button
                className={activeCapabilityPane === "tool" ? "active" : ""}
                title="Expand tools editing section."
                onClick={() => setActiveCapabilityPane("tool")}
              >
                Tools
              </button>
              <button
                className={activeCapabilityPane === "skill" ? "active" : ""}
                title="Expand skills editing section."
                onClick={() => setActiveCapabilityPane("skill")}
              >
                Skills
              </button>
              <button
                className={activeCapabilityPane === "mcp" ? "active" : ""}
                title="Expand MCP editing section."
                onClick={() => setActiveCapabilityPane("mcp")}
              >
                MCP Servers
              </button>
            </div>

            {activeCapabilityPane === "tool" && (
              <>
                <div className="helper-card">
                  <p>How tools work</p>
                  <p>
                    A <strong>Tool</strong> is a concrete action the agent can
                    call while running.
                  </p>
                  <p>
                    Use this form when you want to allow a new action. Then
                    assign that tool to this agent.
                  </p>
                  <p>
                    Fill fields in this order: <strong>Tool ID</strong>, then
                    <strong> Tool label</strong>, then{" "}
                    <strong>Tool kind</strong>.
                  </p>
                  <p>
                    If you are unsure, start with <strong>built-in</strong> and
                    a known ID like <code>run_in_terminal</code>.
                  </p>
                </div>
                <div className="capability-form-grid">
                  <div className="helper-card">
                    <p>Add or update a Tool</p>
                    <p className="field-hint">
                      Create or update one callable action. If the same Tool ID
                      already exists, this will update its label/kind.
                    </p>
                    <label>
                      Tool ID
                      <input
                        title="Exact tool identifier, for example run_in_terminal or a custom MCP tool id."
                        value={newToolId}
                        onChange={(e) => setNewToolId(e.target.value)}
                        placeholder="ex: run_in_terminal"
                      />
                      <small className="field-hint">
                        Machine id used by the runtime. Use snake_case.
                      </small>
                    </label>
                    <label>
                      Tool label
                      <input
                        title="Readable name shown to users in Agent Studio."
                        value={newToolLabel}
                        onChange={(e) => setNewToolLabel(e.target.value)}
                        placeholder="ex: Run in Terminal"
                      />
                      <small className="field-hint">
                        Human-readable name shown in UI.
                      </small>
                    </label>
                    <label>
                      Tool kind
                      <select
                        title="Classify the tool as built-in, extension-provided, or MCP-based."
                        value={newToolKind}
                        onChange={(e) =>
                          setNewToolKind(e.target.value as ToolRef["kind"])
                        }
                      >
                        <option value="built-in">built-in</option>
                        <option value="extension">extension</option>
                        <option value="mcp">mcp</option>
                      </select>
                      <small className="field-hint">
                        built-in: native tool, extension: VS Code command, mcp:
                        tool from MCP server.
                      </small>
                    </label>
                    <div className="tool-template-row">
                      <span className="field-hint">Quick examples:</span>
                      <button
                        className="secondary-button"
                        title="Prefill with a common built-in tool example."
                        onClick={() =>
                          applyToolTemplate({
                            id: "run_in_terminal",
                            label: "Run in Terminal",
                            kind: "built-in",
                          })
                        }
                      >
                        Built-in Example
                      </button>
                      <button
                        className="secondary-button"
                        title="Prefill with a common extension command example."
                        onClick={() =>
                          applyToolTemplate({
                            id: "vscode.executeCommand",
                            label: "Execute VS Code Command",
                            kind: "extension",
                          })
                        }
                      >
                        Extension Example
                      </button>
                      <button
                        className="secondary-button"
                        title="Prefill with a common MCP tool example."
                        onClick={() =>
                          applyToolTemplate({
                            id: "mcp.fetch_webpage",
                            label: "Fetch Webpage",
                            kind: "mcp",
                          })
                        }
                      >
                        MCP Example
                      </button>
                    </div>
                    <button
                      title="Create or update this tool definition in the current agent draft."
                      onClick={addToolFromForm}
                      disabled={!newToolId.trim()}
                    >
                      Add Tool
                    </button>
                  </div>
                  <div className="helper-card">
                    <p>Tool kinds explained</p>
                    <p>
                      <strong>built-in</strong>: native actions like reading
                      files, editing code, or running commands.
                    </p>
                    <p>
                      <strong>extension</strong>: commands provided by a VS Code
                      extension.
                    </p>
                    <p>
                      <strong>mcp</strong>: tools exposed by an MCP server
                      configured for the workspace.
                    </p>
                  </div>
                </div>
                <label>
                  Tools (ids, comma separated)
                  <input
                    title="Advanced input for pasting several tool ids at once."
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
                  <small className="field-hint">
                    Advanced mode: paste ids only. Labels and kinds will be
                    inferred from discovered catalog when possible.
                  </small>
                </label>
                <div className="capability-preview">
                  <p>Select tools (tag multi-select)</p>
                  {graph.tools.length === 0 ? (
                    <p>
                      No discovered tools yet. Refresh after adding tools to
                      agents.
                    </p>
                  ) : (
                    <div className="chip-row">
                      {graph.tools.map((tool) => {
                        const selected = draft.capabilities.tools.some(
                          (current) => current.id === tool.id,
                        );
                        return (
                          <button
                            key={tool.id}
                            className={
                              selected ? "skill-tag selected" : "skill-tag"
                            }
                            title={`Add or remove tool ${tool.label} (${tool.kind}).`}
                            onClick={() => toggleTool(tool)}
                          >
                            {tool.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="capability-preview">
                  <p>Selected tools for this agent</p>
                  {draft.capabilities.tools.length === 0 ? (
                    <p>No tools selected.</p>
                  ) : (
                    <div className="chip-row removable-chip-row">
                      {draft.capabilities.tools.map((tool) => (
                        <span key={tool.id} className="selected-chip">
                          {tool.label} ({tool.id})
                          <button
                            title={`Remove tool ${tool.label} from this agent.`}
                            onClick={() => removeTool(tool.id)}
                          >
                            Remove
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeCapabilityPane === "skill" && (
              <>
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
                <label>
                  Skills (ids, comma separated)
                  <input
                    title="Advanced input for pasting several skill ids at once."
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
                            title={`Add or remove skill ${skill.label}.`}
                            onClick={() => toggleSkill(skill)}
                          >
                            {skill.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
                          <button
                            title={`Remove skill ${skill.label} from this agent.`}
                            onClick={() => removeSkill(skill.id)}
                          >
                            Remove
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeCapabilityPane === "mcp" && (
              <>
                <label>
                  MCP Servers (ids, comma separated)
                  <input
                    title="Advanced input for pasting several MCP server ids at once."
                    value={draft.capabilities.mcpServers
                      .map((server) => server.id)
                      .join(", ")}
                    onChange={(e) =>
                      update({
                        capabilities: {
                          ...draft.capabilities,
                          mcpServers: parseCommaList(e.target.value).map(
                            (id) =>
                              graph.mcpServers.find(
                                (server) => server.id === id,
                              ) || ({ id, label: id } as MCPServerRef),
                          ),
                        },
                      })
                    }
                  />
                </label>
                <div className="capability-preview">
                  <p>Select MCP servers (tag multi-select)</p>
                  {graph.mcpServers.length === 0 ? (
                    <p>No MCP servers discovered. Add them to mcp.json.</p>
                  ) : (
                    <div className="chip-row">
                      {graph.mcpServers.map((server) => {
                        const selected = draft.capabilities.mcpServers.some(
                          (current) => current.id === server.id,
                        );
                        return (
                          <button
                            key={server.id}
                            className={
                              selected ? "skill-tag selected" : "skill-tag"
                            }
                            title={`Add or remove MCP server ${server.label}.`}
                            onClick={() => toggleMcpServer(server)}
                          >
                            {server.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="capability-preview">
                  <p>Selected MCP servers for this agent</p>
                  {draft.capabilities.mcpServers.length === 0 ? (
                    <p>No MCP servers selected.</p>
                  ) : (
                    <div className="chip-row removable-chip-row">
                      {draft.capabilities.mcpServers.map((server) => (
                        <span key={server.id} className="selected-chip">
                          {server.label} ({server.id})
                          <button
                            title={`Remove MCP server ${server.label} from this agent.`}
                            onClick={() => removeMcpServer(server.id)}
                          >
                            Remove
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

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
              title={`Open the ${tab} section of the selected agent.`}
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
          title="Save all changes made to this agent definition."
          disabled={!hasValidContent || brokenHandoffs.length > 0}
          onClick={() =>
            vscode?.postMessage({ type: "saveAgent", payload: draft })
          }
        >
          Save
        </button>
        <button
          title="Discard local edits and restore the last loaded version of this agent."
          onClick={() => setDraft(selectedAgent)}
        >
          Cancel
        </button>
        <button
          title="Open the underlying .agent.md file in the editor."
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
