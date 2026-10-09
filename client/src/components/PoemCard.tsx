import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocation } from "@/lib/navigation";
import { Copy, Download, FileDown, Heart, MessageCircle, Pencil, Send, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { buildQuoteCard, downloadQuoteCard, printPoemAsPdf, type ExportPoem } from "@/lib/poemExport";

export type PoemCardItem = { id: string; authorId: number; title: string; content: string; publishedAt: Date | null; authorName: string | null; username: string | null; avatarUrl: string | null; likesCount: number; likedByMe: boolean };

function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "S"; }
function shortDate(value: Date | null, locale: string) { return value ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : locale === "en-US" ? "just now" : "baru saja"; }

function ShareDialog({ poem }: { poem: ExportPoem }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    let objectUrl = "";
    buildQuoteCard(poem).then(blob => { if (alive) { objectUrl = URL.createObjectURL(blob); setImage(objectUrl); } }).catch(() => toast.error(t("common.error")));
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); setImage(""); };
  }, [open, poem]);
  const copyImage = async () => {
    try {
      const blob = await buildQuoteCard(poem);
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Clipboard gambar tidak didukung.");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true); toast.success(t("poem.copySuccess"));
      window.setTimeout(() => setCopied(false), 1800);
    } catch { toast.error(t("poem.copyUnsupported")); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="ghost" size="sm" className="poem-action"><Share2 size={15} /> {t("poem.share")}</Button></DialogTrigger>
    <DialogContent className="share-dialog">
      <DialogHeader><DialogTitle>{t("poem.shareCardTitle")}</DialogTitle><DialogDescription>{t("poem.shareCardDesc")}</DialogDescription></DialogHeader>
      <div className="share-preview">{image ? <img src={image} alt={`${t("poem.quoteCard")} ${poem.title}`} /> : <span>{t("poem.preparing")}</span>}</div>
      <div className="share-actions"><Button variant="outline" onClick={() => printPoemAsPdf(poem)}><FileDown size={16} /> {t("poem.exportPdf")}</Button><Button variant="outline" onClick={copyImage}><Copy size={15} />{copied ? ` ${t("poem.copied")}` : ` ${t("poem.copyImage")}`}</Button><Button className="olive-button" onClick={() => downloadQuoteCard(poem)}><Download size={15} /> {t("poem.downloadPng")}</Button></div>
    </DialogContent>
  </Dialog>;
}

export default function PoemCard({ poem }: { poem: PoemCardItem }) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [location] = useLocation();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const commentsQuery = trpc.poems.comments.useQuery({ poemId: poem.id }, { enabled: commentsOpen, retry: false });
  const utils = trpc.useUtils();
  const like = trpc.poems.setLike.useMutation({ onSuccess: async () => { await Promise.all([utils.poems.feed.invalidate(), utils.profile.public.invalidate()]); }, onError: () => toast.error(t("auth.login")) });
  const removePoem = trpc.poems.remove.useMutation({ onSuccess: async () => { setDeleteOpen(false); await Promise.all([utils.poems.feed.invalidate(), utils.poems.mine.invalidate(), utils.profile.me.invalidate(), utils.profile.public.invalidate()]); toast.success(t("poem.deleted")); }, onError: () => toast.error(t("poem.deleteError")) });
  const comment = trpc.poems.comment.useMutation({ onSuccess: async () => { setCommentText(""); await utils.poems.comments.invalidate({ poemId: poem.id }); toast.success(t("poem.commentSuccess")); }, onError: () => toast.error(t("auth.login")) });
  const authorName = poem.authorName || t("profile.writer");
  const username = poem.username || "penulis";
  const isAuthor = user?.id === poem.authorId;
  const shareable: ExportPoem = { title: poem.title, content: poem.content, authorName, username };
  return <article id={`poem-${poem.id}`} className="poem-card">
    <div className="poem-author-row">
      <Link href={`/profile/${username}`} className="author-link"><span className="avatar">{poem.avatarUrl ? <img src={poem.avatarUrl} alt="" /> : initials(authorName)}</span><span><strong>{authorName}</strong><small>@{username}</small></span></Link>
      <time>{shortDate(poem.publishedAt, language === "en" ? "en-US" : "id-ID")}</time>
    </div>
    <div className="poem-copy"><h3>{poem.title}</h3><p>{poem.content}</p></div>
    <div className="poem-actions-row">
      <button className={`poem-action heart-action ${poem.likedByMe ? "is-liked" : ""}`} onClick={() => like.mutate({ poemId: poem.id, liked: !poem.likedByMe })} disabled={like.isPending} aria-label={t("poem.appreciate")}><Heart size={16} fill={poem.likedByMe ? "currentColor" : "none"} /> <span>{t("poem.appreciate")}</span>{poem.likesCount > 0 && <small>{poem.likesCount}</small>}</button>
      <button className="poem-action" onClick={() => setCommentsOpen(value => !value)}><MessageCircle size={16} /> {t("poem.responses")}</button>
      <ShareDialog poem={shareable} />
      {isAuthor && <>
        <Link className="poem-action owner-action" href={`/write?edit=${encodeURIComponent(poem.id)}&returnTo=${encodeURIComponent(location)}`}><Pencil size={15} /> {t("poem.edit")}</Link>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild><button className="poem-action owner-action danger-action" disabled={removePoem.isPending}><Trash2 size={15} /> {t("poem.delete")}</button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("poem.deleteTitle")}</DialogTitle><DialogDescription>{t("poem.deleteBody")}<br /><strong>“{poem.title}”</strong></DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>{t("poem.cancel")}</Button><Button variant="destructive" onClick={() => removePoem.mutate({ id: poem.id })} disabled={removePoem.isPending}>{t("poem.deleteConfirm")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </>}
    </div>
    {commentsOpen && <section className="comments-panel" aria-label={t("poem.comments")}>
      <div className="comments-heading"><span>{t("poem.comments")}</span><button onClick={() => setCommentsOpen(false)} aria-label={t("poem.closeComments")}>×</button></div>
      <div className="comment-list">{commentsQuery.isLoading ? <p className="muted-line">{t("poem.loadingComments")}</p> : commentsQuery.data?.length ? commentsQuery.data.map(item => <div className="comment-item" key={item.id}><span className="avatar avatar-tiny">{initials(item.authorName || "P")}</span><p><Link href={`/profile/${item.username || "penulis"}`}><strong>{item.authorName || t("profile.kicker")}</strong></Link><span>{item.body}</span></p></div>) : <p className="muted-line">{t("poem.noComments")}</p>}</div>
      <form className="comment-form" onSubmit={event => { event.preventDefault(); if (commentText.trim()) comment.mutate({ poemId: poem.id, body: commentText }); }}><input value={commentText} onChange={event => setCommentText(event.target.value)} maxLength={700} placeholder={user ? t("poem.commentPlaceholder") : t("poem.commentLogin")} /><Button type="submit" size="icon" variant="ghost" disabled={!commentText.trim() || comment.isPending} aria-label={t("poem.send")}><Send size={16} /></Button></form>
    </section>}
  </article>;
}
