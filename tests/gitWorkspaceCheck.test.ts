import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { workspaceContainsGitRepository } from "../src/services/workflowRun/gitWorkspaceCheck";

test("recognizes a repository at the workspace root", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-studio-git-workspace-test-"));
  try {
    await mkdir(join(directory, ".git"));
    assert.equal(await workspaceContainsGitRepository(directory), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("recognizes repositories directly inside a multi-repository workspace", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-studio-git-workspace-test-"));
  try {
    await mkdir(join(directory, "api", ".git"), { recursive: true });
    await mkdir(join(directory, "web"));
    assert.equal(await workspaceContainsGitRepository(directory), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not treat an unversioned workspace as a repository", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-studio-git-workspace-test-"));
  try {
    await mkdir(join(directory, "plain-project"));
    await writeFile(join(directory, "README.md"), "workspace", "utf8");
    assert.equal(await workspaceContainsGitRepository(directory), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
