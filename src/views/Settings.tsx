"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocation } from "@/lib/navigation";
import { ArrowLeft, Check, Globe2, LogOut, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Settings() {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const account = trpc.auth.accountSettings.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState("");
  const [nextLanguage, setNextLanguage] = useState<Language>(language);
  const [nextTheme, setNextTheme] = useState<Theme>(theme);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNext, setPasswordNext] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const hasLocalPassword = Boolean(account.data?.hasLocalPassword);
  const confirmationWord = language === "en" ? "DELETE" : "HAPUS";
  const accountError = (code?: string) => code === "CONFLICT" ? t("settings.conflict") : code === "UNAUTHORIZED" ? t("settings.verifyPassword") : code === "FORBIDDEN" ? t("settings.addPasswordFirst") : code === "BAD_REQUEST" ? t("settings.invalidDate") : t("common.error");
  const passwordSetupError = (code?: string) => code === "CONFLICT" ? t("settings.emailConflict") : t("common.error");

  useEffect(() => {
    if (!account.data) return;
    setName(account.data.name);
    setUsername(account.data.username);
    setEmail(account.data.email);
    setAvatarUrl(account.data.avatarUrl);
    setBirthDate(account.data.birthDate);
    setNextLanguage(account.data.language);
    setNextTheme(account.data.theme);
    setSetupEmail(account.data.email);
  }, [account.data]);

  const updateAccount = trpc.auth.updateAccount.useMutation({
    onSuccess: async () => { await Promise.all([utils.auth.accountSettings.invalidate(), utils.profile.me.invalidate(), utils.profile.public.invalidate()]); setCurrentPasswordForEmail(""); toast.success(t("settings.saved")); },
    onError: error => toast.error(accountError(error.data?.code)),
  });
  const updatePreferences = trpc.auth.updatePreferences.useMutation({
    onSuccess: async () => { setLanguage(nextLanguage); setTheme(nextTheme); await utils.auth.accountSettings.invalidate(); toast.success(t("settings.saved")); },
    onError: () => toast.error(t("common.error")),
  });
  const setPassword = trpc.auth.setPassword.useMutation({
    onSuccess: async () => { setSetupPassword(""); setSetupConfirm(""); await Promise.all([utils.auth.accountSettings.invalidate(), utils.auth.me.invalidate()]); toast.success(t("settings.saved")); },
    onError: error => toast.error(passwordSetupError(error.data?.code)),
  });
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: async () => { setPasswordCurrent(""); setPasswordNext(""); setPasswordConfirm(""); await utils.auth.me.invalidate(); toast.success(t("settings.saved")); },
    onError: error => toast.error(accountError(error.data?.code)),
  });
  const deleteAccount = trpc.auth.deleteAccount.useMutation({
    onSuccess: async () => { try { sessionStorage.removeItem("manus-cookie"); } catch {} await utils.auth.me.setData(undefined, null); setDeleteOpen(false); toast.success(t("settings.saved")); setLocation("/explore"); },
    onError: error => toast.error(accountError(error.data?.code)),
  });

  const saveAccount = (event: FormEvent) => {
    event.preventDefault();
    updateAccount.mutate({ name, username, email, avatarUrl, birthDate: birthDate || null, currentPassword: currentPasswordForEmail || undefined });
  };
  const savePreferences = (event: FormEvent) => {
    event.preventDefault();
    updatePreferences.mutate({ language: nextLanguage, theme: nextTheme });
  };
  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (passwordNext !== passwordConfirm) { toast.error(language === "en" ? "The new passwords do not match." : "Kata sandi baru belum cocok."); return; }
    changePassword.mutate({ currentPassword: passwordCurrent, newPassword: passwordNext });
  };
  const submitSetup = (event: FormEvent) => {
    event.preventDefault();
    if (setupPassword !== setupConfirm) { toast.error(language === "en" ? "The new passwords do not match." : "Kata sandi baru belum cocok."); return; }
    setPassword.mutate({ email: setupEmail, password: setupPassword });
  };
  const signOut = async () => {
    try { await logout(); setLocation("/explore"); }
    catch { toast.error(t("common.error")); }
  };

  if (!isAuthenticated || !user) return <section className="settings-logged-out"><ShieldCheck size={28} /><h1>{t("settings.mustLogin")}</h1><Button asChild className="olive-button"><Link href="/login">{t("settings.login")}</Link></Button></section>;
  if (account.isLoading) return <div className="profile-loading">{t("common.loading")}</div>;
  if (!account.data) return <div className="profile-loading">{t("common.error")}</div>;

  return <div className="settings-page">
    <div className="settings-topline"><Link href={`/profile/${account.data.username || "me"}`}><ArrowLeft size={15} /> {t("settings.back")}</Link><span className="eyebrow"><ShieldCheck size={13} /> STANZA</span></div>
    <header className="settings-heading"><span className="eyebrow"><UserRound size={13} /> {t("settings.title").toUpperCase()}</span><h1>{t("settings.title")}<em>.</em></h1><p>{language === "en" ? "Update your account details and app preferences." : "Atur informasi akun dan tampilan aplikasi."}</p></header>

    <section className="settings-card"><div className="settings-card-title"><div className="settings-icon"><UserRound size={17} /></div><div><h2>{t("settings.account")}</h2><p>{language === "en" ? "Only you can see your date of birth and sign-in email." : "Tanggal lahir dan email masuk hanya terlihat olehmu."}</p></div></div>
      <form className="settings-form" onSubmit={saveAccount}>
        <div className="settings-field-grid">
          <label>{t("settings.name")}<Input value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
          <label>{t("settings.username")}<div className="settings-username"><span>@</span><Input value={username} onChange={event => setUsername(event.target.value.toLowerCase())} required minLength={3} maxLength={48} pattern="[a-z0-9][a-z0-9_-]{2,47}" /></div><small>{language === "en" ? "3 to 48 characters, using letters, numbers, underscores, or hyphens." : "3 sampai 48 karakter, berupa huruf, angka, garis bawah, atau tanda hubung."}</small></label>
          <label>{t("settings.email")}<Input type="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={!hasLocalPassword} /><small>{hasLocalPassword && email !== account.data.email ? (language === "en" ? "Enter your current password to confirm this change." : "Masukkan kata sandi saat ini untuk mengonfirmasi perubahan.") : t("settings.emailNote")}</small></label>
          <label>{t("settings.birthDate")}<Input type="date" value={birthDate} max={new Date().toISOString().slice(0, 10)} onChange={event => setBirthDate(event.target.value)} /></label>
          <label className="settings-field-full">{t("settings.avatar")}<Input type="url" value={avatarUrl} onChange={event => setAvatarUrl(event.target.value)} placeholder="https://…" maxLength={2000} /></label>
          {hasLocalPassword && email !== account.data.email && <label className="settings-field-full">{t("settings.currentPassword")}<Input type="password" value={currentPasswordForEmail} onChange={event => setCurrentPasswordForEmail(event.target.value)} autoComplete="current-password" /></label>}
        </div>
        {!hasLocalPassword && <p className="settings-inline-note">{language === "en" ? "This address comes from your previous sign-in provider. Add a Stanza password below to change your Stanza sign-in email." : "Alamat ini berasal dari penyedia login sebelumnya. Buat kata sandi Stanza di bawah untuk mengubah email masuk Stanza."}</p>}
        <Button type="submit" className="olive-button" disabled={updateAccount.isPending}><Check size={15} /> {t("settings.saveAccount")}</Button>
      </form>
    </section>

    <section className="settings-card"><div className="settings-card-title"><div className="settings-icon"><Globe2 size={17} /></div><div><h2>{t("settings.preferences")}</h2><p>{language === "en" ? "Choose the language and appearance for this device." : "Pilih bahasa dan tampilan untuk perangkat ini."}</p></div></div>
      <form className="settings-preferences" onSubmit={savePreferences}>
        <label>{t("settings.language")}<select value={nextLanguage} onChange={event => setNextLanguage(event.target.value as Language)}><option value="id">{t("settings.indonesian")}</option><option value="en">{t("settings.english")}</option></select></label>
        <label>{t("settings.theme")}<select value={nextTheme} onChange={event => setNextTheme(event.target.value as Theme)}><option value="light">{t("settings.themeLight")}</option><option value="dark">{t("settings.themeDark")}</option><option value="system">{t("settings.themeSystem")}</option></select></label>
        <Button className="olive-button" type="submit" disabled={updatePreferences.isPending}>{t("settings.savePreferences")}</Button>
      </form>
    </section>

    <section className="settings-card"><div className="settings-card-title"><div className="settings-icon"><ShieldCheck size={17} /></div><div><h2>{t("settings.security")}</h2><p>{language === "en" ? "Use a long, unique password that you do not use elsewhere." : "Gunakan kata sandi panjang dan unik yang tidak dipakai di tempat lain."}</p></div></div>
      {hasLocalPassword ? <form className="settings-form settings-password-form" onSubmit={submitPassword}>
        <label>{t("settings.currentPassword")}<Input type="password" value={passwordCurrent} onChange={event => setPasswordCurrent(event.target.value)} required autoComplete="current-password" /></label>
        <div className="settings-field-grid"><label>{t("settings.newPassword")}<Input type="password" value={passwordNext} onChange={event => setPasswordNext(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" /></label><label>{t("settings.confirmPassword")}<Input type="password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" /></label></div>
        <Button variant="outline" type="submit" disabled={changePassword.isPending}>{t("settings.changePassword")}</Button>
      </form> : <form className="settings-form settings-password-form" onSubmit={submitSetup}>
        <p className="settings-inline-note">{t("settings.passwordSetupNote")}</p>
        <div className="settings-field-grid"><label>{t("settings.email")}<Input type="email" value={setupEmail} onChange={event => setSetupEmail(event.target.value)} required /></label><label>{t("settings.newPassword")}<Input type="password" value={setupPassword} onChange={event => setSetupPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" /></label><label>{t("settings.confirmPassword")}<Input type="password" value={setupConfirm} onChange={event => setSetupConfirm(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" /></label></div>
        <Button variant="outline" type="submit" disabled={setPassword.isPending}>{t("settings.setupPassword")}</Button>
      </form>}
    </section>

    <section className="settings-card settings-session-card"><div><h2>{t("settings.logout")}</h2><p>{language === "en" ? "Sign out of this device." : "Keluar dari akun pada perangkat ini."}</p></div><Button variant="outline" onClick={signOut}><LogOut size={15} /> {t("settings.logout")}</Button></section>

    <section className="settings-danger-zone"><div><h2>{t("settings.delete")}</h2><p>{t("settings.deleteBody")}</p></div><Dialog open={deleteOpen} onOpenChange={open => { setDeleteOpen(open); if (!open) { setDeletePhrase(""); setDeletePassword(""); } }}><DialogTrigger asChild><Button variant="outline" className="settings-danger-button"><Trash2 size={15} /> {t("settings.delete")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{t("settings.deleteTitle")}</DialogTitle><DialogDescription>{t("settings.deleteBody")}</DialogDescription></DialogHeader><div className="settings-delete-fields"><label>{t("settings.typeDelete")}<Input value={deletePhrase} onChange={event => setDeletePhrase(event.target.value)} autoComplete="off" /></label>{hasLocalPassword && <label>{t("settings.currentPassword")}<Input type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} autoComplete="current-password" /></label>}</div><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>{t("settings.cancel")}</Button><Button variant="destructive" onClick={() => deleteAccount.mutate({ confirmation: confirmationWord, currentPassword: deletePassword || undefined })} disabled={deletePhrase !== confirmationWord || (hasLocalPassword && !deletePassword) || deleteAccount.isPending}>{t("settings.confirmDelete")}</Button></DialogFooter></DialogContent></Dialog></section>

    <div className="settings-bottom-links"><Link href={`/profile/${account.data.username || "me"}`}>{t("settings.back")}</Link>{user && <span>@{account.data.username}</span>}</div>
  </div>;
}
