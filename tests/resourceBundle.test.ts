import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowDefinition } from "../src/domain/models";
import {
  RESOURCE_REPOSITORY_PATHS,
  isSafeResourceId,
  resourceRepositoryLayout,
  resourceRepositoryReadme,
  resourceRepositoryManifest,
  serializeWorkflowDefinition,
} from "../src/services/resourceBundle";

test("resource repository uses the same paths that Agent Studio discovers", () => {
  const layout = resourceRepositoryLayout("/tmp/my-agent-library");
  assert.equal(layout.agentsDir, "/tmp/my-agent-library/.github/agents");
  assert.equal(
    layout.workflowsDir,
    "/tmp/my-agent-library/.vscode/agent-studio/workflows",
  );
  assert.equal(RESOURCE_REPOSITORY_PATHS.agents, ".github/agents");
  assert.equal(layout.manifestPath, "/tmp/my-agent-library/agent-studio.bundle.json");
});

test("resource repository manifest records the bundle schema and resource counts", () => {
  assert.deepEqual(JSON.parse(resourceRepositoryManifest(2, 3)), {
    schemaVersion: 1,
    kind: "agent-studio-resource-repository",
    mode: "merge",
    exportedAgents: 2,
    exportedWorkflows: 3,
  });
});

test("only filesystem-safe resource identifiers are accepted", () => {
  assert.equal(isSafeResourceId("delivery-flow-2"), true);
  assert.equal(isSafeResourceId("../../outside"), false);
  assert.equal(isSafeResourceId("delivery_flow"), false);
});

test("workflow bundle serialization excludes machine-local discovery metadata", () => {
  const workflow: WorkflowDefinition = {
    id: "delivery",
    name: "Delivery",
    nodes: [{ id: "start", agentId: "planner", position: { x: 0, y: 0 }, isEntry: true }],
    edges: [],
    sourcePath: "/tmp/delivery.json",
    sourceScope: "global",
    shadowedWorkflow: { sourcePath: "/tmp/older.json", sourceScope: "repository" },
  };

  assert.deepEqual(serializeWorkflowDefinition(workflow), {
    id: "delivery",
    name: "Delivery",
    nodes: [{ id: "start", agentId: "planner", position: { x: 0, y: 0 }, isEntry: true }],
    edges: [],
  });
});

test("resource repository README describes both resource types", () => {
  const readme = resourceRepositoryReadme(2, 1);
  assert.match(readme, /2 agent definitions/);
  assert.match(readme, /1 workflow/);
  assert.match(readme, /\.github\/agents/);
  assert.match(readme, /\.vscode\/agent-studio\/workflows/);
});
