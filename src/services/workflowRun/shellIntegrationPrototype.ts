import * as vscode from "vscode";
import * as path from "path";
import { waitForShellIntegration, waitForExecutionEnd } from "./shellIntegrationUtil";

/**
 * Diagnostic-only prototype for docs/swarmforge-integration/ Fase 5 (detección de fin de turno).
 * Not part of the production run path. Validates, against the real VS Code Shell Integration
 * API, whether it reports exit codes reliably and which way of passing a prompt to a one-shot
 * CLI invocation actually prevents shell injection.
 */

const OUTPUT_CHANNEL_NAME = "Agent Studio: Shell Integration Prototype";

async function runOneShot(
  output: vscode.OutputChannel,
  terminalName: string,
  execute: (shellIntegration: vscode.TerminalShellIntegration) => vscode.TerminalShellExecution,
  timeoutMs = 10000,
): Promise<{ exitCode: number | undefined; elapsedMs: number }> {
  const terminal = vscode.window.createTerminal({ name: terminalName });
  terminal.show();
  const shellIntegration = await waitForShellIntegration(terminal);
  if (!shellIntegration) {
    output.appendLine("  Shell Integration no se activó en esta terminal — salteando.");
    return { exitCode: undefined, elapsedMs: 0 };
  }
  const start = Date.now();
  const execution = execute(shellIntegration);
  const exitCode = await waitForExecutionEnd(execution, timeoutMs);
  return { exitCode, elapsedMs: Date.now() - start };
}

async function testReliability(output: vscode.OutputChannel): Promise<void> {
  output.appendLine("=== Test 1: confiabilidad de Shell Integration ===");
  const { exitCode, elapsedMs } = await runOneShot(
    output,
    "Agent Studio: prototipo (fiabilidad)",
    (shellIntegration) =>
      shellIntegration.executeCommand("echo", ["agent-studio-turn-detection-ok"]),
  );
  output.show(true);
  if (exitCode === undefined) {
    output.appendLine("RESULTADO: no llegó ningún exit code. Shell Integration no da una señal confiable en este entorno.");
    void vscode.window.showWarningMessage(
      "Shell Integration no dio una señal confiable — ver el output channel.",
    );
    return;
  }
  output.appendLine(`RESULTADO: exitCode=${exitCode} en ${elapsedMs}ms.`);
  void vscode.window.showInformationMessage(
    `Shell Integration OK — exitCode=${exitCode} en ${elapsedMs}ms.`,
  );
}

interface InjectionVariantResult {
  id: string;
  label: string;
  triggered: boolean;
}

interface InjectionVariant {
  id: string;
  label: string;
  run: (markerPath: string, terminalName: string) => Promise<{ exitCode: number | undefined; elapsedMs: number }>;
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function buildInjectionPayload(markerPath: string): string {
  return `hello "quoted" \`backtick\` $(touch "${markerPath}")`;
}

async function runInjectionVariant(
  output: vscode.OutputChannel,
  scratchDir: string,
  variant: InjectionVariant,
): Promise<InjectionVariantResult> {
  output.appendLine("");
  output.appendLine(`--- Variante ${variant.id}: ${variant.label} ---`);
  const markerPath = path.join(scratchDir, `injection-proof-${Date.now()}-${variant.id}.txt`);
  try {
    const { exitCode, elapsedMs } = await variant.run(
      markerPath,
      `Agent Studio: prototipo (variante ${variant.id})`,
    );
    output.appendLine(`  exitCode=${exitCode} en ${elapsedMs}ms`);
  } catch (error) {
    output.appendLine(`  error: ${error instanceof Error ? error.message : String(error)}`);
  }
  // dar tiempo a que el filesystem refleje el $(touch ...) si se ejecutó
  await new Promise((resolve) => setTimeout(resolve, 500));
  const triggered = await fileExists(vscode.Uri.file(markerPath));
  output.appendLine(
    triggered
      ? "  ⚠ INYECCIÓN EJECUTADA — se creó el archivo marcador."
      : "  ✓ el payload no se ejecutó como shell.",
  );
  return { id: variant.id, label: variant.label, triggered };
}

function buildInjectionVariants(
  output: vscode.OutputChannel,
  scratchDir: string,
): InjectionVariant[] {
  return [
    {
      id: "A",
      label: "commandLine string (interpolación directa, sin escaping)",
      run: (markerPath, terminalName) =>
        runOneShot(output, terminalName, (shellIntegration) =>
          shellIntegration.executeCommand(`echo "${buildInjectionPayload(markerPath)}"`),
        ),
    },
    {
      id: "B",
      label: "executeCommand(executable, args[]) con el payload como argumento",
      run: (markerPath, terminalName) =>
        runOneShot(output, terminalName, (shellIntegration) =>
          shellIntegration.executeCommand("echo", [buildInjectionPayload(markerPath)]),
        ),
    },
    {
      id: "C",
      label: "archivo (sólo se interpola una ruta controlada por Agent Studio)",
      run: async (markerPath, terminalName) => {
        const payloadPath = path.join(scratchDir, `payload-C-${Date.now()}.txt`);
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(payloadPath),
          Buffer.from(buildInjectionPayload(markerPath), "utf8"),
        );
        return runOneShot(output, terminalName, (shellIntegration) =>
          shellIntegration.executeCommand("cat", [payloadPath]),
        );
      },
    },
  ];
}

async function testInjection(
  output: vscode.OutputChannel,
  scratchDir: string,
): Promise<void> {
  output.appendLine("=== Test 2: prueba empírica de inyección ===");
  output.appendLine(
    "Cada variante intenta pasar el mismo payload adversarial (con comillas, backticks y un " +
      "$(...) que crea un archivo marcador) de una forma distinta. Si el archivo marcador " +
      "aparece, esa variante ejecutó el payload como shell en vez de tratarlo como texto.",
  );

  const variants = buildInjectionVariants(output, scratchDir);
  const results: InjectionVariantResult[] = [];
  for (const variant of variants) {
    results.push(await runInjectionVariant(output, scratchDir, variant));
  }

  // cada terminal.show() de las variantes le saca el foco al panel Output — recuperarlo para
  // que el resumen sea visible sin que el usuario tenga que cambiar de pestaña a mano.
  output.show(true);
  output.appendLine("");
  output.appendLine("=== Resumen ===");
  for (const result of results) {
    output.appendLine(
      `${result.id}) ${result.label}: ${result.triggered ? "VULNERABLE" : "seguro"}`,
    );
  }

  const anyVulnerable = results.some((r) => r.triggered);
  void vscode.window.showInformationMessage(
    anyVulnerable
      ? "Prueba de inyección: al menos una variante ejecutó código no confiable. Ver output channel."
      : "Prueba de inyección: ninguna variante ejecutó el payload. Ver output channel para el detalle.",
  );
}

async function testRealCli(output: vscode.OutputChannel): Promise<void> {
  output.appendLine("=== Test 3: invocación real de un backend en modo one-shot ===");

  const executable = await vscode.window.showInputBox({
    prompt: "Ejecutable a probar (ej. claude, codex)",
    value: "claude",
    ignoreFocusOut: true,
  });
  if (!executable) {
    return;
  }

  const flags = await vscode.window.showInputBox({
    prompt: "Flags previos al prompt, separados por espacio (ej. -p, o: exec)",
    value: "-p",
    ignoreFocusOut: true,
  });
  if (flags === undefined) {
    return;
  }

  const prompt = await vscode.window.showInputBox({
    prompt: "Prompt de prueba (default incluye caracteres de shell para estresar el escaping)",
    value: 'Responde OK. Caracteres de prueba: "comillas" `backtick` $(echo no-deberia-ejecutarse)',
    ignoreFocusOut: true,
  });
  if (prompt === undefined) {
    return;
  }

  const args = [...flags.split(" ").filter(Boolean), prompt];
  output.appendLine(`Ejecutando: ${executable} ${args.map((a) => JSON.stringify(a)).join(" ")}`);
  output.appendLine(
    "(vía executeCommand(executable, args[]) sólo para medir timing/exit code de este CLI real. " +
      "El Test 2 ya confirmó que args[] NO es seguro contra un prompt adversarial — el diseño de " +
      "producción tiene que pasar el prompt por archivo, no por acá. Ver 02-arquitectura-motor-nativo.md.)",
  );

  const { exitCode, elapsedMs } = await runOneShot(
    output,
    `Agent Studio: prototipo (${executable})`,
    (shellIntegration) => shellIntegration.executeCommand(executable, args),
    5 * 60 * 1000,
  );
  output.show(true);

  if (exitCode === undefined) {
    output.appendLine("RESULTADO: no llegó exit code (timeout de 5min o Shell Integration no disponible).");
    void vscode.window.showWarningMessage("No llegó exit code — ver output channel.");
    return;
  }
  output.appendLine(`RESULTADO: exitCode=${exitCode} en ${elapsedMs}ms.`);
  output.appendLine(
    "Revisá manualmente en la terminal si el output del CLI ejecutó el 'echo no-deberia-ejecutarse' " +
      "del prompt — si aparece en el output del propio agente (no del shell), no es una inyección de " +
      "shell, es sólo el agente citando el texto; sólo cuenta como inyección si el comando `echo` corrió " +
      "como proceso real antes de que el CLI recibiera el prompt.",
  );
  void vscode.window.showInformationMessage(
    `${executable}: exitCode=${exitCode} en ${elapsedMs}ms. Ver output channel.`,
  );
}

export async function runShellIntegrationPrototype(): Promise<void> {
  const output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  output.show(true);
  output.appendLine("=== Agent Studio — Prototipo de detección de fin de turno (Fase 5) ===");
  output.appendLine("Ver docs/swarmforge-integration/02-arquitectura-motor-nativo.md");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage(
      "Abrí una carpeta de workspace para correr el prototipo (necesita escribir archivos de prueba).",
    );
    return;
  }

  const scratchDir = path.join(workspaceFolder, ".agent-studio", "prototype");
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(scratchDir));

  const choice = await vscode.window.showQuickPick(
    [
      {
        label: "1. Confiabilidad de Shell Integration",
        detail: "Corre un comando one-shot simple y confirma que llega el exit code.",
        id: "reliability",
      },
      {
        label: "2. Prueba empírica de inyección",
        detail:
          "Compara 3 formas de pasar un prompt (commandLine, args[], archivo) y confirma cuáles ejecutan código no confiable.",
        id: "injection",
      },
      {
        label: "3. Invocar un CLI real (claude/codex) en modo one-shot",
        detail: "Pide el comando y el prompt, y reporta duración + exit code.",
        id: "real-cli",
      },
    ],
    { placeHolder: "Elegí qué validar" },
  );

  if (!choice) {
    return;
  }

  if (choice.id === "reliability") {
    await testReliability(output);
  } else if (choice.id === "injection") {
    await testInjection(output, scratchDir);
  } else if (choice.id === "real-cli") {
    await testRealCli(output);
  }
}
