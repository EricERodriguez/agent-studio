import type { AgentDefinition, WorkflowDefinition } from "../domain/models";
import { AgentRegistryService } from "./agentRegistryService";
import { WorkflowService } from "./workflowService";

export class SampleDataService {
  constructor(
    private readonly agentRegistryService: AgentRegistryService,
    private readonly workflowService: WorkflowService
  ) {}

  async seedIfNeeded(existingAgents: AgentDefinition[], existingWorkflows: WorkflowDefinition[]): Promise<void> {
    if (existingAgents.length === 0) {
      await Promise.all([this.createPlanner(), this.createBackendImplementer(), this.createReviewer()]);
    }

    if (existingWorkflows.length === 0) {
      await this.workflowService.saveWorkflow({
        id: "feature-delivery-flow",
        name: "Feature Delivery Flow",
        description: "Plan -> Implement -> Review handoff workflow",
        nodes: [
          { id: "n1", agentId: "planner", position: { x: 100, y: 120 }, isEntry: true },
          { id: "n2", agentId: "backend-implementer", position: { x: 360, y: 120 } },
          { id: "n3", agentId: "reviewer", position: { x: 620, y: 120 } }
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2", label: "handoff" },
          { id: "e2", source: "n2", target: "n3", label: "handoff" }
        ]
      });
    }
  }

  private createPlanner(): Promise<AgentDefinition> {
    return this.agentRegistryService.saveAgent({
      id: "planner",
      name: "Planner",
      description: "Turns goals into sequenced implementation plans.",
      role: "planning",
      instructions: "Break requirements into actionable tasks, identify risks, and define acceptance criteria.",
      handoffs: ["backend-implementer"],
      tags: ["planning", "delivery"],
      capabilities: {
        tools: [
          { id: "semantic_search", label: "Semantic Search", kind: "built-in" },
          { id: "manage_todo_list", label: "Todo Manager", kind: "built-in" }
        ],
        skills: [{ id: "task-decomposition", label: "Task Decomposition" }],
        mcpServers: []
      }
    });
  }

  private createBackendImplementer(): Promise<AgentDefinition> {
    return this.agentRegistryService.saveAgent({
      id: "backend-implementer",
      name: "Backend Implementer",
      description: "Implements code changes and validates behavior.",
      role: "implementation",
      instructions: "Implement changes incrementally, run validations, and keep edits focused.",
      handoffs: ["reviewer"],
      tags: ["implementation", "typescript"],
      capabilities: {
        tools: [
          { id: "apply_patch", label: "Apply Patch", kind: "built-in" },
          { id: "run_in_terminal", label: "Run in Terminal", kind: "built-in" }
        ],
        skills: [{ id: "safe-editing", label: "Safe Editing" }],
        mcpServers: []
      }
    });
  }

  private createReviewer(): Promise<AgentDefinition> {
    return this.agentRegistryService.saveAgent({
      id: "reviewer",
      name: "Reviewer",
      description: "Evaluates quality, risks, and regressions before merge.",
      role: "review",
      instructions: "Review for bugs, regressions, and test coverage. Provide concise actionable findings.",
      handoffs: [],
      tags: ["quality", "review"],
      capabilities: {
        tools: [
          { id: "get_errors", label: "Problems", kind: "built-in" },
          { id: "get_changed_files", label: "Git Changes", kind: "built-in" }
        ],
        skills: [{ id: "code-review", label: "Code Review" }],
        mcpServers: []
      }
    });
  }
}
