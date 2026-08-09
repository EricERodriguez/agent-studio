# Arquitectura: motor nativo — N terminales de VS Code + detección de fin de turno

## Estado actual (punto de partida real)

`runWorkflow` en `src/extension.ts` (líneas ~607-818) hoy, en modo CLI:

- Crea o reutiliza **una sola** `vscode.Terminal` para todo el workflow.
- Recorre el grafo con DFS (`walkFrom`), sin interpretar condiciones de transición por edge.
- Envía cada agente a esa misma terminal con `chatBridgeService.sendAgentToTerminal`.
- Marca un paso como `"completed"` **apenas se envía el prompt**, no cuando el agente termina de
  responder. Hay un `setTimeout` fijo de 500ms entre pasos, no una señal real de finalización.

Ninguna de estas cuatro cosas alcanza para lo que se necesita: terminales paralelas, gating de
handoffs que depende de saber si el paso anterior realmente terminó, y condiciones de transición
reales.

## Parte 1 — N terminales en paralelo

Esta parte es directa y de bajo riesgo: en vez de una `cliTerminal` compartida, el
`WorkflowRunManager` mantiene `Map<runId, Map<nodeId, vscode.Terminal>>`, creando una
`vscode.Terminal` por nodo ejecutable con `vscode.window.createTerminal({ name, cwd })` — el
mismo mecanismo que ya usa el código actual, sólo que una vez por nodo en lugar de una vez por
workflow. Layout: hasta 3 agentes visibles en split, más de 3 en tabs (idea ya validada en el
plan anterior, no cambia).

Cerrar una terminal de VS Code no debe perder el trabajo del agente si está a mitad de una
respuesta larga — a diferencia del diseño anterior (que apoyaba esto en que tmux es quien
sostiene la sesión real), acá **no hay tmux de por medio**, así que hay que decidir
explícitamente qué pasa si el usuario cierra la terminal de un agente a mitad de un turno: lo más
simple y consistente es tratarlo como fallo de ese paso (igual que hoy pasa si el agente no se
encuentra), no como algo recuperable — ver Fase 7 en `01-plan-revisado.md`, sin cerrar todavía.

## Parte 2 — Detección de fin de turno (el problema real)

**Este es el punto que la v1/v2 del plan resolvía "gratis" apoyándose en el protocolo de
handoffs de SwarmForge, y que acá hay que resolver desde cero.**

### Opción elegida: Terminal Shell Integration API + invocación one-shot por turno

VS Code expone una API de **Shell Integration** (`vscode.window.onDidStartTerminalShellExecution`
/ `onDidEndTerminalShellExecution`, y `terminal.shellIntegration.executeCommand(...)`) que permite
saber cuándo un comando ejecutado *dentro* de una terminal integrada termina, incluyendo su exit
code — siempre que el shell de esa terminal tenga la integración activa (bash/zsh/pwsh la
soportan out of the box en VS Code moderno; requiere que el usuario no la haya desactivado
explícitamente).

Para que esa señal sea útil por **turno** (no sólo por terminal completa), el diseño asume que
cada turno de un agente se lanza como una invocación **no interactiva / one-shot** del backend
—por ejemplo `claude -p "<prompt>"` o `codex exec "<prompt>"` (los nombres exactos de flag hay
que confirmarlos contra la versión de CLI instalada, no asumirlos)— en vez de mantener una sesión
REPL larga donde Agent Studio le va tipeando mensajes sucesivos. Cada invocación one-shot es "un
comando" a nivel de shell, así que Shell Integration puede reportar su inicio/fin y exit code de
forma limpia, turno por turno, en la misma terminal reutilizada para ese nodo.

```ts
// Snippet simplificado para mostrar el mecanismo de detección — la construcción real del
// comando debe usar el overload de args[], no un commandLine armado a mano, ver más abajo
// "Riesgo de escaping/inyección al construir la invocación one-shot".
const execution = terminal.shellIntegration?.executeCommand(commandLine);
// ...
vscode.window.onDidEndTerminalShellExecution((e) => {
  if (e.execution === execution) {
    // e.exitCode: 0 = éxito, distinto de 0 = falló
    // acá el WorkflowRunManager marca el paso como completed/failed real
  }
});
```

### Fallback si Shell Integration no está disponible

`terminal.shellIntegration` puede ser `undefined` (shell no soportado, integración desactivada
por el usuario, entorno remoto sin inyección de secuencias de escape). Para esos casos, el diseño
necesita un mecanismo de respaldo: instruir al agente (vía el bloque de contexto/instructions que
Agent Studio ya le arma) a ejecutar, al terminar su turno, un comando marcador propio de Agent
Studio (ej. `agent-studio-turn-done --exit-code $?`) que el `WorkflowRunManager` puede detectar
por otra vía (ej. un archivo que ese comando escribe en `.agent-studio/runs/<run-id>/`, vigilado
con un `FileSystemWatcher` de VS Code). Es más frágil que la señal de Shell Integration (depende
de que el agente efectivamente ejecute ese comando), pero da una vía de recuperación cuando la
API no está disponible.

### Riesgo de escaping/inyección al construir la invocación one-shot

El código real (`src/services/chatBridgeService.ts:20`) hoy aplana el prompt con
`.replace(/\r?\n+/g, " ")` y lo tipea con `terminal.sendText` como input interactivo — no como
argumento de shell, así que hoy no hay riesgo de inyección. En cuanto Fase 5 pase a construir una
invocación one-shot, ese mismo texto (que puede traer comillas, backticks, `$()`) hay que tratarlo
como no confiable — **no sólo cuando viene de otro agente** (como se pensaba en una versión
anterior de este documento, cuando existía un modo `ai-review` que interpolaba la salida de un
reviewer): cualquier prompt puede tener contenido problemático, incluso uno escrito por el propio
usuario o que cita un mensaje de error real, así que la mitigación tiene que ser general, no
condicionada a "si el contenido viene de una IA".

**Corrección (confirmado leyendo `node_modules/@types/vscode/index.d.ts` línea ~7943, no
asumido):** el overload `executeCommand(executable: string, args: string[])` existe en la versión
de VS Code que usa este proyecto (`engines.vscode: ^1.110.0`), pero **su propio doc-comment
advierte explícitamente que el escaping no está pensado como medida de seguridad**: "this escaping
is not intended to be a security measure, be careful when passing untrusted data to this API as
strings like `$(...)` can often be used in shells to execute code within a string". Esto invalida
la mitigación que se había propuesto acá — usar `args[]` reduce roturas accidentales (comillas,
espacios) pero **no es una barrera de seguridad** contra un prompt adversarial.

**Mitigación real:** no pasar el contenido del prompt como argumento de shell en absoluto, ni por
`commandLine` ni por `args[]`. En su lugar, escribir el prompt de cada turno a un archivo dentro de
`.agent-studio/runs/<run-id>/` (ruta que arma Agent Studio, no contenido de agente — segura de
interpolar) y pasarle al backend **una ruta de archivo o usar stdin**, si el CLI lo soporta (ej.
`claude -p --file <ruta>` o `cat <ruta> | claude -p -`, a confirmar el flag real contra la CLI
instalada). El único string que se interpola en el `commandLine`/`args[]` es esa ruta controlada
por Agent Studio — el prompt en sí nunca pasa por la interpretación del shell. Si ningún backend
soporta leer desde archivo/stdin en modo one-shot, la alternativa es invocar el proceso directo
con `child_process.spawn(executable, args, { shell: false })` (sin shell de por medio en absoluto)
y volcar su stdout/stderr a la terminal visible manualmente — más trabajo, pero sin ninguna
interpretación de shell involucrada.

### Qué falta validar antes de construir nada más encima de esto

Esto es diseño, no un hecho confirmado en la práctica:

1. Confirmar el flag real de modo no interactivo de `claude` y de `codex` en las versiones que
   Agent Studio va a soportar (puede no llamarse `-p`/`exec`, puede tener diferencias de
   comportamiento entre versiones).
2. Confirmar que `onDidEndTerminalShellExecution` dispara de forma confiable para una invocación
   larga (un agente puede tardar minutos en responder) y no tiene timeouts o límites raros.
3. Confirmar el comportamiento cuando el usuario interactúa manualmente con la terminal mientras
   un agente está corriendo (¿rompe la detección de shell integration? ¿es un caso a bloquear en
   la UI mientras un turno está en curso?).
4. Decidir explícitamente si "one-shot por turno" es aceptable para el modo `chat` (hoy
   `runWorkflow` también soporta abrir el agente en el panel de chat de VS Code en vez de CLI) o
   si esta funcionalidad de N terminales queda limitada al modo CLI — el modo chat no tiene
   equivalente de terminal ni de Shell Integration.

Este documento no da por cerrado el diseño hasta que el punto 1 del "Orden de entregas" en
`01-plan-revisado.md` (el prototipo aislado) confirme estos cuatro puntos contra CLIs reales.
