import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import Explore from "@/views/Explore";
import { prefetchTrpc } from "../../server/prefetch";
import { getServerCaller } from "../../server/serverTrpc";

// Renders the feed into the first HTML. The query key/options must match `Explore`'s useQuery.
export default async function Page() {
  const queryClient = new QueryClient();
  const caller = await getServerCaller();
  await prefetchTrpc(queryClient, "poems.feed", undefined, () => caller.poems.feed());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Explore />
    </HydrationBoundary>
  );
}
