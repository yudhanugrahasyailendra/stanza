"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { reportContent } from "@/app/report/actions";

export default function ReportDialog({ targetType, targetId, compact = false }: { targetType: "poem" | "comment"; targetId: string; compact?: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await reportContent({ targetType, targetId, reason });
      if (!result.ok) {
        toast.error(result.error);
        if (result.code === "unauthenticated") router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      toast.success(t("report.success"));
      setOpen(false);
      setReason("");
    } catch { toast.error(t("common.error")); } finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" className="poem-action" aria-label={t("report.button")} title={t("report.button")}><Flag size={compact ? 13 : 15} />{!compact && <> {t("report.button")}</>}</button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>{t(targetType === "poem" ? "report.titlePoem" : "report.titleComment")}</DialogTitle><DialogDescription>{t("report.desc")}</DialogDescription></DialogHeader>
      <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={4} placeholder={t("report.placeholder")} aria-label={t("report.placeholder")} style={{ width: "100%", padding: 10, border: "1px solid var(--line)", borderRadius: 4, background: "transparent", color: "inherit" }} />
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("poem.cancel")}</Button><Button onClick={submit} disabled={busy || !reason.trim()}>{t("report.submit")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
