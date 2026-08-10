# Checkpoint de progreso

**Leer esto antes de tocar cualquier otro archivo de esta carpeta.** Este archivo existe para
que si la sesión actual (de cualquier IA — Claude Code, Codex, u otra) se corta por falta de
tokens o de tiempo, la siguiente sesión pueda retomar exactamente donde quedó, sin tener que
releer todo el hilo de conversación original.

**Regla para quien retome este trabajo:** antes de escribir código, actualizá la tabla de abajo
y la sección "Notas de handoff" con dónde quedaste, aunque sea a mitad de una fase. No dejes
este archivo desactualizado al cortar la sesión.

## Decisión de arquitectura vigente (leer esto primero)

**2026-08-09 — pivot a motor nativo.** El plan original (v1 del usuario, luego v2 auditada)
diseñaba la integración asumiendo que el runtime real de SwarmForge (tmux + Babashka + daemon de
handoffs) corría por debajo de Agent Studio. El usuario aclaró después que el requisito real es
más general: **cualquier workflow armado en Agent Studio** —no sólo los packs de SwarmForge—
tiene que poder tener handoffs humano/IA y una terminal de VS Code por agente. Ante la pregunta
explícita de si mantener SwarmForge como runtime, motor dual, o pasar a un motor 100% nativo, el
usuario eligió **motor nativo propio**. Ver el razonamiento completo en
[`README.md`](./README.md).

**Qué implica esto para el trabajo ya hecho:** el diseño del terminal-adapter por socket Unix y
el wrapper de `PATH` sobre `swarm_handoff.sh` (fases 5+6 y 7+8 de la v2) queda **descartado como
diseño principal**, no borrado del historial — el razonamiento de por qué SwarmForge no tiene
`LICENSE`, por qué su protocolo real de handoffs no tiene gate nativo, etc. sigue siendo hallazgo
válido y reutilizable si en algún momento se retoma SwarmForge como motor opcional. Los archivos
`02-arquitectura-motor-nativo.md` y `03-arquitectura-handoff-control.md` fueron reescritos para
el diseño nuevo (motor nativo, sin tmux, sin socket externo, gating in-process).

## Estado por fase

| Fase | Descripción | Estado | Última actualización |
|---|---|---|---|
| 0 | Distribución y alcance legal | Revisada para motor nativo — riesgo legal bajó de "bloqueante de runtime" a "no copiar texto literal de role prompts de SwarmForge" | 2026-08-09 |
| 1 | Modelo de datos extendido (`WorkflowDefinition`/`Node`/`Edge`, `HandoffMode` por edge) | **Implementado** — `HandoffMode`/`WorkflowEdge.handoff` en `src/domain/models.ts`, estados `queued`/`waiting_approval` en `WorkflowRunStep` (`src/domain/messages.ts`, `webview/app/types.ts`). Sin UI todavía para setear `handoff.mode` desde el editor de grafo — sólo editando el JSON del workflow a mano | 2026-08-09 |
| 2 | Separación `uiLanguage` / `interactionLanguage` / `languageOverride` | Diseño cerrado, no implementado, sin cambios por el pivot | 2026-08-09 |
| 3 | Catálogo de templates inspirados en two/four/six-pack | Revisada — prompts propios en vez de copiar los de SwarmForge, ver `01-plan-revisado.md` | 2026-08-09 |
| 4 | `WorkflowRunManager` nativo (reemplaza el adaptador `src/services/swarmforge/*` de la v2) | **Implementado** — `src/services/workflowRun/workflowRunManager.ts`, scheduler real basado en dependencias del grafo (no DFS lineal), compila y buildea limpio, todavía no probado en la práctica | 2026-08-09 |
| 5 | N terminales de VS Code por workflow + detección de fin de turno | **Cerrado (detección de fin de turno) e implementado (N terminales)**. Detección de fin de turno validada de punta a punta contra `claude`/`codex` reales. N terminales en paralelo (`WorkflowTerminalService`, un `vscode.Terminal` por nodo) implementado en `workflowRunManager.ts`, sin probar todavía en la práctica | 2026-08-09 |
| 6 | Handoff control: Human-in-the-Loop + IA como nodo del grafo (`HandoffMode` = sólo `automatic`/`human`) | **Implementado** — `workflowRunManager.ts` pausa el nodo en `waiting_approval` y muestra `vscode.window.showWarningMessage` modal (Approve/Reject) cuando el edge entrante tiene `handoff.mode: "human"`; automático si no. Sin probar todavía en la práctica (no hay UI para setear `human` desde el editor, hay que editar el JSON) | 2026-08-09 |
| 7 | Estado y recuperación (persistencia de un run, reconexión al reabrir VS Code) | Sin revisar en detalle todavía | No iniciado |
| 8 | Panel de ejecución y estados visuales del grafo (`queued`/`running` animado/`completed`) | Diseño técnico concreto listo (`04-panel-ejecucion.md`), anclado a `GraphCanvas.tsx`/`styles.css` reales, no implementado | 2026-08-09 |
| 9 | Preflight de seguridad | Parcialmente cubierto por `05-riesgos.md` | No iniciado |
| 10 | Plan de pruebas | Sin revisar en detalle todavía | No iniciado |

(La numeración de fases se comprimió de 0-12 a 0-10 al fusionar lo que antes eran fases separadas
"5+6" y "7+8" de la integración con SwarmForge en fases únicas del motor nativo — ver
`01-plan-revisado.md` para el detalle fase por fase actualizado.)

## Qué se hizo en esta sesión (2026-08-09)

Sesión 1 (integración vía runtime de SwarmForge, luego descartada como camino principal):
1. Se clonó `swarm-forge` localmente y se leyó el código real — confirmado sin `LICENSE`, basado
   en Babashka/Clojure + zsh, packs como ramas git, terminal adapters ya existentes, protocolo de
   handoff real sin gate nativo, sin modo headless.
2. Se leyó el código real de Agent Studio (`src/domain/models.ts`, `runWorkflow` en
   `src/extension.ts`, `webview/app/i18n.tsx`) para confirmar el estado actual.
3. Se corrió un subagente `Software Architect` para auditar el plan original — informe completo
   en el vault: `obsidian-ai-memory-vault/memory/sessions/2026-08-09-...-audit.md`.
4. Se escribió un plan v2 completo asumiendo SwarmForge como runtime externo (socket Unix +
   wrapper de PATH).

Sesión 2 (pivot a motor nativo):
5. El usuario aclaró que el requisito es general (cualquier workflow, no sólo packs de
   SwarmForge) y, ante la pregunta explícita, eligió motor nativo propio en vez de depender del
   runtime de SwarmForge.
6. Se reescribió `README.md`, `01-plan-revisado.md`, `02-arquitectura-motor-nativo.md` (antes
   `02-arquitectura-terminal-adapter.md`), `03-arquitectura-handoff-control.md` y `04-riesgos.md`
   para el diseño de motor nativo.

Sesión 3 (estados visuales de ejecución):
7. El usuario confirmó la dirección de la Fase 5 (fix de `runWorkflow` para marcar "completed" al
   terminar de verdad) y pidió estados visuales concretos en el grafo: agente corriendo con
   movimiento, color de finalización, color de "próximo en ejecución".
8. Se revisó el código real de `webview/app/components/GraphCanvas.tsx` y `styles.css` — se
   confirmó que el panel lateral `graph-run-panel` ya tiene puntos de color por estado pero sin
   estado "próximo" ni animación, y que los nodos del grafo (`.graph-node`) hoy **no tienen
   ningún color de estado de ejecución**.
9. Se creó `04-panel-ejecucion.md` (nuevo) con el estado `queued` agregado a `WorkflowRunStep.status`,
   el mapeo completo de color (tokens `--vscode-charts-*`), el CSS del pulso animado para
   `running` con soporte de `prefers-reduced-motion`, y cómo se calcula `queued` en
   `WorkflowRunManager`. `04-riesgos.md` se renumeró a `05-riesgos.md` para hacer lugar.

Sesión 4 (verificación de cierre antes de implementar):
10. Se corrió un subagente `Software Architect` para una revisión go/no-go de los 7 documentos
    contra el código real, buscando específicamente inconsistencias introducidas por las
    múltiples rondas de edición cruzada (numeración, referencias, enums duplicados entre
    archivos). **Veredicto: LISTO CON CORRECCIONES MENORES.** Confirmó línea por línea las citas
    de código del plan (`runWorkflow` en línea 607, `step.status = "completed"` en línea 777,
    etc.) y que la numeración/referencias cruzadas cierran sin errores.
11. Encontró un riesgo real no documentado: el diseño de invocación one-shot de Fase 5 no
    contemplaba que el prompt (texto libre, puede incluir comillas/backticks/`$()`, y en
    `ai-review` viene de la salida de otro agente, no controlada por el usuario) se use para
    armar un `commandLine` de shell sin escapar — riesgo de inyección. Corregido: agregado a
    `02-arquitectura-motor-nativo.md` (sección nueva "Riesgo de escaping/inyección") y a
    `05-riesgos.md` (fila nueva). También se renombró
    `_archive-motor-swarmforge-descartado/03-arquitectura-handoff-control.md` a
    `...OLD.md` para no tener dos archivos con el mismo nombre en la carpeta (hallazgo menor,
    cosmético).

Sesión 5 (simplificación de Fase 6, cierre del riesgo de inyección de raíz):
12. El usuario propuso resolver el hallazgo de inyección simplificando el modelo en vez de sólo
    mitigarlo técnicamente: `HandoffMode` pasa a tener sólo `automatic` y `human` — se elimina el
    modo de edge `ai-review`/`human-or-ai`. "IA en el loop" deja de ser un mecanismo de runtime
    que el motor intercepta (parseando una decisión JSON de un agente y ramificando
    automáticamente) y pasa a modelarse como **un nodo más del grafo**, elegido por el usuario,
    con sus propios edges de salida (`automatic` o `human`).
13. Esto cierra de raíz el riesgo más grave que quedaba abierto (el motor confiando en una
    estructura de decisión generada por un agente para automatizar ramificación), no sólo lo
    mitiga. El riesgo general de escaping en la invocación one-shot (Fase 5) sigue vigente para
    *cualquier* handoff, no era específico de `ai-review` — se reencuadró en
    `02-arquitectura-motor-nativo.md` y `05-riesgos.md`, con una mitigación técnica concreta: usar
    el overload `executeCommand(executable, args[])` de la API de Terminal Shell Integration en
    vez de armar un `commandLine` string a mano (a confirmar que existe/funciona así en el
    prototipo de Fase 5).
14. Se actualizaron `01-plan-revisado.md` (Fase 1, 6, 8), `03-arquitectura-handoff-control.md`
    (reescrito completo), `02-arquitectura-motor-nativo.md`, `04-panel-ejecucion.md` (se eliminó
    el estado `waiting_ai_review`) y `05-riesgos.md`.

Sesión 6 (primer código de producción — prototipo de Fase 5):
15. Antes de codear, se leyó `node_modules/@types/vscode/index.d.ts` directamente (no asumido) y
    se encontró que el doc-comment del propio overload `executeCommand(executable, args[])` dice
    explícitamente que su escaping **"no está pensado como medida de seguridad"** y que `$(...)`
    puede seguir ejecutando código — esto invalidaba la mitigación que se había propuesto en la
    Sesión 5. Se corrigió `02-arquitectura-motor-nativo.md` y `05-riesgos.md`: la mitigación real
    es no pasar nunca el prompt como argumento de shell — escribirlo a un archivo en
    `.agent-studio/runs/<run-id>/` e invocar al backend con una ruta (string controlado por Agent
    Studio, no por el agente) o por stdin; si ningún backend lo soporta, usar
    `child_process.spawn(..., { shell: false })` sin shell de por medio.
16. **Primer código de producción de todo este plan:** `src/services/workflowRun/shellIntegrationPrototype.ts`
    (nuevo), registrado como comando de desarrollo `agentStudio.debugShellIntegrationPrototype`
    ("Agent Studio: [Dev] Shell Integration Prototype (Fase 5)" en la Command Palette) vía
    `src/commands/registerCommands.ts`, `src/extension.ts` y `package.json`. El comando ofrece 3
    tests manuales, corridos dentro del Extension Development Host (F5):
    - **Test 1 — confiabilidad:** confirma que `onDidChangeTerminalShellIntegration` /
      `onDidEndTerminalShellExecution` entregan un exit code real para un comando one-shot simple.
    - **Test 2 — prueba empírica de inyección:** corre el mismo payload adversarial
      (`$(touch <marcador>)`) por 3 vías (`commandLine` string, `executeCommand(exe, args[])`,
      archivo con sólo una ruta interpolada) y confirma cuál(es) ejecutan el `$(...)` de verdad,
      chequeando si el archivo marcador se creó — no es una afirmación teórica, es una prueba que
      se puede correr y ver el resultado.
    - **Test 3 — CLI real:** invoca `claude`/`codex` (u otro) en modo one-shot con un prompt de
      prueba configurable, reporta exit code y duración.
    `npm run check` y `npm run build:extension` pasan limpios (el único error de `tsc` es
    preexistente en `agentRegistryService.ts`, no tocado por este cambio — confirmado corriendo
    `tsc --noEmit` también con los cambios stasheados). `npm run lint` falla por una
    incompatibilidad preexistente de ESLint 9 vs `.eslintrc.cjs` del repo, no relacionada con este
    cambio — no se tocó, está fuera de alcance.

## Cómo correr el prototipo (para la próxima sesión, humana o de otra IA)

1. Abrir este repo en VS Code y presionar F5 (o "Run Extension" en el panel de Run and Debug) —
   esto abre un Extension Development Host con la extensión cargada.
2. En esa segunda ventana, abrir cualquier carpeta como workspace (el prototipo necesita un
   workspace folder para escribir archivos de prueba en `.agent-studio/prototype/`).
3. Command Palette → "Agent Studio: [Dev] Shell Integration Prototype (Fase 5)".
4. Correr primero el Test 2 (inyección) — es el que más condiciona el resto del diseño. Si alguna
   variante da "VULNERABLE", hay que ajustar el diseño de `02-arquitectura-motor-nativo.md` antes
   de seguir. Si sólo la variante C (archivo) da "seguro", eso confirma la mitigación ya
   documentada.
5. Después correr el Test 1 (confiabilidad) y, si hay un CLI de `claude`/`codex` instalado, el
   Test 3, para confirmar el flag real de modo one-shot (pendiente de la Fase 5, punto 1 de "Qué
   falta validar" en `02-arquitectura-motor-nativo.md`).
6. Documentar el resultado acá mismo (reemplazar este bloque por lo que se haya encontrado) antes
   de avanzar a construir `WorkflowRunManager` (Fase 4) sobre este supuesto.

## Resultado real del Test 2 (prueba de inyección) — CONFIRMADO 2026-08-09

El usuario corrió el Test 2 (F5, Extension Development Host, workspace `agents-fleet`, shell
zsh). Resultado, leído directo de las 3 terminales y del árbol de archivos resultante en
`.agent-studio/prototype/`:

| Variante | Resultado | Evidencia |
|---|---|---|
| A) `commandLine` string | **VULNERABLE** | `zsh: command not found: backtick` (el backtick del payload se interpretó como comando) + se creó `injection-proof-...-A.txt` (el `$(touch ...)` corrió de verdad) |
| B) `executeCommand(executable, args[])` | **VULNERABLE** | mismo error, se creó `injection-proof-...-B.txt` — confirma empíricamente el doc-comment de VS Code ("this escaping is not intended to be a security measure") |
| C) archivo (sólo se interpola una ruta) | **segura** | `cat` imprimió el payload tal cual como texto; no se creó ningún `injection-proof-...-C.txt` |

**Conclusión validada, no sólo argumentada:** la mitigación correcta para Fase 5 es la que ya
está documentada en `02-arquitectura-motor-nativo.md` — nunca pasar el prompt como argumento de
shell (ni `commandLine` ni `args[]`), sólo como contenido de un archivo cuya ruta arma Agent
Studio. Esto cierra el punto más importante de "Qué falta validar" de esa fase.

Detalle de UX corregido en el código: `terminal.show()` (llamado una vez por variante) le saca el
foco al panel "Output", así que el bloque `=== Resumen ===` queda escrito pero no visible sin
cambiar de pestaña manualmente — se agregó `output.show(true)` después de correr los tests en
`testReliability`/`testInjection`/`testRealCli` para que esto no vuelva a pasar.

## Resultado real del Test 1 y Test 3 — CONFIRMADO 2026-08-09

**Test 1 (confiabilidad):** `exitCode=0 en 4642ms` contra `echo` — Shell Integration entrega la
señal real de forma confiable para una invocación corta.

**Test 3 (CLI real), dos hallazgos:**

| CLI | Comando | Resultado |
|---|---|---|
| `claude` | `claude -p <prompt con comillas/backticks>` | `exitCode=0` en 10724ms, pero Claude respondió "No veo ninguna pregunta... solo dice 'Responde'" — **al agente sólo le llegó la primera palabra del prompt** |
| `codex` | `codex -p <mismo prompt>` | `exitCode=2` en 4957ms, `error: unrecognized subcommand 'Caracteres'` — **el parser de argumentos de codex se rompió** |

En ambos casos zsh reportó `command not found: backtick` antes de ejecutar el CLI — el mismo
mecanismo que ya había roto la Variante B del Test 2. Confirmado con backends reales: el problema
de `args[]` no es sólo de seguridad, es de **correctitud básica** — en cuanto el prompt tiene
comillas o backticks (algo común en cualquier prompt real con código o mensajes de error), VS
Code no lo empaqueta como un argumento seguro (tal como advierte su propio doc-comment) y el
shell lo parte en palabras sueltas, así que el agente nunca recibe el prompt completo. Esto se
agregó a `02-arquitectura-motor-nativo.md`: la mitigación de archivo pasa a ser un requisito de
correctitud, no sólo de seguridad.

**Qué sigue sin confirmarse:** si `-p` es el flag correcto de `codex` en modo no interactivo (el
fallo pudo ser sólo por el prompt roto, no por el flag en sí — hace falta repetir la prueba con
el prompt bien formado, pasado por archivo) y el comportamiento de Shell Integration en un turno
de varios minutos (sólo se probó hasta ~11s).

## `runWorkflow` cambiado — CONFIRMADO 2026-08-09

Se implementó el cambio: `runWorkflow` en `src/extension.ts` (modo `cli-claude`/`cli-codex`) ya
no tipea el prompt en una REPL persistente y marca "completed" al instante. Ahora, por cada paso:

1. Escribe el prompt completo (sin aplanar) a un archivo en
   `.agent-studio/runs/<workflowId>-<timestamp>/step-<index>-prompt.txt` — nueva función
   `runAgentTurn()` en `src/services/workflowRun/oneShotTurnRunner.ts`.
2. Corre `<cliCommand> -p < "<ruta del archivo>"` como invocación one-shot real vía
   `terminal.shellIntegration.executeCommand(commandLine)` — el único string interpolado es la
   ruta del archivo (controlada por Agent Studio), nunca el contenido del prompt, siguiendo la
   mitigación validada empíricamente en la sesión anterior.
3. Espera el evento real de `onDidEndTerminalShellExecution` (con timeout de 10 minutos) y recién
   ahí marca el paso `"completed"` (si `exitCode === 0`) o `"failed"` (si no, con el exit code o
   "no reportó a tiempo" en el mensaje), siguiendo el mismo patrón de "marcar siguientes pasos
   como skipped" que ya usaba el bloque de manejo de errores existente.

Se removieron: el bootstrapping de una REPL persistente (`cliTerminal.sendText(cliCommand, true)`
+ espera fija de 1.5s) y el `setTimeout` fijo de 500ms entre pasos — ya no hacen falta, la espera
real reemplaza a ambos. Se borró `ChatBridgeService.sendAgentToTerminal()` (quedó sin uso, se
confirmó con `grep` antes de borrarla). Se creó `src/services/workflowRun/shellIntegrationUtil.ts`
con los helpers `waitForShellIntegration`/`waitForExecutionEnd` compartidos entre el runner real y
el prototipo de diagnóstico (antes estaban duplicados).

`npm run check` y `npm run build:extension` pasan limpios (mismo único error preexistente de
`agentRegistryService.ts`, no tocado).

## Primera prueba real (2026-08-09) — encontró dos huecos, ya corregidos

El usuario corrió el cambio contra un workflow real de 5 pasos (`agents-fleet`, workflow
"changes-config": Functional Analyst → Technical Lead → Developer → ... → QA Engineer). Resultado
positivo en lo que se buscaba probar: **el paso quedó "running" hasta que `claude` terminaba de
verdad, y recién ahí pasó a "completed"** — confirmado por el usuario ("el flow que probé esperaba
que un agente terminara para comenzar el siguiente" / "el run status fue cambiando de color y
diciendo completed y running"). Pero encontró dos huecos reales, ambos ya corregidos en el código:

1. **Cada agente respondía "no veo ninguna tarea"** — el prompt de cada turno sólo tenía la
   definición estática del agente (`buildPrompt`), sin ningún objetivo ni conexión con lo que
   hizo el paso anterior. Arreglado: `runWorkflow` ahora pide el objetivo del run con un
   `showInputBox` antes de arrancar (sólo en modo CLI; si se cancela, el run se aborta con
   `dashboard.postInfo("Workflow run cancelled.")`), y `ChatBridgeService.buildTurnPrompt()`
   (nuevo) arma el prompt de cada paso como: definición del agente + objetivo del run + output
   del paso anterior (si hay). El output de cada turno ahora se captura redirigiendo el stdout
   del CLI a un archivo (`step-<i>-output.txt`, junto al `step-<i>-prompt.txt`) en vez de leer el
   stream crudo de la terminal — evita tener que lidiar con secuencias de escape ANSI.
2. **`codex -p` no es "prompt", es `--profile`** — el CLI real de codex tiró
   `error: a value is required for '--profile <CONFIG_PROFILE_V2>' but none was supplied`.
   Arreglado: `oneShotTurnRunner.ts` ahora usa un mapeo por ejecutable
   (`claude -p` / `codex exec`) en vez de asumir `-p` para los dos.

También se confirmó, sin sorpresas: el grafo (`.graph-node`) no cambió de color durante el run —
esperado, es la Fase 8 (paneles/estados visuales), diseñada pero no implementada todavía. El
panel lateral de Run status sí cambió de color correctamente (pending → running → completed),
confirmado por el usuario.

## Segunda prueba real (2026-08-09) — objetivo/encadenado y `codex exec` confirmados

El usuario repitió el mismo workflow de 5 pasos con los dos fixes ya aplicados:

- **Claude CLI**: confirmado que el objetivo se incorpora al prompt y que el encadenado funciona
  de verdad — el output del paso 1 (Technical Lead) dice literalmente "El README confirma lo que
  ya había reportado el agente anterior... valido y entrego la respuesta final", mostrando que
  recibió y usó el output real del paso 0 (Functional Analyst). Colores y estados del panel
  cambiaron correctamente en todo el run.
- **Codex CLI**: primera corrida se hizo sin cambiar el selector de la corrida anterior (quedó en
  "Claude CLI"), detectado porque el log mostraba `claude -p`, no `codex exec` — no era un bug,
  el `<select>` de la UI mantiene el último valor elegido. Repetida seleccionando "Codex CLI"
  explícitamente: los 5 pasos corrieron con `codex exec < ... > ... 2>&1` **sin ningún error de
  flag**, confirmando que `codex exec` es la invocación correcta. Contenido de las respuestas
  pendiente de que el usuario confirme que son coherentes (no sólo que no hay error de shell).

Con esto, el punto 1 de "Qué falta validar" en `02-arquitectura-motor-nativo.md` queda cerrado
para los dos backends soportados hoy.

## Tercer hallazgo real: el stdout de `codex exec` no es sólo la respuesta — arreglado con `-o`

El usuario revisó el contenido de `step-0-output.txt` de la corrida de Codex y encontró que
Codex **sí** había respondido en 3 líneas como se le pidió, pero ese texto quedaba enterrado
dentro de: un banner de arranque (versión, modelo, sandbox, session id), el prompt completo
ecoado de vuelta, y una traza completa de herramientas — Codex ejecutó comandos de shell reales
(`rg --files`, lectura del vault de memoria, del README) para investigar el repo antes de
responder. Ese blob completo es justo lo que se estaba encadenando como "output del paso
anterior" al siguiente agente — no la respuesta real.

Se corrió `codex exec --help` (evidencia real, no otra adivinanza) y apareció el flag
correcto para esto: `-o, --output-last-message <FILE>` — "Specifies file where the last message
from the agent should be written". Se agregó a `oneShotTurnRunner.ts`: ahora `codex exec` corre
con `-o "<runDir>/step-N-final.txt"` además de la redirección de stdout completa a
`step-N-output.txt` (que se sigue guardando para debug/transparencia), y el campo `output` que se
encadena al siguiente paso usa el contenido de `step-N-final.txt` (con fallback al stdout crudo
si por algún motivo viniera vacío). `claude -p` no tiene un flag equivalente cableado porque su
stdout ya se veía limpio en las pruebas — se sigue usando tal cual.

**Confirmado por el usuario (2026-08-09)** contra
`/home/eric44/Github/agents-fleet/.agent-studio/runs/changes-config-1786312984979/` — el fix
funciona: `step-N-final.txt` queda con la respuesta limpia y es lo que se encadena al siguiente
paso. Con esto, la Fase 5 (detección de fin de turno) queda **cerrada de punta a punta** para
`claude` y `codex`: inyección resuelta, objetivo/encadenado funcionando, output limpio para
encadenar, y ambos flags de invocación confirmados contra corridas reales.

### Cómo probar este cambio

1. F5 en `agent-studio` → Extension Development Host, con un workspace que tenga al menos un
   agente y un workflow de un solo paso (para la primera prueba, cuanto más simple mejor).
2. Abrir el dashboard de Agent Studio, elegir ese workflow, modo **"Claude CLI"** o **"Codex CLI"**.
3. Va a aparecer un cuadro de texto arriba pidiendo el objetivo del run — escribir algo concreto
   (ej. "Explicá qué hace este repo en 3 líneas") y Enter.
4. La terminal debería mostrar el comando one-shot real con redirección de entrada y salida
   (`claude -p < ".../step-0-prompt.txt" > ".../step-0-output.txt" 2>&1`, o para Codex
   `codex exec -o ".../step-0-final.txt" < ... > ".../step-0-output.txt" 2>&1`), no un CLI
   interactivo esperando input.
5. En el panel de "Run status" del grafo, el paso debería quedar en **"running"** mientras el CLI
   está pensando/respondiendo, y recién pasar a **"completed"** cuando termina de verdad.
6. Revisar en el workspace `.agent-studio/runs/<workflowId>-<timestamp>/`: `step-0-prompt.txt`
   debe tener la definición del agente + el objetivo que escribiste; `step-0-output.txt` debe
   tener la respuesta real del CLI (texto plano, sin códigos de escape). Si hay más de un paso,
   `step-1-prompt.txt` debería incluir el output de `step-0` como contexto.
7. ~~Con Codex específicamente: confirmar si `codex exec` corre en modo no interactivo~~ —
   **confirmado 2026-08-09**, ver "Segunda prueba real" arriba.
8. **Nuevo, sin probar todavía:** con Codex, revisar `step-0-final.txt` — debería tener sólo la
   respuesta final (sin banner, sin prompt ecoado, sin traza de herramientas), y ese debería ser
   el texto que aparece como "output del paso anterior" en `step-1-prompt.txt`, no el contenido
   completo de `step-0-output.txt`.

## N terminales en paralelo + gating humano — implementado y parcialmente confirmado (2026-08-09)

Con Fase 5 (detección de fin de turno) cerrada, se construyó lo que originalmente pidió el
usuario y todavía no existía: cada agente del workflow corre en su propia terminal integrada, en
paralelo cuando el grafo lo permite, en vez de secuencialmente en una sola terminal compartida.

- `src/domain/models.ts`: `HandoffMode = "automatic" | "human"` y `WorkflowEdge.handoff?.mode`.
  Sin `handoff` en un edge, se comporta como `"automatic"` (retrocompatible con workflows
  existentes). Deliberadamente no hay `"ai-review"` — un revisor de IA se modela como un nodo más
  del grafo, no como un modo especial de edge (ver `03-arquitectura-handoff-control.md`).
- `src/domain/messages.ts` / `webview/app/types.ts`: `WorkflowRunStep.status` suma `"queued"` y
  `"waiting_approval"`.
- `src/services/workflowRun/workflowTerminalService.ts` (nuevo): `Map<nodeId, vscode.Terminal>`
  — una terminal por nodo, reusada entre turnos de ese nodo dentro del mismo run.
- `src/services/workflowRun/workflowRunManager.ts` (nuevo, reemplaza el loop secuencial de
  `runWorkflow` para modo CLI): scheduler real basado en el grafo de dependencias, no en el orden
  DFS de antes. Un nodo se dispara apenas **todos** sus predecesores (dentro del subgrafo
  alcanzable) están `"completed"` — nodos sin dependencia entre sí corren en paralelo, cada uno en
  su propia terminal vía `runAgentTurn` (el runner de Fase 5, sin cambios). Si un nodo falla, sus
  sucesores que dependen únicamente de él pasan a `"skipped"` (cálculo de punto fijo simple, no
  maneja todos los casos de un DAG arbitrario con fan-in complejo, alcanza para los workflows
  lineales/con ramas simples que existen hoy).
- `src/extension.ts`: `runWorkflow` ahora bifurca temprano — si el modo es CLI, delega
  íntegramente a `runWorkflowGraph` (nuevo); si es chat/plan, sigue con la lógica secuencial de
  siempre (sin cambios de fondo, sólo se le sacó la rama CLI que ya no le pertenece).

**Confirmado por el usuario, primera corrida real:** el paralelismo funciona — un workflow con dos
edges automáticos saliendo del mismo nodo (`tdd-guide → software-architect` y `tdd-guide → entry`)
disparó ambos destinos a la vez, cada uno en su propia terminal, terminando en momentos distintos.
El gating humano también disparó (apareció el diálogo de aprobación en el edge marcado
`"human"`), pero el primer diseño usaba `vscode.window.showWarningMessage` modal — el usuario
reportó que **no veía todo el contexto** (recortado a 500 caracteres) y no había forma de agregar
instrucciones antes de aprobar, sólo Approve/Reject a ciegas.

## Panel de aprobación real (reemplaza el modal nativo) — implementado, sin probar (2026-08-09)

Se reemplazó el modal nativo por un panel propio dentro del dashboard de Agent Studio:

- `src/services/workflowRun/workflowRunManager.ts`: `requestApproval` pasa a ser un callback
  inyectado (`ApprovalRequestInput → Promise<ApprovalDecision>`) en vez de llamar directo a
  `vscode.window.showWarningMessage`. Si se aprueba con instrucciones, se agregan al prompt del
  siguiente turno como un bloque `[Instrucciones del usuario al aprobar este handoff]`.
- `src/domain/messages.ts` / `webview/app/types.ts`: mensajes nuevos `approvalRequest`
  (extensión → webview, con `requestId`, `nodeId`, `agentName`, `context` completo sin recortar) y
  `approvalResponse` (webview → extensión, con `decision` e `instructions` opcionales).
- `src/extension.ts`: `pendingApprovals: Map<requestId, resolve>` — al pedir aprobación, genera un
  `requestId`, guarda el `resolve` de la promesa, y postea `approvalRequest` al webview; al llegar
  `approvalResponse` (`onApprovalResponse`), resuelve la promesa correspondiente y el scheduler
  continúa.
- `src/views/dashboardPanel.ts`: wiring de `onApprovalResponse` y `postApprovalRequest`, mismo
  patrón que el resto de los mensajes.
- `webview/app/store/useStudioStore.ts`: `pendingApprovals: WorkflowApprovalRequest[]`, con
  `addApprovalRequest`/`removeApprovalRequest`.
- `webview/app/components/ApprovalPanel.tsx` (nuevo): overlay a pantalla completa con una tarjeta
  por aprobación pendiente — contexto completo en un bloque con scroll (`<pre>`, sin recortar),
  un `<textarea>` opcional para instrucciones, y botones Approve/Reject. Se monta en
  `DashboardPage.tsx`.
- `webview/app/styles.css`: estilos nuevos (`.approval-overlay`, `.approval-card*`) usando los
  mismos tokens de tema que el resto de la UI.

`npm run check`, `build:extension` y `build:webview` verificados limpios (y se detectó y corrigió
un bloque `@media` vacío que quedó mal armado en un edit anterior del CSS — verificado el balance
de llaves de todo el archivo: 372/372).

**Todavía no se probó el panel nuevo en la práctica** — hay que repetir la corrida con el mismo
edge `"human"` y confirmar que aparece la tarjeta con el contexto completo (no recortado) y que
Approve/Reject/instrucciones funcionan.

`npm run check` (limpio, mismo error preexistente de siempre) y `npm run build:extension` +
`npm run build:webview` (ambos limpios) verificados. **Nada de esto se corrió todavía en la
práctica** — es la pieza más grande de código nueva de todo este plan hasta ahora.

### Limitación conocida: no hay UI para configurar `handoff.mode` todavía

El editor de grafo (`GraphCanvas.tsx`) no tiene ningún control específico de handoff (todavía no
hay un selector "automatic/human" por edge) — eso sigue pendiente (edge inspector). Pero al probar
esto el usuario encontró que **tampoco había forma de abrir el JSON del workflow ni de
renombrarlo** desde la UI — sólo existía para agentes (`openRawAgent`). Se agregó, siguiendo el
mismo patrón que ya existía para agentes:

- Mensajes nuevos `renameWorkflow`/`openRawWorkflow` en `src/domain/messages.ts`.
- Handlers `onRenameWorkflow`/`onOpenRawWorkflow` en `src/views/dashboardPanel.ts` y su
  implementación en `src/extension.ts` (`onRenameWorkflow` pide el nombre nuevo con
  `showInputBox` y llama a `workflowService.saveWorkflow`; `onOpenRawWorkflow` abre
  `workflow.sourcePath` como documento de texto — si el workflow todavía no se guardó nunca,
  `sourcePath` no existe y se avisa "guardá primero").
- Botones **"Rename"** y **"Edit JSON"** nuevos en el toolbar de `GraphCanvas.tsx`, junto a "Save
  Workflow"/"Delete".

Con "Edit JSON" ya se puede llegar al archivo real del workflow y agregar
`"handoff": {"mode": "human"}` a mano a un edge para probar el gating humano, sin tener que andar
buscando el archivo por fuera de VS Code. `npm run check`, `build:extension` y `build:webview`
verificados limpios.

### Cómo probar esto

1. F5 en `agent-studio` → Extension Development Host, workspace con un workflow de **al menos 2
   pasos** (idealmente 3+, con alguna rama, para ver paralelismo real — si el workflow es
   puramente lineal vas a ver terminales apareciendo una por vez igual, pero cada una en su
   propia ventana, no una compartida).
2. Correr en modo CLI, con un objetivo simple. Confirmar que se abre **una terminal por agente**
   (no una sola reusada), cada una nombrada `Agent Studio: <workflow> · <agente> (<cli>)`.
3. Si el workflow tiene dos nodos sin dependencia entre sí (dos edges saliendo del mismo
   predecesor hacia nodos distintos), confirmar que ambas terminales arrancan **a la vez**, no
   una después de la otra.
4. Para probar el gating humano: usá los botones "Rename"/"Edit JSON" para llegar al JSON del
   workflow y agregarle `"handoff": {"mode": "human"}` a un edge, guardar, volver a correr. Al
   llegar a ese edge debería aparecer el **panel de aprobación** (overlay a pantalla completa
   sobre el dashboard de Agent Studio, no un diálogo nativo de VS Code) con: el nombre del agente
   destino, el output completo del paso anterior en un bloque con scroll (sin recortar), una caja
   de texto opcional para instrucciones, y botones Approve/Reject. El nodo destino no debería
   arrancar su terminal hasta aprobar. Probar también "Reject" y confirmar que el run se marca
   `"failed"` con el mensaje correspondiente, sin que los nodos ya en curso (si hay otras ramas)
   se corten a mitad de turno. Probar "Approve" con algo escrito en instrucciones y confirmar que
   aparece en el `step-N-prompt.txt` del siguiente nodo, dentro de un bloque
   `[Instrucciones del usuario al aprobar este handoff]`.
5. Revisar el panel "Run status": debería verse `queued` (naranja) brevemente antes de `running`
   en nodos que arrancan, y `waiting_approval` (amarillo) en el que está pausado.

## Dos bugs de UI en "Run status" + hallazgo grave de permisos (2026-08-09)

El usuario probó el panel de aprobación y reportó tres cosas en la misma sesión:

**Bug 1 — "Run status" no mostraba todos los nodos antes de correr.** Confirmado en
`GraphCanvas.tsx`: la lista de preview (antes de la primera corrida) tenía un `.slice(0, 3)`
hardcodeado — sólo mostraba los primeros 3 nodos del grafo. Corregido: se saca el límite.

**Bug 2 — agregar/editar un subagente y guardar no actualizaba "Run status".** Confirmado:
cuando ya existía una corrida previa para ese workflow (`selectedWorkflowRun`), el código
devolvía `selectedWorkflowRun.steps` tal cual, sin importar si el workflow actual tenía nodos
nuevos que esa corrida vieja nunca vio. Corregido: ahora siempre se parte de los nodos **actuales**
del workflow, y se les pega el estado de la última corrida por `nodeId` si existe (si no,
`"pending"`) — un nodo nuevo aparece de inmediato, no hay que volver a correr para verlo.

Ambos fixes en `webview/app/components/GraphCanvas.tsx` (`orderedRunSteps`). `npm run check` y
`build:webview` verificados limpios.

**Hallazgo grave — ningún backend podía escribir archivos.** El usuario pidió "ejecutá el plan
que creaste antes" y el workflow no tocó el repo. Se leyeron los archivos reales de las dos
corridas (`/home/eric44/Github/agents-fleet/.agent-studio/runs/new-workflow-1786316823219` y
`.../new-workflow-1786317099284`) en vez de asumir — `step-entry-output.txt` de la segunda
corrida decía literalmente: *"El diálogo de permisos para Write debería haber aparecido en tu
cliente. ¿Podés aprobarlo...?"*. Diagnóstico confirmado: Claude bloquea en una aprobación
interactiva de `Write`/`Edit`/`Bash` no trivial que nunca puede responderse en una invocación
one-shot sin TTY; Codex corre con `sandbox: read-only` de fábrica (confirmado en su propio banner
de arranque, visto en una sesión anterior). Ninguno de los dos podía modificar nada, sólo generar
texto — los "archivos txt" que el usuario vio eran nuestros propios `step-N-*.txt` de bookkeeping,
no algo que el agente hubiera creado a propósito.

Se le presentó al usuario la decisión explícitamente (no se tomó en silencio, es sacarle una
barrera de seguridad real a un agente desatendido): bypass total
(`--dangerously-skip-permissions` / `--dangerously-bypass-approvals-and-sandbox`, marcados
"EXTREMELY DANGEROUS" en los propios `--help`) vs. algo acotado. **Eligió lo acotado.**
Implementado en `src/services/workflowRun/oneShotTurnRunner.ts`, confirmado contra `claude --help`
y `codex exec --help` reales (no adivinado):

- `claude -p --permission-mode acceptEdits` — auto-acepta sólo Write/Edit de archivos; un comando
  Bash riesgoso sigue bloqueado exactamente igual que antes (trade-off intencional, no un bug).
- `codex exec --sandbox workspace-write` — escritura permitida sólo dentro del workspace, no
  `danger-full-access`.

`npm run check` y `build:extension` verificados limpios. **Todavía no se probó en la práctica** —
falta repetir el pedido de "ejecutá el plan" y confirmar que ahora sí toca archivos reales del
repo (y que un comando Bash más riesgoso, si aparece, sigue pidiendo aprobación como antes).

## Pivot a sesiones interactivas por nodo (reemplaza el one-shot) — implementado, sin probar (2026-08-09)

El usuario, después de confirmar que el modo one-shot ya funcionaba, pidió volver a algo más
parecido a SwarmForge: cada terminal de CLI corriendo **interactiva**, no one-shot, para poder
darle feedback a un agente a mitad de tarea si hace falta.

- `src/services/workflowRun/interactiveTurnRunner.ts` (nuevo, reemplaza a `oneShotTurnRunner.ts`
  en el flujo real): lanza el CLI en modo interactivo una vez por nodo (`claude
  --permission-mode acceptEdits`, sin `-p`; `codex --sandbox workspace-write`, sin `exec` — **esto
  último no está confirmado contra `codex --help`, sólo se confirmó `codex exec --help` en una
  sesión anterior**, hay que verificarlo), tipea el prompt como texto literal vía
  `terminal.sendText` (no arma ningún comando de shell — esto además cierra de raíz la clase de
  riesgo de inyección de Fase 5, ya no aplica: no hay `commandLine` que interpolar), con una
  instrucción agregada pidiéndole al agente que escriba su respuesta final en un archivo marcador
  cuando termine. La detección de fin de turno pasa a ser polling de ese archivo (cada 2s, timeout
  de 10 min) en vez de un exit code real — es la misma filosofía que usa SwarmForge (el agente
  avisa que terminó, la infraestructura no lo detecta por sí sola).
- `src/services/workflowRun/workflowRunManager.ts`: sólo cambió el import (`runAgentTurn` ahora
  viene de `interactiveTurnRunner.ts`) y los mensajes de estado (ya no tiene sentido hablar de
  "exit code" cuando no hay uno real).
- `oneShotTurnRunner.ts` **se mantiene intacto, sin usarse** en el flujo principal — sigue siendo
  trabajo válido y documentado (Fase 5) por si en algún momento se quiere un modo totalmente
  desatendido sin posibilidad de feedback (ej. corridas programadas/CI). No se borró.
- La terminal de cada nodo queda **viva** después de que Agent Studio detecta el marcador — el
  usuario puede seguir escribiéndole directamente a esa sesión si quiere seguir la conversación,
  igual que con una sesión de SwarmForge.

`npm run check` y `build:extension` verificados limpios. **Todavía no se corrió en la práctica.**
Cosas concretas por confirmar:
- Si `codex` (sin `exec`) realmente abre modo interactivo, y si `--sandbox workspace-write` es
  válido en ese modo (sólo se confirmó para `codex exec`).
- Si el delay fijo de 1.5s alcanza siempre para que el CLI termine de arrancar antes de tipearle
  el prompt (mismo supuesto que ya usaba el código pre-Fase-5, no es nuevo, pero vale re-confirmar
  ahora que corre una vez por nodo en paralelo, no una sola vez por workflow).
- Si el agente efectivamente escribe el archivo marcador cuando se le pide dentro del prompt —
  depende de que seguir esa instrucción específica, no hay garantía de infraestructura como con
  un exit code real (trade-off ya documentado en el header de `interactiveTurnRunner.ts`).

### Cómo probar

1. F5 → correr el mismo workflow de antes en modo CLI.
2. Confirmar que la terminal de cada nodo arranca el CLI en modo REPL normal (no `-p`/`exec`), le
   tipea el prompt, y queda esperando.
3. Cuando el agente termine y escriba el archivo `step-<nodeId>-done.txt`, el paso debería pasar a
   `"completed"` solo, sin que el usuario tenga que hacer nada — pero la terminal sigue abierta e
   interactiva.
4. Probar escribirle algo más a mano en esa terminal después de que el paso ya se marcó
   `"completed"`, para confirmar que la sesión sigue viva y responde.
5. Con Codex: confirmar si `codex --sandbox workspace-write` abre una sesión interactiva utilizable
   o si hace falta un flag distinto (revisar `codex --help`, no `codex exec --help`).

## Prueba real del modo interactivo — 5 hallazgos, todos corregidos (2026-08-09)

El usuario probó el pivot a sesiones interactivas del mismo día y encontró varios problemas
reales, todos corregidos ya en esta sesión:

1. **Codex se rompió al arrancar** — `codex --sandbox workspace-write` tipeado muy pronto después
   del lanzamiento quedó parcialmente "tragado" por la TUI todavía arrancando, y el resto del
   prompt cayó directo en el shell crudo (`zsh: parse error near '>'`). Confirmado con `codex
   --help` real (no `codex exec --help`) que `--sandbox` sí es válido a nivel raíz — no era el
   flag, era timing.
2. **Claude no confirmaba el prompt solo** — el usuario tenía que apretar Enter a mano, tanto en
   el primer turno como después de aprobar un handoff humano. Mismo tipo de carrera contra el
   arranque de la TUI.
3. **No había forma de cancelar un run trabado** — si un nodo nunca escribe el archivo marcador
   (como pasó con Codex roto), el paso queda en `"running"` para siempre sin ninguna salida.
4. **Las terminales se abrían como tabs separados** — el usuario las quiere en split, una al lado
   de la otra.
5. **El comando de lanzamiento estaba hardcodeado** — el usuario usa un wrapper propio
   (`claude-with-memory`) y necesita poder configurar el comando/flags por proveedor.

Con Claude, aparte de estos dos problemas de timing, "se comportó genial: en cada paso fue dando
como completado y se fue mostrando eso en el run status" — confirma que el mecanismo del archivo
marcador funciona bien una vez que el prompt llega a destino.

**Correcciones:**

- `src/services/workflowRun/interactiveTurnRunner.ts`: el comando de lanzamiento y el delay de
  arranque ya no están hardcodeados — se leen de configuración (`agentStudio.cli.claudeCommand`,
  `agentStudio.cli.codexCommand`, `agentStudio.cli.startupDelayMs`, default 3000ms en vez de
  1500ms), declaradas en `package.json` (`contributes.configuration`). El prompt ya no se tipea
  con `sendText(text, true)` en una sola llamada — se separa en `sendText(text, false)` + una
  pausa de 400ms + `sendText("", true)` para el Enter, como mitigación (no garantía — VS Code no
  tiene forma de saber cuándo una TUI está lista para recibir input) de la carrera de timing.
  También acepta un `shouldCancel` opcional que corta el polling del archivo marcador.
- `src/services/workflowRun/workflowTerminalService.ts`: la primera terminal de un run queda como
  "ancla"; las siguientes se crean con `location: { parentTerminal: anchorTerminal }` — abren en
  split, no en tabs nuevos.
- **Botón de Stop real**: `WorkflowRunState` suma `runId`; `workflowRunManager.ts` acepta
  `shouldCancel: () => boolean` (corta el despacho de nodos nuevos y el polling de los que están
  en curso, dejándolos terminar su propio ciclo en vez de matarlos a la fuerza); `extension.ts`
  mantiene `activeRuns: Map<runId, {cancel}>`; mensajes nuevos `cancelWorkflow` (webview→extensión)
  wireados en `dashboardPanel.ts`; botón "■ Stop" nuevo en el panel "Run status" de
  `GraphCanvas.tsx`, visible sólo mientras el run está `"running"`.

`npm run check`, `build:extension` y `build:webview` verificados limpios (CSS con balance de
llaves confirmado: 373/373).

**Todavía no se probó nada de esto en la práctica** — son mitigaciones y features nuevas sobre un
problema de timing que, por naturaleza, no tiene garantía de infraestructura (no hay API de VS
Code para saber cuándo una TUI externa terminó de arrancar). Si sigue fallando, la config nueva
(`startupDelayMs` más alto, o un comando propio) es la primera palanca a mover antes de tocar
código de nuevo.

## Segunda ronda de pruebas: Claude arreglado, Codex y split siguen fallando (2026-08-09)

Confirmado por el usuario: el botón de Stop funciona, Claude ya no necesita Enter manual, y los
comandos configurables funcionan. Pero **Codex sigue exactamente igual** (mismo
`zsh: parse error near '>'`) y **el split de terminales no anduvo nada** (todas como tabs nuevos).

**Codex — nueva hipótesis, con evidencia real de su propio `--help`:** codex usa por defecto el
buffer de pantalla alternativa del terminal (como `vim`/`htop`) para su TUI. Si el `sendText`
escribe mientras esa transición de pantalla todavía está en curso, el texto puede terminar en el
buffer equivocado — coincide con que a Claude (que aparentemente no usa alt-screen, o lo maneja
distinto) el mismo fix de timing sí le funcionó, y a Codex no. `codex --help` confirma un flag
real para esto: `--no-alt-screen` ("Disable alternate screen mode. Runs the TUI in inline mode,
preserving terminal scrollback history."). Se agregó a los defaults de
`agentStudio.cli.codexCommand` (`package.json` y el fallback en `interactiveTurnRunner.ts`).
**No confirmado todavía contra una corrida real.**

**Split de terminales — segundo intento, tampoco confirmado:** se agregó
`this.anchorTerminal.show(true)` justo antes de crear cada terminal split, por si VS Code sólo
respeta `location.parentTerminal` de forma confiable cuando el padre es la terminal activa en ese
momento. Es una hipótesis razonable pero no verificada — no hay forma de probar esto sin una
corrida real, y el código en sí (`location: { parentTerminal }`) ya coincide con lo que documenta
`@types/vscode` para `TerminalOptions`, así que si sigue sin funcionar después de este cambio, el
problema puede estar en otro lado (versión de VS Code, alguna preferencia de layout del usuario) y
no en el uso de la API en sí — habría que investigar más a fondo, posiblemente con
`vscode.commands.executeCommand("workbench.action.terminal.split")` como alternativa.

`npm run check` y `build:extension` verificados limpios.

## Qué falta (próximo paso sugerido)

**Fase 5 (detección de fin de turno) queda cerrada de punta a punta** para `claude` y `codex`,
confirmada por el usuario contra corridas reales de 5 pasos: inyección resuelta, objetivo del run
funcionando, encadenado real entre pasos, output limpio para encadenar (sin banner/traza), y
ambos flags de invocación (`claude -p` / `codex exec -o`) confirmados. No queda nada pendiente de
validación en esta fase salvo un turno de varios minutos (sólo se probó hasta ~11s) y el
comportamiento si el usuario interactúa manualmente con la terminal durante un turno — ninguno de
los dos bloquea seguir.

**N terminales en paralelo + gating humano ya están implementados** (ver la sección de arriba) —
falta correrlos en la práctica, que es el próximo paso concreto (ver "Cómo probar esto"). Después
de confirmar eso:
- Editor de grafo: agregar UI para setear `handoff.mode` por edge (hoy sólo se puede editando el
  JSON a mano) — es la pieza que falta para que el gating humano sea usable sin editar archivos.
- Catálogo de templates con prompts propios (Fase 3).
- Idioma de interacción (Fase 2).
- Estado/recuperación (persistir un run y reconectar terminales al reabrir VS Code, Fase 7),
  colores/animación reales en los nodos del grafo — hoy sólo cambia el panel lateral, no
  `.graph-node` (Fase 8, ya diseñada en `04-panel-ejecucion.md`), preflight, pruebas (Fases 9-10).

## Notas de handoff

- El clon local de `swarm-forge` de la sesión 1 vivió en un scratchpad efímero y ya no existe.
  Ya no hace falta releerlo salvo que se quiera reconsiderar el motor dual — el motor nativo no
  depende de su código.
- **Desde la Sesión 6 hay código real, y desde la Sesión 7 toca `runWorkflow`**:
  `src/services/workflowRun/{shellIntegrationPrototype,shellIntegrationUtil,oneShotTurnRunner}.ts`
  (nuevos), cambios en `src/commands/registerCommands.ts`, `src/extension.ts` (import +
  `runWorkflow` reescrito para modo CLI) y `package.json`. Se borró
  `ChatBridgeService.sendAgentToTerminal` (quedó sin uso). El modelo de datos (`WorkflowRunStep`,
  `WorkflowEdge`) todavía no se tocó — sigue siendo el mismo de siempre, sin `HandoffMode` ni
  `queued` implementados de verdad todavía, sólo diseñados en los docs. `npm run check` y
  `npm run build:extension` pasan limpios.
- El usuario pidió explícitamente no commitear nada por su cuenta; estos archivos (docs y código)
  quedan sin stagear ni commitear en el working tree para que el usuario revise el diff. Nota: el
  usuario ya hizo al menos un commit propio sobre esta carpeta en una sesión anterior — eso es
  esperado y no una violación de la regla (la regla es que el asistente no commitea, no que el
  usuario no pueda).
- Si una sesión futura quiere reconsiderar el "motor dual" (nativo + SwarmForge opcional)
  descartado en el pivot, el diseño completo del socket Unix y el wrapper de PATH quedó archivado
  tal cual en [`_archive-motor-swarmforge-descartado/`](./_archive-motor-swarmforge-descartado/)
  (y también en la nota de auditoría del vault) — no hace falta rehacerlo desde cero, sólo
  releerlo. Nada de esta carpeta está commiteado todavía, así que "archivado como archivo" es la
  única red de seguridad real, no el historial de git.
