# Arquitectura: Human-in-the-Loop, y IA-en-el-loop como nodo del grafo

**Revisado (2026-08-09).** La versión anterior de este documento definía un tercer modo de edge,
`ai-review` (más `human-or-ai`), donde `WorkflowRunManager` invocaba a un `reviewerAgentId`
configurado en el edge, esperaba una respuesta JSON estructurada (`{decision, confidence, ...}`),
y **actuaba automáticamente** según esa decisión (aprobar, pedir cambios, escalar a humano). El
usuario pidió simplificar esto: `HandoffMode` queda en sólo dos valores, `automatic` y `human`, y
"IA en el loop" se resuelve modelando al revisor como **un nodo más del grafo**, no como un
mecanismo especial de runtime. La versión descartada queda documentada abajo en "Qué se
eliminó y por qué", no borrada del todo, porque el razonamiento de por qué era riesgosa sigue
siendo útil.

## Por qué esto es más simple que el diseño anterior (vía SwarmForge) y más seguro que el diseño anterior de este mismo documento

El diseño vía SwarmForge (descartado, ver
[`_archive-motor-swarmforge-descartado/`](./_archive-motor-swarmforge-descartado/)) necesitaba
interceptar `swarm_handoff.sh` con un wrapper de `PATH` porque el daemon de SwarmForge era un
proceso externo que entregaba handoffs sin gate. En el motor nativo no hay ningún proceso externo:
`WorkflowRunManager` decide, en su propio código TypeScript, cuándo enviarle el prompt al
siguiente nodo — así que Human-in-the-Loop es, literalmente, "no enviar el prompt todavía".

El diseño anterior de *este* documento (con `ai-review`) resolvía "IA en el loop" agregando una
segunda cosa: el motor le pedía a un agente una decisión estructurada y **confiaba en esa
decisión para ramificar automáticamente el workflow** (aprobar/rechazar/escalar). Eso es un
problema de una clase distinta al de escaping de shell: es el motor tratando la salida de un
agente —texto no confiable por definición, más aún si el agente anterior en la cadena fue quien
generó parte de ese contenido— como si fuera una instrucción de control válida. Quitar `ai-review`
como modo de edge elimina esa clase de riesgo de raíz, no la mitiga.

## Flujo

Cuando un nodo termina su turno (ver Fase 5 / `02-arquitectura-motor-nativo.md` para cómo se
detecta eso), `WorkflowRunManager` mira el `handoff.mode` de cada edge saliente de ese nodo antes
de avanzar:

- **`automatic`**: arma el prompt para el/los nodo(s) destino y lo envía de inmediato a su(s)
  terminal(es) — igual que como lo presenta SwarmForge (un handoff sin gate).
- **`human`**: el paso pasa a estado `waiting_approval`. La UI de Agent Studio muestra un panel
  con: agente origen, agente(s) destino, el output completo del turno que acaba de terminar
  (capturado vía Shell Integration, que también expone el stream de output del comando), y
  acciones: aprobar, aprobar con instrucciones adicionales, redirigir a otro nodo, rechazar (el
  workflow queda pausado o vuelve al nodo origen, a definir en la Fase 7), cancelar el run
  completo. El run manager sólo arma y envía el prompt siguiente después de una acción de
  aprobación **hecha por el usuario en la UI** — nunca por una decisión automática de otro agente.

Timeout: si `timeoutSeconds` está configurado en el edge y nadie aprueba/rechaza a tiempo,
`onTimeout` decide (`wait` deja el paso indefinidamente pendiente, `reject` lo devuelve al nodo
origen, `approve` avanza igual, `fail` termina el run con error).

## Cómo se modela "IA en el loop" (sin un tercer modo de edge)

Si el usuario quiere que un agente revise el trabajo de otro antes de continuar, simplemente lo
agrega como un nodo normal del grafo:

```text
coder --automatic--> reviewer --human--> cleaner
```

`reviewer` recibe el output del `coder` como su prompt de entrada, exactamente igual que
recibiría el output de cualquier otro nodo predecesor (no hay un "modo especial de invocación
para revisores" — es el mismo mecanismo de turno/prompt que usa cualquier nodo). El usuario decide,
con el edge que sale de `reviewer`, qué tan estricto quiere ser: `automatic` si confía en que el
reviewer haga bien su trabajo y el siguiente paso puede arrancar solo, o `human` si quiere ver la
revisión antes de que el workflow siga. Esto le da al usuario el control explícito que antes
estaba escondido en reglas de `confidence`/categorías de riesgo dentro del motor — ahora es una
decisión de diseño del workflow, visible en el grafo, no una regla implícita del runtime.

Lo que esto **no** da (y es una limitación real, no una omisión): no hay ningún mecanismo
automático de "si la IA tiene baja confianza, escalar a humano" — si el usuario quiere ese
comportamiento, tiene que modelarlo él mismo poniendo el edge de salida del reviewer en `human`
siempre, no de forma condicional. Automatizar esa condicionalidad de forma segura (sin volver a
introducir el problema de confiar en la salida de un agente para tomar decisiones de control) es
un problema no resuelto, deliberadamente fuera de alcance por ahora.

## Qué se eliminó y por qué (histórico, no vigente)

La versión anterior tenía: `mode: "ai-review" | "human-or-ai"`, un campo `reviewerAgentId` en el
edge, un contrato JSON de decisión (`{decision, confidence, summary, risks, instructions}`), y
reglas fijas del lado de Agent Studio ("nunca aprobar automático lo destructivo", "baja confianza
→ humano", "cambios de seguridad/infraestructura → humano"). Se eliminó todo esto porque requería
que el motor **parseara y actuara sobre** contenido generado por un agente para decidir el flujo
de ejecución — el mismo tipo de confianza mal ubicada que ya se había identificado como riesgo
para el caso más simple de construir un `commandLine` de shell a partir de texto de agente (ver
`05-riesgos.md`). Modelar al revisor como nodo normal logra el mismo resultado observable ("un
agente de IA revisa antes de continuar") sin que el motor tenga que confiar en nada estructurado
que un agente le devuelva.

## Qué riesgo sigue vigente (a diferencia del anterior)

El control de flujo vive enteramente en el proceso de la extensión de VS Code. Si ese proceso
muere o VS Code se cierra a mitad de un `waiting_approval`, el estado pendiente sólo existe si se
persistió explícitamente (Fase 7, sin cerrar todavía) — a diferencia del diseño con SwarmForge,
donde el estado de handoffs vivía en archivos en disco (`outbox`/`inbox`) independientes del
proceso de la extensión. Este es el motivo por el que la Fase 7 (estado y recuperación) sigue
siendo más importante en el motor nativo de lo que era en el diseño con SwarmForge — hay que
persistir cada `waiting_approval` en disco (ej. dentro de `.agent-studio/runs/<run-id>/`) apenas
ocurre, no sólo mantenerlo en memoria del proceso de la extensión.

El riesgo general de escaping/inyección al construir el `commandLine` de la invocación one-shot
(Fase 5) **sigue vigente y no depende de si hay un reviewer de por medio o no** — cualquier
handoff `automatic`, incluso entre dos nodos "normales", pasa el output de un turno como parte del
prompt del siguiente. Ver el tratamiento actualizado en `02-arquitectura-motor-nativo.md` y
`05-riesgos.md`.
