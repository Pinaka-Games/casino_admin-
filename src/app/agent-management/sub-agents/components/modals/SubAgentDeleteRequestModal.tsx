"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ModalPortal from "./ModalPortal";

interface Props {
  open: boolean;
  loading?: boolean;
  username?: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export default function SubAgentDeleteRequestModal({
  open,
  loading,
  username,
  onClose,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  // Reset on open by adjusting state during render — React's documented
  // alternative to a setState-in-effect, and it avoids the extra render pass.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setTouched(false);
    }
  }

  if (!open) return null;

  const reasonInvalid = reason.trim().length === 0;

  const handleSubmit = () => {
    setTouched(true);
    if (reasonInvalid) return;
    onSubmit(reason.trim());
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-md rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto scrollbar-hide">
          {/* HEADER */}
          <div className="flex items-center justify-between p-6 pb-2">
            <h2 className="text-white text-xl font-bold">Request Sub-Agent Deletion</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* BODY */}
          <div className="p-4 sm:p-6 pt-2 space-y-4 sm:space-y-5">
            <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <p className="text-amber-200/90 text-sm">
                Are you sure? This sends a deletion request for
                {username ? ` "${username}"` : " this sub-agent"} to the admin.
                The sub-agent is removed only after an admin approves.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300 text-sm font-medium">
                Reason <span className="text-red-400">*</span>
              </Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                rows={4}
                placeholder="Why should this sub-agent be deleted?"
                className="w-full resize-none rounded-xl bg-[#1C2128] border border-gray-800 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              {touched && reasonInvalid && (
                <p className="text-red-400 text-xs">Reason is required.</p>
              )}
            </div>
          </div>

          {/* FOOTER */}
          <div className="p-4 sm:p-6 pt-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <Button
              className="bg-[#1C2128] hover:bg-[#252a33] text-white font-bold px-8 py-6 rounded-xl border border-gray-800"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#A855F7] hover:bg-[#9333ea] text-white font-bold px-10 py-6 rounded-xl "
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Submit Request"}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
