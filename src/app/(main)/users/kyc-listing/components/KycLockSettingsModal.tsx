"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { systemConfigApi } from "@/api/system-config/system-config.api";
import type {
  KycIdentityPreferredSource,
  KycIdentitySyncMode,
  SystemConfigRiskCompliance,
} from "@/types/system-config";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Unit = "minutes" | "hours" | "days";

const UNIT_MINUTES: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 };

/**
 * KYC-deadline account lock, opened from the KYC Listing toolbar.
 *
 * Edits `risk_compliance.kyc_lock_*` in system config. Players who have not
 * passed KYC within the grace period are locked out (they see "Your account is
 * locked. Please contact admin." on sign-in) and emailed once. Approving their
 * KYC lifts the lock; switching the feature off lifts every lock.
 *
 * Also holds "Profile vs document": what happens to the profile when Sumsub
 * approves and the player's profile and the document disagree
 * (`risk_compliance.kyc_identity_*`). Manual is the original behaviour.
 *
 * The whole section is re-sent on save: the backend merges a PATCH against the
 * section DEFAULTS, so omitted SEON keys would be silently reset.
 */
export default function KycLockSettingsModal({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SystemConfigRiskCompliance | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("7");
  const [unit, setUnit] = useState<Unit>("days");
  const [syncMode, setSyncMode] = useState<KycIdentitySyncMode>("MANUAL");
  const [preferred, setPreferred] =
    useState<KycIdentityPreferredSource>("DOCUMENT");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemConfigApi.get();
      const rc = res.config.risk_compliance;
      setSection(rc);
      setEnabled(!!rc.kyc_lock_enabled);
      // Show the largest unit that divides the stored minutes evenly.
      const minutes = Number(rc.kyc_lock_after_minutes ?? 10080);
      const best: Unit =
        minutes % 1440 === 0 ? "days" : minutes % 60 === 0 ? "hours" : "minutes";
      setUnit(best);
      setAmount(String(minutes / UNIT_MINUTES[best]));
      setSyncMode(rc.kyc_identity_sync_mode === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL");
      setPreferred(
        rc.kyc_identity_preferred_source === "PROFILE" ? "PROFILE" : "DOCUMENT",
      );
    } catch {
      toast.error("Could not load KYC lock settings");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleSave = async () => {
    if (!section) return;

    const minutes = Math.round(Number(amount) * UNIT_MINUTES[unit]);
    if (enabled && (!Number.isFinite(minutes) || minutes < 1)) {
      toast.error("Duration must be at least 1 minute");
      return;
    }

    setSaving(true);
    try {
      await systemConfigApi.patchSection<SystemConfigRiskCompliance>("risk_compliance", {
        ...section,
        kyc_lock_enabled: enabled,
        // Keep the stored duration while disabled, so switching back on
        // restores the value the operator last chose.
        kyc_lock_after_minutes: enabled ? minutes : section.kyc_lock_after_minutes,
        kyc_identity_sync_mode: syncMode,
        kyc_identity_preferred_source: preferred,
      });
      // The lock toast only when the lock actually changed — saving the
      // profile/document setting alone must not announce released accounts.
      toast.success(
        enabled !== !!section.kyc_lock_enabled
          ? enabled
            ? "KYC account lock is on"
            : "KYC account lock is off — all locked accounts were released"
          : "KYC settings saved",
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Could not save KYC lock settings",
      );
    } finally {
      setSaving(false);
    }
  };

  const since = section?.kyc_lock_enabled_since
    ? new Date(section.kyc_lock_enabled_since).toLocaleString()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0F1419] border-gray-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>KYC Settings</DialogTitle>
          <DialogDescription className="text-gray-400">
            Lock player accounts that have not completed KYC in time, and choose
            how profile and document differences are handled.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-800 bg-[#191D24] p-4">
              <div className="space-y-1">
                <Label className="text-white">Lock Accounts Without KYC</Label>
                <p className="text-xs text-gray-500">
                  Locked players can sign in only to complete KYC (or log out)
                  and are emailed once. Approved KYC unlocks the account.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
              <div className="space-y-2">
                <Label className="text-white">Lock After</Label>
                <p className="text-xs text-gray-500">
                  Time a player has after registration to get KYC approved.
                  Players with KYC under review are not locked.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-32 border-gray-700 bg-[#0E1117] text-white"
                  />
                  <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                    <SelectTrigger className="w-32 border-gray-700 bg-[#0E1117] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-gray-500">
                  {since
                    ? `Active since ${since}. Existing players' clock started then, not at signup.`
                    : "When switched on, existing players get the full duration from now, not from signup."}
                </p>
              </div>
            )}

            {!enabled && section?.kyc_lock_enabled && (
              <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-xs text-amber-300">
                Saving with the lock off releases every account it has locked.
              </p>
            )}

            {/* Profile vs document. Never changes the KYC status — that is
                Sumsub's decision; this only decides what happens to the
                player's profile details after an approval. */}
            <div className="space-y-4 rounded-lg border border-gray-800 bg-[#191D24] p-4">
              <div className="space-y-1">
                <Label className="text-white">Profile vs Document</Label>
                <p className="text-xs text-gray-500">
                  When Sumsub approves and the player&apos;s profile (name, date
                  of birth, gender) differs from their document. The KYC status
                  is not affected either way.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Sync Mode</Label>
                <Select
                  value={syncMode}
                  onValueChange={(v) => setSyncMode(v as KycIdentitySyncMode)}
                >
                  <SelectTrigger className="w-full border-gray-700 bg-[#0E1117] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                    <SelectItem value="MANUAL">Manual — admin decides</SelectItem>
                    <SelectItem value="AUTOMATIC">Automatic</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {syncMode === "MANUAL"
                    ? "Differences are flagged in the KYC listing. An admin uses the document details or asks the player to correct theirs."
                    : "Differences are settled on approval using the preferred data below."}
                </p>
              </div>

              <div className="space-y-2">
                <Label className={syncMode === "AUTOMATIC" ? "text-white" : "text-gray-500"}>
                  Preferred Data
                </Label>
                <Select
                  value={preferred}
                  onValueChange={(v) => setPreferred(v as KycIdentityPreferredSource)}
                  disabled={syncMode !== "AUTOMATIC"}
                >
                  <SelectTrigger className="w-full border-gray-700 bg-[#0E1117] text-white disabled:opacity-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                    <SelectItem value="DOCUMENT">Sumsub document</SelectItem>
                    <SelectItem value="PROFILE">Player profile</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {syncMode !== "AUTOMATIC"
                    ? "Used only in Automatic mode."
                    : preferred === "DOCUMENT"
                      ? "The document details overwrite the profile automatically — the same as clicking \"Use document details\". The player is notified."
                      : "The profile is kept exactly as the player entered it. Differences stay flagged for admins."}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            className="border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="bg-purple-600 text-white hover:bg-purple-700"
            onClick={handleSave}
            disabled={loading || saving || !section}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
