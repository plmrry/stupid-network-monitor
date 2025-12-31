export async function GET() {
	const number = Math.floor(Math.random() * 100) + 1;

	return Response.json({ number });
}
