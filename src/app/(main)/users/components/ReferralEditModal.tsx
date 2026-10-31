"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Referral {
  id: number;
  username: string;
  code: string;
  type: string;
  status: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  initialData: Referral | null;
  onClose: () => void;
  onSubmit: (data: Referral) => void;
}

export default function ReferralEditModal({
  open,
  initialData,
  onClose,
  onSubmit,
}: Props) {
  const [formData, setFormData] = useState<Referral | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    }
  }, [initialData]);

  if (!open || !formData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl rounded-xl bg-[#15181E] p-6 relative">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-medium">
            View Referral Code
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* FORM */}
        <div className="space-y-5">
          <div>
            <Label className="text-white text-sm">Username</Label>
            <input
              value={formData.username}
              readOnly
              className="w-full h-10 mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm opacity-70 cursor-not-allowed"
            />
          </div>

          <div>
            <Label className="text-white text-sm">Referral Code</Label>
            <input
              value={formData.code}
              readOnly
              className="w-full h-10 mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm opacity-70 cursor-not-allowed"
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 mt-8">
          <Button
            variant="outline"
            className="border-gray-600 text-white"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
