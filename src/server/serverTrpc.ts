import { headers } from "next/headers";
import { cache } from "react";
import { createServerContext } from "./_core/context";
import { appRouter } from "./routers";

/** tRPC caller for Server Components, authenticated from the incoming request's cookies. One per request. */
export const getServerCaller = cache(async () => appRouter.createCaller(await createServerContext(await headers())));
