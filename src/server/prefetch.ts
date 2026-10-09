import type { QueryClient } from "@tanstack/react-query";

/**
 * Query key exactly as @trpc/react-query builds it for `useQuery` (v11), so data prefetched on the
 * server lands on the key the client component reads. `server/prefetch.test.ts` checks this against
 * the real `getQueryKey`.
 */
export function trpcQueryKey(path: string, input?: unknown) {
  return [path.split("."), { ...(input === undefined ? {} : { input }), type: "query" as const }];
}

/**
 * Failed loads are not dehydrated (react-query drops them), so the client simply fetches again.
 * Pass the same `input` the client component passes to `useQuery`.
 */
export function prefetchTrpc(queryClient: QueryClient, path: string, input: unknown, load: () => Promise<unknown>) {
  return queryClient.prefetchQuery({ queryKey: trpcQueryKey(path, input), queryFn: load });
}
