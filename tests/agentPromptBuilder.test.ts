import assert from "node:assert/strict";
import test from "node:test";
import type { AgentDefinition } from "../src/domain/models";
import { buildAgentPrompt, buildWorkflowTurnPrompt } from "../src/services/agentPromptBuilder";

const agent: AgentDefinition = {
  id: "test-agent",
  name: "Test Agent",
  description: "Used only for prompt tests.",
  role: "testing",
  instructions: "Verify observable behavior.",
  handoffs: [],
  tags: [],
  capabilities: { tools: [], skills: [], mcpServers: [] },
};

test("Chat prompt includes the language instruction", () => {
  const prompt = buildAgentPrompt(agent, "es");
  assert.match(prompt, /Agent: Test Agent/);
  assert.match(prompt, /final answers in Spanish/);
});

test("workflow prompt keeps language instruction, objective, and predecessor output", () => {
  const prompt = buildWorkflowTurnPrompt(agent, "Ship it", "Previous answer", "en");
  assert.match(prompt, /final answers in English/);
  assert.match(prompt, /Task:\nShip it/);
  assert.match(prompt, /Previous agent's output:\nPrevious answer/);
});
