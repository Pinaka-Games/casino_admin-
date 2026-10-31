"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import { profileApi } from "@/api/users/users";
import { UserWithProfile } from "@/types/profile.type";
import {
  manualDepositApi,
  MANUAL_DEPOSIT_TAG_LABELS,
  type ManualDepositTag,
} from "@/api/manual-deposit/manual-deposit.api";
import { subscriptionChangeApi } from "@/api/subscription-change/subscription-change.api";
import {
  adminListPlans,
  adminGetUserSubscription,
} from "@/api/subscription/admin-subscription.api";
import type { SubscriptionPlan } from "@/types/subscription.types";
import { cashBundleApi } from "@/api/cashbundle/cashbundle.api";
import { balanceAdjustmentApi } from "@/api/wallet/balance-adjustment.api";
import type { ApiBundleResponse } from "@/types/cashbundletypes";
import { cn } from "@/lib/utils";

const handleAmountChange = (
  value: string,
  setter: React.Dispatch<React.SetStateAction<string>>,
) => {
  if (value === "") { setter(""); return; }
  // Allow only positive numbers with up to 2 decimal places. There is no upper
  // bound: admins credit arbitrarily large amounts and the column is decimal(18,2).
  if (!/^\d*\.?\d{0,2}$/.test(value)) return;
  setter(value);
};

export default function WalletManualDeposit() {
  // Was "topup" — Topup/Topout options are commented out below.
  const [option, setOption] = useState("cash_bundle");
  const [wulfCashAmount, setWulfCashAmount] = useState("");
  const [wulfCoinAmount, setWulfCoinAmount] = useState("");
  const [notes, setNotes] = useState("");
  // Reporting label only — it does not change how the credit is applied.
  const [tag, setTag] = useState<ManualDepositTag | "">("");
  // Only sent (and only asked for) when the tag is "other".
  const [tagDetail, setTagDetail] = useState("");
  const [applyWagering, setApplyWagering] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [bundles, setBundles] = useState<ApiBundleResponse[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  // Subscription-change state
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSub, setCurrentSub] = useState<any | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const isSubscription = option === "subscription_change";
  const isBundleRecovery = option === "cash_bundle";
  // Top Out = the reverse of Topup: takes the amounts OFF the player. Raised as
  // a pending debit and approved on the Manual Deposit Listing.
  const isTopout = option === "topout";
  const currentPlanId: string | null =
    currentSub?.planId ?? currentSub?.plan?.id ?? null;

  // User search state
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserWithProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced user search
  useEffect(() => {
    if (!userSearch.trim() || selectedUser) {
      setUserResults([]);
      setDropdownOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await profileApi.getAllUsers({
          search: userSearch,
          limit: 10,
          page: 1,
        });
        setUserResults(res.data.data);
        setDropdownOpen(true);
      } catch {
        // ignore search errors
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [userSearch, selectedUser]);

  // Load plans once when the subscription option is chosen
  useEffect(() => {
    if (!isSubscription || plans.length) return;
    adminListPlans()
      .then((p) => setPlans(p || []))
      .catch(() => toast.error("Failed to load subscription plans"));
  }, [isSubscription, plans.length]);

  useEffect(() => {
    if (!isBundleRecovery || bundles.length) return;
    setLoadingBundles(true);
    cashBundleApi
      .getAll()
      .then((items) => setBundles(items.filter((bundle) => bundle.isActive)))
      .catch(() => toast.error("Failed to load active cash bundles"))
      .finally(() => setLoadingBundles(false));
  }, [isBundleRecovery, bundles.length]);

  // Load the selected user's current subscription
  useEffect(() => {
    if (!isSubscription || !selectedUser) {
      setCurrentSub(null);
      return;
    }
    setLoadingSub(true);
    setSelectedPlanId("");
    adminGetUserSubscription(selectedUser.id)
      .then((s) => setCurrentSub(s))
      .catch(() => setCurrentSub(null))
      .finally(() => setLoadingSub(false));
  }, [isSubscription, selectedUser]);

  const handleSubmitSubscription = async () => {
    if (!selectedUser) {
      toast.error("Please select a user");
      return;
    }
    if (!selectedPlanId) {
      toast.error("Please select a plan");
      return;
    }
    setSubmitting(true);
    try {
      await subscriptionChangeApi.create({
        userId: selectedUser.id,
        toPlanId: selectedPlanId,
        notes: notes.trim() || undefined,
      });
      toast.success("Subscription change request created (pending approval)");
      setSelectedPlanId("");
      setNotes("");
      setSelectedUser(null);
      setUserSearch("");
      setCurrentSub(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectUser = (user: UserWithProfile) => {
    setSelectedUser(user);
    setUserSearch(user.username || user.profile?.email || user.id);
    setDropdownOpen(false);
    setUserResults([]);
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setUserSearch("");
  };

  const getBalanceOf = (field: "wulfCash" | "wulfCoin") => {
    if (!selectedUser) return "";
    const u = selectedUser as any;
    const v = u[field] ?? selectedUser.wallet?.[field as keyof typeof selectedUser.wallet];
    return v != null ? Number(v).toFixed(2) : "";
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      toast.error("Please select a user");
      return;
    }

    if (isBundleRecovery) {
      if (!selectedBundleId) {
        toast.error("Please select the paid cash bundle");
        return;
      }
      if (!paymentReference.trim()) {
        toast.error("Enter the payment-provider reference");
        return;
      }

      setSubmitting(true);
      try {
        await manualDepositApi.recoverBundlePayment({
          userId: selectedUser.id,
          bundleId: selectedBundleId,
          externalPaymentReferenceId: paymentReference.trim(),
        });
        toast.success("Bundle payment recovered and credited");
        setSelectedBundleId("");
        setPaymentReference("");
        setNotes("");
        setSelectedUser(null);
        setUserSearch("");
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? "Failed to recover bundle payment");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const cashAmt = parseFloat(wulfCashAmount);
    const coinAmt = parseFloat(wulfCoinAmount);
    const hasCash = !!wulfCashAmount && !isNaN(cashAmt) && cashAmt > 0;
    const hasCoin = !!wulfCoinAmount && !isNaN(coinAmt) && coinAmt > 0;
    if (!hasCash && !hasCoin) {
      toast.error("Enter a Wulf Cash amount, a Wulf Coin amount, or both");
      return;
    }

    if (isTopout) {
      // Checked again by the API against the live wallet — this only saves a
      // round trip for the obvious case.
      const cashBal = Number(getBalanceOf("wulfCash") || 0);
      const coinBal = Number(getBalanceOf("wulfCoin") || 0);
      if ((hasCash && cashAmt > cashBal) || (hasCoin && coinAmt > coinBal)) {
        toast.error("Top out cannot be more than the player's current balance");
        return;
      }
      setSubmitting(true);
      try {
        await balanceAdjustmentApi.topout({
          userId: selectedUser.id,
          ...(hasCash ? { wulfCash: cashAmt } : {}),
          ...(hasCoin ? { wulfCoin: coinAmt } : {}),
          reason: notes.trim() || undefined,
        });
        toast.success("Top out request created (pending approval)");
        setWulfCashAmount("");
        setWulfCoinAmount("");
        setNotes("");
        setSelectedUser(null);
        setUserSearch("");
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? "Failed to create top out");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (tag === "other" && !tagDetail.trim()) {
      toast.error("Describe the tag when \"Other\" is selected");
      return;
    }
    setSubmitting(true);
    try {
      // pairId only groups two deposits submitted together. A single-currency
      // deposit must stay unpaired, otherwise the listing renders it as half of
      // a pair with a missing counterpart.
      const pairId = hasCash && hasCoin ? crypto.randomUUID() : undefined;
      const tagDetailValue =
        tag === "other" ? tagDetail.trim() || undefined : undefined;
      const requests = [];
      if (hasCash) {
        requests.push(
          manualDepositApi.create({
            userId: selectedUser.id,
            amount: cashAmt,
            currency: "wulfCash",
            notes: notes.trim() || undefined,
            tag: tag || undefined,
            tagDetail: tagDetailValue,
            pairId,
            applyWagering,
          }),
        );
      }
      if (hasCoin) {
        requests.push(
          manualDepositApi.create({
            userId: selectedUser.id,
            amount: coinAmt,
            currency: "wulfCoin",
            notes: notes.trim() || undefined,
            tag: tag || undefined,
            tagDetail: tagDetailValue,
            pairId,
            applyWagering,
          }),
        );
      }
      await Promise.all(requests);
      toast.success("Manual deposit requests created (pending approval)");
      setWulfCashAmount("");
      setWulfCoinAmount("");
      setNotes("");
      setTag("");
      setTagDetail("");
      setSelectedUser(null);
      setUserSearch("");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to create deposit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-3 px-3 py-3 rounded-lg flex flex-col items-stretch gap-2 md:mb-6 md:flex-row md:items-center md:justify-between md:gap-4 md:px-4">
        <h1 className="text-base font-normal text-white whitespace-nowrap">Wallet / Manual Deposit</h1>
        <Link href="/wallet/manual-deposit-listing" className="shrink-0">
          <Button
            variant="outline"
            className="h-9 w-full border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white md:w-auto"
          >
            Manual Deposit Listing
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* FORM CARD */}
      <div className="bg-[#15181E] rounded-lg p-0 md:p-6 flex-1 overflow-y-auto scrollbar-hide">
        {/* Three across on a wide screen: the seven fields then land as two full
            rows plus the coin amount and its hint, instead of trailing off with
            a half-empty row. */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 max-w-6xl">
          {/* Available Options */}
          <div>
            <label className="block text-white text-sm mb-2">Available Options:</label>
            <Select value={option} onValueChange={setOption}>
              <SelectTrigger className="bg-[#242B35] w-full border-none text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Topup / Topout hidden for now — restore both lines (and the
                    "topup" default above) to bring them back. */}
                {/* <SelectItem value="topup">Topup</SelectItem> */}
                {/* <SelectItem value="topout">Topout</SelectItem> */}
                <SelectItem value="cash_bundle">Cash Bundle Recovery</SelectItem>
                <SelectItem value="subscription_change">
                  Subscription Change
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User search */}
          <div>
            <label className="block text-white text-sm mb-2">User:</label>
            <div className="relative">
              <Input
                ref={inputRef}
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  if (selectedUser) setSelectedUser(null);
                }}
                placeholder="Search by username or email..."
                className="bg-[#242B35] border-none text-white placeholder:text-gray-500 pr-8"
              />
              {selectedUser && (
                <button
                  type="button"
                  onClick={handleClearUser}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm leading-none"
                >
                  &times;
                </button>
              )}
              {(dropdownOpen && userResults.length > 0) || searching ? (
                <div
                  ref={dropdownRef}
                  className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#1a2030] border border-gray-700 rounded-md shadow-xl max-h-48 overflow-y-auto"
                >
                  {searching && (
                    <div className="px-3 py-2 text-sm text-gray-400">Searching...</div>
                  )}
                  {!searching &&
                    userResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#242B35] flex flex-col"
                      >
                        <span className="font-medium">{u.username || "â€”"}</span>
                        <span className="text-xs text-gray-500">
                          {u.profile?.email || u.entity || "â€”"}
                        </span>
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-white text-sm mb-2">Name:</label>
            <Input
              value={
                selectedUser?.profile?.fullName ||
                selectedUser?.profile?.displayName ||
                selectedUser?.username ||
                ""
              }
              disabled
              className="bg-[#0f131a] border border-gray-700 text-white"
            />
          </div>

          {/* Current Cash balance */}
          <div>
            <label className="block text-white text-sm mb-2">Current Cash balance</label>
            <Input
              value={getBalanceOf("wulfCash")}
              disabled
              className="bg-[#0f131a] border border-gray-700 text-white"
            />
          </div>

          {/* Current Wolf Coin balance */}
          <div>
            <label className="block text-white text-sm mb-2">Current Wolf Coin balance</label>
            <Input
              value={getBalanceOf("wulfCoin")}
              disabled
              className="bg-[#0f131a] border border-gray-700 text-white"
            />
          </div>

          {/* ===== TOPUP MODE ===== */}
          {!isSubscription && !isBundleRecovery && (
            <>
              {/* Wulf Cash Amount */}
              <div>
                <label className="block text-white text-sm mb-2">
                  Wulf Cash Amount:
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={wulfCashAmount}
                  onChange={(e) => handleAmountChange(e.target.value, setWulfCashAmount)}
                  placeholder="0.00"
                  className="bg-[#242B35] border-none text-white"
                />
              </div>

              {/* Wulf Coin Amount */}
              <div>
                <label className="block text-white text-sm mb-2">
                  Wulf Coin Amount:
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={wulfCoinAmount}
                  onChange={(e) => handleAmountChange(e.target.value, setWulfCoinAmount)}
                  placeholder="0.00"
                  className="bg-[#242B35] border-none text-white"
                />
              </div>

              {/* Tag — takes the third cell of the amounts row. Reporting only:
                  it records where the credit came from and changes nothing about
                  how it is applied. A top out is not a deposit, so it has none. */}
              {!isTopout && (
              <div>
                <label className="block text-white text-sm mb-2">Tag:</label>
                <Select
                  value={tag || "none"}
                  onValueChange={(v) => {
                    const next = v === "none" ? "" : (v as ManualDepositTag);
                    setTag(next);
                    // Re-picking a named tag drops whatever was typed for
                    // "other", so a stale detail cannot be submitted with it.
                    if (next !== "other") setTagDetail("");
                  }}
                >
                  <SelectTrigger className="bg-[#242B35] w-full border-none text-white">
                    <SelectValue placeholder="Select a tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix treats "" as "no value", so the cleared state needs
                        a sentinel of its own to stay selectable. */}
                    <SelectItem value="none">None</SelectItem>
                    {(
                      Object.keys(MANUAL_DEPOSIT_TAG_LABELS) as ManualDepositTag[]
                    ).map((t) => (
                      <SelectItem key={t} value={t}>
                        {MANUAL_DEPOSIT_TAG_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}

              {/* "Other" is only useful if it says what it was, so the box is
                  required the moment that option is picked. */}
              {!isTopout && tag === "other" && (
                <div>
                  <label className="block text-white text-sm mb-2">
                    Tag Detail: <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={tagDetail}
                    onChange={(e) => setTagDetail(e.target.value.slice(0, 64))}
                    placeholder="Describe the tag..."
                    maxLength={64}
                    className="bg-[#242B35] border-none text-white placeholder:text-gray-500"
                  />
                </div>
              )}

              <p className="col-span-full text-gray-500 text-xs">
                {isTopout
                  ? "Enter the Wulf Cash, Wulf Coin, or both to take off the player — at least one is required. Nothing is removed until the request is approved on the Manual Deposit Listing."
                  : "Enter Wulf Cash, Wulf Coin, or both — at least one is required."}
              </p>

              {/* Apply Wagering — only means something for money going in. */}
              {!isTopout && (
              <div className="col-span-full">
                <label className="flex items-start gap-3 bg-[#242B35] rounded-lg p-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyWagering}
                    onChange={(e) => setApplyWagering(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-purple-600"
                  />
                  <span>
                    <span className="block text-white text-sm font-medium">
                      Apply Wagering
                    </span>
                    <span className="block text-gray-500 text-xs mt-0.5">
                      If enabled, a rollover is created on approval (normal flow). If
                      disabled, the Wulf Cash is added directly to the user&apos;s
                      redeemable / available-to-withdraw balance.
                    </span>
                  </span>
                </label>
              </div>
              )}
            </>
          )}

          {/* ===== CASH BUNDLE RECOVERY MODE ===== */}
          {isBundleRecovery && (
            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-white text-sm mb-2">
                  Paid Cash Bundle: <span className="text-red-400">*</span>
                </label>
                <Select
                  value={selectedBundleId}
                  onValueChange={setSelectedBundleId}
                  disabled={loadingBundles || !selectedUser}
                >
                  <SelectTrigger className="bg-[#242B35] w-full border-none text-white">
                    <SelectValue
                      placeholder={
                        !selectedUser
                          ? "Select a user first"
                          : loadingBundles
                            ? "Loading active bundles..."
                            : "Select the bundle paid by the user"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-[440px] overflow-y-auto">
                    {bundles.map((bundle) => {
                      const cash = Number(bundle.wulfCashAmount ?? bundle.price);
                      return (
                        <SelectItem key={bundle.id} value={bundle.id}>
                          <span className="flex items-center justify-between w-full">
                            <span>{bundle.name} — {cash.toFixed(2)} Sweep Coin, {Number(bundle.wulfCoinAmount).toLocaleString()} Gold Coin</span>
                            <span className="text-purple-500 font-semibold ml-4">${Number(bundle.price).toFixed(2)}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-white text-sm mb-2">
                  Payment Provider Reference: <span className="text-red-400">*</span>
                </label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value.slice(0, 255))}
                  placeholder="e.g. Coinflow or card processor payment ID"
                  disabled={!selectedUser}
                  className="bg-[#242B35] border-none text-white placeholder:text-gray-500"
                />
              </div>

              {selectedBundleId && (() => {
                const bundle = bundles.find((item) => item.id === selectedBundleId);
                if (!bundle) return null;
                const cash = Number(bundle.wulfCashAmount ?? bundle.price);
                const bonus = Number(bundle.bonusWulfCash ?? 0);
                return (
                  <div className="md:col-span-2 rounded-lg border border-purple-500/40 bg-purple-500/10 p-4 text-sm">
                    <p className="font-medium text-white">Bundle to credit</p>
                    <p className="mt-1 text-gray-300">
                      Price: ${Number(bundle.price).toFixed(2)} · {cash.toFixed(2)} Sweep Coin + {Number(bundle.wulfCoinAmount).toLocaleString()} Gold Coin
                      {bonus > 0 && ` + ${bonus.toFixed(2)} Bonus Sweep Coin (${Number(bundle.bonusWageringMultiplier || 1)}× wager)`}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      This creates the normal Bundle Purchase transaction and is safe if a delayed webhook retries the same payment.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===== SUBSCRIPTION CHANGE MODE ===== */}
          {isSubscription && (
            <div className="col-span-full">
              <label className="block text-white text-sm mb-2">
                Change Subscription Plan: <span className="text-red-400">*</span>
              </label>

              {!selectedUser ? (
                <p className="text-gray-500 text-sm bg-[#242B35] rounded-lg p-4">
                  Select a user to view and change their subscription plan.
                </p>
              ) : loadingSub ? (
                <p className="text-gray-400 text-sm bg-[#242B35] rounded-lg p-4">
                  Loading current plan…
                </p>
              ) : (
                <>
                  <p className="text-gray-400 text-xs mb-3">
                    Current plan:{" "}
                    <span className="text-white font-semibold">
                      {currentSub?.plan?.name ?? "—"}
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {plans.map((p) => {
                      const isCurrent = p.id === currentPlanId;
                      const isSel = p.id === selectedPlanId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isCurrent}
                          onClick={() => setSelectedPlanId(p.id)}
                          className={cn(
                            "rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition-all",
                            isSel
                              ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/40"
                              : "border-gray-700 bg-[#242B35] hover:border-purple-500/60",
                            isCurrent && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          {p.iconUrl ? (
                            <img
                              src={p.iconUrl}
                              alt={p.name}
                              className="w-14 h-14 object-contain"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-[#1a2030]" />
                          )}
                          <span className="text-white font-semibold text-sm">
                            {p.name}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {p.price} {p.currency}/
                            {p.interval === "YEARLY" ? "yr" : "mo"}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] text-green-400 font-semibold">
                              CURRENT
                            </span>
                          )}
                          {isSel && !isCurrent && (
                            <span className="text-[10px] text-purple-300 font-semibold">
                              SELECTED
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Notes do not form part of an external bundle settlement. The
              provider reference above is the durable recovery audit key. */}
          {!isBundleRecovery && (
            <div className="col-span-full">
              <label className="block text-white text-sm mb-2">Notes (optional):</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note..."
                className="bg-[#242B35] border-none text-white resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* SUBMIT */}
        <div className="mt-6 md:mt-8">
          <Button
            onClick={isSubscription ? handleSubmitSubscription : handleSubmit}
            disabled={submitting}
            className="w-full px-8 bg-purple-600 hover:bg-purple-700 text-white md:w-auto"
          >
            {submitting
              ? "Submitting..."
              : isBundleRecovery
                ? "Recover Bundle Payment"
                : isTopout
                  ? "Submit Top Out"
                  : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

