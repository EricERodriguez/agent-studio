import type { HandoffMode } from "./types";

/** Visible, unambiguous label for the persisted workflow handoff mode. */
export function formatWorkflowHandoffLabel(
  label: string | undefined,
  mode: HandoffMode,
): string {
  const icon = mode === "human" ? "👤" : "⚡";
  return label?.trim() ? `${icon} ${label.trim()}` : icon;
}
