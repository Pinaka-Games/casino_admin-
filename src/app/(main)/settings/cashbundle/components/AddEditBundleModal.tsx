"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CashBundle,
  BundleDiscountType,
  BundleDiscountDurationUnit,
} from "@/types/cashbundletypes";
import toast from "react-hot-toast";
import ImageUploader, { ImageUploaderRef } from "@/components/image-upload/ImageUploader";
import { Button } from "@/components/ui/button";
import { FreeSpinConfigSelect } from "@/components/free-spin/FreeSpinConfigSelect";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Trash2, Info, Clock, AlertTriangle } from "lucide-react";
import ConfirmModal from "@/components/free-spin/ConfirmModal";
import Image from "next/image";
import {
  CASH_BUNDLE_FALLBACK_IMAGE,
  CASH_BUNDLE_IMAGE_PRESETS,
} from "@/config/cashbundle-image-presets";
import { getSaleWindowStatus } from "@/lib/discount-window";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Mirrors computeBundlePricing() in the backend's coin-bundle.service.ts. Kept in
 * step so the admin preview shows the exact number the player will be charged —
 * the backend stays authoritative and rejects anything that reaches $0.
 */
function computeSalePrice(form: CashBundle): {
  salePrice: number;
  discount: number;
  percentOff: number | null;
} {
  const price = round2(Number(form.price) || 0);
  const value = Number(form.discountValue);
  const none = { salePrice: price, discount: 0, percentOff: null };

  if (!form.discountEnabled || !form.discountType || !(value > 0)) return none;

  const raw = form.discountType === "percentage" ? (price * value) / 100 : value;
  const discount = Math.min(round2(raw), price);
  if (discount <= 0) return none;

  return {
    salePrice: round2(price - discount),
    discount,
    percentOff: price > 0 ? Math.round((discount / price) * 100) : null,
  };
}

/**
 * Sentinel for the "no per-user expiry" choice in the Duration Unit select.
 *
 * Radix `Select` rejects an empty-string item value and offers no way to clear a
 * selection once made — so an admin who picked a unit by mistake was stuck with
 * a limited sale. Modelling "no limit" as a real option is both the fix and the
 * clearer UI: it states the intent instead of relying on an empty field.
 *
 * Never sent to the API — it maps to `discountDurationUnit: null`.
 */
const NO_DURATION_LIMIT = "__none__";

interface Props {
  open: boolean;
  initialData?: CashBundle | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CashBundle) => void | Promise<void>;
  /** Force-restart the saved sale for all users. Only used in edit mode. */
  onRestartSale?: (id: string) => Promise<void>;
  /**
   * Position a NEW bundle should take — the end of the list. Order is otherwise
   * set by dragging on the listing page, so a new bundle has to land somewhere
   * predictable rather than colliding with an existing position.
   */
  nextDisplayOrder?: number;
}

const EMPTY_FORM: CashBundle = {
  id: "",
  name: "",
  description: "",
  free: 0,
  bonusWageringMultiplier: 1,
  coins: 0,
  price: 0,
  wulfCashAmount: 0,
  discountEnabled: false,
  discountType: null,
  discountValue: null,
  discountDurationValue: null,
  discountDurationUnit: null,
  promoteOnHome: false,
  isWelcomeOffer: false,
  freeSpinConfigId: null,
  image: CASH_BUNDLE_FALLBACK_IMAGE,
  isActive: true,
  displayOrder: 1,
};

export default function AddEditBundleDialog({
  open,
  initialData,
  onOpenChange,
  onSubmit,
  onRestartSale,
  nextDisplayOrder,
}: Props) {
  const isEdit = Boolean(initialData?.id);
  const [formData, setFormData] = useState<CashBundle>(EMPTY_FORM);
  const [restarting, setRestarting] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [showDiscountHelp, setShowDiscountHelp] = useState(false);
  // Live clock for the saved sale's countdown.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const presetOptions = useMemo(
    () => Array.from(new Set(CASH_BUNDLE_IMAGE_PRESETS)),
    []
  );
  const pricing = useMemo(() => computeSalePrice(formData), [formData]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...EMPTY_FORM,
        ...initialData,
        image: initialData.image || CASH_BUNDLE_FALLBACK_IMAGE,
      });
    } else {
      // New bundle goes to the end of the list; the admin drags it from there.
      setFormData({
        ...EMPTY_FORM,
        displayOrder: nextDisplayOrder && nextDisplayOrder > 0 ? nextDisplayOrder : 1,
      });
    }
  }, [initialData, open, nextDisplayOrder]);

  // Restart only makes sense for a sale that is ALREADY SAVED. Gate on
  // initialData (the stored bundle), not the form — otherwise merely ticking
  // "enable" on a fresh bundle would show Restart, and clicking it hits the
  // backend's "enable a discount first" error (QA finding).
  //
  // Deliberately NOT gated on a time-boxed duration any more: a sale is one
  // purchase per player, so even a never-expiring discount is used up by whoever
  // buys it. Restart is the only way to hand that offer back, and hiding the
  // button on evergreen sales left admins with no way to re-run one.
  const canRestartSale =
    isEdit && !!onRestartSale && !!initialData?.discountEnabled;

  // Countdown reflects the SAVED sale (initialData), not unsaved form edits —
  // editing restarts the clock on save, so the live number must track what is
  // actually running, not a preview.
  const savedSale = initialData
    ? getSaleWindowStatus(initialData, now)
    : { timeBoxed: false, end: null, timeLeft: null, expired: false, perUser: false };

  // Confirmed in the app's own dialog rather than `window.confirm`, which
  // paints the browser's white "localhost says" box over a dark admin and
  // cannot show the action running.
  const handleRestartSale = async () => {
    if (!canRestartSale || !initialData?.id) return;
    try {
      setRestarting(true);
      await onRestartSale!(initialData.id);
      setConfirmRestart(false);
    } catch {
      // Error toast is handled by the store.
    } finally {
      setRestarting(false);
    }
  };

  const handleSubmit = async () => {
    // ✅ Validate required fields
    if (!formData.name || !formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Description is marked required (asterisk) — enforce it so the field's
    // promise matches behaviour (QA finding: it could be saved empty).
    if (!formData.description || !formData.description.trim()) {
      toast.error("Description is required");
      return;
    }

    // Wulf Coins has no upper bound — an admin can size a bundle however they
    // like. The input itself stops at what numeric(18,2) can hold. 0 is allowed:
    // a bundle may grant cash only.
    if (formData.coins < 0) {
      toast.error("Wulf Coins cannot be negative");
      return;
    }

    if (!formData.price || formData.price <= 0) {
      toast.error("Price must be a positive number");
      return;
    }
    if (formData.price > 999999.99) {
      toast.error("Price cannot exceed 999,999.99");
      return;
    }

    // 0 is a legitimate setting — a coins-only bundle grants no Wulf Cash.
    if (formData.wulfCashAmount < 0) {
      toast.error("Wulf Cash cannot be negative");
      return;
    }

    // Coins and cash are each optional, but a bundle that grants neither takes
    // money and hands back nothing.
    if (formData.coins <= 0 && formData.wulfCashAmount <= 0) {
      toast.error("Set Wulf Coins or Wulf Cash — a bundle must grant at least one");
      return;
    }
    // Above 9,999 is flagged, never blocked — a large grant is a business
    // decision, so the admin gets a heads-up and the save goes through.
    if (formData.wulfCashAmount > 9999) {
      toast(
        `Heads up: this bundle grants ${formData.wulfCashAmount.toLocaleString()} Wulf Cash.`,
        { icon: "⚠️" },
      );
    }

    // No displayOrder validation any more: the admin cannot type it, so a
    // failure here would be unfixable from this form. Position is set by
    // dragging on the listing page and defaulted below for new bundles.

    if (formData.free < 0) {
      toast.error("Bonus Wulf Cash cannot be negative");
      return;
    }
    // Same treatment as Wulf Cash: flagged above 9,999, never blocked.
    if (formData.free > 9999) {
      toast(
        `Heads up: this bundle grants ${formData.free.toLocaleString()} Bonus Wulf Cash.`,
        { icon: "⚠️" },
      );
    }

    if (formData.bonusWageringMultiplier < 1) {
      toast.error("Bonus Wagering Multiplier must be at least 1");
      return;
    }

    if (formData.discountEnabled) {
      if (!formData.discountType) {
        toast.error("Select a discount type");
        return;
      }
      if (!formData.discountValue || formData.discountValue <= 0) {
        toast.error("Discount value must be a positive number");
        return;
      }
      if (formData.discountType === "percentage" && formData.discountValue >= 100) {
        toast.error("Percentage discount must be less than 100%");
        return;
      }
      // A $0 charge is not something a card processor will take, so a sale that
      // wipes out the price has to be caught before it can reach a player.
      if (computeSalePrice(formData).salePrice <= 0) {
        toast.error("Discount is too large — the sale price must stay above $0");
        return;
      }
      // The per-user window is optional, but a value without a unit (or a unit
      // without a value) is a half-configured window the backend will reject.
      const hasDurationValue = Number(formData.discountDurationValue) > 0;
      const hasDurationUnit = Boolean(formData.discountDurationUnit);
      if (hasDurationValue !== hasDurationUnit) {
        toast.error(
          "Set both a discount duration and unit, or leave both empty for a sale that never expires",
        );
        return;
      }
    }

    try {
      // ✅ IMPORTANT:
      // - on edit: keep same id
      // - on add: id will be generated in Page.tsx (or here if you want)
      const payload: CashBundle = isEdit
        ? { ...formData, id: initialData!.id }
        : { ...formData };

      await onSubmit(payload);

      // ✅ Only close modal if onSubmit succeeds
      // Success message is already shown in the store
      onOpenChange(false);
    } catch (error) {
      // Error is already handled by the store with toast.error
      // Modal stays open so user can fix the data
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Width matches the bonus-listing upsert modal so both settings dialogs read as one system.
          Must be sm:-prefixed — DialogContent's base ends in `sm:max-w-lg`, and tailwind-merge only
          replaces a class at the same variant, so an unprefixed `max-w-6xl` would lose to it. */}
      <DialogContent className="p-0 bg-transparent border-none sm:max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="bg-linear-to-b from-[#1B1F27] to-[#141820] rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
          <h2 className="text-white text-xl font-semibold mb-4">
            {isEdit ? "Edit Bundle" : "Add New Bundle"}
          </h2>

          {/* Two columns on md+, single column on mobile. Pairs are ordered so
              Price sits beside the Wulf Cash it drives, and the bonus amount
              beside the multiplier that applies to it. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <Field
              label="Name"
              type="text"
              required
              value={formData.name}
              onChange={(v) => setFormData((p) => ({ ...p, name: v }))}
            />

            <Field
              label="Description"
              type="text"
              required
              value={formData.description ?? ""}
              onChange={(v) => setFormData((p) => ({ ...p, description: v }))}
            />

            {/* No business cap on coin volume — the only bound is what the
                column stores (numeric(18,2) → 16 digits before the decimal). */}
            <NumberField
              label="Wulf Coins"
              value={formData.coins}
              onChange={(v) => setFormData((p) => ({ ...p, coins: v }))}
              allowDecimal
              isAmount
              maxIntDigits={16}
              showMaxHint={false}
            />

            {/* "Display Order" used to be a number field here. Position is now
                set by dragging the cards on the listing page, which is both the
                requested behaviour and the only one that stays consistent: a
                manual value could duplicate or skip positions that a later drag
                would then silently renumber. The value still travels in the
                payload — preserved on edit, appended to the end on create. */}

            <NumberField
              label="Price"
              required
              value={formData.price}
              onChange={(v) => setFormData((p) => ({ ...p, price: v }))}
              allowDecimal
              isAmount
              hint="List price, before any discount."
            />

            {/* Wulf Cash granted — independent of price. Defaults to mirroring
                price, but the admin can set any amount (e.g. a $30 bundle granting
                50 Wulf Cash), including 0 for a coins-only bundle. Like the old
                rate, it is issued in full on sale — a discount lowers the cash
                collected, not what is issued. */}
            <NumberField
              label="Wulf Cash"
              value={formData.wulfCashAmount}
              onChange={(v) => setFormData((p) => ({ ...p, wulfCashAmount: v }))}
              allowDecimal
              isAmount
              maxIntDigits={8}
              showMaxHint={false}
              warnAbove={9999}
              warnText="Unusually large grant — over 9,999 Wulf Cash. Saving is still allowed."
              hint={
                pricing.discount > 0
                  ? `Granted to the player, independent of price — issued in full. The $${pricing.discount.toFixed(2)} discount is promotional spend.`
                  : "Granted to the player. Optional — leave at 0 for a coins-only bundle."
              }
            />

            <NumberField
              label="Bonus Wulf Cash"
              value={formData.free}
              onChange={(v) => setFormData((p) => ({ ...p, free: v }))}
              allowDecimal
              isAmount
              maxIntDigits={16}
              showMaxHint={false}
              warnAbove={9999}
              warnText="Unusually large bonus — over 9,999 Bonus Wulf Cash. Saving is still allowed."
              hint="Extra bonus on top. Locked until its wagering is met."
            />

            <NumberField
              label="Bonus Wagering Multiplier"
              value={formData.bonusWageringMultiplier}
              onChange={(v) =>
                setFormData((p) => ({ ...p, bonusWageringMultiplier: v }))
              }
              allowDecimal
              hint="e.g. 20 = player must wager 20x the bonus. 1 = no extra wagering."
            />

            {/* ===== DISCOUNT / SALE ===== */}
            <div className="md:col-span-2 rounded-md bg-[#1F2630] p-4">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer w-fit">
                  <Checkbox
                    className="border-gray-500 data-[state=checked]:!bg-[lab(36_55.06_-52.92)] data-[state=checked]:!border-[lab(36_55.06_-52.92)] data-[state=checked]:!text-white focus-visible:ring-2 focus-visible:ring-[lab(36_55.06_-52.92)]/100"
                    checked={formData.discountEnabled}
                    onCheckedChange={(checked) =>
                      setFormData((p) => ({
                        ...p,
                        discountEnabled: checked === true,
                        // Default to percentage on first enable so the type select
                        // is never left empty; existing terms survive a toggle off
                        // and back on.
                        discountType:
                          checked === true ? p.discountType ?? "percentage" : p.discountType,
                      }))
                    }
                  />
                  Run a discount on this package
                </label>
                <button
                  type="button"
                  onClick={() => setShowDiscountHelp((v) => !v)}
                  aria-label="How discounts work"
                  title="How discounts work"
                  className="text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <Info size={16} />
                </button>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                Players see a corner badge and the list price struck through.
              </p>

              {showDiscountHelp && (
                <div className="mt-3 rounded-md border border-purple-500/30 bg-[#1A2029] p-4 text-xs leading-relaxed text-gray-300 space-y-2">
                  <p className="text-white font-semibold text-sm">How a discount works</p>
                  <p>
                    <span className="text-white font-medium">Discount Type</span> — Percentage (% off the list
                    price) or Fixed ($ off the list price).
                  </p>
                  <p>
                    <span className="text-white font-medium">Discount value</span> — the size of the cut. The
                    player pays <span className="text-white">list price − discount</span>; they still receive
                    the full Wulf Coins, Wulf Cash and bonus. The gap is booked as promotional spend.
                  </p>
                  <p>
                    <span className="text-white font-medium">Discount Duration + Unit</span> — how long the
                    sale runs. Leave the duration 0 / empty for a sale that never expires.
                  </p>
                  <div>
                    <p className="text-white font-medium">
                      Normal bundle — one clock for everybody:
                    </p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>The clock starts when you launch the sale and runs once.</li>
                      <li>
                        When it hits zero the bundle <span className="text-white">disappears from the
                        store</span> — it does not go back to full price.
                      </li>
                      <li>
                        Hidden from <span className="text-white">everyone</span>, including players who
                        register after it ended. A 1-hour sale is over one hour later, full stop. Use
                        Restart sale to run it again.
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      Welcome Offer — one clock per player:
                    </p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        Marked as a Welcome Offer, the duration becomes a joining gift instead of a campaign.
                      </li>
                      <li>
                        Each new player gets the <span className="text-white">full duration from their own
                        signup</span> — set 7 days and someone registering in September still gets 7 days.
                      </li>
                      <li>
                        Players already registered when you launched it count from the launch, and the bundle
                        disappears for them when their 7 days are up.
                      </li>
                    </ul>
                  </div>
                  <p>
                    <span className="text-white font-medium">One purchase per player</span> — the sale is used
                    up the moment a player buys this bundle at the discounted price. The bundle then
                    disappears from that player&apos;s store entirely (not just the badge), even if time was
                    left on their window. Everyone else is unaffected. Restart the sale to put it back for
                    them.
                  </p>
                  <p>
                    <span className="text-white font-medium">Editing a live sale</span> — changing any discount
                    setting and saving restarts the window from now (a fresh full duration, not extra days).
                  </p>
                  <p>
                    <span className="text-white font-medium">Restart sale</span> (button below) — re-runs the
                    sale from now <span className="text-white">without changing terms</span>. Use it after the
                    window has expired, or to re-offer the sale to players who already bought it.
                  </p>
                  <p>
                    <span className="text-white font-medium">Promote in login pop-up</span> — advertises this
                    sale once per login.
                  </p>
                </div>
              )}

              {/* Saved sale countdown. A normal bundle has one shared window, so
                  the badge speaks for everyone; the welcome offer's badge covers
                  only the players who were already registered at launch. */}
              {isEdit && savedSale.timeBoxed && savedSale.end && (
                <div className="mt-3">
                  {savedSale.expired ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-400">
                      <AlertTriangle size={13} />
                      {savedSale.perUser
                        ? "Expired — hidden for players registered at launch; new signups still get their own window"
                        : "Expired — bundle hidden from every player; restart to bring it back"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBC409]/10 border border-[#FBC409]/30 px-3 py-1 text-xs font-semibold text-[#FBC409]">
                      <Clock size={13} />
                      {savedSale.perUser
                        ? `Ends for players registered at launch in ${savedSale.timeLeft}`
                        : `Sale ends for everyone in ${savedSale.timeLeft}`}
                    </span>
                  )}
                </div>
              )}

              {formData.discountEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-4">
                  <div>
                    <label className="block text-white text-sm mb-1">
                      Discount Type
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <Select
                      value={formData.discountType ?? "percentage"}
                      onValueChange={(v) =>
                        setFormData((p) => ({
                          ...p,
                          discountType: v as BundleDiscountType,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                        <SelectValue placeholder="Select discount type" />
                      </SelectTrigger>
                      <SelectContent className="w-full">
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="flat">Fixed amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <NumberField
                    label={
                      formData.discountType === "flat"
                        ? "Discount Amount ($)"
                        : "Discount Percentage (%)"
                    }
                    required
                    value={formData.discountValue ?? 0}
                    onChange={(v) => setFormData((p) => ({ ...p, discountValue: v }))}
                    allowDecimal
                    isAmount={formData.discountType === "flat"}
                    hint={
                      formData.discountType === "flat"
                        ? "e.g. 15 = $15 off the list price."
                        : "e.g. 50 = half off the list price."
                    }
                  />

                  {/* ===== PER-USER DISCOUNT WINDOW ===== */}
                  <NumberField
                    label="Discount Duration"
                    value={formData.discountDurationValue ?? 0}
                    onChange={(v) =>
                      setFormData((p) => ({
                        ...p,
                        discountDurationValue: v > 0 ? v : null,
                        // Dropping the value to 0 means "no limit", so clear the
                        // unit with it — a unit without a value is the
                        // half-configured state the backend rejects.
                        discountDurationUnit: v > 0 ? p.discountDurationUnit : null,
                      }))
                    }
                    hint="How long the sale lasts per user. Leave 0 (or pick No limit) for a sale that never expires."
                    // A limitless sale is expressed by the unit, so the number
                    // is meaningless and confusing while that is selected.
                    disabled={formData.discountDurationUnit === null}
                  />

                  <div>
                    <label className="block text-white text-sm mb-1">
                      Duration Unit
                    </label>
                    <Select
                      // Radix has no concept of "no selection" once a value is
                      // set — there is no keystroke or click that clears it. So
                      // "no limit" is an explicit CHOICE rather than the absence
                      // of one, which is also clearer to read back later.
                      value={formData.discountDurationUnit ?? NO_DURATION_LIMIT}
                      onValueChange={(v) =>
                        setFormData((p) => ({
                          ...p,
                          discountDurationUnit:
                            v === NO_DURATION_LIMIT
                              ? null
                              : (v as BundleDiscountDurationUnit),
                          // Both fields move together: the backend rejects one
                          // without the other, and the save-time check enforces
                          // the same rule.
                          discountDurationValue:
                            v === NO_DURATION_LIMIT ? null : p.discountDurationValue,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent className="w-full">
                        <SelectItem value={NO_DURATION_LIMIT}>
                          No limit — never expires
                        </SelectItem>
                        <SelectItem value="minute">Minute(s)</SelectItem>
                        <SelectItem value="hour">Hour(s)</SelectItem>
                        <SelectItem value="day">Day(s)</SelectItem>
                        <SelectItem value="week">Week(s)</SelectItem>
                        <SelectItem value="month">Month(s)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-gray-500 text-xs mt-1">
                      {formData.discountDurationUnit === null
                        ? "The sale runs until you switch it off — no per-user expiry."
                        : "Clock starts per user at signup (or at sale launch for existing users). New users always get a fresh window."}
                    </p>
                  </div>

                  {/* What the player will actually see and be charged. Computed
                      with the same rules as the backend so admin never has to
                      save-and-check to find out. */}
                  <div className="md:col-span-2 rounded-md bg-[#252B35] px-4 py-3">
                    {pricing.discount > 0 ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="rounded bg-purple-500 px-2 py-0.5 text-xs font-bold text-white">
                          {formData.discountType === "flat"
                            ? `$${pricing.discount.toFixed(2)} OFF`
                            : `${pricing.percentOff}% OFF`}
                        </span>
                        <span className="text-gray-500 line-through text-sm">
                          ${round2(formData.price).toFixed(2)}
                        </span>
                        <span className="text-white font-semibold">
                          ${pricing.salePrice.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-xs">
                          Player pays ${pricing.salePrice.toFixed(2)} and still gets{" "}
                          {Number(formData.coins || 0).toLocaleString()} Wulf Coins
                          {" + "}
                          {round2(formData.wulfCashAmount).toFixed(2)} Wulf Cash
                          {formData.free > 0
                            ? ` + ${Number(formData.free).toFixed(2)} bonus`
                            : ""}
                          . ${pricing.discount.toFixed(2)} is promotional spend, reported
                          under Bundle Bonus.
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">
                        Enter a discount value to preview the sale price.
                      </span>
                    )}
                  </div>

                  {/* Nested inside the discount block on purpose: there is nothing
                      to advertise without a live sale, and mapUiToApiBody forces
                      this off when the discount is off. */}
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-white cursor-pointer w-fit">
                      <Checkbox
                        className="border-gray-500 data-[state=checked]:!bg-[lab(36_55.06_-52.92)] data-[state=checked]:!border-[lab(36_55.06_-52.92)] data-[state=checked]:!text-white focus-visible:ring-2 focus-visible:ring-[lab(36_55.06_-52.92)]/100"
                        checked={formData.promoteOnHome}
                        onCheckedChange={(checked) =>
                          setFormData((p) => ({ ...p, promoteOnHome: checked === true }))
                        }
                      />
                      Promote this sale in the login pop-up
                    </label>
                    <p className="text-gray-400 text-xs mt-1">
                      Players see it once per login. Tick it on several bundles to
                      show them together.
                    </p>
                  </div>

                  {/* RESTART SALE — force a fresh per-user window from now. Only
                      for a saved, time-boxed sale: evergreen sales never expire, so
                      there is nothing to restart. */}
                  {canRestartSale && (
                    <div className="md:col-span-2 rounded-md border border-[#3A2E1A] bg-[#241E12] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="max-w-xl">
                          <p className="text-white text-sm font-medium">
                            Restart this sale for all users
                          </p>
                          <p className="text-gray-400 text-xs mt-1">
                            Starts every user&apos;s window over from now — use it to
                            re-run a sale that has already expired for existing users,
                            or to un-hide this bundle for players who already bought it
                            on sale (it is one purchase per player, and it disappears
                            from their store once taken).
                            Acts on the saved terms, so save any edits first. New
                            users always get a fresh window from signup.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmRestart(true)}
                          disabled={restarting}
                          className="shrink-0 px-4 py-2 rounded-lg bg-[#B8860B] hover:bg-[#a6790a] disabled:opacity-50 text-white text-sm font-semibold"
                        >
                          {restarting ? "Restarting…" : "Restart sale"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FREE SPINS — optional add-on, same template wiring the
                subscription plans and VIP tiers use. Kept out of the discount
                card because it applies to every purchase of this bundle, sale
                or not. */}
            {/* WELCOME OFFER — deliberately outside the discount card above: a
                welcome offer does not need a sale to exist. */}
            <div className="md:col-span-2 rounded-md bg-[#1F2630] p-4">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer w-fit">
                <Checkbox
                  className="border-gray-500 data-[state=checked]:!bg-[lab(36_55.06_-52.92)] data-[state=checked]:!border-[lab(36_55.06_-52.92)] data-[state=checked]:!text-white focus-visible:ring-2 focus-visible:ring-[lab(36_55.06_-52.92)]/100"
                  checked={formData.isWelcomeOffer}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, isWelcomeOffer: checked === true }))
                  }
                />
                Make this the Welcome Offer
              </label>
              <p className="text-gray-400 text-xs mt-1">
                Players see this bundle on its own, in a dedicated welcome pop-up
                design, instead of alongside other packages. Only one bundle can be
                the Welcome Offer — ticking this clears it from whichever bundle
                holds it now. Works with or without a discount; when a discount is
                running, the pop-up also shows the % badge and the struck-through
                price.
              </p>
            </div>

            <div className="md:col-span-2">
              <Label className="text-white text-sm mb-1 block">
                Free Spins on Purchase{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <FreeSpinConfigSelect
                value={formData.freeSpinConfigId}
                onChange={(freeSpinConfigId: string | null) =>
                  setFormData((p) => ({ ...p, freeSpinConfigId }))
                }
                triggerClassName="w-full h-10 bg-[#1F2630] border border-gray-700 text-white text-sm"
                placeholder="No free spins"
                // The template stays listed even though buying this bundle now
                // counts as a wiring, so an admin editing the bundle can still
                // see (and keep) the one already attached.
                includeIds={
                  initialData?.freeSpinConfigId ? [initialData.freeSpinConfigId] : undefined
                }
              />
              <p className="text-gray-400 text-xs mt-1">
                Granted every time a player buys this bundle. Leave as
                &quot;No free spins&quot; to keep this a coins-only bundle.
              </p>
            </div>

            {/* IMAGE UPLOAD */}
            <div className="md:col-span-2">
              <Label className="text-white text-sm mb-1 block">Bundle Image</Label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between bg-[#1F2630] p-3 rounded-md min-h-[100px]">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 bg-[#252B35] rounded overflow-hidden flex items-center justify-center">
                      <Image
                        src={formData.image || CASH_BUNDLE_FALLBACK_IMAGE}
                        alt="Bundle preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="text-sm">
                      <p className="text-white font-medium">
                        {presetOptions.includes(formData.image || "")
                          ? "Preset Image"
                          : "Custom Upload"}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {presetOptions.includes(formData.image || "")
                          ? "Using selected preset image"
                          : "Using your uploaded image"}
                      </p>
                    </div>
                  </div>

                  {!presetOptions.includes(formData.image || "") && (
                    <Trash2
                      className="cursor-pointer text-gray-400 hover:text-red-400 transition-colors"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          image: CASH_BUNDLE_FALLBACK_IMAGE,
                        }))
                      }
                    />
                  )}
                </div>

                <div>
                  <Label className="text-white text-xs mb-2 block">Select Preset Image</Label>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {presetOptions.map((presetUrl, index) => {
                      const isSelected = (formData.image || CASH_BUNDLE_FALLBACK_IMAGE) === presetUrl;
                      return (
                        <button
                          key={presetUrl}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              image: presetUrl,
                            }))
                          }
                          className={`relative h-24 md:h-28 rounded-lg overflow-hidden border bg-[#252B35] transition-colors ${isSelected
                              ? "border-purple-500 ring-1 ring-purple-500/40"
                              : "border-gray-700 hover:border-gray-500"
                            }`}
                          aria-label={`Select preset image ${index + 1}`}
                        >
                          <Image
                            src={presetUrl}
                            alt={`Preset ${index + 1}`}
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="gap-2 h-10 w-full md:w-auto md:self-start md:px-6 bg-[#252B35] border-gray-700 hover:bg-[#2A2F38] text-white"
                  onClick={() => {
                    uploaderRef.current?.open();
                  }}
                >
                  <Upload size={14} /> Upload Custom Image
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => onOpenChange(false)}
              className="px-6 py-2 rounded-xl bg-[#2A2F38] text-white hover:bg-[#343A45]"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              className="px-6 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-medium"
            >
              {isEdit ? "Update" : "Add"}
            </button>
          </div>

          {/* IMAGE UPLOADER */}
          <ImageUploader
            ref={uploaderRef}
            aspect={1}
            folder="cash-bundles"
            onUploadComplete={(url) => {
              setFormData((p) => ({ ...p, image: url }));
            }}
          />
        </div>

        <ConfirmModal
          open={confirmRestart}
          title="Restart this sale?"
          message={
            <>
              <p>
                The window starts over from now: an expired sale becomes visible
                again, and players who already bought this bundle on sale — for
                whom it is currently hidden — get it back in their store.
              </p>
              <p className="mt-2">
                On a Welcome Offer this resets the launch-group clock; new
                signups keep getting their own window either way.
              </p>
              <p className="mt-2 text-amber-300">
                Uses the currently saved terms, so save any edits first.
              </p>
            </>
          }
          confirmLabel="Restart sale"
          busy={restarting}
          onConfirm={handleRestartSale}
          onCancel={() => !restarting && setConfirmRestart(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-white text-sm mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full h-[32px] rounded-sm bg-[#252B35] px-4 text-white outline-none focus:ring-1 focus:ring-purple-500"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  required = false,
  allowDecimal = false,
  isAmount = false,
  maxIntDigits = 6,
  showMaxHint = true,
  warnAbove,
  warnText,
  hint,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
  allowDecimal?: boolean;
  isAmount?: boolean;
  /** Digits allowed before the decimal point. Bounded by the DB column, not by policy. */
  maxIntDigits?: number;
  showMaxHint?: boolean;
  /** Above this the field flags the amount but still lets it through — advisory, not a limit. */
  warnAbove?: number;
  warnText?: string;
  hint?: string;
  /** Greys out and blocks input when the value is meaningless in the current state. */
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState<string>("");

  // Sync inputValue with value prop when it changes externally
  useEffect(() => {
    setInputValue(value === 0 ? "" : value.toString());
  }, [value]);

  const handleChange = (newValue: string) => {
    // Allow empty string
    if (newValue === "") {
      setInputValue("");
      onChange(0);
      return;
    }

    if (isAmount) {
      // Digits before the decimal are capped by what the column can store
      // (maxIntDigits), not by a business rule; 2 decimal places throughout.
      if (new RegExp(`^\\d{0,${maxIntDigits}}(\\.\\d{0,2})?$`).test(newValue)) {
        setInputValue(newValue);
        const numValue = parseFloat(newValue);
        if (!isNaN(numValue)) {
          onChange(numValue);
        }
      }
      return;
    }

    if (allowDecimal) {
      // Allow numbers with decimal point (e.g., "3.", "3.14")
      if (/^\d*\.?\d*$/.test(newValue)) {
        setInputValue(newValue);
        const numValue = parseFloat(newValue);
        // Only update if it's a valid number (not just a trailing dot)
        if (!isNaN(numValue)) {
          onChange(numValue);
        }
      }
    } else {
      // Only allow whole numbers
      if (/^\d*$/.test(newValue)) {
        setInputValue(newValue);
        const numValue = parseInt(newValue, 10);
        onChange(isNaN(numValue) ? 0 : numValue);
      }
    }
  };

  const handleBlur = () => {
    // Clean up trailing dots on blur
    if ((allowDecimal || isAmount) && inputValue.endsWith(".")) {
      const cleaned = inputValue.slice(0, -1);
      setInputValue(cleaned);
      const numValue = parseFloat(cleaned);
      onChange(isNaN(numValue) ? 0 : numValue);
    }
  };

  return (
    <div>
      <label className="block text-white text-sm mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        inputMode={(allowDecimal || isAmount) ? "decimal" : "numeric"}
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        required={required && !disabled}
        disabled={disabled}
        placeholder={disabled ? "—" : "0"}
        className="w-full h-[32px] rounded-sm bg-[#252B35] px-4 text-white outline-none focus:ring-1 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {isAmount && showMaxHint && (
        <p className="text-gray-500 text-xs mt-1">
          Max: {(10 ** maxIntDigits - 0.01).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      )}
      {/* Advisory only — the value is still accepted and saved. */}
      {warnAbove !== undefined && value > warnAbove && warnText && (
        <p className="text-amber-400 text-xs mt-1">⚠ {warnText}</p>
      )}
      {hint && <p className="text-gray-500 text-xs mt-1">{hint}</p>}
    </div>
  );
}
