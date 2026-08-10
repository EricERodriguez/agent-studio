import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { WorkflowDefinition } from "../src/domain/models";
import type { WorkflowRunState } from "../src/domain/messages";
import { WorkflowRunHistoryService } from "../src/services/workflowRun/workflowRunHistoryService";

const workflow: WorkflowDefinition = {
  id: "test-workflow",
  name: "Test Workflow",
  nodes: [{ id: "n1", agentId: "agent", position: { x: 0, y: 0 }, isEntry: true }],
  edges: [],
};

function state(status: WorkflowRunState["status"], stepStatus: WorkflowRunState["steps"][number]["status"]): WorkflowRunState {
  return {
    runId: "run-1",
    workflowId: workflow.id,
    mode: "cli-claude",
    status,
    startedAt: 1,
    steps: [{ nodeId: "n1", agentId: "agent", agentName: "Agent", status: stepStatus }],
  };
}

test("recovery turns active work into inspection-only interrupted state and rewrites the manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-studio-history-test-"));
  try {
    const service = new WorkflowRunHistoryService(directory);
    await service.persist(state("running", "running"), workflow, "Test objective");
    const recovered = await service.recover();
    assert.equal(recovered.warnings.length, 0);
    assert.equal(recovered.runs[0].status, "interrupted");
    assert.equal(recovered.runs[0].steps[0].status, "interrupted");
    const manifest = JSON.parse(await readFile(join(directory, "run-1", "manifest.json"), "utf8"));
    assert.equal(manifest.state.status, "interrupted");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("invalid manifests are ignored with a warning without blocking valid recovered runs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-studio-history-test-"));
  try {
    const service = new WorkflowRunHistoryService(directory);
    await service.persist(state("completed", "completed"), workflow, "Done");
    const corruptDirectory = join(directory, "corrupt");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(corruptDirectory));
    await writeFile(join(corruptDirectory, "manifest.json"), "not json", "utf8");
    const recovered = await service.recover();
    assert.equal(recovered.runs.length, 1);
    assert.equal(recovered.runs[0].status, "completed");
    assert.equal(recovered.warnings.length, 1);
    assert.match(recovered.warnings[0], /Ignored invalid workflow-run manifest/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
