import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ profile: vi.fn(), poem: vi.fn(), language: { value: undefined as string | undefined } }));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (name === "stanza-language" && calls.language.value ? { value: calls.language.value } : undefined) }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), useParams: () => ({}) }));
vi.mock("react", async importOriginal => ({ ...(await importOriginal<typeof import("react")>()), cache: <T>(fn: T) => fn }));
vi.mock("./serverTrpc", () => ({
  getServerCaller: async () => ({ profile: { public: calls.profile }, poems: { byId: calls.poem } }),
}));

import Page, { generateMetadata } from "../app/profile/[username]/page";

const POEM_ID = "22222222-2222-4222-8222-222222222222";
const profile = { id: 7, name: "Anna", username: "anna", bio: "Menulis pelan-pelan.", poems: [] };
const poem = { id: POEM_ID, title: "Hujan", content: "Hujan turun\npelan sekali", authorId: 7, authorName: "Anna", username: "anna" };
const props = (username: string, search: Record<string, string> = {}) => ({ params: Promise.resolve({ username }), searchParams: Promise.resolve(search) });

beforeEach(() => { calls.profile.mockReset(); calls.poem.mockReset(); calls.language.value = undefined; });

describe("profile page metadata", () => {
  it("describes the profile", async () => {
    calls.profile.mockResolvedValue(profile);
    const meta = await generateMetadata(props("anna"));
    expect(calls.profile).toHaveBeenCalledWith({ username: "anna" });
    expect(meta).toMatchObject({ title: "Anna (@anna) · Stanza", description: "Menulis pelan-pelan." });
  });

  it("describes the focused poem when it belongs to this profile", async () => {
    calls.profile.mockResolvedValue(profile);
    calls.poem.mockResolvedValue(poem);
    const meta = await generateMetadata(props("anna", { poem: POEM_ID }));
    expect(meta).toMatchObject({ title: "Hujan — Anna · Stanza", description: "Hujan turun pelan sekali" });
  });

  it("ignores a poem that belongs to someone else, or an invalid id", async () => {
    calls.profile.mockResolvedValue(profile);
    calls.poem.mockResolvedValue({ ...poem, authorId: 99 });
    expect((await generateMetadata(props("anna", { poem: POEM_ID }))).title).toBe("Anna (@anna) · Stanza");
    calls.poem.mockClear();
    expect((await generateMetadata(props("anna", { poem: "not-a-uuid" }))).title).toBe("Anna (@anna) · Stanza");
    expect(calls.poem).not.toHaveBeenCalled();
  });

  it("falls back for unknown users, 'me', and loader errors", async () => {
    calls.profile.mockResolvedValue(null);
    expect((await generateMetadata(props("ghost"))).title).toBe("Profil penulis · Stanza");
    expect((await generateMetadata(props("me"))).title).toBe("Profil penulis · Stanza");
    expect(calls.profile).toHaveBeenCalledTimes(1);
    calls.profile.mockRejectedValue(new Error("db down"));
    expect((await generateMetadata(props("anna"))).title).toBe("Profil penulis · Stanza");
  });

  it("uses the language cookie and decodes the username", async () => {
    calls.language.value = "en";
    calls.profile.mockResolvedValue({ ...profile, bio: "" });
    const meta = await generateMetadata(props("%C3%BCn%C3%AF"));
    expect(calls.profile).toHaveBeenCalledWith({ username: "ünï" });
    expect(meta.description).toBe("Poems by Anna on Stanza.");
    expect((await generateMetadata(props("%E0%A4%A"))).title).toBeDefined();
  });
});

describe("profile page prefetch", () => {
  const dehydratedKeys = async (username: string) => {
    const element = (await Page({ params: Promise.resolve({ username }), searchParams: Promise.resolve({}) })) as { props: { state: { queries: Array<{ queryKey: unknown }> } } };
    return element.props.state.queries.map(query => query.queryKey);
  };

  it("hydrates profile.public under the key the client reads", async () => {
    calls.profile.mockResolvedValue(profile);
    expect(await dehydratedKeys("anna")).toEqual([[["profile", "public"], { input: { username: "anna" }, type: "query" }]]);
    expect(calls.profile).toHaveBeenCalledTimes(1);
  });

  it("does not prefetch for 'me' and survives a failing load", async () => {
    expect(await dehydratedKeys("me")).toEqual([]);
    expect(calls.profile).not.toHaveBeenCalled();
    calls.profile.mockRejectedValue(new Error("db down"));
    expect(await dehydratedKeys("anna")).toEqual([]);
  });
});
