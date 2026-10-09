import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import { timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { STANZA_CSRF_COOKIE } from "@shared/const";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
const requireCsrfForMutation = t.middleware(async opts => {
  if (opts.type !== "mutation") return opts.next();
  const cookieValue = parseCookieHeader(opts.ctx.req.headers.cookie ?? "")[STANZA_CSRF_COOKIE];
  const headerValue = opts.ctx.req.headers["x-stanza-csrf"];
  const token = typeof headerValue === "string" ? headerValue : "";
  const valid = Boolean(cookieValue && /^[a-f0-9]{64}$/.test(cookieValue) && token.length === cookieValue.length && timingSafeEqual(Buffer.from(cookieValue), Buffer.from(token)));
  if (!valid) throw new TRPCError({ code: "FORBIDDEN", message: "Sesi tidak valid. Muat ulang halaman lalu coba lagi." });
  return opts.next();
});
const baseProcedure = t.procedure.use(requireCsrfForMutation);
export const publicProcedure = baseProcedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = baseProcedure.use(requireUser);

export const adminProcedure = baseProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
