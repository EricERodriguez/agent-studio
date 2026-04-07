type VsCodeApi = {
  postMessage: (message: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

export const vscode = window.acquireVsCodeApi
  ? window.acquireVsCodeApi()
  : undefined;
