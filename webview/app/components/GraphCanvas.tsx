import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import { useI18n } from "../i18n";
import { vscode } from "../hooks/useVsCodeApi";
import { roleColor } from "../utils/roleColor";
import { layoutAgentGraph } from "../utils/graphLayout";

const HW = 82; // half node width, used to clip edges to the node border
const HH = 30; // half node height

interface Point {
  x: number;
  y: number;
}

function clip(center: Point, towards: Point): Point {
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  if (!dx && !dy) {
    return { x: center.x, y: center.y };
  }
  const sx = dx ? HW / Math.abs(dx) : Infinity;
  const sy = dy ? HH / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: center.x + dx * s, y: center.y + dy * s };
}

function bezier(a: Point, b: Point): { d: string; mx: number; my: number } {
  const p = clip(a, b);
  const q = clip(b, a);
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const c1 = horizontal ? { x: (p.x + q.x) / 2, y: p.y } : { x: p.x, y: (p.y + q.y) / 2 };
  const c2 = horizontal ? { x: (p.x + q.x) / 2, y: q.y } : { x: q.x, y: (p.y + q.y) / 2 };
  return {
    d: `M${p.x},${p.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${q.x},${q.y}`,
    mx: (p.x + q.x) / 2,
    my: (p.y + q.y) / 2,
  };
}

interface Dragging {
  from: string;
  sx: number;
  sy: number;
  px: number;
  py: number;
}

interface PanOrigin {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface NodeDragOrigin {
  nodeId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

export function GraphCanvas(): React.JSX.Element {
  const { tx } = useI18n();
  const agents = useStudioStore((s) => s.agents);
  const workflows = useStudioStore((s) => s.workflows);
  const selectedWorkflow = useStudioStore(selectors.selectedWorkflow);
  const selectedAgentId = useStudioStore((s) => s.selectedAgentId);
  const selectAgent = useStudioStore((s) => s.selectAgent);
  const upsertAgent = useStudioStore((s) => s.upsertAgent);
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow);
  const graphMode = useStudioStore((s) => s.graphMode);
  const setGraphMode = useStudioStore((s) => s.setGraphMode);
  const setUiPanelOpen = useStudioStore((s) => s.setUiPanelOpen);
  const addWorkflowEdge = useStudioStore((s) => s.addWorkflowEdge);
  const removeWorkflowEdge = useStudioStore((s) => s.removeWorkflowEdge);
  const setEdgeHandoffMode = useStudioStore((s) => s.setEdgeHandoffMode);
  const addWorkflowStep = useStudioStore((s) => s.addWorkflowStep);
  const removeWorkflowStep = useStudioStore((s) => s.removeWorkflowStep);
  const setWorkflowEntryStep = useStudioStore((s) => s.setWorkflowEntryStep);
  const setWorkflowNodeLanguageOverride = useStudioStore(
    (s) => s.setWorkflowNodeLanguageOverride,
  );
  const autoLayoutWorkflow = useStudioStore((s) => s.autoLayoutWorkflow);
  const moveWorkflowNode = useStudioStore((s) => s.moveWorkflowNode);
  const workflowRun = useStudioStore((s) => s.workflowRun);

  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [agentToAdd, setAgentToAdd] = useState("");
  const [runMode, setRunMode] = useState<
    "chat" | "plan" | "cli-claude" | "cli-codex"
  >("chat");
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [manualPositions, setManualPositions] = useState<Record<string, Point>>({});
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panOriginRef = useRef<PanOrigin | null>(null);
  const nodeDragRef = useRef<NodeDragOrigin | null>(null);
  const justDraggedNodeRef = useRef(false);

  const isWorkflow = graphMode === "workflow";
  const scale = zoom / 100;

  // Reset the viewport whenever the active graph (mode or workflow) changes,
  // so switching context doesn't leave the user panned/zoomed somewhere odd.
  useEffect(() => {
    setPan({ x: 40, y: 30 });
    setZoom(100);
    setSelectedEdgeId(null);
    setManualPositions({});
  }, [isWorkflow, selectedWorkflow?.id]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent): void => {
      if (!panOriginRef.current) return;
      const dx = e.clientX - panOriginRef.current.startX;
      const dy = e.clientY - panOriginRef.current.startY;
      setPan({ x: panOriginRef.current.originX + dx, y: panOriginRef.current.originY + dy });
    };
    const onUp = (): void => {
      setIsPanning(false);
      panOriginRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning]);

  // Lets the user drag a node to reposition it — handy to see whether an
  // arrow actually terminates at a node or just visually passes near it.
  useEffect(() => {
    if (!draggingNodeId) return;
    const onMove = (e: MouseEvent): void => {
      const origin = nodeDragRef.current;
      if (!origin) return;
      const dx = (e.clientX - origin.startX) / scale;
      const dy = (e.clientY - origin.startY) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        origin.moved = true;
      }
      const next = { x: origin.originX + dx, y: origin.originY + dy };
      if (isWorkflow && selectedWorkflow) {
        moveWorkflowNode(selectedWorkflow.id, origin.nodeId, next);
      } else {
        setManualPositions((prev) => ({ ...prev, [origin.nodeId]: next }));
      }
    };
    const onUp = (): void => {
      justDraggedNodeRef.current = nodeDragRef.current?.moved ?? false;
      nodeDragRef.current = null;
      setDraggingNodeId(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingNodeId, isWorkflow, moveWorkflowNode, scale, selectedWorkflow]);

  // Mouse-wheel zoom, keeping the point under the cursor fixed so zooming
  // feels anchored instead of jumping the view around.
  const onWheelZoom = (e: React.WheelEvent): void => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - pan.x) / scale;
    const worldY = (mouseY - pan.y) / scale;
    const nextZoom = Math.min(200, Math.max(20, zoom + (e.deltaY < 0 ? 10 : -10)));
    const nextScale = nextZoom / 100;
    setZoom(nextZoom);
    setPan({ x: mouseX - worldX * nextScale, y: mouseY - worldY * nextScale });
  };

  const startNodeDrag = (e: React.MouseEvent, nodeId: string, x: number, y: number): void => {
    e.stopPropagation();
    nodeDragRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      originX: x,
      originY: y,
      moved: false,
    };
    setDraggingNodeId(nodeId);
  };

  const startPan = (e: React.MouseEvent): void => {
    // Only start a pan when the background itself was clicked, not a node,
    // edge, or any other interactive child (those stop propagation already).
    if (e.target !== e.currentTarget || dragging) return;
    panOriginRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    setIsPanning(true);
  };

  const screenToWorld = (clientX: number, clientY: number): Point => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale,
    };
  };

  const onCanvasMove = (e: React.MouseEvent): void => {
    if (!dragging) return;
    const world = screenToWorld(e.clientX, e.clientY);
    setDragging({ ...dragging, px: world.x, py: world.y });
  };
  const onCanvasUp = (): void => setDragging(null);

  const agentLevels = useMemo(() => layoutAgentGraph(agents), [agents]);

  const nodes = useMemo(() => {
    if (isWorkflow && selectedWorkflow) {
      return selectedWorkflow.nodes.map((node) => {
        const agent = agents.find((candidate) => candidate.id === node.agentId);
        return {
          id: node.id,
          agentId: node.agentId,
          name: agent?.name ?? node.agentId,
          dot: roleColor(agent?.role),
          counts: agent
            ? `T:${agent.capabilities.tools.length} · S:${agent.capabilities.skills.length} · M:${agent.capabilities.mcpServers.length}`
            : "",
          x: node.position.x,
          y: node.position.y,
          isEntry: Boolean(node.isEntry),
          languageOverride: node.languageOverride,
          showHandles: true,
        };
      });
    }
    return agents.map((agent) => {
      const position =
        manualPositions[agent.id] || agentLevels.get(agent.id) || { x: 110, y: 90 };
      return {
        id: agent.id,
        agentId: agent.id,
        name: agent.name,
        dot: roleColor(agent.role),
        counts: `T:${agent.capabilities.tools.length} · S:${agent.capabilities.skills.length} · M:${agent.capabilities.mcpServers.length}`,
        x: position.x,
        y: position.y,
        isEntry: false,
        languageOverride: undefined,
        showHandles: false,
      };
    });
  }, [agentLevels, agents, isWorkflow, manualPositions, selectedWorkflow]);

  const nodeById = useMemo(() => {
    const map = new Map<string, (typeof nodes)[number]>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  const edges = useMemo(() => {
    if (isWorkflow && selectedWorkflow) {
      return selectedWorkflow.edges
        .map((edge) => {
          const from = nodeById.get(edge.source);
          const to = nodeById.get(edge.target);
          if (!from || !to) return null;
          const bz = bezier(from, to);
          const isEntryEdge = from.isEntry;
          const fromSelected = from.id === selectedAgentId;
          const isSelected = edge.id === selectedEdgeId;
          let stroke = "var(--studio-edge, #5b6473)";
          let marker = "url(#agentStudioArrow)";
          let width = "1.6";
          if (isEntryEdge) {
            stroke = "var(--vscode-charts-green)";
            marker = "url(#agentStudioArrowEntry)";
            width = "1.8";
          } else if (fromSelected) {
            stroke = "var(--studio-accent)";
            marker = "url(#agentStudioArrowActive)";
            width = "1.8";
          }
          if (isSelected) {
            stroke = "var(--vscode-editor-foreground)";
            width = "2.2";
          }
          const handoffMode = edge.handoff?.mode ?? "automatic";
          if (handoffMode === "human") {
            stroke = "var(--vscode-charts-yellow, #d7ba7d)";
          }
          return {
            id: edge.id,
            d: bz.d,
            mx: bz.mx,
            my: bz.my,
            label: handoffMode === "human" ? `👤 ${edge.label ?? ""}`.trim() : edge.label,
            stroke,
            marker,
            width,
            opacity: isEntryEdge || fromSelected || isSelected ? "1" : "0.85",
            handoffMode,
          };
        })
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));
    }

    // Show every handoff, but emphasize the selected agent's own outgoing
    // edges in accent color — matching the design, all relationships stay
    // visible, just de-emphasized when they don't touch the current agent.
    return agents.flatMap((agent) =>
      agent.handoffs
        .map((handoff) => {
          const from = nodeById.get(agent.id);
          const to = nodeById.get(handoff.agent);
          if (!from || !to) return null;
          const outgoing = agent.id === selectedAgentId;
          const bz = bezier(from, to);
          return {
            id: `${agent.id}->${handoff.agent}`,
            d: bz.d,
            mx: bz.mx,
            my: bz.my,
            label: undefined,
            stroke: outgoing ? "var(--studio-accent)" : "var(--studio-edge, #5b6473)",
            marker: outgoing ? "url(#agentStudioArrowActive)" : "url(#agentStudioArrow)",
            width: outgoing ? "1.8" : "1.4",
            opacity: outgoing ? "1" : "0.65",
          };
        })
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
    );
  }, [agents, isWorkflow, nodeById, selectedAgentId, selectedEdgeId, selectedWorkflow]);

  const tempPath = dragging
    ? `M${dragging.sx},${dragging.sy} C${(dragging.sx + dragging.px) / 2},${dragging.sy} ${(dragging.sx + dragging.px) / 2},${dragging.py} ${dragging.px},${dragging.py}`
    : "";

  const minimapBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    return {
      minX: Math.min(...xs) - HW,
      maxX: Math.max(...xs) + HW,
      minY: Math.min(...ys) - HH,
      maxY: Math.max(...ys) + HH,
    };
  }, [nodes]);

  const MINI_W = 168;
  const MINI_H = 104;
  const toMini = (x: number, y: number): Point => {
    const spanX = Math.max(1, minimapBounds.maxX - minimapBounds.minX);
    const spanY = Math.max(1, minimapBounds.maxY - minimapBounds.minY);
    return {
      x: ((x - minimapBounds.minX) / spanX) * (MINI_W - 22),
      y: ((y - minimapBounds.minY) / spanY) * (MINI_H - 14),
    };
  };

  const recenterOn = (worldX: number, worldY: number): void => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPan({
      x: rect.width / 2 - worldX * scale,
      y: rect.height / 2 - worldY * scale,
    });
  };

  const selectedWorkflowRun =
    selectedWorkflow && workflowRun?.workflowId === selectedWorkflow.id
      ? workflowRun
      : undefined;

  const orderedRunSteps = useMemo(() => {
    if (!isWorkflow || !selectedWorkflow) return [];
    const entry = selectedWorkflow.nodes.find((node) => node.isEntry);
    const ordered = entry
      ? [entry, ...selectedWorkflow.nodes.filter((n) => n.id !== entry.id)]
      : selectedWorkflow.nodes;
    // Always reflect every current node in the graph, not just the ones from the last run —
    // editing/adding a node after a run finished used to leave it missing from this list until
    // the workflow ran again. Merge by nodeId instead of trusting the stale run's step list.
    const runStepByNodeId = new Map(
      (selectedWorkflowRun?.steps ?? []).map((step) => [step.nodeId, step]),
    );
    return ordered.map((node, index) => {
      const agent = agents.find((a) => a.id === node.agentId);
      const runStep = runStepByNodeId.get(node.id);
      return {
        name: agent?.name ?? node.agentId,
        state: runStep?.status ?? (selectedWorkflowRun ? "pending" : index === 0 ? "ready" : "pending"),
      };
    });
  }, [agents, isWorkflow, selectedWorkflow, selectedWorkflowRun]);

  const runStatusByNodeId = useMemo(() => {
    const map = new Map<string, string>();
    if (isWorkflow && selectedWorkflowRun) {
      for (const step of selectedWorkflowRun.steps) {
        map.set(step.nodeId, step.status);
      }
    }
    return map;
  }, [isWorkflow, selectedWorkflowRun]);

  const isEmptyAgentGraph = !isWorkflow && nodes.length === 0;
  const isEmptyWorkflowGraph = isWorkflow && (!selectedWorkflow || nodes.length === 0);

  return (
    <div className="graph-view">
      <div className="graph-toolbar-overlay-left">
        <div className="graph-mode-toggle">
          <button
            className={!isWorkflow ? "active" : ""}
            title={tx("Show the agent relationship graph.", "Muestra el grafo de relaciones entre agents.")}
            onClick={() => setGraphMode("agent")}
          >
            {tx("Agent graph", "Grafo de agents")}
          </button>
          <button
            className={isWorkflow ? "active" : ""}
            title={tx("Show the workflow step graph.", "Muestra el grafo de steps del workflow.")}
            onClick={() => setGraphMode("workflow")}
          >
            {tx("Workflow graph", "Grafo de workflow")}
          </button>
        </div>
      </div>

      {isWorkflow && (
        <div className="graph-toolbar-overlay-right">
          <div className="graph-toolbar-actions">
            <select
              title={tx("Choose which workflow to view and edit.", "Elige qué workflow ver y editar.")}
              value={selectedWorkflow?.id || ""}
              onChange={(e) => selectWorkflow(e.target.value || undefined)}
            >
              <option value="">{tx("No workflow selected", "Ningún workflow seleccionado")}</option>
              {workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
            {selectedWorkflow && (
              <>
                <select
                  title={tx("Pick an agent to add as a new workflow step.", "Elige un agent para agregar como step.")}
                  value={agentToAdd}
                  onChange={(e) => setAgentToAdd(e.target.value)}
                >
                  <option value="">{tx("Add agent as step…", "Agregar agent como step…")}</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary-button"
                  disabled={!agentToAdd}
                  title={tx("Add the selected agent as a new step.", "Agrega el agent seleccionado como nuevo step.")}
                  onClick={() => {
                    if (agentToAdd) {
                      addWorkflowStep(selectedWorkflow.id, agentToAdd);
                      setAgentToAdd("");
                    }
                  }}
                >
                  {tx("Add Step", "Agregar Step")}
                </button>
                <button
                  className="secondary-button"
                  title={tx("Automatically reposition workflow nodes.", "Reubica automáticamente los nodos del workflow.")}
                  onClick={() => autoLayoutWorkflow(selectedWorkflow.id)}
                >
                  ⤢ {tx("Auto Layout", "Auto Layout")}
                </button>
                <button
                  title={tx("Persist this workflow to disk.", "Guarda este workflow en disco.")}
                  onClick={() =>
                    vscode?.postMessage({ type: "saveWorkflow", payload: selectedWorkflow })
                  }
                >
                  {tx("Save Workflow", "Guardar Workflow")}
                </button>
                <button
                  className="secondary-button"
                  title={tx("Rename this workflow.", "Cambia el nombre de este workflow.")}
                  onClick={() =>
                    vscode?.postMessage({
                      type: "renameWorkflow",
                      payload: { workflowId: selectedWorkflow.id },
                    })
                  }
                >
                  {tx("Rename", "Renombrar")}
                </button>
                <button
                  className="secondary-button"
                  title={tx(
                    "Open this workflow's JSON file (must be saved first).",
                    "Abre el archivo JSON de este workflow (hay que guardarlo primero).",
                  )}
                  onClick={() =>
                    vscode?.postMessage({
                      type: "openRawWorkflow",
                      payload: { workflowId: selectedWorkflow.id },
                    })
                  }
                >
                  {tx("Edit JSON", "Editar JSON")}
                </button>
                <button
                  className="danger"
                  title={tx("Delete this workflow.", "Borra este workflow.")}
                  onClick={() =>
                    vscode?.postMessage({
                      type: "deleteWorkflow",
                      payload: { workflowId: selectedWorkflow.id },
                    })
                  }
                >
                  {tx("Delete", "Borrar")}
                </button>
              </>
            )}
          </div>

          <div className="graph-run-panel">
            <div className="graph-run-panel-head">
              <span>{tx("Run status", "Estado de corrida")}</span>
              <span className="graph-run-state">
                {selectedWorkflowRun?.status || tx("idle", "en espera")}
              </span>
              {selectedWorkflowRun?.status === "running" && selectedWorkflowRun.runId && (
                <button
                  className="danger graph-run-stop-button"
                  title={tx(
                    "Stop this run. Steps already in progress finish naturally instead of being killed.",
                    "Detiene esta corrida. Los pasos ya en curso terminan solos en vez de matarse.",
                  )}
                  onClick={() =>
                    vscode?.postMessage({
                      type: "cancelWorkflow",
                      payload: { runId: selectedWorkflowRun.runId },
                    })
                  }
                >
                  ■ {tx("Stop", "Detener")}
                </button>
              )}
            </div>
            {orderedRunSteps.map((step, index) => (
              <div key={`${step.name}-${index}`} className="graph-run-step">
                <span
                  className={
                    "graph-run-step-mark" +
                    (step.state === "ready" || step.state === "completed"
                      ? " ready"
                      : step.state === "running"
                        ? " running"
                        : step.state === "failed"
                          ? " failed"
                          : step.state === "queued"
                            ? " queued"
                            : step.state === "waiting_approval"
                              ? " waiting-approval"
                              : "")
                  }
                />
                <span className="graph-run-step-name">{step.name}</span>
                <span className="graph-run-step-state">{step.state}</span>
              </div>
            ))}
            {selectedWorkflow && (
              <div className="graph-run-panel-actions">
                <select
                  value={runMode}
                  title={tx(
                    "Choose whether the workflow opens agents in chat, only generates a plan, or types each step into a Claude/Codex CLI terminal.",
                    "Elige si el workflow abre agents en chat, solo genera un plan, o escribe cada paso en una terminal CLI de Claude/Codex.",
                  )}
                  onChange={(e) =>
                    setRunMode(
                      e.target.value as
                        | "chat"
                        | "plan"
                        | "cli-claude"
                        | "cli-codex",
                    )
                  }
                >
                  <option value="chat">{tx("Chat", "Chat")}</option>
                  <option value="plan">{tx("Plan", "Plan")}</option>
                  <option value="cli-claude">{tx("Claude CLI", "CLI de Claude")}</option>
                  <option value="cli-codex">{tx("Codex CLI", "CLI de Codex")}</option>
                </select>
                <button
                  disabled={selectedWorkflowRun?.status === "running"}
                  onClick={() =>
                    vscode?.postMessage({
                      type: "runWorkflow",
                      payload: { workflowId: selectedWorkflow.id, mode: runMode },
                    })
                  }
                >
                  {selectedWorkflowRun?.status === "running"
                    ? tx("Running…", "Ejecutando…")
                    : tx("Run Workflow", "Ejecutar Workflow")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isEmptyAgentGraph || isEmptyWorkflowGraph ? (
        <div className="graph-canvas empty-state">
          {isEmptyAgentGraph && (
            <p>
              {tx(
                "No agents found. Create one from Templates or place a",
                "No se encontraron agents. Crea uno desde Templates o coloca un archivo",
              )}{" "}
              <code>.agent.md</code> {tx("file under", "debajo de")}{" "}
              <code>.github/agents</code>.
            </p>
          )}
          {isEmptyWorkflowGraph && (
            <p>
              {tx(
                "No workflow to render. Create a workflow from the dashboard to see nodes and connections here.",
                "No hay workflow para renderizar. Crea un workflow desde el dashboard para ver aquí los nodos y conexiones.",
              )}
            </p>
          )}
        </div>
      ) : (
        <div
          className="graph-canvas"
          ref={viewportRef}
          onMouseMove={onCanvasMove}
          onMouseUp={onCanvasUp}
          onMouseLeave={onCanvasUp}
          onWheel={onWheelZoom}
        >
          <div
            className={isPanning ? "graph-canvas-world panning" : "graph-canvas-world"}
            onMouseDown={startPan}
            onClick={() => setSelectedEdgeId(null)}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              width: 6000,
              height: 4000,
            }}
          >
            <svg width="1" height="1" className="graph-svg">
              <defs>
                <marker id="agentStudioArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                  <path d="M0,0 L8,4.5 L0,9 z" fill="#5b6473" />
                </marker>
                <marker id="agentStudioArrowActive" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                  <path d="M0,0 L8,4.5 L0,9 z" fill="var(--studio-accent)" />
                </marker>
                <marker id="agentStudioArrowEntry" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                  <path d="M0,0 L8,4.5 L0,9 z" fill="var(--vscode-charts-green)" />
                </marker>
              </defs>
              {edges.map((edge) => (
                <path
                  key={edge.id}
                  d={edge.d}
                  fill="none"
                  stroke={edge.stroke}
                  strokeWidth={edge.width}
                  markerEnd={edge.marker}
                  opacity={edge.opacity}
                />
              ))}
              {edges.map((edge) => (
                <path
                  key={`hit-${edge.id}`}
                  d={edge.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEdgeId(edge.id);
                  }}
                />
              ))}
              {dragging && (
                <path
                  d={tempPath}
                  fill="none"
                  stroke="var(--studio-accent)"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  markerEnd="url(#agentStudioArrowActive)"
                />
              )}
            </svg>

            {isWorkflow &&
              edges
                .filter((edge) => edge.label && edge.id !== selectedEdgeId)
                .map((edge) => (
                  <div
                    key={`label-${edge.id}`}
                    className="graph-edge-label graph-edge-label-clickable"
                    style={{ left: edge.mx - 16, top: edge.my - 9 }}
                    title={tx(
                      "Click to choose automatic or human approval for this handoff.",
                      "Click para elegir aprobación automática o humana para este handoff.",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                    }}
                  >
                    {edge.label}
                  </div>
                ))}
            {selectedEdgeId &&
              (() => {
                const edge = edges.find((candidate) => candidate.id === selectedEdgeId);
                if (!edge) return null;
                return (
                  <div
                    className="graph-edge-delete"
                    style={{ left: edge.mx - 11, top: edge.my - 11 }}
                    title={tx("Remove this connection.", "Quitar esta conexión.")}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isWorkflow) {
                        if (selectedWorkflow) {
                          removeWorkflowEdge(selectedWorkflow.id, edge.id);
                        }
                      } else {
                        const [sourceId, targetId] = selectedEdgeId.split("->");
                        const sourceAgent = agents.find((a) => a.id === sourceId);
                        if (sourceAgent) {
                          const updated = {
                            ...sourceAgent,
                            handoffs: sourceAgent.handoffs.filter(
                              (handoff) => handoff.agent !== targetId,
                            ),
                          };
                          upsertAgent(updated);
                          vscode?.postMessage({ type: "saveAgent", payload: updated });
                        }
                      }
                      setSelectedEdgeId(null);
                    }}
                  >
                    ✕
                  </div>
                );
              })()}
            {isWorkflow &&
              selectedWorkflow &&
              selectedEdgeId &&
              (() => {
                const edge = edges.find((candidate) => candidate.id === selectedEdgeId);
                if (!edge) return null;
                const mode = "handoffMode" in edge ? edge.handoffMode : "automatic";
                return (
                  <div
                    className="graph-edge-handoff-toggle"
                    style={{ left: edge.mx - 44, top: edge.my - 36 }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={mode === "automatic" ? "active" : ""}
                      title={tx(
                        "Dispatch this handoff automatically.",
                        "Este handoff se despacha automáticamente.",
                      )}
                      onClick={() => setEdgeHandoffMode(selectedWorkflow.id, edge.id, "automatic")}
                    >
                      ⚡ {tx("Auto", "Auto")}
                    </button>
                    <button
                      className={mode === "human" ? "active" : ""}
                      title={tx(
                        "Pause here until a human approves the handoff.",
                        "Pausa acá hasta que un humano apruebe el handoff.",
                      )}
                      onClick={() => setEdgeHandoffMode(selectedWorkflow.id, edge.id, "human")}
                    >
                      👤 {tx("Human", "Humano")}
                    </button>
                  </div>
                );
              })()}

            {nodes.map((node) => {
              const isSelected = node.id === selectedAgentId || node.agentId === selectedAgentId;
              const runStatus = runStatusByNodeId.get(node.id);
              return (
                <div
                  key={node.id}
                  className={
                    "graph-node" +
                    (isSelected ? " selected" : "") +
                    (node.isEntry ? " entry" : "") +
                    (runStatus ? ` run-${runStatus.replace(/_/g, "-")}` : "")
                  }
                  style={{
                    left: node.x,
                    top: node.y,
                    zIndex: isSelected ? 4 : 3,
                    cursor: draggingNodeId === node.id ? "grabbing" : "grab",
                  }}
                  onMouseDown={(e) => startNodeDrag(e, node.id, node.x, node.y)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (justDraggedNodeRef.current) {
                      justDraggedNodeRef.current = false;
                      return;
                    }
                    if (!dragging) {
                      selectAgent(node.agentId);
                      setUiPanelOpen("inspector", true);
                    }
                  }}
                  onMouseUp={() => {
                    if (dragging && dragging.from !== node.id && selectedWorkflow) {
                      addWorkflowEdge(selectedWorkflow.id, dragging.from, node.id);
                    }
                    setDragging(null);
                  }}
                >
                  <div className="graph-node-head">
                    <span className="graph-node-dot" style={{ background: node.dot }} />
                    <span className="graph-node-name">{node.name}</span>
                    {node.isEntry && <span className="graph-node-entry-badge">▸ entry</span>}
                  </div>
                  <div className="graph-node-counts">{node.counts}</div>
                  {node.showHandles && (
                    <>
                      <span className="graph-node-handle-in" />
                      <span
                        className="graph-node-handle-out"
                        title={tx("Drag to another step to connect", "Arrastra a otro paso para conectar")}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDragging({ from: node.id, sx: node.x + HW - 4, sy: node.y, px: node.x + HW - 4, py: node.y });
                        }}
                      />
                      {isSelected && (
                        <div className="graph-node-actions">
                          {!node.isEntry && (
                            <span
                              className="graph-node-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (selectedWorkflow) setWorkflowEntryStep(selectedWorkflow.id, node.id);
                              }}
                            >
                              {tx("Set entry", "Marcar entrada")}
                            </span>
                          )}
                          <span
                            className="graph-node-action danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedWorkflow) removeWorkflowStep(selectedWorkflow.id, node.id);
                            }}
                          >
                            {tx("Remove", "Quitar")}
                          </span>
                          <select
                            className="graph-node-language-override"
                            aria-label={tx(
                              "Response language for this workflow step",
                              "Idioma de respuesta para este paso del workflow",
                            )}
                            title={tx(
                              "Overrides the workspace interaction language for this step only.",
                              "Sobrescribe el idioma de interacción del workspace sólo para este paso.",
                            )}
                            value={node.languageOverride || ""}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (!selectedWorkflow) return;
                              const value = e.target.value;
                              setWorkflowNodeLanguageOverride(
                                selectedWorkflow.id,
                                node.id,
                                value === "en" || value === "es" ? value : undefined,
                              );
                            }}
                          >
                            <option value="">
                              {tx("Language: workspace", "Idioma: workspace")}
                            </option>
                            <option value="en">{tx("Language: English", "Idioma: inglés")}</option>
                            <option value="es">{tx("Language: Spanish", "Idioma: español")}</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="graph-zoom-controls">
            <button onClick={() => setZoom((z) => Math.min(200, z + 10))}>+</button>
            <button onClick={() => setZoom((z) => Math.max(20, z - 10))}>−</button>
            <button
              title={tx("Reset pan and zoom.", "Restablece desplazamiento y zoom.")}
              onClick={() => {
                setZoom(100);
                setPan({ x: 40, y: 30 });
              }}
            >
              ⤢
            </button>
          </div>
          <div className="graph-zoom-pct">{zoom}%</div>

          <div
            className="graph-minimap"
            title={tx("Click to jump to that area of the graph.", "Haz click para saltar a esa zona del grafo.")}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - rect.left;
              const py = e.clientY - rect.top;
              const spanX = Math.max(1, minimapBounds.maxX - minimapBounds.minX);
              const spanY = Math.max(1, minimapBounds.maxY - minimapBounds.minY);
              const worldX = minimapBounds.minX + (px / (MINI_W - 22)) * spanX;
              const worldY = minimapBounds.minY + (py / (MINI_H - 14)) * spanY;
              recenterOn(worldX, worldY);
            }}
          >
            {nodes.map((node) => {
              const mini = toMini(node.x, node.y);
              return (
                <div
                  key={`mini-${node.id}`}
                  className="graph-minimap-node"
                  style={{ left: mini.x, top: mini.y, background: node.dot }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
