"use client";

import { X } from "lucide-react";
import ModalPortal from "./ModalPortal";
import SubAgentForm from "../SubAgentForm";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreateSuccess?: () => void;
}

export default function CreateSubAgentModal({
  open,
  onClose,
  onCreateSuccess,
}: Props) {
  if (!open) return null;

  return (
    <ModalPortal onClose={onClose}>
      {/* Centered dialog, matching the promo-code modal */}
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
        <div className="w-full max-w-4xl max-h-[92dvh] bg-[#15181E] border border-gray-800 rounded-xl p-4 sm:p-6 flex flex-col overflow-y-auto scrollbar-hide shadow-2xl">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-medium">
              Register Sub-Agent
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* BODY */}
          <SubAgentForm
            onCancel={onClose}
            onSuccess={() => {
              onCreateSuccess?.();
              onClose();
            }}
          />
        </div>
      </div>
    </ModalPortal>
  );
}
