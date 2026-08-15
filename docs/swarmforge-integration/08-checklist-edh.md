# Checklist EDH reproducible

Esta checklist complementa la matriz de [`07-plan-pruebas.md`](./07-plan-pruebas.md). Distingue
las barreras automáticas de los smokes que necesitan un Extension Development Host (EDH) real.
No requiere credenciales para los pasos de UI; los dos smokes de proveedor usan una tarea mínima
y pueden consumir cuota de Claude/Codex.

## Barreras automáticas

Desde la raíz del repositorio:

```sh
npm test
npm run build
npm run check
git diff --check
```

- `npm test` compila los tests TypeScript con esbuild y los ejecuta con `node --test`. Cubre
  constructor de prompts Chat/workflow, idioma, templates y recuperación de manifests.
- `npm run check` debe terminar sin errores. Si falla, la IA debe registrar el error y no declarar
  aprobado el cambio; no se acepta un fallo de tipos como deuda conocida.

## Workspace de prueba

1. Crear una carpeta temporal e inicializar git: `git init`.
2. Abrirla en un EDH iniciado con F5 desde Agent Studio y confirmar Workspace Trust.
3. Para no gastar cuota en un preflight positivo, configurar temporalmente
   `agentStudio.cli.claudeCommand: "true"`; `true --version` retorna 0. Restaurar el comando
   normal antes de un smoke Claude.

## Templates y grafo

1. Command Palette → `Agent Studio: Create Workflow` → Repository.
2. Crear Two-Pack, Four-Pack y Six-Pack; comprobar nodes, edges y gates en el grafo y en los JSON.
3. Crear un template en Global; confirmar el JSON en `~/.agents/workflows/` y que el dashboard lo
   lista. Repetir un nombre para confirmar un sufijo numérico en vez de sobrescritura.
4. Comprobar que los agents existentes no se reescriben al crear un segundo pack.

## Preflight

1. Configurar una CLI inexistente, tocar Run Workflow y comprobar error antes del objetivo y sin
   manifest nuevo.
2. Con un repo sucio y una CLI disponible, comprobar que aparece directamente el objetivo, sin
   aviso de cambios sin commit.
3. El warning de carpeta sin git se mantiene fuera de esta checklist hasta resolver `BUGS.md` #4.

## Idioma y proveedores

1. Poner `agentStudio.interactionLanguage: "en"`, seleccionar un nodo y guardar
   `languageOverride: "es"`; cambiar el locale del dashboard y comprobar que no muta el override.
2. Correr una tarea mínima con Codex CLI: debe abrirse una terminal integrada por nodo con la TUI
   normal de Codex visible. Confirmar que el prompt aparece dentro de Codex —no pegado en una
   shell vacía— y registrar la respuesta/estado final.
3. Para Claude, verificar el archivo `step-<node>-prompt.txt` del run; contiene la misma
   instrucción antes de ser enviado al CLI. Si se quiere validar completion, dejar que Claude
   escriba el marcador final en vez de recargar el EDH.

## Accesibilidad, regiones contraíbles y movimiento

1. En un workflow abierto, contraer y restaurar **Agent Rail**, **Workflow toolbar**,
   **Minimap** y **Run status**. Recargar el dashboard y comprobar que cada estado persiste;
   con una corrida activa y Run status contraído, comprobar que el control compacto de detener
   sigue disponible.
2. Usar teclado para seleccionar un nodo y un enlace, activar el control de handoff, y operar
   zoom/Fit graph/minimapa. Confirmar foco visible, nombre accesible y un efecto observable por
   cada acción. Probar paneo, arrastre y cancelación de arrastre con Pointer Events.
3. Lanzar una corrida inocua de al menos dos pasos. Mientras el primer nodo está `running`, la
   arista debe ser `graph-edge-running` y no debe existir viajero. Al completar ese nodo y
   arrancar el segundo, verificar el viajero de `graph-edge-handoff-flow`, el nodo previo
   completado, el siguiente en ejecución y el reflejo de ambos estados en minimapa/Run status.
4. Cuando sea posible emular `prefers-reduced-motion`, verificar que no se ejecuten la entrada,
   pulso, viajero ni spinner. Si la automatización no puede emularlo dentro del webview, registrar
   el selector CSS inspeccionado y la limitación en la evidencia de QA.

## Recuperación

1. Iniciar una corrida CLI real y, mientras el step está `running`, ejecutar
   `Developer: Reload Window`.
2. Confirmar que el manifest cambia a `interrupted`, el step activo queda `interrupted`, no se
   crea un nuevo run y el dashboard dice que es sólo para inspección, sin Resume/Retry.
