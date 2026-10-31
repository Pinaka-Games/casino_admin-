"use client";

import React from "react";
import { X, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalPortal from "./ModalPortal";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  description = "Are you sure you want to delete this record? This action cannot be undone.",
  loading = false,
}: Props) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-300">
        <div className="w-full max-w-md bg-[#15181E] border border-gray-800 rounded-3xl shadow-2xl overflow-hidden shadow-red-500/5 max-h-[92dvh] overflow-y-auto">
          {/* HEADER */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800/50 bg-red-500/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-white font-bold text-lg">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* BODY */}
          <div className="p-5 sm:p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6 border border-red-500/10">
                <Trash2 size={32} />
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              {description}
            </p>
          </div>

          {/* FOOTER */}
          <div className="p-4 sm:p-6 pt-0 flex flex-col sm:flex-row gap-2 sm:gap-3">
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
              className="flex-1 bg-red-500 hover:bg-red-600 text-white border-none h-12 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
