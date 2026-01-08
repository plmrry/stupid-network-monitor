// @ts-check

import { findPackageJSON } from "node:module";
import { readFile } from "node:fs/promises";

const packageJsonPath = findPackageJSON(import.meta.resolve("./"));

if (!packageJsonPath) {
  throw new Error("Could not find package.json");
}

const packageJsonData = await readFile(packageJsonPath, "utf-8");

const packageJson = JSON.parse(packageJsonData);

const productName = packageJson?.build?.productName;

if (!productName) {
  throw new Error("Could not find productName in package.json build config");
}

console.log(`Looking for ${productName}.app in ./out`);

// Find the .app file in ./out directory
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const outDir = join(projectRoot, "out");

// Recursively search for .app file
/**
 * @param {string} dir
 * @param {string} appName
 * @returns {Promise<string | null>}
 */
async function findAppFile(dir, appName) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === `${appName}.app`) {
          return fullPath;
        }
        // Recursively search subdirectories
        const found = await findAppFile(fullPath, appName);
        if (found) return found;
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
    return null;
  }

  return null;
}

const appPath = await findAppFile(outDir, productName);

if (!appPath) {
  throw new Error(`Could not find ${productName}.app in ${outDir}`);
}

console.log(`Found app at: ${appPath}`);

const destinationPath = `/Applications/${productName}.app`;

console.log(`Moving to: ${destinationPath}`);

// Remove existing app if it exists
try {
  execSync(`rm -rf "${destinationPath}"`, { stdio: "inherit" });
} catch {
  // It's okay if it doesn't exist
}

// Move the app
execSync(`mv "${appPath}" "${destinationPath}"`, { stdio: "inherit" });

console.log(`✓ Successfully moved ${productName}.app to /Applications`);
