import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Feather, LockKeyhole, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";

function safeReturnTo() {
  const candidate = new URLSearchParams(window.location.search).get("returnTo") || "/explore";
  return candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\") ? candidate : "/explore";
}

export default function AuthPage() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const returnTo = safeReturnTo();
  const completeLogin = async (message: string) => {
    await utils.auth.me.invalidate();
    toast.success(message);
    setLocation(returnTo);
  };
  const authError = (code?: string) => code === "UNAUTHORIZED" ? t("auth.error") : code === "CONFLICT" ? t("auth.emailConflict") : code === "TOO_MANY_REQUESTS" ? t("auth.rateLimited") : t("common.error");
  const login = trpc.auth.login.useMutation({ onSuccess: () => void completeLogin(t("auth.success")), onError: error => toast.error(authError(error.data?.code)) });
  const register = trpc.auth.register.useMutation({ onSuccess: () => void completeLogin(t("auth.registered")), onError: error => toast.error(authError(error.data?.code)) });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (registering) register.mutate({ name, email, password });
    else login.mutate({ email, password });
  };
  const pending = login.isPending || register.isPending;
  return <div className="auth-page">
    <div className="auth-brand"><span className="brand-mark" aria-hidden="true"><span /><span /><i /></span><span>stanza</span></div>
    <header className="auth-heading"><span className="eyebrow"><Feather size={13} /> STANZA</span><h1>{t("auth.title")}<em>.</em></h1><p>{t("auth.subtitle")}</p></header>
    <section className="auth-card">
      <div className="auth-switch"><button className={!registering ? "auth-tab-active" : ""} onClick={() => setRegistering(false)}>{t("auth.login")}</button><button className={registering ? "auth-tab-active" : ""} onClick={() => setRegistering(true)}>{t("auth.register")}</button></div>
      <form className="auth-form" onSubmit={submit}>
        {registering && <label><span><UserRound size={14} /> {t("auth.name")}</span><Input value={name} onChange={event => setName(event.target.value)} required minLength={1} maxLength={100} autoComplete="name" /></label>}
        <label><span><Mail size={14} /> {t("auth.email")}</span><Input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} autoComplete="email" /></label>
        <label><span><LockKeyhole size={14} /> {t("auth.password")}</span><Input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={registering ? 10 : 1} maxLength={128} autoComplete={registering ? "new-password" : "current-password"} />{registering && <small>{t("auth.passwordHint")}</small>}</label>
        <Button className="olive-button auth-submit" type="submit" disabled={pending}>{registering ? t("auth.submitRegister") : t("auth.submitLogin")}</Button>
      </form>
      <button className="auth-toggle" onClick={() => setRegistering(value => !value)}>{registering ? t("auth.switchLogin") : t("auth.switchRegister")}</button>
      <div className="auth-divider"><span>{language === "en" ? "or" : "atau"}</span></div>
      <Button variant="outline" className="auth-oauth" onClick={() => startLogin()}>{t("auth.legacy")}</Button>
    </section>
    <Link href="/explore" className="auth-back">{t("auth.back")}</Link>
  </div>;
}
