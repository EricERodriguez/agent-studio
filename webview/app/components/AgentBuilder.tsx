import React, { useMemo, useState } from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import type {
  AgentDefinition,
  AgentProvider,
  BuilderTab,
  ToolRef,
  SkillRef,
  MCPServerRef,
} from "../types";
import { vscode } from "../hooks/useVsCodeApi";
import { useI18n } from "../i18n";
import { roleColor } from "../utils/roleColor";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const tabs: BuilderTab[] = [
  "Identity",
  "Instructions",
  "Context",
  "Handoffs",
  "Capabilities",
  "Source Preview",
];

const ALL_PROVIDERS: AgentProvider[] = ["claude", "codex", "antigravity"];

const PROVIDER_LABELS: Record<AgentProvider, string> = {
  claude: "Claude Code",
  codex: "OpenAI Codex (AGENTS.md)",
  antigravity: "Google Antigravity",
};

const ROLE_SUGGESTIONS = [
  "planning",
  "implementation",
  "review",
  "developer",
  "architect",
  "qa",
  "security",
  "documentation",
];

const TAG_SUGGESTIONS = [
  "planning",
  "implementation",
  "review",
  "backend",
  "frontend",
  "testing",
  "security",
  "docs",
  "automation",
  "typescript",
];

function buildDefaultHandoff(agent: string, label?: string) {
  const resolvedLabel = label || agent;
  return {
    agent,
    label: resolvedLabel,
    prompt: `Delegate to ${resolvedLabel} when this task needs their expertise.`,
    send: true,
  };
}

function generateMarkdown(agent: AgentDefinition): string {
  const frontmatter = {
    name: agent.name,
    description: agent.description,
    role: agent.role,
    tools: agent.capabilities.tools.map((t) => t.id),
    skills: agent.capabilities.skills,
    mcp: agent.capabilities.mcpServers.map((m) => ({
      id: m.id,
      label: m.label,
      command: m.command,
      args: m.args,
      env: m.env,
      autoRunMCP: m.autoRunMCP,
    })),
    handoffs: agent.handoffs.map((h) => ({
      agent: h.agent,
      label: h.label || buildDefaultHandoff(h.agent, h.label).label,
      prompt: h.prompt || buildDefaultHandoff(h.agent, h.label).prompt,
      send:
        typeof h.send === "boolean"
          ? h.send
          : buildDefaultHandoff(h.agent, h.label).send,
    })),
    tags: agent.tags,
    context: agent.context,
    providers: agent.providers,
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
  const { tx } = useI18n();
  const selectedAgent = useStudioStore(selectors.selectedAgent);
  const selectedTab = useStudioStore((s) => s.selectedTab);
  const setTab = useStudioStore((s) => s.setTab);
  const activeCapabilityPane = useStudioStore((s) => s.activeCapabilityPane);
  const setActiveCapabilityPane = useStudioStore(
    (s) => s.setActiveCapabilityPane,
  );
  const allAgents = useStudioStore((s) => s.agents);
  const graph = useStudioStore((s) => s.capabilityGraph);
  const setAgentDraftStatus = useStudioStore((s) => s.setAgentDraftStatus);
  const saveRequestId = useStudioStore((s) => s.saveRequestId);
  const [draft, setDraft] = useState<AgentDefinition | undefined>(
    selectedAgent,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [capAddOpen, setCapAddOpen] = useState(false);
  const [capDraftId, setCapDraftId] = useState("");
  const [capDraftLabel, setCapDraftLabel] = useState("");
  const [capDraftKind, setCapDraftKind] = useState<ToolRef["kind"]>("built-in");

  const resetCapDraft = (): void => {
    setCapAddOpen(false);
    setCapDraftId("");
    setCapDraftLabel("");
    setCapDraftKind("built-in");
  };

  React.useEffect(() => {
    setDraft(selectedAgent);
    resetCapDraft();
    // Depend on the id only: `selectedAgent` gets a new object reference on
    // every background state refresh (e.g. refreshState()), which would
    // otherwise wipe out unsaved edits in the textarea/fields below.
  }, [selectedAgent?.id]);

  const markdownPreview = useMemo(
    () => (draft ? generateMarkdown(draft) : ""),
    [draft],
  );

  const tabLabels: Record<BuilderTab, string> = {
    Identity: tx("Identity", "Identidad"),
    Instructions: tx("Instructions", "Instrucciones"),
    Context: tx("Context", "Contexto"),
    Handoffs: tx("Handoffs", "Handoffs"),
    Capabilities: tx("Capabilities", "Capabilities"),
    "Source Preview": tx("Preview", "Preview"),
  };

  // These two hooks must run unconditionally on every render (Rules of
  // Hooks), so they live above the `!draft` early return below and re-derive
  // validity/dirty state themselves instead of reusing the later consts.
  const draftValid = Boolean(
    draft &&
      draft.name.trim() &&
      draft.instructions.trim() &&
      draft.handoffs.every((h) =>
        allAgents.some((a) => a.id === h.agent && a.id !== draft.id),
      ),
  );
  const draftDirty = JSON.stringify(draft) !== JSON.stringify(selectedAgent);

  React.useEffect(() => {
    setAgentDraftStatus({ valid: draftValid, dirty: draftDirty });
  }, [draftValid, draftDirty, setAgentDraftStatus]);

  const lastHandledSaveRequestId = React.useRef(saveRequestId);
  React.useEffect(() => {
    if (saveRequestId === lastHandledSaveRequestId.current) {
      return;
    }
    lastHandledSaveRequestId.current = saveRequestId;
    if (!draft || !draftValid || !vscode) {
      return;
    }
    try {
      vscode.postMessage({ type: "saveAgent", payload: draft });
    } catch {
      setSaveError(
        tx(
          "Failed to send save message to extension.",
          "Fallo al enviar mensaje de guardado a la extensión.",
        ),
      );
    }
    // `draft`/`draftValid` intentionally omitted: we want the value at
    // request-time, not to re-fire this effect on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRequestId]);

  if (!draft) {
    return (
      <section className="builder">
        <h2>{tx("Agent Builder", "Builder de Agent")}</h2>
        <p>{tx("Select or create an agent.", "Selecciona o crea un agent.")}</p>
      </section>
    );
  }

  const update = (patch: Partial<AgentDefinition>): void => {
    setDraft({ ...draft, ...patch });
  };

  const applyRoleSuggestion = (role: string): void => {
    update({ role });
  };

  const toggleProvider = (provider: AgentProvider): void => {
    const current = draft.providers || [];
    const has = current.includes(provider);
    update({
      providers: has
        ? current.filter((p) => p !== provider)
        : [...current, provider],
    });
  };

  const selectAllProviders = (): void => {
    update({ providers: ALL_PROVIDERS });
  };

  const exportProvidersNow = (): void => {
    const providers = draft.providers || [];
    if (providers.length === 0 || !vscode) {
      return;
    }
    vscode.postMessage({
      type: "exportAgent",
      payload: { agentId: draft.id, providers },
    });
  };

  const toggleTagSuggestion = (tag: string): void => {
    const hasTag = draft.tags.includes(tag);
    update({
      tags: hasTag ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag],
    });
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
          : [
              ...draft.capabilities.mcpServers,
              { ...server, autoRunMCP: server.autoRunMCP ?? true },
            ],
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

  const toggleMcpAutoRun = (serverId: string): void => {
    update({
      capabilities: {
        ...draft.capabilities,
        mcpServers: draft.capabilities.mcpServers.map((m) =>
          m.id === serverId ? { ...m, autoRunMCP: !m.autoRunMCP } : m,
        ),
      },
    });
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
              {tx("Agent ID", "ID del Agent")}
              <input
                value={draft.id}
                readOnly
                title="Unique agent identifier used in files and references."
              />
            </label>
            <label>
              {tx("Scope", "Scope")}
              <select
                title="Choose whether this agent belongs to the current repository or is available globally."
                value={draft.sourceScope || "repository"}
                onChange={(e) =>
                  update({
                    sourceScope: e.target.value as "repository" | "global",
                  })
                }
              >
                <option value="repository">
                  {tx("Repository", "Repositorio")}
                </option>
                <option value="global">{tx("Global", "Global")}</option>
              </select>
              <small className="field-hint">
                {tx(
                  "Repository agents are saved in the current repo. Global agents are available across repos.",
                  "Los agents de repositorio se guardan en el repo actual. Los globales están disponibles en cualquier repo.",
                )}
              </small>
            </label>
            <label>
              {tx("Name", "Nombre")}
              <input
                title="Human-friendly name shown in the sidebar and dashboard."
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                className={draft.name.trim() ? "" : "field-invalid"}
              />
            </label>
            <label>
              {tx("Description", "Descripción")}
              <input
                title="Short summary of what this agent does and when to use it."
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label>
              {tx("Role", "Role")}
              <input
                title="Optional role label used as quick context in the sidebar."
                value={draft.role || ""}
                onChange={(e) => update({ role: e.target.value })}
              />
              <div className="chip-row quick-pick-row">
                {ROLE_SUGGESTIONS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`secondary-button ${draft.role === role ? "quick-pick-active" : ""}`}
                    onClick={() => applyRoleSuggestion(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </label>
            <label>
              {tx("Tags (comma separated)", "Tags (separados por coma)")}
              <input
                title="Optional labels that help group or find agents later."
                value={draft.tags.join(", ")}
                onChange={(e) =>
                  update({ tags: parseCommaList(e.target.value) })
                }
              />
              <div className="chip-row quick-pick-row">
                {TAG_SUGGESTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`secondary-button ${draft.tags.includes(tag) ? "quick-pick-active" : ""}`}
                    onClick={() => toggleTagSuggestion(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </label>
            <label className="block-label">
              {tx(
                "Generate agent for AI providers",
                "Generar agent para proveedores de IA",
              )}
              <div className="chip-row quick-pick-row">
                {ALL_PROVIDERS.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    title={tx(
                      `Include ${PROVIDER_LABELS[provider]} when exporting this agent.`,
                      `Incluir ${PROVIDER_LABELS[provider]} al exportar este agent.`,
                    )}
                    className={`secondary-button ${(draft.providers || []).includes(provider) ? "quick-pick-active" : ""}`}
                    onClick={() => toggleProvider(provider)}
                  >
                    {PROVIDER_LABELS[provider]}
                  </button>
                ))}
                <button
                  type="button"
                  title={tx(
                    "Select Claude Code, Codex and Antigravity at once.",
                    "Selecciona Claude Code, Codex y Antigravity a la vez.",
                  )}
                  className="secondary-button"
                  onClick={selectAllProviders}
                >
                  {tx("✨ All AIs", "✨ Todas las IA")}
                </button>
              </div>
              <small className="field-hint">
                {tx(
                  "Choose which AI tools this agent should be generated for. Saving writes the canonical .agent.md; use Export now to (re)write the provider-specific files.",
                  "Elige para qué herramientas de IA se debe generar este agent. Guardar escribe el .agent.md canónico; usa Exportar ahora para (re)escribir los archivos específicos de cada proveedor.",
                )}
              </small>
              <div className="tab-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  title={tx(
                    "Write the provider-specific agent files now for the selected AI providers.",
                    "Escribe ahora los archivos de agent específicos para los proveedores de IA seleccionados.",
                  )}
                  disabled={(draft.providers || []).length === 0}
                  onClick={exportProvidersNow}
                >
                  {tx("Export now", "Exportar ahora")}
                </button>
              </div>
            </label>
          </div>
        );
      case "Instructions": {
        const tokenCount = Math.max(1, Math.round(draft.instructions.length / 4));
        return (
          <div className="instructions-tab">
            <div className="instructions-tab-head">
              <span className="field-hint">
                {tx(
                  "The system prompt that defines how this agent behaves.",
                  "El prompt de sistema que define cómo se comporta el agent.",
                )}{" "}
                <span className="validation-error">{tx("Required.", "Requerido.")}</span>
              </span>
              <span className="instructions-token-count">{tokenCount} tokens</span>
            </div>
            <textarea
              title="Core behavior instructions for the agent. This is the main prompt content."
              value={draft.instructions}
              onChange={(e) => update({ instructions: e.target.value })}
              className={
                "instructions-textarea" +
                (draft.instructions.trim() ? "" : " field-invalid")
              }
            />
          </div>
        );
      }
      case "Context":
        return (
          <div className="instructions-tab">
            <span className="field-hint">
              {tx(
                "Extra context and constraints. Optional.",
                "Contexto y restricciones adicionales. Opcional.",
              )}
            </span>
            <textarea
              title="Extra context, constraints, or project-specific notes for this agent."
              value={draft.context || ""}
              onChange={(e) => update({ context: e.target.value })}
              placeholder={tx(
                "Additional context, constraints, conventions…",
                "Contexto adicional, restricciones, convenciones…",
              )}
              className="instructions-textarea instructions-textarea-context"
            />
          </div>
        );
      case "Handoffs": {
        const handoffCandidates = allAgents.filter(
          (agent) => agent.id !== draft.id,
        );
        const toggleHandoff = (agentId: string, agentName: string): void => {
          const exists = draft.handoffs.some((h) => h.agent === agentId);
          update({
            handoffs: exists
              ? draft.handoffs.filter((h) => h.agent !== agentId)
              : [...draft.handoffs, buildDefaultHandoff(agentId, agentName)],
          });
        };

        return (
          <div className="builder-form">
            <div className="helper-card">
              {tx(
                "Pick the agents this one can delegate to. A handoff lets it transfer control mid-task to a specialist.",
                "Elegí a qué agents puede delegar éste. Un handoff transfiere el control a un especialista a mitad de tarea.",
              )}
            </div>
            <div className="handoff-section-heading">
              {tx("Can delegate to", "Puede delegar a")}
            </div>
            <div className="handoff-pick-list">
              {handoffCandidates.map((agent) => {
                const on = draft.handoffs.some((h) => h.agent === agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className={on ? "handoff-pick-row on" : "handoff-pick-row"}
                    onClick={() => toggleHandoff(agent.id, agent.name)}
                  >
                    <span
                      className="agent-rail-dot"
                      style={{ background: roleColor(agent.role) }}
                    />
                    <span className="handoff-pick-name">
                      {agent.name}
                      <span className="handoff-pick-role"> · {agent.role}</span>
                    </span>
                    <span className="handoff-pick-check">{on ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case "Capabilities": {
        const kind = activeCapabilityPane;
        const pool: Array<ToolRef | SkillRef | MCPServerRef> =
          kind === "tool"
            ? graph.tools
            : kind === "skill"
              ? graph.skills
              : graph.mcpServers;
        const selected: Array<ToolRef | SkillRef | MCPServerRef> =
          kind === "tool"
            ? draft.capabilities.tools
            : kind === "skill"
              ? draft.capabilities.skills
              : draft.capabilities.mcpServers;
        const capabilityCounts = {
          tool: draft.capabilities.tools.length,
          skill: draft.capabilities.skills.length,
          mcp: draft.capabilities.mcpServers.length,
        };
        const availLabel =
          kind === "tool"
            ? tx("Available tools", "Tools disponibles")
            : kind === "skill"
              ? tx("Available skills", "Skills disponibles")
              : tx("Discovered MCP servers", "Servidores MCP descubiertos");
        const selLabel =
          kind === "tool"
            ? tx("Selected tools", "Tools seleccionadas")
            : kind === "skill"
              ? tx("Selected skills", "Skills seleccionadas")
              : tx("Selected MCP servers", "Servidores MCP seleccionados");
        const kindNoun =
          kind === "tool"
            ? tx("tool", "tool")
            : kind === "skill"
              ? tx("skill", "skill")
              : tx("MCP server", "servidor MCP");

        const togglePoolItem = (item: ToolRef | SkillRef | MCPServerRef): void => {
          if (kind === "tool") toggleTool(item as ToolRef);
          else if (kind === "skill") toggleSkill(item as SkillRef);
          else toggleMcpServer(item as MCPServerRef);
        };
        const removeSelectedItem = (id: string): void => {
          if (kind === "tool") removeTool(id);
          else if (kind === "skill") removeSkill(id);
          else removeMcpServer(id);
        };

        const canAdd = capDraftId.trim().length > 0;
        const addCapability = (): void => {
          const id = capDraftId.trim();
          if (!id) return;
          const label = capDraftLabel.trim() || id;
          if (kind === "tool") {
            toggleTool({ id, label, kind: capDraftKind });
          } else if (kind === "skill") {
            toggleSkill({ id, label });
          } else {
            toggleMcpServer({ id, label });
          }
          resetCapDraft();
        };

        return (
          <div className="builder-form">
            <div className="cap-subtabs">
              {(["tool", "skill", "mcp"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={kind === k ? "cap-subtab active" : "cap-subtab"}
                  onClick={() => {
                    setActiveCapabilityPane(k);
                    setCapAddOpen(false);
                  }}
                >
                  {k === "tool" ? "Tools" : k === "skill" ? "Skills" : "MCP"}{" "}
                  <span className="cap-subtab-count">{capabilityCounts[k]}</span>
                </button>
              ))}
            </div>

            {kind === "skill" && (
              <div className="cap-skill-help">
                <span>ⓘ</span>
                <span>
                  {tx(
                    "Install skills with npx skills add … into .agents/skills, then add the id here.",
                    "Instalá skills con npx skills add … en .agents/skills, luego agregá el id acá.",
                  )}
                </span>
              </div>
            )}

            <div className="cap-available-row">
              <span className="cap-available-label">
                {availLabel}{" "}
                <span className="cap-available-hint">
                  — {tx("click to toggle", "click para alternar")}
                </span>
              </span>
              {!capAddOpen && (
                <button
                  type="button"
                  className="cap-add-new-chip"
                  onClick={() => setCapAddOpen(true)}
                >
                  <span className="cap-add-new-icon">+</span>
                  {tx("Add new", "Agregar")}
                </button>
              )}
            </div>

            {capAddOpen && (
              <div className="cap-composer">
                <label className="cap-composer-field">
                  <span>{tx("ID", "ID")}</span>
                  <input
                    value={capDraftId}
                    onChange={(e) => setCapDraftId(e.target.value)}
                    placeholder={`${kindNoun}_id`}
                  />
                </label>
                <label className="cap-composer-field">
                  <span>{tx("Label", "Etiqueta")}</span>
                  <input
                    value={capDraftLabel}
                    onChange={(e) => setCapDraftLabel(e.target.value)}
                    placeholder={kindNoun}
                  />
                </label>
                {kind === "tool" && (
                  <label className="cap-composer-field cap-composer-kind">
                    <span>{tx("Kind", "Tipo")}</span>
                    <select
                      value={capDraftKind}
                      onChange={(e) =>
                        setCapDraftKind(e.target.value as ToolRef["kind"])
                      }
                    >
                      <option value="built-in">built-in</option>
                      <option value="extension">extension</option>
                      <option value="mcp">mcp</option>
                    </select>
                  </label>
                )}
                <div className="cap-composer-actions">
                  <button type="button" disabled={!canAdd} onClick={addCapability}>
                    {tx("Add", "Agregar")}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetCapDraft}
                  >
                    {tx("Cancel", "Cancelar")}
                  </button>
                </div>
              </div>
            )}

            <div className="chip-row cap-pool-chips">
              {pool.map((item) => {
                const on = selected.some((s) => s.id === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={on ? "cap-pool-chip on" : "cap-pool-chip"}
                    onClick={() => togglePoolItem(item)}
                  >
                    <span className="cap-pool-chip-mark">{on ? "✓" : "+"}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="cap-selected-heading">{selLabel}</div>
            <div className="cap-selected-list">
              {selected.length === 0 ? (
                <span className="field-hint">
                  {tx(
                    "Nothing selected yet — pick from above or add a new one.",
                    "Nada seleccionado — elegí de arriba o agregá uno nuevo.",
                  )}
                </span>
              ) : (
                selected.map((item) => (
                  <div key={item.id} className="cap-selected-row">
                    <span className="cap-selected-label">{item.label}</span>
                    {kind === "mcp" && (
                      <button
                        type="button"
                        className={
                          (item as MCPServerRef).autoRunMCP
                            ? "cap-autorun-toggle on"
                            : "cap-autorun-toggle"
                        }
                        onClick={() => toggleMcpAutoRun(item.id)}
                      >
                        <span className="cap-autorun-mark">
                          {(item as MCPServerRef).autoRunMCP ? "✓" : ""}
                        </span>
                        {tx("Auto-run", "Auto-run")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="cap-selected-remove"
                      onClick={() => removeSelectedItem(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      }
      case "Source Preview":
        return (
          <div className="preview-card">
            <div className="preview-card-head">
              <span className="preview-card-dot" />
              <span className="preview-card-filename">{draft.id}.agent.md</span>
              <span className="preview-card-live">{tx("live", "en vivo")}</span>
            </div>
            <pre className="source-preview">{markdownPreview}</pre>
          </div>
        );
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
    (handoff) =>
      !allAgents.some(
        (agent) => agent.id === handoff.agent && agent.id !== draft.id,
      ),
  );
  const canSave = hasValidContent && brokenHandoffs.length === 0;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(selectedAgent);

  const handleSave = (): void => {
    setSaveError(null);
    if (!vscode) {
      setSaveError(
        tx(
          "Cannot save: VS Code API unavailable in this context.",
          "No se puede guardar: API de VS Code no disponible en este contexto.",
        ),
      );
      return;
    }
    try {
      vscode.postMessage({ type: "saveAgent", payload: draft });
    } catch (e) {
      setSaveError(
        tx(
          "Failed to send save message to extension.",
          "Fallo al enviar mensaje de guardado a la extensión.",
        ),
      );
    }
  };

  const tabBadge: Partial<Record<BuilderTab, number>> = {
    Handoffs: draft.handoffs.length,
    Capabilities:
      draft.capabilities.tools.length +
      draft.capabilities.skills.length +
      draft.capabilities.mcpServers.length,
  };

  return (
    <section className="builder">
      <div className="builder-identity-header">
        <span
          className="builder-identity-avatar"
          style={{
            borderColor:
              draft.sourceScope === "global"
                ? "rgba(243,201,65,0.4)"
                : "rgba(63,185,80,0.4)",
          }}
        >
          {initials(draft.name || draft.id)}
        </span>
        <div className="builder-identity-text">
          <div className="builder-identity-row">
            <span className="builder-identity-name">
              {draft.name || draft.id}
            </span>
            <span className="choose-card-scope">
              {draft.sourceScope === "global"
                ? tx("Global", "Global")
                : tx("Repository", "Repositorio")}
            </span>
            <span
              className={
                isDirty
                  ? "builder-identity-saved dirty"
                  : "builder-identity-saved"
              }
            >
              <span className="builder-identity-saved-dot" />
              {isDirty ? tx("Unsaved", "Sin guardar") : tx("Saved", "Guardado")}
            </span>
          </div>
          <div className="builder-identity-path">
            .github/agents/{draft.id}.agent.md
          </div>
        </div>
      </div>
      <div className="builder-header">
        <div className="editor-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={tab === selectedTab ? "editor-tab active" : "editor-tab"}
              title={tx(
                `Open the ${tab} section of the selected agent.`,
                `Abre la sección ${tabLabels[tab]} del agent seleccionado.`,
              )}
              onClick={() => setTab(tab)}
            >
              {tabLabels[tab]}
              {Boolean(tabBadge[tab]) && (
                <span className="tab-badge">{tabBadge[tab]}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      {renderTab()}
      <div className="validation-row">
        {!hasValidContent && (
          <span className="validation-error">
            {tx(
              "Agent name and instructions are required.",
              "El nombre y las instrucciones del agent son obligatorios.",
            )}
          </span>
        )}
        {hasValidContent && !hasCapabilities && (
          <span className="validation-warning">
            {tx(
              "Warning: no capabilities configured.",
              "Advertencia: no hay capabilities configuradas.",
            )}
          </span>
        )}
        {brokenHandoffs.length > 0 && (
          <span className="validation-error">
            {tx("Broken handoffs", "Handoffs rotos")}:{" "}
            {brokenHandoffs.join(", ")}
          </span>
        )}
      </div>
      <div className="builder-actions">
        <button
          title="Save all changes made to this agent definition."
          disabled={!canSave}
          onClick={handleSave}
        >
          {tx("Save", "Guardar")}
        </button>
        {saveError && (
          <div
            role="alert"
            aria-live="assertive"
            className="validation-error"
            style={{ marginLeft: 12 }}
          >
            {saveError}
          </div>
        )}
        <button
          title="Discard local edits and restore the last loaded version of this agent."
          onClick={() => setDraft(selectedAgent)}
        >
          {tx("Cancel", "Cancelar")}
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
          {tx("Open raw file", "Abrir archivo raw")}
        </button>
        <button
          title="Delete this agent from the workspace."
          className="danger"
          onClick={() =>
            // send delete request to extension; extension will confirm
            vscode?.postMessage({
              type: "deleteAgent",
              payload: { agentId: draft.id },
            })
          }
        >
          {tx("Delete", "Borrar")}
        </button>
      </div>
    </section>
  );
}
