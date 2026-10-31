"use client";

import { useEffect } from "react";

import {
  isChunkLoadError,
  isHashedAssetLoadFailure,
  recoverFromChunkError,
} from "@/lib/chunk-error";

/**
 * The window-level half of chunk-error recovery. Renders nothing.
 *
 * React error boundaries (`error.tsx`, `global-error.tsx`) only see errors
 * thrown during render. Most version-skew failures are not: a `<script>` that
 * 404s fires a non-bubbling `error` event on the element and throws nothing at
 * all, and the router's own prefetch/import rejections arrive as unhandled
 * promise rejections outside any component. Neither reaches a boundary, so
 * without this listener those cases stay a blank screen.
 *
 * Mounted in the root layout so it is listening before any route code runs.
 */
export default function ChunkErrorRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // Two different events share this name. A resource that failed to load
      // carries no message and does not bubble — it is identified by its
      // target. A real thrown error carries `error`/`message`.
      if (isHashedAssetLoadFailure(event.target) || isChunkLoadError(event.error ?? event.message)) {
        recoverFromChunkError();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) recoverFromChunkError();
    };

    // `true` is load-bearing: resource error events do not bubble, so they are
    // only observable in the capture phase.
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
