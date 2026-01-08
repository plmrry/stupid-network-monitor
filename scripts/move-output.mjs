// @ts-check

import { execSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = import.meta.resolve("./");
const outDir = fileURLToPath(import.meta.resolve("../out"));
const packageJsonPath = findPackageJSON(currentDir);

if (!packageJsonPath) {
  throw new Error("Could not find package.json");
}

const packageJsonData = await readFile(packageJsonPath, "utf-8");

const packageJson = JSON.parse(packageJsonData);

const productName = packageJson?.build?.productName;

if (!productName) {
  throw new Error("Could not find productName in package.json build config");
}

const entries = await readdir(outDir, { recursive: true, withFileTypes: true });

const appName = `${productName}.app`;

const found = entries.find(
  (entry) => entry.isDirectory() && entry.name === appName
);

if (!found) {
  throw new Error(`Could not find ${appName} in ${outDir}`);
}

const appPath = join(found.parentPath, appName);

const destinationPath = `/Applications/${appName}`;

execSync(`cp -R "${appPath}" "${destinationPath}"`, { stdio: "inherit" });
