# Arquitectura: estados visuales de ejecución en el grafo

Confirma y detalla la Fase 8 (panel de ejecución) de `01-plan-revisado.md`. El usuario pidió,
sobre la base de que `runWorkflow` va a pasar a marcar "completado" cuando el agente realmente
termina (no al enviar el prompt, ver Fase 5), que el grafo muestre visualmente: qué agente está
corriendo ahora (con movimiento), un color para lo que ya terminó, y un color distinto para lo
que sigue en la cola.

## Punto de partida real (código existente)

Hoy, en `webview/app/components/GraphCanvas.tsx`, hay dos superficies que ya conocen el estado de
un run pero están sub-aprovechadas:

1. **El panel lateral `graph-run-panel`** (línea ~496): una lista de pasos con un punto de color
   por `.graph-run-step-mark` (clases `ready`, `running`, `failed` en `webview/app/styles.css`
   línea ~1380). No hay clase `completed` propia (reusa `ready`), no hay clase para "próximo", y
   no hay ninguna animación.
2. **Los nodos del grafo (`.graph-node`, línea ~701 de `GraphCanvas.tsx`)**: hoy sólo tienen las
   clases `selected` y `entry`. **No reciben ningún color de estado de ejecución** — mirar el
   grafo mientras corre un workflow no dice hoy qué nodo está activo. Esta es la superficie que
   más importa para lo que pide el usuario: ver, en el propio grafo, quién está corriendo.

El diseño de abajo extiende ambas superficies con la misma fuente de verdad (`WorkflowRunStep.status`),
para que el panel lateral y los nodos del grafo siempre muestren lo mismo.

## Modelo de estado (`WorkflowRunStep.status`)

Estado actual en `src/domain/messages.ts` y `webview/app/types.ts`:

```ts
status: "pending" | "running" | "completed" | "failed" | "skipped";
```

Se extiende a:

```ts
status:
  | "pending"           // no alcanzable todavía (predecesores sin terminar)
  | "queued"            // NUEVO — predecesores resueltos, es el próximo en recibir el prompt
  | "running"           // turno en curso — animado
  | "waiting_approval"  // pausado por handoff humano (Fase 6)
  | "completed"         // terminó con éxito (exit code 0 real, no "prompt enviado")
  | "failed"            // terminó con error
  | "skipped";          // no se ejecuta por fallo upstream
```

`queued` es el estado nuevo que pide el usuario ("siguiente en ejecución"): distinto de `pending`
porque **ya está listo para arrancar** — sus predecesores terminaron, sólo falta que
`WorkflowRunManager` le envíe el prompt (lo cual puede tardar si hay un handoff `human` de por
medio, ver Fase 6). Puede haber más de un nodo `queued` a la vez si el workflow tiene ramas
paralelas.

`waiting_approval` ya estaba previsto en el diseño de la Fase 6; se lista acá para que el mapeo de
color quede completo en un solo lugar. No hay un estado separado para "revisor de IA" — desde que
Fase 6 se simplificó (`03-arquitectura-handoff-control.md`), un nodo revisor es un nodo normal del
grafo y pasa por los mismos estados que cualquier otro (`queued` → `running` → `completed`).

## Mapeo de color (tokens de VS Code, sin inventar paleta nueva)

Usar los tokens semánticos de "charts" que VS Code ya expone (se adaptan solos a cualquier tema,
claro u oscuro, sin trabajo extra):

| Estado | Token de color | Animación |
|---|---|---|
| `pending` | `var(--vscode-descriptionForeground)` (gris, baja opacidad) | ninguna |
| `queued` | `var(--vscode-charts-orange, #d18616)` | ninguna — color sólido, para distinguirlo de `running` a simple vista |
| `running` | `var(--studio-accent)` (ya usado hoy para "running" en el panel lateral) | **pulso** — ver abajo |
| `waiting_approval` | `var(--vscode-charts-yellow, #d7ba7d)` | ninguna |
| `completed` | `var(--vscode-charts-green)` | ninguna |
| `failed` | `var(--vscode-charts-red, #f85149)` | ninguna |
| `skipped` | `var(--vscode-descriptionForeground)`, opacidad reducida | ninguna |

Sólo `running` tiene movimiento — es intencional: si todo animara, ningún estado se leería como
"el que está pasando ahora mismo". `queued` es un color sólido y distinto (naranja) precisamente
para que no se confunda con `running` (acento) a primera vista, que es la distinción concreta que
pidió el usuario.

## CSS propuesto

```css
.graph-node.run-queued {
  border-color: var(--vscode-charts-orange, #d18616);
  box-shadow: 0 0 0 1px var(--vscode-charts-orange, #d18616);
}

.graph-node.run-running {
  border-color: var(--studio-accent);
  animation: graph-node-pulse 1.6s ease-in-out infinite;
}

.graph-node.run-completed {
  border-color: var(--vscode-charts-green);
}

.graph-node.run-failed {
  border-color: var(--vscode-charts-red, #f85149);
}

.graph-node.run-waiting-approval {
  border-color: var(--vscode-charts-yellow, #d7ba7d);
}

.graph-node.run-skipped {
  opacity: 0.5;
}

@keyframes graph-node-pulse {
  0%, 100% { box-shadow: 0 0 0 2px color-mix(in srgb, var(--studio-accent) 55%, transparent); }
  50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--studio-accent) 15%, transparent); }
}

@media (prefers-reduced-motion: reduce) {
  .graph-node.run-running {
    animation: none;
    box-shadow: 0 0 0 2px var(--studio-accent);
  }
}
```

El pulso anima `box-shadow` (no `transform`/tamaño), para no mover ni redimensionar el nodo
mientras el usuario puede estar arrastrando otros nodos del grafo — evita que la animación
interfiera con el drag-and-drop que ya existe. Se respeta `prefers-reduced-motion` con un estado
estático equivalente (accesibilidad, no opcional).

Las clases del panel lateral (`graph-run-step-mark`) se extienden igual, reusando los mismos
tokens, para que panel y grafo nunca queden en colores distintos para el mismo estado:

```css
.graph-run-step-mark.queued { background: var(--vscode-charts-orange, #d18616); border-color: var(--vscode-charts-orange, #d18616); }
.graph-run-step-mark.completed { background: var(--vscode-charts-green); border-color: var(--vscode-charts-green); }
.graph-run-step-mark.waiting-approval { background: var(--vscode-charts-yellow, #d7ba7d); border-color: var(--vscode-charts-yellow, #d7ba7d); }
```
(`ready`, `running`, `failed` ya existen y se mantienen.)

## Cómo se calcula `queued` en `WorkflowRunManager`

No es un estado que el usuario elige ni que se infiere sólo mirando el grafo estático — depende
de la ejecución real: un nodo pasa a `queued` en el momento en que **todas** sus aristas
entrantes provienen de nodos en estado `completed` (o la arista no tiene predecesor, es el nodo de
entrada) y el propio nodo todavía no recibió su prompt. Esto se recalcula cada vez que un nodo
pasa a `completed`, antes de que `WorkflowRunManager` decida si dispara el siguiente turno de
inmediato (`automatic`) o lo deja pausado por un handoff (`waiting_approval`, Fase 6) — en ese
segundo caso el nodo destino permanece visualmente en `queued` hasta que el handoff se resuelve,
momento en el que recién pasa a `running`.

## Qué falta decidir (no cerrado en esta pasada)

- Si `queued` debe distinguir visualmente "el próximo va a arrancar apenas termine el turno
  actual" de "el próximo está esperando aprobación humana" — hoy el diseño de arriba resuelve
  esto último con un estado aparte (`waiting_approval`), así que `queued` puro sólo debería darse
  en la práctica de forma muy breve (el instante entre que el predecesor termina y
  `WorkflowRunManager` decide el próximo paso) — a confirmar si vale la pena mostrarlo como estado
  propio o si conviene fusionarlo visualmente con `waiting_approval` cuando aplica.
- El pulso de `running` no se prototipó todavía contra un grafo real con varios nodos animados a
  la vez (rendimiento con muchos nodos en paralelo, ej. six-pack) — `box-shadow` animado es barato
  en la mayoría de los navegadores modernos pero conviene confirmarlo en el prototipo de Fase 5
  antes de darlo por sentado con 6+ nodos simultáneos.
