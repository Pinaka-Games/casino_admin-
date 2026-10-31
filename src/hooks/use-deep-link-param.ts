"use client";

import { useEffect, useState } from "react";

/**
 * One query-string value, read on the client and kept in step with navigation.
 *
 * Deliberately not `useSearchParams`: that opts the whole page out of static
 * rendering (the build fails unless every such component sits behind its own
 * Suspense boundary), and these deep links are a convenience layered on top of
 * pages that render fine without them.
 *
 * Client-side navigation replaces the URL through `history.pushState`, which
 * fires no event of its own — so the History methods are wrapped once to emit
 * one. Without it, jumping from one deep link to another (a second game picked
 * from the header search while the catalogue is already open) would leave this
 * hook showing the first link's value.
 *
 * Returns `null` on the server and for the first client render, so callers must
 * treat "no value yet" the same as "no value".
 */

const LOCATION_EVENT = "app:locationchange";

let historyPatched = false;

const patchHistory = () => {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;

  (["pushState", "replaceState"] as const).forEach((method) => {
    const original = window.history[method];
    window.history[method] = function patched(
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(LOCATION_EVENT));
      return result;
    };
  });
};

export const useDeepLinkParam = (key: string): string | null => {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    patchHistory();

    const read = () =>
      setValue(new URLSearchParams(window.location.search).get(key));

    read();
    window.addEventListener("popstate", read);
    window.addEventListener(LOCATION_EVENT, read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener(LOCATION_EVENT, read);
    };
  }, [key]);

  return value;
};
