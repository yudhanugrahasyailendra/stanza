import Explore from "@/views/Explore";
import { getPublishedFeed } from "@/lib/supabase/poems";

// The feed is read from Supabase on the server (RLS applies), so it is in the first HTML.
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const raw = (await searchParams).page;
  const parsed = Number.parseInt(typeof raw === "string" ? raw : "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : 1;
  const { poems, hasNext } = await getPublishedFeed(page);
  return <Explore poems={poems} page={page} hasNext={hasNext} />;
}
