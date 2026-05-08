#!/usr/bin/env node

import { existsSync, mkdirSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";

import {
  buildLynxServerExecutableName,
  getGoBuildTargets,
  toGoArch,
  toGoOS,
} from "./build-local-console-lib.mjs";

const rootDir = process.cwd();

function withWindowsComSpec(env = process.env) {
  if (process.platform !== "win32" || env.ComSpec) {
    return env;
  }
  return {
    ...env,
    ComSpec: "C:\\Windows\\System32\\cmd.exe",
  };
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: withWindowsComSpec(),
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function buildIfPresent(relativePackageDir) {
  const packageJsonPath = path.join(rootDir, relativePackageDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    console.log(`[build-local-console] skip ${relativePackageDir} (package.json missing)`);
    return;
  }

  console.log(`[build-local-console] build ${relativePackageDir}`);
  run(resolveNpmCommand(), ["--prefix", relativePackageDir, "run", "build"]);
}

buildIfPresent("shared");
buildGoBackendIfPresent();
buildIfPresent("frontend");

function resolveGoCommand() {
  const windowsGo = "C:\\Program Files\\Go\\bin\\go.exe";
  if (process.platform === "win32" && existsSync(windowsGo)) {
    return windowsGo;
  }
  return "go";
}

function resolveGoModModeArg(backendGoDir) {
  const vendorModulesPath = path.join(backendGoDir, "vendor", "modules.txt");
  return existsSync(vendorModulesPath) ? "-mod=vendor" : "-mod=readonly";
}

function buildGoTarget(platform, arch) {
  const backendGoDir = path.join(rootDir, "backend");
  const outputDir = path.join(backendGoDir, "dist");
  mkdirSync(outputDir, { recursive: true });
  const modModeArg = resolveGoModModeArg(backendGoDir);

  console.log(`[build-local-console] build backend ${platform}/${arch} (${modModeArg})`);
  const result = spawnSync(resolveGoCommand(), [
    "build",
    modModeArg,
    "-trimpath",
    "-ldflags",
    "-s -w",
    "-o",
    path.join(outputDir, buildLynxServerExecutableName(platform, arch)),
    "./cmd/lynx-server",
  ], {
    cwd: backendGoDir,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      CGO_ENABLED: "0",
      GOOS: toGoOS(platform),
      GOARCH: toGoArch(arch),
    },
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildGoBackendIfPresent() {
  const goModPath = path.join(rootDir, "backend", "go.mod");
  if (!existsSync(goModPath)) {
    console.log("[build-local-console] skip backend (go.mod missing)");
    return;
  }

  for (const { platform, arch } of getGoBuildTargets()) {
    buildGoTarget(platform, arch);
  }
}
