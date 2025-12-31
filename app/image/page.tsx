"use client";

import { useMemo } from "react";

function generateSquigglyPath(): string {
	const width = 800;
	const height = 600;
	const points: Array<{ x: number; y: number }> = [];

	const numPoints = 8 + Math.floor(Math.random() * 8);
	for (let i = 0; i < numPoints; i++) {
		points.push({
			x: (i / (numPoints - 1)) * width,
			y: height / 2 + (Math.random() - 0.5) * height * 0.8,
		});
	}

	let d = `M ${points[0].x} ${points[0].y}`;

	for (let i = 1; i < points.length - 2; i++) {
		const p0 = points[i - 1];
		const p1 = points[i];
		const p2 = points[i + 1];

		const cp1x = p1.x - (p2.x - p0.x) / 6;
		const cp1y = p1.y - (p2.y - p0.y) / 6;
		const cp2x = p1.x + (p2.x - p0.x) / 6;
		const cp2y = p1.y + (p2.y - p0.y) / 6;

		if (i === 1) {
			d += ` Q ${cp1x} ${cp1y} ${p1.x} ${p1.y}`;
		}
		d += ` C ${cp2x} ${cp2y} ${p2.x - (points[i + 2]?.x ?? p2.x * 2 - p1.x - p0.x) / 6 + (p2.x - p0.x) / 6} ${p2.y - (points[i + 2]?.y ?? p2.y * 2 - p1.y - p0.y) / 6 + (p2.y - p0.y) / 6} ${p2.x} ${p2.y}`;
	}

	return d;
}

export default function ImagePage() {
	const { path, hue } = useMemo(
		() => ({
			hue: Math.floor(Math.random() * 360),
			path: generateSquigglyPath(),
		}),
		[]
	);

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 800 600"
			style={{ display: "block", height: "100vh", width: "100vw" }}
		>
			<title>Random squiggly line</title>
			<rect width="800" height="600" fill="#1a1a2e" />
			<path
				d={path}
				fill="none"
				stroke={`hsl(${hue}, 70%, 60%)`}
				strokeWidth="4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
