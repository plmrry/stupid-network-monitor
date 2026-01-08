// @ts-check

// @ts-ignore — Missing types
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { getCodeSigningIdentity } from "./scripts/get-code-signing-identity.mjs";

// Get code signing identities
const identity = await getCodeSigningIdentity();

const config: ForgeConfig = {
	makers: [
		{
			config: {
				format: "ULFO",
				icon: "./app-icon/icon.icns",
			},
			name: "@electron-forge/maker-dmg",
		},
	],
	packagerConfig: {
		appBundleId: "com.paulmurray.stupid-network-monitor.app",
		// Enable asar for production packaging (required by Fuses)
		asar: true,
		icon: "./app-icon/icon.icns",
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
	rebuildConfig: {},
};

export default config;
