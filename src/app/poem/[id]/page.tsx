import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FeedPoemCard from "@/components/FeedPoemCard";
import PoemComments from "@/components/PoemComments";
import { getComments, getPoem } from "@/lib/supabase/poems";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const poem = await getPoem((await params).id);
  if (!poem) return { title: "Puisi tidak ditemukan — Stanza" };
  const excerpt = poem.body.replace(/\s+/g, " ").trim().slice(0, 160);
  return { title: `${poem.title} — ${poem.penName || "Stanza"}`, description: excerpt };
}

export default async function Page({ params }: Props) {
  const poem = await getPoem((await params).id);
  if (!poem) notFound();
  const comments = await getComments(poem.id);
  return <div className="explore-page" style={{ paddingTop: 40 }}>
    <FeedPoemCard poem={poem} detail />
    <PoemComments poemId={poem.id} poemAuthorId={poem.authorId} comments={comments} />
    <p style={{ marginTop: 28, fontSize: 14 }}><Link href="/explore">← Stanza</Link></p>
  </div>;
}
