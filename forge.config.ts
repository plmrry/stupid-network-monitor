// @ts-check

import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
// @ts-ignore — Missing types
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { generateIcons } from "./scripts/generate-icons.mjs";
import { getCodeSigningIdentity } from "./scripts/get-code-signing-identity.mjs";

const currentDir = import.meta.dirname;
console.log("Current directory:", currentDir);

// Get code signing identities
const identity = await getCodeSigningIdentity();
console.log("Using code signing identity:", identity);

const config: ForgeConfig = {
	hooks: {
		postPackage: async (config: ForgeConfig, packageResult) => {
			const appName = config.packagerConfig?.name;
			if (!appName) {
				throw new Error("App name is not defined in packagerConfig");
			}
			console.log(`App name: ${appName}`);

			const outputDir = packageResult?.outputPaths?.at(0);

			if (!outputDir) {
				throw new Error("No output directory found in packageResult");
			}

			const appPath = path.join(outputDir, `${appName}.app`);

			try {
				await stat(appPath);
			} catch {
				throw new Error(`Packaged app not found at path: ${appPath}`);
			}

			console.log(`Packaged app path: ${appPath}`);

			const destinationPath = `/Applications/${appName}.app`;

			try {
				const found = await stat(destinationPath);
				if (found) {
					console.log(`Found existing app at destination: ${destinationPath}`);
					console.log(`Removing ${destinationPath}...`);
					const command = `trash "${destinationPath}"`;
					execFileSync(command, {
						shell: true,
						stdio: "inherit",
					});
				}
			} catch {}

			console.log(`Copying:
			- ${"From:".padEnd(5)} ${appPath}
			- ${"To:".padEnd(5)} ${destinationPath}`);

			execFileSync(`cp -R "${appPath}" "${destinationPath}"`, {
				shell: true,
				stdio: "inherit",
			});

			console.log(`Opening ${appName}...`);

			execFileSync(`open "${destinationPath}"`, {
				shell: true,
				stdio: "inherit",
			});
		},
		prePackage: async (config: ForgeConfig) => {
			const appName = config.packagerConfig?.name;
			if (!appName) {
				throw new Error("App name is not defined in packagerConfig");
			}

			console.log(`Attempting to quit ${appName}...`);
			try {
				const command = `pkill "${appName}"`;
				execFileSync(command, {
					shell: true,
					stdio: "ignore",
				});
			} catch {}

			try {
				const foo = config.outDir;
				console.log("foo:", foo);
				const outDir = await stat(path.join(currentDir, "out"));
				console.log(`"./out" directory exists: ${outDir.isDirectory()}`);
				if (outDir) {
					console.log(`Removing "./out" directory...`);
					const command = `trash "./out"`;
					execFileSync(command, {
						cwd: currentDir,
						shell: true,
						stdio: "inherit",
					});
				}
			} catch {}

			console.log(`Generating icons...`);
			await generateIcons();
			console.log(`Generating icons... Done.`);
		},
	},
	makers: [
		{
			config: {
				format: "ULFO",
			},
			name: "@electron-forge/maker-dmg",
		},
	],
	packagerConfig: {
		appBundleId: "com.paulmurray.stupid-network-monitor.app",
		appCategoryType: "public.app-category.utilities",
		appCopyright: "Copyright © 2026 Paul Murray",
		// Enable asar for production packaging (required by Fuses)
		asar: true,
		icon: "./app-icons/icon",
		name: "Stupid Network Monitor",

		// Enable code signing with Developer ID Application certificate
		osxSign: {
			identity,
			optionsForFile: (filePath) => {
				// Base options for all files
				const options: {
					entitlements?: string;
					hardenedRuntime: boolean;
					signatureFlags?: string;
				} = {
					hardenedRuntime: true,
				};

				// Only add entitlements for the main executable
				if (filePath.includes("Stupid Network Monitor.app/Contents/MacOS/")) {
					options.entitlements = "entitlements.mac.plist";
				}

				// Apply library signature flags only to actual libraries
				if (
					filePath.endsWith(".dylib") ||
					filePath.endsWith(".node") ||
					filePath.includes(".framework/")
				) {
					options.signatureFlags = "library";
				}

				return options;
			},
		},
		overwrite: true,
	},
	plugins: [
		new AutoUnpackNativesPlugin({}),
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: false,
		}),
	],
	publishers: [
		{
			config: {
				draft: true,
				prerelease: false,
				repository: {
					name: "stupid-network-monitor",
					owner: "plmrry",
				},
			},
			name: "@electron-forge/publisher-github",
		},
	],
	rebuildConfig: {
		force: true,
	},
};

export default config;
