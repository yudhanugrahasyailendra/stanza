"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/write/actions";

const BODY_MAX = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_LOGGED_IN = "Masuk dulu untuk berkomentar.";
const GENERIC = "Terjadi kendala. Coba lagi.";

// author_id always comes from the verified session; RLS additionally requires the poem to be published.
export async function addComment(input: { poemId: string; body: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: NOT_LOGGED_IN, code: "unauthenticated" };
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Tulis komentar terlebih dahulu." };
  if (body.length > BODY_MAX) return { ok: false, error: `Komentar terlalu panjang (maksimal ${BODY_MAX} karakter).` };
  if (!UUID.test(input.poemId)) return { ok: false, error: "Puisi tidak ditemukan." };
  const { error } = await supabase.from("comments").insert({ poem_id: input.poemId, author_id: auth.user.id, body });
  if (error) {
    // RL001 is raised by the comments_rate_limit trigger; its message is already user-facing.
    if (error.code === "RL001") return { ok: false, error: error.message };
    return { ok: false, error: error.code === "42501" || error.code === "23503" ? "Puisi tidak ditemukan atau belum terbit." : GENERIC };
  }
  return { ok: true, data: undefined };
}

// RLS allows deleting only your own comment or any comment on your own poem.
export async function deleteComment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: NOT_LOGGED_IN, code: "unauthenticated" };
  if (!UUID.test(id)) return { ok: false, error: "Komentar tidak ditemukan." };
  const { data, error } = await supabase.from("comments").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { ok: false, error: GENERIC };
  if (!data) return { ok: false, error: "Komentar tidak ditemukan atau bukan milikmu." };
  return { ok: true, data: undefined };
}
