import type { AgentDefinition, InteractionLanguage } from "../domain/models";
import { interactionLanguageInstruction } from "./interactionLanguage";

/** Pure prompt construction shared by Chat and workflow providers. */
export function buildAgentPrompt(
  agent: AgentDefinition,
  interactionLanguage: InteractionLanguage,
): string {
  return [
    `Agent: ${agent.name}`,
    agent.description ? `Description: ${agent.description}` : "",
    agent.role ? `Role: ${agent.role}` : "",
    "",
    "Instructions:",
    agent.instructions,
    "",
    interactionLanguageInstruction(interactionLanguage),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWorkflowTurnPrompt(
  agent: AgentDefinition,
  objective: string,
  previousStepOutput: string | undefined,
  interactionLanguage: InteractionLanguage,
): string {
  return [
    buildAgentPrompt(agent, interactionLanguage),
    "",
    "Task:",
    objective,
    previousStepOutput ? `\nPrevious agent's output:\n${previousStepOutput}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
