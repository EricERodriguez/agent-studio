# Bugs conocidos

No hay bugs abiertos de la integración SwarmForge/motor nativo al 2026-08-10.

## Resueltos (2026-08-10)

1. **Split de terminales** — `location.parentTerminal` abría tabs en el EDH. Los hijos usan ahora
   el comando nativo `workbench.action.terminal.split`, con creación serializada y captura del
   terminal abierto; la corrida Six-Pack confirmó `split 1 of 2` y `split 2 of 2`.
2. **Falta de ⚡ en handoff automático** — se centralizó el formateo de labels: automático usa
   `⚡` y humano `👤`. Confirmado en el grafo real y cubierto por tests.
3. **TS2339 en `agentRegistryService.ts`** — se reemplazó `.catch()` sobre `PromiseLike` por
   `await` dentro de `try/catch`; `npm run check` queda verde.
4. **Warning invisible de preflight sin Git** — el modal nativo se sustituyó por un overlay del
   dashboard, confirmado en EDH en los caminos Cancel y Continue.

El detalle de diagnóstico, correcciones y evidencias está en la sección “Cierre de bugs
diferidos (2026-08-10)” de [`PROGRESS.md`](./PROGRESS.md).
