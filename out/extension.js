"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const node_child_process_1 = require("node:child_process");
let runningProcess;
let runningFilePath;
let statusBarItem;
let stdoutBuffer = "";
let stderrBuffer = "";
let stopRequestedByUser = false;
function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
    statusBarItem.text = "$(play) Reproducing MML...";
    statusBarItem.color = "#00C853";
    const command = vscode.commands.registerCommand("mml.toggleReproduce", async () => {
        await toggleReproduce();
    });
    context.subscriptions.push(command, statusBarItem);
}
function deactivate() {
    cleanupRunningProcess(true);
}
async function toggleReproduce() {
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
        runningProcess = (0, node_child_process_1.spawn)("mucom88", [filePath], {
            windowsHide: true,
            stdio: "pipe"
        });
    }
    catch (error) {
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
    proc.stdout.on("data", (chunk) => {
        stdoutBuffer += chunk;
    });
    proc.stderr.on("data", (chunk) => {
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
            void vscode.window.showErrorMessage(`mucom88 exited with code ${code ?? "unknown"} for ${launchedFilePath}.${suffix}`);
        }
    });
}
function showRunningStatus() {
    statusBarItem?.show();
}
function hideRunningStatus() {
    statusBarItem?.hide();
}
function cleanupRunningProcess(killProcess) {
    const proc = runningProcess;
    runningProcess = undefined;
    if (killProcess && proc && !proc.killed) {
        proc.kill();
    }
    runningFilePath = undefined;
    hideRunningStatus();
}
function formatProcessOutput(stdout, stderr) {
    const sections = [];
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
//# sourceMappingURL=extension.js.map