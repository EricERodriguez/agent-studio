import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange
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
            label: agent?.name || node.agentId,
            agentId: node.agentId,
            entry: node.isEntry
          },
          style: {
            border: node.isEntry ? "2px solid var(--vscode-charts-green)" : "1px solid var(--vscode-panel-border)",
            borderRadius: 8,
            padding: 8,
            background: "var(--vscode-editor-background)",
            color: "var(--vscode-editor-foreground)",
            minWidth: 160
          }
        };
      });

      const edges: Edge[] = selectedWorkflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: false
      }));

      return { nodes, edges };
    }

    const nodes: Node[] = agents.map((agent, index) => ({
      id: agent.id,
      position: { x: 120 + index * 250, y: 150 },
      data: {
        label: agent.name,
        role: agent.role,
        toolsCount: agent.capabilities.tools.length,
        skillsCount: agent.capabilities.skills.length,
        mcpCount: agent.capabilities.mcpServers.length
      },
      style: {
        border: "1px solid var(--vscode-panel-border)",
        borderRadius: 10,
        padding: 12,
        minWidth: 200,
        background: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)"
      }
    }));

    const edges: Edge[] = agents.flatMap((agent) =>
      agent.handoffs
        .filter((target) => agents.some((candidate) => candidate.id === target))
        .map((target) => ({
          id: `${agent.id}-${target}`,
          source: agent.id,
          target,
          label: "handoff"
        }))
    );

    return { nodes, edges };
  }, [agents, mode, selectedWorkflow]);

  const onNodesChange = (changes: NodeChange[]): void => {
    if (!selectedWorkflow) {
      return;
    }
    setWorkflowNodes(selectedWorkflow.id, changes);
  };

  const onEdgesChange = (changes: EdgeChange[]): void => {
    if (!selectedWorkflow) {
      return;
    }
    setWorkflowEdges(selectedWorkflow.id, changes);
  };

  const onConnect = (connection: Connection): void => {
    if (!selectedWorkflow) {
      return;
    }
    connectWorkflowEdge(selectedWorkflow.id, connection);
  };

  return (
    <div className="graph-canvas">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          const agentId = mode === "workflow" ? (node.data?.agentId as string) : node.id;
          if (agentId) {
            selectAgent(agentId);
          }
        }}
        fitView
      >
        <MiniMap pannable />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
