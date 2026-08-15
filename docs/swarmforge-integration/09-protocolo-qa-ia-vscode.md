# Protocolo de QA para IA dentro de VS Code

Esta es la guía operativa para una IA que cambie Agent Studio. La aceptación de
una extensión de VS Code se hace en un **Extension Development Host** (EDH)
real; un navegador o el harness de Vite sólo sirve para diagnosticar el webview
durante el desarrollo. No sustituye la prueba dentro de VS Code.

La evidencia de la validación que originó este protocolo está en
[`../../reports/graph-accessibility-qa-validation-2026-08-15.md`](../../reports/graph-accessibility-qa-validation-2026-08-15.md).

## Regla de salida

Una IA sólo puede marcar un cambio de interfaz o de ejecución como aprobado si:

1. Pasan las barreras automáticas aplicables.
2. Abre el dashboard mediante la Command Palette de un EDH aislado.
3. Ejecuta los controles o el flujo afectado dentro del webview de ese EDH.
4. Guarda evidencia observable: comando, resultado, captura y cualquier
   limitación.

Si no puede iniciar VS Code, debe informar el bloqueo. No debe reemplazar ese
paso por una prueba de `http://localhost` ni afirmar que la extensión quedó
validada.

## 1. Preparar y verificar el árbol

Desde la raíz del repositorio, antes de abrir el host:

```sh
npm install
npm run check
npm test
npm run build
git diff --check
```

`npm run lint` se puede ejecutar como señal adicional. La configuración actual
de ESLint 9 busca `eslint.config.*`, mientras el proyecto conserva
`.eslintrc.cjs`; por eso ese comando no es una barrera de aceptación hasta que
se migre la configuración. Esta excepción no cubre `check`, tests ni build.

## 2. Levantar un Extension Development Host aislado

Nunca cerrar ni reutilizar la ventana normal de VS Code de la persona. Crear un
perfil temporal, recordar el PID del proceso iniciado y elegir un puerto de
depuración libre.

```sh
QA_EDH_ROOT="$(mktemp -d /tmp/agent-studio-edh-XXXXXX)"
QA_EDH_PORT=9233
mkdir -p "$QA_EDH_ROOT/user-data" "$QA_EDH_ROOT/extensions"

setsid /usr/share/code/code --disable-gpu --disable-gpu-sandbox \
  --remote-allow-origins='*' \
  --user-data-dir "$QA_EDH_ROOT/user-data" \
  --extensions-dir "$QA_EDH_ROOT/extensions" \
  --extensionDevelopmentPath "$PWD" \
  --remote-debugging-port="$QA_EDH_PORT" \
  "$PWD" >"$QA_EDH_ROOT/vscode.log" 2>&1 &
QA_EDH_PID=$!

until curl --fail --silent "http://127.0.0.1:$QA_EDH_PORT/json/version" >/dev/null; do
  sleep 1
done
```

`setsid` evita que el EDH temporal se cierre junto con la shell de automatización.
Los flags de GPU fueron necesarios en el equipo Linux de QA donde se validó este
protocolo; en un entorno gráfico que no los necesite pueden omitirse. Para una
prueba manual también se puede usar **F5** desde esta carpeta, pero la IA debe
usar un perfil aislado para no mezclar extensiones, configuración ni ventanas
personales.

## 3. Abrir y observar la extensión

Usar automatización de escritorio/VS Code, por ejemplo `agent-browser`, conectada
al puerto del EDH:

```sh
agent-browser connect "$QA_EDH_PORT"
agent-browser snapshot -i
```

En la ventana recién creada abrir **Quick Access** o la Command Palette, ejecutar
`Agent Studio: Open Dashboard` y abrir el workflow que cubra el cambio. La
captura debe mostrar el marco de VS Code, no sólo el contenido servido por Vite.

Los webviews de VS Code están anidados en un `iframe`. Si la herramienta no
puede pulsar controles dentro de él directamente, la IA debe inspeccionarlo a
través del DevTools Protocol del mismo EDH y accionar los elementos del
`contentDocument` del `iframe`. Eso sigue siendo una prueba del webview real;
no se debe cambiar a un navegador externo como atajo.

## 4. Matriz mínima de interacción

Realizar sólo los escenarios relevantes al cambio, y siempre añadir los que se
enumeran si se modificó el grafo o la ejecución.

| Área | Acción en el EDH | Resultado exigido |
| --- | --- | --- |
| Apertura | `Agent Studio: Open Dashboard` | Dashboard y workflow visibles, sin error de activación. |
| Grafo | Seleccionar nodo, enlace, zoom y `Fit graph`; probar teclado si se modificó interacción | Cada control tiene nombre, foco y efecto observable. |
| Paneles | Contraer y restaurar **Agent Rail**, **Workflow toolbar**, **Run status** y **Minimap** | La etiqueta alterna Collapse/Expand, el estado se conserva y no se bloquean acciones críticas. |
| Responsive | Probar 768 px y 1024 px cuando cambie el layout | No hay controles superpuestos ni fuera de alcance. |
| Claude CLI | Correr una tarea inocua con nodos paralelos cuando aplique | Se abre una terminal integrada por agente/rama y las ramas paralelas quedan en split. |
| Codex CLI | Correr una tarea inocua de un workflow de prueba | Se abre una terminal integrada por nodo y aparece la TUI normal de Codex. |
| Animación | Ejecutar al menos dos pasos dependientes | En `running` no hay viajero; al pasar `completed → running` aparece sólo entonces el viajero del handoff. |

Para Codex, usar como objetivo algo explícitamente inocuo, por ejemplo:

```text
Respondé con una frase breve. No modifiques archivos ni ejecutes comandos.
```

La señal de éxito es que la terminal muestre el prompt dentro de la interfaz de
Codex, con señales como **Working** y **Ask Codex to do anything**. Debe verse
el título de terminal de Agent Studio y el modelo activo. Es un fallo si Codex
se abre y se cierra, si el prompt queda escrito en una shell vacía o si la
ejecución ocurre sólo en segundo plano. `cli-codex` debe lanzar la TUI
interactiva (`codex --sandbox workspace-write` por defecto), no `codex
app-server` ni `codex exec`.

### Verificación de movimiento y preferencia reducida

No basta con una captura estática de un nodo que parece activo. Para un cambio de
movimiento, la IA debe observar al menos dos instantes del mismo run:

1. El origen está `running`: nodo/carga y la arista activa se muestran, pero no
   existe un viajero de handoff.
2. El origen termina y el destino inicia: el origen queda `completed`, el destino
   `running` y el único viajero se desplaza por la arista `completed → running`.

Registrar las clases o el estado observable de ambos instantes, más una captura
del segundo. Confirmar que la regla de `prefers-reduced-motion` incluye el
spinner de carga (`graph-node-loading`). Si el emulador de media no alcanza el
iframe anidado de VS Code, esa limitación se registra en el reporte; nunca se
infiere que la preferencia funciona sin revisar la hoja cargada del webview.

## 5. Registrar evidencia

Por cada ejecución de QA, anotar en `reports/`:

- fecha, commit o estado del árbol y alcance;
- comandos automáticos y resultado exacto;
- versión de VS Code y método de inicio del EDH;
- escenario, interacción realizada y resultado observable;
- capturas del EDH para cambios visuales o de terminal;
- fallos, pasos para reproducirlos y lo que no se pudo probar.

No registrar tokens, prompts con datos sensibles, archivos personales ni
credenciales. Para UI, una captura antes/después de una acción de estado suele
ser suficiente; para una corrida CLI, guardar la captura de la TUI y el título
de la terminal.

## 6. Cerrar la sesión de QA

Detener primero la corrida desde la UI si sigue activa. Después cerrar sólo el
host que creó esta sesión y verificar que no quedan procesos hijos de esa
corrida:

```sh
kill "$QA_EDH_PID"
```

No usar `pkill code`, no cerrar todas las terminales y no matar sesiones de
otros agentes. Conservar `"$QA_EDH_ROOT/vscode.log"` mientras se analiza un
fallo; eliminar el directorio temporal sólo cuando ya no se necesite como
evidencia.

## Checklist de entrega

- [ ] Cambios compilados, testeados y sin errores de tipos.
- [ ] Dashboard abierto en un EDH real por Command Palette.
- [ ] Interacciones afectadas verificadas dentro del webview del EDH.
- [ ] Si cambia el grafo: los cuatro paneles y teclado comprobados.
- [ ] Si cambia ejecución: terminales Claude/Codex visibles y observadas.
- [ ] Capturas y resultados anotados en `reports/`.
- [ ] EDH y corrida de prueba detenidos sin afectar sesiones ajenas.
