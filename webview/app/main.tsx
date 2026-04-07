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
  },
);

vscode?.postMessage({ type: "ready" });

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
