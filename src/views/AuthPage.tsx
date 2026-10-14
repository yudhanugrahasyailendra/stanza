"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocation } from "@/lib/navigation";
import { Feather, LockKeyhole, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";

function safeReturnTo(raw: string | null) {
  const candidate = raw || "/explore";
  return candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\") ? candidate : "/explore";
}

export default function AuthPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const callbackFailed = searchParams.get("error") === "callback";
  useEffect(() => { if (callbackFailed) toast.error(t("auth.callbackError")); }, [callbackFailed, t]);
  const authError = (error: { code?: string; status?: number }) => {
    switch (error.code) {
      case "invalid_credentials": return t("auth.error");
      case "email_not_confirmed": return t("auth.notConfirmed");
      case "user_already_exists": case "email_exists": return t("auth.emailConflict");
      case "weak_password": return t("auth.passwordHint");
      case "over_email_send_rate_limit": return t("auth.emailRateLimited");
      case "over_request_rate_limit": return t("auth.rateLimited");
      default: return error.status === 429 ? t("auth.rateLimited") : t("common.error");
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      if (registering) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { pen_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}` },
        });
        if (error) return void toast.error(authError(error));
        // Supabase hides whether an email is registered: an existing address comes back as a
        // user without identities, and no confirmation email is sent.
        if (data.user && data.user.identities?.length === 0) return void toast.error(t("auth.emailConflict"));
        if (!data.session) return void toast.success(t("auth.checkEmail"));
        toast.success(t("auth.registered"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return void toast.error(authError(error));
        toast.success(t("auth.success"));
      }
      setLocation(returnTo);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setPending(false);
    }
  };
  return <div className="auth-page">
    <div className="auth-brand"><span className="brand-mark" aria-hidden="true"><span /><span /><i /></span><span>stanza</span></div>
    <header className="auth-heading"><span className="eyebrow"><Feather size={13} /> STANZA</span><h1>{t("auth.title")}<em>.</em></h1><p>{t("auth.subtitle")}</p></header>
    <section className="auth-card">
      <div className="auth-switch"><button className={!registering ? "auth-tab-active" : ""} onClick={() => setRegistering(false)}>{t("auth.login")}</button><button className={registering ? "auth-tab-active" : ""} onClick={() => setRegistering(true)}>{t("auth.register")}</button></div>
      <form className="auth-form" onSubmit={submit}>
        {registering && <label><span><UserRound size={14} /> {t("auth.name")}</span><Input value={name} onChange={event => setName(event.target.value)} required minLength={1} maxLength={40} autoComplete="nickname" /></label>}
        <label><span><Mail size={14} /> {t("auth.email")}</span><Input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} autoComplete="email" /></label>
        <label><span><LockKeyhole size={14} /> {t("auth.password")}</span><Input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={registering ? 10 : 1} maxLength={128} autoComplete={registering ? "new-password" : "current-password"} />{registering && <small>{t("auth.passwordHint")}</small>}</label>
        <Button className="olive-button auth-submit" type="submit" disabled={pending}>{registering ? t("auth.submitRegister") : t("auth.submitLogin")}</Button>
      </form>
      <button className="auth-toggle" onClick={() => setRegistering(value => !value)}>{registering ? t("auth.switchLogin") : t("auth.switchRegister")}</button>
    </section>
    <Link href="/explore" className="auth-back">{t("auth.back")}</Link>
  </div>;
}
