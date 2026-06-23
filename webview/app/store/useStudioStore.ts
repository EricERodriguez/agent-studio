import { create } from "zustand";
import type {
  AgentDefinition,
  BuilderTab,
  CapabilityGraph,
  WorkflowRunState,
  WorkflowDefinition,
} from "../types";

interface Filters {
  toolId?: string;
  skillId?: string;
  mcpId?: string;
  scope?: "repository" | "global";
}

interface UiPanels {
  inspector: boolean;
}

type CenterView = "choose" | "editor" | "graph" | "inspect";
type GraphMode = "agent" | "workflow";

interface StudioState {
  agents: AgentDefinition[];
  workflows: WorkflowDefinition[];
  capabilityGraph: CapabilityGraph;
  selectedAgentId?: string;
  selectedWorkflowId?: string;
  selectedNodeId?: string;
  selectedCapabilityId?: string;
  activeCapabilityPane: "tool" | "skill" | "mcp";
  selectedTab: BuilderTab;
  uiPanels: UiPanels;
  centerView: CenterView;
  graphMode: GraphMode;
  filters: Filters;
  infoMessage?: string;
  errorMessage?: string;
  workflowRun?: WorkflowRunState;
  setStateFromExtension: (payload: {
    agents: AgentDefinition[];
    workflows: WorkflowDefinition[];
    capabilityGraph: CapabilityGraph;
  }) => void;
  selectAgent: (agentId?: string) => void;
  selectWorkflow: (workflowId?: string) => void;
  setTab: (tab: BuilderTab) => void;
  upsertAgent: (agent: AgentDefinition) => void;
  moveWorkflowNode: (
    workflowId: string,
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  addWorkflowEdge: (
    workflowId: string,
    source: string,
    target: string,
    label?: string,
  ) => void;
  removeWorkflowEdge: (workflowId: string, edgeId: string) => void;
  addWorkflowStep: (workflowId: string, agentId: string) => void;
  removeWorkflowStep: (workflowId: string, nodeId: string) => void;
  setWorkflowEntryStep: (workflowId: string, nodeId: string) => void;
  updateWorkflowMeta: (
    workflowId: string,
    meta: {
      name?: string;
      description?: string;
      sourceScope?: "repository" | "global";
    },
  ) => void;
  setFilter: (key: keyof Filters, value?: string) => void;
  setSelectedCapability: (capabilityId?: string) => void;
  setActiveCapabilityPane: (pane: "tool" | "skill" | "mcp") => void;
  setUiPanelOpen: (panel: keyof UiPanels, open: boolean) => void;
  setCenterView: (view: CenterView) => void;
  setGraphMode: (mode: GraphMode) => void;
  autoLayoutWorkflow: (workflowId: string) => void;
  setInfoMessage: (message?: string) => void;
  setErrorMessage: (message?: string) => void;
  setWorkflowRun: (run?: WorkflowRunState) => void;
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
  activeCapabilityPane: "tool",
  centerView: "editor",
  graphMode: "agent",
  uiPanels: {
    inspector: true,
  },
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
  moveWorkflowNode: (workflowId, nodeId, position) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }
        return {
          ...workflow,
          nodes: workflow.nodes.map((node) =>
            node.id === nodeId ? { ...node, position } : node,
          ),
        };
      }),
    })),
  addWorkflowEdge: (workflowId, source, target, label = "handoff") =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId || source === target) {
          return workflow;
        }
        const exists = workflow.edges.some(
          (edge) => edge.source === source && edge.target === target,
        );
        if (exists) {
          return workflow;
        }
        return {
          ...workflow,
          edges: [
            ...workflow.edges,
            { id: `e-${Date.now()}`, source, target, label },
          ],
        };
      }),
    })),
  removeWorkflowEdge: (workflowId, edgeId) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id !== workflowId
          ? workflow
          : {
              ...workflow,
              edges: workflow.edges.filter((edge) => edge.id !== edgeId),
            },
      ),
    })),
  addWorkflowStep: (workflowId, agentId) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId) return workflow;
        const isFirst = workflow.nodes.length === 0;
        const newNode = {
          id: `step-${Date.now()}`,
          agentId,
          position: { x: 300 + workflow.nodes.length * 230, y: 150 },
          isEntry: isFirst,
        };
        return { ...workflow, nodes: [...workflow.nodes, newNode] };
      }),
    })),
  removeWorkflowStep: (workflowId, nodeId) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId) return workflow;
        const nodes = workflow.nodes.filter((n) => n.id !== nodeId);
        const edges = workflow.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        );
        // If we removed the entry, make the first remaining node entry
        const hasEntry = nodes.some((n) => n.isEntry);
        return {
          ...workflow,
          nodes: hasEntry
            ? nodes
            : nodes.map((n, i) => ({ ...n, isEntry: i === 0 })),
          edges,
        };
      }),
    })),
  setWorkflowEntryStep: (workflowId, nodeId) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) => {
        if (workflow.id !== workflowId) return workflow;
        return {
          ...workflow,
          nodes: workflow.nodes.map((n) => ({
            ...n,
            isEntry: n.id === nodeId,
          })),
        };
      }),
    })),
  updateWorkflowMeta: (workflowId, meta) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id !== workflowId ? workflow : { ...workflow, ...meta },
      ),
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
  setActiveCapabilityPane: (activeCapabilityPane) =>
    set({ activeCapabilityPane }),
  setUiPanelOpen: (panel, open) =>
    set((state) => ({
      uiPanels: {
        ...state.uiPanels,
        [panel]: open,
      },
    })),
  setCenterView: (centerView) => set({ centerView }),
  setGraphMode: (graphMode) => set({ graphMode }),
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
            position: { x: 300 + index * 230, y: 150 },
          })),
        };
      }),
    })),
  setInfoMessage: (infoMessage) => set({ infoMessage }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setWorkflowRun: (workflowRun) => set({ workflowRun }),
}));

export const selectors = {
  selectedAgent: (state: StudioState) =>
    state.agents.find((agent) => agent.id === state.selectedAgentId),
  selectedWorkflow: (state: StudioState) =>
    state.workflows.find(
      (workflow) => workflow.id === state.selectedWorkflowId,
    ),
};
