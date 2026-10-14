import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyPoems from "@/views/MyPoems";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent("/write/mine")}`);
  return <MyPoems />;
}
