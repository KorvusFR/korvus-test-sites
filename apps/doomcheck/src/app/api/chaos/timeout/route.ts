export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 15000));
  return new Response(
    JSON.stringify({ ok: true, delay: 15000 }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
