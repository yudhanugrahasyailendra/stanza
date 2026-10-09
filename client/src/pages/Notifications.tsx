import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { Bell, Heart, MessageCircle, UserPlus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "S";
}

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const list = trpc.notifications.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const lastMarkedAt = useRef(0);
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.notifications.list.invalidate(), utils.notifications.unreadCount.invalidate()]);
    },
  });

  useEffect(() => {
    const hasUnread = list.data?.some(item => !item.readAt);
    if (hasUnread && list.dataUpdatedAt && lastMarkedAt.current !== list.dataUpdatedAt) {
      lastMarkedAt.current = list.dataUpdatedAt;
      markAllRead.mutate();
    }
  }, [list.data, list.dataUpdatedAt]);

  const isEnglish = language === "en";
  return <section className="notifications-page">
    <header className="notifications-heading">
      <span className="eyebrow"><Bell size={14} /> {isEnglish ? "ACTIVITY" : "AKTIVITAS"}</span>
      <h1>{isEnglish ? "Notifications" : "Notifikasi"}<em>.</em></h1>
      <p>{isEnglish ? "See who followed you, liked a poem, or left a comment." : "Lihat siapa yang mengikuti, menyukai puisimu, atau menulis komentar."}</p>
    </header>

    {!isAuthenticated ? <div className="notifications-empty"><Bell size={22} /><p>{isEnglish ? "Sign in to see your notifications." : "Masuk untuk melihat notifikasi."}</p><Button asChild className="olive-button"><Link href="/login">{isEnglish ? "Sign in" : "Masuk"}</Link></Button></div>
      : list.isLoading ? <p className="notifications-state">{isEnglish ? "Loading notifications…" : "Memuat notifikasi…"}</p>
        : !list.data?.length ? <div className="notifications-empty"><Bell size={22} /><h2>{isEnglish ? "No notifications yet." : "Belum ada notifikasi."}</h2><p>{isEnglish ? "Notifications about follows, likes, and comments will show up here." : "Notifikasi saat seseorang mengikuti, menyukai, atau mengomentari puisimu akan muncul di sini."}</p></div>
          : <div className="notification-list">{list.data.map(item => {
            const actor = item.actorName || (isEnglish ? "A writer" : "Seorang penulis");
            const poemTitle = item.poemTitle ? `“${item.poemTitle}”` : "";
            const activity = item.kind === "like"
              ? (isEnglish ? `liked your poem ${poemTitle}` : `menyukai puisimu ${poemTitle}`)
              : item.kind === "comment"
                ? (isEnglish ? `commented on your poem ${poemTitle}` : `mengomentari puisimu ${poemTitle}`)
                : (isEnglish ? "followed you" : "mulai mengikuti kamu");
            const date = new Intl.DateTimeFormat(isEnglish ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt));
            const target = item.kind === "follow"
              ? `/profile/${item.actorUsername || "me"}`
              : `${item.recipientUsername ? `/profile/${item.recipientUsername}` : "/profile/me"}${item.poemId ? `?poem=${encodeURIComponent(item.poemId)}` : ""}`;
            return <Link key={item.id} href={target} className={`notification-item ${item.readAt ? "" : "is-unread"}`}>
              <span className="notification-avatar">{item.actorAvatarUrl ? <img src={item.actorAvatarUrl} alt="" /> : initials(actor)}</span>
              <span className="notification-content"><span className="notification-message"><strong>{actor}</strong> {activity}</span>{item.kind === "comment" && item.commentBody && <span className="notification-comment">“{item.commentBody}”</span>}<time>{date}</time></span>
              <span className="notification-activity-icon">{item.kind === "like" ? <Heart size={15} /> : item.kind === "comment" ? <MessageCircle size={15} /> : <UserPlus size={15} />}</span>
              {!item.readAt && <span className="notification-unread-dot" aria-label={isEnglish ? "Unread" : "Belum dibaca"} />}
            </Link>;
          })}</div>}
  </section>;
}
