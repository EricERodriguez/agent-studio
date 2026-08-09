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

**Todavía no se corrieron** el Test 1 (confiabilidad con turnos largos, no sólo `echo`) ni el
Test 3 (CLI real `claude`/`codex`) — quedan pendientes antes de dar por cerrada toda la Fase 5.

## Qué falta (próximo paso sugerido)

Con la inyección ya confirmada y su mitigación validada, el siguiente paso real de producción es:
cambiar `runWorkflow` en `src/extension.ts` (línea ~777) para que `step.status = "completed"` se
setee desde el resultado real de `onDidEndTerminalShellExecution` en vez de al enviar el prompt —
hoy sigue sin tocarse. Antes de eso, sigue siendo recomendable correr el Test 1 al menos una vez
para confirmar que la señal de exit code también es confiable con un comando que tarde más que un
`echo` instantáneo (un turno real de agente puede tardar minutos).

Después de eso, en orden:
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
- **Desde la Sesión 6 sí hay código real**: `src/services/workflowRun/shellIntegrationPrototype.ts`
  (nuevo), más cambios en `src/commands/registerCommands.ts`, `src/extension.ts` y `package.json`
  para registrar el comando de desarrollo. Es diagnóstico, no producción — no toca `runWorkflow`
  ni el modelo de datos todavía. `npm run check` y `npm run build:extension` pasan limpios.
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
