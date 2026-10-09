"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export default function Loading() {
  const { t } = useLanguage();
  return <div className="loading-note">{t("common.loading")}</div>;
}
