"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import FigmaInput from "@/components/ui/FigmaInput";

import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import Image from "next/image";
import { VipTier } from "@/types/vip.tier.types";

/* =========================
   TYPES
========================= */
export interface TierFormData {
  id?: number;
  icon?: string;
  lockedIcon?: string;
  backgroundImage?: string;

  tierGroup: string;

  name: {
    en: string;
    zhCN: string;
    zhTW: string;
  };

  description: {
    en: string;
    zhCN: string;
    zhTW: string;
  };

  minimumDeposit: number;
  minimumWager: number;
  cashbackPercentage: number;

  sequence: number;
  isActive: boolean;
}

const getDefaultForm = (): VipTier => ({
  name: "Bronze",
  // Single row per tier — level 3 is the row every VIP reward keys off.
  level: 3,
  xp_required: 0,
  badge: "",
  isActive: true,

  benefits: {
    hourlyCashback: false,
    dailyCashback: false,
    reloadDepositeBonus: false,
    communityChat: false,
    vipSpin: false,
    levelUpBonus: false,
    weeklyBonus: false,
    monthlyBonus: false,
    instantRebate: false
  },

  depositSettings: {
    minimumDeposit: null,
    minimumWager: null,
  },

  withdrawalSettings: {
    withdrawalCountLimit: null,
    minimumWithdrawalBank: null,
    maximumWithdrawalBank: null,
    minimumWithdrawalEWallet: null,
    maximumWithdrawalEWallet: null,
    minimumWithdrawalCrypto: null,
    maximumWithdrawalCrypto: null,
    withdrawalPerDay: null,
    withdrawalPerWeek: null,
    withdrawalPerMonth: null,
  },
});

interface Props {
  open: boolean;
  initialData?: VipTier | null;
  onClose: () => void;
  onSubmit: (data: VipTier) => void;
}




export type VipTierName =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master"
  | "Immortal";

export type VipLevel = 1 | 2 | 3;

interface Props {
  open: boolean;
  initialData?: VipTier | null;
  onClose: () => void;
  onSubmit: (data: VipTier) => void;
  inactiveTier: (id: string | undefined, checked: boolean) => void;
}


/* =========================
   DEFAULT STATE
========================= */

const DEFAULT_FORM: VipTier = {
  name: "Bronze",
  // Single row per tier — level 3 is the row every VIP reward keys off.
  level: 3,
  xp_required: 0,
  badge: "",
  isActive: true,

  benefits: {
    hourlyCashback: false,
    dailyCashback: false,
    reloadDepositeBonus: false,
    communityChat: false,
    vipSpin: false,
    levelUpBonus: false,
    weeklyBonus: false,
    monthlyBonus: false,
    instantRebate: false
  },

  depositSettings: {
    minimumDeposit: null,
    minimumWager: null,
  },

  withdrawalSettings: {
    withdrawalCountLimit: null,
    minimumWithdrawalBank: null,
    maximumWithdrawalBank: null,
    minimumWithdrawalEWallet: null,
    maximumWithdrawalEWallet: null,
    minimumWithdrawalCrypto: null,
    maximumWithdrawalCrypto: null,
    withdrawalPerDay: null,
    withdrawalPerWeek: null,
    withdrawalPerMonth: null,
  },
};

// Mirrors the backend's VipTierName enum — the create endpoint rejects
// anything else.
const TIER_NAME_OPTIONS: VipTierName[] = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Immortal",
];

const BENEFIT_FIELDS: Array<{ key: keyof VipTier["benefits"]; label: string }> = [
  { key: "hourlyCashback", label: "Hourly Cashback" },
  { key: "dailyCashback", label: "Daily Cashback" },
  { key: "instantRebate", label: "Instant Rebate" },
  { key: "communityChat", label: "Community Chat" },
  { key: "vipSpin", label: "VIP Spin" },
  { key: "weeklyBonus", label: "Weekly Cashback" },
  { key: "monthlyBonus", label: "Monthly Cashback" },
];

/* =========================
   COMPONENT
========================= */

export default function TierModal({
  open,
  initialData,
  onClose,
  onSubmit,
  inactiveTier
}: Props) {
  const [formData, setFormData] =  useState<VipTier>(getDefaultForm())

  useEffect(() => {
    if (!open) return;
    setFormData(initialData ?? getDefaultForm());
  }, [open, initialData]);

  if (!open) return null;

  const handleSubmit = async () => {
    // Success/failure toasts come from the page's onSubmit — toasting here
    // said "Saved successfully" even when the API rejected the tier.
    await onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-0">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#15181E] rounded-xl flex flex-col">

        {/* ================= HEADER ================= */}
        <div className="flex justify-between items-center px-4 py-4 md:px-6 border-b border-[#2a2f3a]">
          <h2 className="text-white text-lg font-semibold">
            {/* handleCreate passes a template object, so check the id — a
                truthy initialData alone titled the create flow "Edit". */}
            {initialData?.id ? "Edit VIP Tier" : "Create VIP Tier"}
          </h2>
          <button onClick={onClose}>
            <X className="text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* ================= BODY ================= */}
        <div className="p-4 overflow-y-auto space-y-8 md:p-6 md:space-y-12">

          {/* ================= BASIC INFORMATION ================= */}
          <div>
            <h3 className="text-white text-sm font-semibold mb-6">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
              <div>
                <Label htmlFor="badge" className="text-gray-400 text-xs mb-2 block">
                  Tier Name
                </Label>
                {initialData?.id ? (
                  // Editing: the name is the tier's identity — read-only.
                  <div className="mt-4">
                    <div className="bg-[#1F2630] p-4 rounded-lg flex justify-left items-center border border-[#2a2f3a]">
                      <Label className="text-gray-400 text-xs mb-2 block">{formData?.name}</Label>
                    </div>
                  </div>
                ) : (
                  // Creating: the backend only accepts the VipTierName enum, so
                  // offer exactly those — free text 400s on validation.
                  <select
                    value={formData?.name ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value as VipTier["name"],
                      })
                    }
                    className="w-full bg-[#1F2630] border border-[#2a2f3a] rounded-lg p-3 text-white text-sm focus:outline-none"
                  >
                    <option value="" disabled>
                      Select tier name
                    </option>
                    {TIER_NAME_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {/* BADGE */}
              <div>
                <Label htmlFor="badge" className="text-gray-400 text-xs mb-2 block">
                  Tier Badge
                </Label>

                {formData.badge && (
                  <div className="mt-4">
                    <div className="bg-[#1F2630] p-4 rounded-lg flex justify-center items-center border border-[#2a2f3a]">
                      <Image
                        src={formData?.badge}
                        alt="Badge Preview"
                        width={80}
                        height={80}
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* XP REQUIRED */}
              <div>
                <Label htmlFor="xp_required" className="text-gray-400 text-xs mb-2 block">
                  XP Required
                </Label>
                <FigmaInput
                  type="number"
                  placeholder="Enter XP required to unlock this tier"
                  value={formData?.xp_required}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      xp_required: Number(e.target.value),
                    })
                  }
                />
              </div>

            </div>
          </div>

          {/* ================= DEPOSIT SETTINGS ================= */}
          {/* <div>
            <h3 className="text-white text-sm font-semibold mb-6">
              Deposit Settings
            </h3>

            <div className="grid grid-cols-2 gap-6">

              <div>
                <Label htmlFor="minDeposit" className="text-gray-400 text-xs mb-2 block">
                  Minimum Deposit (USD)
                </Label>
                <FigmaInput
                  type="number"
                  placeholder="Enter minimum deposit amount"
                  value={formData?.depositSettings?.minimumDeposit ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      depositSettings: {
                        ...formData?.depositSettings,
                        minimumDeposit: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="minWager" className="text-gray-400 text-xs mb-2 block">
                  Minimum Wager (USD)
                </Label>
                <FigmaInput
                  type="number"
                  placeholder="Enter minimum wager amount"
                  value={formData?.depositSettings?.minimumWager ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      depositSettings: {
                        ...formData.depositSettings,
                        minimumWager: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

            </div>
          </div> */}

          {/* ================= WITHDRAWAL SETTINGS ================= */}
          {/* <div>
            <h3 className="text-white text-sm font-semibold mb-6">
              Withdrawal Settings
            </h3>

            <div className="grid grid-cols-3 gap-6">

              {Object.entries(formData?.withdrawalSettings).map(([key, value]) => (
                <div key={key}>
                  <Label
                    htmlFor={key}
                    className="text-gray-400 text-xs mb-2 block capitalize"
                  >
                    {key.replace(/([A-Z])/g, " $1")}
                  </Label>
                  <FigmaInput
                    type="number"
                    placeholder={`Enter ${key.replace(/([A-Z])/g, " $1")}`}
                    value={value ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        withdrawalSettings: {
                          ...formData?.withdrawalSettings,
                          [key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              ))}

            </div>
          </div> */}

          {/* ================= BENEFITS ================= */}
          <div>
            <h3 className="text-white text-sm font-semibold mb-6">
              VIP Benefits
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {BENEFIT_FIELDS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between bg-[#1F2630] px-4 py-3 rounded-md"
                >
                  <Label
                    htmlFor={key}
                    className="text-white text-sm cursor-pointer"
                  >
                    {label}
                  </Label>
                  <Switch
                    id={key}
                    checked={formData.benefits[key]}
                    onCheckedChange={(v) =>
                      setFormData({
                        ...formData,
                        benefits: {
                          ...formData.benefits,
                          [key]: v,
                        },
                      })
                    }
                    className={`
                        data-[state=checked]:bg-blue-500 
                        data-[state=unchecked]:bg-gray-600
                      `}
                  />
                </div>
              ))}

            </div>
          </div>

          {/* ================= ACTIVE ================= */}
          <div className="flex items-center gap-4">
            <Label htmlFor="isActive" className="text-white text-sm">
              Tier Active
            </Label>
            <Switch
              id="isActive"
              checked={formData?.isActive}
              onCheckedChange={(v) => {
                setFormData({ ...formData, isActive: v })
                inactiveTier(formData.id, v)
                          
              }}
            className={`
                data-[state=checked]:bg-blue-500 
                data-[state=unchecked]:bg-gray-600
              `}
            />
            <span className="text-gray-400 text-sm">
              {formData?.isActive ? "Enabled" : "Disabled"}
            </span>
          </div>

        </div>

        {/* ================= FOOTER ================= */}
        <div className="flex justify-end gap-3 px-4 py-4 md:px-6 border-t border-[#2a2f3a]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700"
            onClick={handleSubmit}
          >
            Save
          </Button>
        </div>

      </div>
    </div>
  );

}

