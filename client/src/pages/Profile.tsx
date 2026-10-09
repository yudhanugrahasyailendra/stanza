import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { CalendarDays, Feather, MoreHorizontal, Pencil, Sprout, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import PoemCard from "@/components/PoemCard";

function Initials({ name }: { name: string }) {
  return <span>{name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "S"}</span>;
}

function EditProfile({ bio, onSaved }: { bio: string; onSaved: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [nextBio, setNextBio] = useState(bio);
  useEffect(() => { setNextBio(bio); }, [bio]);
  const update = trpc.profile.update.useMutation({ onSuccess: () => { toast.success(t("settings.saved")); setOpen(false); onSaved(); }, onError: () => toast.error(t("common.error")) });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" className="edit-profile-button"><Pencil size={14} /> {t("profile.edit")}</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>{t("profile.story")}</DialogTitle><DialogDescription>{t("profile.about")}</DialogDescription></DialogHeader>
      <label className="profile-field">{t("profile.bio")}<Textarea value={nextBio} onChange={event => setNextBio(event.target.value)} maxLength={240} placeholder={t("profile.bioPlaceholder")} rows={4} /><small>{nextBio.length}/240</small></label>
      <DialogFooter><Button className="olive-button" onClick={() => update.mutate({ bio: nextBio })} disabled={update.isPending}>{t("profile.save")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export default function Profile() {
  const [, params] = useRoute("/profile/:username");
  const requested = params?.username || "";
  const focusedPoemId = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("poem") || "";
  const validFocusedPoemId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(focusedPoemId) ? focusedPoemId : "";
  const { user, isAuthenticated } = useAuth();
  const { language, t } = useLanguage();
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const isOwn = Boolean(user && (me.data?.username === requested || requested === "me"));
  const publicProfile = trpc.profile.public.useQuery({ username: requested === "me" ? (me.data?.username || "me") : requested }, { enabled: Boolean(requested && requested !== "me") || Boolean(isOwn && me.data?.username), retry: false });
  const focusedPoem = trpc.poems.byId.useQuery({ id: focusedPoemId }, { enabled: Boolean(validFocusedPoemId), retry: false });
  const profileData = isOwn ? me.data : publicProfile.data;
  const portfolioPoems = isOwn ? me.data?.poems : publicProfile.data?.poems;
  const poems = useMemo(() => {
    const target = focusedPoem.data;
    if (!target || target.authorId !== profileData?.id) return portfolioPoems;
    const current = portfolioPoems || [];
    return current.some(poem => poem.id === target.id) ? current : [target, ...current];
  }, [focusedPoem.data, portfolioPoems, profileData?.id]);
  const name = profileData?.name || (isOwn ? user?.name : null) || t("profile.writer");
  const username = profileData?.username || requested;
  const loading = isOwn ? me.isLoading : publicProfile.isLoading;
  const joined = profileData?.createdAt ? new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", { month: "long", year: "numeric" }).format(new Date(profileData.createdAt)) : "";
  const followAction = trpc.profile.follow.useMutation({
    onSuccess: async () => { await Promise.all([utils.profile.public.invalidate(), utils.profile.me.invalidate()]); },
    onError: () => toast.error(language === "en" ? "Could not update your following list. Please try again." : "Status mengikuti belum berubah. Coba lagi."),
  });
  const focusedScroll = useRef("");
  useEffect(() => {
    if (!validFocusedPoemId || !focusedPoem.data || focusedPoem.data.authorId !== profileData?.id || focusedScroll.current === validFocusedPoemId) return;
    focusedScroll.current = validFocusedPoemId;
    const timer = window.setTimeout(() => document.getElementById(`poem-${validFocusedPoemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    return () => window.clearTimeout(timer);
  }, [validFocusedPoemId, focusedPoem.data, profileData?.id]);
  if (loading) return <div className="profile-loading">{t("common.loading")}</div>;
  if (!profileData && !isOwn) return <section className="not-found-profile"><Sprout size={30} /><h1>{t("profile.notFound")}</h1><p>{t("profile.notFoundBody")}</p><Button asChild className="olive-button"><Link href="/explore">{t("nav.explore")}</Link></Button></section>;
  const followLabel = language === "en" ? (profileData?.isFollowing ? "Following" : "Follow") : (profileData?.isFollowing ? "Mengikuti" : "Ikuti");

  return <div className="profile-page">
    <div className="profile-breadcrumb"><Link href="/explore">{t("nav.explore")}</Link><span>/</span><span>{t("profile.breadcrumb")}</span></div>
    <section className="profile-hero">
      <div className="profile-avatar">{profileData?.avatarUrl ? <img src={profileData.avatarUrl} alt={`${t("settings.avatar")} ${name}`} /> : <Initials name={name} />}</div>
      <div className="profile-details">
        <span className="eyebrow"><Sprout size={13} /> {t("profile.kicker")}</span>
        <h1>{name}</h1>
        <p className="profile-handle">@{username}</p>
        <p className="profile-bio">{profileData?.bio || (isOwn ? t("profile.bioOwn") : t("profile.bioOther"))}</p>
        <div className="profile-meta">
          {joined && <span><CalendarDays size={14} /> {t("profile.joined")} {joined}</span>}
          {poems && <span><Feather size={14} /> {poems.length} {t("profile.poems")}</span>}
          {profileData && <span className="profile-connection-count"><Users size={13} /><strong>{profileData.followersCount}</strong> {language === "en" ? "followers" : "pengikut"}</span>}
          {profileData && <span className="profile-connection-count"><UserPlus size={13} /><strong>{profileData.followingCount}</strong> {language === "en" ? "following" : "mengikuti"}</span>}
        </div>
      </div>
      {isOwn && profileData && <div className="profile-owner-actions">
        <EditProfile bio={profileData.bio || ""} onSaved={() => { void me.refetch(); void publicProfile.refetch(); }} />
        <Button asChild variant="outline" className="profile-settings-button"><Link href="/settings" aria-label={t("nav.settings")} title={t("nav.settings")}><MoreHorizontal size={17} /><span>{t("nav.settings")}</span></Link></Button>
      </div>}
      {!isOwn && profileData && <div className="profile-owner-actions profile-follow-actions">
        {user ? <Button className={`profile-follow-button ${profileData.isFollowing ? "is-following" : ""}`} variant={profileData.isFollowing ? "outline" : "default"} onClick={() => followAction.mutate({ username, following: !profileData.isFollowing })} disabled={followAction.isPending}><UserPlus size={14} />{followLabel}</Button>
          : <Button asChild className="profile-follow-button"><Link href="/login"><UserPlus size={14} />{followLabel}</Link></Button>}
      </div>}
    </section>
    <section className="profile-works">
      <div className="feed-heading"><div><span className="section-kicker">{t("profile.works")}</span><h2>{t("profile.shared")}</h2></div><span className="feed-note">{t("profile.owned")} @{username}</span></div>
      {poems?.length ? <div className="poem-list">{poems.map(poem => <PoemCard key={poem.id} poem={poem} />)}</div> : <div className="empty-feed compact-empty"><div className="empty-seed"><Feather size={20} /></div><h3>{t("profile.emptyTitle")}</h3><p>{isOwn ? t("profile.emptyOwn") : t("profile.emptyOther")}</p>{isOwn && <Button asChild className="olive-button"><Link href="/write">{t("profile.write")} <Feather size={15} /></Link></Button>}</div>}
    </section>
  </div>;
}
