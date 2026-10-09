import { publicPlatformScript } from "../../../../server/_core/publicConfig";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(publicPlatformScript(), {
    headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store" },
  });
}
