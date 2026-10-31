"use client";

import { useEffect, useRef } from "react";

/**
 * Clears a listing's search box when the operator navigates away.
 *
 * Search text for these listings lives in a module-level zustand store, not in
 * component state, so it outlives the page: leave a listing with "john" typed,
 * come back later, and the box is still filtered by a term nobody remembers
 * entering — the list looks half-empty for no visible reason.
 *
 * This resets the store field on unmount only. It deliberately writes through
 * `setState` rather than the store's own `setSearch` action, because those
 * actions also kick off a refetch — and a request fired on the way out of a
 * page is pure waste. The next visit fetches with a clean filter anyway.
 *
 * @param reset called on unmount; should only touch state, never fetch
 */
export function useClearSearchOnLeave(reset: () => void) {
  // Held in a ref so callers can pass an inline arrow without the cleanup
  // re-running on every render.
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    return () => {
      resetRef.current();
    };
  }, []);
}
