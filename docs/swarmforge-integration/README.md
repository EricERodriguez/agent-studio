# Integración Agent Studio ↔ SwarmForge

Este directorio es el plan de trabajo para que Agent Studio pueda ejecutar workflows de
[SwarmForge](https://github.com/unclebob/swarm-forge) (`unclebob/swarm-forge`), incluyendo:

- Elegir, por cada handoff entre agentes, si la transición es automática, requiere aprobación
  humana, o pasa primero por un agente revisor de IA (Human-in-the-Loop / AI-in-the-Loop).
- Abrir una terminal integrada de VS Code por cada agente del swarm (no una sola terminal
  compartida como hace hoy `runWorkflow` en `src/extension.ts`).
- Importar los templates `two-pack`, `four-pack` y `six-pack` de SwarmForge como workflows
  de Agent Studio, con selección de idioma de interacción por workflow y por nodo.

**Este plan es la versión 2 de un plan original del usuario.** La v1 fue auditada contra el
código real de ambos repos (no contra su documentación asumida) y contra un subagente
Software Architect independiente. Varias piezas de la v1 resultaron inventadas o inviables;
quedan documentadas en [`01-plan-revisado.md`](./01-plan-revisado.md) con la corrección al lado,
no borradas, para que quede el rastro de la decisión.

## Cómo está organizado esto

| Archivo | Contenido |
|---|---|
| [`PROGRESS.md`](./PROGRESS.md) | **Leer primero siempre.** Checkpoint de en qué fase quedó el trabajo, qué falta, y notas de handoff entre sesiones/IAs distintas. |
| [`01-plan-revisado.md`](./01-plan-revisado.md) | El plan completo por fases (0-12), corregido, con lo que cambió respecto a la v1 y por qué. |
| [`02-arquitectura-terminal-adapter.md`](./02-arquitectura-terminal-adapter.md) | Diseño técnico concreto de cómo una terminal de VS Code por agente se conecta con SwarmForge sin forkearlo. |
| [`03-arquitectura-handoff-control.md`](./03-arquitectura-handoff-control.md) | Diseño técnico concreto de Human-in-the-Loop / AI-in-the-Loop sin modificar el core de SwarmForge. |
| [`04-riesgos.md`](./04-riesgos.md) | Registro de riesgos, incluidos los que la v1 del plan no contemplaba. |

## Los tres hallazgos que más cambian el plan original

1. **SwarmForge no tiene archivo `LICENSE`.** Por defecto eso es "todos los derechos
   reservados": no se puede redistribuir ni forkear legalmente sin permiso del autor. La v1
   dejaba la modalidad "bundled" (distribuir SwarmForge dentro de la extensión) como una fase
   futura. Pasa a estar **bloqueada indefinidamente**, no pendiente — ver
   [`01-plan-revisado.md § Fase 0`](./01-plan-revisado.md#fase-0).
2. **El modo `--headless --state-format json` que la v1 asumía no existe.** Pedirlo implicaría
   modificar el core de SwarmForge, lo cual choca de lleno con el problema de licencia. En su
   lugar, SwarmForge ya expone un punto de extensión oficial y documentado para esto: los
   **terminal backend adapters** (`swarmforge/scripts/terminal-adapters/*.sh`). Se puede escribir
   un adapter nuevo (`vscode.sh`) sin tocar una sola línea del core — ver
   [`02-arquitectura-terminal-adapter.md`](./02-arquitectura-terminal-adapter.md).
3. **El `inbox/pending_approval/` que la v1 asumía para Human-in-the-Loop no existe.** El
   protocolo real (`handoffd.bb`) entrega automático de `outbox` a `inbox`, sin gate. HIL/AIL se
   logra interceptando la invocación del helper `swarm_handoff.sh` desde el `PATH` del agente —
   ver [`03-arquitectura-handoff-control.md`](./03-arquitectura-handoff-control.md). Es un
   enforcement de infraestructura, no una simple instrucción de prompt, pero tiene un límite
   honesto: si el agente conoce o hardcodea la ruta real del script, puede saltarse el gate.

## Estado de la licencia (bloqueante para "bundled", no para "external")

La modalidad `external` (el usuario instala SwarmForge por su cuenta, Agent Studio sólo genera
configuración y un adapter propio que el usuario copia a su checkout local) **no** tiene problema
de licencia: Agent Studio no distribuye código de SwarmForge, sólo archivos 100% propios que
siguen un contrato de extensión documentado públicamente en el README de SwarmForge. Esa es la
única modalidad viable para el MVP y probablemente para siempre, salvo que el autor publique una
licencia compatible.
