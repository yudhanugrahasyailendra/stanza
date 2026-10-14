"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Feather } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseUser } from "@/lib/supabase/useSupabaseUser";
import { deletePoem } from "@/app/write/actions";
import { Button } from "@/components/ui/button";

type Row = { id: string; title: string; status: string; updated_at: string };

export default function MyPoems() {
  const { t, language } = useLanguage();
  const { user } = useSupabaseUser();
  const userId = user?.id;
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await createClient().from("poems").select("id,title,status,updated_at").eq("author_id", userId).order("updated_at", { ascending: false });
    setRows(data ?? []);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    if (!window.confirm(t("write.deleteConfirm"))) return;
    try {
      const result = await deletePoem(id);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(t("write.deleted"));
      await load();
    } catch { toast.error(t("common.error")); }
  };

  const date = (value: string) => new Date(value).toLocaleDateString(language === "en" ? "en-US" : "id-ID", { dateStyle: "medium" });

  return <div className="write-page">
    <header className="write-heading"><div><div className="eyebrow"><Feather size={13} /> {t("write.myPoems").toUpperCase()}</div><h1>{t("write.myPoems")}</h1></div><Link href="/write" className="write-cta"><Feather size={15} /> {t("nav.compose")}</Link></header>
    {rows === null ? <p>{t("common.loading")}</p> : rows.length === 0 ? <p>{t("write.myPoemsEmpty")}</p> : <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {rows.map(row => <li key={row.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
        <div><strong>{row.title}</strong><div style={{ fontSize: 13, color: "#96948a" }}>{row.status === "published" ? t("write.published") : t("write.draft")} · {date(row.updated_at)}</div></div>
        <div style={{ display: "flex", gap: 8 }}><Button asChild variant="outline"><Link href={`/write?edit=${row.id}&returnTo=/write/mine`}>{t("write.edit")}</Link></Button><Button variant="outline" onClick={() => remove(row.id)}>{t("write.delete")}</Button></div>
      </li>)}
    </ul>}
    <div className="write-back"><Link href="/write">{t("write.back")}</Link></div>
  </div>;
}
