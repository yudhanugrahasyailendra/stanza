import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
  useRouter: () => ({ push() {}, replace() {} }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
vi.mock("../server/stanzaDb", async importOriginal => ({
  ...(await importOriginal<typeof import("../server/stanzaDb")>()),
  getPublishedPoems: vi.fn(async () => [
    { id: "11111111-1111-4111-8111-111111111111", title: "Hujan Pertama", content: "Hujan turun\npelan sekali", authorId: 7, publishedAt: new Date("2026-10-01T00:00:00Z"), authorName: "Anna", username: "anna", avatarUrl: null, likesCount: 3, likedByMe: false },
  ]),
}));

import Providers from "../app/providers";
import Explore from "@/views/Explore";
import { useAuth } from "@/_core/hooks/useAuth";
import { prefetchTrpc } from "../server/prefetch";
import { appRouter } from "../server/routers";

const user = { id: 7, openId: "o", email: "a@example.com", name: "Anna", loginMethod: "local", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const caller = (signedIn: boolean) => appRouter.createCaller({ req: { headers: {} }, res: { cookie() {}, clearCookie() {} }, user: signedIn ? user : null });

function AuthProbe() {
  const { user: current, loading } = useAuth();
  return <p>{current ? `signed-in:${current.name}` : loading ? "loading" : "guest"}</p>;
}

describe("server prefetch → hydrated first render", () => {
  it("puts the feed into the server HTML", async () => {
    const queryClient = new QueryClient();
    await prefetchTrpc(queryClient, "poems.feed", undefined, () => caller(false).poems.feed());
    const html = renderToString(<Providers><HydrationBoundary state={dehydrate(queryClient)}><Explore /></HydrationBoundary></Providers>);
    expect(html).toContain("Hujan Pertama");
    expect(html).not.toContain("Memuat puisi");
  });

  it("control: without prefetched data the page renders its loading state", () => {
    const html = renderToString(<Providers><Explore /></Providers>);
    expect(html).toContain("Memuat puisi");
    expect(html).not.toContain("Hujan Pertama");
  });

  it("control: data under a different key is not picked up", async () => {
    const queryClient = new QueryClient();
    await prefetchTrpc(queryClient, "poems.mine", undefined, () => caller(false).poems.feed());
    const html = renderToString(<Providers><HydrationBoundary state={dehydrate(queryClient)}><Explore /></HydrationBoundary></Providers>);
    expect(html).toContain("Memuat puisi");
  });

  it("seeds the signed-in user so the header does not flash as guest", async () => {
    const queryClient = new QueryClient();
    await prefetchTrpc(queryClient, "auth.me", undefined, () => caller(true).auth.me());
    const seeded = renderToString(<Providers><HydrationBoundary state={dehydrate(queryClient)}><AuthProbe /></HydrationBoundary></Providers>);
    expect(seeded).toContain("signed-in:Anna");
    expect(renderToString(<Providers><AuthProbe /></Providers>)).toContain("loading");
  });

  it("a failing load is skipped, leaving the client to fetch", async () => {
    const queryClient = new QueryClient();
    await prefetchTrpc(queryClient, "poems.feed", undefined, async () => { throw new Error("db down"); });
    expect(dehydrate(queryClient).queries).toHaveLength(0);
  });
});
