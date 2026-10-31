"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2, Power, Info } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  getSeonConfig,
  updateSeonConfig,
  type SeonConfigValues,
} from "@/api/compliance/seon-config.api";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FLOW_TOGGLES: Array<{ key: keyof SeonConfigValues; label: string; hint: string }> = [
  { key: "fraudAuthEnabled", label: "Auth", hint: "registration, login, social" },
  { key: "fraudDepositEnabled", label: "Deposit", hint: "coinflow/breeze payin + subscription" },
  { key: "fraudWithdrawalEnabled", label: "Withdrawal", hint: "redeem request" },
  { key: "fraudKycEnabled", label: "KYC", hint: "kyc start" },
  { key: "fraudAccountEditEnabled", label: "Account edit", hint: "profile change" },
  // Gameplay gate not wired yet — recent launch-gate code was reverted; hide the
  // toggle for now so admins don't flip a switch that does nothing. Re-enable when
  // the gameplay SEON call is back.
  // { key: "fraudGameplayEnabled", label: "Gameplay", hint: "bonus claim, wager events" },
];

export default function SeonControlsModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<SeonConfigValues | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSeonConfig()
      .then((res) => setValues(res.effective))
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to load SEON controls"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const set = (key: keyof SeonConfigValues, v: boolean) =>
    setValues((prev) => (prev ? { ...prev, [key]: v } : prev));

  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    try {
      // Send only the boolean kill-switches.
      const res = await updateSeonConfig({
        seonEnabled: values.seonEnabled,
        amlEnabled: values.amlEnabled,
        fraudAuthEnabled: values.fraudAuthEnabled,
        fraudDepositEnabled: values.fraudDepositEnabled,
        fraudWithdrawalEnabled: values.fraudWithdrawalEnabled,
        fraudKycEnabled: values.fraudKycEnabled,
        fraudAccountEditEnabled: values.fraudAccountEditEnabled,
        fraudGameplayEnabled: values.fraudGameplayEnabled,
      });
      setValues(res.effective);
      toast.success("SEON controls saved");
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save SEON controls");
    } finally {
      setSaving(false);
    }
  };

  const master = values?.seonEnabled ?? true;

  const Toggle = ({
    checked,
    onChange,
    disabled,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none ${
        checked ? "bg-emerald-500" : "bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#191D24] rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-[#191D24] z-10">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Power size={20} className="text-green-400" /> SEON Controls
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {loading || !values ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <p className="text-xs text-gray-500">
              Turn SEON off entirely or per flow to save cost. When a flow is off, that event proceeds
              normally (no fraud/AML call) and shows in the listing as <code>SEON_DISABLED</code>.
            </p>

            {/* How it works */}
            <details className="rounded-lg bg-[#242B35]/60 border border-[#242B35]">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-xs font-semibold text-gray-300">
                <Info size={14} className="text-green-400" /> How SEON Controls work
              </summary>
              <div className="space-y-3 px-4 pb-4 text-xs leading-relaxed text-gray-400">
                <p>
                  SEON bills per API call. These switches let you pause SEON — entirely or for one
                  flow — without touching code. A disabled flow behaves as if SEON approved it:
                  <b className="text-gray-300"> no OTP step-up, no block</b>, the user continues
                  normally, and a cheap audit row is written with reason{" "}
                  <code>SEON_DISABLED</code>.
                </p>
                <div>
                  <div className="mb-1 font-semibold text-gray-300">Master</div>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>
                      <b className="text-gray-300">SEON enabled</b> — the big off-switch. Off = zero
                      SEON calls anywhere (fraud + AML). Everything is allowed. Use to fully stop
                      billing.
                    </li>
                    <li>
                      <b className="text-gray-300">AML screening</b> — watchlist / PEP / sanctions
                      checks + ongoing monitoring. Off = no AML calls; KYC approvals are no longer
                      held for sanctions hits. Fraud scoring still runs (if master is on).
                    </li>
                  </ul>
                </div>
                <div>
                  <div className="mb-1 font-semibold text-gray-300">Fraud checks per flow</div>
                  <p className="mb-1">
                    Enable/disable fraud scoring for a single event type — e.g. keep Auth + Withdrawal
                    on, turn Deposit off to cut cost.
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>
                      <b className="text-gray-300">Auth</b> — register, login, social login
                    </li>
                    <li>
                      <b className="text-gray-300">Deposit</b> — Coinflow / Breeze pay-in +
                      subscription purchase
                    </li>
                    <li>
                      <b className="text-gray-300">Withdrawal</b> — redeem / cash-out request
                    </li>
                    <li>
                      <b className="text-gray-300">KYC</b> — identity verification start
                    </li>
                    <li>
                      <b className="text-gray-300">Account edit</b> — profile change (email / phone /
                      DOB)
                    </li>
                    <li>
                      <b className="text-gray-300">Gameplay</b> — bonus claim / wager events
                    </li>
                  </ul>
                </div>
                <p className="text-gray-500">
                  Changes apply within ~30 seconds — no restart needed. Grey toggles are locked while
                  the master switch is off.
                </p>
              </div>
            </details>

            {/* Master */}
            <div className="bg-[#242B35] rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-purple-400">Master</h3>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white text-sm font-semibold">SEON enabled</div>
                  <div className="text-gray-500 text-xs">Off = no SEON calls anywhere</div>
                </div>
                <Toggle checked={values.seonEnabled} onChange={(v) => set("seonEnabled", v)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white text-sm">AML screening</div>
                  <div className="text-gray-500 text-xs">Watchlist / PEP / sanctions + monitoring</div>
                </div>
                <Toggle
                  checked={values.amlEnabled}
                  disabled={!master}
                  onChange={(v) => set("amlEnabled", v)}
                />
              </div>
            </div>

            {/* Per-flow */}
            <div className="bg-[#242B35] rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-purple-400">Fraud checks per flow</h3>
              {FLOW_TOGGLES.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-white text-sm">{f.label}</div>
                    <div className="text-gray-500 text-xs">{f.hint}</div>
                  </div>
                  <Toggle
                    checked={values[f.key] as boolean}
                    disabled={!master}
                    onChange={(v) => set(f.key, v)}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                onClick={onClose}
                className="bg-[#1a2030] border border-gray-700 hover:bg-[#242B35] text-white text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
