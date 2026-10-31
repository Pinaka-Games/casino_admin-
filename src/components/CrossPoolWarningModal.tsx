"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
}

/**
 * Amber "are you sure?" confirmation shown when the email/phone being registered
 * already belongs to another account pool (staff vs player). Distinct from the
 * red DeleteConfirmModal so it doesn't read as a destructive action. Rendered
 * through a body portal so sidebar transforms/overflow don't clip it.
 */
export default function CrossPoolWarningModal({
  open,
  onClose,
  onConfirm,
  description = "This email or phone already belongs to another account. Do you still want to create it?",
  confirmLabel = "Create Anyway",
  loading = false,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#15181E] border border-gray-800 rounded-3xl shadow-2xl overflow-hidden shadow-amber-500/5">
        {/* HEADER */}
        <div className="flex items-center justify-end px-6 py-4 border-b border-gray-800/50">
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto mb-6 border border-amber-500/10">
            <AlertTriangle size={32} />
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{description}</p>
        </div>

        {/* FOOTER */}
        <div className="p-6 pt-0 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-transparent border-gray-800 text-gray-400 hover:text-white hover:bg-white/5 h-12 rounded-xl font-bold uppercase text-xs tracking-widest transition-all"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-[#B93DEB] hover:bg-purple-700 text-white border-none h-12 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-purple-500/20 active:scale-95 transition-all"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
