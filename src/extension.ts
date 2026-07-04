import * as vscode from "vscode";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";

let runningProcess: ChildProcessWithoutNullStreams | undefined;
let runningFilePath: string | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let stdoutBuffer = "";
let stderrBuffer = "";
let stopRequestedByUser = false;

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
  statusBarItem.text = "$(play) Reproducing MML...";
  statusBarItem.color = "#00C853";

  const command = vscode.commands.registerCommand("mml.toggleReproduce", async () => {
    await toggleReproduce();
  });

  context.subscriptions.push(command, statusBarItem);
}

export function deactivate(): void {
  cleanupRunningProcess(true);
}

async function toggleReproduce(): Promise<void> {
  if (runningProcess) {
    stopRequestedByUser = true;
    cleanupRunningProcess(true);
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "mml") {
    return;
  }

  const saved = await editor.document.save();
  if (!saved) {
    void vscode.window.showErrorMessage("Failed to save current MML file.");
    return;
  }

  const filePath = editor.document.uri.fsPath;
  runningFilePath = filePath;
  stdoutBuffer = "";
  stderrBuffer = "";

  try {
    runningProcess = spawn("mucom88", [filePath], {
      windowsHide: true,
      stdio: "pipe"
    });
  } catch (error) {
    cleanupRunningProcess(false);
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Unable to start mucom88: ${message}`);
    return;
  }

  const proc = runningProcess;
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
    cleanupRunningProcess(false);
    void vscode.window.showErrorMessage(`mucom88 execution error: ${error.message}`);
  });

  proc.on("close", (code) => {
    if (stopRequestedByUser) {
      stopRequestedByUser = false;
      cleanupRunningProcess(false);
      return;
    }

    const output = formatProcessOutput(stdoutBuffer, stderrBuffer);
    cleanupRunningProcess(false);

    if (code !== 0) {
      const suffix = output.length > 0 ? `\n\n${output}` : "";
      void vscode.window.showErrorMessage(
        `mucom88 exited with code ${code ?? "unknown"} for ${launchedFilePath}.${suffix}`
      );
    }
  });
}

function showRunningStatus(): void {
  statusBarItem?.show();
}

function hideRunningStatus(): void {
  statusBarItem?.hide();
}

function cleanupRunningProcess(killProcess: boolean): void {
  const proc = runningProcess;
  runningProcess = undefined;

  if (killProcess && proc && !proc.killed) {
    proc.kill();
  }

  runningFilePath = undefined;
  hideRunningStatus();
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
