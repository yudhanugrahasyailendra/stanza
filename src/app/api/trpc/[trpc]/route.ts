import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createFetchContext } from "../../../../server/_core/context";
import { appRouter } from "../../../../server/routers";

// mysql2 and node:crypto need the Node.js runtime, and responses carry Set-Cookie.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createFetchContext,
  });

export { handler as GET, handler as POST };
