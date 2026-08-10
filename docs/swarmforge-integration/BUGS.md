# Bugs conocidos — pendientes de resolver

Bugs reales encontrados en pruebas, dejados de lado a propósito para no frenar el avance del
resto del plan. El usuario pidió juntarlos acá y resolverlos todos juntos más adelante en vez de
uno a la vez. No borrar una entrada hasta confirmar el fix en una corrida real, no sólo que
compile.

## Abiertos

### 1. Split de terminales no funciona

- **Síntoma**: todas las terminales de un run abren como tabs nuevos, ninguna en split, ni
  siquiera la segunda relativa a la primera (no es una condición de carrera entre nodos paralelos
  — nodos claramente secuenciales en el tiempo también fallan).
- **Qué se intentó**: `location: { parentTerminal }` en `WorkflowTerminalService.getOrCreateTerminal`
  (`src/services/workflowRun/workflowTerminalService.ts`) — coincide con lo documentado en
  `@types/vscode` para `TerminalOptions`. Se agregó `anchorTerminal.show(true)` antes de crear
  cada split, por si VS Code sólo respeta la opción cuando el padre está activo. **Ninguno de los
  dos intentos se confirmó que funcione.**
- **Próximo paso sugerido**: probar `vscode.commands.executeCommand("workbench.action.terminal.split")`
  como alternativa a `location.parentTerminal`, o revisar si hay una preferencia de usuario/versión
  de VS Code que esté anulando el layout pedido por la API.
- Ver `PROGRESS.md`, sección "Segunda ronda de pruebas" (2026-08-09).

### 2. Codex CLI: "run workflow" con codex-cli no hace nada

- **Síntoma**: al elegir el modo Codex CLI y correr el workflow, no pasa nada visible — ni error,
  ni progreso.
- **Contexto**: esto es sobre el diseño nuevo de `codex app-server` (JSON-RPC/stdio), implementado
  el mismo día que se reportó este bug, **todavía sin confirmar en la práctica ni una vez**. No se
  sabe todavía si el problema es: el proceso `codex app-server --stdio` no arranca (ej. `codex` no
  está en el PATH del extension host, distinto del PATH de una terminal interactiva), el handshake
  JSON-RPC falla silenciosamente, o algo se traga un error sin reportarlo a la UI.
- **Qué revisar primero**: el Output Channel **"Agent Studio: Codex app-server"** — ahí debería
  quedar todo el tráfico JSON-RPC crudo (líneas `>`/`<`) y cualquier error de spawn o de stderr.
  Si ese canal está vacío, el problema es que el proceso ni siquiera arrancó.
- Ver `src/services/workflowRun/codexAppServerRunner.ts` y `PROGRESS.md`, sección
  "`codex app-server` implementado" (2026-08-09).

### 3. El toggle de handoff no muestra el ícono ⚡ al elegir "Auto"

- **Síntoma**: al seleccionar un edge y tocar "⚡ Auto" en el toggle nuevo, el edge no muestra
  ningún ícono en el grafo — sólo el texto "handoff" tal cual. El caso "👤 Human" sí funciona (se
  ve el ícono en la etiqueta del edge).
- **Causa (ya identificada, no arreglada todavía)**: en `GraphCanvas.tsx`, el cálculo del `label`
  del edge sólo antepone un ícono cuando `handoffMode === "human"` — para `"automatic"` cae
  directo a `edge.label` sin ningún prefijo. Es una asimetría simple de arreglar: agregar el
  prefijo `⚡` también para el caso automático, igual que se hizo para `👤`.
- Ver `PROGRESS.md`, sección "Editor de grafo: selector de `handoff.mode` por edge" (2026-08-09).

## Cómo agregar un bug nuevo

Cada entrada: síntoma concreto (qué se hizo, qué se esperaba, qué pasó), qué se intentó si ya se
intentó algo, y un link a la sección de `PROGRESS.md` con el detalle completo si existe. No
duplicar el detalle largo acá — este archivo es el índice rápido de "qué falta arreglar", el
detalle de investigación vive en `PROGRESS.md`.
