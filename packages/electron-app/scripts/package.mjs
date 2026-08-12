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
 * Find the root directory for a runtime package from one of its exports.
 *
 * @param {string} packageName
 * @param {string} packageExport
 */
async function getRuntimePackageDirectory(packageName, packageExport) {
  let packageDir = path.dirname(
    require.resolve(packageExport, {
      paths: [rootDir],
    }),
  );

  while (packageDir !== path.dirname(packageDir)) {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(packageDir, "package.json"), "utf8"),
      );

      if (packageJson.name === packageName) return packageDir;
    } catch {}

    packageDir = path.dirname(packageDir);
  }

  throw new Error(`Could not find package directory for ${packageName}`);
}

/**
 * Copy selected runtime packages into the staged app without pnpm symlinks.
 *
 * @param {string} packageName
 * @param {string} [packageExport]
 */
async function copyRuntimePackage(
  packageName,
  packageExport = `${packageName}/package.json`,
) {
  const packageDir = await getRuntimePackageDirectory(
    packageName,
    packageExport,
  );
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
    "@resvg/resvg-wasm": packageJson.dependencies["@resvg/resvg-wasm"],
    geist: packageJson.dependencies.geist,
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
    external: ["electron", "@resvg/resvg-wasm"],
    format: "esm",
    outfile: path.join(stageDir, "main.mjs"),
    platform: "node",
    target: "node24",
  });

  await Promise.all([
    copyProjectPath("entitlements.mac.plist"),
    copyProjectPath("forge.config.ts"),
    copyProjectPath("scripts/generate-icons.mjs"),
    copyProjectPath("scripts/get-code-signing-identity.mjs"),
    copyRuntimePackage("@resvg/resvg-wasm", "@resvg/resvg-wasm"),
    copyRuntimePackage("geist", "geist/font/pixel"),
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
