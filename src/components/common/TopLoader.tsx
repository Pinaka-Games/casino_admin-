"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Theme accent — Tailwind purple-500.
const COLOR = "#a855f7";

/**
 * YouTube-style top progress bar for App Router navigations.
 * - Starts on same-origin link clicks / back-forward.
 * - Trickles up to ~90% while the next route loads.
 * - Completes when the new route (pathname/search) commits, then fades out.
 * No external dependency. Mount once at the app root (inside <Suspense>).
 */
export default function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const runningRef = useRef(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  }, []);

  const done = useCallback(() => {
    if (!runningRef.current) return;
    runningRef.current = false;
    clearTimers();
    setProgress(100);
    if (fadeRef.current) clearTimeout(fadeRef.current);
    fadeRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 350);
  }, [clearTimers]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (fadeRef.current) clearTimeout(fadeRef.current);
    clearTimers();

    setVisible(true);
    setProgress(8);

    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const inc = p < 20 ? 10 : p < 50 ? 4 : p < 80 ? 2 : 0.4;
        return Math.min(90, p + inc);
      });
    }, 240);

    // Never let the bar get stuck if a navigation never commits.
    safetyRef.current = setTimeout(() => done(), 12000);
  }, [clearTimers, done]);

  // Finish whenever the route commits.
  useEffect(() => {
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Start triggers: same-origin link clicks + back/forward.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("blob:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      try {
        const next = new URL(href, window.location.href);
        if (next.origin !== window.location.origin) return; // external
        if (
          next.pathname === window.location.pathname &&
          next.search === window.location.search
        ) {
          return; // same page
        }
        start();
      } catch {
        /* ignore malformed href */
      }
    };

    const onPopState = () => start();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [start, clearTimers]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 999999,
        pointerEvents: "none",
        background: "transparent",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: COLOR,
          transition:
            progress === 100
              ? "width 200ms ease-out, opacity 350ms ease 150ms"
              : "width 300ms ease",
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
