"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  campaignTitle?: string;
}

export default function DeleteCampaignModal({ open, onClose, onConfirm, campaignTitle }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[400px] p-0 bg-[#1D222B] text-white border border-[#2A2F3A] hide-close-btn shadow-2xl rounded-xl overflow-hidden [&>button]:hidden">
        <div className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Delete Campaign</h2>
            <p className="text-sm text-gray-400">
              Are you sure you want to delete <span className="font-bold text-gray-200">"{campaignTitle}"</span>? This action cannot be undone.
            </p>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-[#15181E]/50 border-t border-[#2A2F3A] flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#2A2F3A]/40 text-gray-300 text-sm font-bold hover:bg-[#2A2F3A] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors shadow-md shadow-red-500/20"
          >
            Delete
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
