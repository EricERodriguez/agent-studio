# Arquitectura: terminal adapter de VS Code para SwarmForge

## Problema

SwarmForge necesita, por cada rol configurado en `swarmforge/swarmforge.conf`, abrir una
"superficie de terminal" que ejecute:

```sh
cd "$WORKING_DIR" && exec tmux -S "$TMUX_SOCKET" attach-session -t "$session"
```

Hoy sabe hacerlo para macOS Terminal.app, iTerm2, Ghostty y Windows Terminal, con un fallback
`none` que hace ese `tmux attach` en la shell donde se lanzó `./swarm`. No hay ningún adapter
para "una terminal integrada dentro de un editor", que es exactamente lo que Agent Studio
necesita.

El adapter (`terminal-adapters/vscode.sh`) corre como **proceso hijo de SwarmForge** (bash/zsh),
completamente separado del proceso de la extensión de VS Code (Node.js, dentro del Extension
Host). No comparten memoria ni pueden llamarse en proceso — necesitan un canal de comunicación
local entre procesos.

## Diseño: socket Unix local, protocolo JSON línea a línea

**Por qué socket Unix y no otra cosa:** ambos procesos corren en la misma máquina, bajo el mismo
usuario, durante la vida del run. Un socket Unix da aislamiento por filesystem (permisos 0700,
un socket por run), no necesita gestión de puertos TCP, y es trivial de hablar desde bash con
`curl --unix-socket` (disponible en cualquier sistema con curl moderno, que SwarmForge ya
requiere implícitamente para muchas otras cosas) sin depender de netcat u otras herramientas de
disponibilidad variable entre distros.

- Ruta del socket: `$XDG_RUNTIME_DIR/agent-studio/<run-id>.sock` (con fallback a
  `/tmp/agent-studio-<uid>/<run-id>.sock` si `XDG_RUNTIME_DIR` no está seteado — típico en
  algunos entornos de CI o shells no interactivas).
- Permisos: directorio `0700`, socket con el usuario efectivo como único lector/escritor. Same
  user únicamente — no hay autenticación adicional sobre el socket, ver
  [`04-riesgos.md`](./04-riesgos.md) para por qué eso es aceptable y qué hay que documentar.
- La extensión levanta el listener al iniciar un run (`runId` conocido de antemano, generado por
  Agent Studio) y lo cierra al terminar o cancelar el run.
- El adapter recibe la ruta del socket vía variable de entorno (`AGENT_STUDIO_SOCKET`), seteada
  por el generador de config de la Fase 4 antes de invocar `./swarm` (o inyectada en
  `swarmforge.conf`/entorno del proceso lanzado).

### Protocolo

Un mensaje JSON por línea, request/response simple sobre HTTP-sobre-unix-socket (así `curl
--unix-socket` funciona sin escribir un cliente a mano):

```
POST /open-session
{"run_id":"...", "role":"coder", "session":"swarmforge-coder", "title":"Agent Studio · Two-Pack · coder", "worktree":"/path/to/.worktrees/coder", "socket":"/path/to/tmux-socket"}
→ 200 {"window_id":"a1b2c3"}

GET /window-exists?window_id=a1b2c3
→ 200 {"exists": true}

POST /close-window
{"window_id":"a1b2c3"}
→ 200 {"ok": true}
```

`window_id` es un UUID propio de la extensión — VS Code no expone un id estable para un
`vscode.Terminal` que sobreviva a serialización, así que la extensión mantiene el mapeo interno
`Map<windowId, vscode.Terminal>` y genera el id ella misma al crear el terminal.

### Lado extensión (sketch, no implementación final)

```ts
// src/services/swarmforge/swarmForgeTerminalService.ts
vscode.window.createTerminal({
  name: title,
  cwd: worktree,
});
// enviar por stdin de esa terminal:
// exec tmux -S "<socket>" attach-session -t "<session>"
```

Nota importante: el `terminal_open_session` del contrato de SwarmForge espera que la superficie
ejecute el `tmux attach` — no que la extensión "hable" con el agente directamente. Esto es una
ventaja: la extensión no necesita entender el protocolo de handoffs ni el estado del agente para
esta pieza, sólo necesita abrir una terminal y adjuntarla a la sesión tmux correcta. Todo el
estado real sigue viviendo en tmux, gestionado por SwarmForge — consistente con la regla de la
v1 de "cerrar la terminal de VS Code no debe matar el trabajo del agente".

### Reconexión tras reiniciar VS Code

Como la fuente de verdad es tmux (que sobrevive al cierre de VS Code) y no el socket (que no
sobrevive), al reabrir VS Code la extensión debe:
1. Detectar runs activos por su `manifest.json` en `.agent-studio/runs/`.
2. Releventar el listener del socket con el mismo `run-id` (o uno nuevo si el anterior no puede
   reabrirse en la misma ruta).
3. Como el adapter (`vscode.sh`) ya corrió y las sesiones tmux ya existen, no hace falta volver a
   pedirle a SwarmForge que abra nada — la extensión puede simplemente volver a hacer `tmux -S
   <socket> attach-session` ella misma para las terminales visibles, sin pasar de nuevo por el
   protocolo de `open-session`.

Este punto necesita más diseño del que da este documento — queda anotado en `PROGRESS.md` como
parte de la Fase 9 (estado y recuperación), no cerrado acá.

## Qué falta validar (no asumir que este diseño es correcto sin probarlo)

- Confirmar en la práctica que `curl --unix-socket` está disponible en los entornos objetivo
  (macOS/Linux con SwarmForge instalado) — es parte de curl desde hace años pero no está de más
  verificarlo explícitamente antes de depender de él.
- Confirmar que enviar el comando `tmux attach` "por stdin" de una `vscode.Terminal` recién
  creada es fiable (timing, escaping) — la v1 ya asumía esto para el modo CLI existente
  (`cliTerminal.sendText`), así que hay precedente funcionando en el propio código de Agent
  Studio, pero conviene un smoke test dedicado antes de darlo por sentado para N terminales en
  paralelo.
