import assert from "node:assert/strict";
import test from "node:test";
import type { AgentDefinition } from "../src/domain/models";
import { buildWorkflowFromTemplate } from "../src/services/workflowTemplates";

const noExistingAgents: AgentDefinition[] = [];

test("Two-Pack is a linear Coder to Cleaner workflow", () => {
  const built = buildWorkflowFromTemplate("two-pack", "Two Pack", noExistingAgents, () => false);
  assert.deepEqual(built.workflow.nodes.map((node) => node.agentId), ["coder", "cleaner"]);
  assert.equal(built.workflow.edges.length, 1);
  assert.equal(built.workflow.edges[0].handoff, undefined);
  assert.deepEqual(built.agentsToCreate.map((agent) => agent.id), ["coder", "cleaner"]);
});

test("Four-Pack and Six-Pack preserve their human gates", () => {
  const four = buildWorkflowFromTemplate("four-pack", "Four Pack", noExistingAgents, () => false);
  const six = buildWorkflowFromTemplate("six-pack", "Six Pack", noExistingAgents, () => false);
  assert.equal(four.workflow.edges[0].handoff?.mode, "human");
  assert.equal(six.workflow.edges.at(-1)?.handoff?.mode, "human");
  assert.equal(six.workflow.nodes.length, 6);
});

test("existing agents are reused and workflow id collisions receive a numeric suffix", () => {
  const existingCoder = buildWorkflowFromTemplate("two-pack", "Seed", noExistingAgents, () => false)
    .agentsToCreate.find((agent) => agent.id === "coder");
  assert.ok(existingCoder);
  const built = buildWorkflowFromTemplate(
    "two-pack",
    "Two Pack",
    [existingCoder],
    (id) => id === "two-pack",
  );
  assert.equal(built.workflow.id, "two-pack-2");
  assert.deepEqual(built.agentsToCreate.map((agent) => agent.id), ["cleaner"]);
});
