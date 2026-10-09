"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Drop-in for wouter's `useLocation()`: `[pathname, navigate]`.
 * `pathname` excludes the query string, like wouter. Read the query with `useSearchParams()`.
 */
export function useLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => (options?.replace ? router.replace(to) : router.push(to)),
    [router],
  );
  return [pathname, navigate];
}
