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
        if (fileType === vscode.FileType.Directory) {
          return collectFilesByPattern(absolutePath, pattern);
        }
        if (fileType === vscode.FileType.File && pattern.test(name)) {
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
