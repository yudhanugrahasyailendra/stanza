import { responseFromHeaders, requestFromFetch } from "../../../../server/_core/http";
import { handleOAuthCallback } from "../../../../server/_core/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const headers = new Headers();
  const result = await handleOAuthCallback({
    code: searchParams.get("code") ?? undefined,
    state: searchParams.get("state") ?? undefined,
    req: requestFromFetch(request),
    res: responseFromHeaders(headers),
  });
  if ("redirectTo" in result) {
    headers.set("Location", result.redirectTo);
    return new Response(null, { status: result.status, headers });
  }
  return Response.json(result.body, { status: result.status, headers });
}
