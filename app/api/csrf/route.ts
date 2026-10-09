export const dynamic = "force-dynamic";

// The CSRF cookie itself is issued by proxy.ts; this endpoint only gives clients
// a cheap request that is guaranteed to pass through it.
export function GET() {
  return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
}
