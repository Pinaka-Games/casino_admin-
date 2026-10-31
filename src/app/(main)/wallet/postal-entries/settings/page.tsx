"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  POSTAL_CURRENCY_LABELS,
  POSTAL_FIXED_RULES,
  POSTAL_RULES_CODE_TTL_DAYS,
  PostalSettings,
  UpdatePostalSettingsDto,
  postalRequestApi,
} from "@/api/postal-request/postal-request.api";

import PostalRulesInfo from "../components/PostalRulesInfo";
import { BTN_PRIMARY, FIELD, PAGE, PANEL, TEXT_FAINT, TEXT_MUTED } from "../theme";

/** Up to 2 decimals, digits only. Blank is allowed and means 0. */
const AMOUNT_INPUT = /^\d*\.?\d{0,2}$/;

/**
 * The reward is edited as two plain amounts — Sweeps Coins and Gold Coins, blank
 * meaning none — and mapped onto the stored shape here:
 *
 *   SC > 0            → rewardCurrency wulfCash, rewardAmountFixed = SC,
 *                       rewardGoldCoinAmount = GC (0 when blank)
 *   SC blank, GC > 0  → rewardCurrency wulfCoin, rewardAmountFixed = GC
 *
 * Always FIXED: the random range is no longer offered, so saving this page
 * switches a row that was still on RANGE over to a fixed amount.
 */
const withRewards = (form: PostalSettings, sc: string, gc: string): PostalSettings => {
  const sweeps = Number(sc) || 0;
  const gold = Number(gc) || 0;
  return sweeps > 0
    ? {
        ...form,
        rewardMode: "FIXED",
        rewardCurrency: "wulfCash",
        rewardAmountFixed: sweeps,
        rewardGoldCoinAmount: gold,
      }
    : {
        ...form,
        rewardMode: "FIXED",
        rewardCurrency: "wulfCoin",
        rewardAmountFixed: gold,
        rewardGoldCoinAmount: 0,
      };
};

/** Stored settings → the two amount inputs ("" for none). */
const rewardInputs = (row: PostalSettings): { sc: string; gc: string } => {
  const text = (v: number) => (Number(v) > 0 ? String(Number(v)) : "");
  return row.rewardCurrency === "wulfCoin"
    ? { sc: "", gc: text(row.rewardAmountFixed) }
    : { sc: text(row.rewardAmountFixed), gc: text(row.rewardGoldCoinAmount) };
};

// Fixed / Random range picker hidden for now: the reward is always a fixed
// amount. Restore together with the Minimum/Maximum inputs to bring it back.
// const REWARD_MODES: Array<{ value: PostalRewardMode; label: string; hint: string }> = [
//   { value: "FIXED", label: "Fixed amount", hint: "Every accepted card pays the same." },
//   { value: "RANGE", label: "Random range", hint: "Each card pays a random amount between two values." },
// ];

const Toggle = ({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <div
    className={`flex items-start justify-between gap-4 rounded-lg border border-[#2F3743] bg-[#242B35] p-3 ${
      disabled ? "opacity-60" : ""
    }`}
  >
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      {hint && <p className={`text-xs ${TEXT_FAINT}`}>{hint}</p>}
    </div>
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className="data-[state=checked]:bg-purple-600"
    />
  </div>
);

/** A value the published rules fix, shown so the operator knows it exists. */
const FixedRule = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-[#2F3743] px-3 py-2.5">
    <span className={`flex items-center gap-2 text-sm ${TEXT_MUTED}`}>
      <Lock className="h-3.5 w-3.5" /> {label}
    </span>
    <span className="font-mono text-sm text-white">{value}</span>
  </div>
);

/** A labelled group inside a merged card. */
const Subsection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">{title}</h3>
    {children}
  </div>
);

const Divider = () => <div className="border-t border-[#242B35]" />;

/** The fields the API accepts. Everything else on the row is read-only. */
const toDto = (form: PostalSettings): UpdatePostalSettingsDto => ({
  enabled: form.enabled,
  codeTtlDays: Number(form.codeTtlDays),
  maxActiveCodesPerUser: Number(form.maxActiveCodesPerUser),
  codesPerDay: Number(form.codesPerDay),
  rewardMode: form.rewardMode,
  rewardAmountFixed: Number(form.rewardAmountFixed),
  rewardAmountMin: Number(form.rewardAmountMin),
  rewardAmountMax: Number(form.rewardAmountMax),
  rewardCurrency: form.rewardCurrency,
  rewardGoldCoinAmount: Number(form.rewardGoldCoinAmount) || 0,
  applyWagering: form.applyWagering,
  wageringMultiplier: form.wageringMultiplier ?? null,
  maxEntriesPerUserMonth: Number(form.maxEntriesPerUserMonth),
  mailingAddress: form.mailingAddress ?? "",
  declarationText: form.declarationText ?? "",
});

/**
 * The operator's knobs for the mail-in route.
 *
 * Two cards: what the route pays and whether it is open, then how codes and
 * entries are limited. What the published rules fix is shown locked, and the
 * Rules button lists everything the route enforces in one place.
 */
export default function PostalSettingsPage() {
  const [form, setForm] = useState<PostalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Kept as typed text so a blank box stays blank (= 0) instead of showing "0".
  const [scAmount, setScAmount] = useState("");
  const [gcAmount, setGcAmount] = useState("");
  // Blank = the system default multiplier.
  const [multiplier, setMultiplier] = useState("");

  const applyLoaded = (row: PostalSettings) => {
    setForm(row);
    const inputs = rewardInputs(row);
    setScAmount(inputs.sc);
    setGcAmount(inputs.gc);
    setMultiplier(row.wageringMultiplier != null ? String(Number(row.wageringMultiplier)) : "");
  };

  /** The form with the typed reward and multiplier folded in — what Save sends. */
  const effective = (f: PostalSettings): PostalSettings => ({
    ...withRewards(f, scAmount, gcAmount),
    wageringMultiplier: multiplier.trim() === "" ? null : Number(multiplier),
  });

  useEffect(() => {
    postalRequestApi
      .getSettings()
      .then((res) => applyLoaded(res.data))
      .catch((e) =>
        toast.error(e?.response?.data?.message ?? "Could not load postal settings"),
      )
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof PostalSettings>(key: K, value: PostalSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form) return;

    if (form.enabled && (!form.mailingAddress?.trim() || !form.declarationText?.trim())) {
      toast.error("A mailing address and the declaration are required before the route can be opened");
      return;
    }
    if (!Number.isInteger(Number(form.codeTtlDays)) || Number(form.codeTtlDays) < 1) {
      toast.error("Code validity must be at least 1 whole day");
      return;
    }
    if (!(Number(scAmount) > 0) && !(Number(gcAmount) > 0)) {
      toast.error("Enter a Sweeps Coins amount, a Gold Coins amount, or both");
      return;
    }
    if (
      multiplier.trim() !== "" &&
      !(Number(multiplier) >= 1 && Number(multiplier) <= 1000)
    ) {
      toast.error("The wagering multiplier must be between 1 and 1000, or left blank");
      return;
    }

    setSaving(true);
    try {
      const res = await postalRequestApi.updateSettings(toDto(effective(form)));
      applyLoaded(res.data);
      toast.success("Postal settings saved");
    } catch (e: any) {
      const message = e?.response?.data?.message;
      toast.error(
        Array.isArray(message) ? message.join(", ") : message ?? "Could not save postal settings",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    // Skeleton rather than a spinner: the layout is known before the row
    // lands, so the page should not reflow when it does.
    return (
      <div className={`${PAGE} min-h-screen space-y-6 p-4 md:p-6`}>
        <div className="h-7 w-56 animate-pulse rounded-lg bg-white/10" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, panel) => (
            <div key={panel} className={`${PANEL} space-y-3 p-4`}>
              <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
              {Array.from({ length: 5 }).map((__, row) => (
                <div key={row} className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Wagering only ever locks Sweeps Coins, so it means something only when SC is paid.
  const isSweeps = Number(scAmount) > 0;
  const ttlDiffersFromRules = Number(form.codeTtlDays) !== POSTAL_RULES_CODE_TTL_DAYS;

  return (
    <div className={`${PAGE} min-h-screen space-y-6 p-4 md:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/wallet/postal-entries">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Postal Entry Settings</h1>
            <p className={`text-sm ${TEXT_MUTED}`}>
              Rules and wording for the free mail-in route.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PostalRulesInfo settings={effective(form)} />
          <Button className={BTN_PRIMARY} onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Availability & reward ───────────────────────────────────── */}
        <div className={`${PANEL} space-y-5 p-4`}>
          <h2 className="font-medium text-white">Availability &amp; reward</h2>

          <Subsection title="Availability">
            <Toggle
              label="Postal entry route open"
              hint="Off hides the mail-in link on the coin-pack page and in the profile menu, and refuses new codes and new envelopes. Cards already posted stay processable once it is switched back on."
              checked={form.enabled}
              onChange={(v) => set("enabled", v)}
            />
          </Subsection>

          <Divider />

          <Subsection title="Reward per accepted card">
            {/* Two amounts, one per currency. Blank = 0 = that currency is not paid;
                fill both and every accepted card credits both. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-white/80">{POSTAL_CURRENCY_LABELS.wulfCash}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  className={FIELD}
                  value={scAmount}
                  placeholder="0"
                  onChange={(e) => AMOUNT_INPUT.test(e.target.value) && setScAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">{POSTAL_CURRENCY_LABELS.wulfCoin}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  className={FIELD}
                  value={gcAmount}
                  placeholder="0"
                  onChange={(e) => AMOUNT_INPUT.test(e.target.value) && setGcAmount(e.target.value)}
                />
              </div>
              <p className={`col-span-2 text-xs ${TEXT_FAINT}`}>
                Paid on every accepted card. Leave a box blank (0) to not pay that currency; fill
                both to pay both.
              </p>
            </div>

            <Toggle
              label="Apply wagering"
              hint={
                isSweeps
                  ? "Credited Sweeps Coins must be wagered before they can be redeemed. Keep this on."
                  : "Only applies to Sweeps Coins — Gold Coins are never redeemable, so there is nothing to lock."
              }
              checked={form.applyWagering}
              onChange={(v) => set("applyWagering", v)}
              disabled={!isSweeps}
            />

            {isSweeps && form.applyWagering && (
              <div className="space-y-2">
                <Label className="text-white/80">Wagering multiplier</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    className={`${FIELD} w-32`}
                    value={multiplier}
                    placeholder="Default"
                    onChange={(e) =>
                      AMOUNT_INPUT.test(e.target.value) && setMultiplier(e.target.value)
                    }
                  />
                  <span className={`text-sm ${TEXT_MUTED}`}>×</span>
                </div>
                <p className={`text-xs ${TEXT_FAINT}`}>
                  {Number(multiplier) >= 1
                    ? `The player must wager ${Math.round(Number(scAmount) * Number(multiplier) * 100) / 100} SC (${Number(scAmount) || 0} × ${Number(multiplier)}) before these Sweeps Coins can be redeemed.`
                    : "1 to 1000. Leave blank to use the system default wagering multiplier."}
                </p>
              </div>
            )}
          </Subsection>
        </div>

        {/* ── Codes & limits ──────────────────────────────────────────── */}
        <div className={`${PANEL} space-y-5 p-4`}>
          <h2 className="font-medium text-white">Codes &amp; limits</h2>

          <Subsection title="Codes">
            <FixedRule label="Format (random)" value={POSTAL_FIXED_RULES.codeFormat} />

            <div className="space-y-2">
              <Label className="text-white/80">Code valid for (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                step={1}
                className={FIELD}
                value={form.codeTtlDays}
                onChange={(e) => set("codeTtlDays", Number(e.target.value))}
              />
              <p className={`text-xs ${TEXT_FAINT}`}>
                How long a code works after the player generates it. A card whose code is older
                than this when it is opened is refused automatically. Applies to codes generated
                after you save — codes players already hold keep their date.
              </p>
              {ttlDiffersFromRules && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  The published Sweepstakes Rules say codes are valid for{" "}
                  {POSTAL_RULES_CODE_TTL_DAYS} days. Update the rules text to match before
                  saving a different value.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-white/80">Unused codes a player can hold</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  className={FIELD}
                  value={form.maxActiveCodesPerUser}
                  onChange={(e) => set("maxActiveCodesPerUser", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Codes per day</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  className={FIELD}
                  value={form.codesPerDay}
                  onChange={(e) => set("codesPerDay", Number(e.target.value))}
                />
              </div>
            </div>
            <p className={`text-xs ${TEXT_FAINT}`}>
              Single use, burned on refusal, and only valid for the account that generated it —
              all fixed by the Sweepstakes Rules.
            </p>
          </Subsection>

          <Divider />

          <Subsection title="Limits">
            <div className="space-y-2">
              <Label className="text-white/80">
                Accepted entries per player (rolling {POSTAL_FIXED_RULES.entryCapWindowDays} days)
              </Label>
              <Input
                type="number"
                min={1}
                max={1000}
                className={FIELD}
                value={form.maxEntriesPerUserMonth}
                onChange={(e) => set("maxEntriesPerUserMonth", Number(e.target.value))}
              />
              <p className={`text-xs ${TEXT_FAINT}`}>
                Shown to players on the mail-in page. A card past the cap is refused
                automatically, both when it is recorded and when it is approved.
              </p>
            </div>
          </Subsection>
        </div>

        {/* ── Player wording ───────────────────────────────────────────── */}
        <div className={`${PANEL} space-y-3 p-4 lg:col-span-2`}>
          <h2 className="font-medium text-white">What the player is told</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white/80">Mailing address</Label>
              <Textarea
                rows={4}
                maxLength={500}
                className={FIELD}
                value={form.mailingAddress ?? ""}
                placeholder={"POSTAL ENTRIES\nPO BOX 0000\nCITY, ST 00000"}
                onChange={(e) => set("mailingAddress", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Declaration the player must copy</Label>
              <Textarea
                rows={4}
                maxLength={1000}
                className={FIELD}
                value={form.declarationText ?? ""}
                onChange={(e) => set("declarationText", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
