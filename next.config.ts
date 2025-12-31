import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		contentDispositionType: "attachment",
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
		dangerouslyAllowSVG: true,
		disableStaticImages: true,
	},
	output: "standalone",
};

export default nextConfig;
