import { cache } from "react";
import { createClient } from "./server";

export const FEED_PAGE_SIZE = 12;

export type FeedPoem = {
  id: string;
  authorId: string;
  title: string;
  body: string;
  publishedAt: string | null;
  penName: string;
};

type Row = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  published_at: string | null;
  profiles: { pen_name: string } | { pen_name: string }[] | null;
};

const SELECT = "id,author_id,title,body,published_at,profiles(pen_name)";

function toPoem(row: Row): FeedPoem {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return { id: row.id, authorId: row.author_id, title: row.title, body: row.body, publishedAt: row.published_at, penName: profile?.pen_name ?? "" };
}

// RLS also lets authors read their own drafts, so the status filter is required here.
export async function getPublishedFeed(page: number): Promise<{ poems: FeedPoem[]; hasNext: boolean }> {
  const supabase = await createClient();
  const from = (page - 1) * FEED_PAGE_SIZE;
  // One extra row tells us whether a next page exists without a separate count query.
  const { data, error } = await supabase
    .from("poems")
    .select(SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, from + FEED_PAGE_SIZE)
    .returns<Row[]>();
  if (error || !data) return { poems: [], hasNext: false };
  return { poems: data.slice(0, FEED_PAGE_SIZE).map(toPoem), hasNext: data.length > FEED_PAGE_SIZE };
}

// Shared by generateMetadata and the page through React's per-request cache.
export const getPoem = cache(async (id: string): Promise<FeedPoem | null> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("poems").select(SELECT).eq("id", id).maybeSingle<Row>();
  return data ? toPoem(data) : null;
});

export type PoemComment = { id: string; authorId: string; body: string; createdAt: string; penName: string };

type CommentRow = { id: string; author_id: string; body: string; created_at: string; profiles: { pen_name: string } | { pen_name: string }[] | null };

// Oldest first. RLS only returns comments of poems the viewer may see.
export async function getComments(poemId: string): Promise<PoemComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("id,author_id,body,created_at,profiles(pen_name)")
    .eq("poem_id", poemId)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();
  return (data ?? []).map(row => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { id: row.id, authorId: row.author_id, body: row.body, createdAt: row.created_at, penName: profile?.pen_name ?? "" };
  });
}
