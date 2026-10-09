import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cache, Suspense } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import Profile from "@/pages/Profile";
import { LANGUAGE_PREF_KEY, parseLanguage } from "@/lib/preferences";
import { prefetchTrpc } from "../../../server/prefetch";
import { fallbackProfileMetadata, poemMetadata, profileMetadata } from "../../../server/seo";
import { getServerCaller } from "../../../server/serverTrpc";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeDecode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };

// Shared by generateMetadata and the page, so each request loads a profile/poem once.
const loadProfile = cache(async (username: string) => (await getServerCaller()).profile.public({ username }));
const loadPoem = cache(async (id: string) => (await getServerCaller()).poems.byId({ id }));
const isEnglish = async () => parseLanguage((await cookies()).get(LANGUAGE_PREF_KEY)?.value) === "en";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const english = await isEnglish();
  const username = safeDecode((await params).username);
  if (!username || username === "me") return fallbackProfileMetadata(english);
  try {
    const profile = await loadProfile(username);
    if (!profile) return fallbackProfileMetadata(english);
    // Links from notifications/shares look like /profile/<user>?poem=<id>: describe that poem.
    const poemParam = (await searchParams).poem;
    const poemId = typeof poemParam === "string" && UUID.test(poemParam) ? poemParam : "";
    const poem = poemId ? await loadPoem(poemId) : null;
    if (poem && poem.authorId === profile.id) return poemMetadata(poem, english);
    return profileMetadata(profile, english);
  } catch {
    return fallbackProfileMetadata(english);
  }
}

export default async function Page({ params }: Props) {
  const username = safeDecode((await params).username);
  const queryClient = new QueryClient();
  // "me" depends on the signed-in user's own username and is fetched by the client component.
  if (username && username !== "me") await prefetchTrpc(queryClient, "profile.public", { username }, () => loadProfile(username));
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <Profile />
      </Suspense>
    </HydrationBoundary>
  );
}
