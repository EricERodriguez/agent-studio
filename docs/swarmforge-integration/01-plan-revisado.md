# Plan revisado — motor nativo de workflows con handoffs humano/IA

Este es el plan reescrito tras el pivot a motor nativo (ver `README.md` y `PROGRESS.md` para el
razonamiento). El requisito de fondo: **cualquier workflow de Agent Studio**, sin importar su
origen, debe poder tener handoffs marcados humano/IA/automático y correr cada agente en su propia
terminal integrada de VS Code.

## Fase 0 — Alcance y distribución

Ya no hay bloqueo de licencia sobre el runtime, porque el motor de ejecución es 100% de Agent
Studio — no se distribuye ni se modifica código de SwarmForge. Queda un matiz más chico y más
fácil de resolver: si el catálogo de templates de Agent Studio incluye versiones inspiradas en
`two-pack`/`four-pack`/`six-pack`, **el texto de los role prompts tiene que ser propio**, no
copiado de las ramas de SwarmForge (que siguen sin `LICENSE`). La forma del workflow (qué rol
hace qué, en qué orden) no es copiable como propiedad intelectual — la expresión concreta en un
archivo `.prompt` sí. Ver Fase 3.

## Fase 1 — Modelo de datos extendido

Sin cambios respecto a la v2: extender `WorkflowDefinition`/`WorkflowNode`/`WorkflowEdge` en
`src/domain/models.ts` de forma retrocompatible. Confirmado contra el código real que hoy
`WorkflowNode` sólo tiene `id, agentId, position, isEntry?` y `WorkflowEdge` sólo
`id, source, target, label?`, así que no hay conflicto con nada existente.

```ts
type HandoffMode = "automatic" | "human";

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  handoff?: {
    mode: HandoffMode;
    timeoutSeconds?: number;
    onTimeout?: "wait" | "reject" | "approve" | "fail";
  };
}

interface WorkflowNode {
  id: string;
  agentId: string;
  position: { x: number; y: number };
  isEntry?: boolean;
  terminal?: {
    visible: boolean;
    group?: string;   // para el layout de la Fase 5
  };
}
```

`WorkflowRunStep.status` (en `src/domain/messages.ts` y `webview/app/types.ts`) también se
extiende, por el pedido del usuario de distinguir visualmente "corriendo ahora" de "es el
próximo": de `"pending" | "running" | "completed" | "failed" | "skipped"` pasa a agregar
`"queued"` (predecesores resueltos, todavía no recibió el prompt) y `"waiting_approval"` (de la
Fase 6, único estado de pausa — ya no hay un estado separado de "esperando revisor de IA", ver
Fase 6 para el porqué). Detalle completo del mapeo a color/animación en
[`04-panel-ejecucion.md`](./04-panel-ejecucion.md).

Este modelo es igual sin importar si el workflow vino de un template inspirado en SwarmForge o
fue armado a mano — es el punto central del pivot: `handoff.mode` es un campo del dominio de
Agent Studio, no algo que dependa de ningún runtime externo.

## Fase 2 — Idioma de interacción separado del idioma de UI

Sin cambios respecto a la v2. Confirmado que hoy `webview/app/i18n.tsx` sólo controla la UI de
React (`tx(english, spanish)`) y no afecta el idioma en que responde un agente. Se resuelve
agregando un bloque de instrucciones de idioma al `context`/`instructions` que Agent Studio ya le
pasa a cada agente al armar su prompt, con override opcional por nodo — no depende de nada de
esta carpeta específicamente, es un requisito de UX independiente.

## Fase 3 — Catálogo de templates inspirados en two/four/six-pack

Se recrean como workflows nativos de Agent Studio (agentes + edges + `handoffMode`), no como
algo que se "importa y ejecuta con SwarmForge":

- **Two-pack**: `coder` ↔ `cleaner`, loop simple.
- **Four-pack**: `specifier` → `coder` → `refactorer` → `architect` → `specifier`, con
  `handoffMode: "human"` sugerido en el edge `specifier → coder` (aprobar la especificación antes
  de codear).
- **Six-pack**: `specifier` → `coder` → `cleaner` → `architect` → `hardener` → `QA`, con
  `handoffMode: "human"` sugerido en el edge final de `QA` (aprobación de cierre).

Los prompts de cada rol se escriben de cero, en base a la descripción pública que el propio
README de SwarmForge da de qué hace cada rol (esa descripción de responsabilidades sí es una idea
reusable; el archivo `.prompt` real de cada rama no se copia). El asistente de importación de la
v2 ("Nuevo workflow" → Custom / Two-Pack / Four-Pack / Six-Pack, con selección de proveedor por
rol, idioma, y aprobación de specifier/QA) se mantiene igual como flujo de UX.

## Fase 4 — `WorkflowRunManager`

Reemplaza al `src/services/swarmforge/*` de la v2 (que generaba `.agent-studio/runs/<run-id>/`
con `swarmforge.conf` para el runtime externo). Ahora es un servicio propio de Agent Studio,
separado de `extension.ts` (la v2 ya señalaba esto como necesario, sigue siendo cierto):

```text
src/services/workflowRun/
  workflowRunManager.ts     // state machine del run completo
  workflowTerminalService.ts // Fase 5: N terminales de VS Code
  handoffGateService.ts      // Fase 6: gating humano/IA in-process
  workflowRunStateService.ts // Fase 7: persistencia y recuperación
```

Sigue guardando estado en algo equivalente a `.agent-studio/runs/<run-id>/manifest.json`, pero ya
no genera ningún archivo de configuración para un runtime externo — el manifest es sólo estado
propio (qué nodo está en qué terminal, qué handoffs están pendientes, etc.).

## Fase 5 — N terminales de VS Code + detección de fin de turno

**El punto de mayor incertidumbre técnica de todo el plan.** Diseño completo en
[`02-arquitectura-motor-nativo.md`](./02-arquitectura-motor-nativo.md). Resumen: una
`vscode.Terminal` por nodo ejecutable (creada con `vscode.window.createTerminal`, igual que ya
hace el modo CLI actual pero en paralelo en vez de reusar una sola terminal), con detección de
fin de turno vía la API de **Terminal Shell Integration** de VS Code (`onDidEndTerminalShellExecution`,
expone el exit code de cada comando ejecutado en la terminal) combinada con invocación "one-shot"
del backend (`claude -p "..."`, `codex exec "..."` o equivalente no interactivo) por cada turno,
en vez de mantener una sesión REPL larga donde no hay una señal clara de "este turno terminó".

**Confirmado por el usuario:** esto implica cambiar `runWorkflow` en `src/extension.ts` para que
`step.status = "completed"` se setee cuando llega el evento real de fin de ejecución (exit code),
no en la línea ~777 actual donde se marca "completed" apenas se llama a
`chatBridgeService.sendAgentToTerminal`. Esto es un prerequisito duro de la Fase 8 (estados
visuales): sin esta corrección, cualquier animación de "corriendo" sería falsa (se vería
"completado" antes de que el agente hubiera terminado de verdad).

## Fase 6 — Handoff control: Human-in-the-Loop + IA como nodo del grafo

**Revisado (2026-08-09) para cerrar un riesgo de inyección — ver `05-riesgos.md`.** Diseño
completo en [`03-arquitectura-handoff-control.md`](./03-arquitectura-handoff-control.md). Resumen:
`HandoffMode` queda en sólo dos valores, `automatic` y `human` — no hay un tercer modo `ai-review`
a nivel de edge. Como `WorkflowRunManager` es quien decide cuándo enviarle el prompt al siguiente
nodo, Human-in-the-Loop es simplemente no enviarlo hasta que el usuario aprueba desde un panel en
la UI de Agent Studio.

"AI-in-the-Loop" deja de ser un mecanismo de runtime que el motor tiene que interceptar y
arbitrar (parsear una decisión JSON generada por un agente y ramificar automáticamente según esa
decisión) y pasa a ser, simplemente, **modelar al revisor como un nodo más del workflow**: el
usuario agrega un nodo "reviewer" en el grafo, con un edge de entrada normal desde el agente que
produjo el trabajo a revisar, y sus propios edges de salida (que pueden ser `automatic` o `human`,
según qué tan estricto quiera ser el usuario después de la revisión). El motor no necesita saber
que ese nodo "es" un revisor — lo ejecuta igual que a cualquier otro agente del grafo. Esto cierra
la parte más riesgosa del diseño anterior: el motor ya no confía en, ni actúa automáticamente
sobre, una estructura de decisión que un agente generó.

## Fase 7 — Estado y recuperación

Sin revisar en detalle todavía (ver `PROGRESS.md`). Sigue siendo válida la idea de la v1/v2de
persistir `RunStatus`/`StepStatus` y reconectar al reabrir VS Code, pero ahora es más simple en
un sentido (no hay que verificar un socket tmux externo) y más difícil en otro (si VS Code se
cierra a mitad de un turno "one-shot", hay que decidir si se reintenta el turno o se recupera su
resultado desde el historial del shell integration).

## Fase 8 — Panel de ejecución y estados visuales del grafo

Diseño técnico concreto en [`04-panel-ejecucion.md`](./04-panel-ejecucion.md), anclado al código
real (`GraphCanvas.tsx`, `styles.css`): hoy los nodos del grafo (`.graph-node`) no tienen ningún
color de estado de ejecución — sólo el panel lateral `graph-run-panel` lo tiene, y de forma
incompleta (sin estado "próximo", sin animación). Se agrega un estado nuevo `queued` ("próximo en
ejecución", color sólido distinto de `running`) y se anima únicamente el estado `running` (pulso
de `box-shadow`, respetando `prefers-reduced-motion`) para que sólo lo que está pasando ahora
mismo tenga movimiento — el resto de los estados (`completed`, `failed`, `waiting_approval`,
`skipped`) son colores estáticos usando los tokens `--vscode-charts-*` que VS Code ya expone,
para heredar tema claro/oscuro sin trabajo extra. Un nodo "reviewer" de IA (Fase 6) no tiene un
color propio — se ve como `running`/`completed` igual que cualquier otro nodo, porque para el
motor es un nodo más.

## Fase 9 — Preflight de seguridad

Se simplifica respecto a la v2 (ya no hace falta verificar `tmux`/`bb`/versión de SwarmForge).
Queda: verificar que el workspace es un repo git, mostrar cambios sin commit antes de lanzar un
run, confirmar que las CLIs de los proveedores elegidos están instaladas y soportan modo one-shot
si el diseño de la Fase 5 lo requiere, no guardar secretos en el estado del run.

## Fase 10 — Pruebas

Sin revisión detallada todavía. El punto nuevo más importante: un smoke test real (no mockeado)
de que la API de Terminal Shell Integration entrega el exit code de forma confiable para al menos
`claude` y `codex` en modo one-shot, antes de construir el resto del `WorkflowRunManager` sobre
ese supuesto — ver Fase 5.

## Orden de entregas (MVP) — revisado

1. **Prototipo de detección de fin de turno** (Fase 5, sin UI, sin modelo de datos nuevo) — un
   script/comando de desarrollo que abra una terminal, corra `claude -p "..."` o `codex exec
   "..."`, y confirme que se puede leer el exit code de forma confiable vía Shell Integration.
   Esto es lo que valida si el resto del plan es viable tal como está diseñado.
2. **Modelo de datos extendido** (Fase 1) — en paralelo con el punto 1, no depende de él.
3. **`WorkflowRunManager` con N terminales** (Fases 4+5) integrando el resultado del prototipo.
4. **Gating in-process HIL/AIL** (Fase 6) sobre el run manager ya funcionando en modo automático.
5. **Catálogo de templates** (Fase 3) con prompts propios.
6. **Idioma de interacción** (Fase 2) — independiente, se puede intercalar en cualquier punto.
7. **Endurecimiento**: estado/recuperación (Fase 7), panel (Fase 8), preflight (Fase 9), pruebas
   (Fase 10).

A diferencia de la v2 (que arrancaba por el terminal adapter de SwarmForge porque era la pieza
más aislada de verificar), acá el punto de partida es el mismo tipo de validación temprana pero
sin ninguna dependencia externa: confirmar que Agent Studio puede saber, de forma confiable,
cuándo un agente terminó su turno dentro de una terminal de VS Code. Si esa señal no es confiable
en la práctica, todo lo demás (paralelismo real, gating de handoffs, panel de estado) se apoya en
un supuesto roto.
