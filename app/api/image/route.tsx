import { ImageResponse } from "next/og";

const WIDTH = 800;
const HEIGHT = 600;

function generateSquigglyPath(): string {
	const points: Array<{ x: number; y: number }> = [];

	const numPoints = 8 + Math.floor(Math.random() * 8);
	for (let i = 0; i < numPoints; i++) {
		points.push({
			x: (i / (numPoints - 1)) * WIDTH,
			y: HEIGHT / 2 + (Math.random() - 0.5) * HEIGHT * 0.8,
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

export async function GET() {
	const path = generateSquigglyPath();
	const hue = Math.floor(Math.random() * 360);

	return new ImageResponse(
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			width={WIDTH}
			height={HEIGHT}
		>
			<title>Random squiggly line</title>
			<rect width={WIDTH} height={HEIGHT} fill="#1a1a2e" />
			<path
				d={path}
				fill="none"
				stroke={`hsl(${hue}, 70%, 60%)`}
				stroke-width="4"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>,
		{
			headers: {
				"Cache-Control": "no-store",
			},
			height: HEIGHT,
			width: WIDTH,
		}
	);
}
