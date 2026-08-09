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
| 6 | Handoff control HIL/AIL in-process | Diseño técnico concreto listo, mucho más simple que el diseño vía SwarmForge descartado | 2026-08-09 |
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

## Qué falta (próximo paso sugerido)

El punto de mayor incertidumbre técnica del plan nuevo es la **Fase 5 (detección de fin de
turno)**: hoy `runWorkflow` marca un paso "completado" apenas envía el prompt, no cuando el
agente termina, y eso es aceptable en modo secuencial de una sola terminal pero deja de serlo en
cuanto hay N terminales corriendo en paralelo con handoffs que dependen de saber si el paso
anterior realmente terminó. Antes de escribir código de producción, el siguiente paso concreto
es: **prototipar la detección de fin de turno con la API de Terminal Shell Integration de VS
Code** contra una invocación real de `claude`/`codex` en modo no interactivo (`-p`/one-shot),
confirmando que el evento de fin de ejecución y el exit code llegan de forma confiable antes de
diseñar el resto del `WorkflowRunManager` sobre ese supuesto. Ver
[`02-arquitectura-motor-nativo.md`](./02-arquitectura-motor-nativo.md).

Después de eso, en orden:
- Modelo de datos extendido (Fase 1) — no depende de nada de lo anterior, se puede hacer en
  paralelo.
- `WorkflowRunManager` (Fase 4) integrando N terminales (Fase 5) + gating in-process (Fase 6).
- Catálogo de templates con prompts propios (Fase 3).
- Idioma de interacción (Fase 2).
- Estado/recuperación, panel, preflight, pruebas (Fases 7-10).

## Notas de handoff

- El clon local de `swarm-forge` de la sesión 1 vivió en un scratchpad efímero y ya no existe.
  Ya no hace falta releerlo salvo que se quiera reconsiderar el motor dual — el motor nativo no
  depende de su código.
- No se escribió ni un archivo de código de producción todavía — todo lo hecho hasta ahora es
  plan y arquitectura, ningún cambio en `src/`, `webview/`, o `package.json`.
- El usuario pidió explícitamente no commitear nada por su cuenta; estos archivos quedan sin
  stagear ni commitear en el working tree para que el usuario revise el diff.
- Si una sesión futura quiere reconsiderar el "motor dual" (nativo + SwarmForge opcional)
  descartado en el pivot, el diseño completo del socket Unix y el wrapper de PATH quedó archivado
  tal cual en [`_archive-motor-swarmforge-descartado/`](./_archive-motor-swarmforge-descartado/)
  (y también en la nota de auditoría del vault) — no hace falta rehacerlo desde cero, sólo
  releerlo. Nada de esta carpeta está commiteado todavía, así que "archivado como archivo" es la
  única red de seguridad real, no el historial de git.
