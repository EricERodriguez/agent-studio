import type { AgentDefinition } from "../types";

export interface NodePosition {
  x: number;
  y: number;
}

const LEVEL_DX = 230;
const ROW_DY = 130;
const ORIGIN_X = 110;
const ORIGIN_Y = 90;
const GRID_GAP_Y = 90;
const ISOLATED_COLS = 4;
const ISOLATED_DX = 200;
const ISOLATED_DY = 110;

/**
 * Lays out agents left-to-right by handoff depth (BFS levels from agents with
 * no incoming handoff). Agents with no handoff relationship at all (neither
 * incoming nor outgoing) are placed separately in a grid below the connected
 * subgraph — mixing them into the same column as connected agents made
 * unrelated edges visually cut through totally unrelated nodes.
 */
export function layoutAgentGraph(
  agents: AgentDefinition[],
): Map<string, NodePosition> {
  const ids = agents.map((agent) => agent.id);
  const idSet = new Set(ids);
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  agents.forEach((agent) => {
    agent.handoffs.forEach((handoff) => {
      if (idSet.has(handoff.agent)) {
        incoming.add(handoff.agent);
        outgoing.add(agent.id);
      }
    });
  });

  const connectedIds = ids.filter((id) => incoming.has(id) || outgoing.has(id));
  const isolatedIds = ids.filter((id) => !incoming.has(id) && !outgoing.has(id));
  const connectedIdSet = new Set(connectedIds);

  const level = new Map<string, number>();
  const roots = connectedIds.filter((id) => !incoming.has(id));
  const queue = (roots.length > 0 ? roots : connectedIds.slice(0, 1)).slice();
  queue.forEach((id) => level.set(id, 0));

  let guard = 0;
  while (queue.length > 0 && guard < connectedIds.length * 4) {
    guard += 1;
    const current = queue.shift()!;
    const currentLevel = level.get(current) ?? 0;
    const agent = agents.find((candidate) => candidate.id === current);
    agent?.handoffs.forEach((handoff) => {
      if (!connectedIdSet.has(handoff.agent)) {
        return;
      }
      const nextLevel = currentLevel + 1;
      const existing = level.get(handoff.agent);
      if (existing === undefined || nextLevel > existing) {
        level.set(handoff.agent, nextLevel);
        queue.push(handoff.agent);
      }
    });
  }

  connectedIds.forEach((id) => {
    if (!level.has(id)) {
      level.set(id, 0);
    }
  });

  const rowByLevel = new Map<number, number>();
  const positions = new Map<string, NodePosition>();
  let maxRow = 0;
  connectedIds.forEach((id) => {
    const lvl = level.get(id) ?? 0;
    const row = rowByLevel.get(lvl) ?? 0;
    rowByLevel.set(lvl, row + 1);
    maxRow = Math.max(maxRow, row);
    positions.set(id, {
      x: ORIGIN_X + lvl * LEVEL_DX,
      y: ORIGIN_Y + row * ROW_DY,
    });
  });

  const isolatedOriginY =
    connectedIds.length > 0
      ? ORIGIN_Y + (maxRow + 1) * ROW_DY + GRID_GAP_Y
      : ORIGIN_Y;
  isolatedIds.forEach((id, index) => {
    const col = index % ISOLATED_COLS;
    const row = Math.floor(index / ISOLATED_COLS);
    positions.set(id, {
      x: ORIGIN_X + col * ISOLATED_DX,
      y: isolatedOriginY + row * ISOLATED_DY,
    });
  });

  return positions;
}
