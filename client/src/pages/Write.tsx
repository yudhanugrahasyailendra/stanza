"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocation } from "@/lib/navigation";
import { AlignCenter, AlignLeft, AlignRight, Check, ChevronDown, Feather, FileText, Moon, Save, Sun, Type } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type Paper = "light" | "dark" | "sepia";
type DraftCache = { title: string; content: string; id?: string };
const LOCAL_DRAFT = "stanza-local-draft-v1";
function readDraft(): DraftCache { try { return JSON.parse(localStorage.getItem(LOCAL_DRAFT) || "{}"); } catch { return { title: "", content: "" }; } }
function safeReturnTo(raw: string | null) { const candidate = raw || "/explore"; return candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\") ? candidate : "/explore"; }

export default function Write() {
  const { user, isAuthenticated } = useAuth();
  const { language, t } = useLanguage();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const requestedEditId = searchParams.get("edit") || "";
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const profile = trpc.profile.me.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const drafts = trpc.poems.mine.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const [title, setTitle] = useState(() => readDraft().title || "");
  const [content, setContent] = useState(() => readDraft().content || "");
  const [draftId, setDraftId] = useState<string | undefined>(() => readDraft().id);
  const [isEditingPublished, setIsEditingPublished] = useState(false);
  const editLoaded = useRef(false);
  const [paper, setPaper] = useState<Paper>(() => (localStorage.getItem("stanza-paper") as Paper) || "light");
  const [serif, setSerif] = useState(true);
  const [alignment, setAlignment] = useState<"left" | "center" | "right">("left");
  const [lineHeight, setLineHeight] = useState(1.85);
  const [selectedDraft, setSelectedDraft] = useState("");
  const save = trpc.poems.saveDraft.useMutation({ onSuccess: async result => { setDraftId(result.id); await utils.poems.mine.invalidate(); toast.success(t("write.draftSuccess")); }, onError: () => toast.error(t("common.error")) });
  const publish = trpc.poems.publish.useMutation({ onSuccess: async () => { localStorage.removeItem(LOCAL_DRAFT); await Promise.all([utils.poems.mine.invalidate(), utils.poems.feed.invalidate()]); toast.success(t("write.publishedSuccess")); setLocation("/explore"); }, onError: () => toast.error(t("common.error")) });
  const updatePublished = trpc.poems.updatePublished.useMutation({ onSuccess: async () => { await Promise.all([utils.poems.mine.invalidate(), utils.poems.feed.invalidate(), utils.profile.me.invalidate(), utils.profile.public.invalidate()]); toast.success(t("write.updateSuccess")); setLocation(returnTo); }, onError: () => toast.error(t("write.updateError")) });
  useEffect(() => {
    if (!requestedEditId || editLoaded.current || !drafts.data) return;
    editLoaded.current = true;
    const target = drafts.data.find(item => item.id === requestedEditId && item.status === "published");
    if (!target) { toast.error(t("write.notFound")); setLocation(returnTo); return; }
    setDraftId(target.id); setTitle(target.title); setContent(target.content); setIsEditingPublished(true);
  }, [requestedEditId, drafts.data, returnTo, setLocation, t]);
  useEffect(() => { if (!isEditingPublished) localStorage.setItem(LOCAL_DRAFT, JSON.stringify({ title, content, id: draftId })); }, [title, content, draftId, isEditingPublished]);
  useEffect(() => { localStorage.setItem("stanza-paper", paper); }, [paper]);
  const counts = useMemo(() => ({ words: content.trim() ? content.trim().split(/\s+/u).length : 0, stanzas: content.trim() ? content.trim().split(/\n\s*\n/u).filter(stanza => stanza.trim()).length : 0, characters: content.length }), [content]);
  const author = profile.data?.username || user?.name || "";
  const savedDrafts = drafts.data?.filter(item => item.status === "draft") || [];
  const loadDraft = (id: string) => { const target = savedDrafts.find(item => item.id === id); if (target) { setDraftId(target.id); setTitle(target.title === "Tanpa judul" || target.title === "Untitled" ? "" : target.title); setContent(target.content); setSelectedDraft(id); } };
  const saveDraft = async () => {
    if (!isAuthenticated) { localStorage.setItem(LOCAL_DRAFT, JSON.stringify({ title, content })); toast.success(t("write.savedLocal")); return; }
    if (isEditingPublished && draftId) { if (!title.trim() || !content.trim()) { toast.error(t("write.needContent")); return; } await updatePublished.mutateAsync({ id: draftId, title: title.trim(), content }); return; }
    await save.mutateAsync({ id: draftId, title, content });
  };
  const publishPoem = () => {
    if (!isAuthenticated) { localStorage.setItem(LOCAL_DRAFT, JSON.stringify({ title, content })); toast(t("write.loginToShare")); setLocation(`/login?returnTo=${encodeURIComponent("/write")}`); return; }
    if (!title.trim() || !content.trim()) { toast.error(t("write.needContent")); return; }
    if (isEditingPublished && draftId) { updatePublished.mutate({ id: draftId, title: title.trim(), content }); return; }
    publish.mutate({ id: draftId, title: title.trim(), content });
  };
  const isSaving = save.isPending || updatePublished.isPending;
  return <div className="write-page">
    <header className="write-heading"><div><div className="eyebrow"><Feather size={13} /> {isEditingPublished ? t("write.revision") : t("write.room")}</div><h1>{isEditingPublished ? <>{t("write.headRevision")} <em>{t("write.word")}</em></> : <>{t("write.headQuiet")} <em>{t("write.quiet")}</em></>}</h1><p>{isEditingPublished ? t("write.descRevision") : t("write.descRoom")}</p></div></header>
    <div className="editor-controls" aria-label={t("write.controls")}>
      <div className="control-group paper-picker"><span className="control-label">{t("write.paper")}</span><button className={paper === "light" ? "control-selected" : ""} onClick={() => setPaper("light")} aria-label={t("write.light")}><Sun size={15} /> <span>{t("write.light")}</span></button><button className={paper === "sepia" ? "control-selected" : ""} onClick={() => setPaper("sepia")} aria-label={t("write.sepia")}><span className="sepia-dot" /><span>{t("write.sepia")}</span></button><button className={paper === "dark" ? "control-selected" : ""} onClick={() => setPaper("dark")} aria-label={t("write.dark")}><Moon size={15} /><span>{t("write.dark")}</span></button></div>
      <div className="control-group type-picker"><span className="control-label">{t("write.font")}</span><button className={serif ? "control-selected" : ""} onClick={() => setSerif(true)}><Type size={14} /> {t("write.serif")}</button><button className={!serif ? "control-selected" : ""} onClick={() => setSerif(false)}>{t("write.sans")}</button></div>
      <div className="control-group align-picker"><span className="control-label">{t("write.align")}</span><button className={alignment === "left" ? "control-selected" : ""} aria-label={language === "en" ? "Align left" : "Rata kiri"} onClick={() => setAlignment("left")}><AlignLeft size={15} /></button><button className={alignment === "center" ? "control-selected" : ""} aria-label={language === "en" ? "Align center" : "Rata tengah"} onClick={() => setAlignment("center")}><AlignCenter size={15} /></button><button className={alignment === "right" ? "control-selected" : ""} aria-label={language === "en" ? "Align right" : "Rata kanan"} onClick={() => setAlignment("right")}><AlignRight size={15} /></button></div>
      <label className="line-height-control"><span>{t("write.line")}</span><input type="range" min="1.4" max="2.4" step="0.05" value={lineHeight} onChange={event => setLineHeight(Number(event.target.value))} /><small>{lineHeight.toFixed(2)}</small></label>
    </div>
    <section className={`editor-paper paper-${paper}`}>
      <div className="paper-topline"><span>{isEditingPublished ? t("write.published") : t("write.draft")}</span>{!isEditingPublished && isAuthenticated && savedDrafts.length > 0 && <label className="draft-select"><FileText size={14} /><select value={selectedDraft} onChange={event => loadDraft(event.target.value)}><option value="">{t("write.openDraft")}</option>{savedDrafts.map(item => <option key={item.id} value={item.id}>{item.title || t("write.untitled")}</option>)}</select><ChevronDown size={13} /></label>}</div>
      <input className={`poem-title-input ${serif ? "font-serif" : "font-sans"}`} value={title} onChange={event => setTitle(event.target.value)} maxLength={180} placeholder={t("write.titlePlaceholder")} aria-label={t("write.titlePlaceholder")} />
      <textarea className={`poem-body-input ${serif ? "font-serif" : "font-sans"}`} value={content} onChange={event => setContent(event.target.value)} placeholder={t("write.bodyPlaceholder")} aria-label={t("write.bodyPlaceholder")} style={{ textAlign: alignment, lineHeight }} />
      <div className="paper-bottom"><span>{author ? `@${author}` : t("write.yourSpace")}</span>{!isEditingPublished && <span>{t("write.savedOnly")}</span>}</div>
    </section>
    <div className="editor-foot"><div className="writing-stats"><span><b>{counts.words}</b> {t("write.words")}</span><i /><span><b>{counts.stanzas}</b> {t("write.stanzas")}</span><i /><span><b>{counts.characters}</b> {t("write.characters")}</span></div><div className="editor-buttons">{!isEditingPublished && <Button variant="outline" className="save-button" onClick={saveDraft} disabled={isSaving}><Save size={15} /> {t("write.saveDraft")}</Button>}<Button className="olive-button" onClick={isEditingPublished ? saveDraft : publishPoem} disabled={isSaving || publish.isPending}>{isEditingPublished ? <Check size={15} /> : <Feather size={15} />}{isEditingPublished ? ` ${t("write.saveChanges")}` : ` ${t("write.share")}`}</Button></div></div>
    <div className="editor-note"><Check size={14} /> {isEditingPublished ? t("write.publishedNote") : isAuthenticated ? `${t("write.authorNote")} @${profile.data?.username || ""}` : <span>{t("write.savedLocal")} <button onClick={() => setLocation(`/login?returnTo=${encodeURIComponent("/write")}`)}>{t("write.signIn")}</button></span>}</div>
    <div className="write-back"><Link href={returnTo}>{t("write.back")}</Link></div>
  </div>;
}
