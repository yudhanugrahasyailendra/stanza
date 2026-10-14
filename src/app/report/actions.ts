"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/write/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASON_MAX = 500;

// reporter_id always comes from the verified session. Reports are only readable from the dashboard.
export async function reportContent(input: { targetType: "poem" | "comment"; targetId: string; reason: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Masuk dulu untuk melaporkan konten.", code: "unauthenticated" };
  const reason = input.reason.trim();
  if (input.targetType !== "poem" && input.targetType !== "comment") return { ok: false, error: "Jenis laporan tidak valid." };
  if (!UUID.test(input.targetId)) return { ok: false, error: "Konten tidak ditemukan." };
  if (!reason) return { ok: false, error: "Tulis alasan laporan terlebih dahulu." };
  if (reason.length > REASON_MAX) return { ok: false, error: `Alasan terlalu panjang (maksimal ${REASON_MAX} karakter).` };

  // The target must be visible to the reporter (RLS), so reports cannot point at hidden drafts.
  const table = input.targetType === "poem" ? "poems" : "comments";
  const { data: target } = await supabase.from(table).select("id").eq("id", input.targetId).maybeSingle();
  if (!target) return { ok: false, error: "Konten tidak ditemukan." };

  const { error } = await supabase.from("reports").insert({ reporter_id: auth.user.id, target_type: input.targetType, target_id: input.targetId, reason });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Kamu sudah melaporkan konten ini." };
    if (error.code === "RL001") return { ok: false, error: error.message };
    return { ok: false, error: "Laporan belum terkirim. Coba lagi." };
  }
  return { ok: true, data: undefined };
}
