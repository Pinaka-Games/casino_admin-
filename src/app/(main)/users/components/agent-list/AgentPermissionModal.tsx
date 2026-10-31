"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserWithProfile } from "@/types/profile.type";

interface Props {
  open: boolean;
  user: UserWithProfile | null;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export default function AgentPermissionModal({
  open,
  user,
  onClose,
  onSubmit,
}: Props) {
  const [formData, setFormData] = useState({
    isBlocked: false,
    isFrozen: false,
    isUpdating: false
  });

  useEffect(() => {
    if (open && user) {
      setFormData({
        isBlocked: user.isBlocked || false,
        isFrozen: user.isFrozen || false,
        isUpdating: false
      });
    }
  }, [open, user]);

  const handleSwitchChange = (key: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmitClick = async () => {
    setFormData(prev => ({ ...prev, isUpdating: true }));
    try {
      if (onSubmit) {
        await onSubmit({
          isBlocked: formData.isBlocked,
          isFrozen: formData.isFrozen,
        });
      }
    } finally {
      setFormData(prev => ({ ...prev, isUpdating: false }));
    }
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 md:p-0">
      <div className="w-full max-w-lg bg-[#15181E] rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 md:px-6">
          <h2 className="text-white text-lg font-medium">Permission</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="px-4 py-4 overflow-y-auto space-y-5 text-sm text-white scrollbar-hide md:px-6">
          <div className="space-y-1">
            <Label className="text-white text-xs font-normal">Username*</Label>
            <Input
              value={user?.username || user?.name || ""}
              disabled
              className="bg-[#191D24] border-gray-800 text-gray-400 text-xs h-10 rounded-lg"
            />
          </div>

          {/* ACCOUNT STATUS — same Active/Inactive wording as the listing.
              Switch ON = Active (not blocked); Inactive = login disabled. */}
          <div className="flex items-center justify-between py-2 border-b border-gray-800/30">
            <div className="flex flex-col">
              <Label className="text-white text-xs font-normal">Account Status</Label>
              <span className="text-[10px] text-gray-500">
                Inactive blocks all site access — the agent cannot log in
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!formData.isBlocked}
                onCheckedChange={(checked) => handleSwitchChange("isBlocked", !checked)}
                className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
              />
              <span className={`text-xs min-w-[48px] ${formData.isBlocked ? "text-red-400" : "text-[#04AD37]"}`}>
                {formData.isBlocked ? "Inactive" : "Active"}
              </span>
            </div>
          </div>

          {/* FREEZE — login stays allowed; wallet transactions & withdrawals blocked */}
          <div className="flex items-center justify-between py-2 border-b border-gray-800/30">
            <div className="flex flex-col">
              <Label className="text-white text-xs font-normal">Freeze Wallet</Label>
              <span className="text-[10px] text-gray-500">
                Agent can still log in, but cannot transact or withdraw funds
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isFrozen}
                onCheckedChange={(checked) => handleSwitchChange("isFrozen", checked)}
                className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
              />
              <span className={`text-xs min-w-[48px] ${formData.isFrozen ? "text-red-400" : "text-gray-400"}`}>
                {formData.isFrozen ? "Frozen" : "Normal"}
              </span>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 px-4 py-4 border-t border-gray-800 bg-[#191D24]/30 md:px-6">
          <Button
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-800"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold h-10 px-6"
            onClick={handleSubmitClick}
            disabled={formData.isUpdating}
          >
            {formData.isUpdating ? "Updating..." : "Update"}
          </Button>
        </div>
      </div>
    </div>
  );
}
