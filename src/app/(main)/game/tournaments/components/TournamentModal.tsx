"use client";

import * as React from "react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tournament, Prize } from "@/types/tournament";
import { Trash2, Plus, Loader2, Trophy, Copy, Check, Clock, Wrench } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import { coingreen, coingold } from "@/assets/icons";
import ImageUploader, { ImageUploaderRef } from "@/components/image-upload/ImageUploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament | null;
  /** When set (and tournament is null), opens in create mode pre-filled from this source (Duplicate). */
  prefill?: Partial<Tournament> | null;
  onSubmit: (data: any) => Promise<void>;
}

/**
 * A prize ROW can award WulfCash and/or WulfCoin at the same rank range.
 * Stored on the backend as up to two flat Prize entries sharing the range.
 */
interface PrizeRow {
  rankStart: number;
  rankEnd: number;
  cashEnabled: boolean;
  cashAmount: number;
  coinEnabled: boolean;
  coinAmount: number;
}

const isCash = (c: string) => c === "WulfCash" || c === "SC";

/** Collapse flat backend prizes into rows grouped by rank range. */
const groupToRows = (prizes: Prize[]): PrizeRow[] => {
  const map = new Map<string, PrizeRow>();
  for (const p of prizes) {
    const key = `${p.rankStart}-${p.rankEnd}`;
    const row =
      map.get(key) ||
      ({ rankStart: p.rankStart, rankEnd: p.rankEnd, cashEnabled: false, cashAmount: 0, coinEnabled: false, coinAmount: 0 } as PrizeRow);
    if (isCash(p.currency)) {
      row.cashEnabled = true;
      row.cashAmount = Number(p.amount) || 0;
    } else {
      row.coinEnabled = true;
      row.coinAmount = Number(p.amount) || 0;
    }
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => a.rankStart - b.rankStart);
};

/** Expand rows back into flat Prize entries (one per enabled currency with a value). */
const rowsToPrizes = (rows: PrizeRow[]): Prize[] => {
  const out: Prize[] = [];
  for (const r of rows) {
    if (r.cashEnabled && r.cashAmount > 0) {
      out.push({ rankStart: r.rankStart, rankEnd: r.rankEnd, amount: r.cashAmount, currency: "WulfCash" });
    }
    if (r.coinEnabled && r.coinAmount > 0) {
      out.push({ rankStart: r.rankStart, rankEnd: r.rankEnd, amount: r.coinAmount, currency: "WulfCoin" });
    }
  }
  return out;
};

export function TournamentModal({ open, onOpenChange, tournament, prefill, onSubmit }: Props) {
  const [title, setTitle] = React.useState("");
  const [externalEventId, setExternalEventId] = React.useState("");
  const [bannerUrl, setBannerUrl] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [prizes, setPrizes] = React.useState<PrizeRow[]>([]);
  const [rolloverMultiplier, setRolloverMultiplier] = React.useState<number>(1);
  const [rolloverExpiryDays, setRolloverExpiryDays] = React.useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const bannerUploaderRef = React.useRef<ImageUploaderRef>(null);

  const toLocalISO = (utcStr: any) => {
    if (!utcStr) return "";
    const d = new Date(utcStr);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  React.useEffect(() => {
    if (tournament && open) {
      setTitle(tournament.title);
      setExternalEventId(tournament.externalEventId);
      setBannerUrl(tournament.bannerUrl || "");
      setStartTime(toLocalISO(tournament.startTime));
      setEndTime(toLocalISO(tournament.endTime));
      setPrizes(groupToRows(tournament.prizes || []));
      setRolloverMultiplier(Number((tournament as any).rolloverMultiplier ?? 1));
      setRolloverExpiryDays(
        (tournament as any).rolloverExpiryDays == null
          ? ""
          : Number((tournament as any).rolloverExpiryDays),
      );
    } else if (open) {
      // Create mode — blank, or pre-filled from a Duplicate source.
      // Copy title/banner/prizes; intentionally leave SA Event ID and the
      // date window empty so the admin sets a unique event + future window.
      setTitle(prefill?.title || "");
      setExternalEventId("");
      setBannerUrl(prefill?.bannerUrl || "");
      setStartTime("");
      setEndTime("");
      setPrizes(
        prefill?.prizes?.length
          ? groupToRows(prefill.prizes)
          : [{ rankStart: 1, rankEnd: 1, cashEnabled: true, cashAmount: 0, coinEnabled: false, coinAmount: 0 }]
      );
      setRolloverMultiplier(Number((prefill as any)?.rolloverMultiplier ?? 1));
      setRolloverExpiryDays(
        (prefill as any)?.rolloverExpiryDays == null
          ? ""
          : Number((prefill as any).rolloverExpiryDays),
      );
    }
  }, [tournament, open, prefill]);

  const handleAddPrize = () => {
    // Find highest rank to auto-calculate next start
    const maxRank = prizes.reduce((max, p) => Math.max(max, p.rankEnd), 0);
    const nextRank = maxRank + 1;
    setPrizes([{ rankStart: nextRank, rankEnd: nextRank, cashEnabled: true, cashAmount: 0, coinEnabled: false, coinAmount: 0 }, ...prizes]);
  };

  const handleRemovePrize = (index: number) => {
    const newPrizes = prizes.filter((_, i) => i !== index);
    setPrizes(newPrizes);
  };

  const updatePrize = (index: number, field: keyof PrizeRow, value: any) => {
    const newPrizes = [...prizes];
    newPrizes[index] = { ...newPrizes[index], [field]: value };
    setPrizes(newPrizes);
  };

  const handlePositionModeChange = (index: number, mode: "SINGLE" | "RANGE") => {
    const current = prizes[index];
    if (mode === "SINGLE") {
       updatePrize(index, "rankEnd", current.rankStart);
    } else {
       if (current.rankEnd <= current.rankStart) {
          updatePrize(index, "rankEnd", current.rankStart + 1);
       }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // VALIDATION
    const now = new Date();

    // 1. Check if startTime is in the past (Only for new or UPCOMING tournaments)
    const isUpcomingOrNew = !tournament || tournament.status === "UPCOMING";
    if (isUpcomingOrNew && new Date(startTime) < now) {
      toast.error("Start time cannot be in the past");
      setIsSubmitting(false);
      return;
    }

    // 2. Check if endTime is in the past
    if (new Date(endTime) < now) {
      toast.error("End time cannot be in the past");
      setIsSubmitting(false);
      return;
    }
    // 3. Check if endTime is after startTime
    if (endTime <= startTime) {
      toast.error("End time must be after the start time");
      setIsSubmitting(false);
      return;
    }

    // 4. Check for overlapping prize ranges
    prizes.sort((a, b) => a.rankStart - b.rankStart);
    for (let i = 0; i < prizes.length - 1; i++) {
        if (prizes[i].rankEnd >= prizes[i + 1].rankStart) {
            toast.error(`Overlapping prize ranges detected: Rank ${prizes[i].rankStart}-${prizes[i].rankEnd} and Rank ${prizes[i+1].rankStart}-${prizes[i+1].rankEnd}`);
            setIsSubmitting(false);
            return;
        }
    }

    // 5. Each row must award at least one enabled currency with a value
    for (const r of prizes) {
      const cash = r.cashEnabled ? r.cashAmount : 0;
      const coin = r.coinEnabled ? r.coinAmount : 0;
      if (cash <= 0 && coin <= 0) {
        toast.error(`Rank ${r.rankStart}${r.rankEnd !== r.rankStart ? `-${r.rankEnd}` : ""} must enable WulfCash or WulfCoin with a value`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // Send raw local datetime strings — backend handles UTC conversion.
      // Rows expand into flat prize entries (one per currency).
      await onSubmit({
        title,
        externalEventId,
        bannerUrl: bannerUrl || null,
        startTime,
        endTime,
        prizes: rowsToPrizes(prizes),
        rolloverMultiplier: Number.isFinite(rolloverMultiplier) ? rolloverMultiplier : 1,
        rolloverExpiryDays: rolloverExpiryDays === "" ? null : Number(rolloverExpiryDays),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        type: "WEEKLY",
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = !!tournament;
  const positionOptions = Array.from({ length: 100 }, (_, i) => i + 1);

  const inputClass = "bg-[#1A1C20]! border-none text-white placeholder:text-gray-500 focus:ring-1 focus:ring-purple-500/50 transition-all h-10 text-sm";
  const labelClass = "text-xs text-gray-300 mb-1 block";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] lg:w-auto lg:min-w-[1050px] bg-[#0F1115] border-none text-white p-0 gap-0 max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
        {/* HEADER */}
        <DialogHeader className="px-8 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              {isEdit ? <Wrench className="text-purple-500" size={20} /> : <Plus className="text-purple-500" size={20} />}
            </div>
            {isEdit ? "Edit Tournament" : prefill ? "Duplicate Tournament" : "Create New Tournament"}
          </DialogTitle>
        </DialogHeader>

        <form id="tournament-form" onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto px-8 pb-10 space-y-6 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* TITLE */}
            <div className="flex flex-col col-span-2">
              <Label htmlFor="title" className={labelClass}>
                Tournament Title<span className="text-purple-400 ml-1">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly SA Gaming Championship"
                className={inputClass}
                required
              />
            </div>

            {/* BANNER IMAGE */}
            <div className="flex flex-col col-span-2">
              <Label className={labelClass}>Banner Image</Label>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="relative w-44 aspect-video rounded-lg overflow-hidden border border-[#242B35] bg-[#1A1C20] shrink-0">
                  {bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bannerUrl} alt="banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      No Banner
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => bannerUploaderRef.current?.open()}
                      className="border-[#242B35] bg-[#1A1C20] text-white hover:bg-[#242B35]"
                    >
                      {bannerUrl ? "Replace Banner" : "Upload Banner"}
                    </Button>
                    {bannerUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setBannerUrl("")}
                        className="text-gray-400 hover:text-red-400"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500">Recommended 16:9 aspect ratio</p>
                </div>
              </div>
              <ImageUploader
                ref={bannerUploaderRef}
                folder="tournaments"
                aspect={16 / 9}
                onUploadComplete={(url) => setBannerUrl(url)}
              />
            </div>

            {/* EVENT ID */}
            <div className="flex flex-col">
              <Label htmlFor="eventId" className={labelClass}>
                SA Event ID<span className="text-purple-400 ml-1">*</span>
              </Label>
              <Input
                id="eventId"
                value={externalEventId}
                onChange={(e) => setExternalEventId(e.target.value)}
                placeholder="260007"
                className={inputClass + " font-mono"}
                required
              />
            </div>

            {/* PROVIDER */}
            <div className="flex flex-col opacity-60">
              <Label className={labelClass}>Provider</Label>
              <Input
                value="SA Gaming"
                disabled
                className={inputClass + " cursor-not-allowed"}
              />
            </div>

            {/* START TIME */}
            <div className="flex flex-col">
              <Label htmlFor="start" className={labelClass}>
                Start Time
              </Label>
              <Input
                id="start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
                required
              />
              <span className="text-[10px] text-gray-500 mt-1">Times are based on your local timezone</span>
            </div>

            {/* END TIME */}
            <div className="flex flex-col">
              <Label htmlFor="end" className={labelClass}>
                End Time
              </Label>
              <Input
                id="end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
                required
              />
              <span className="text-[10px] text-gray-500 mt-1">Times are based on your local timezone</span>
            </div>

            {/* SA GAMING REQUEST GENERATOR */}
            <div className="col-span-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const formatUTC8 = (s: string) => {
                    if (!s) return "N/A";
                    try {
                      const d = new Date(s);
                      // Use Asia/Shanghai as proxy for UTC+8
                      return new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Asia/Shanghai',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      }).format(d).replace(',', '');
                    } catch (e) { return "Invalid Date"; }
                  };
                  const text = `Event Name:  ${title || "WulfTournament"}\n\nStart Time (UTC+8): ${formatUTC8(startTime)}\nEnd Time (UTC+8):   ${formatUTC8(endTime)}\n\nCurrency: SCoin\nMechanism: Valid Bet`;
                  navigator.clipboard.writeText(text);
                  toast.success("SA Gaming request text copied!");
                }}
                className="w-full border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 text-xs font-bold h-10 rounded-xl"
              >
                <Copy size={14} className="mr-2" />
                Copy for SA Gaming Team
              </Button>
            </div>
          </div>

          <div className="border-t border-gray-800/50 w-full" />

          {/* WULF CASH ROLLOVER */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <div className="flex-1">
              <Label className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                <Image src={coingreen} alt="WulfCash" width={16} height={16} />
                WulfCash Rollover
              </Label>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                Playthrough on WulfCash prizes before they can be withdrawn (prize × multiplier).
                <span className="text-gray-400 font-medium"> 0 = no rollover</span> (instantly redeemable). WulfCoin prizes are never gated.
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Multiplier</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={rolloverMultiplier}
                    onChange={(e) => setRolloverMultiplier(Number(e.target.value))}
                    className={inputClass + " w-20 text-center font-bold"}
                  />
                  <span className="text-gray-400 text-sm font-bold">×</span>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Expiry</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    placeholder="∞"
                    value={rolloverExpiryDays}
                    onChange={(e) =>
                      setRolloverExpiryDays(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className={inputClass + " w-20 text-center font-bold"}
                  />
                  <span className="text-gray-400 text-xs font-bold">days</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800/50 w-full" />

          {/* PRIZE SECTION */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Prizes</Label>
              <button
                type="button"
                onClick={handleAddPrize}
                className="text-purple-500 text-xs hover:underline flex items-center gap-1 font-bold"
              >
                + Add Prize
              </button>
            </div>

            <div className="space-y-4">
              {prizes.map((prize, index) => {
                const positionMode = prize.rankStart === prize.rankEnd ? "SINGLE" : "RANGE";
                return (
                  <div key={index} className="border border-gray-800 rounded-xl p-5 bg-[#14171E] flex flex-col md:flex-row items-start gap-6 relative group transition-all hover:border-purple-500/30">
                    {/* POSITION SECTION */}
                    <div className="flex flex-col items-center w-full md:w-auto md:min-w-[140px] border-b md:border-b-0 md:border-r border-gray-800/50 pb-6 md:pb-0 md:pr-6">
                      <span className="text-[10px] uppercase font-black text-gray-500 tracking-[0.15em] mb-2">POSITION</span>
                      <Select
                        value={positionMode}
                        onValueChange={(v) => handlePositionModeChange(index, v as "SINGLE" | "RANGE")}
                      >
                        <SelectTrigger className="w-full h-9 bg-[#242B35] border-none text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a2030] border-gray-700 text-white">
                          <SelectItem value="SINGLE">Single Position</SelectItem>
                          <SelectItem value="RANGE">Range</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className={`mt-2 w-full grid gap-2 ${positionMode === "RANGE" ? "grid-cols-2" : "grid-cols-1"}`}>
                        <Select
                          value={String(prize.rankStart)}
                          onValueChange={(v) => updatePrize(index, "rankStart", Number(v))}
                        >
                          <SelectTrigger className="bg-[#242B35] border-none text-white text-sm h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a2030] border-gray-700 text-white max-h-[300px]">
                            {positionOptions.map((opt) => (
                              <SelectItem key={`start-${opt}`} value={String(opt)}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {positionMode === "RANGE" && (
                          <Select
                            value={String(prize.rankEnd)}
                            onValueChange={(v) => updatePrize(index, "rankEnd", Number(v))}
                          >
                            <SelectTrigger className="bg-[#242B35] border-none text-white text-sm h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a2030] border-gray-700 text-white max-h-[300px]">
                              {positionOptions.filter(o => o >= prize.rankStart).map((opt) => (
                                <SelectItem key={`end-${opt}`} value={String(opt)}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-600 mt-2 font-medium">
                        {positionMode === "RANGE" ? "From / To" : "Position"}
                      </span>
                    </div>

                    {/* CONTENT SECTION — award WulfCash and/or WulfCoin at this rank */}
                    <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                       {/* WULF CASH — opt-in via toggle */}
                       <div className={`rounded-xl border p-3 space-y-2 transition-colors ${prize.cashEnabled ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-gray-800 bg-[#1A1C20]/40"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Image src={coingreen} alt="WulfCash" width={16} height={16} className={prize.cashEnabled ? "" : "opacity-40 grayscale"} />
                              <span className={`text-[11px] font-bold ${prize.cashEnabled ? "text-emerald-300" : "text-gray-500"}`}>Wulf Cash</span>
                            </div>
                            {/* Toggle switch */}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={prize.cashEnabled}
                              onClick={() => updatePrize(index, "cashEnabled", !prize.cashEnabled)}
                              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${prize.cashEnabled ? "bg-emerald-500" : "bg-gray-700"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prize.cashEnabled ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              disabled={!prize.cashEnabled}
                              className={inputClass + " pl-9 disabled:opacity-40 disabled:cursor-not-allowed"}
                              value={prize.cashAmount}
                              onChange={e => updatePrize(index, "cashAmount", Number(e.target.value))}
                              placeholder={prize.cashEnabled ? "0" : "Off"}
                            />
                            <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${prize.cashEnabled ? "opacity-60" : "opacity-20 grayscale"}`}>
                                <Image src={coingreen} alt="coin" width={16} height={16} />
                            </div>
                          </div>
                       </div>

                       {/* WULF COIN — opt-in via toggle */}
                       <div className={`rounded-xl border p-3 space-y-2 transition-colors ${prize.coinEnabled ? "border-yellow-500/30 bg-yellow-500/[0.05]" : "border-gray-800 bg-[#1A1C20]/40"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Image src={coingold} alt="WulfCoin" width={16} height={16} className={prize.coinEnabled ? "" : "opacity-40 grayscale"} />
                              <span className={`text-[11px] font-bold ${prize.coinEnabled ? "text-yellow-300" : "text-gray-500"}`}>Wulf Coin</span>
                            </div>
                            {/* Toggle switch */}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={prize.coinEnabled}
                              onClick={() => updatePrize(index, "coinEnabled", !prize.coinEnabled)}
                              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${prize.coinEnabled ? "bg-yellow-500" : "bg-gray-700"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prize.coinEnabled ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              disabled={!prize.coinEnabled}
                              className={inputClass + " pl-9 disabled:opacity-40 disabled:cursor-not-allowed"}
                              value={prize.coinAmount}
                              onChange={e => updatePrize(index, "coinAmount", Number(e.target.value))}
                              placeholder={prize.coinEnabled ? "0" : "Off"}
                            />
                            <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${prize.coinEnabled ? "opacity-60" : "opacity-20 grayscale"}`}>
                                <Image src={coingold} alt="coin" width={16} height={16} />
                            </div>
                          </div>
                       </div>
                    </div>

                    {/* REMOVE BUTTON */}
                    <div className="absolute top-2 right-2 md:relative md:top-0 md:right-0 md:pt-5 md:pl-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePrize(index)}
                        className="text-gray-500 hover:text-red-400 hover:bg-red-400/10 h-10 w-10 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {prizes.length === 0 && (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-gray-800">
                  <Trophy size={48} className="mx-auto text-gray-700 mb-4 opacity-10" />
                  <p className="text-sm text-gray-500 font-medium">No prize distribution defined yet.</p>
                  <Button 
                    type="button" 
                    variant="link" 
                    onClick={handleAddPrize}
                    className="text-purple-500 text-xs mt-2 font-bold"
                  >
                    Click here to add your first prize rank
                  </Button>
                </div>
              )}
            </div>
          </div>

        </form>

        <div className="bg-[#0F1115] border-t border-gray-800/50 py-5 px-10 flex flex-row justify-end gap-3 shrink-0 rounded-b-3xl">
          <Button 
             type="button" 
             variant="ghost" 
             disabled={isSubmitting}
             onClick={() => onOpenChange(false)}
             className="bg-[#1A1C20] hover:bg-[#25282E] text-gray-300 border-none px-8 h-12 rounded-xl text-sm font-bold"
          >
            Cancel
          </Button>
          <Button 
            form="tournament-form"
            type="submit" 
            disabled={isSubmitting}
            className="bg-[#C362EA] hover:bg-[#B555DB] text-white font-bold px-10 h-12 rounded-xl text-sm shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-3" />
                Processing...
              </>
            ) : isEdit ? (
               "Update Tournament"
            ) : (
               "Create Tournament"
            )}
          </Button>
        </div>
    </DialogContent>
    </Dialog>
  );
}
