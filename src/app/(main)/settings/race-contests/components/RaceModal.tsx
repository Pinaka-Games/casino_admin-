"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Trash2, X } from "lucide-react";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import Image from "next/image";
import { toast } from "react-hot-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { coingreen, coingold } from "@/assets/icons";
import { Race, RaceCurrency, RaceScoringType, RaceStatus } from "@/types/race";

interface Props {
  open: boolean;
  initialData?: Race | null;
  // When true, initialData is used only to prefill a brand-new race (create path).
  isDuplicate?: boolean;
  onClose: () => void;
  onSubmit?: (data: RaceFormData) => Promise<void> | void;
}

type PrizeMode = "SINGLE" | "RANGE";

type FormPrizeTier = {
  id: number;
  mode: PrizeMode;
  fromRank: number;
  toRank: number;
  rewardAmount: number;
  rewardCurrency: RaceCurrency;
};

export type RaceFormData = {
  name: string;
  description: string;
  banner: string;
  status: RaceStatus;
  startAt: string;
  endAt: string;
  autoEnroll: boolean;
  entryFee: number;
  entryCurrency: RaceCurrency;
  maxParticipants: number | "";
  scoringType: RaceScoringType;
  rolloverMultiplier: number;
  rolloverExpiryDays: number | "";
  prizes: FormPrizeTier[];
};

const STATUS_OPTIONS: RaceStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"];

const defaultForm: RaceFormData = {
  name: "",
  description: "",
  banner: "",
  status: "ACTIVE",
  startAt: "",
  endAt: "",
  autoEnroll: false,
  entryFee: 100,
  entryCurrency: "wulfCoin",
  maxParticipants: "",
  scoringType: "VALID_BET",
  rolloverMultiplier: 1,
  rolloverExpiryDays: "",
  prizes: [
    { id: 1, mode: "SINGLE", fromRank: 1, toRank: 1, rewardAmount: 0, rewardCurrency: "wulfCash" },
  ],
};

const rankOptions = Array.from({ length: 500 }, (_, i) => i + 1);

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

/** Inline "i" hint with an accessible hover/focus tooltip for a field. */
function InfoHint({ text, below }: { text: string; below?: boolean }) {
  return (
    <span className="relative inline-flex group align-middle ml-1">
      <button
        type="button"
        aria-label="Field help"
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-gray-500 hover:text-[#C56CFF] focus:text-[#C56CFF] outline-none transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-0 z-[60] w-60 max-w-[260px] rounded-md bg-[#0E1014] border border-[#2A2F3A] px-3 py-2 text-[11px] font-normal normal-case tracking-normal leading-snug text-gray-300 shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ${
          below ? "top-full mt-2" : "bottom-full mb-2"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

export default function RaceModal({ open, initialData, isDuplicate, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<RaceFormData>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bannerUploaderRef = useRef<ImageUploaderRef>(null);
  // Backend rejects switching the entry model once anyone is in the race.
  const enrollTypeLocked =
    !!initialData && !isDuplicate && Number(initialData.totalParticipants ?? 0) > 0;

  useEffect(() => {
    if (initialData) {
      setForm({
        // Duplicate: tag the name and force a fresh, paused window so the
        // copied (possibly past) dates don't auto-complete via the cron sweep.
        name: isDuplicate ? `${initialData.name || "Race"} (Copy)` : initialData.name || "",
        description: initialData.description || "",
        banner: initialData.banner || "",
        status: isDuplicate ? "ACTIVE" : initialData.status || "ACTIVE",
        startAt: isDuplicate ? "" : toDateInputValue(initialData.startAt),
        endAt: isDuplicate ? "" : toDateInputValue(initialData.endAt),
        autoEnroll: !!initialData.autoEnroll,
        entryFee: Number(initialData.entryFee ?? 0),
        entryCurrency: initialData.entryCurrency || "wulfCoin",
        maxParticipants:
          initialData.maxParticipants === null || initialData.maxParticipants === undefined
            ? ""
            : Number(initialData.maxParticipants),
        scoringType: initialData.scoringType ?? "VALID_BET",
        rolloverMultiplier: Number((initialData as any).rolloverMultiplier ?? 1),
        rolloverExpiryDays:
          (initialData as any).rolloverExpiryDays == null
            ? ""
            : Number((initialData as any).rolloverExpiryDays),
        prizes: initialData.prizeStructure?.length
          ? initialData.prizeStructure.map((tier, index) => ({
              id: index + 1,
              mode: (tier.fromRank === tier.toRank ? "SINGLE" : "RANGE") as PrizeMode,
              fromRank: tier.fromRank,
              toRank: tier.toRank,
              rewardAmount: Number(tier.rewardAmount ?? 0),
              rewardCurrency: tier.rewardCurrency,
            }))
          : defaultForm.prizes,
      });
    } else {
      setForm(defaultForm);
    }
  }, [initialData, isDuplicate, open]);

  const handleChange = <K extends keyof RaceFormData>(key: K, value: RaceFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePrizeChange = (
    index: number,
    key: keyof FormPrizeTier,
    value: number | string,
  ) => {
    setForm((prev) => {
      const prizes = [...prev.prizes];
      const tier = { ...prizes[index], [key]: value } as FormPrizeTier;
      // Keep fromRank <= toRank when ranks change.
      if (key === "fromRank" && tier.fromRank > tier.toRank) tier.toRank = tier.fromRank;
      if (key === "toRank" && tier.toRank < tier.fromRank) tier.fromRank = tier.toRank;
      // Single position: toRank always mirrors fromRank.
      if (tier.mode === "SINGLE") tier.toRank = tier.fromRank;
      prizes[index] = tier;
      return { ...prev, prizes };
    });
  };

  const handlePrizeModeChange = (index: number, mode: PrizeMode) => {
    setForm((prev) => {
      const prizes = [...prev.prizes];
      const tier = { ...prizes[index], mode } as FormPrizeTier;
      if (mode === "SINGLE") {
        tier.toRank = tier.fromRank;
      } else if (tier.toRank <= tier.fromRank) {
        tier.toRank = Math.min(tier.fromRank + 1, 500);
      }
      prizes[index] = tier;
      return { ...prev, prizes };
    });
  };

  const addPrize = () => {
    setForm((prev) => {
      const lastTo = prev.prizes.reduce((max, t) => Math.max(max, t.toRank), 0);
      const nextRank = Math.min(lastTo + 1, 500);
      return {
        ...prev,
        prizes: [
          {
            id: Date.now(),
            mode: "SINGLE",
            fromRank: nextRank,
            toRank: nextRank,
            rewardAmount: 0,
            rewardCurrency: "wulfCash",
          },
          ...prev.prizes,
        ],
      };
    });
  };

  const removePrize = (index: number) => {
    setForm((prev) => ({
      ...prev,
      prizes: prev.prizes.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Race name is required");
      return false;
    }
    if (name.length < 3 || name.length > 100) {
      toast.error("Race name must be 3–100 characters");
      return false;
    }
    // The player site renders the race card straight from this URL, so a race
    // saved without one shows as an empty tile.
    if (!form.banner.trim()) {
      toast.error("Banner image is required");
      return false;
    }
    if (form.entryFee < 0) {
      toast.error("Entry fee cannot be negative");
      return false;
    }
    // Enroll Required = paid race; free races use Auto-Enroll.
    if (!form.autoEnroll && !(Number(form.entryFee) > 0)) {
      toast.error("Enroll Required races need an entry fee greater than 0. For a free race, choose Auto-Enroll.");
      return false;
    }
    if (form.entryFee > 100_000_000) {
      toast.error("Entry fee is too large");
      return false;
    }
    if (form.maxParticipants !== "" && Number(form.maxParticipants) < 1) {
      toast.error("Max participants must be at least 1");
      return false;
    }
    // Start + end are required so the race has a schedule (auto-end/settle,
    // timeline, and countdown all depend on them).
    if (!form.startAt) {
      toast.error("Start date is required");
      return false;
    }
    if (!form.endAt) {
      toast.error("End date is required");
      return false;
    }
    const start = new Date(form.startAt);
    const end = new Date(form.endAt);
    if (end <= start) {
      toast.error("End date must be after start date");
      return false;
    }
    const minutes = (end.getTime() - start.getTime()) / 60000;
    if (minutes < 5) {
      toast.error("Race must run at least 5 minutes");
      return false;
    }
    if (minutes > 365 * 24 * 60) {
      toast.error("Race cannot run longer than 365 days");
      return false;
    }
    // A terminal status can't apply to a race that hasn't ended yet (mirrors
    // the backend) — no marking a future-scheduled race Completed/Ended.
    if (
      (form.status === "COMPLETED" || form.status === "ENDED") &&
      end.getTime() > Date.now()
    ) {
      toast.error(
        `A race can't be marked ${form.status} while its end time is in the future`,
      );
      return false;
    }
    // Prize tier checks (mirror backend: ordered, no overlap, fromRank <= toRank).
    const sorted = [...form.prizes].sort((a, b) => a.fromRank - b.fromRank);
    let prevTo = 0;
    for (const tier of sorted) {
      if (tier.fromRank > tier.toRank) {
        toast.error(`Prize tier ${tier.fromRank}-${tier.toRank}: fromRank exceeds toRank`);
        return false;
      }
      if (tier.fromRank <= prevTo) {
        toast.error(`Prize tier rank ranges overlap near rank ${tier.fromRank}`);
        return false;
      }
      if (tier.rewardAmount <= 0) {
        toast.error(`Prize tier ${tier.fromRank}-${tier.toRank}: reward must be greater than 0`);
        return false;
      }
      prevTo = tier.toRank;
    }
    // Prize positions cannot exceed the participant cap — no awarding a rank
    // nobody can occupy (mirrors the backend capacity guard).
    if (form.maxParticipants !== "") {
      const topRank = sorted.reduce((max, t) => Math.max(max, t.toRank), 0);
      if (topRank > Number(form.maxParticipants)) {
        toast.error(
          `Prize positions go up to rank ${topRank}, which exceeds Max Participants (${form.maxParticipants})`,
        );
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!onSubmit) {
      onClose();
      return;
    }
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch {
      // Parent shows the error toast; keep modal open.
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-[#242B35] text-white text-sm rounded-md px-3 py-2 outline-none border-none focus:ring-1 focus:ring-[#C56CFF] transition-all placeholder:text-gray-500";
  const labelClass = "text-[11px] text-gray-300 mb-1.5 block";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] lg:w-auto lg:min-w-[1050px] max-h-[90vh] p-0 bg-[#1A1E26] text-white border border-[#2A2F3A] shadow-2xl [&>button]:hidden overflow-y-auto scrollbar-hide">
        {/* HEADER */}
        <div className="p-5 flex items-start justify-between gap-4">
          <DialogTitle className="text-xl font-bold text-white tracking-wide">
            {isDuplicate
              ? "Duplicate Race Contest"
              : initialData
                ? "Edit Race Contest"
                : "Add New Race Contest"}
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-t border-[#2A2F3A]/80 w-full" />

        {/* BODY */}
        <div
          className="p-7 overflow-y-auto max-h-[75vh]"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#2A2F3A #15181E" }}
        >
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className={labelClass}>
                Race Name <span className="text-red-500">*</span>
                <InfoHint below text="Public name shown to players on the race card, leaderboard, and join modal." />
              </label>
              <input
                placeholder="e.g. Weekend Sprint"
                className={inputClass}
                value={form.name}
                maxLength={100}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>
                Description
                <InfoHint text="Short blurb shown under the race name on cards and detail. Optional." />
              </label>
              <textarea
                placeholder="Description for users..."
                className={inputClass + " min-h-[80px] py-3 resize-none"}
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>

            {/* Banner */}
            <div>
              <label className={labelClass}>
                Banner Image <span className="text-red-500">*</span>
                <InfoHint text="Banner art shown on the race card. Required — a race with no banner renders as an empty tile on the player site." />
              </label>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="relative w-44 aspect-video rounded-lg overflow-hidden border border-[#2A2F3A] bg-[#15181E] shrink-0">
                  {form.banner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.banner}
                      alt="banner"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      No Banner
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => bannerUploaderRef.current?.open()}
                      className="px-4 py-2 rounded-lg border border-[#2A2F3A] bg-[#15181E] text-white text-sm font-semibold hover:bg-[#242B35] transition-colors"
                    >
                      {form.banner ? "Replace Banner" : "Upload Banner"}
                    </button>
                    {form.banner && (
                      <button
                        type="button"
                        onClick={() => handleChange("banner", "")}
                        className="px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 text-sm font-semibold transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Recommended 16:9 aspect ratio
                  </p>
                </div>
              </div>
              <ImageUploader
                ref={bannerUploaderRef}
                folder="races"
                aspect={16 / 9}
                onUploadComplete={(url) => handleChange("banner", url)}
              />
            </div>

            {/* Enrollment type — auto-enroll (open to all) vs enroll required */}
            <div>
              <label className={labelClass}>
                Enrollment Type
                <InfoHint text="Auto-Enroll: no entry fee and no Enroll button — every player is entered automatically when they open the race or place a bet. Enroll Required: paid race — players must click Enroll and pay the entry fee (greater than 0)." />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(
                  [
                    {
                      v: false,
                      title: "Enroll Required",
                      desc: "Paid race. Players must enroll and pay an entry fee greater than 0.",
                    },
                    {
                      v: true,
                      title: "Auto-Enroll (Open to All)",
                      desc: "Free for everyone. No Enroll button — players are entered automatically.",
                    },
                  ] as const
                ).map((opt) => {
                  const active = form.autoEnroll === opt.v;
                  return (
                    <button
                      type="button"
                      key={String(opt.v)}
                      disabled={enrollTypeLocked}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          autoEnroll: opt.v,
                          // Auto-enroll is always free; restore a sane default fee when leaving it.
                          entryFee: opt.v ? 0 : prev.entryFee || 100,
                        }))
                      }
                      className={`text-left border rounded-lg p-4 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        active
                          ? "border-[#C56CFF] bg-[#C56CFF]/10"
                          : "border-[#2A2F3A] bg-[#1A1F28]/50 hover:border-[#3A404D]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full border ${
                            active ? "border-[#C56CFF] bg-[#C56CFF]" : "border-gray-500"
                          }`}
                        />
                        <span className="text-[13px] font-semibold text-white">{opt.title}</span>
                      </div>
                      <span className="block text-[10px] text-gray-400 leading-snug">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
              {enrollTypeLocked && (
                <p className="mt-2 text-[11px] text-gray-500">
                  This race already has participants — its enrollment type can no longer be changed.
                </p>
              )}
            </div>

            {/* Entry Fee + Currency + Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className={labelClass}>
                  Entry Fee <span className="text-red-500">*</span>
                  <InfoHint text="Amount each player pays to join, deducted from their wallet in the entry currency. Must be greater than 0. Locked to 0 for Auto-Enroll races." />
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 100"
                  className={inputClass}
                  value={form.entryFee}
                  disabled={form.autoEnroll}
                  onChange={(e) => {
                    // Numeric only (digits + single decimal); strips spinner behaviour.
                    const clean = e.target.value.replace(/[^\d.]/g, "");
                    handleChange("entryFee", clean === "" ? 0 : Number(clean));
                  }}
                />
                {form.autoEnroll ? (
                  <p className="text-[11px] text-emerald-400 mt-1.5">
                    Auto-Enroll — free, players are entered when they open the race or place their first bet.
                  </p>
                ) : (
                  Number(form.entryFee) === 0 && (
                    <p className="text-[11px] text-red-400 mt-1.5">
                      Enter a fee greater than 0, or choose Auto-Enroll for a free race.
                    </p>
                  )
                )}
              </div>
              <div>
                <label className={labelClass}>
                  Entry Currency <span className="text-red-500">*</span>
                  <InfoHint text="Drives the entry fee, scoring, and all prize payouts. Only bets placed in this currency count toward race scores." />
                </label>
                <Select
                  value={form.entryCurrency}
                  onValueChange={(v) => handleChange("entryCurrency", v as RaceCurrency)}
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wulfCash">
                      <div className="flex items-center gap-2">
                        <Image src={coingreen} alt="coin" width={16} height={16} />
                        <span>Wulf Cash</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="wulfCoin">
                      <div className="flex items-center gap-2">
                        <Image src={coingold} alt="coin" width={16} height={16} />
                        <span>Wulf Coin</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelClass}>
                  Status
                  <InfoHint text="ACTIVE = live or scheduled, PAUSED = scoring frozen, COMPLETED = closed & prizes paid. New races usually stay ACTIVE with a future start date." />
                </label>
                <Select
                  value={form.status}
                  onValueChange={(v) => handleChange("status", v as RaceStatus)}
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Start / End / Max participants */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className={labelClass}>
                  Start Date <span className="text-red-500">*</span>
                  <InfoHint text="When the race goes live. A future date shows it as Upcoming and lets players pre-enroll. Required." />
                </label>
                <input
                  type="datetime-local"
                  className={inputClass + " text-gray-300"}
                  value={form.startAt}
                  max={form.endAt || undefined}
                  onChange={(e) => handleChange("startAt", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>
                  End Date <span className="text-red-500">*</span>
                  <InfoHint text="When the race auto-closes: the leaderboard freezes and prizes are distributed. Required, and must be after the start date." />
                </label>
                <input
                  type="datetime-local"
                  className={inputClass + " text-gray-300"}
                  value={form.endAt}
                  min={form.startAt || undefined}
                  onChange={(e) => handleChange("endAt", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Max Participants
                  <InfoHint text="Cap on how many players can join. Leave empty for unlimited. Once full, joining is blocked." />
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  className={inputClass}
                  value={form.maxParticipants}
                  onChange={(e) =>
                    handleChange(
                      "maxParticipants",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>

            <div className="border-t border-[#2A2F3A]/50 w-full" />

            {/* Scoring basis (exactly one) */}
            <div>
              <label className={labelClass}>
                Scoring Basis
                <InfoHint text="How players earn leaderboard score. Choose ONE: Valid Bet (score = total amount wagered) or Winning Bet (score = total amount won). Only bets in the entry currency count." />
              </label>
              <div className="mb-3 flex items-center gap-2 rounded-md border border-[#C56CFF]/30 bg-[#C56CFF]/10 px-3 py-2">
                <Image
                  src={form.entryCurrency === "wulfCoin" ? coingold : coingreen}
                  alt="currency"
                  width={16}
                  height={16}
                />
                <span className="text-[11px] text-gray-300">
                  Only bets placed in{" "}
                  <b className="text-white">
                    {form.entryCurrency === "wulfCoin" ? "Wulf Coin" : "Wulf Cash"}
                  </b>{" "}
                  (the entry currency) count toward race scores.
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(
                  [
                    {
                      v: "VALID_BET" as RaceScoringType,
                      title: "Valid Bet",
                      desc: "Score = total amount wagered. Every settled bet adds its bet amount.",
                    },
                    {
                      v: "WINNING_BET" as RaceScoringType,
                      title: "Winning Bet",
                      desc: "Score = total amount won. Every winning bet adds its win amount.",
                    },
                  ] as const
                ).map((opt) => {
                  const active = form.scoringType === opt.v;
                  return (
                    <button
                      type="button"
                      key={opt.v}
                      onClick={() => handleChange("scoringType", opt.v)}
                      className={`text-left border rounded-lg p-4 transition-colors ${
                        active
                          ? "border-[#C56CFF] bg-[#C56CFF]/10"
                          : "border-[#2A2F3A] bg-[#1A1F28]/50 hover:border-[#3A404D]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full border ${
                            active ? "border-[#C56CFF] bg-[#C56CFF]" : "border-gray-500"
                          }`}
                        />
                        <span className="text-[13px] font-semibold text-white">{opt.title}</span>
                      </div>
                      <span className="block text-[10px] text-gray-400 leading-snug">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                A race uses exactly one basis — higher total{" "}
                {form.scoringType === "WINNING_BET" ? "winnings" : "wagering"} ranks higher.
              </p>
            </div>

            <div className="border-t border-[#2A2F3A]/50 w-full" />

            {/* WulfCash rollover — only meaningful for WulfCash races */}
            {(() => {
              const isCashRace = form.entryCurrency === "wulfCash";
              return (
                <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 transition-colors ${isCashRace ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-[#2A2F3A] bg-[#11141A]/40"}`}>
                  <div className="flex-1">
                    <label className={labelClass + " !mb-0 flex items-center gap-2"}>
                      <Image src={coingreen} alt="WulfCash" width={16} height={16} className={isCashRace ? "" : "opacity-40 grayscale"} />
                      WulfCash Rollover
                      <InfoHint text="Playthrough on WulfCash prizes before they can be withdrawn (prize × multiplier). 0 = no rollover (instantly redeemable). Only applies to WulfCash races." />
                    </label>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      {isCashRace
                        ? "Winners must wager prize × multiplier before withdrawing. 0 = no rollover."
                        : "This is a WulfCoin race — rollover does not apply (WulfCoin isn't redeemable)."}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Multiplier</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          disabled={!isCashRace}
                          value={form.rolloverMultiplier}
                          onChange={(e) => handleChange("rolloverMultiplier", Number(e.target.value))}
                          className={inputClass + " w-20 text-center font-bold disabled:opacity-40 disabled:cursor-not-allowed"}
                        />
                        <span className="text-gray-400 text-sm font-bold">×</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Expiry</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={3650}
                          placeholder="∞"
                          disabled={!isCashRace}
                          value={form.rolloverExpiryDays}
                          onChange={(e) =>
                            handleChange("rolloverExpiryDays", e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className={inputClass + " w-20 text-center font-bold disabled:opacity-40 disabled:cursor-not-allowed"}
                        />
                        <span className="text-gray-400 text-xs font-bold">days</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="border-t border-[#2A2F3A]/50 w-full" />

            {/* Prize structure */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={labelClass + " !mb-0"}>
                  Prize Structure (by rank)
                  <InfoHint text="Reward per finishing rank. Each tier pays its amount to every rank in its range; the sum across all tiers is the advertised Prize Pool. Unfilled ranks aren't paid." />
                </label>
                <button
                  onClick={addPrize}
                  className="text-[#C56CFF] text-xs hover:underline flex items-center gap-1 font-semibold"
                >
                  + Add Tier
                </button>
              </div>

              <div className="space-y-4">
                {form.prizes.map((tier, index) => (
                  <div
                    key={tier.id}
                    className="border border-[#2A2F3A] rounded-lg p-5 bg-[#1A1F28]/50 flex flex-col lg:flex-row items-start gap-4 relative"
                  >
                    <div className="flex flex-col w-full lg:w-auto lg:min-w-[160px]">
                      <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mb-2">
                        Position
                        <InfoHint text="Single = one exact rank (e.g. 1st). Range = a band of ranks (e.g. 2–5) that all receive the same reward." />
                      </span>
                      <Select
                        value={tier.mode}
                        onValueChange={(v) => handlePrizeModeChange(index, v as PrizeMode)}
                      >
                        <SelectTrigger className="w-full h-9 bg-[#242B35] border-none text-white text-xs">
                          <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SINGLE">Single Position</SelectItem>
                          <SelectItem value="RANGE">Range</SelectItem>
                        </SelectContent>
                      </Select>
                      <div
                        className={`mt-1.5 grid gap-1.5 ${
                          tier.mode === "RANGE" ? "grid-cols-2" : "grid-cols-1"
                        }`}
                      >
                        <Select
                          value={String(tier.fromRank)}
                          onValueChange={(v) => handlePrizeChange(index, "fromRank", Number(v))}
                        >
                          <SelectTrigger className="bg-[#242B35] border-none text-white text-sm h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rankOptions.map((r) => (
                              <SelectItem key={`from-${tier.id}-${r}`} value={String(r)}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {tier.mode === "RANGE" && (
                          <Select
                            value={String(tier.toRank)}
                            onValueChange={(v) => handlePrizeChange(index, "toRank", Number(v))}
                          >
                            <SelectTrigger className="bg-[#242B35] border-none text-white text-sm h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {rankOptions.map((r) => (
                                <SelectItem key={`to-${tier.id}-${r}`} value={String(r)}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-500 mt-1">
                        {tier.mode === "RANGE" ? "From / To rank" : "Rank"}
                      </span>
                    </div>

                    <div className="flex-1 w-full lg:w-auto grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[10px] text-gray-400 mb-1">
                          Reward Currency
                          <InfoHint text="Locked to the entry currency — prizes always pay out in the same currency players entered with." />
                        </span>
                        <div className="flex h-10 items-center gap-2 rounded-md bg-[#242B35]/60 border border-[#2A2F3A] px-3">
                          <Image
                            src={form.entryCurrency === "wulfCoin" ? coingold : coingreen}
                            alt="coin"
                            width={16}
                            height={16}
                          />
                          <span className="text-sm text-gray-300">
                            {form.entryCurrency === "wulfCoin" ? "Wulf Coin" : "Wulf Cash"}
                          </span>
                          <span className="ml-auto text-[9px] uppercase tracking-wider text-gray-500">
                            Entry currency
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400 mb-1">
                          Reward Amount <span className="text-red-500">*</span>
                          <InfoHint text="Amount paid to each rank in this tier when the race ends. A Range tier pays this to every rank in the band." />
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass + " pl-8"}
                            value={tier.rewardAmount}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^\d.]/g, "");
                              handlePrizeChange(
                                index,
                                "rewardAmount",
                                clean === "" ? 0 : Number(clean),
                              );
                            }}
                          />
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Image
                              src={form.entryCurrency === "wulfCoin" ? coingold : coingreen}
                              alt="coin"
                              width={14}
                              height={14}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removePrize(index)}
                      disabled={form.prizes.length <= 1}
                      title="Delete tier"
                      className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0 absolute top-2 right-2 lg:relative lg:top-0 lg:right-0 lg:self-start mt-5"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#2A2F3A]/80 w-full" />

        {/* FOOTER */}
        <div className="px-6 py-4 flex justify-end gap-3 bg-[#1A1E26] rounded-b-xl">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded border border-transparent hover:border-[#2A2F3A] text-gray-300 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 rounded bg-[#C56CFF] hover:bg-[#C56CFF]/90 disabled:opacity-60 text-white text-sm font-bold transition-colors"
          >
            {isSubmitting
              ? "Saving..."
              : isDuplicate
                ? "Create Copy"
                : initialData
                  ? "Update Race"
                  : "Create Race"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
