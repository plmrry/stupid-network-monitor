// @ts-check

import { api } from "@electron-forge/core";
import { build } from "esbuild";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = fileURLToPath(new URL("../", import.meta.url));
const stageDir = path.join(rootDir, ".forge-package-source");
const outDir = path.join(rootDir, "out");

/**
 * @param {string} relativePath
 */
async function copyProjectPath(relativePath) {
  await fs.cp(path.join(rootDir, relativePath), path.join(stageDir, relativePath), {
    force: true,
    recursive: true,
  });
}

/**
 * Copy selected runtime packages into the staged app without pnpm symlinks.
 *
 * @param {string} packageName
 */
async function copyRuntimePackage(packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [rootDir],
  });
  const packageDir = path.dirname(packageJsonPath);
  const destination = path.join(stageDir, "node_modules", ...packageName.split("/"));

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(packageDir, destination, {
    dereference: true,
    force: true,
    recursive: true,
  });
}

async function writeStagedPackageJson() {
  const packageJsonPath = path.join(rootDir, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));

  packageJson.main = "main.mjs";
  packageJson.config = {
    forge: "./forge.config.ts",
  };
  packageJson.scripts = {};
  packageJson.dependencies = {
    "@resvg/resvg-js": packageJson.dependencies["@resvg/resvg-js"],
  };
  packageJson.devDependencies = {
    electron: packageJson.devDependencies.electron,
  };

  await fs.writeFile(
    path.join(stageDir, "package.json"),
    `${JSON.stringify(packageJson, null, "\t")}\n`,
  );
}

async function preparePackageSource() {
  await fs.rm(stageDir, { force: true, recursive: true });
  await fs.mkdir(stageDir, { recursive: true });

  await build({
    bundle: true,
    entryPoints: [path.join(rootDir, "src/main.mjs")],
    external: ["electron", "@resvg/resvg-js"],
    format: "esm",
    outfile: path.join(stageDir, "main.mjs"),
    platform: "node",
    target: "node24",
  });

  await Promise.all([
    copyProjectPath("assets"),
    copyProjectPath("entitlements.mac.plist"),
    copyProjectPath("forge.config.ts"),
    copyProjectPath("scripts/generate-icons.mjs"),
    copyProjectPath("scripts/get-code-signing-identity.mjs"),
    copyRuntimePackage("@resvg/resvg-js"),
    copyRuntimePackage("@resvg/resvg-js-darwin-arm64"),
    writeStagedPackageJson(),
  ]);
}

await preparePackageSource();

try {
  await api.package({
    arch: "arm64",
    dir: stageDir,
    interactive: true,
    outDir,
    platform: "darwin",
  });
} finally {
  await fs.rm(stageDir, { force: true, recursive: true });
}
