# Arquitectura: Human-in-the-Loop / AI-in-the-Loop in-process

## Por qué esto es mucho más simple que el diseño anterior (vía SwarmForge)

El diseño descartado (ver
[`_archive-motor-swarmforge-descartado/`](./_archive-motor-swarmforge-descartado/)) necesitaba
interceptar `swarm_handoff.sh` con un wrapper de `PATH` porque el daemon de SwarmForge
(`handoffd.bb`, un proceso externo que Agent Studio no controla) entregaba los handoffs
automáticamente sin ningún gate. Ese wrapper tenía un límite honesto: un agente que invocara el
script real por ruta absoluta podía saltárselo.

En el motor nativo, **no hay ningún proceso externo de por medio**. `WorkflowRunManager` es quien
decide, en su propio código TypeScript, cuándo enviarle el siguiente prompt al siguiente nodo.
Human-in-the-Loop deja de ser "interceptar una entrega que iba a pasar igual" y pasa a ser,
literalmente, "no enviar el prompt todavía" — no hay nada que un agente pueda saltarse, porque el
agente del nodo siguiente no tiene ningún prompt esperándolo hasta que el run manager decide
enviarlo.

## Flujo

Cuando un nodo termina su turno (ver Fase 5 / `02-arquitectura-motor-nativo.md` para cómo se
detecta eso), `WorkflowRunManager` mira el `handoff.mode` de cada edge saliente de ese nodo antes
de avanzar:

- **`automatic`**: arma el prompt para el/los nodo(s) destino y lo envía de inmediato a su(s)
  terminal(es).
- **`human`**: el paso pasa a estado `waiting_approval`. La UI de Agent Studio muestra un panel
  con: agente origen, agente(s) destino, el output completo del turno que acaba de terminar
  (capturado vía Shell Integration, que también expone el stream de output del comando), y
  acciones: aprobar, aprobar con instrucciones adicionales, redirigir a otro nodo, rechazar (el
  workflow queda pausado o vuelve al nodo origen, a definir en la Fase 7), cancelar el run
  completo. El run manager sólo arma y envía el prompt siguiente después de una acción de
  aprobación.
- **`ai-review`**: el run manager arma un prompt de revisión para el `reviewerAgentId` configurado
  en el edge (puede correr en su propia terminal visible, igual que cualquier otro nodo, o
  invocarse de forma más liviana si el proveedor lo permite) pidiéndole una respuesta estructurada:

  ```json
  {
    "decision": "approve" | "request_changes" | "escalate_to_human" | "fail",
    "confidence": 0.0,
    "summary": "...",
    "risks": ["..."],
    "instructions": ["..."]
  }
  ```

  Reglas fijas del lado de Agent Studio (no delegadas al reviewer): nunca tratar como aprobación
  automática una decisión con `confidence` por debajo de un umbral configurable, y ciertas
  categorías de cambio (definidas por el usuario al configurar el edge — ej. cambios que tocan
  CI/CD, infraestructura, o ramas protegidas) siempre escalan a `human` sin importar la decisión
  del reviewer.
- **`human-or-ai`**: corre primero el flujo `ai-review`; si la decisión es `escalate_to_human` (o
  cae en alguna de las reglas fijas de arriba), continúa con el flujo `human`.

Timeout: si `timeoutSeconds` está configurado en el edge y nadie aprueba/rechaza a tiempo,
`onTimeout` decide (`wait` deja el paso indefinidamente pendiente, `reject` lo devuelve al nodo
origen, `approve` avanza igual, `fail` termina el run con error) — misma idea que ya traía el
plan original, sin cambios porque no depende del runtime.

## Qué reemplaza y qué se mantiene del plan original

Se mantiene igual: los estados de UI del panel de aprobación, las acciones disponibles, el
contrato JSON del reviewer, las reglas de "nunca aprobar automático lo destructivo" / "baja
confianza → humano" / "cambios de seguridad o infraestructura → humano".

Se elimina por completo: el socket Unix, el protocolo `open-session`/`handoff-approval-request`,
el wrapper de `PATH` sobre `swarm_handoff.sh`, y toda la documentación de "límite honesto" sobre
que un agente puede saltarse el gate por ruta absoluta — ese riesgo específico no existe en este
diseño, porque no hay ningún script externo que un agente pueda invocar para saltarse el control.

## Qué riesgo nuevo introduce este diseño (a diferencia del anterior)

El control de flujo vive enteramente en el proceso de la extensión de VS Code. Si ese proceso
muere o VS Code se cierra a mitad de un `waiting_approval`, el estado pendiente sólo existe si se
persistió explícitamente (Fase 7, sin cerrar todavía) — a diferencia del diseño con SwarmForge,
donde el estado de handoffs vivía en archivos en disco (`outbox`/`inbox`) independientes del
proceso de la extensión. Este es el motivo por el que la Fase 7 (estado y recuperación) pasa a
ser más importante en el motor nativo de lo que era en el diseño anterior, no menos — hay que
persistir cada `waiting_approval` y cada decisión de reviewer en disco (ej. dentro de
`.agent-studio/runs/<run-id>/`) apenas ocurren, no sólo mantenerlos en memoria del proceso de la
extensión.
