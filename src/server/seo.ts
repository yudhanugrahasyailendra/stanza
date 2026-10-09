import type { Metadata } from "next";

export type SeoProfile = { name: string | null; username: string | null; bio: string | null };
export type SeoPoem = { title: string; content: string; authorName: string | null; username: string | null };

/** One-line excerpt for descriptions: collapses whitespace/newlines and cuts on a word boundary. */
export function excerpt(text: string, max = 160) {
  const flat = text.replace(/\s+/gu, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!?-]+$/u, "")}…`;
}

function build(title: string, description: string, english: boolean, type: "profile" | "article"): Metadata {
  return {
    title,
    description,
    openGraph: { type, title, description, siteName: "Stanza", locale: english ? "en_US" : "id_ID" },
    twitter: { card: "summary", title, description },
  };
}

export function profileMetadata(profile: SeoProfile, english: boolean): Metadata {
  const name = profile.name?.trim() || (english ? "Writer" : "Penulis");
  const handle = profile.username ? ` (@${profile.username})` : "";
  const description = excerpt(profile.bio?.trim() || (english ? `Poems by ${name} on Stanza.` : `Puisi dari ${name} di Stanza.`));
  return build(`${name}${handle} · Stanza`, description, english, "profile");
}

export function poemMetadata(poem: SeoPoem, english: boolean): Metadata {
  const author = poem.authorName?.trim() || (poem.username ? `@${poem.username}` : english ? "Writer" : "Penulis");
  const title = `${poem.title.trim() || (english ? "Untitled" : "Tanpa judul")} — ${author} · Stanza`;
  return build(title, excerpt(poem.content) || (english ? "A poem on Stanza." : "Puisi di Stanza."), english, "article");
}

export function fallbackProfileMetadata(english: boolean): Metadata {
  return { title: english ? "Writer profile · Stanza" : "Profil penulis · Stanza" };
}
