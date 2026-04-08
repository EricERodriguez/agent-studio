import React, { useMemo, useEffect, useState } from "react";
import ReactFlow, {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { useStudioStore, selectors } from "../store/useStudioStore";

interface GraphCanvasProps {
  mode: "agent" | "workflow";
}

export function GraphCanvas({ mode }: GraphCanvasProps): React.JSX.Element {
  const agents = useStudioStore((s) => s.agents);
  const selectedWorkflow = useStudioStore(selectors.selectedWorkflow);
  const setWorkflowNodes = useStudioStore((s) => s.setWorkflowNodes);
  const setWorkflowEdges = useStudioStore((s) => s.setWorkflowEdges);
  const connectWorkflowEdge = useStudioStore((s) => s.connectWorkflowEdge);
  const selectAgent = useStudioStore((s) => s.selectAgent);

  const graph = useMemo(() => {
    if (mode === "workflow" && selectedWorkflow) {
      const nodes: Node[] = selectedWorkflow.nodes.map((node) => {
        const agent = agents.find((candidate) => candidate.id === node.agentId);
        return {
          id: node.id,
          position: node.position,
          data: {
            label: agent?.name ?? node.agentId,
            agentId: node.agentId,
            entry: node.isEntry,
          },
          style: {
            border: node.isEntry
              ? "2px solid var(--vscode-charts-green)"
              : "1px solid var(--vscode-panel-border)",
            borderRadius: 8,
            padding: 8,
            background: "var(--vscode-editor-background)",
            color: "var(--vscode-editor-foreground)",
            minWidth: 160,
          },
        };
      });

      const edges: Edge[] = selectedWorkflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: false,
      }));

      return { nodes, edges };
    }

    const nodes: Node[] = agents.map((agent, index) => ({
      id: agent.id,
      position: { x: 50 + index * 280, y: 80 },
      data: {
        label: `${agent.name}  T:${agent.capabilities.tools.length} S:${agent.capabilities.skills.length} M:${agent.capabilities.mcpServers.length}`,
        role: agent.role,
      },
      style: {
        border: "1px solid var(--vscode-panel-border)",
        borderRadius: 10,
        padding: 12,
        minWidth: 180,
        background: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
      },
    }));

    const edges: Edge[] = agents.flatMap((agent) =>
      agent.handoffs
        .filter((target) => agents.some((candidate) => candidate.id === target))
        .map((target) => ({
          id: `${agent.id}->${target}`,
          source: agent.id,
          target,
          label: "handoff",
        })),
    );

    return { nodes, edges };
  }, [agents, mode, selectedWorkflow]);

  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setRfNodes(graph.nodes);
    setRfEdges(graph.edges);
  }, [graph.nodes, graph.edges, mode, selectedWorkflow?.id]);

  const onNodesChange = (changes: NodeChange[]): void => {
    setRfNodes((current) => applyNodeChanges(changes, current));

    if (!selectedWorkflow || mode !== "workflow") {
      return;
    }

    const workflowChanges = changes.filter(
      (change) =>
        change.type === "position" ||
        change.type === "remove" ||
        change.type === "add" ||
        change.type === "reset",
    );

    if (workflowChanges.length > 0) {
      setWorkflowNodes(selectedWorkflow.id, workflowChanges);
    }
  };

  const onEdgesChange = (changes: EdgeChange[]): void => {
    setRfEdges((current) => applyEdgeChanges(changes, current));

    if (!selectedWorkflow || mode !== "workflow") {
      return;
    }

    const workflowChanges = changes.filter(
      (change) =>
        change.type === "remove" ||
        change.type === "add" ||
        change.type === "reset",
    );

    if (workflowChanges.length > 0) {
      setWorkflowEdges(selectedWorkflow.id, workflowChanges);
    }
  };

  const onConnect = (connection: Connection): void => {
    if (!selectedWorkflow) return;
    connectWorkflowEdge(selectedWorkflow.id, connection);
  };

  const isEmptyAgentGraph = mode === "agent" && graph.nodes.length === 0;
  const isEmptyWorkflowGraph =
    mode === "workflow" && (!selectedWorkflow || graph.nodes.length === 0);

  if (isEmptyAgentGraph || isEmptyWorkflowGraph) {
    return (
      <div className="graph-canvas empty-state">
        {isEmptyAgentGraph && (
          <p>
            No agents found. Create one from Templates or place a{" "}
            <code>.agent.md</code> file under <code>.github/agents</code> (or{" "}
            <code>.github/chatmodes</code> for legacy files).
          </p>
        )}
        {isEmptyWorkflowGraph && (
          <p>
            No workflow to render. Create a workflow from the dashboard to see
            nodes and connections here.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="graph-canvas">
      <ReactFlow
        key={`${mode}-${selectedWorkflow?.id ?? "none"}`}
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        onNodeClick={(_, node) => {
          const agentId =
            mode === "workflow" ? (node.data?.agentId as string) : node.id;
          if (agentId) selectAgent(agentId);
        }}
      >
        <MiniMap
          pannable
          style={{ backgroundColor: "#1e1e2e" }}
          nodeColor="#6c6f93"
          maskColor="rgba(0,0,0,0.4)"
        />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
