// @ts-ignore
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import type { ForgeConfig } from "@electron-forge/shared-types";

const config: ForgeConfig = {
	makers: [
		{
			config: {
				format: "ULFO",
			},
			name: "@electron-forge/maker-dmg",
		},
	],
	packagerConfig: {
		appBundleId: "com.paulmurray.network-chart",
		// Enable asar for production packaging (required by Fuses)
		asar: true,
		// Enable code signing with Developer ID Application certificate
		osxSign: {
			identity: "Developer ID Application: Paul Murray (2XZDV55R72)",
			optionsForFile: (_filePath) => {
				return {
					entitlements: "entitlements.mac.plist",
					hardenedRuntime: false,
					signatureFlags: "library",
				};
			},
		},
	},
	plugins: [
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
	publishers: [
		{
			config: {
				draft: true,
				prerelease: false,
				repository: {
					name: "electron-network-chart",
					owner: "plmrry",
				},
			},
			name: "@electron-forge/publisher-github",
		},
	],
	rebuildConfig: {},
};

export default config;
