import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Bell, BookOpen, Feather, LogIn, Settings2, Sprout } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

function BrandMark() { return <span className="brand-mark" aria-hidden="true"><span /><span /><i /></span>; }

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t, setLanguage, language } = useLanguage();
  const { setTheme } = useTheme();
  const profile = trpc.profile.me.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const account = trpc.auth.accountSettings.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const unread = trpc.notifications.unreadCount.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 8_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true, retry: false });
  const username = profile.data?.username ?? "";
  const unreadCount = unread.data ?? 0;
  const notificationLabel = language === "en" ? "Notifications" : "Notifikasi";
  const active = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  const links = useMemo(() => [
    { href: "/explore", label: t("nav.explore"), icon: BookOpen },
    { href: "/write", label: t("nav.write"), icon: Feather },
  ], [t]);
  useEffect(() => {
    if (account.data) { setLanguage(account.data.language); setTheme(account.data.theme); }
  }, [account.data, setLanguage, setTheme]);

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <Link href="/" className="brand" aria-label="Stanza, beranda"><BrandMark /><span>stanza</span></Link>
      <nav className="desktop-nav" aria-label={t("nav.explore")}>{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${active(href) ? "is-active" : ""}`}><Icon size={16} strokeWidth={1.7} />{label}</Link>)}</nav>
      <div className="top-actions">
        {user ? <><Link href={username ? `/profile/${username}` : "/profile/me"} className="user-chip" title={t("nav.profile")}><span className="avatar avatar-small">{profile.data?.avatarUrl ? <img src={profile.data.avatarUrl} alt="" /> : (user.name || "P").slice(0, 1).toUpperCase()}</span><span className="user-chip-name">{user.name?.split(" ")[0] || t("nav.profile")}</span></Link><Link href="/notifications" className={`notifications-shortcut ${active("/notifications") ? "is-active" : ""}`} aria-label={notificationLabel} title={notificationLabel}><Bell size={17} />{unreadCount > 0 && <span className="notification-count-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}</Link><Link href="/settings" className={`settings-shortcut ${active("/settings") ? "is-active" : ""}`} aria-label={t("nav.settings")} title={t("nav.settings")}><Settings2 size={17} /></Link></> : <Link href="/login" className="login-link"><LogIn size={16} />{t("nav.login")}</Link>}
        <Link href="/write" className="write-cta"><Feather size={15} /> {t("nav.compose")}</Link>
      </div>
    </div></header>
    <main className="page-shell">{children}</main>
    <footer className="site-footer"><span><BrandMark /> {t("footer.tagline")}</span><Link href="/feedback" className="footer-feedback-link">{language === "en" ? "Give feedback" : "Isi kuesioner"}</Link><span>{t("footer.signoff")}</span></footer>
    <nav className="mobile-nav" aria-label={t("nav.explore")}>
      <Link href="/explore" className={active("/explore") || location === "/" ? "mobile-nav-active" : ""}><BookOpen size={19} /><span>{t("nav.explore")}</span></Link>
      <Link href="/write" className={active("/write") ? "mobile-nav-active" : ""}><Feather size={19} /><span>{t("nav.write")}</span></Link>
      {user ? <><Link href="/notifications" className={`notification-nav-link ${active("/notifications") ? "mobile-nav-active" : ""}`} aria-label={notificationLabel}><Bell size={19} /><span>{notificationLabel}</span>{unreadCount > 0 && <span className="notification-count-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}</Link><Link href={username ? `/profile/${username}` : "/profile/me"} className={active("/profile") ? "mobile-nav-active" : ""}><Sprout size={19} /><span>{t("nav.profile")}</span></Link></> : <Link href="/login"><LogIn size={19} /><span>{t("nav.login")}</span></Link>}
    </nav>
  </div>;
}
