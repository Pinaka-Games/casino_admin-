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
import { systemConfigApi } from "@/api/system-config/system-config.api";
import type { SystemConfigSpinRedeem } from "@/types/system-config";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * W-9 requirement settings, opened from the Tax Forms toolbar.
 *
 * Edits `spin_redeem` in system config — the same two values the System
 * Configuration page shows — because that section is what the redeem service
 * actually reads. It is reachable from here as well so whoever is working
 * through the submissions list can switch the requirement without leaving for
 * a settings screen.
 *
 * The whole section is re-sent on save, never a two-key patch: the backend
 * merges a PATCH against the section DEFAULTS, so anything omitted would be
 * silently reset (max spins, segment percentages, the form layout).
 */
export default function W9SettingsModal({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SystemConfigSpinRedeem | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [threshold, setThreshold] = useState("600");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemConfigApi.get();
      const spin = res.config.spin_redeem;
      setSection(spin);
      // Older config rows predate the switch; absent means the requirement is
      // running, which is what the backend assumes too.
      setEnabled(spin.w9_enabled !== false);
      setThreshold(String(spin.w9_threshold_amount ?? 600));
    } catch {
      toast.error("Could not load W-9 settings");
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

    const parsed = Number(threshold);
    // Only meaningful while the requirement is on — an empty box with the
    // switch off must not block the save.
    if (enabled && (!Number.isFinite(parsed) || parsed < 0)) {
      toast.error("Enter a valid W-9 threshold amount");
      return;
    }

    setSaving(true);
    try {
      await systemConfigApi.patchSection<SystemConfigSpinRedeem>("spin_redeem", {
        ...section,
        w9_enabled: enabled,
        // Keep the stored threshold untouched while disabled, so switching the
        // requirement back on restores the number the operator last chose.
        w9_threshold_amount: enabled ? parsed : section.w9_threshold_amount,
      });
      toast.success(
        enabled
          ? "W-9 requirement is on"
          : "W-9 requirement is off — players will not be asked for a W-9",
      );
      onOpenChange(false);
    } catch {
      toast.error("Could not save W-9 settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0F1419] border-gray-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>W-9 Settings</DialogTitle>
          <DialogDescription className="text-gray-400">
            Controls whether players are asked for a W-9 before redeeming.
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
                <Label className="text-white">W-9 Form Required</Label>
                <p className="text-xs text-gray-500">
                  Off: no player is asked for a W-9 and no redeem is blocked for the
                  lack of one. Forms already submitted are kept.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Hidden while the requirement is off — the number decides nothing
                in that state, and showing it invites an edit that does nothing. */}
            {enabled && (
              <div className="space-y-2">
                <Label className="text-white">W-9 Threshold Amount</Label>
                <p className="text-xs text-gray-500">
                  Players redeem up to this yearly total without a W-9. Past it, they
                  must submit one and have it verified.
                </p>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-48 border-gray-700 bg-[#0E1117] text-white"
                />
              </div>
            )}

            {!enabled && (
              <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-xs text-amber-300">
                The W-9 gate exists to satisfy a US tax-reporting obligation. Leave it
                off only where compliance has confirmed it does not apply.
              </p>
            )}
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
