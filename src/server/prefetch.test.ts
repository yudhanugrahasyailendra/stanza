import { getQueryKey } from "@trpc/react-query";
import { describe, expect, it } from "vitest";
import { trpc } from "@/lib/trpc";
import { trpcQueryKey } from "./prefetch";
import { excerpt, fallbackProfileMetadata, poemMetadata, profileMetadata } from "./seo";

describe("trpcQueryKey matches @trpc/react-query", () => {
  it("builds the same keys the client hooks read", () => {
    expect(trpcQueryKey("poems.feed")).toEqual(getQueryKey(trpc.poems.feed, undefined, "query"));
    expect(trpcQueryKey("auth.me")).toEqual(getQueryKey(trpc.auth.me, undefined, "query"));
    expect(trpcQueryKey("profile.public", { username: "anna" })).toEqual(getQueryKey(trpc.profile.public, { username: "anna" }, "query"));
  });

  it("distinguishes inputs", () => {
    expect(trpcQueryKey("profile.public", { username: "a" })).not.toEqual(trpcQueryKey("profile.public", { username: "b" }));
  });
});

describe("seo metadata", () => {
  it("collapses whitespace and cuts excerpts on a word boundary", () => {
    expect(excerpt("  baris satu\n\nbaris   dua  ")).toBe("baris satu baris dua");
    const long = "kata ".repeat(80);
    const cut = excerpt(long, 50);
    expect(cut.length).toBeLessThanOrEqual(50);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/kat…$/u);
  });

  it("describes a profile with its bio, or a localized fallback", () => {
    const withBio = profileMetadata({ name: "Anna", username: "anna", bio: "Menulis pelan-pelan." }, false);
    expect(withBio.title).toBe("Anna (@anna) · Stanza");
    expect(withBio.description).toBe("Menulis pelan-pelan.");
    expect(withBio.openGraph).toMatchObject({ type: "profile", locale: "id_ID", siteName: "Stanza" });
    expect(profileMetadata({ name: "Anna", username: "anna", bio: "" }, true).description).toBe("Poems by Anna on Stanza.");
    expect(profileMetadata({ name: null, username: null, bio: null }, false).title).toBe("Penulis · Stanza");
  });

  it("describes a poem with its first lines and author", () => {
    const meta = poemMetadata({ title: "Hujan", content: "Hujan turun\npelan\n\nsekali", authorName: "Anna", username: "anna" }, false);
    expect(meta.title).toBe("Hujan — Anna · Stanza");
    expect(meta.description).toBe("Hujan turun pelan sekali");
    expect(meta.openGraph).toMatchObject({ type: "article" });
    expect(poemMetadata({ title: " ", content: "x", authorName: null, username: "anna" }, true).title).toBe("Untitled — @anna · Stanza");
  });

  it("falls back without throwing", () => {
    expect(fallbackProfileMetadata(true).title).toBe("Writer profile · Stanza");
  });
});
