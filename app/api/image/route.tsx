import { ImageResponse } from "next/og";

const WIDTH = 16;
const HEIGHT = 16;

export async function GET() {
	const randomX1 = Math.random() * WIDTH;
	const randomX2 = Math.random() * WIDTH;
	const randomY1 = Math.random() * HEIGHT;
	const randomY2 = Math.random() * HEIGHT;
	return new ImageResponse(
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			width={WIDTH}
			height={HEIGHT}
		>
			<title style={{ opacity: 0 }}>Random squiggly line</title>
			<line
				x1={randomX1}
				y1={randomY1}
				x2={randomX2}
				y2={randomY2}
				stroke="black"
				strokeWidth="2"
				strokeLinecap="round"
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
