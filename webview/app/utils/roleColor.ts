const ROLE_PALETTE = [
  "var(--vscode-charts-blue)",
  "var(--vscode-charts-green)",
  "var(--vscode-charts-orange)",
  "var(--vscode-charts-purple)",
  "var(--vscode-charts-red)",
  "var(--vscode-charts-yellow)",
];

export function roleColor(role?: string): string {
  if (!role) {
    return ROLE_PALETTE[0];
  }
  let hash = 0;
  for (let i = 0; i < role.length; i += 1) {
    hash = (hash * 31 + role.charCodeAt(i)) >>> 0;
  }
  return ROLE_PALETTE[hash % ROLE_PALETTE.length];
}
