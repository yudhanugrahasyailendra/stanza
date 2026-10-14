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
  const poem = { id: "11111111-1111-4111-8111-111111111111", authorId: "u1", title: "Hujan Pertama", body: "Hujan turun\npelan sekali", publishedAt: "2026-10-01T00:00:00Z", penName: "Anna" };

  it("renders the Supabase feed passed from the server into the HTML", () => {
    const html = renderToString(<Providers><Explore poems={[poem]} page={1} hasNext={false} /></Providers>);
    expect(html).toContain("Hujan Pertama");
    expect(html).toContain("Anna");
    expect(html).toContain("/poem/11111111-1111-4111-8111-111111111111");
    expect(html).not.toContain("explore?page=");
  });

  it("shows the empty state when there are no poems", () => {
    const html = renderToString(<Providers><Explore poems={[]} page={1} hasNext={false} /></Providers>);
    expect(html).not.toContain("Hujan Pertama");
    expect(html).toContain("empty-feed");
  });

  it("links to the neighbouring pages", () => {
    const html = renderToString(<Providers><Explore poems={[poem]} page={2} hasNext /></Providers>);
    expect(html).toContain('href="/explore"');
    expect(html).toContain("/explore?page=3");
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
