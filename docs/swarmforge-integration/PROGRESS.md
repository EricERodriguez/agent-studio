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
| 1 | Modelo de datos extendido (`WorkflowDefinition`/`Node`/`Edge`, `handoffMode` por edge) | Diseño cerrado, no implementado | 2026-08-09 |
| 2 | Separación `uiLanguage` / `interactionLanguage` / `languageOverride` | Diseño cerrado, no implementado, sin cambios por el pivot | 2026-08-09 |
| 3 | Catálogo de templates inspirados en two/four/six-pack | Revisada — prompts propios en vez de copiar los de SwarmForge, ver `01-plan-revisado.md` | 2026-08-09 |
| 4 | `WorkflowRunManager` nativo (reemplaza el adaptador `src/services/swarmforge/*` de la v2) | Diseño técnico concreto listo, no implementado | 2026-08-09 |
| 5 | N terminales de VS Code por workflow + detección de fin de turno | Diseño técnico concreto listo (Terminal Shell Integration API + convención one-shot/marcador), no implementado ni prototipado — **es el punto de mayor incertidumbre técnica del plan nuevo**. Confirmado por el usuario: `runWorkflow` debe marcar "completed" al terminar de verdad, no al enviar el prompt | 2026-08-09 |
| 6 | Handoff control: Human-in-the-Loop + IA como nodo del grafo (`HandoffMode` = sólo `automatic`/`human`) | Diseño técnico concreto listo, simplificado tras cerrar un riesgo de inyección — ya no hay modo `ai-review` de edge | 2026-08-09 |
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

**Todavía no se corrió este fix en la práctica** — compila limpio pero falta que el usuario lo
pruebe de nuevo con Codex y confirme que `step-N-final.txt` tiene sólo la respuesta, sin ruido.

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

## Qué falta (próximo paso sugerido)

Fase 5 (detección de fin de turno) queda validada de punta a punta para `claude` y `codex`:
inyección cerrada, objetivo/encadenado funcionando, ambos flags confirmados contra corridas
reales. Único detalle menor sin cerrar: confirmar que el *contenido* de las respuestas de Codex
es coherente (no sólo que no tira error) — pedirle al usuario que revise
`step-0-output.txt` de la corrida de Codex la próxima vez que se retome esto.

El siguiente paso real de desarrollo, no ya de validación:
- Modelo de datos extendido (Fase 1) — no depende de nada de lo anterior, se puede hacer en
  paralelo.
- `WorkflowRunManager` (Fase 4) integrando N terminales (Fase 5) + gating humano in-process
  (Fase 6, sólo `automatic`/`human` — IA-en-el-loop se logra modelando un nodo revisor en el
  grafo, no con lógica de motor aparte).
- Catálogo de templates con prompts propios (Fase 3).
- Idioma de interacción (Fase 2).
- Estado/recuperación, panel, preflight, pruebas (Fases 7-10).

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
