"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/useSupabaseUser";
import type { FeedPoem } from "@/lib/supabase/poems";
import { deletePoem } from "@/app/write/actions";
import { ShareDialog } from "@/components/PoemCard";
import ReportDialog from "@/components/ReportDialog";

function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "S"; }

// Poem card backed by Supabase data. Rendered as plain text; React escapes it.
export default function FeedPoemCard({ poem, detail = false }: { poem: FeedPoem; detail?: boolean }) {
  const { language, t } = useLanguage();
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const authorName = poem.penName || t("profile.writer");
  const isAuthor = user?.id === poem.authorId;
  const date = poem.publishedAt
    ? new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(poem.publishedAt))
    : "";

  const remove = async () => {
    setDeleting(true);
    try {
      const result = await deletePoem(poem.id);
      if (!result.ok) { toast.error(result.error); return; }
      setDeleteOpen(false);
      toast.success(t("poem.deleted"));
      if (detail) router.push("/explore");
      router.refresh();
    } catch { toast.error(t("poem.deleteError")); } finally { setDeleting(false); }
  };

  return <article id={`poem-${poem.id}`} className="poem-card">
    <div className="poem-author-row">
      <span className="author-link"><span className="avatar">{initials(authorName)}</span><span><strong>{authorName}</strong></span></span>
      <time dateTime={poem.publishedAt ?? undefined}>{date}</time>
    </div>
    <div className="poem-copy">
      <h3>{detail ? poem.title : <Link href={`/poem/${poem.id}`}>{poem.title}</Link>}</h3>
      <p>{poem.body}</p>
    </div>
    <div className="poem-actions-row">
      <ShareDialog poem={{ title: poem.title, content: poem.body, authorName, username: authorName }} />
      {!isAuthor && <ReportDialog targetType="poem" targetId={poem.id} />}
      {isAuthor && <>
        <Link className="poem-action owner-action" href={`/write?edit=${encodeURIComponent(poem.id)}&returnTo=${encodeURIComponent(`/poem/${poem.id}`)}`}><Pencil size={15} /> {t("poem.edit")}</Link>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild><button className="poem-action owner-action danger-action" disabled={deleting}><Trash2 size={15} /> {t("poem.delete")}</button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("poem.deleteTitle")}</DialogTitle><DialogDescription>{t("poem.deleteBody")}<br /><strong>“{poem.title}”</strong></DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>{t("poem.cancel")}</Button><Button variant="destructive" onClick={remove} disabled={deleting}>{t("poem.deleteConfirm")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </>}
    </div>
  </article>;
}
