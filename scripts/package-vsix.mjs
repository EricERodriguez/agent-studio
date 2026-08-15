import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const isDryRun = process.argv.includes("--dry-run");

const readPackageJson = () => {
  const packageJsonPath = path.join(repoRoot, "package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
};

const run = (command, args, label) => {
  console.log(`\n> ${label}`);
  console.log(`$ ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}`,
    );
  }
};

const currentVersion = readPackageJson().version;
const packageName = readPackageJson().name;
const outputFile = `${packageName}-${currentVersion}.vsix`;

if (isDryRun) {
  console.log("Dry run:");
  console.log(`- Package version: ${currentVersion}`);
  console.log(`- VSIX output: ${outputFile}`);
  process.exit(0);
}

run(npmCmd, ["run", "build"], "Building extension and webview");

run(
  npmCmd,
  ["exec", "--offline", "@vscode/vsce", "--", "package", "--out", outputFile],
  "Packaging VSIX",
);

console.log(`\nVSIX generated successfully: ${outputFile}`);
