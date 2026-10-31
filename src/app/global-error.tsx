"use client";

import { useEffect } from "react";

import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-error";

/**
 * Last-resort boundary. Replaces the root layout entirely, so it is the only
 * thing standing between a crash in the layout itself — or in any route with
 * no nearer boundary — and the browser's blank page.
 *
 * Two deliberate constraints:
 *
 *  1. It renders its own <html>/<body>. Next requires that, because the root
 *     layout it replaced is what normally provides them.
 *  2. Every style here is inline. This component has to render correctly in
 *     exactly the situation where a stylesheet may be the asset that failed to
 *     load, so it cannot depend on globals.css or on a Tailwind class surviving.
 *
 * A chunk failure that reaches this point is reloaded rather than shown — see
 * lib/chunk-error. The markup below is what a user sees only when the reload
 * budget is spent, or when the error was something else entirely.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkLoadError(error)) recoverFromChunkError();
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#15181e",
          color: "#FFFFFF",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#9CA3AF",
              margin: "0 0 24px",
            }}
          >
            The page could not be loaded. Reloading usually fixes it.
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "12px 28px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#B93DEB",
              }}
            >
              Reload
            </button>
            <button
              type="button"
              // `reset` re-renders the failed tree without a full navigation —
              // worth offering for a transient error, useless for a missing
              // chunk, which is why Reload is the primary action.
              onClick={reset}
              style={{
                padding: "12px 28px",
                borderRadius: "12px",
                border: "1px solid #242B35",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "transparent",
              }}
            >
              Try again
            </button>
          </div>
          {/* The digest is the only handle on the server-side stack, which is
              redacted in production. Without it a support report cannot be
              matched to a log line. */}
          {error?.digest && (
            <p style={{ marginTop: "24px", fontSize: "0.75rem", color: "#4B5563" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
