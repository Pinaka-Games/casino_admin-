"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FreeSpin } from "@/types/free-spin";

interface Props {
  open: boolean;
  data: FreeSpin | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function FreeSpinRemoveModal({
  open,
  data,
  onClose,
  onConfirm,
}: Props) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!open || !data) return null;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-[#15181E] p-6 relative">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-medium">Confirm Remove</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* CONTENT */}
        <p className="text-sm text-gray-300 leading-relaxed">
          Are you sure you want to remove the free spin config{" "}
          <span className="text-white font-medium">{data.name}</span>?
          <br />
          This action cannot be undone.
        </p>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 mt-8">
          <Button
            variant="outline"
            className="border-gray-600 text-white"
            onClick={onClose}
            disabled={isConfirming}
          >
            Cancel
          </Button>

          <Button
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? "Removing..." : "Remove"}
          </Button>
        </div>
      </div>
    </div>
  );
}
