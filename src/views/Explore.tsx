"use client";

import Link from "next/link";
import { Feather, Leaf, MoveDownRight } from "lucide-react";
import FeedPoemCard from "@/components/FeedPoemCard";
import type { FeedPoem } from "@/lib/supabase/poems";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Explore({ poems, page, hasNext }: { poems: FeedPoem[]; page: number; hasNext: boolean }) {
  const { t } = useLanguage();
  return <div className="explore-page">
    <section className="explore-intro">
      <div className="eyebrow"><Leaf size={13} /> {t("explore.eyebrow")}</div>
      <h1>{t("explore.titleA")}<br /><em>{t("explore.titleB")}</em></h1>
      <div className="intro-bottom"><p>{t("explore.desc")}</p><span className="intro-sidenote">{t("explore.sideA")}<br />{t("explore.sideB")}</span></div>
      <div className="intro-rule"><span>{t("explore.divider")}</span><MoveDownRight size={16} /></div>
    </section>
    <section className="feed-section" aria-label="Puisi publik">
      <div className="feed-heading"><div><span className="section-kicker">{t("explore.kicker")}</span><h2>{t("explore.heading")}</h2></div><span className="feed-note">{t("explore.note")}</span></div>
      {poems.length ? <>
        <div className="poem-list">{poems.map(poem => <FeedPoemCard key={poem.id} poem={poem} />)}</div>
        {(page > 1 || hasNext) && <nav className="feed-pager" aria-label="Pagination" style={{ display: "flex", justifyContent: "space-between", marginTop: 28, fontSize: 14 }}>
          {page > 1 ? <Link href={page === 2 ? "/explore" : `/explore?page=${page - 1}`}>← {t("explore.prev")}</Link> : <span />}
          {hasNext && <Link href={`/explore?page=${page + 1}`}>{t("explore.next")} →</Link>}
        </nav>}
      </> : <div className="empty-feed"><div className="empty-seed"><Feather size={21} strokeWidth={1.4} /></div><h3>{t("explore.emptyTitle")}</h3><p>{t("explore.emptyBody")}</p><Button asChild className="olive-button"><Link href="/write">{t("explore.start")} <Feather size={15} /></Link></Button></div>}
    </section>
  </div>;
}
