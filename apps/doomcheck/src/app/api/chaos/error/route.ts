export function GET() {
  return new Response(
    JSON.stringify({ error: "[doomcheck chaos] request_error_500: simulated server error" }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
