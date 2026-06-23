# Agent Studio — Referencia de UI/UX actual

Documento de referencia para usar junto a capturas de pantalla (ver carpeta `screenshots/`)
como input para un rediseño en Claude Design (claude.ai/design).

---

## 1. Navbar / Toolbar de la izquierda

Agent Studio no tiene un sidebar tradicional: tiene un **toolbar superior expandible/colapsable**
ubicado debajo del header, antes del contenido principal.

### Header (parte superior)

- Kicker: "Orchestration Workspace" / "Workspace de orquestación"
- Título: "Agent Studio"
- Subtítulo: "Build agents, model handoffs, and run execution workflows."
- Chips de métricas: `Agents: N`, `Workflows: N`, `Capabilities: N`
- Acciones del header:
  - Selector de idioma (`<select>`: English / Español)
  - Botón **"Create Agent"** → crea un `.agent.md` nuevo y lo abre en el builder
  - Botón **"Create Workflow"** → crea un workflow nuevo con un paso de entrada por defecto
  - Botón **"Refresh"** → recarga agents/workflows/capabilities desde disco

### Toolbar principal (colapsable, "Workspace Controls")

**A. Quick Search** (grid de 3 columnas)

- Input "Find agent" (busca por nombre/id/role/descripción, hasta 6 resultados)
- Input "Find workflow" (busca por nombre/id/descripción, hasta 6 resultados)
- Input "Find capability" (busca en Tools/Skills/MCP, hasta 9 resultados)
- Debajo de cada input, una grilla de resultados como chips clicables que seleccionan
  el agent/workflow/capability correspondiente.

**B. Context Selection**

- Select "Agent" (con optgroups "Repository" / "Global") — define el agent activo en el builder/inspector
- Select "Workflow" — define el workflow activo en el editor/gráfico

**C. Capability Filters** (grid de 4 selects)

- Filtro por Tool ("All tools" + lista)
- Filtro por Skill ("All skills" + lista)
- Filtro por MCP server ("All MCP servers" + lista)
- Filtro por Scope ("All scopes" / "Repository only" / "Global only")
- Botón "Clear Filters" (disabled si no hay filtros activos)
- Botón "Show/Hide Capability Graph"
- Feedback: chip "Showing N of TOTAL agents" + chips removibles por cada filtro activo

---

## 2. Flujo de creación / edición de un agente

### Inicio

Click en **"Create Agent"** (header) → la extensión crea un `.agent.md` base, lo agrega al
estado global y lo selecciona automáticamente. El builder se abre en la pestaña **Identity**.

### AgentBuilder — 6 tabs

#### Tab 1: Identity

| Campo                           | Tipo                                | Notas                                                                                                             |
| ------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Agent ID                        | input (solo lectura)                | identificador único, no editable                                                                                  |
| Scope                           | select                              | "Repository" / "Global"                                                                                           |
| Name                            | input                               | requerido para guardar                                                                                            |
| Description                     | input                               | resumen corto                                                                                                     |
| Role                            | input + quick-picks                 | sugerencias: planning, implementation, review, developer, architect, qa, security, documentation                  |
| Tags                            | input (coma-separado) + quick-picks | sugerencias: planning, implementation, review, backend, frontend, testing, security, docs, automation, typescript |
| Generate agent for AI providers | botones toggle                      | Claude Code, OpenAI Codex (AGENTS.md), Google Antigravity + botón "✨ All AIs"                                    |
| Export now                      | botón                               | exporta archivos específicos por proveedor (disabled si no hay providers seleccionados)                           |

#### Tab 2: Instructions

- Textarea única (14 filas) — el prompt principal del agente. Requerido para guardar.

#### Tab 3: Context

- Textarea única (10 filas) — contexto/restricciones adicionales. Opcional.

#### Tab 4: Handoffs

- Select múltiple de otros agentes (excluye el actual) — tamaño dinámico 3-8 filas
- Al seleccionar un agente nuevo se crea un handoff por defecto: `{ agent, label, prompt: "Delegate to {label} when this task needs their expertise.", send: true }`
- Botón "Clear handoffs" (disabled si no hay handoffs)
- Hint: usar Ctrl/Cmd+click para selección múltiple

#### Tab 5: Capabilities (3 sub-paneles: Tools / Skills / MCP Servers)

**Tools**

- Formulario "Add or update a Tool": Tool ID (input), Tool label (input), Tool kind (select: built-in/extension/mcp)
- Quick examples: botones para precargar ejemplos de cada kind
- Botón "Add Tool" (disabled si no hay ID)
- Input avanzado "Tools (ids, comma separated)" para pegar varios ids a la vez
- Multi-select por tags ("chips") de tools descubiertos — click togglea inclusión
- Lista "Selected tools for this agent" con chips removibles

**Skills**

- Helper card con instrucciones de instalación (`npx skills add ...` en `.agents/skills`)
- Input avanzado de ids separados por coma
- Multi-select por tags de skills descubiertas
- Lista de skills seleccionadas con chips removibles

**MCP Servers**

- Input avanzado de ids separados por coma
- Multi-select por tags de MCP servers descubiertos
- Lista de servers seleccionados, cada uno con:
  - Checkbox "Auto-run"
  - Botón "Remove"

Resumen final: "Available tools: N", "Available skills: N", "Discovered MCP servers: N"

#### Tab 6: Source Preview

- `<pre>` con el markdown generado en tiempo real (frontmatter YAML + instructions), reflejando
  exactamente lo que se escribirá en el archivo `.agent.md`.

### Validación y guardado

- Error bloqueante: nombre o instructions vacíos → "Agent name and instructions are required."
- Warning no bloqueante: sin capabilities configuradas
- Error bloqueante: handoffs rotos (referencian un agente inexistente o a sí mismo)
- Botones: **Save** (disabled si hay errores) · **Cancel** (descarta cambios) · **Open raw file** (abre el .md) · **Delete** (con confirmación)

---

## 3. Agent Graph (gráfico de relaciones entre agentes)

Renderizado con ReactFlow dentro de un contenedor `.graph-canvas` (alto fijo, scroll interno).

**Nodos** — uno por agente:

- Label: `{agent.name} T:{tools.length} S:{skills.length} M:{mcpServers.length}` (conteo de Tools/Skills/MCP)
- Estilo: borde 1px `--vscode-panel-border`, radio 10px, padding 12px, min-width 180px,
  fondo `--vscode-editor-background`, texto `--vscode-editor-foreground` (se adapta al tema activo)

**Conexiones (edges)** — representan handoffs:

- Van del agente origen al agente destino de cada handoff configurado
- Label fijo: "handoff"
- Solo se dibujan si el agente destino existe realmente en la lista (se valida el id)

**Controles**:

- Zoom (rueda/pinch), rango 0.2x–2x; viewport inicial x=0,y=0,zoom=1
- Pan libre (arrastre)
- `<Controls />` de ReactFlow: zoom in, zoom out, fit view, reset
- `<MiniMap />`: fondo `--vscode-editorWidget-background`, nodos en `--vscode-charts-blue`,
  máscara de viewport semitransparente; es pannable (clic + arrastre para navegar)
- `<Background />`: patrón de puntos/grid de fondo

**Interacciones**:

- Click en un nodo → `selectAgent(id)`: selecciona ese agente en el Builder y el Inspector
- Hover en un nodo → ReactFlow revela los "handles" (puntos de conexión) en los bordes
- Arrastre de nodos posible pero no persiste posición en este modo (solo se persiste en Workflow Graph)

**Estado vacío**: "No agents found. Create one from Templates or place a .agent.md file under .github/agents..."

---

## 4. Workflow Graph (gráfico de pasos del workflow)

Mismo motor ReactFlow, pero los nodos representan **steps** (pasos) de ejecución, no agentes sueltos.

**Nodos**:

- Label: nombre del agente asociado a ese step (o su ID si no se resuelve)
- Estilo base: radio 8px, padding 8px, min-width 160px, mismos colores de fondo/texto del tema
- **Entry point**: se distingue con borde `2px solid var(--vscode-charts-green)` (vs. `1px solid
var(--vscode-panel-border)` en los steps normales) — es la única diferencia visual de "primero en
  ejecutarse"

**Conexiones**: representan el orden de ejecución entre steps; pueden llevar un label de transición
(`edge.label`); no están animadas.

**Controles**: idénticos al Agent Graph (zoom, pan, MiniMap, Controls, Background).

**Botones adicionales sobre este grafo** (en el header de la sección, dentro de DashboardPage):

- **"Auto Layout"** → reordena automáticamente los nodos del workflow en un layout limpio
- **"Save Workflow"** → persiste a disco la posición/estructura actual del grafo

**Interacción**: click en un nodo → `selectAgent(agentId)` del step, igual que en Agent Graph.

**Cómo se crean conexiones (ver WorkflowBuilder)**: se hace hover sobre un nodo para revelar sus
handles, y se arrastra desde un handle hasta otro nodo para crear una arista — la conexión se dibuja
directamente en este canvas, no en un formulario aparte.

**Estado vacío**: "No workflow to render. Create a workflow from the dashboard to see nodes and
connections here."

---

## 5. Workflow Editor (WorkflowBuilder.tsx)

**Inicio**: botón "Create Workflow" en el header → crea un WorkflowDefinition base y lo abre.

**Si no hay workflow seleccionado**: placeholder "Select a workflow from the toolbar above, or create
one with the Create Workflow button."

### Formulario de metadata

| Campo       | Tipo                                       | Comportamiento                                               |
| ----------- | ------------------------------------------ | ------------------------------------------------------------ |
| Name        | input                                      | se persiste con `updateWorkflowMeta` al perder foco (onBlur) |
| Description | input (placeholder "Optional description") | opcional, mismo guardado onBlur                              |
| Scope       | select ("Repository" / "Global")           | persiste de inmediato al cambiar (`onChange`)                |

### Helper card "Steps"

Explica: cada step ejecuta un agente específico; el step "Entry" es donde arranca el workflow; las
conexiones entre steps definen el orden de ejecución.

### Agregar un step

- Fila "Add Agent as Step": `<select>` con todos los agentes (`{agent.name} ({agent.id})`) + botón
  **"Add Step"** (disabled si no hay agente elegido) → `addWorkflowStep(workflowId, agentId)`

### Lista de steps (`step-list`)

Cada step muestra:

- Nombre del agente asociado
- Si es el entry point: badge **"Entry"** (chip resaltado); si no, botón **"Set Entry"** →
  `setWorkflowEntryStep(workflowId, nodeId)`
- Botón **"Remove"** → `removeWorkflowStep`, que también elimina automáticamente las aristas
  conectadas a ese step
- Estado vacío: "No steps yet. Select an agent above and click Add Step."

### Conexión entre steps

No hay UI de formulario para esto — se hace directamente en el Workflow Graph (ver sección 4):
hover revela handles, arrastrar de un handle a otro nodo crea la arista.

### Ejecución

- Helper card "Execution" explicando la diferencia entre los modos
- Selector **"Run mode"**: "Chat" / "Plan" (estos dos valores no están traducidos)
- Botón **"Run Workflow"** (texto cambia a "Running..." mientras corre; disabled si ya está
  `running`) → envía `runWorkflow` con `{ workflowId, mode }`

### Panel de estado de ejecución (si hay una corrida activa)

- Encabezado: "Run Status: {STATUS} ({mode})"
- Lista numerada de steps con su estado (pending/running/completed/failed/skipped) y mensaje opcional
- Si el modo fue "plan": el plan generado se muestra en un `<pre>` con scroll
- Si hay error: "Error: {mensaje}"

### Persistencia y borrado

- Botón **"Save Workflow"** → `saveWorkflow` con todo el objeto del workflow
- Botón **"Delete Workflow"** (estilo danger) → `deleteWorkflow` (con confirmación del lado de la
  extensión)

---

## 6. Selector de idioma (detalle completo)

Ubicado en el header (`header-actions`), clase `.language-switcher`: caja con borde y fondo sutil que
combina un label "Language"/"Idioma" (gris, 12px) + un `<select>` (min-width 112px) con dos opciones:
"English" (en) / "Español" (es).

**Al cambiar**:

- Dispara `setLanguage()` del contexto `useI18n()`
- Se persiste en el estado del webview vía `vscode.setState({ ...estadoActual, language })`
  (no usa `localStorage` directamente, sino el mecanismo de estado de VS Code, que sobrevive a
  recargas del webview)
- Al volver a abrir, se recupera con `getStoredLanguage()` leyendo `vscode.getState()`
- Todo el texto de la UI usa una función `tx(ingles, español)` que conmuta según el idioma activo

**Textos que NO se traducen** (quedan en inglés siempre): las opciones "Chat"/"Plan" del Run mode,
la etiqueta "Entry" del badge de entry point, las abreviaturas "T"/"S"/"M" de los nodos del Agent
Graph, y obviamente cualquier dato dinámico (nombres de agentes, descripciones, labels de
capabilities) que viene tal cual del usuario/sistema de archivos.

---

## 7. Inspector Panel — precedencia de estados

El Inspector tiene 3 estados, evaluados en este orden de prioridad:

1. **Capability seleccionada** (gana aunque haya un agente seleccionado): label, "Used by N agents",
   lista de IDs de agentes que la usan.
2. **Agente seleccionado**: nombre + badge de scope ("Global"/"Repo"), descripción (o "No
   description"), advertencia si el agente está "shadowed" (mismo id que otro agente de distinto
   scope, con tooltip mostrando la ruta del archivo que lo sombrea), Role, conteo de Tools/Skills/MCP,
   y botones **"Open in Chat"**, **"Edit"**, **"Reveal File"**.
3. **Nada seleccionado**: "Select an agent, node, or capability to inspect details."

Debajo (toggle "Show/Hide Capability Graph" en el toolbar): panel **"Capability Layer"** con la
relación agente → tools/skills/mcp y chips clicables que, al presionarlos, fuerzan el estado 1 del
Inspector para esa capability.

---

## 7bis. Activity Bar (árbol lateral de VS Code, fuera del webview)

Además del dashboard (el webview de las secciones 1–7), Agent Studio aporta una vista de árbol nativa
en la Activity Bar de VS Code, con su propio icono. Es una superficie completamente distinta (no
React/HTML, sino el `TreeView` nativo de VS Code) pero forma parte de la experiencia general del
plugin. Secciones del árbol, colapsables, en este orden:

- **Getting Started**: checklist de 5 pasos numerados, cada uno con su descripción corta —
  "Open the dashboard" (main workspace), "Create your first agent" (identity + prompt), "Learn tools
  and capabilities" (tools, skills, mcp), "Build a workflow" (connect agents), "Refresh after manual
  edits" (reload registry).
- **Quick Actions**: accesos directos — "Open Dashboard" (visual editor), "Create Agent" (new agent),
  "Create Workflow" (new flow), "Refresh Studio" (reload data).
- **Workspace Health**: resumen de salud del workspace — sub-sección "Summary" con métricas marcadas
  con iconos de estado (⚠ atención / ✓ ok), p.ej. "Orphan agents: 2" (attention), "Workflows without
  entry: 0" (ok), "Unused capabilities: 11" (attention) — y sub-árboles expandibles "Agents" /
  "Workflows".
- **Agents**: lista plana de todos los agentes con icono de estado (✓ ready / ⚠ atención / ⓘ info) y
  una línea de metadata: `{nombre} · {scope: $(repo)/$(global)} · {role} · {estado}` — p.ej.
  "Developer · $(globe) global · implementation · missing mcp". Al pasar el mouse aparece una acción
  inline "Agent Studio: Edit Agent".
- **Workflows**: lista plana con `{nombre} · {scope} · {N nodes} · {N edges}`.
- **Capabilities** (con acciones inline "Agent Studio: Show Tools Guide" / "Agent Studio: Quick Find
  Capability"): sub-árboles colapsables "Tools" (cada uno con conteo "N agents"), "Skills", "MCP
  Servers".
- **Templates**: lista de plantillas de agentes predefinidas (ej. "Planner Template").

Esta vista es importante para el rediseño porque es el primer contacto del usuario con el plugin
(aparece en la Activity Bar antes de abrir el dashboard) y actualmente es una lista de texto plana sin
jerarquía visual fuerte — buen candidato para mejoras de iconografía, agrupación y estados visuales.

---

## 8. Estilo visual actual (para referencia, ver `frontend-design` / prompt de Claude Design)

- CSS plano, sin librería de componentes, theming dinámico vía variables de VS Code
  (`--vscode-editor-foreground`, `--vscode-button-background`, `--vscode-charts-blue`, etc).
- Tipografía: Bahnschrift (headings), Segoe UI Variable (body).
- Layout de 3 columnas: toolbar/builder (izq) | grafos (centro) | inspector (der).
- Gráficos interactivos con ReactFlow (minimapa, controles, nodos).

---

## 9. Capturas de pantalla

Ver carpeta [`screenshots/`](./screenshots/). Capturas sugeridas a incluir:

1. `01-header-toolbar-collapsed.png` — header + toolbar colapsado + selector de idioma visible
2. `02-toolbar-expanded.png` — toolbar expandido (Quick Search + Context Selection + Filters)
3. `03-agent-builder-identity.png` — tab Identity
4. `04-agent-builder-instructions.png` — tab Instructions
5. `05-agent-builder-handoffs.png` — tab Handoffs
6. `06-agent-builder-capabilities-tools.png` — sub-panel Tools
7. `07-agent-builder-capabilities-skills.png` — sub-panel Skills
8. `08-agent-builder-capabilities-mcp.png` — sub-panel MCP Servers
9. `09-agent-builder-source-preview.png` — tab Source Preview
10. `10-agent-graph.png` — gráfico de relaciones entre agentes (handoffs)
11. `11-workflow-editor-form.png` — WorkflowBuilder: name/description/scope + lista de steps
12. `12-workflow-editor-run-status.png` — WorkflowBuilder con una corrida activa (Run Status)
13. `13-workflow-graph.png` — gráfico de pasos del workflow (entry point en verde)
14. `14-workflow-graph-connecting.png` — momento de arrastrar una conexión entre dos steps (handles visibles) — **no se pudo capturar** (interacción de drag)
15. `15-inspector-agent.png` — inspector con un agente seleccionado
16. `16-activity-bar.png` — vista de árbol de Agent Studio en la Activity Bar de VS Code (Getting Started, Quick Actions, Workspace Health, Agents, Workflows, Capabilities, Templates) — capturada en lugar del panel Capability Layer
17. `17-language-switcher-closed.png` — selector de idioma en estado cerrado (English/Español) — **no se pudo capturar el dropdown abierto**
