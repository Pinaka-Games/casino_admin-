"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2, Info } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  getSeonConfig,
  updateSeonConfig,
  type SeonConfigValues,
  type SeonFailureMode,
} from "@/api/compliance/seon-config.api";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SeonConfigModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<SeonConfigValues | null>(null);
  const [defaults, setDefaults] = useState<SeonConfigValues | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSeonConfig()
      .then((res) => {
        setValues(res.effective);
        setDefaults(res.defaults);
      })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to load SEON config"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const set = <K extends keyof SeonConfigValues>(key: K, v: SeonConfigValues[K]) =>
    setValues((prev) => (prev ? { ...prev, [key]: v } : prev));

  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    try {
      // amlMonitoringCron is env-only (static @Cron reads process.env at boot); the
      // DB value is never used for scheduling, so don't persist it here.
      const { amlMonitoringCron: _cron, ...payload } = values;
      const res = await updateSeonConfig(payload);
      setValues(res.effective);
      setDefaults(res.defaults);
      toast.success("SEON config saved");
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save SEON config");
    } finally {
      setSaving(false);
    }
  };

  const NumberField = ({ k, label }: { k: keyof SeonConfigValues; label: string }) => (
    <div className="flex items-center justify-between gap-3">
      <label className="text-gray-300 text-sm">
        {label}
        {defaults && <span className="text-gray-500 text-xs ml-2">(default {String(defaults[k])})</span>}
      </label>
      <input
        type="number"
        value={values ? String(values[k] as number) : ""}
        onChange={(e) => set(k, Number(e.target.value) as SeonConfigValues[typeof k])}
        className="w-32 bg-[#15181E] border border-[#242B35] text-white text-sm rounded-lg px-3 py-2"
      />
    </div>
  );

  const TextField = ({ k, label }: { k: keyof SeonConfigValues; label: string }) => (
    <div className="flex flex-col gap-1">
      <label className="text-gray-300 text-sm">{label}</label>
      <input
        type="text"
        value={values ? String(values[k] as string) : ""}
        onChange={(e) => set(k, e.target.value as SeonConfigValues[typeof k])}
        className="w-full bg-[#15181E] border border-[#242B35] text-white text-xs rounded-lg px-3 py-2 font-mono"
      />
    </div>
  );

  const Toggle = ({ k, label }: { k: keyof SeonConfigValues; label: string }) => (
    <div className="flex items-center justify-between gap-3">
      <label className="text-gray-300 text-sm">{label}</label>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(values?.[k])}
        onClick={() => set(k, !(values?.[k] as boolean) as SeonConfigValues[typeof k])}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${values?.[k] ? "bg-purple-500" : "bg-gray-600"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${values?.[k] ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#191D24] rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-[#191D24] z-10">
          <h2 className="text-xl font-semibold text-white">SEON Configuration</h2>
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
              Admin overrides the env defaults (stored in the seon_config table). The SEON API key and
              fraud/email/phone endpoints stay in env.
            </p>

            {/* How it works */}
            <details className="rounded-lg bg-[#242B35]/60 border border-[#242B35]">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-xs font-semibold text-gray-300">
                <Info size={14} className="text-purple-400" /> What each setting means
              </summary>
              <div className="space-y-3 px-4 pb-4 text-xs leading-relaxed text-gray-400">
                <div>
                  <div className="mb-1 font-semibold text-gray-300">Fraud policy</div>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>
                      <b className="text-gray-300">Block VPN / proxy</b> — if a login/transaction
                      comes from a VPN, proxy or Tor exit, block or step-up instead of allowing.
                    </li>
                    <li>
                      <b className="text-gray-300">On SEON outage (non-auth)</b> — what to do on
                      money/KYC flows when the SEON API is down or times out.{" "}
                      <b className="text-gray-300">STEP_UP</b> = ask for OTP,{" "}
                      <b className="text-gray-300">FAIL_OPEN</b> = allow,{" "}
                      <b className="text-gray-300">FAIL_CLOSED</b> = block. (Login/register always
                      fail-open so an outage can't lock users out.)
                    </li>
                    <li>
                      <b className="text-gray-300">Device session field</b> — JSON key name for the
                      device-fingerprint payload sent to SEON. Must match the frontend SDK. Leave{" "}
                      <code>session</code> unless SEON support tells you otherwise.
                    </li>
                    <li>
                      <b className="text-gray-300">Step-up token TTL</b> — how long (seconds) an OTP
                      step-up token stays valid before the user must restart the action.
                    </li>
                  </ul>
                </div>
                <div>
                  <div className="mb-1 font-semibold text-gray-300">Endpoints (region)</div>
                  <p>
                    SEON API base URLs for your data region (default <code>us-east-1</code>). Only
                    change if SEON migrates your account to another region — a wrong value breaks AML
                    / tagging / IP lookups.
                  </p>
                </div>
                <div>
                  <div className="mb-1 font-semibold text-gray-300">AML screening thresholds</div>
                  <p>
                    Minimum transaction amount that triggers an AML (sanctions/PEP) screen. Amounts
                    below the threshold are <b className="text-gray-300">not</b> screened, saving
                    cost. Example: Deposit = 1000 → only deposits of 1000+ are screened. Set 0 to
                    screen every transaction.
                  </p>
                </div>
                <div>
                  <div className="mb-1 font-semibold text-gray-300">Ongoing AML monitoring</div>
                  <p className="mb-1">
                    Periodically re-screens already-approved KYC users against updated watchlists (a
                    person can be sanctioned after they signed up).
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>
                      <b className="text-gray-300">Monitoring enabled</b> — turn the background
                      re-screening on/off.
                    </li>
                    <li>
                      <b className="text-gray-300">Re-screen interval (days)</b> — re-check each user
                      this often.
                    </li>
                    <li>
                      <b className="text-gray-300">Batch size</b> — how many users to screen per run.
                    </li>
                    <li>
                      <b className="text-gray-300">Throttle (ms)</b> — pause between each user's
                      screen to respect SEON rate limits.
                    </li>
                    <li>
                      <b className="text-gray-300">Cron schedule</b> — when the run fires. Env-only
                      (set at boot); the field here is read-only.
                    </li>
                  </ul>
                </div>
                <p className="text-gray-500">
                  Blank a field to fall back to its built-in default (shown in grey). Changes apply
                  within ~30 seconds — no restart needed.
                </p>
              </div>
            </details>

            {/* Fraud policy */}
            <div className="bg-[#242B35] rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-purple-400">Fraud policy</h3>
              <Toggle k="blockVpn" label="Block VPN / proxy" />
              <div className="flex items-center justify-between gap-3">
                <label className="text-gray-300 text-sm">
                  On SEON outage (non-auth)
                  {defaults && <span className="text-gray-500 text-xs ml-2">(default {defaults.failureMode})</span>}
                </label>
                <select
                  value={values.failureMode}
                  onChange={(e) => set("failureMode", e.target.value as SeonFailureMode)}
                  className="bg-[#15181E] border border-[#242B35] text-white text-sm rounded-lg px-3 py-2"
                >
                  <option value="STEP_UP">STEP_UP</option>
                  <option value="FAIL_OPEN">FAIL_OPEN</option>
                  <option value="FAIL_CLOSED">FAIL_CLOSED</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-gray-300 text-sm">Device session field</label>
                <select
                  value={values.sessionField}
                  onChange={(e) => set("sessionField", e.target.value)}
                  className="bg-[#15181E] border border-[#242B35] text-white text-sm rounded-lg px-3 py-2"
                >
                  <option value="session">session</option>
                  <option value="seon_session">seon_session</option>
                </select>
              </div>
              <NumberField k="stepUpTtlSeconds" label="Step-up token TTL (seconds)" />
            </div>

            {/* Endpoints */}
            <div className="bg-[#242B35] rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-purple-400">Endpoints (region)</h3>
              <TextField k="amlUrl" label="AML API URL" />
              <TextField k="tagUrlBase" label="Tag API base URL" />
              <TextField k="ipUrl" label="IP API base URL" />
            </div>

            {/* AML thresholds */}
            <div className="bg-[#242B35] rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-purple-400">AML screening thresholds</h3>
              <NumberField k="depositAmlThreshold" label="Deposit AML threshold" />
              <NumberField k="withdrawalAmlThreshold" label="Withdrawal AML threshold" />
              <NumberField k="bonusAmlThreshold" label="Bonus AML threshold" />
              <NumberField k="winAmlThreshold" label="Win AML threshold" />
            </div>

            {/* Monitoring */}
            <div className="bg-[#242B35] rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-purple-400">Ongoing AML monitoring</h3>
              <Toggle k="amlMonitoringEnabled" label="Monitoring enabled" />
              <NumberField k="amlMonitoringIntervalDays" label="Re-screen interval (days)" />
              <NumberField k="amlMonitoringBatch" label="Batch size" />
              <NumberField k="amlMonitoringThrottleMs" label="Throttle (ms)" />
              <div className="flex flex-col gap-1">
                <label className="text-gray-300 text-sm">Cron schedule</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={values.amlMonitoringCron}
                  className="w-full bg-[#15181E] border border-[#242B35] text-gray-400 text-xs rounded-lg px-3 py-2 font-mono cursor-not-allowed"
                />
                <span className="text-gray-500 text-[11px]">
                  Env-only — set <code>SEON_AML_MONITORING_CRON</code> and restart. Not editable here
                  (the schedule is fixed at boot).
                </span>
              </div>
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
