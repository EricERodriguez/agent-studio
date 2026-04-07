import { create } from "zustand";
import { applyEdgeChanges, applyNodeChanges, addEdge } from "reactflow";
import type {
  AgentDefinition,
  BuilderTab,
  CapabilityGraph,
  WorkflowDefinition,
} from "../types";

interface Filters {
  toolId?: string;
  skillId?: string;
  mcpId?: string;
}

interface StudioState {
  agents: AgentDefinition[];
  workflows: WorkflowDefinition[];
  capabilityGraph: CapabilityGraph;
  selectedAgentId?: string;
  selectedWorkflowId?: string;
  selectedNodeId?: string;
  selectedCapabilityId?: string;
  selectedTab: BuilderTab;
  showCapabilityGraph: boolean;
  filters: Filters;
  infoMessage?: string;
  errorMessage?: string;
  setStateFromExtension: (payload: {
    agents: AgentDefinition[];
    workflows: WorkflowDefinition[];
    capabilityGraph: CapabilityGraph;
  }) => void;
  selectAgent: (agentId?: string) => void;
  selectWorkflow: (workflowId?: string) => void;
  setTab: (tab: BuilderTab) => void;
  upsertAgent: (agent: AgentDefinition) => void;
  setWorkflowNodes: (
    workflowId: string,
    changes: Parameters<typeof applyNodeChanges>[0],
  ) => void;
  setWorkflowEdges: (
    workflowId: string,
    changes: Parameters<typeof applyEdgeChanges>[0],
  ) => void;
  connectWorkflowEdge: (
    workflowId: string,
    connection: { source?: string | null; target?: string | null },
  ) => void;
  setFilter: (key: keyof Filters, value?: string) => void;
  setSelectedCapability: (capabilityId?: string) => void;
  toggleCapabilityGraph: () => void;
  autoLayoutWorkflow: (workflowId: string) => void;
  setInfoMessage: (message?: string) => void;
  setErrorMessage: (message?: string) => void;
}

const emptyGraph: CapabilityGraph = {
  tools: [],
  skills: [],
  mcpServers: [],
  usage: { tools: {}, skills: {}, mcpServers: {} },
};

export const useStudioStore = create<StudioState>((set, get) => ({
  agents: [],
  workflows: [],
  capabilityGraph: emptyGraph,
  selectedTab: "Identity",
  showCapabilityGraph: false,
  filters: {},
  setStateFromExtension: ({ agents, workflows, capabilityGraph }) =>
    set((state) => ({
      agents,
      workflows,
      capabilityGraph,
      selectedAgentId: state.selectedAgentId || agents[0]?.id,
      selectedWorkflowId: state.selectedWorkflowId || workflows[0]?.id,
    })),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
  selectWorkflow: (selectedWorkflowId) => set({ selectedWorkflowId }),
  setTab: (selectedTab) => set({ selectedTab }),
  upsertAgent: (agent) =>
    set((state) => ({
      agents: state.agents.some((candidate) => candidate.id === agent.id)
        ? state.agents.map((candidate) =>
            candidate.id === agent.id ? agent : candidate,
          )
        : [...state.agents, agent],
      selectedAgentId: agent.id,
    })),
  setWorkflowNodes: (workflowId, changes) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }
        const nodes = applyNodeChanges(
          changes,
          workflow.nodes.map((node) => ({
            ...node,
            data: { label: node.agentId },
          })) as any,
        ).map((node: any) => ({
          id: node.id,
          agentId:
            node.data?.agentId ||
            node.data?.label ||
            workflow.nodes.find((n) => n.id === node.id)?.agentId ||
            "",
          position: node.position,
          isEntry: workflow.nodes.find((n) => n.id === node.id)?.isEntry,
        }));
        return { ...workflow, nodes };
      }),
    })),
  setWorkflowEdges: (workflowId, changes) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }
        return {
          ...workflow,
          edges: applyEdgeChanges(changes, workflow.edges as any) as any,
        };
      }),
    })),
  connectWorkflowEdge: (workflowId, connection) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }
        const edges = addEdge(
          {
            id: `e-${Date.now()}`,
            source: connection.source || "",
            target: connection.target || "",
            label: "handoff",
          },
          workflow.edges as any,
        ) as any;
        return { ...workflow, edges };
      }),
    })),
  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value || undefined,
      },
    })),
  setSelectedCapability: (selectedCapabilityId) =>
    set({ selectedCapabilityId }),
  toggleCapabilityGraph: () =>
    set((state) => ({ showCapabilityGraph: !state.showCapabilityGraph })),
  autoLayoutWorkflow: (workflowId) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }

        return {
          ...workflow,
          nodes: workflow.nodes.map((node, index) => ({
            ...node,
            position: { x: 140 + index * 230, y: 150 },
          })),
        };
      }),
    })),
  setInfoMessage: (infoMessage) => set({ infoMessage }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
}));

export const selectors = {
  selectedAgent: (state: StudioState) =>
    state.agents.find((agent) => agent.id === state.selectedAgentId),
  selectedWorkflow: (state: StudioState) =>
    state.workflows.find(
      (workflow) => workflow.id === state.selectedWorkflowId,
    ),
};
