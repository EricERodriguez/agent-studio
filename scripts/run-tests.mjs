import { build } from "esbuild";
import { readdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const sourceDirectory = resolve("tests");
const outputDirectory = resolve(".test-dist");
const entries = (await readdir(sourceDirectory))
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => resolve(sourceDirectory, name));

if (entries.length === 0) {
  throw new Error("No test entry points found in tests/.");
}

await rm(outputDirectory, { recursive: true, force: true });
try {
  await build({
    entryPoints: entries,
    outdir: outputDirectory,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    sourcemap: "inline",
  });
  const files = (await readdir(outputDirectory))
    .filter((name) => name.endsWith(".test.js"))
    .map((name) => resolve(outputDirectory, name));
  const child = spawn(process.execPath, ["--test", ...files], { stdio: "inherit" });
  const exitCode = await new Promise((resolveExit) => child.once("exit", resolveExit));
  process.exitCode = exitCode ?? 1;
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
