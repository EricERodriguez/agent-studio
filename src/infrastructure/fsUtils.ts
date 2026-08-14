import * as vscode from "vscode";
import * as path from "path";

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function getHomeDir(): string | undefined {
  return process.env.HOME || process.env.USERPROFILE;
}

export function getGlobalAgentsRoot(): string | undefined {
  const home = getHomeDir();
  if (!home) {
    return undefined;
  }

  return path.join(home, ".agents", "agents");
}

export function getClaudeGlobalAgentsRoot(): string | undefined {
  const home = getHomeDir();
  if (!home) {
    return undefined;
  }

  return path.join(home, ".claude", "agents");
}

export function getGlobalWorkflowsRoot(): string | undefined {
  const home = getHomeDir();
  if (!home) {
    return undefined;
  }

  return path.join(home, ".agents", "workflows");
}

/**
 * Optional shared library for global resources. It is intentionally a normal
 * repository path, not a separate storage format: a user can commit, clone,
 * and open it in VS Code like any other project.
 */
export function getResourceRepositoryRoot(): string | undefined {
  const configured = vscode.workspace
    .getConfiguration("agentStudio")
    .get<string>("resourceRepository", "")
    .trim();
  return configured || undefined;
}

export function isWithinDirectory(filePath: string, directory: string): boolean {
  const relative = path.relative(directory, filePath);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
}

export async function collectFilesByPattern(
  dirPath: string,
  pattern: RegExp,
): Promise<vscode.Uri[]> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(dirPath),
    );
    const files = await Promise.all(
      entries.map(async ([name, fileType]) => {
        const absolutePath = path.join(dirPath, name);
        // Bitwise checks: VS Code OR's in FileType.SymbolicLink for symlinked
        // entries, so a strict `=== FileType.File` (or `.Directory`) check
        // silently skips anything symlinked (e.g. a shared agents/workflows repo).
        if (fileType & vscode.FileType.Directory) {
          return collectFilesByPattern(absolutePath, pattern);
        }
        if (fileType & vscode.FileType.File && pattern.test(name)) {
          return [vscode.Uri.file(absolutePath)];
        }
        return [] as vscode.Uri[];
      }),
    );
    return files.flat();
  } catch {
    return [];
  }
}

export function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

export function fileNameWithoutExt(filePath: string): string {
  const name = path.basename(filePath);
  return name.replace(/\.agent\.md$/i, "").replace(/\.md$/i, "");
}

export function toAgentId(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent"
  );
}
