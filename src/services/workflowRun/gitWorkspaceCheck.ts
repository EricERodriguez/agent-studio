import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * A VS Code workspace can intentionally be a parent folder that contains several independent
 * repositories. Treat a direct child repository as versioned workspace coverage so the run
 * preflight does not raise a misleading "not a git repository" warning in that common setup.
 */
export async function workspaceContainsGitRepository(cwd: string): Promise<boolean> {
  if (await hasGitMetadata(cwd)) {
    return true;
  }

  let entries;
  try {
    entries = await readdir(cwd, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    if (await hasGitMetadata(join(cwd, entry.name))) {
      return true;
    }
  }

  return false;
}

async function hasGitMetadata(directory: string): Promise<boolean> {
  try {
    await stat(join(directory, ".git"));
    return true;
  } catch {
    return false;
  }
}
