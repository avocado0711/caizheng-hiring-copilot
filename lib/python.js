"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findOnPath(command, env) {
  const pathValue = env.PATH || env.Path || "";
  const extensions = process.platform === "win32"
    ? (env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)
    : [""];
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    if (process.platform === "win32" && /Microsoft[\\/]WindowsApps$/i.test(directory)) {
      continue;
    }
    for (const extension of extensions) {
      const candidate = path.join(directory, `${command}${extension}`);
      if (isFile(candidate)) return candidate;
    }
  }
  return "";
}

function resolveConfiguredCommand(value, env) {
  const configured = String(value || "").trim();
  if (!configured) return "";
  if (path.isAbsolute(configured) || configured.includes("/") || configured.includes("\\")) {
    return isFile(configured) ? configured : "";
  }
  return findOnPath(configured, env);
}

function pythonInstallCandidates(localAppData) {
  if (!localAppData) return [];
  const programsRoot = path.join(localAppData, "Programs", "Python");
  try {
    return fs.readdirSync(programsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^Python3\d{1,2}$/i.test(entry.name))
      .sort((left, right) => {
        const leftVersion = Number(left.name.match(/\d+/)?.[0] || 0);
        const rightVersion = Number(right.name.match(/\d+/)?.[0] || 0);
        const preferred = new Map([[312, 0], [311, 1], [313, 2], [310, 3], [314, 4]]);
        return (preferred.get(leftVersion) ?? 100 + leftVersion)
          - (preferred.get(rightVersion) ?? 100 + rightVersion);
      })
      .map((entry) => ({
        command: path.join(programsRoot, entry.name, "python.exe"),
        sourceLabel: `用户安装 ${entry.name}`,
      }));
  } catch {
    return [];
  }
}

function systemPythonCandidates() {
  if (process.platform !== "win32") return [];
  try {
    return fs.readdirSync("C:\\", { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^Python3\d{1,2}$/i.test(entry.name))
      .sort((left, right) => right.name.localeCompare(left.name))
      .map((entry) => ({
        command: path.join("C:\\", entry.name, "python.exe"),
        sourceLabel: `系统安装 ${entry.name}`,
      }));
  } catch {
    return [];
  }
}

function hasVectorDependencies(runtime) {
  const result = spawnSync(
    runtime.command,
    [
      ...runtime.args,
      "-c",
      "import importlib.util; names=['numpy','torch','transformers','sentence_transformers','peft']; raise SystemExit(0 if all(importlib.util.find_spec(name) for name in names) else 1)",
    ],
    {
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    },
  );
  return result.status === 0;
}

function resolvePythonRuntime(options = {}) {
  const env = options.env || process.env;
  const rootDir = options.rootDir || PROJECT_ROOT;
  const probeDependencies = options.probeDependencies !== false;

  const configured = resolveConfiguredCommand(env.HIREPROOF_PYTHON, env);
  if (configured) {
    return {
      command: configured,
      args: [],
      sourceLabel: "HIREPROOF_PYTHON",
    };
  }

  const virtualEnvironments = process.platform === "win32"
    ? [[".venv", "Scripts", "python.exe"], ["venv", "Scripts", "python.exe"], ["env", "Scripts", "python.exe"]]
    : [[".venv", "bin", "python"], ["venv", "bin", "python"], ["env", "bin", "python"]];
  for (const parts of virtualEnvironments) {
    const command = path.join(rootDir, ...parts);
    if (isFile(command)) {
      return {
        command,
        args: [],
        sourceLabel: `项目环境 ${parts[0]}`,
      };
    }
  }

  const localAppData = env.LOCALAPPDATA
    || path.join(os.homedir(), "AppData", "Local");
  const discovered = [...pythonInstallCandidates(localAppData), ...systemPythonCandidates()];
  if (probeDependencies) {
    for (const candidate of discovered) {
      const runtime = {
        command: candidate.command,
        args: [],
        sourceLabel: candidate.sourceLabel,
      };
      if (isFile(candidate.command) && hasVectorDependencies(runtime)) return runtime;
    }
  }
  for (const candidate of discovered) {
    if (isFile(candidate.command)) {
      return {
        command: candidate.command,
        args: [],
        sourceLabel: candidate.sourceLabel,
      };
    }
  }

  const pathCommands = process.platform === "win32"
    ? ["python.exe", "python3.exe"]
    : ["python3", "python"];
  for (const commandName of pathCommands) {
    const command = findOnPath(commandName, env);
    if (command) {
      const runtime = {
        command,
        args: [],
        sourceLabel: "PATH",
      };
      if (!probeDependencies || hasVectorDependencies(runtime)) return runtime;
    }
  }

  return process.platform === "win32"
    ? { command: "py.exe", args: ["-3.12"], sourceLabel: "Python Launcher 回退" }
    : { command: "python3", args: [], sourceLabel: "PATH 回退" };
}

module.exports = {
  resolvePythonRuntime,
};
