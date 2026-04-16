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
import { useI18n } from "../i18n";

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
      label: h.label,
      prompt: h.prompt,
      send: h.send,
    })),
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
  const [draft, setDraft] = useState<AgentDefinition | undefined>(
    selectedAgent,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
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

  const tabLabels: Record<BuilderTab, string> = {
    Identity: tx("Identity", "Identidad"),
    Instructions: tx("Instructions", "Instrucciones"),
    Context: tx("Context", "Contexto"),
    Handoffs: tx("Handoffs", "Handoffs"),
    Capabilities: tx("Capabilities", "Capabilities"),
    "Source Preview": tx("Source Preview", "Vista previa del source"),
  };

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
              {tx("Agent ID", "ID del Agent")}
              <input
                value={draft.id}
                readOnly
                title="Unique agent identifier used in files and references."
              />
            </label>
            <label>
              {tx("Name", "Nombre")}
              <input
                title="Human-friendly name shown in the sidebar and dashboard."
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
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
            </label>
          </div>
        );
      case "Instructions":
        return (
          <label className="block-label">
            {tx("Instructions", "Instrucciones")}
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
            {tx("Context", "Contexto")}
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
              <p>
                {tx(
                  "Define which agents this agent can delegate a task to.",
                  "Define a qué agents puede delegar una tarea este agent.",
                )}
              </p>
              <p>
                {tx(
                  "When a handoff is configured, the current agent can transfer control to the next agent to continue the flow.",
                  "Cuando un handoff está configurado, el agent actual puede transferir el control al siguiente agent para continuar el flujo.",
                )}
              </p>
            </div>
            <label className="block-label">
              {tx("Handoff Agents", "Agents de handoff")}
              <select
                title="Choose which other agents this agent can delegate work to."
                aria-label={tx(
                  "Handoff agents selection",
                  "Select handoff agents",
                )}
                multiple
                value={draft.handoffs.map((h) => h.agent)}
                onChange={(e) => {
                  const selected = Array.from(
                    e.target.selectedOptions,
                    (opt) => opt.value,
                  );
                  const mapped = selected.map((id) => {
                    const a = handoffCandidates.find((ag) => ag.id === id);
                    return { agent: id, label: a?.name || id };
                  });
                  update({ handoffs: mapped });
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
              {tx(
                "Tip: use Ctrl/Cmd + click to select multiple agents.",
                "Tip: usa Ctrl/Cmd + click para seleccionar varios agents.",
              )}
            </small>
          </div>
        );
      case "Capabilities":
        return (
          <div className="builder-form">
            <div className="helper-card">
              <p>
                {tx(
                  "Tools are the actions an agent can execute (for example, searching code, editing files, or running commands).",
                  "Los Tools son acciones que un agent puede ejecutar (por ejemplo, buscar código, editar archivos o correr comandos).",
                )}
              </p>
              <p>
                {tx(
                  "Available tools are loaded from the capabilities declared in all currently loaded agents and merged into a shared catalog.",
                  "Los Tools disponibles se cargan desde las capabilities declaradas en todos los agents cargados actualmente y se unifican en un catálogo compartido.",
                )}
              </p>
              <p>
                {tx(
                  "Use tool IDs in this field. If you add or edit agent files, refresh the dashboard to rebuild the catalog.",
                  "Usa IDs de Tool en este campo. Si agregas o editas archivos de agent, recarga el dashboard para reconstruir el catálogo.",
                )}
              </p>
              <p>
                {tx(
                  "Skills are discovered from agent capabilities and installed skill folders",
                  "Los Skills se descubren desde las capabilities del agent y las carpetas de skills instaladas",
                )}{" "}
                ({tx("for example", "por ejemplo")} <code>.agents/skills</code>{" "}
                {tx(
                  "in the current workspace and common global VS Code skills paths).",
                  "en el workspace actual y rutas globales comunes de skills de VS Code).",
                )}
              </p>
              <p>
                {tx(
                  "Skills are reusable guidance packs that help an agent perform specialized tasks with better quality and consistency.",
                  "Los Skills son paquetes reutilizables de guía que ayudan a un agent a realizar tareas especializadas con mejor calidad y consistencia.",
                )}
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
                  <p>{tx("How tools work", "Cómo funcionan los Tools")}</p>
                  <p>
                    {tx(
                      "A Tool is a concrete action the agent can call while running.",
                      "Un Tool es una acción concreta que el agent puede invocar mientras corre.",
                    )}
                  </p>
                  <p>
                    {tx(
                      "Use this form when you want to allow a new action. Then assign that tool to this agent.",
                      "Usa este formulario cuando quieras permitir una acción nueva. Luego asigna ese Tool a este agent.",
                    )}
                  </p>
                  <p>
                    {tx(
                      "Fill fields in this order:",
                      "Completa los campos en este orden:",
                    )}{" "}
                    <strong>Tool ID</strong>, <strong>Tool label</strong>,{" "}
                    <strong>Tool kind</strong>.
                  </p>
                  <p>
                    {tx(
                      "If you are unsure, start with built-in and a known ID like run_in_terminal.",
                      "Si no estás seguro, empieza con built-in y un ID conocido como run_in_terminal.",
                    )}
                  </p>
                </div>
                <div className="capability-form-grid">
                  <div className="helper-card">
                    <p>
                      {tx(
                        "Add or update a Tool",
                        "Agregar o actualizar un Tool",
                      )}
                    </p>
                    <p className="field-hint">
                      {tx(
                        "Create or update one callable action. If the same Tool ID already exists, this will update its label/kind.",
                        "Crea o actualiza una acción invocable. Si el mismo Tool ID ya existe, esto actualizará su label/kind.",
                      )}
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
                        {tx(
                          "Machine id used by the runtime. Use snake_case.",
                          "ID técnico usado por el runtime. Usa snake_case.",
                        )}
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
                        {tx(
                          "Human-readable name shown in UI.",
                          "Nombre legible para personas que se muestra en la UI.",
                        )}
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
                        {tx(
                          "built-in: native tool, extension: VS Code command, mcp: tool from MCP server.",
                          "built-in: Tool nativo, extension: comando de VS Code, mcp: Tool de un MCP server.",
                        )}
                      </small>
                    </label>
                    <div className="tool-template-row">
                      <span className="field-hint">
                        {tx("Quick examples:", "Ejemplos rápidos:")}
                      </span>
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
                        {tx("Built-in Example", "Ejemplo built-in")}
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
                        {tx("Extension Example", "Ejemplo extension")}
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
                        {tx("MCP Example", "Ejemplo MCP")}
                      </button>
                    </div>
                    <button
                      title="Create or update this tool definition in the current agent draft."
                      onClick={addToolFromForm}
                      disabled={!newToolId.trim()}
                    >
                      {tx("Add Tool", "Agregar Tool")}
                    </button>
                  </div>
                  <div className="helper-card">
                    <p>
                      {tx("Tool kinds explained", "Tipos de Tool explicados")}
                    </p>
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
                  {tx(
                    "Tools (ids, comma separated)",
                    "Tools (ids separados por coma)",
                  )}
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
                    {tx(
                      "Advanced mode: paste ids only. Labels and kinds will be inferred from discovered catalog when possible.",
                      "Modo avanzado: pega solo ids. Los labels y kinds se inferirán del catálogo descubierto cuando sea posible.",
                    )}
                  </small>
                </label>
                <div className="capability-preview">
                  <p>
                    {tx(
                      "Select tools (tag multi-select)",
                      "Selecciona Tools (multi-select por tags)",
                    )}
                  </p>
                  {graph.tools.length === 0 ? (
                    <p>
                      {tx(
                        "No discovered tools yet. Refresh after adding tools to agents.",
                        "Todavía no hay Tools descubiertos. Recarga después de agregar Tools a los agents.",
                      )}
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
                  <p>
                    {tx(
                      "Selected tools for this agent",
                      "Tools seleccionados para este agent",
                    )}
                  </p>
                  {draft.capabilities.tools.length === 0 ? (
                    <p>
                      {tx("No tools selected.", "No hay Tools seleccionados.")}
                    </p>
                  ) : (
                    <div className="chip-row removable-chip-row">
                      {draft.capabilities.tools.map((tool) => (
                        <span key={tool.id} className="selected-chip">
                          {tool.label} ({tool.id})
                          <button
                            title={`Remove tool ${tool.label} from this agent.`}
                            onClick={() => removeTool(tool.id)}
                          >
                            {tx("Remove", "Quitar")}
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
                  <p>{tx("Install Skills", "Instalar Skills")}</p>
                  <p>
                    Install skills in the current repo under
                    <code> .agents/skills </code>
                    or globally in your user skills folders.
                  </p>
                  <p>
                    {tx("Example command:", "Comando de ejemplo:")}
                    <code> npx skills add softaworks/agent-toolkit </code>
                  </p>
                  <p>
                    {tx(
                      "After installation, click Refresh and Agent Studio will detect them automatically.",
                      "Después de la instalación, haz click en Refresh y Agent Studio los detectará automáticamente.",
                    )}
                  </p>
                </div>
                <label>
                  {tx(
                    "Skills (ids, comma separated)",
                    "Skills (ids separados por coma)",
                  )}
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
                  <p>
                    {tx(
                      "Select skills (tag multi-select)",
                      "Selecciona Skills (multi-select por tags)",
                    )}
                  </p>
                  {graph.skills.length === 0 ? (
                    <p>
                      {tx(
                        "No discovered skills yet. Install a skill in",
                        "Todavía no hay Skills descubiertos. Instala un Skill en",
                      )}
                      <code> .agents/skills </code>
                      {tx(
                        "or in a global skills path, then refresh.",
                        "o en una ruta global de skills y luego recarga.",
                      )}
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
                  <p>
                    {tx(
                      "Selected skills for this agent",
                      "Skills seleccionados para este agent",
                    )}
                  </p>
                  {draft.capabilities.skills.length === 0 ? (
                    <p>
                      {tx(
                        "No skills selected.",
                        "No hay Skills seleccionados.",
                      )}
                    </p>
                  ) : (
                    <div className="chip-row removable-chip-row">
                      {draft.capabilities.skills.map((skill) => (
                        <span key={skill.id} className="selected-chip">
                          {skill.label} ({skill.id})
                          <button
                            title={`Remove skill ${skill.label} from this agent.`}
                            onClick={() => removeSkill(skill.id)}
                          >
                            {tx("Remove", "Quitar")}
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
                  {tx(
                    "MCP Servers (ids, comma separated)",
                    "MCP Servers (ids separados por coma)",
                  )}
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
                  <p>
                    {tx(
                      "Select MCP servers (tag multi-select)",
                      "Selecciona MCP servers (multi-select por tags)",
                    )}
                  </p>
                  {graph.mcpServers.length === 0 ? (
                    <p>
                      {tx(
                        "No MCP servers discovered. Add them to mcp.json.",
                        "No se descubrieron MCP servers. Agrégalos a mcp.json.",
                      )}
                    </p>
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
                  <p>
                    {tx(
                      "Selected MCP servers for this agent",
                      "MCP servers seleccionados para este agent",
                    )}
                  </p>
                  {draft.capabilities.mcpServers.length === 0 ? (
                    <p>
                      {tx(
                        "No MCP servers selected.",
                        "No hay MCP servers seleccionados.",
                      )}
                    </p>
                  ) : (
                    <div className="chip-row removable-chip-row">
                      {draft.capabilities.mcpServers.map((server) => (
                        <span key={server.id} className="selected-chip">
                          <span style={{ marginRight: 8 }}>
                            {server.label} ({server.id})
                          </span>
                          <label
                            className="mcp-autorun-label"
                            htmlFor={`mcp-autorun-${server.id}`}
                            style={{ marginRight: 8 }}
                          >
                            <input
                              id={`mcp-autorun-${server.id}`}
                              aria-label={`${tx("Auto-run", "Auto-run")} ${server.label}`}
                              type="checkbox"
                              checked={Boolean(server.autoRunMCP)}
                              onChange={() => toggleMcpAutoRun(server.id)}
                            />
                            <span
                              className="mcp-autorun-text"
                              style={{ marginLeft: 6 }}
                            >
                              {tx("Auto-run", "Auto-run")}
                            </span>
                          </label>
                          <button
                            aria-label={
                              tx("Remove MCP server", "Remove MCP server") +
                              ` ${server.id}`
                            }
                            title={`Remove MCP server ${server.label} from this agent.`}
                            onClick={() => removeMcpServer(server.id)}
                          >
                            {tx("Remove", "Quitar")}
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="capability-preview">
              <p>
                {tx("Available tools", "Tools disponibles")}:{" "}
                {graph.tools.length}
              </p>
              <p>
                {tx("Available skills", "Skills disponibles")}:{" "}
                {graph.skills.length}
              </p>
              <p>
                {tx("Discovered MCP servers", "MCP servers descubiertos")}:{" "}
                {graph.mcpServers.length}
              </p>
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
    (handoff) =>
      !allAgents.some(
        (agent) => agent.id === handoff.agent && agent.id !== draft.id,
      ),
  );

  return (
    <section className="builder">
      <div className="builder-header">
        <h2>{tx("Agent Builder", "Builder de Agent")}</h2>
        <div className="tab-row">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={tab === selectedTab ? "active" : ""}
              title={tx(
                `Open the ${tab} section of the selected agent.`,
                `Abre la sección ${tabLabels[tab]} del agent seleccionado.`,
              )}
              onClick={() => setTab(tab)}
            >
              {tabLabels[tab]}
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
          disabled={!hasValidContent || brokenHandoffs.length > 0}
          onClick={() => {
            setSaveError(null);
            if (!vscode) {
              setSaveError(
                tx(
                  "Cannot save: VS Code API unavailable in this context.",
                  "No se puede guardar: API de VS Code no disponible en este contexto.",
                ),
              );
              try {
                // eslint-disable-next-line no-console
                console.error(
                  "[AgentBuilder] VS Code API unavailable; cannot post message.",
                );
              } catch {}
              return;
            }

            try {
              // eslint-disable-next-line no-console
              console.log("[AgentBuilder] saveAgent payload:", draft);
            } catch (e) {
              // ignore
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
          }}
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
