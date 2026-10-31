"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  /** Body copy. Kept as a node so callers can highlight the part that matters. */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for anything destructive. */
  destructive?: boolean;
  /** Disables both buttons and spins the confirm while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Themed confirm dialog.
 *
 * Replaces `window.confirm`, which renders the browser's own chrome — a white
 * box captioned "admin-staging.wulfcasino.com says" in the middle of a dark
 * admin. It also cannot show a busy state, so a slow action (bulk retry talks
 * to AleaPlay once per allocation) left the admin with no feedback at all.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    // Escape cancels — but not while the action is running, or the admin would
    // lose sight of something that is still going.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-700 bg-[#1C2127] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                destructive
                  ? "bg-red-500/15 text-red-400"
                  : "bg-orange-500/15 text-orange-300"
              }`}
            >
              <AlertTriangle size={16} />
            </span>
            <h2 className="text-base font-semibold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="text-gray-400 hover:text-white disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 text-sm leading-relaxed text-gray-300">{message}</div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-700 bg-[#191D24] px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-lg border border-gray-600 px-4 text-sm text-gray-300 hover:text-white disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex h-9 items-center gap-2 rounded-lg px-5 text-sm font-medium text-white disabled:opacity-50 ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-purple-600 hover:bg-purple-700"
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
