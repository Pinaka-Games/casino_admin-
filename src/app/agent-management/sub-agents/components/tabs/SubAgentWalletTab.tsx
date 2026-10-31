"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  Loader2,
  Save,
  Ban,
  Snowflake,
  TrendingUp,
  Wallet,
  Clock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { profileApi } from "@/api/users/users";
import { getApiErrorMessage } from "@/lib/api-error";

interface SubAgentWalletTabProps {
  user: {
    id: string;
    username: string;
    totalEarnings?: number;
    availableBalance?: number;
    freezePending?: number;
    isBlocked?: boolean;
    isFrozen?: boolean;
  };
}

interface ToggleCardProps {
  label: string;
  description: string;
  onText: string;
  offText: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon: React.ElementType;
}

function ToggleCard({
  label,
  description,
  onText,
  offText,
  value,
  onChange,
  icon: Icon,
}: ToggleCardProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 p-5 rounded-2xl border transition-colors ${
        value
          ? "bg-red-500/5 border-red-500/30"
          : "bg-[#15181E] border-gray-800/60"
      }`}
    >
      <div className="flex gap-3 min-w-0">
        <div
          className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
            value ? "bg-red-500/15 text-red-400" : "bg-white/5 text-gray-400"
          }`}
        >
          <Icon size={17} />
        </div>
        <div className="min-w-0 flex items-center gap-1.5">
          <p className="text-sm font-bold text-gray-100">{label}</p>
          {/* Explanation moved into a tooltip — the cards read cleaner without it inline. */}
          <span title={description} className="text-gray-600 hover:text-gray-400 transition-colors cursor-help">
            <Info size={13} />
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`text-xs font-semibold w-16 text-right ${
            value ? "text-red-400" : "text-gray-400"
          }`}
        >
          {value ? onText : offText}
        </span>
        <Switch
          checked={value}
          onCheckedChange={onChange}
          className="data-[state=checked]:bg-red-500 data-[state=unchecked]:bg-gray-700"
        />
      </div>
    </div>
  );
}

interface BalanceCardProps {
  title: string;
  subtitle: string;
  value: string;
  accent: "green" | "blue" | "orange";
  icon: React.ElementType;
}

const BALANCE_TONE = {
  green: { text: "text-green-400", icon: "bg-green-500/10 text-green-400" },
  blue: { text: "text-blue-400", icon: "bg-blue-500/10 text-blue-400" },
  orange: { text: "text-orange-400", icon: "bg-orange-500/10 text-orange-400" },
} as const;

function BalanceCard({
  title,
  subtitle,
  value,
  accent,
  icon: Icon,
}: BalanceCardProps) {
  const tone = BALANCE_TONE[accent];

  return (
    <div className="bg-[#15181E] rounded-2xl p-5 border border-gray-800/60 flex items-center gap-4">
      <div
        className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${tone.icon}`}
      >
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">
          {title}
        </p>
        <p className={`${tone.text} text-xl sm:text-2xl font-black tracking-tight`}>
          {value}
        </p>
        <p className="text-gray-600 text-[11px]">{subtitle}</p>
      </div>
    </div>
  );
}

export default function SubAgentWalletTab({ user }: SubAgentWalletTabProps) {
  const [isBlocked, setIsBlocked] = useState(user.isBlocked ?? false);
  const [isFrozen, setIsFrozen] = useState(user.isFrozen ?? false);
  const [isSaving, setIsSaving] = useState(false);
  // Last persisted values. The detail page fetches once, so the props never
  // change after a save — tracking this locally is what keeps `dirty` honest.
  const [saved, setSaved] = useState({
    isBlocked: user.isBlocked ?? false,
    isFrozen: user.isFrozen ?? false,
  });

  const dirty = isBlocked !== saved.isBlocked || isFrozen !== saved.isFrozen;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await profileApi.updateSubAgent(user.id, { isBlocked, isFrozen });
      setSaved({ isBlocked, isFrozen });
      toast.success("Sub-Agent wallet settings updated");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update wallet settings"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-white animate-in fade-in duration-500 max-w-5xl">
      {/* ACCESS CONTROLS */}
      <div className="space-y-3">
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest px-1">
          Access Controls
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ToggleCard
            label="Block Sub-Agent"
            description="Prevents login entirely — the account cannot sign in at all."
            onText="Blocked"
            offText="Allowed"
            value={isBlocked}
            onChange={setIsBlocked}
            icon={Ban}
          />
          <ToggleCard
            label="Freeze Commission"
            description="Login still works, but commission claims are blocked."
            onText="Frozen"
            offText="Normal"
            value={isFrozen}
            onChange={setIsFrozen}
            icon={Snowflake}
          />
        </div>
      </div>

      {/* BALANCES */}
      <div className="space-y-3">
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest px-1">
          Balances
        </p>
        {/* Same three figures, same basis and same labels as the header tiles
            and the sub-agent listing columns. The "Freeze (Pending)" card used
            to be fed the ledger's unclaimed income — the number the header
            calls "Available Balance" — so this tab disagreed with every other
            surface on both cards. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BalanceCard
            title="Total Earnings"
            subtitle="Lifetime commission earned"
            value={(user.totalEarnings || 0).toFixed(2)}
            accent="green"
            icon={TrendingUp}
          />
          <BalanceCard
            title="Available Balance"
            subtitle="Claimable right now"
            value={(user.availableBalance || 0).toFixed(2)}
            accent="blue"
            icon={Wallet}
          />
          <BalanceCard
            title="Freeze (Pending)"
            subtitle="Awaiting release or claim"
            value={(user.freezePending || 0).toFixed(2)}
            accent="orange"
            icon={Clock}
          />
        </div>
      </div>

      {/* SAVE */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-800/60">
        {dirty && (
          <span className="text-xs text-orange-400 font-medium">
            Unsaved changes
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className="bg-[#B93DEB] hover:bg-[#A030D0] text-white font-bold uppercase tracking-wider px-8 py-5 rounded-xl flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Save size={18} />
          )}
          {isSaving ? "Saving..." : "Apply Wallet Settings"}
        </Button>
      </div>
    </div>
  );
}
