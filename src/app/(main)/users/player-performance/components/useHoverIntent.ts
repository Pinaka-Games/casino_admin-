"use client";

import { useCallback, useEffect, useRef } from "react";

/** Long enough that sweeping the pointer across a row of chips fires nothing. */
const HOVER_INTENT_MS = 150;

export interface HoverIntentHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

/**
 * Calls `onIntent(value)` once the pointer (or keyboard focus) has rested on
 * an element for ~150 ms — used to prefetch what a click would load, so the
 * click itself renders from cache. Leaving early cancels it.
 */
export function useHoverIntent<T>(onIntent: (value: T) => void, delay = HOVER_INTENT_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const start = useCallback(
    (value: T) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        onIntent(value);
      }, delay);
    },
    [cancel, delay, onIntent],
  );

  return useCallback(
    (value: T): HoverIntentHandlers => ({
      onMouseEnter: () => start(value),
      onMouseLeave: cancel,
      onFocus: () => start(value),
      onBlur: cancel,
    }),
    [start, cancel],
  );
}
