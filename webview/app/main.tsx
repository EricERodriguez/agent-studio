import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { useStudioStore } from "./store/useStudioStore";
import type { ExtensionToWebviewMessage } from "./types";
import { vscode } from "./hooks/useVsCodeApi";

window.addEventListener(
  "message",
  (event: MessageEvent<ExtensionToWebviewMessage>) => {
    const message = event.data;
    if (message.type === "state") {
      useStudioStore.getState().setStateFromExtension(message.payload);
    }
    if (message.type === "info") {
      useStudioStore.getState().setInfoMessage(message.payload.message);
      setTimeout(
        () => useStudioStore.getState().setInfoMessage(undefined),
        2500,
      );
    }
    if (message.type === "error") {
      useStudioStore.getState().setErrorMessage(message.payload.message);
      setTimeout(
        () => useStudioStore.getState().setErrorMessage(undefined),
        3500,
      );
    }
    if (message.type === "workflowRunUpdate") {
      useStudioStore.getState().setWorkflowRun(message.payload);
    }
    if (message.type === "focusAgentEditor") {
      useStudioStore.getState().selectAgent(message.payload.agentId);
      useStudioStore.getState().setTab(message.payload.tab || "Identity");
      useStudioStore.getState().setUiPanelOpen("agentBuilder", true);
      useStudioStore.getState().setUiPanelOpen("inspector", true);
      useStudioStore.getState().setInfoMessage("Agent ready to edit.");
      setTimeout(
        () => useStudioStore.getState().setInfoMessage(undefined),
        2000,
      );
    }
    if (message.type === "focusCapability") {
      useStudioStore.getState().setCapabilityGraphVisible(true);
      useStudioStore.getState().setSelectedCapability(message.payload.id);
      useStudioStore.getState().setUiPanelOpen("agentBuilder", true);
      useStudioStore.getState().setUiPanelOpen("inspector", true);

      if (message.payload.kind === "tool") {
        useStudioStore.getState().setFilter("toolId", message.payload.id);
        useStudioStore.getState().setFilter("skillId", undefined);
        useStudioStore.getState().setFilter("mcpId", undefined);
        useStudioStore.getState().setActiveCapabilityPane("tool");
      }
      if (message.payload.kind === "skill") {
        useStudioStore.getState().setFilter("toolId", undefined);
        useStudioStore.getState().setFilter("skillId", message.payload.id);
        useStudioStore.getState().setFilter("mcpId", undefined);
        useStudioStore.getState().setActiveCapabilityPane("skill");
      }
      if (message.payload.kind === "mcp") {
        useStudioStore.getState().setFilter("toolId", undefined);
        useStudioStore.getState().setFilter("skillId", undefined);
        useStudioStore.getState().setFilter("mcpId", message.payload.id);
        useStudioStore.getState().setActiveCapabilityPane("mcp");
      }

      useStudioStore.getState().setTab("Capabilities");
      useStudioStore
        .getState()
        .setInfoMessage("Capability highlighted from sidebar.");
      setTimeout(
        () => useStudioStore.getState().setInfoMessage(undefined),
        2200,
      );
    }
    if (message.type === "focusWorkflow") {
      useStudioStore.getState().selectWorkflow(message.payload.workflowId);
      useStudioStore.getState().setUiPanelOpen("workflowBuilder", true);
      useStudioStore.getState().setUiPanelOpen("workflowGraph", true);
      useStudioStore.getState().setInfoMessage("Workflow ready to edit.");
      setTimeout(
        () => useStudioStore.getState().setInfoMessage(undefined),
        2200,
      );
    }
  },
);

vscode?.postMessage({ type: "ready" });

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
