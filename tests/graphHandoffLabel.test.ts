import assert from "node:assert/strict";
import test from "node:test";
import { formatWorkflowHandoffLabel } from "../webview/app/graphHandoffLabel";

test("workflow handoff labels expose both persisted modes", () => {
  assert.equal(formatWorkflowHandoffLabel("handoff", "automatic"), "⚡ handoff");
  assert.equal(formatWorkflowHandoffLabel("handoff", "human"), "👤 handoff");
});

test("workflow handoff labels remain useful when the edge label is blank", () => {
  assert.equal(formatWorkflowHandoffLabel(undefined, "automatic"), "⚡");
  assert.equal(formatWorkflowHandoffLabel("   ", "human"), "👤");
});
