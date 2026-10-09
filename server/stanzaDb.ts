import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { User } from "../drizzle/schema";
import { likes, poems, users } from "../drizzle/schema";
import { getDb } from "./db";

export async function ensureStanzaProfile(user: User) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia.");
  const [current] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!current) throw new Error("Profil pengguna tidak ditemukan.");
  if (current.username) return current;

  const base = (current.name || "penulis")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "penulis";
  await db.update(users).set({ username: `${base}-${current.id}`, bio: current.bio ?? "Menulis pelan-pelan." }).where(eq(users.id, current.id));
  const [updated] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  return updated;
}

export async function getPublishedPoems(authorId?: number, viewerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const base = db.select({
    id: poems.id,
    title: poems.title,
    content: poems.content,
    authorId: poems.authorId,
    publishedAt: poems.publishedAt,
    authorName: users.name,
    username: users.username,
    avatarUrl: users.avatarUrl,
  }).from(poems).innerJoin(users, eq(poems.authorId, users.id));
  const rows = authorId === undefined
    ? await base.where(eq(poems.status, "published")).orderBy(desc(poems.publishedAt)).limit(30)
    : await base.where(and(eq(poems.status, "published"), eq(poems.authorId, authorId))).orderBy(desc(poems.publishedAt)).limit(60);
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const countRows = await db.select({ poemId: likes.poemId, value: count() }).from(likes).where(inArray(likes.poemId, ids)).groupBy(likes.poemId);
  const likedRows = viewerId === undefined ? [] : await db.select({ poemId: likes.poemId }).from(likes).where(and(eq(likes.userId, viewerId), inArray(likes.poemId, ids)));
  const countById = new Map(countRows.map(row => [row.poemId, Number(row.value)]));
  const likedSet = new Set(likedRows.map(row => row.poemId));
  return rows.map(row => ({ ...row, likesCount: countById.get(row.id) ?? 0, likedByMe: likedSet.has(row.id) }));
}
