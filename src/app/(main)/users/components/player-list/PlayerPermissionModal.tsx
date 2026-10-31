"use client";

import React, { useState } from "react";
import { X, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  username: string;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export default function PlayerPermissionModal({
  open,
  username,
  onClose,
  onSubmit,
}: Props) {
  const [formData, setFormData] = useState({
    userType: "User",
    blockMember: "no",
    freezeMember: "no",
    isNegativeWallet: "no",
    allowLogin: "yes",
    negativeWalletLimit: "100000",
    password: "",
  });

  const handleSwitchChange = (key: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value ? "yes" : "no",
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="w-full max-w-lg bg-[#15181E] rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white text-lg font-medium">Permission</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* ================= BODY ================= */}
        <div className="px-6 py-4 overflow-y-auto space-y-5 text-sm text-white scrollbar-hide">
          {/* USERNAME */}
          <div className="space-y-1">
            <Label className="text-white text-xs">Username*</Label>
            <Input
              value={username}
              disabled
              className="bg-[#15181E] border-none text-white text-xs"
            />
          </div>

          {/* USER TYPE */}
          <div className="space-y-2">
            <Label className="text-white text-xs">User Type</Label>
            <div className="flex gap-5">
              {["User", "Agent", "Shareholder"].map((type) => (
                <label key={type} className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    checked={formData.userType === type}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, userType: type }))
                    }
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          {/* SWITCHES */}
          {[
            { label: "Block Member", key: "blockMember" },
            { label: "Freeze Member", key: "freezeMember" },
            { label: "Is Negative Wallet", key: "isNegativeWallet" },
            { label: "Allow Login", key: "allowLogin" },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-white text-xs font-normal">{label}</Label>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData[key as keyof typeof formData] === "yes"}
                  onCheckedChange={(checked) =>
                    handleSwitchChange(key, checked)
                  }
                  className="data-[state=checked]:bg-purple-500 
                             data-[state=unchecked]:bg-gray-600"
                />
                <span className="text-xs">
                  {formData[key as keyof typeof formData] === "yes"
                    ? "Yes"
                    : "No"}
                </span>
              </div>
            </div>
          ))}

          {/* NEGATIVE WALLET LIMIT */}
          <div className="space-y-1">
            <Label className="text-white text-xs">Negative Wallet Limit</Label>
            <Input
              value={formData.negativeWalletLimit}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  negativeWalletLimit: e.target.value,
                }))
              }
              className="bg-[#15181E] border-none text-white text-xs"
            />
          </div>

          {/* MAX WINNING SETTINGS */}
          <div className="space-y-2">
            <Label className="text-white text-xs">Max Winning Settings</Label>

            <div className="grid grid-cols-3 gap-3">
              {[
                "Esports",
                "Sports",
                "Casino",
                "Slots",
                "Board",
                "Fishing",
                "Arcade",
                "Fast Game",
              ].map((item) => (
                <div key={item} className="space-y-1">
                  <p className="text-xs">{item}</p>
                  <Input
                    placeholder="MYR"
                    className="bg-[#15181E] border-none text-white text-xs"
                  />
                  <Input
                    placeholder="SGD"
                    className="bg-[#15181E] border-none text-white text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* PASSWORD */}
          <div className="space-y-1">
            <Label className="text-red-400 text-xs">Password*</Label>
            <div className="relative">
              <Input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className="bg-[#15181E] border-none text-white text-xs pr-10"
              />
              <EyeOff
                size={16}
                className="absolute right-3 top-2.5 text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* ================= FOOTER ================= */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <Button
            variant="outline"
            className="border-gray-600 text-white"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            className="bg-purple-500 hover:bg-purple-600 text-white"
            onClick={() => onSubmit?.(formData)}
          >
            Update
          </Button>
        </div>
      </div>
    </div>
  );
}
