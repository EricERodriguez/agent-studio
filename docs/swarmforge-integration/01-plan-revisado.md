# Plan revisado — Agent Studio ↔ SwarmForge

Este es el plan v2. Cada fase indica qué cambió respecto a la v1 del usuario y por qué, con
evidencia verificada contra el código real de ambos repos (no contra supuestos). Las fases con
diseño técnico extenso viven en archivos separados y acá sólo se resumen.

## Fase 0 — Licencia y modalidad de distribución

**Cambia respecto a la v1:** la v1 dejaba "bundled" como una modalidad futura condicionada a
conseguir autorización del autor. Eso sigue siendo cierto, pero hay que tratarla como
**bloqueada indefinidamente**, no como un ítem de roadmap con fecha implícita — el repo de
SwarmForge no tiene `LICENSE` en ningún lado (`ls LICENSE*` sin resultados, confirmado sobre un
clon real), y sin licencia explícita el default legal es "todos los derechos reservados": ni
redistribuir el código tal cual ni un fork modificado son legales sin permiso.

Decisiones que se mantienen de la v1:
- Modalidad única para el MVP y probablemente indefinida: `external` — el usuario instala
  SwarmForge por su cuenta siguiendo el `README.md` del propio proyecto.
- Pin de versión/commit al construir el catálogo de templates dentro de Agent Studio, para no
  depender de que `main`, `two-pack`, `four-pack` o `six-pack` cambien de forma incompatible sin
  aviso.
- Chequeo de compatibilidad de versión antes de ejecutar (`requiredVersion` estilo semver).

Ajuste nuevo: como Agent Studio va a distribuir su **propio** adapter de terminal
(`vscode.sh`, ver Fase 5+6) y sus **propios** helper scripts para HIL/AIL (ver Fase 7+8), hay que
dejar constancia explícita de que esos archivos son 100% código de Agent Studio (MIT), no
derivados de SwarmForge, y que el mecanismo de instalación es "el usuario/la extensión copia
estos archivos propios dentro de su checkout local de SwarmForge", igual que se instalaría un
plugin de cualquier herramienta de terceros. Esto evita cualquier ambigüedad de "estamos
redistribuyendo SwarmForge modificado".

## Fase 1 — Modelo de datos extendido

Se mantiene la propuesta de la v1 de extender `WorkflowDefinition`/`WorkflowNode`/`WorkflowEdge`
en `src/domain/models.ts` de forma retrocompatible (`engine?: "native" | "swarmforge"`, etc.).
Confirmado contra el código real que el modelo actual es minimalista (`WorkflowNode` sólo tiene
`id, agentId, position, isEntry?`; `WorkflowEdge` sólo `id, source, target, label?`; los
`handoffs` de `AgentDefinition` sólo tienen un booleano `send?`), así que no hay conflicto con
nada existente.

Ajuste: el campo `handoff.mode` en `WorkflowEdge` pasa a ser puramente un concepto de **Agent
Studio / UI**, no algo que SwarmForge entienda de forma nativa — su traducción real a
comportamiento ocurre en la Fase 7+8 (wrapper de PATH + topología de `swarmforge.conf`), no en
un campo de configuración que SwarmForge vaya a leer directamente.

## Fase 2 — Idioma de interacción separado del idioma de UI

Se mantiene tal cual la v1. Confirmado contra `webview/app/i18n.tsx` que hoy `Language` sólo
controla la UI de React vía `tx(english, spanish)` y no tiene ningún efecto sobre el idioma en
que un agente responde — es un requisito nuevo genuino, no depende de nada de SwarmForge, y se
resuelve igual que propone la v1: un artículo de constitution (`agent-studio-language.prompt`)
generado por Agent Studio e instalado junto a los demás artículos del run.

## Fase 3 — Importación de two-pack / four-pack / six-pack

Se mantiene la idea de la v1 de un catálogo de templates versionado dentro de Agent Studio, con
un ajuste de mecánica: confirmado que los tres packs **no son carpetas dentro de `main`**, son
ramas git separadas y documentales. El README de SwarmForge documenta el método soportado para
bajarlos sin crear un remoto git:

```sh
BRANCH=four-pack
curl -L "https://github.com/unclebob/swarm-forge/archive/refs/heads/${BRANCH}.tar.gz" | tar -xz --strip-components=1
```

El generador de Agent Studio debe replicar ese mismo mecanismo (tarball de una rama fija por
commit, no `main`), y el catálogo de templates JSON (`two-pack.json`, `four-pack.json`,
`six-pack.json`) debe versionar qué commit de cada rama fue el que se usó para construir el
template, para poder re-sincronizar deliberadamente en vez de arrastrar drift silencioso.

Se mantiene la corrección de nombre de la v1: es `six-pack`, no "sick-pack".

## Fase 4 — Adaptador Agent Studio → SwarmForge

Se mantiene la estructura de servicios de la v1 (`src/services/swarmforge/*`) y el layout de
salida (`.agent-studio/runs/<run-id>/{manifest.json,swarmforge.conf,constitution.prompt,
constitution/articles/,roles/*.prompt,runtime/}`). Este diseño encaja bien con los puntos de
extensión reales de SwarmForge: los artículos de constitution y los prompts de rol viven en el
working tree del **proyecto del usuario**, no dentro del propio SwarmForge, así que generarlos
ahí no toca código de terceros.

## Fase 5+6 — Terminal por agente (reemplaza el "modo headless" de la v1)

**Este es el cambio más grande respecto a la v1.** La v1 proponía pedirle a SwarmForge un modo
nuevo `./swarm --headless --state-format json` que emitiera eventos `swarm.ready` con sockets y
sesiones tmux. **Ese modo no existe hoy**, y construirlo implicaría modificar el core de
SwarmForge — lo cual choca directamente con la Fase 0 (sin licencia, no se puede forkear ni
redistribuir un core modificado).

En su lugar, SwarmForge ya expone —documentado en su propio README— un punto de extensión
oficial para exactamente este problema: los **terminal backend adapters**
(`swarmforge/scripts/terminal-adapters/*.sh`), con un contrato de seis funciones shell
(`terminal_backend_label`, `terminal_backend_can_open_sessions`, `terminal_backend_tracks_windows`,
`terminal_open_session`, `terminal_window_exists`, `terminal_close_window`). Hoy sólo existen
adapters para macOS Terminal.app, iTerm2, Ghostty, Windows Terminal, y un fallback `none` que
hace `tmux attach` en la shell actual — no hay ninguno para Linux de escritorio, así que en la
máquina del usuario (Ubuntu) SwarmForge cae hoy al fallback `none`.

El plan pasa a ser: escribir un adapter nuevo `vscode.sh` que implemente ese contrato hablando
con la extensión de VS Code vía un socket Unix local. Diseño completo, con formato de mensajes y
manejo de ids, en [`02-arquitectura-terminal-adapter.md`](./02-arquitectura-terminal-adapter.md).

Se mantiene de la v1: el mapa `Map<runId, Map<agentId, vscode.Terminal>>` en la extensión, la
regla de que cerrar una terminal de VS Code no debe matar la sesión tmux subyacente (la fuente
de verdad del estado sigue siendo tmux, no VS Code), y la política de layout (split hasta 3
agentes, tabs para más de 3).

## Fase 7+8 — Human-in-the-Loop / AI-in-the-Loop (reemplaza el `pending_approval/` de la v1)

**Segundo cambio grande respecto a la v1.** La v1 asumía un directorio
`inbox/pending_approval/` intermedio antes de `inbox/new/`. Ese directorio **no existe** en el
protocolo real: `handoffd.bb` vigila el `outbox` de cada agente y copia directo al `inbox` del
destinatario en cuanto el handoff está validado — no hay gate nativo.

Como modificar `handoffd.bb` está bloqueado por la Fase 0, HIL/AIL se implementan sin tocar el
core, usando sólo lo que SwarmForge ya permite personalizar: artículos de constitution, prompts
de rol, helper scripts propios en el `PATH` de cada agente, y topología libre en
`swarmforge.conf`. Diseño completo en
[`03-arquitectura-handoff-control.md`](./03-arquitectura-handoff-control.md).

Se mantiene de la v1: los estados de UI para el panel de aprobación, las acciones (aprobar,
aprobar con instrucciones, editar prioridad, redirigir, rechazar, cancelar), el contrato JSON
`{decision, confidence, summary, risks, instructions}` del reviewer de IA, y las reglas de
"nunca aprobar automáticamente operaciones destructivas" / "baja confianza → humano" / "cambios
de seguridad, infraestructura o migraciones → humano".

Corrección honesta que la v1 no hacía: el enforcement vía wrapper de `PATH` es infraestructura
real (mejor que confiar sólo en que el LLM "obedezca" una instrucción de prompt), pero no es
absoluto — si un agente conoce o hardcodea la ruta real del script de handoff (en vez de
invocarlo por el nombre resuelto vía `PATH`), puede saltarse el gate. Esto debe quedar explícito
en la UI y en la documentación, no presentado como una garantía dura.

## Fase 9 — Estado y recuperación

Sin revisión detallada todavía en esta pasada (queda para la siguiente sesión, ver
`PROGRESS.md`). La propuesta de la v1 (`RunStatus`/`StepStatus` persistidos, reconciliación al
reabrir VS Code contra el socket y las sesiones tmux) es razonable en principio porque tmux ya
sobrevive al cierre de VS Code por diseño de SwarmForge, pero falta diseñar en detalle qué pasa
si el proceso `handoffd.bb` murió mientras VS Code estaba cerrado.

## Fase 10 — Panel de ejecución

Sin cambios respecto a la v1, sin revisión detallada todavía.

## Fase 11 — Preflight de seguridad

Se mantiene la lista de la v1 (verificar `git`/`tmux`/`bb`/CLIs, workspace es repo git, cambios
sin commit, espacio en disco, versión fijada del runtime, no guardar secretos, enmascarar
variables sensibles). Ver [`04-riesgos.md`](./04-riesgos.md) para riesgos adicionales
descubiertos en esta auditoría que deberían sumarse a esta checklist cuando se implemente.

## Fase 12 — Pruebas

Se mantiene la estructura de la v1 (unitarias, integración, E2E). Sin revisión detallada
todavía — falta, en particular, un smoke test de contrato contra una instalación real de
SwarmForge antes de cada entrega, no sólo tests contra mocks del protocolo asumido.

## Orden de entregas (MVP) — revisado

La v1 proponía: (1) MVP con los tres packs ejecutables, (2) Human in the Loop, (3) AI in the
Loop, (4) endurecimiento. Se ajusta el orden interno del MVP para priorizar lo de menor riesgo y
más fácil de verificar de forma aislada primero:

1. **Terminal adapter de VS Code** (Fase 5+6) contra un swarm nativo de SwarmForge, sin tocar
   nada de Agent Studio todavía — se puede probar como script standalone.
2. **Import de packs + generador de config** (Fases 1, 3, 4) — modelo de datos, catálogo de
   templates, generador `.agent-studio/runs/<run-id>/`.
3. **Idioma de interacción** (Fase 2) — independiente de todo lo anterior, se puede hacer en
   paralelo.
4. **Handoffs automáticos end-to-end** conectando 1+2+3 dentro de la extensión.
5. **Human-in-the-Loop** (Fase 7) vía wrapper de PATH.
6. **AI-in-the-Loop** (Fase 8) vía role reviewer + mismo wrapper.
7. **Endurecimiento**: estado/recuperación (Fase 9), panel (Fase 10), preflight (Fase 11),
   pruebas (Fase 12).

El criterio para este reordenamiento: el terminal adapter es 100% verificable de forma aislada
(¿se abre una terminal de VS Code o no?) y no depende de ninguna otra pieza del plan, mientras
que la v1 lo ponía después de un "modo headless" que no existe. Empezar por ahí valida el punto
de mayor incertidumbre técnica (¿se puede realmente hablar con SwarmForge desde fuera sin
tocarlo?) antes de invertir en modelo de datos y UI.
