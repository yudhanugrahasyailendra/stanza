import { and, count, desc, eq, isNull, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { accountSessions, comments, follows, likes, localCredentials, notifications, poems, usabilityFeedback, users } from "../drizzle/schema";
import { getDb } from "./db";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ensureStanzaProfile, getPublishedPoems } from "./stanzaDb";
import { endAppSession, issueLocalSession } from "./_core/localAuth";
import { hashPassword, verifyPassword } from "./_core/passwords";

const poemInput = z.object({ id: z.string().uuid().optional(), title: z.string().trim().max(180).default(""), content: z.string().max(12000) });
const feedbackSubmission = z.object({
  deviceType: z.enum(["mobile", "desktop", "tablet", "other"]),
  firstVisit: z.boolean(),
  taskResults: z.object({
    draft: z.enum(["done", "stuck", "skipped"]),
    publish: z.enum(["done", "stuck", "skipped"]),
    appreciation: z.enum(["done", "stuck", "skipped"]),
    follow: z.enum(["done", "stuck", "skipped"]),
    settings: z.enum(["done", "stuck", "skipped"]),
    export: z.enum(["done", "stuck", "skipped"]),
  }),
  susAnswers: z.array(z.number().int().min(1).max(5)).length(10),
  confusion: z.string().trim().max(1500).optional().default(""),
  suggestion: z.string().trim().max(1500).optional().default(""),
  consent: z.literal(true),
});
const database = async () => {
  const db = await getDb();
  if (!db) throw new Error("Database Stanza belum tersedia.");
  return db;
};
async function profileStats(userId: number, viewerId?: number) {
  const db = await database();
  const [followers] = await db.select({ value: count() }).from(follows).where(eq(follows.followingId, userId));
  const [following] = await db.select({ value: count() }).from(follows).where(eq(follows.followerId, userId));
  let isFollowing = false;
  if (viewerId && viewerId !== userId) {
    const [relation] = await db.select({ followerId: follows.followerId }).from(follows)
      .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, userId))).limit(1);
    isFollowing = Boolean(relation);
  }
  return { followersCount: Number(followers?.value ?? 0), followingCount: Number(following?.value ?? 0), isFollowing };
}
const emailSchema = z.string().trim().email().max(320).transform(value => value.toLowerCase());
const passwordSchema = z.string().min(10, "Kata sandi minimal 10 karakter.").max(128);
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_AUTH_ATTEMPT_BUCKETS = 4096;
let authAttemptSweepCounter = 0;
function guardAuthAttempts(ip: string) {
  const now = Date.now();
  const key = ip || "unknown";
  const current = authAttempts.get(key);
  if (++authAttemptSweepCounter % 64 === 0 || authAttempts.size >= MAX_AUTH_ATTEMPT_BUCKETS) {
    for (const [entry, bucket] of authAttempts) if (bucket.resetAt <= now) authAttempts.delete(entry);
  }
  if (!current || current.resetAt <= now) { authAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); return; }
  if (current.count >= 12) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." });
  current.count++;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await endAppSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(1).max(100), email: emailSchema, password: passwordSchema })).mutation(async ({ ctx, input }) => {
      guardAuthAttempts(ctx.req.ip || "unknown");
      const db = await database();
      const [credential] = await db.select({ userId: localCredentials.userId }).from(localCredentials).where(eq(localCredentials.email, input.email)).limit(1);
      if (credential) throw new TRPCError({ code: "CONFLICT", message: "Email sudah memiliki akun Stanza." });
      const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existing && ctx.user?.id !== existing.id) throw new TRPCError({ code: "CONFLICT", message: "Email ini terhubung ke akun lama. Masuk dengan penyedia sebelumnya untuk menambahkan kata sandi Stanza." });
      let user = existing;
      if (!user) {
        const openId = `stanza-${randomUUID()}`;
        await db.insert(users).values({ openId, name: input.name, email: input.email, loginMethod: "stanza", lastSignedIn: new Date() });
        [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      }
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Akun tidak dapat dibuat." });
      await db.insert(localCredentials).values({ userId: user.id, email: input.email, passwordHash: await hashPassword(input.password) });
      await db.update(users).set({ name: input.name, email: input.email, lastSignedIn: new Date() }).where(eq(users.id, user.id));
      await ensureStanzaProfile({ ...user, name: input.name, email: input.email });
      await issueLocalSession(user.id, ctx.req, ctx.res);
      return { success: true } as const;
    }),
    login: publicProcedure.input(z.object({ email: emailSchema, password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      guardAuthAttempts(ctx.req.ip || "unknown");
      const db = await database();
      const [credential] = await db.select().from(localCredentials).where(eq(localCredentials.email, input.email)).limit(1);
      if (!credential || !(await verifyPassword(input.password, credential.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email atau kata sandi tidak cocok." });
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, credential.userId));
      await issueLocalSession(credential.userId, ctx.req, ctx.res);
      return { success: true } as const;
    }),
    accountSettings: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [credential] = await db.select({ email: localCredentials.email }).from(localCredentials).where(eq(localCredentials.userId, profile.id)).limit(1);
      return { id: profile.id, name: profile.name || "", username: profile.username || "", email: credential?.email || profile.email || "", avatarUrl: profile.avatarUrl || "", birthDate: profile.birthDate || "", language: profile.language, theme: profile.theme, hasLocalPassword: Boolean(credential) };
    }),
    setPassword: protectedProcedure.input(z.object({ email: emailSchema, password: passwordSchema })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [current] = await db.select({ userId: localCredentials.userId }).from(localCredentials).where(eq(localCredentials.userId, profile.id)).limit(1);
      if (current) throw new TRPCError({ code: "CONFLICT", message: "Akun ini sudah memiliki kata sandi." });
      const [emailUsed] = await db.select({ userId: localCredentials.userId }).from(localCredentials).where(eq(localCredentials.email, input.email)).limit(1);
      const [otherProfile] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, input.email), ne(users.id, profile.id))).limit(1);
      if (emailUsed || otherProfile) throw new TRPCError({ code: "CONFLICT", message: "Email sudah digunakan akun lain." });
      await db.insert(localCredentials).values({ userId: profile.id, email: input.email, passwordHash: await hashPassword(input.password) });
      await db.update(users).set({ email: input.email }).where(eq(users.id, profile.id));
      await issueLocalSession(profile.id, ctx.req, ctx.res);
      return { success: true } as const;
    }),
    updateAccount: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(100), username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,47}$/), email: emailSchema, avatarUrl: z.string().trim().max(2000), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), currentPassword: z.string().max(128).optional() })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [sameUsername] = await db.select({ id: users.id }).from(users).where(and(eq(users.username, input.username), ne(users.id, profile.id))).limit(1);
      if (sameUsername) throw new TRPCError({ code: "CONFLICT", message: "Username sudah digunakan." });
      const [credential] = await db.select().from(localCredentials).where(eq(localCredentials.userId, profile.id)).limit(1);
      if (input.birthDate && input.birthDate > new Date().toISOString().slice(0, 10)) throw new TRPCError({ code: "BAD_REQUEST", message: "Tanggal lahir tidak boleh di masa depan." });
      if (credential && input.email !== credential.email) {
        if (!input.currentPassword || !(await verifyPassword(input.currentPassword, credential.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Kata sandi saat ini diperlukan untuk mengubah email." });
        const [emailUsed] = await db.select({ userId: localCredentials.userId }).from(localCredentials).where(eq(localCredentials.email, input.email)).limit(1);
        const [otherEmail] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, input.email), ne(users.id, profile.id))).limit(1);
        if (emailUsed || otherEmail) throw new TRPCError({ code: "CONFLICT", message: "Email sudah digunakan akun lain." });
        await db.update(localCredentials).set({ email: input.email }).where(eq(localCredentials.userId, profile.id));
      } else if (!credential && input.email !== (profile.email || "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tambahkan kata sandi Stanza sebelum mengubah email login." });
      }
      await db.update(users).set({ name: input.name, username: input.username, email: credential ? input.email : profile.email, avatarUrl: input.avatarUrl || null, birthDate: input.birthDate || null }).where(eq(users.id, profile.id));
      return { success: true, username: input.username } as const;
    }),
    updatePreferences: protectedProcedure.input(z.object({ language: z.enum(["id", "en"]), theme: z.enum(["light", "dark", "system"]) })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      await db.update(users).set({ language: input.language, theme: input.theme }).where(eq(users.id, profile.id));
      return { success: true } as const;
    }),
    changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [credential] = await db.select().from(localCredentials).where(eq(localCredentials.userId, profile.id)).limit(1);
      if (!credential || !(await verifyPassword(input.currentPassword, credential.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Kata sandi saat ini tidak cocok." });
      await db.update(localCredentials).set({ passwordHash: await hashPassword(input.newPassword), passwordUpdatedAt: new Date() }).where(eq(localCredentials.userId, profile.id));
      await db.delete(accountSessions).where(eq(accountSessions.userId, profile.id));
      await issueLocalSession(profile.id, ctx.req, ctx.res);
      return { success: true } as const;
    }),
    deleteAccount: protectedProcedure.input(z.object({ confirmation: z.enum(["HAPUS", "DELETE"]), currentPassword: z.string().max(128).optional() })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [credential] = await db.select().from(localCredentials).where(eq(localCredentials.userId, profile.id)).limit(1);
      if (credential && (!input.currentPassword || !(await verifyPassword(input.currentPassword, credential.passwordHash)))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Kata sandi saat ini diperlukan untuk menghapus akun." });
      await db.delete(users).where(eq(users.id, profile.id));
      await endAppSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  poems: router({
    feed: publicProcedure.query(async ({ ctx }) => getPublishedPoems(undefined, ctx.user?.id)),
    byId: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select({ id: poems.id, title: poems.title, content: poems.content, authorId: poems.authorId, publishedAt: poems.publishedAt, authorName: users.name, username: users.username, avatarUrl: users.avatarUrl })
        .from(poems).innerJoin(users, eq(poems.authorId, users.id))
        .where(and(eq(poems.id, input.id), eq(poems.status, "published"))).limit(1);
      if (!row) return null;
      const [likesTotal] = await db.select({ value: count() }).from(likes).where(eq(likes.poemId, input.id));
      let likedByMe = false;
      if (ctx.user?.id) {
        const [liked] = await db.select({ userId: likes.userId }).from(likes).where(and(eq(likes.userId, ctx.user.id), eq(likes.poemId, input.id))).limit(1);
        likedByMe = Boolean(liked);
      }
      return { ...row, likesCount: Number(likesTotal?.value ?? 0), likedByMe };
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      return db.select().from(poems).where(eq(poems.authorId, profile.id)).orderBy(desc(poems.updatedAt)).limit(80);
    }),
    comments: publicProcedure.input(z.object({ poemId: z.string().uuid() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const [poem] = await db.select({ id: poems.id }).from(poems).where(and(eq(poems.id, input.poemId), eq(poems.status, "published"))).limit(1);
      if (!poem) return [];
      return db.select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, authorName: users.name, username: users.username, avatarUrl: users.avatarUrl })
        .from(comments).innerJoin(users, eq(comments.authorId, users.id)).where(eq(comments.poemId, input.poemId)).orderBy(desc(comments.createdAt)).limit(40);
    }),
    saveDraft: protectedProcedure.input(poemInput).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const title = input.title || "Tanpa judul";
      if (input.id) {
        const [existing] = await db.select({ id: poems.id }).from(poems).where(and(eq(poems.id, input.id), eq(poems.authorId, profile.id))).limit(1);
        if (!existing) throw new Error("Draf tidak ditemukan.");
        await db.update(poems).set({ title, content: input.content, status: "draft", publishedAt: null }).where(eq(poems.id, input.id));
        return { id: input.id };
      }
      const id = randomUUID();
      await db.insert(poems).values({ id, authorId: profile.id, title, content: input.content, status: "draft" });
      return { id };
    }),
    publish: protectedProcedure.input(z.object({ id: z.string().uuid().optional(), title: z.string().trim().min(1).max(180), content: z.string().min(1).max(12000) })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const publishedAt = new Date();
      if (input.id) {
        const [existing] = await db.select({ id: poems.id }).from(poems).where(and(eq(poems.id, input.id), eq(poems.authorId, profile.id))).limit(1);
        if (!existing) throw new Error("Karya tidak ditemukan.");
        await db.update(poems).set({ title: input.title, content: input.content, status: "published", publishedAt }).where(eq(poems.id, input.id));
        return { id: input.id };
      }
      const id = randomUUID();
      await db.insert(poems).values({ id, authorId: profile.id, title: input.title, content: input.content, status: "published", publishedAt });
      return { id };
    }),
    updatePublished: protectedProcedure.input(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(180), content: z.string().min(1).max(12000) })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const condition = and(eq(poems.id, input.id), eq(poems.authorId, profile.id), eq(poems.status, "published"));
      const [existing] = await db.select({ id: poems.id }).from(poems).where(condition).limit(1);
      if (!existing) throw new Error("Puisi tidak ditemukan atau bukan milikmu.");
      await db.update(poems).set({ title: input.title, content: input.content }).where(condition);
      return { id: input.id };
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const condition = and(eq(poems.id, input.id), eq(poems.authorId, profile.id), eq(poems.status, "published"));
      const [existing] = await db.select({ id: poems.id }).from(poems).where(condition).limit(1);
      if (!existing) throw new Error("Puisi tidak ditemukan atau bukan milikmu.");
      await db.delete(poems).where(condition);
      return { success: true };
    }),
    setLike: protectedProcedure.input(z.object({ poemId: z.string().uuid(), liked: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [poem] = await db.select({ id: poems.id, authorId: poems.authorId }).from(poems).where(and(eq(poems.id, input.poemId), eq(poems.status, "published"))).limit(1);
      if (!poem) throw new Error("Puisi tidak ditemukan.");
      const condition = and(eq(likes.userId, profile.id), eq(likes.poemId, input.poemId));
      await db.transaction(async tx => {
        if (input.liked) {
          const [existing] = await tx.select({ userId: likes.userId }).from(likes).where(condition).limit(1);
          if (!existing) {
            await tx.insert(likes).values({ userId: profile.id, poemId: input.poemId });
            if (poem.authorId !== profile.id) await tx.insert(notifications).values({ id: randomUUID(), recipientId: poem.authorId, actorId: profile.id, poemId: poem.id, kind: "like" });
          }
        } else await tx.delete(likes).where(condition);
      });
      return { liked: input.liked };
    }),
    comment: protectedProcedure.input(z.object({ poemId: z.string().uuid(), body: z.string().trim().min(1).max(700) })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [poem] = await db.select({ id: poems.id, authorId: poems.authorId }).from(poems).where(and(eq(poems.id, input.poemId), eq(poems.status, "published"))).limit(1);
      if (!poem) throw new Error("Puisi tidak ditemukan.");
      const id = randomUUID();
      await db.transaction(async tx => {
        await tx.insert(comments).values({ id, poemId: input.poemId, authorId: profile.id, body: input.body });
        if (poem.authorId !== profile.id) await tx.insert(notifications).values({ id: randomUUID(), recipientId: poem.authorId, actorId: profile.id, poemId: poem.id, commentId: id, kind: "comment" });
      });
      return { id };
    }),
  }),
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const profile = await ensureStanzaProfile(ctx.user);
      const [stats, profilePoems] = await Promise.all([profileStats(profile.id, profile.id), getPublishedPoems(profile.id, profile.id)]);
      return { ...profile, ...stats, poems: profilePoems };
    }),
    public: publicProcedure.input(z.object({ username: z.string().min(1).max(48) })).query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [profile] = await db.select({ id: users.id, name: users.name, username: users.username, bio: users.bio, avatarUrl: users.avatarUrl, createdAt: users.createdAt }).from(users).where(eq(users.username, input.username)).limit(1);
      if (!profile) return null;
      const [stats, profilePoems] = await Promise.all([profileStats(profile.id, ctx.user?.id), getPublishedPoems(profile.id, ctx.user?.id)]);
      return { ...profile, ...stats, poems: profilePoems };
    }),
    update: protectedProcedure.input(z.object({ bio: z.string().max(240), avatarUrl: z.union([z.string().url().max(500), z.literal("")]).optional() })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const changes = { bio: input.bio.trim(), ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}) };
      await db.update(users).set(changes).where(eq(users.id, profile.id));
      return { success: true };
    }),
    follow: protectedProcedure.input(z.object({ username: z.string().min(1).max(48), following: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [target] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Profil tidak ditemukan." });
      if (target.id === profile.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Kamu tidak dapat mengikuti dirimu sendiri." });
      const condition = and(eq(follows.followerId, profile.id), eq(follows.followingId, target.id));
      if (input.following) await db.transaction(async tx => {
        const [existing] = await tx.select({ followerId: follows.followerId }).from(follows).where(condition).limit(1);
        if (existing) return;
        await tx.insert(follows).values({ followerId: profile.id, followingId: target.id });
        await tx.insert(notifications).values({ id: randomUUID(), recipientId: target.id, actorId: profile.id, kind: "follow" });
      });
      else await db.delete(follows).where(condition);
      return { following: input.following };
    }),
  }),
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const rows = await db.select({
        id: notifications.id, kind: notifications.kind, createdAt: notifications.createdAt, readAt: notifications.readAt,
        actorName: users.name, actorUsername: users.username, actorAvatarUrl: users.avatarUrl,
        poemId: poems.id, poemTitle: poems.title, commentBody: comments.body,
      }).from(notifications)
        .innerJoin(users, eq(notifications.actorId, users.id))
        .leftJoin(poems, eq(notifications.poemId, poems.id))
        .leftJoin(comments, eq(notifications.commentId, comments.id))
        .where(eq(notifications.recipientId, profile.id)).orderBy(desc(notifications.createdAt)).limit(60);
      return rows.map(row => ({ ...row, recipientUsername: profile.username }));
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      const [row] = await db.select({ value: count() }).from(notifications)
        .where(and(eq(notifications.recipientId, profile.id), isNull(notifications.readAt)));
      return Number(row?.value ?? 0);
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await database();
      const profile = await ensureStanzaProfile(ctx.user);
      await db.update(notifications).set({ readAt: new Date() })
        .where(and(eq(notifications.recipientId, profile.id), isNull(notifications.readAt)));
      return { success: true } as const;
    }),
  }),
  feedback: router({
    submit: publicProcedure.input(feedbackSubmission).mutation(async ({ input }) => {
      const db = await database();
      const [sus1, sus2, sus3, sus4, sus5, sus6, sus7, sus8, sus9, sus10] = input.susAnswers;
      const rawScore = input.susAnswers.reduce((sum, answer, index) => sum + (index % 2 === 0 ? answer - 1 : 5 - answer), 0) * 2.5;
      await db.insert(usabilityFeedback).values({
        id: randomUUID(),
        deviceType: input.deviceType,
        firstVisit: input.firstVisit,
        taskResults: input.taskResults,
        sus1, sus2, sus3, sus4, sus5, sus6, sus7, sus8, sus9, sus10,
        susScore: Number(rawScore.toFixed(1)),
        confusion: input.confusion || null,
        suggestion: input.suggestion || null,
        consentedAt: new Date(),
      });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
