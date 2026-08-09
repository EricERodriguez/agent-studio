# Arquitectura: Human-in-the-Loop / AI-in-the-Loop sin modificar SwarmForge

## Problema

Un edge de un workflow de Agent Studio puede estar marcado `automatic`, `human`, `ai-review`, o
`human-or-ai`. Eso tiene que traducirse en comportamiento real del swarm: pausar la entrega de un
handoff hasta que alguien (persona o agente revisor) lo apruebe.

El protocolo real de SwarmForge no tiene ningún gate: el daemon `handoffd.bb` vigila el `outbox`
de cada agente y, en cuanto un handoff está validado (`swarm_handoff.sh` lo dejó ahí bien
formado), lo copia directo al `inbox` del destinatario. Modificar `handoffd.bb` para agregar un
gate ahí está bloqueado por la falta de `LICENSE` de SwarmForge (ver Fase 0).

## Diseño: wrapper de `PATH` sobre `swarm_handoff.sh`

SwarmForge ya pone `swarmforge/scripts/` en el `PATH` de cada agente (documentado en su propio
README: "Startup syncs the shared helper scripts into every role worktree ... and puts that
local directory on the agent's PATH"). Eso es un punto de extensión real: cualquier ejecutable
que Agent Studio ponga **antes** en el `PATH`, con el mismo nombre (`swarm_handoff.sh`), es lo
que el agente termina invocando cuando corre ese comando por nombre.

Flujo:

1. Agent Studio genera, junto al resto de `.agent-studio/runs/<run-id>/`, un directorio
   `runtime/path-override/` que contiene un script `swarm_handoff.sh` propio.
2. Ese directorio se antepone al `PATH` del proceso del agente (vía el mecanismo que exponga la
   invocación del backend en `swarmforge.conf`, o vía un wrapper del propio comando `codex` /
   `claude` / etc. que setee `PATH` antes de `exec`).
3. Cuando el agente corre `swarm_handoff.sh <draft-file>`, en realidad ejecuta el script de
   Agent Studio, que:
   - Lee el draft (`type: git_handoff` o `type: note`, con `to:`, `priority:`, etc.).
   - Si el edge correspondiente (según `to:`/rol origen) es `automatic`: delega inmediatamente al
     script real de SwarmForge por **ruta absoluta**, no por nombre resuelto en `PATH` (para no
     reentrar en el propio wrapper).
   - Si es `human`: bloquea — abre una conexión al mismo socket Unix de
     [`02-arquitectura-terminal-adapter.md`](./02-arquitectura-terminal-adapter.md) (mismo
     mecanismo de transporte, otro endpoint: `POST /handoff-approval-request`), la extensión
     muestra el panel de aprobación descrito en la Fase 7 de la v1, y el wrapper queda esperando
     la respuesta (aprobar / aprobar con instrucciones / redirigir / rechazar / cancelar) antes
     de delegar (o no) al script real.
   - Si es `ai-review`: en vez de bloquear esperando a un humano, invoca al role reviewer (ver
     abajo) y actúa según su decisión JSON.
   - Si es `human-or-ai`: intenta primero `ai-review`; si la decisión es `escalate_to_human`, cae
     al flujo de `human`.

### AI-in-the-loop como role adicional, no como lógica embebida en el wrapper

En vez de que el wrapper mismo invoque un modelo, es más simple y más consistente con cómo ya
funciona SwarmForge agregar un **role/window extra** en `swarmforge.conf` (ej. `reviewer`), con
su propio `roles/reviewer.prompt` generado por Agent Studio, que:
- Recibe (vía handoff normal, sin intervención especial) el draft que el wrapper puso en un
  outbox intermedio dirigido a `reviewer`.
- Devuelve una decisión estructurada `{decision, confidence, summary, risks, instructions}` como
  describía la v1.
- El wrapper espera esa respuesta (polling de un archivo de resultado, o el mismo socket) y actúa
  en consecuencia.

Esto reutiliza la topología nativa de SwarmForge (cualquier rol es válido, cualquier agente
backend por rol) en vez de inventar un mecanismo de invocación de modelo paralelo dentro del
wrapper — más simple de mantener y más observable (el reviewer corre en su propia terminal
integrada, visible, igual que cualquier otro agente).

## Límite honesto de este enfoque

Este es un gate de **infraestructura** (un binario interpuesto en el `PATH`), no sólo una
instrucción de prompt — mejor que confiar en que el LLM "decida obedecer" una regla de la
constitution. Pero no es absoluto:

- Si el agente invoca el script real por **ruta absoluta** (por ejemplo porque la memoriza de una
  sesión anterior, o porque un prompt malformado se la revela), se salta el wrapper.
- Si el agente edita su propio `PATH` dentro de la sesión, también se lo salta.

Mitigación parcial: la ruta real del script de SwarmForge no debería exponerse en ningún prompt
ni output visible para el agente; el wrapper debe invocarla desde una ubicación que Agent Studio
controla y que no está documentada en ningún artículo de constitution ni role prompt generado.
Esto reduce la probabilidad pero no la elimina — **la UI de Agent Studio debe comunicar esto
como una limitación conocida**, no venderlo como una garantía dura de seguridad. Para handoffs
verdaderamente críticos (ej. antes de un merge a una rama protegida), la mitigación real no es
este wrapper sino controles fuera del swarm (branch protection, revisión de PR humana
obligatoria) — este mecanismo es para gobernar el *flujo de trabajo entre agentes*, no un
sustituto de controles de seguridad a nivel de repositorio.

## Qué falta diseñar (no cerrado en esta pasada)

- Formato exacto del archivo de "resultado de aprobación" o si todo pasa por el socket sin
  archivos intermedios.
- Qué pasa si la extensión de VS Code está cerrada cuando un wrapper intenta pedir aprobación
  humana (¿el wrapper reintenta con backoff? ¿hay un timeout que cae a `onTimeout` como proponía
  la v1: `wait | reject | approve | fail`?). La v1 ya tenía esta idea (`timeoutSeconds`,
  `onTimeout`) y sigue siendo válida, sólo falta conectarla al mecanismo real de este wrapper.
