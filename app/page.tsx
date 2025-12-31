"use client";

import { type CSSProperties, useEffect, useState } from "react";

const styles: Record<string, CSSProperties> = {
	container: {
		backgroundColor: "#1a1a2e",
		display: "flex",
		flexDirection: "column",
		margin: 0,
		minHeight: "100vh",
		padding: 0,
	},
	iframe: {
		border: "none",
		flexGrow: 1,
		height: "100%",
		width: "100%",
	},
	title: {
		color: "#ffffff",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
		fontSize: "48px",
		fontWeight: 600,
		margin: 0,
		padding: "24px",
		textAlign: "center",
	},
};

export default function Page() {
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		fetch("/api/image")
			.then((response) => {
				console.log("Response:", response);
				return response.blob();
			})
			.then((blob) => {
				console.log("Blob:", blob);
			});
	}, []);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Network Chart</h1>
			<iframe key={refreshKey} src="/image" style={styles.iframe} title="Random squiggly line" />
		</div>
	);
}
