"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSupabaseUser } from "@/lib/supabase/useSupabaseUser";
import type { PoemComment } from "@/lib/supabase/poems";
import { addComment, deleteComment } from "@/app/poem/[id]/actions";
import ReportDialog from "@/components/ReportDialog";

function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "P"; }

export default function PoemComments({ poemId, poemAuthorId, comments }: { poemId: string; poemAuthorId: string; comments: PoemComment[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useSupabaseUser();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const loginHref = `/login?returnTo=${encodeURIComponent(`/poem/${poemId}`)}`;

  const run = async (action: () => ReturnType<typeof addComment>, onOk: () => void) => {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) { toast.error(result.error); if (result.code === "unauthenticated") router.push(loginHref); return; }
      onOk();
      router.refresh();
    } catch { toast.error(t("common.error")); } finally { setBusy(false); }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    void run(() => addComment({ poemId, body: text }), () => { setText(""); toast.success(t("poem.commentSuccess")); });
  };
  const remove = (id: string) => {
    if (!window.confirm(t("poem.commentDeleteConfirm"))) return;
    void run(() => deleteComment(id), () => toast.success(t("poem.commentDeleted")));
  };

  return <section className="comments-panel" aria-label={t("poem.comments")}>
    <div className="comments-heading"><span>{t("poem.comments")} ({comments.length})</span></div>
    <div className="comment-list">
      {comments.length ? comments.map(item => {
        const name = item.penName || t("profile.kicker");
        const canDelete = Boolean(user) && (user?.id === item.authorId || user?.id === poemAuthorId);
        return <div className="comment-item" key={item.id}>
          <span className="avatar avatar-tiny">{initials(name)}</span>
          <p><strong>{name}</strong><span>{item.body}</span></p>
          {user?.id !== item.authorId && <ReportDialog targetType="comment" targetId={item.id} compact />}
          {canDelete && <button type="button" className="poem-action danger-action" onClick={() => remove(item.id)} disabled={busy} aria-label={t("poem.delete")} title={t("poem.delete")}><Trash2 size={14} /></button>}
        </div>;
      }) : <p className="muted-line">{t("poem.noComments")}</p>}
    </div>
    {user
      ? <form className="comment-form" onSubmit={submit}><input value={text} onChange={event => setText(event.target.value)} maxLength={1000} placeholder={t("poem.commentPlaceholder")} aria-label={t("poem.commentPlaceholder")} /><Button type="submit" size="icon" variant="ghost" disabled={!text.trim() || busy} aria-label={t("poem.send")}><Send size={16} /></Button></form>
      : <p className="muted-line"><Link href={loginHref}>{t("poem.commentLogin")}</Link></p>}
  </section>;
}
