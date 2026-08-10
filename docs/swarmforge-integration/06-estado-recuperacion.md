# Fase 7 — Estado y recuperación de corridas interactivas

## Decisión

Una corrida que estaba activa cuando VS Code o la extensión se cerró se conserva para
**inspección** y se marca como `interrupted`. Nunca se reintenta automáticamente ni se despacha
un nodo pendiente al recuperar.

La decisión responde a la naturaleza actual del motor: Claude vive en una terminal interactiva y
Codex en un proceso `app-server` propiedad del Extension Host. Ninguno ofrece un contrato seguro
para reconectarse después de que ese host desaparece. Reintentar sin intervención podría duplicar
ediciones, repetir una operación externa o violar la expectativa del scheduler DAG de que cada
nodo se ejecuta una vez por corrida.

Si el usuario quiere continuar el trabajo, crea deliberadamente una nueva corrida con un objetivo
que incluya el contexto necesario. La corrida recuperada conserva evidencia; no es una cola de
trabajo reanudable.

## Manifest durable

Cada corrida CLI escribe atómicamente
`.agent-studio/runs/<run-id>/manifest.json` bajo el workspace. El manifest incluye:

- `version`, `runId`, `workflowId`, nombre y snapshot del workflow al comenzar;
- modo, objetivo, timestamps y estado de la corrida;
- snapshot mínimo de cada step (`nodeId`, `agentId`, nombre, estado, mensaje), más su output si
  existe;
- referencia a los archivos de prompt/marker ya escritos por el runner interactivo.

No persiste secretos, contenido de terminal no solicitado, procesos/PIDs reutilizables ni una
promesa de approval pendiente. El objetivo se conserva porque es parte de la intención explícita
del usuario y permite inspeccionar qué se pidió; si en el futuro se permite ocultarlo, el
manifest deberá guardar sólo una referencia/redacción, no inventar una recuperación parcial.

La escritura usa archivo temporal + rename para no dejar JSON a medias ante un cierre abrupto.
Cada publicación de estado del scheduler actualiza el manifest; completada, fallida o detenida
queda inmutable salvo migración de formato.

## Recuperación al activar la extensión

1. Se listan manifests del workspace actual; un JSON malformado se ignora con warning, sin
   bloquear la extensión.
2. Los manifests terminales (`completed`, `failed`, `interrupted`) se muestran como historial de
   inspección.
3. Un manifest `running`, o steps `running`/`queued`/`waiting_approval`, se transforma y se
   reescribe como `interrupted`: los pasos ya `completed` se preservan, los activos quedan
   `interrupted`, y los que no habían comenzado quedan `skipped` con el mensaje de que la corrida
   fue interrumpida al cerrar VS Code.
4. El dashboard puede seleccionar una corrida recuperada y ver su objetivo, estados y outputs.
   No muestra botones Resume/Retry; sólo permitiría abrir archivos de evidencia o iniciar una
   corrida nueva desde el workflow normal.

## Compatibilidad y límites

- El modelo de workflow mantiene su regla DAG por corrida. Una nueva corrida posterior tiene un
  `runId` nuevo y no altera ni reabre los nodos de la anterior.
- Un proceso Claude o Codex que casualmente sobreviva fuera del host no se adopta: no hay una
  identidad ni un historial confiables para hacerlo seguro.
- La recuperación no cambia `handoff.mode`: una aprobación pendiente nunca se autoaprueba tras
  reiniciar.
- La retención/limpieza de manifests se define después de tener uso real; esta fase no borra
  historial automáticamente.

## Criterios de aceptación

- Cierre/reapertura durante un step deja un manifest legible y el dashboard lo muestra como
  `interrupted` sin lanzar CLI ni crear terminal/app-server.
- Los steps completados siguen visibles; los activos y pendientes explican por qué no continúan.
- Un manifest corrupto no impide abrir el dashboard ni correr otro workflow.
- Las corridas `completed` y `failed` sobreviven sin cambiar sus estados.
- Ninguna ruta de recuperación envía prompts ni reintenta nodos automáticamente.
