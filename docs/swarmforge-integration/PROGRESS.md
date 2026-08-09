# Checkpoint de progreso

**Leer esto antes de tocar cualquier otro archivo de esta carpeta.** Este archivo existe para
que si la sesión actual (de cualquier IA — Claude Code, Codex, u otra) se corta por falta de
tokens o de tiempo, la siguiente sesión pueda retomar exactamente donde quedó, sin tener que
releer todo el hilo de conversación original.

**Regla para quien retome este trabajo:** antes de escribir código, actualizá la tabla de abajo
y la sección "Notas de handoff" con dónde quedaste, aunque sea a mitad de una fase. No dejes
este archivo desactualizado al cortar la sesión.

## Estado por fase

| Fase | Descripción | Estado | Última actualización |
|---|---|---|---|
| 0 | Licencia y modalidad de distribución (external vs bundled) | Diseño cerrado, no implementado | 2026-08-09 |
| 1 | Modelo de datos extendido (`WorkflowDefinition`/`Node`/`Edge`) | Diseño cerrado, no implementado | 2026-08-09 |
| 2 | Separación `uiLanguage` / `interactionLanguage` / `languageOverride` | Diseño cerrado, no implementado | 2026-08-09 |
| 3 | Import de templates two-pack/four-pack/six-pack | Diseño cerrado, no implementado | 2026-08-09 |
| 4 | Adaptador `src/services/swarmforge/*` (generador de config) | Diseño cerrado, no implementado | 2026-08-09 |
| 5+6 | Terminal adapter de VS Code (reemplaza el "modo headless" inventado en la v1) | Diseño técnico concreto listo (socket Unix), no implementado ni prototipado | 2026-08-09 |
| 7+8 | Handoff control HIL/AIL (reemplaza el `pending_approval/` inventado en la v1) | Diseño técnico concreto listo (wrapper de PATH), no implementado ni prototipado | 2026-08-09 |
| 9 | Estado y recuperación (`RunStatus`/`StepStatus`, reconexión al reabrir VS Code) | Sólo enunciado en el plan original, sin revisar en detalle | No iniciado |
| 10 | Panel de ejecución (colores por nodo, panel lateral) | Sólo enunciado en el plan original, sin revisar en detalle | No iniciado |
| 11 | Preflight de seguridad | Parcialmente cubierto por `04-riesgos.md`, falta checklist ejecutable | No iniciado |
| 12 | Plan de pruebas | Sólo enunciado en el plan original, sin revisar en detalle | No iniciado |

## Qué se hizo en esta sesión (2026-08-09)

1. Se clonó `swarm-forge` localmente (scratchpad efímero, ya no existe entre sesiones — hay que
   re-clonar si se retoma) y se leyó el código real: README completo, árbol de
   `swarmforge/scripts/`, `swarmforge/constitution/articles/`, `bb.edn`, `close-swarm`.
   Confirmado: sin `LICENSE`, basado en Babashka/Clojure + zsh, packs como ramas git separadas
   (no carpetas), terminal adapters ya existentes y documentados, protocolo de handoff real con
   directorios `outbox/sent/failed/inbox` (sin `pending_approval`), sin modo headless.
2. Se leyó el código real de Agent Studio (`src/domain/models.ts`, `src/extension.ts` función
   `runWorkflow` líneas ~607-818, `webview/app/i18n.tsx`) para confirmar las afirmaciones del
   plan original sobre el estado actual — confirmadas: una sola terminal compartida en modo CLI,
   DFS sin condiciones de transición, step "completed" al enviar el prompt (no al terminar el
   agente), idioma sólo de UI sin efecto en el agente.
3. Se corrió un subagente `Software Architect` (independiente, sin ver mi razonamiento) con los
   hechos verificados como contexto dado, para auditar el plan original y proponer arquitecturas
   concretas de terminal-adapter y de HIL/AIL. Su informe completo quedó en el vault de memoria
   compartido: `obsidian-ai-memory-vault/memory/sessions/2026-08-09-pc-escritorio-f3e08c1b-agent-studio-swarmforge-audit.md`.
4. Se escribió el plan v2 en esta carpeta incorporando las correcciones.

## Qué falta (próximo paso sugerido)

El siguiente paso natural es **Fase 5+6 (terminal adapter)** como primer entregable del MVP: es
el de menor riesgo legal y técnico, y es 100% verificable de forma aislada (correr un swarm
nativo de SwarmForge con `SWARMFORGE_TERMINAL=vscode` y confirmar que abre terminales integradas
en vez de ventanas de Terminal.app). No depende de nada de HIL/AIL ni del modelo de datos
extendido de Agent Studio — se puede prototipar como un script standalone antes de tocar
`src/extension.ts`. Ver [`02-arquitectura-terminal-adapter.md`](./02-arquitectura-terminal-adapter.md)
para el protocolo de socket propuesto.

Antes de escribir código de producción, falta todavía:
- Un ADR formal (no sólo esta nota) para el protocolo de socket Unix, dado que es la pieza más
  nueva y con más superficie de decisión (formato de mensajes, manejo de reconexión, permisos).
- Un ADR formal para el diseño del wrapper de PATH de HIL/AIL, incluyendo cómo se documenta la
  limitación de que un agente que conozca la ruta real puede saltarse el gate.
- Confirmar con una prueba real (no sólo lectura de README) que `terminal_open_session` funciona
  como está documentado — el README es la única fuente consultada hasta ahora, no se ejecutó
  SwarmForge de punta a punta.

## Notas de handoff

- El clon local de `swarm-forge` vivió en un scratchpad de sesión que **no persiste**. Si esta
  carpeta se retoma en otra sesión y hace falta releer código real de SwarmForge, re-clonar:
  `git clone --depth 1 https://github.com/unclebob/swarm-forge.git`.
- No se escribió ni un archivo de código de producción todavía — todo lo hecho hasta ahora es
  plan y arquitectura, ningún cambio en `src/`, `webview/`, o `package.json`.
- El usuario pidió explícitamente no commitear nada por su cuenta; estos archivos quedan sin
  stagear ni commitear en el working tree para que el usuario revise el diff.
