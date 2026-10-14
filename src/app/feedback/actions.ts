"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const result = z.enum(["done", "stuck", "skipped"]);
const submission = z.object({
  deviceType: z.enum(["mobile", "desktop", "tablet", "other"]),
  firstVisit: z.boolean(),
  taskResults: z.object({ draft: result, publish: result, appreciation: result, follow: result, settings: result, export: result }),
  susAnswers: z.array(z.number().int().min(1).max(5)).length(10),
  confusion: z.string().trim().max(1500).default(""),
  suggestion: z.string().trim().max(1500).default(""),
  consent: z.literal(true),
});

export type FeedbackResult = { ok: true } | { ok: false; error: string };

// Answers are stored without user_id: the consent text on the form promises they are not linked
// to a Stanza account. The feedback table has no select policy, so it is read from the dashboard only.
export async function submitFeedback(input: unknown): Promise<FeedbackResult> {
  const parsed = submission.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Jawaban belum lengkap atau tidak valid." };
  const { susAnswers, confusion, suggestion, ...rest } = parsed.data;
  // Standard SUS scoring: odd items contribute (answer - 1), even items (5 - answer), scaled to 0-100.
  const susScore = Number((susAnswers.reduce((sum, answer, index) => sum + (index % 2 === 0 ? answer - 1 : 5 - answer), 0) * 2.5).toFixed(1));
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    user_id: null,
    answers: { ...rest, susAnswers, susScore, confusion: confusion || null, suggestion: suggestion || null },
  });
  if (error) return { ok: false, error: "Jawaban belum tersimpan. Coba kirim sekali lagi." };
  return { ok: true };
}
