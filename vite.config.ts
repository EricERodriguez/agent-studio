import react from "@vitejs/plugin-react";
import path from "path";

const config = {
  plugins: [react()],
  root: path.resolve(__dirname, "webview"),
  build: {
    outDir: path.resolve(__dirname, "webview-dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/main.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "webview/app"),
    },
  },
};

export default config;
