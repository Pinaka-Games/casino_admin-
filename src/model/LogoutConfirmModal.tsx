"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutConfirmModal({ open, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#1D232B] border-none text-white max-w-lg rounded-[24px] p-10 overflow-hidden shadow-2xl">
        <div className="flex flex-col items-center text-center space-y-8">
          
          {/* ICON: Red Circle with White Logout Arrow */}
          <div className="w-24 h-24 rounded-full bg-[#E13333] flex items-center justify-center shadow-lg">
            <LogOut size={48} className="text-white transform translate-x-1" strokeWidth={2.5} />
          </div>

          {/* MESSAGE */}
          <h2 className="text-2xl font-bold text-white tracking-tight leading-tight">
            Are you sure you want to logout?
          </h2>

          {/* BUTTONS */}
          <div className="flex items-center gap-4 w-full">
            <Button
              onClick={onConfirm}
              className="flex-1 bg-[#A855F7] hover:bg-[#9333EA] text-white font-medium h-14 rounded-xl text-lg transition-all"
            >
              Logout
            </Button>
            <Button
              onClick={onClose}
              className="flex-1 bg-[#374151] hover:bg-[#4B5563] text-white font-medium h-14 rounded-xl text-lg transition-all"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
