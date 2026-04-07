import * as vscode from "vscode";
import * as path from "path";

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
}

export function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

export function fileNameWithoutExt(filePath: string): string {
  const name = path.basename(filePath);
  return name.replace(/\.agent\.md$/i, "").replace(/\.md$/i, "");
}

export function toAgentId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "agent";
}
