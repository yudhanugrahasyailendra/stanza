import { createBrowserClient } from "@supabase/ssr";

// For Client Components. Only the public URL and anon key are used here.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
