# Fase 10 — Plan de pruebas

## Regla de evidencia

Una fase no se marca confirmada por lectura de código ni por un script aislado solamente. Cada
cambio debe registrar el comando o escenario ejecutado, su resultado observable y, cuando toque
la extensión, evidencia en un **Extension Development Host** (EDH) real. Los mocks reducen el
tiempo de diagnóstico, pero no sustituyen la prueba de los límites con VS Code, procesos y
webviews.

## Niveles de prueba

| Nivel | Objetivo | Ejemplos |
|---|---|---|
| Unitario | Lógica pura, rápida y determinista | normalización de templates, resolución de idioma, migración de manifests |
| Integración | Servicios contra APIs de VS Code simuladas o fixtures | preflight, persistencia atómica de manifests, scheduler DAG |
| Smoke EDH | Flujo real de la extensión | Command Palette, dashboard, creación de terminales, app-server de Codex |
| Regresión manual | Comportamiento que depende de CLIs o UI real | handoff humano, cancelación, recuperación tras reinicio |

Las pruebas automáticas deben vivir junto al código que cubren y no depender de credenciales ni
de prompts de proveedores. Las pruebas que sí invocan `claude` o `codex` son opt-in y documentan
claramente sus efectos, coste y prerequisitos.

## Matriz mínima por fase

### Fase 2 — Idioma de interacción

- En EDH, cambiar el idioma visual no modifica la preferencia `agentStudio.interactionLanguage`.
- Con interacción en español, verificar el texto de instrucción que llega a Chat, Claude y Codex;
  con interacción en inglés, verificar el caso inverso.
- Elegir un override por nodo, guardar el workflow, recargarlo y confirmar que sólo ese nodo usa
  el idioma distinto del workspace.

### Fase 3 — Templates

- Crear Two-Pack, Four-Pack y Six-Pack desde `Agent Studio: Create Workflow` en scopes Repository
  y Global cuando cada scope sea aplicable.
- Confirmar nombres, agentes creados/reutilizados, grafo y gates persistidos; comprobar el caso
  de colisión sin sobrescribir un agent existente.
- Abrir los workflows creados y validar que todos son DAGs lineales de un solo pase.

### Fase 7 — Estado y recuperación

- Cerrar el EDH durante un step Claude, Codex y una aprobación humana; al reabrir, verificar que
  el manifest se lee y la corrida queda `interrupted` sin crear terminal ni iniciar app-server.
- Confirmar que steps `completed` se preservan, activos pasan a `interrupted` y pendientes a
  `skipped`; una corrida terminal conserva `completed` o `failed` sin mutarse.
- Introducir un manifest JSON corrupto y comprobar que se informa un warning sin impedir abrir el
  dashboard ni lanzar una corrida nueva.
- Verificar explícitamente que la UI de una corrida recuperada no ofrece Resume/Retry y que no se
  envía ningún prompt durante la activación de la extensión.

### Fase 9 — Preflight

- Configurar `agentStudio.cli.claudeCommand` con un ejecutable inexistente y comprobar que el
  blocker aparece antes del panel de objetivo y que no se crea una corrida.
- Abrir una carpeta que no sea repositorio git y verificar el warning Continue/Cancel real.
- Ensuciar deliberadamente un repositorio y confirmar que el run sigue hasta el objetivo sin
  ningún warning de cambios sin commit.

### Motor, terminales y handoffs

- Mantener un smoke opt-in para una corrida real con Claude y otra con Codex app-server, incluyendo
  el resultado del step y el estado final del DAG.
- Verificar paralelismo de nodos sin dependencia, orden topológico de nodos dependientes,
  cancelación, fallo y un handoff humano que no avanza hasta aprobarlo.
- Los cuatro bugs diferidos de `BUGS.md` se prueban sólo cuando el usuario autorice abordarlos; no
  forman parte del criterio de salida de las fases anteriores.

## Automatización y cierre

1. Añadir tests unitarios e integración a `npm test` cuando cada servicio tenga una frontera
   testeable; mantener `npm run build`, `npm run check` y `git diff --check` como barreras básicas.
2. Mantener una checklist EDH versionada con comandos, workspace temporal y resultado de cada
   smoke test para que otra sesión pueda reproducirlo.
3. Antes de declarar una fase cerrada, enlazar en `PROGRESS.md` el resultado real y distinguir
   con precisión entre automatizado, validado en EDH y pendiente.
