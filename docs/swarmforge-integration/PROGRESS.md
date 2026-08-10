# Checkpoint de progreso

**Leer esto antes de tocar cualquier otro archivo de esta carpeta.** Este archivo existe para
que si la sesión actual (de cualquier IA — Claude Code, Codex, u otra) se corta por falta de
tokens o de tiempo, la siguiente sesión pueda retomar exactamente donde quedó, sin tener que
releer todo el hilo de conversación original.

**Regla para quien retome este trabajo:** antes de escribir código, actualizá la tabla de abajo
y la sección "Notas de handoff" con dónde quedaste, aunque sea a mitad de una fase. No dejes
este archivo desactualizado al cortar la sesión.

**Ver [`BUGS.md`](./BUGS.md) para el índice de bugs conocidos sin resolver** (split de terminales,
Codex CLI sin correr nada) — dejados a propósito para resolver todos juntos más adelante, no
frenan el resto del plan.

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
| 1 | Modelo de datos extendido (`WorkflowDefinition`/`Node`/`Edge`, `HandoffMode` por edge) | **Implementado y confirmado** — `HandoffMode`/`WorkflowEdge.handoff` en `src/domain/models.ts`; toggle "⚡ Auto / 👤 Human" en el editor de grafo (`GraphCanvas.tsx`), ya no hace falta editar el JSON a mano. Pendiente sólo el bug cosmético del ícono ⚡ (`BUGS.md` #3) | 2026-08-09 |
| 2 | Separación `uiLanguage` / `interactionLanguage` / `languageOverride` | **Implementado, pendiente de QA UI real** — locale del dashboard persistido como `uiLanguage`, preferencia de workspace `agentStudio.interactionLanguage` y override opcional por nodo que se inyectan al prompt sin alterar la UI | 2026-08-10 |
| 3 | Catálogo de templates inspirados en two/four/six-pack | **Implementado y validado parcialmente en la UI real** — el flujo Repository → Four-Pack creó los cuatro agents, persistió el workflow y abrió el dashboard con el grafo y el handoff humano inicial. Aún no se recorrieron desde UI Two-Pack, Six-Pack ni los casos de reuso/colisión. Templates son cadenas lineales de un solo pase (el motor DAG no soporta los loops indefinidos de SwarmForge, decisión explícita) | 2026-08-10 |
| 4 | `WorkflowRunManager` nativo (reemplaza el adaptador `src/services/swarmforge/*` de la v2) | **Implementado y confirmado** — `src/services/workflowRun/workflowRunManager.ts`, scheduler real basado en dependencias del grafo, corridas reales de varios pasos confirmadas por el usuario | 2026-08-09 |
| 5 | N terminales de VS Code por workflow + detección de fin de turno | **Cerrado de punta a punta y confirmado.** Detección de fin de turno validada contra `claude`/`codex` reales. N terminales en paralelo (`WorkflowTerminalService`) confirmado corriendo simultáneo en una corrida real. Split de terminales sigue roto (`BUGS.md` #1, todos abren como tabs nuevos) | 2026-08-09 |
| 6 | Handoff control: Human-in-the-Loop + IA como nodo del grafo (`HandoffMode` = sólo `automatic`/`human`) | **Implementado y confirmado** — `workflowRunManager.ts` pausa el nodo en `waiting_approval`, panel de aprobación propio (no modal nativo) confirmado bloqueando correctamente en una corrida real, con el toggle del editor de grafo ya no hace falta editar JSON | 2026-08-09 |
| 7 | Estado y recuperación (persistencia de un run, reconexión al reabrir VS Code) | **Rediseñado; pendiente de implementación** — un cierre marca la corrida como `interrupted` y la conserva sólo para inspección, sin adoptar procesos ni reintentar nodos automáticamente; ver `06-estado-recuperacion.md` | 2026-08-10 |
| 8 | Panel de ejecución y estados visuales del grafo (`queued`/`running` animado/`completed`) | **Implementado y confirmado** — colores por estado en `.graph-node` y animación de pulso en `running`, confirmados por el usuario contra una corrida real (dos rondas: colores, luego intensidad del pulso) | 2026-08-10 |
| 9 | Preflight de seguridad | **Implementado; validación UI inconclusa** — se retiró el warning de working tree sucio por pedido del usuario. Aún falta observar en EDH el blocker de CLI inexistente y el warning Continue/Cancel para un workspace sin git | 2026-08-10 |
| 10 | Plan de pruebas | **Diseñado; pendiente de ejecutar y automatizar** — matriz de tests unitarios, integración y EDH real en `07-plan-pruebas.md` | 2026-08-10 |

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

## Tercera ronda: modal de objetivo agregado; hallazgo grande sobre Codex vía su propia respuesta (2026-08-09)

El usuario pidió (dos veces, la primera vez se me pasó) reemplazar el `vscode.window.showInputBox`
del objetivo del run por un panel propio como el de aprobación — el input nativo es de una sola
línea, demasiado chico para escribir una tarea real. Implementado con el mismo patrón que el panel
de aprobación:

- Mensajes nuevos `objectiveRequest` (extensión→webview) / `objectiveResponse` (webview→extensión)
  en `messages.ts`/`types.ts`.
- `extension.ts`: `pendingObjectives: Map<requestId, resolve>`, mismo patrón que
  `pendingApprovals` — ya no usa `showInputBox`.
- `webview/app/components/ObjectivePanel.tsx` (nuevo): overlay con un `<textarea>` de 6 filas,
  botones Cancel/Start run. Montado en `DashboardPage.tsx` junto a `ApprovalPanel`.

**Hallazgo grande sobre Codex — el usuario le preguntó directamente al CLI de Codex (con acceso a
su propia documentación oficial) cómo integrarse mejor, y la respuesta invalida la hipótesis del
`--no-alt-screen` de esta misma sesión:**

> "`--no-alt-screen` sólo cambia render/scrollback, no a qué proceso llega el teclado. [...] Si
> zsh parsea tu prompt, Codex aún no tomó control, salió/falló durante el inicio, o el envío fue a
> otra terminal. [...] No hay flag ni variable de entorno de la TUI que emita un 'ready to receive
> input' contractual. Por tanto, `sendText()` + timeout fijo no puede hacerse robusto."

La recomendación de Codex (validada contra `https://developers.openai.com/codex/app-server`, la
misma interfaz que usa la extensión oficial de VS Code de OpenAI): **`codex app-server`** — un
protocolo JSON-RPC por stdio (JSONL), sin pasar por una terminal ni por `sendText`:

```
initialize → initialized → thread/start (threadId) → turn/start (prompt como JSON)
                                                     → turn/steer (feedback humano DURANTE el turno)
                                                     → turn/completed (fin de turno confiable)
```

Esto es estrictamente mejor que el diseño actual para Codex en los dos ejes que más importan: fin
de turno confiable (evento explícito, no polling de un archivo que el agente puede o no escribir)
y feedback humano real (`turn/steer` es exactamente lo que el usuario pidió al principio de este
pivot — "que se pueda establecer un feedback con cada agente de ser necesario" — mejor resuelto
así que con una terminal que el usuario tipea a mano). El costo: es una arquitectura distinta
(spawn de un proceso hijo con JSON-RPC, no una `vscode.Terminal`), y cambia la UX de "escribirle
directo a una terminal visible" a "el panel de Agent Studio es la entrada humana" para los nodos
de Codex — no está implementado todavía, se le preguntó al usuario cómo quiere proceder antes de
construirlo (es la pieza de trabajo más grande pendiente de todo este plan).

`npm run check`, `build:extension` y `build:webview` verificados limpios.

**Sin resolver, sin nueva información:** split de terminales — sigue fallando, sin poder
diagnosticar más sin una corrida real (ver ronda anterior).

## `codex app-server` implementado — el usuario confirmó construirlo (2026-08-09)

El usuario eligió la opción recomendada: reemplazar terminal+`sendText` por `codex app-server`
para los nodos de Codex, dejando Claude tal cual (terminal interactiva, ya funciona bien).

**Antes de escribir código**, se generó el schema real del protocolo en vez de confiar sólo en lo
que había contado Codex por chat: `codex app-server generate-json-schema --out <dir>
--experimental` (comando real, confirmado con `codex app-server --help`). De ahí se confirmaron
las formas exactas de mensajes:

- Sobre JSON-RPC: `{id, method, params}` (request) / `{method, params}` (notification, sin `id`)
  / `{id, result}` (response) — JSONL, un objeto por línea, no framing tipo LSP con
  `Content-Length`.
- Handshake: `{id, method:"initialize", params:{clientInfo:{name,version}}}` → esperar respuesta
  → notificación `{method:"initialized"}` (la única notificación que el cliente puede mandar,
  confirmado en `ClientNotification.json` del schema).
- `thread/start` acepta `sandbox: "read-only"|"workspace-write"|"danger-full-access"` y
  `approvalPolicy: "untrusted"|"on-request"|"never"` — se usó `workspace-write` + `never`
  (coincide con la decisión ya tomada para Claude, `--permission-mode acceptEdits`) para no tener
  que implementar el protocolo de respuesta a aprobaciones (`ExecCommandApprovalResponse`,
  `ApplyPatchApprovalResponse`, etc., cada uno con su propia forma) en esta primera versión —
  `"never"` hace que Codex reciba el fallo de sandbox directo y decida solo, sin pedirnos nada.
- El `threadId` llega por la notificación `thread/started` (`{thread:{id,...}}}`), y el fin de
  turno por `turn/completed` (`{threadId, turn:{id, status, items, error}}`) — no
  necesariamente por el `result` de la request que lo dispara, así que el código espera ambas
  cosas y usa lo que llegue primero.
- La respuesta final del agente es el último item de `turn.items` con `type: "agentMessage"`
  (campo `.text`).

**Implementado:**
- `src/services/workflowRun/codexAppServerRunner.ts` (nuevo): `AppServerClient` (cliente JSON-RPC
  de bajo nivel sobre `child_process.spawn("codex", ["app-server", "--stdio"])`, framing JSONL
  manual) y `CodexAppServerService` (una sesión — proceso + thread — por nodo, reusada si el nodo
  tuviera más de un turno más adelante). Vuelca todo el tráfico JSON-RPC crudo a un
  `OutputChannel` ("Agent Studio: Codex app-server") para poder ver qué está pasando sin una
  terminal interactiva.
- `workflowRunManager.ts`: `runNode` ahora bifurca por `cliCommand` — `codex` usa
  `codexSessions.runTurn(...)` (sin crear terminal), `claude` sigue con
  `terminals.getOrCreateTerminal(...)` + `runAgentTurn` de siempre. `codexSessions.disposeAll()`
  se llama al final del run para matar los procesos hijos.

**Cambio de UX explícito para Codex:** ya no hay una terminal visible para escribirle a mano —
`turn/steer` (el equivalente a tipearle a Claude) **no está implementado todavía**, queda como
próximo paso real si se quiere feedback interactivo con Codex también. Por ahora, un nodo de
Codex se ve sólo como progreso en el panel "Run status" + el output channel para debug.

`npm run check` y `build:extension` verificados limpios. **Nada de esto se corrió todavía en la
práctica** — es la pieza de código más grande y más nueva de todo este plan (primer child_process
spawneado directamente, primer protocolo JSON-RPC implementado a mano).

## Bug: "run workflow" con Codex CLI no hace nada; se creó BUGS.md (2026-08-09)

El usuario reportó que correr con Codex CLI no hace nada visible — ni error, ni progreso. Como el
diseño de `codex app-server` es del mismo día y nunca se probó en la práctica, no se sabe todavía
si el problema es de spawn, de handshake, o de reporte de errores a la UI. Se creó
[`BUGS.md`](./BUGS.md) como índice rápido de bugs conocidos sin resolver (split de terminales +
este), a pedido explícito del usuario: juntarlos y resolverlos todos en un bloque más adelante en
vez de frenar el resto del plan por cada uno.

## Editor de grafo: selector de `handoff.mode` por edge — implementado, sin probar (2026-08-09)

Con los bugs anotados para después, se avanzó con lo próximo del roadmap: ya no hace falta editar
el JSON a mano para marcar un edge como `human` — hay un toggle real en el grafo.

- `webview/app/store/useStudioStore.ts`: acción nueva `setEdgeHandoffMode(workflowId, edgeId,
  mode)` — guarda `{mode: "human"}` en el edge, o borra el campo `handoff` entero si se vuelve a
  `"automatic"` (mismo criterio que el backend: sin `handoff` = automático).
- `webview/app/components/GraphCanvas.tsx`: al seleccionar un edge de un workflow (clic en la
  línea), aparece un toggle flotante "⚡ Auto / 👤 Human" cerca del botón de borrar existente. Los
  edges marcados `human` además se ven con otro color (`--vscode-charts-yellow`) y un ícono 👤 en
  la etiqueta, visibles sin tener que seleccionarlos — mismo lenguaje visual que ya proponía
  `04-panel-ejecucion.md`.
- Como con cualquier otro cambio del editor de grafo, hay que apretar "Save Workflow" para que se
  escriba al JSON — no se guarda solo.

`npm run check` y `build:webview` verificados limpios (CSS balanceado: 376/376). **Sin probar en
la práctica** — falta confirmar que el toggle aparece, cambia de estado visualmente, y que el
JSON guardado tiene el campo `handoff` correcto.

## Fix de descubribilidad: el label "handoff" no era clickeable (2026-08-09)

El usuario confirmó que el ícono 👤 en edges `human` se ve bien, pero no encontraba cómo abrir el
toggle nuevo. Causa real: el texto "handoff" que se ve en el medio de cada edge
(`.graph-edge-label`) es un `<div>` puramente decorativo, sin `onClick` — sólo la línea curva en
sí (un `<path>` invisible de SVG, sin ningún indicio visual de que sea clickeable) dispara
`setSelectedEdgeId`. El usuario, razonablemente, intentó clickear el texto que ve, no la línea.

Arreglado: el label ahora también llama a `setSelectedEdgeId(edge.id)` al hacer clic, con
`cursor: pointer` y un hover que lo resalta (`webview/app/components/GraphCanvas.tsx` +
`styles.css`, clase nueva `.graph-edge-label-clickable`). `npm run check` y `build:webview`
verificados limpios (CSS balanceado: 378/378).

## Fase 8: colores/animación reales en los nodos del grafo (2026-08-09)

Hasta ahora el estado de un run sólo se veía en el panel lateral (`orderedRunSteps`); el nodo del
grafo (`.graph-node`) no cambiaba de aspecto durante la corrida. Implementado según el diseño ya
escrito en `04-panel-ejecucion.md`:

- `GraphCanvas.tsx`: nuevo `useMemo` `runStatusByNodeId` (mapa `nodeId → WorkflowRunStep.status`),
  poblado sólo cuando hay un `selectedWorkflowRun` activo. Colocado después de la declaración de
  `selectedWorkflowRun` (un primer intento de ubicarlo antes causaba un error de referencia por
  temporal-dead-zone, corregido antes de compilar). El className de `.graph-node` ahora agrega
  `` run-${status.replace(/_/g, "-")} `` cuando hay estado (`pending`, `queued`, `running`,
  `waiting_approval` → `run-waiting-approval`, `completed`, `failed`, `skipped`).
- `styles.css`: reglas nuevas `.graph-node.run-pending` (opacidad reducida),
  `.graph-node.run-queued` (borde naranja), `.graph-node.run-running` (borde con
  `--studio-accent` + animación `graph-node-pulse`, un pulso de `box-shadow` cada 1.6s),
  `.graph-node.run-waiting-approval` (borde amarillo, mismo color que el ícono 👤 de los edges
  humanos), `.graph-node.run-completed` (borde verde), `.graph-node.run-failed` (borde rojo),
  `.graph-node.run-skipped` (opacidad reducida a 0.45). Se agregó
  `@media (prefers-reduced-motion: reduce)` para desactivar la animación de pulso.

`npm run check` falla por un error preexistente en `agentRegistryService.ts` (línea 257,
`Property 'catch' does not exist on type 'PromiseLike<string>'`) — confirmado con `git stash` que
ocurre igual sin estos cambios, no relacionado con esta sesión. `npm run build:webview` compila
limpio. CSS balanceado: 390/390.

**Confirmado por el usuario contra una corrida real** (2026-08-10): los colores por estado
funcionan (naranja/azul/verde/rojo según corresponde), pero el pulso de `run-running` "apenas se
ve el movimiento". Causa real: el `@keyframes graph-node-pulse` original iba de
`spread 0 + opacidad 45%` a `spread 6px + opacidad 0%` — los dos extremos son casi invisibles
porque spread grande y opacidad alta nunca coinciden a la vez, así que el anillo nunca llega a
verse con fuerza. Arreglado con dos animaciones combinadas en `.graph-node.run-running`:
- `graph-node-pulse-ring`: anillo tipo "ping" clásico, arranca pegado al borde con 60% de opacidad
  y se expande hasta 14px de spread mientras se desvanece a 0%.
- `graph-node-pulse-border`: el borde mismo alterna entre `--studio-accent` y una versión
  aclarada (`color-mix` con blanco al 40%), para que el latido se note aunque el anillo quede
  tapado por otro nodo encima.

CSS balanceado: 394/394. `build:webview` limpio. **Confirmado por el usuario en la práctica**
("excelente ahora si se ve el latido", 2026-08-10) — Fase 8 queda cerrada de punta a punta:
colores por estado y animación de `running` funcionando en corridas reales.

## Fase 9: preflight de seguridad (2026-08-10)

Antes de esto no había ninguna verificación previa a lanzar un run: si `claude`/`codex` no
estaban en el PATH, o el usuario apuntó `agentStudio.cli.claudeCommand` a un ejecutable roto, el
primer síntoma visible era un nodo colgado sin explicación (justamente el tipo de fallo silencioso
que ya pasó una vez con Codex, `BUGS.md` #2). Implementado según lo previsto en `01-plan-revisado.md`
(Fase 9): "verificar que el workspace es un repo git y confirmar que las CLIs de los proveedores
elegidos están instaladas". Por decisión posterior del usuario, una corrida puede empezar sobre
un working tree sucio sin advertencia.

- Nuevo `src/services/workflowRun/preflightCheck.ts`, función `runPreflightChecks(cwd, mode)`:
  - **Blocker** (corta el run antes de pedir el objetivo): el ejecutable de la CLI no arranca.
    Se detecta corriendo `<executable> --version` (`spawn` sin `shell:true`, evita cualquier
    riesgo de inyección) con un timeout de 5s por si el binario se queda esperando stdin en vez
    de salir. Para `codex` el ejecutable es literal `"codex"` (así es como lo lanza
    `codexAppServerRunner.ts` — no lee `agentStudio.cli.codexCommand`, esa config quedó muerta
    para Codex desde el pivot a app-server). Para `claude` se toma el primer token de
    `agentStudio.cli.claudeCommand` (por defecto `claude`).
  - **Warning** (modal nativo de confirmación, no bloquea si el usuario elige seguir): el
    workspace no es un repo git (`git rev-parse --is-inside-work-tree`). Ya no ejecuta
    `git status --porcelain` ni cuenta cambios sin commitear.
- `src/extension.ts`, `runWorkflow`: el `cwd` ahora se calcula antes de pedir el objetivo (antes
  se calculaba después), se corre el preflight ahí mismo. Si hay blockers, `dashboard.postError`
  y corta sin pedir objetivo. Si hay warnings, `vscode.window.showWarningMessage(..., {modal:
  true}, "Continue anyway")` — mismo patrón ya usado para confirmar `deleteAgent`/`deleteWorkflow`
  en este archivo, no se inventó un mecanismo nuevo.

Probado manualmente contra este mismo repo (no vía extensión, corriendo los comandos crudos):
`git rev-parse --is-inside-work-tree` → `true`, `claude --version`/`codex --version` devuelven
exit 0 — confirma que el parsing y la detección de disponibilidad funcionan como se espera contra
binarios reales, no sólo en teoría. `npm run check` (sin contar el error preexistente de
`agentRegistryService.ts:257`) y `npm run build:extension` compilan limpio. **Sin probar todavía
disparando un run real desde la extensión** — falta confirmar que el blocker corta antes del
modal de objetivo cuando la CLI no existe, y que el warning de workspace sin git aparece y
respeta la decisión del usuario (Continue/Cancel).

## Fase 3: catálogo de templates (Two/Four/Six-Pack) (2026-08-10)

Recreación nativa de la idea de two/four/six-pack de SwarmForge, como pidió el plan revisado:
workflows normales de Agent Studio (agentes + edges + `handoff.mode`), no algo que se "importa y
corre con SwarmForge". Los prompts de cada rol se escribieron de cero a partir de lo que el
nombre del rol implica públicamente — no se copió texto de los `.prompt` reales de SwarmForge
(Fase 0/3 de `01-plan-revisado.md`).

- Nuevo `src/services/workflowTemplates.ts`: catálogo de 7 roles (`specifier`, `coder`,
  `cleaner`, `refactorer`, `architect`, `hardener`, `qa`) con instrucciones propias, y
  `buildWorkflowFromTemplate(templateId, name, existingAgents, isWorkflowIdTaken)` que arma los
  nodos/edges de cada template y **sólo** devuelve para crear los agentes cuyo id no exista ya en
  el registro del usuario — un agente existente con el mismo id (por ejemplo si ya corrió otro
  template antes, o si el usuario ya tenía un agente `coder` propio) se reutiliza tal cual, nunca
  se sobreescribe.
  - **Two-Pack**: `coder → cleaner`, automático.
  - **Four-Pack**: `specifier → coder → refactorer → architect`, `handoff: human` en
    `specifier → coder` (aprobar la spec antes de codear).
  - **Six-Pack**: `specifier → coder → cleaner → architect → hardener → qa`, `handoff: human` en
    `hardener → qa` (gate de cierre antes de la revisión final).
  - **Decisión explícita, no un descuido**: SwarmForge hace loopear indefinidamente algunos packs
    (ej. coder↔cleaner hasta que un humano corta la sesión). `workflowRunManager.ts` es un
    scheduler de grafo estrictamente DAG — cada nodo corre una sola vez por run, no hay forma de
    re-disparar un nodo ya `completed` — así que los tres templates quedaron como cadenas lineales
    de un solo pase, no loops. Es una simplificación deliberada para encajar con el motor ya
    construido en esta sesión, no algo pendiente de arreglar.
- `src/extension.ts`, `createWorkflow`: después de elegir el scope (Repository/Global, sin
  cambios), un nuevo `QuickPick` "Start from a template?" con "Custom" (el flujo de siempre, nodo
  único vacío) + los tres templates. Si se elige un template: pide nombre (default sugerido según
  el template), llama a `buildWorkflowFromTemplate`, guarda con `agentRegistryService.saveAgent`
  sólo los agentes nuevos (con el mismo scope elegido para el workflow), guarda el workflow con
  `workflowService.saveWorkflow`, refresca estado y abre el dashboard enfocado en el workflow
  nuevo — mismo patrón de cierre que ya usaba el flujo "Custom".

Validado con un script standalone (`esbuild` del módulo solo, sin VS Code) corriendo la lógica
pura contra casos reales: los tres templates generan los nodos/edges/`handoff.mode` esperados;
correr Six-Pack y después Four-Pack con los agentes ya creados sólo pide crear `refactorer` (el
único rol nuevo, el resto se reutiliza); colisión de id de workflow (`two-pack-workflow` ya
tomado) resuelve a `two-pack-workflow-2`. `npm run check` (sin contar el error preexistente de
`agentRegistryService.ts:257`) y `npm run build:extension` compilan limpio. **Sin probar todavía
desde la UI real de la extensión** — falta correr "Create Workflow" en la práctica, elegir un
template, y confirmar que el dashboard abre con el grafo ya armado y los agentes visibles en el
registry.

### Instrucciones de rol enriquecidas contra el contenido real de SwarmForge (2026-08-10)

El usuario probó el catálogo y encontró las instrucciones de cada rol muy pobres (una o dos
oraciones genéricas basadas sólo en lo que el nombre del rol sugiere). Pidió explícitamente
"copiar lo que hace cada agente del swarm" para que fueran más completas.

En vez de copiar texto literal (seguiría violando la decisión legal ya tomada en Fase 0 de
`01-plan-revisado.md`: no copiar el contenido real de los `.prompt` de SwarmForge), se leyeron
los 7 archivos `swarmforge/roles/<role>.prompt` reales desde GitHub (`raw.githubusercontent.com`,
ramas `two-pack`/`four-pack`/`six-pack` de `unclebob/swarm-forge`, más el `README.md` de `main`
para la descripción de cada pack) para entender en profundidad el alcance real de cada rol —
qué posee, qué reglas sigue, qué explícitamente NO hace, cómo hace el handoff — y se reescribieron
las 7 instrucciones de `ROLES` en `src/services/workflowTemplates.ts` de cero, mucho más largas
(500-750 caracteres cada una, contra ~120-150 antes) y concretas, capturando la sustancia real de
cada rol pero sin mecánica específica de SwarmForge (tmux, git worktrees, el demonio de handoff
por archivos, herramientas puntuales como `gherkin-parser`/`ir-dry-checker`), que no aplica al
modelo de Agent Studio (un objetivo por run, handoff vía edges del grafo, aprobación humana ya
integrada en el motor). El comentario de cabecera del archivo se actualizó para documentar
exactamente de dónde salió el contenido y por qué el texto es original.

Validado de nuevo con el mismo script standalone: las 7 instrucciones ahora son sustancialmente
más largas y específicas (confirmado imprimiendo cada una completa). `npm run check` (sin el
error preexistente) y `npm run build:extension` compilan limpio. **Sin probar todavía en la
práctica** — falta confirmar en la UI que las instrucciones enriquecidas se ven bien en el editor
de agentes y producen turnos de mejor calidad al correr un template real.

## Fase 2: idioma de interacción separado de UI (2026-08-10)

Implementación del diseño ya cerrado: no se reutiliza el locale del dashboard para inferir el
idioma de las respuestas de los agents.

- `webview/app/i18n.tsx`: el estado persistido del webview ahora se llama `uiLanguage`; se lee
  también la clave histórica `language` para no perder la preferencia existente y se migra al
  guardar. El provider expone `uiLanguage`/`setUiLanguage`, dejando claro que `tx()` sólo traduce
  la UI React.
- `package.json` + nuevo `src/services/interactionLanguageService.ts`: setting de workspace
  `agentStudio.interactionLanguage` (`en`/`es`, default `en`) y helpers que producen una
  instrucción de idioma de respuesta. Esa instrucción preserva deliberadamente código, comandos,
  paths, API names y texto literal, salvo pedido explícito de traducción.
- `WorkflowNode.languageOverride?: "en" | "es"`: override persistible por nodo. En el grafo, al
  seleccionar un nodo de workflow aparece un select `Language: workspace / English / Spanish`.
  Es un cambio de borrador del workflow y usa el Save Workflow existente para persistirse.
- `ChatBridgeService` agrega la instrucción al prompt normal y al prompt de turno; el
  `WorkflowRunManager` resuelve primero el override del nodo y, si no existe, la preferencia de
  workspace. Por lo tanto vale igual para Claude interactivo, Codex app-server y abrir un agent
  en Chat; no depende del idioma elegido para los labels de UI.

`npm run build` pasó. `npm run check` sigue fallando únicamente con el error preexistente de
`src/services/agentRegistryService.ts:257` (`PromiseLike<string>` no tiene `.catch`); no introdujo
errores adicionales de Fase 2. Falta reiniciar el Development Host y confirmar visualmente el
select de override y el texto final del prompt, antes de marcarla como confirmada.

## QA de Development Host: templates y preflight (2026-08-10)

Se ejecutó una instancia aislada real de VS Code 1.129.1 como **Extension Development Host**,
con el build que dispara F5 (`npm run build`) y un repositorio temporal vacío inicializado con
git. La primera invocación por F5 abrió el host sin carpeta y `Agent Studio: Create Workflow`
mostró literalmente `Error: Agent Studio needs an opened folder to create or save files.`; para
no confundir ese problema de launch/workspace con las fases bajo prueba, se abrió un segundo
Development Host aislado con ese repositorio temporal como folder y se confirmó Workspace Trust.
No se modificó `launch.json` en esta ronda.

### Fase 3 — resultado real

Se usó el Command Palette de la extensión: `Agent Studio: Create Workflow` → `Repository` →
`Four-Pack` → nombre `QA Four Pack`. Resultado observado en la UI real:

- El sidebar pasó a mostrar `QA Four Pack`, scope repository, `4 nodes · 3 edges`; Source
  Control mostró 5 cambios nuevos.
- Se crearon los cuatro archivos de agent de repositorio (`specifier`, `coder`, `refactorer`,
  `architect`) y `.vscode/agent-studio/workflows/qa-four-pack.json`.
- El dashboard se abrió directamente en el workflow. El grafo visible contenía los cuatro nodos
  y sus tres edges; el JSON escrito por la extensión confirma `handoff.mode: "human"` en
  `specifier → coder`, y las otras dos transiciones automáticas.

Evidencia visual temporal de esta ronda: `/tmp/agent-studio-template-dashboard-qa.png`. No se
recorrieron los otros dos packs ni las variantes de colisión/reuso desde UI, por lo que ésta es
una validación parcial, no exhaustiva.

### Fase 9 — resultado real, todavía no concluyente

El mismo repo temporal quedó deliberadamente sucio con los cinco archivos que creó Four-Pack.
Se verificó en el host que `codex --version` y `claude --version` existen y salen con código 0.
También se seleccionó `CLI de Codex` en el panel de ejecución; la inspección del estado React
del webview confirmó que `runMode` quedó en `cli-codex`, no sólo el texto visual del select.

Sin embargo, al solicitar `Ejecutar Workflow` no apareció el warning modal esperado por los
cambios sin commitear, tampoco el panel de objetivo ni un error de dashboard. La automatización
de webviews de Electron tuvo una limitación importante: sus primeros eventos mutaron el DOM del
select sin actualizar el estado React y lanzaron por error una corrida en modo Chat; se detuvo
inmediatamente y terminó como `Workflow failed. Workflow cancelled by user.`. Después se repitió
con estado React confirmado `cli-codex`, pero la observación del warning siguió sin materializarse.

Por honestidad de verificación, **no marcar Fase 9 como confirmada**: faltan dos reproducciones
manuales directas en el panel real, una con `agentStudio.cli.claudeCommand` apuntando a un binario
inexistente (debe bloquear antes del objetivo) y otra con el repo sucio (debe mostrar
Continue/Cancel y respetar ambos caminos). No se cambió código de producción ni se tocó ninguno
de los cuatro bugs deliberadamente diferidos de `BUGS.md`.

**Actualización posterior (2026-08-10):** el usuario pidió retirar el chequeo de cambios sin
commitear. `preflightCheck.ts` ya no corre `git status --porcelain` ni muestra el contador de
archivos sucios. Por lo tanto el segundo caso de QA deja de aplicar: queda validar el blocker de
CLI inexistente y el warning de workspace sin git.

## Fase 7 rediseñada y Fase 10 planificada (2026-08-10)

El usuario confirmó la alternativa recomendada para Fase 7: una corrida activa al cerrarse VS
Code se conserva para inspección y pasa a `interrupted`; no se intenta adoptar terminales o
procesos `codex app-server`, ni se redispatchan o reintentan nodos. El diseño durable, las reglas
de transición y los criterios de aceptación están en [`06-estado-recuperacion.md`](./06-estado-recuperacion.md).
La implementación sigue pendiente.

También se documentó la matriz de evidencia de Fase 10 en [`07-plan-pruebas.md`](./07-plan-pruebas.md):
unitarios para lógica pura, integración para servicios y manifests, y smoke/QA real en EDH para
UI, CLIs, handoffs y recuperación. Incluye el caso nuevo: un repositorio sucio debe seguir sin
advertencia, mientras que CLI inexistente y workspace sin git mantienen sus protecciones.

**Bug registrado (2026-08-10):** `npm run check` continúa fallando por el error preexistente
`TS2339` de `src/services/agentRegistryService.ts:257` (`PromiseLike<string>` no expone
`.catch`). Se añadió como `BUGS.md` #4 por indicación del usuario; `npm run build` sigue pasando.

## Qué falta (próximo paso sugerido)

Quedan por validar Fase 2 (idioma de interacción) y Fase 3 (templates, validación UI parcial).
Fase 7 quedó rediseñada y debe implementarse. Fase 9 sigue sin confirmación UI del blocker de CLI
inexistente y del aviso de workspace sin git; ya no tiene validación de working tree sucio. Fase
10 tiene plan, pero falta ejecutar y automatizar su matriz. Aparte de eso, sólo quedan los cuatro bugs de
`BUGS.md`, deliberadamente pospuestos para el final por pedido del usuario.

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
