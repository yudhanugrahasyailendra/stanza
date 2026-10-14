"use server";

import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: "unauthenticated" };

const TITLE_MAX = 120;
const BODY_MAX = 10000;
const UNTITLED = "Tanpa judul";
const NOT_LOGGED_IN = "Masuk dulu untuk menulis puisi.";
const NOT_FOUND = "Puisi tidak ditemukan di akunmu.";
const GENERIC = "Terjadi kendala. Coba lagi.";

type PoemInput = { id?: string; title: string; content: string };

// author_id always comes from the verified session, never from the form.
async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

type Validated = { error: string; title?: undefined; body?: undefined } | { error?: undefined; title: string; body: string };

function validate(input: { title: string; content: string }, { allowUntitled }: { allowUntitled: boolean }): Validated {
  const title = input.title.trim() || (allowUntitled ? UNTITLED : "");
  const body = input.content;
  if (!title || !body.trim()) return { error: "Isi judul dan puisi terlebih dahulu." };
  if (title.length > TITLE_MAX) return { error: `Judul terlalu panjang (maksimal ${TITLE_MAX} karakter).` };
  if (body.length > BODY_MAX) return { error: `Puisi terlalu panjang (maksimal ${BODY_MAX} karakter).` };
  return { title, body };
}

function isUuid(value: string) {
  return (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(value);
}

async function write(input: PoemInput, status: "draft" | "published"): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN, code: "unauthenticated" };
  const valid = validate(input, { allowUntitled: status === "draft" });
  if (valid.error !== undefined) return { ok: false, error: valid.error };
  const fields = { title: valid.title, body: valid.body, status, ...(status === "draft" ? { published_at: null } : {}) };

  const { id } = input;
  if (id !== undefined) {
    if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
    const { data, error } = await supabase.from("poems").update(fields).eq("id", id).eq("author_id", user.id).select("id").maybeSingle();
    if (error) return { ok: false, error: GENERIC };
    if (!data) return { ok: false, error: NOT_FOUND };
    return { ok: true, data: { id: data.id } };
  }
  const { data, error } = await supabase.from("poems").insert({ ...fields, author_id: user.id }).select("id").single();
  // RL001 is raised by the poems_rate_limit trigger; its message is already user-facing.
  if (error) return { ok: false, error: error.code === "RL001" ? error.message : GENERIC };
  return { ok: true, data: { id: data.id } };
}

export async function saveDraftPoem(input: PoemInput) {
  return write(input, "draft");
}

export async function publishPoem(input: PoemInput) {
  return write(input, "published");
}

// Edits an already published poem; keeps its original published_at.
export async function updatePublishedPoem(input: { id: string; title: string; content: string }): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN, code: "unauthenticated" };
  const valid = validate(input, { allowUntitled: false });
  if (valid.error !== undefined) return { ok: false, error: valid.error };
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };
  const { data, error } = await supabase
    .from("poems")
    .update({ title: valid.title, body: valid.body })
    .eq("id", input.id)
    .eq("author_id", user.id)
    .eq("status", "published")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: GENERIC };
  if (!data) return { ok: false, error: NOT_FOUND };
  return { ok: true, data: undefined };
}

export async function deletePoem(id: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: NOT_LOGGED_IN, code: "unauthenticated" };
  if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
  const { data, error } = await supabase.from("poems").delete().eq("id", id).eq("author_id", user.id).select("id").maybeSingle();
  if (error) return { ok: false, error: GENERIC };
  if (!data) return { ok: false, error: NOT_FOUND };
  return { ok: true, data: undefined };
}
