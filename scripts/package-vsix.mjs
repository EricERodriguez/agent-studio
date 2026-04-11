import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const isDryRun = process.argv.includes("--dry-run");

const readPackageJson = () => {
  const packageJsonPath = path.join(repoRoot, "package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
};

const nextPatchVersion = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(
      `Unsupported version format '${version}'. Expected semantic version like x.y.z`,
    );
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `${major}.${minor}.${patch}`;
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
const targetVersion = nextPatchVersion(currentVersion);

if (isDryRun) {
  const packageName = readPackageJson().name;
  const outputFile = `${packageName}-${targetVersion}.vsix`;

  console.log("Dry run:");
  console.log(`- Current version: ${currentVersion}`);
  console.log(`- Next version: ${targetVersion}`);
  console.log(`- VSIX output: ${outputFile}`);
  process.exit(0);
}

run(
  npmCmd,
  ["version", "patch", "--no-git-tag-version"],
  "Bumping patch version",
);
run(npmCmd, ["run", "build"], "Building extension and webview");

const packageJson = readPackageJson();
const outputFile = `${packageJson.name}-${packageJson.version}.vsix`;

run(npxCmd, ["@vscode/vsce", "package", "--out", outputFile], "Packaging VSIX");

console.log(`\nVSIX generated successfully: ${outputFile}`);
