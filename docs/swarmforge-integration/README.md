# Motor nativo de workflows multi-agente con handoffs humano/IA

> **Decisión de arquitectura (2026-08-09, confirmada por el usuario):** este proyecto pasa a
> construirse como un **motor nativo de Agent Studio**, no como una integración que depende del
> runtime de SwarmForge (tmux, worktrees, `handoffd.bb`). Los packs de SwarmForge
> (`two-pack`/`four-pack`/`six-pack`) siguen siendo la inspiración de los templates de workflow,
> pero se ejecutan con el motor propio de la extensión. Ver la sección "Por qué motor nativo y no
> SwarmForge como runtime" más abajo y `PROGRESS.md` para el historial completo de la decisión.

Este directorio es el plan de trabajo para que **cualquier workflow multi-agente creado en Agent
Studio** — importado desde un template inspirado en SwarmForge o armado a mano por el usuario con
sus propios agentes — pueda:

- Elegir, por cada handoff (edge) entre agentes, si la transición es automática, requiere
  aprobación humana, o pasa primero por un agente revisor de IA (Human-in-the-Loop /
  AI-in-the-Loop).
- Ejecutar cada agente del workflow en su propia terminal integrada de VS Code, en paralelo, en
  vez de la terminal única y secuencial que usa hoy `runWorkflow` en `src/extension.ts`.

Esto tiene que funcionar igual sin importar el origen del workflow — no es una funcionalidad
exclusiva de "workflows de SwarmForge", es una capacidad general del motor de ejecución de Agent
Studio.

## Por qué motor nativo y no SwarmForge como runtime

La primera versión de este plan (ver el historial en `PROGRESS.md`) proponía usar el runtime real
de SwarmForge (tmux + tres capas de scripts en Babashka/zsh + un daemon de handoffs) por debajo de
Agent Studio, con un adapter de terminal hablando por socket Unix y un wrapper de `PATH`
interceptando el script de handoff para lograr HIL/AIL. Ese diseño quedó completo y documentado
(ver el historial en el vault de memoria y los commits previos de esta carpeta si hace falta
consultarlo), pero se descartó como camino principal por decisión explícita del usuario:

- El pedido real es que **cualquier** workflow —no sólo los packs de SwarmForge— tenga esta
  capacidad. Atarlo al runtime de SwarmForge hubiera significado traducir *todo* workflow nativo
  de Agent Studio a un `swarmforge.conf` antes de poder correrlo, incluso para agentes que el
  usuario arma completamente a mano.
- Cuando Agent Studio controla su propia ejecución (que ya es el caso hoy: `runWorkflow` decide
  cuándo enviarle el prompt a cada agente), el gating humano/IA se vuelve mucho más simple:
  no hace falta interceptar nada de un proceso externo, la extensión simplemente no envía el
  siguiente prompt hasta que el handoff está aprobado. Eso elimina de raíz el problema de fondo
  del diseño anterior (que un agente se saltee el wrapper usando la ruta real del script).
- Se elimina casi toda la superficie de riesgo legal: no hace falta redistribuir ni modificar
  ningún código de SwarmForge, porque no se depende de su runtime. Sigue habiendo un matiz legal
  menor con el **texto** de los role prompts de SwarmForge si se los copia literalmente para los
  templates — ver Fase 3 en [`01-plan-revisado.md`](./01-plan-revisado.md).

El problema real que este pivot deja sin resolver todavía —y que el diseño anterior tampoco
resolvía del todo— es **cómo saber que un agente terminó su turno** cuando corre dentro de una
sesión interactiva (REPL) de `claude`/`codex` en una terminal de VS Code, en vez de un proceso que
arranca y termina por cada tarea. Ver
[`02-arquitectura-motor-nativo.md`](./02-arquitectura-motor-nativo.md) para el diseño propuesto
(API de Terminal Shell Integration de VS Code + invocación "one-shot" por turno donde el backend
lo soporte, con un mecanismo de marcador de finalización como fallback).

## Cómo está organizado esto

| Archivo | Contenido |
|---|---|
| [`PROGRESS.md`](./PROGRESS.md) | **Leer primero siempre.** Checkpoint de en qué quedó el trabajo, incluido el historial de la decisión de pivot a motor nativo. |
| [`BUGS.md`](./BUGS.md) | Índice rápido de bugs reales conocidos, sin resolver a propósito (agrupados para arreglar juntos más adelante). |
| [`01-plan-revisado.md`](./01-plan-revisado.md) | El plan completo por fases, actualizado para motor nativo. |
| [`02-arquitectura-motor-nativo.md`](./02-arquitectura-motor-nativo.md) | Diseño técnico: N terminales de VS Code por workflow, detección de fin de turno, `WorkflowRunManager`. |
| [`03-arquitectura-handoff-control.md`](./03-arquitectura-handoff-control.md) | Diseño técnico de Human-in-the-Loop / AI-in-the-Loop **in-process**, sin dependencias externas. |
| [`04-panel-ejecucion.md`](./04-panel-ejecucion.md) | Estados visuales del grafo: nodo corriendo (animado), completado, próximo en ejecución (`queued`). |
| [`05-riesgos.md`](./05-riesgos.md) | Registro de riesgos, actualizado para el motor nativo. |
| [`07-plan-pruebas.md`](./07-plan-pruebas.md) | Estrategia y matriz de pruebas del motor. |
| [`08-checklist-edh.md`](./08-checklist-edh.md) | Checklist funcional por áreas. |
| [`09-protocolo-qa-ia-vscode.md`](./09-protocolo-qa-ia-vscode.md) | Procedimiento obligatorio para que una IA valide la extensión dentro de VS Code. |

## Qué queda de la investigación sobre SwarmForge

Sigue siendo válido y útil como fuente de ideas, aunque ya no sea el runtime:

- La **forma** de los tres packs (two-pack: coder↔cleaner; four-pack: specifier→coder→refactorer→
  architect→specifier; six-pack: specifier→coder→cleaner→architect→hardener→QA) es una buena base
  de templates de workflow para el catálogo de Agent Studio — se puede recrear como workflows
  nativos (agentes + edges + `handoffMode` por edge) sin copiar código ni tmux de por medio.
- El repo de SwarmForge sigue sin `LICENSE`, así que los **role prompts** de sus ramas
  (`two-pack`, `four-pack`, `six-pack`) no se deben copiar literalmente al catálogo de templates
  que Agent Studio distribuye a todos sus usuarios — ver Fase 3 en `01-plan-revisado.md` para el
  tratamiento propuesto (prompts propios, inspirados en la descripción pública del README, no en
  el texto de los archivos `.prompt`).
