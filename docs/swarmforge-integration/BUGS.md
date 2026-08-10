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

### 2. El toggle de handoff no muestra el ícono ⚡ al elegir "Auto"

- **Síntoma**: al seleccionar un edge y tocar "⚡ Auto" en el toggle nuevo, el edge no muestra
  ningún ícono en el grafo — sólo el texto "handoff" tal cual. El caso "👤 Human" sí funciona (se
  ve el ícono en la etiqueta del edge).
- **Causa (ya identificada, no arreglada todavía)**: en `GraphCanvas.tsx`, el cálculo del `label`
  del edge sólo antepone un ícono cuando `handoffMode === "human"` — para `"automatic"` cae
  directo a `edge.label` sin ningún prefijo. Es una asimetría simple de arreglar: agregar el
  prefijo `⚡` también para el caso automático, igual que se hizo para `👤`.
- Ver `PROGRESS.md`, sección "Editor de grafo: selector de `handoff.mode` por edge" (2026-08-09).

### 3. `npm run check` falla en `agentRegistryService.ts:257`

- **Síntoma**: `npm run check` (`tsc --noEmit`) termina con `TS2339: Property 'catch' does not
  exist on type 'PromiseLike<string>'` en `src/services/agentRegistryService.ts:257`.
- **Impacto observado**: bloquea la verificación de tipos completa. `npm run build` sí completa
  (esbuild para la extensión y Vite para el webview), por lo que no impide generar los bundles.
- **Contexto**: el error ya existía antes de los cambios de Fase 2, Fase 7, Fase 9 y Fase 10 de
  esta ronda; se confirmó nuevamente el 2026-08-10. No se investigó ni corrigió por pedido del
  usuario de dejar los bugs para el final.
- **Próximo paso sugerido**: revisar la API tipada que devuelve `PromiseLike<string>` en ese
  método y reemplazar el uso de `.catch(...)` por una ruta compatible (por ejemplo `await` dentro
  de `try/catch`) sin alterar el manejo funcional del registro de agentes.
- Ver `PROGRESS.md`, actualización del 2026-08-10 sobre Fases 7/9/10.

### 4. El warning de preflight para un workspace sin git no aparece en EDH

- **Síntoma**: con una carpeta temporal que no es repositorio git (confirmado también por la
  vista Source Control de VS Code), al elegir `Claude CLI` y tocar `Run Workflow`, no aparece el
  modal nativo esperado de "Continue anyway". El flujo tampoco mostró el panel de objetivo en
  esa observación.
- **Qué se verificó**: se apartó y restauró reversiblemente el `.git` del workspace de prueba;
  `git -C <workspace> rev-parse --is-inside-work-tree` falló como corresponde. La misma instancia
  EDH sí mostró el blocker de CLI inexistente antes de pedir objetivo, por lo que el botón, el
  modo y la configuración de preflight estaban llegando al Extension Host. El helper puro
  `preflightCheck.ts` devuelve el warning para esa condición por lectura de código, pero el
  modal no se materializó en la UI real.
- **Próximo paso sugerido**: instrumentar temporalmente la ruta de warnings o revisar la
  interacción de `vscode.window.showWarningMessage(..., { modal: true }, ...)` con el panel de
  dashboard/EDH, y repetir ambos caminos Continue/Cancel en una sesión real antes de cambiar el
  diseño de preflight.
- Ver `PROGRESS.md`, sección "QA EDH adicional: Fases 2, 3 y 9" (2026-08-10).

## Cómo agregar un bug nuevo

Cada entrada: síntoma concreto (qué se hizo, qué se esperaba, qué pasó), qué se intentó si ya se
intentó algo, y un link a la sección de `PROGRESS.md` con el detalle completo si existe. No
duplicar el detalle largo acá — este archivo es el índice rápido de "qué falta arreglar", el
detalle de investigación vive en `PROGRESS.md`.
