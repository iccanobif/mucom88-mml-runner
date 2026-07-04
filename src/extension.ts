import * as vscode from "vscode";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";

let runningProcess: ChildProcessWithoutNullStreams | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
const suppressedExitProcesses = new WeakSet<ChildProcessWithoutNullStreams>();

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
  statusBarItem.text = "$(play) Reproducing MML...";
  statusBarItem.color = "#00C853";

  const reproduceOrRestartCommand = vscode.commands.registerCommand("mml.reproduceOrRestart", async () => {
    await reproduceOrRestart();
  });

  const stopCommand = vscode.commands.registerCommand("mml.stopReproduce", async () => {
    await stopReproduce();
  });

  context.subscriptions.push(reproduceOrRestartCommand, stopCommand, statusBarItem);
}

export function deactivate(): void {
  if (runningProcess) {
    suppressedExitProcesses.add(runningProcess);
    runningProcess.kill();
    runningProcess = undefined;
  }
  hideRunningStatus();
}

async function reproduceOrRestart(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "mml") {
    return;
  }

  const saved = await editor.document.save();
  if (!saved) {
    void vscode.window.showErrorMessage("Failed to save current MML file.");
    return;
  }

  if (runningProcess) {
    await stopProcessInternal(true);
  }

  startProcess(editor.document.uri.fsPath);
}

async function stopReproduce(): Promise<void> {
  if (runningProcess) {
    await stopProcessInternal(true);
  }
}

function startProcess(filePath: string): void {
  let stdoutBuffer = "";
  let stderrBuffer = "";
  let launchedProcess: ChildProcessWithoutNullStreams;

  try {
    launchedProcess = spawn("mucom88", [filePath], {
      windowsHide: true,
      stdio: "pipe"
    });
  } catch (error) {
    hideRunningStatus();
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Unable to start mucom88: ${message}`);
    return;
  }

  runningProcess = launchedProcess;

  const proc = launchedProcess;
  const launchedFilePath = filePath;

  showRunningStatus();

  proc.stdout.setEncoding("utf8");
  proc.stderr.setEncoding("utf8");

  proc.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
  });

  proc.stderr.on("data", (chunk: string) => {
    stderrBuffer += chunk;
  });

  proc.on("error", (error) => {
    if (runningProcess === proc) {
      runningProcess = undefined;
    }
    hideRunningStatus();

    const shouldSuppress = suppressedExitProcesses.has(proc);
    suppressedExitProcesses.delete(proc);
    if (shouldSuppress) {
      return;
    }

    void vscode.window.showErrorMessage(`mucom88 execution error: ${error.message}`);
  });

  proc.on("close", (code) => {
    if (runningProcess === proc) {
      runningProcess = undefined;
    }
    hideRunningStatus();

    const shouldSuppress = suppressedExitProcesses.has(proc);
    suppressedExitProcesses.delete(proc);
    if (shouldSuppress) {
      return;
    }

    const output = formatProcessOutput(stdoutBuffer, stderrBuffer);

    if (code !== 0) {
      const suffix = output.length > 0 ? `\n\n${output}` : "";
      void vscode.window.showErrorMessage(
        `mucom88 exited with code ${code ?? "unknown"} for ${launchedFilePath}.${suffix}`
      );
    }
  });
}

function stopProcessInternal(suppressExitError: boolean): Promise<void> {
  const proc = runningProcess;
  if (!proc) {
    hideRunningStatus();
    return Promise.resolve();
  }

  runningProcess = undefined;
  hideRunningStatus();

  if (suppressExitError) {
    suppressedExitProcesses.add(proc);
  }

  if (proc.exitCode !== null || proc.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    proc.once("close", () => {
      resolve();
    });
    proc.kill();
  });
}

function showRunningStatus(): void {
  statusBarItem?.show();
}

function hideRunningStatus(): void {
  statusBarItem?.hide();
}

function formatProcessOutput(stdout: string, stderr: string): string {
  const sections: string[] = [];

  const trimmedStdout = stdout.trim();
  if (trimmedStdout.length > 0) {
    sections.push(`[stdout]\n${trimmedStdout}`);
  }

  const trimmedStderr = stderr.trim();
  if (trimmedStderr.length > 0) {
    sections.push(`[stderr]\n${trimmedStderr}`);
  }

  const combined = sections.join("\n\n");
  if (combined.length <= 3500) {
    return combined;
  }

  return `${combined.slice(0, 3500)}\n\n...(truncated)`;
}
