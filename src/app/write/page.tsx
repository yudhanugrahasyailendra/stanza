import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WriteClient from "./WriteClient";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // getUser() validates the token with the Auth server; getSession() would only read the cookie.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === "string") query.set(key, value);
    }
    const here = query.size ? `/write?${query}` : "/write";
    redirect(`/login?returnTo=${encodeURIComponent(here)}`);
  }
  return <Suspense><WriteClient /></Suspense>;
}
