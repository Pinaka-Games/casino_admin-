"use client";

import { useState, useEffect } from "react";
import { Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RaffleCampaignListItem, RafflePrize } from "@/types/raffle";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { coingreen, coingold } from "@/assets/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CampaignTypeLabel = "Daily" | "Weekly" | "Monthly";

/** The values the two Selects actually offer — hydration matches against these. */
const TYPE_OPTIONS = ["Weekly", "Monthly", "Daily"] as const;
const STATUS_OPTIONS = ["Active", "Paused", "Completed"] as const;

const CAMPAIGN_MAX_DURATION_DAYS: Record<CampaignTypeLabel, number> = {
  Daily: 1,
  Weekly: 7,
  Monthly: 30,
};

interface Props {
  open: boolean;
  initialData?: RaffleCampaignListItem | null;
  campaigns?: RaffleCampaignListItem[];
  onClose: () => void;
  onSubmit?: (data: any) => Promise<void> | void;
}

const defaultForm = {
  title: "",
  description: "",
  bannerImageUrl: "",
  type: "Weekly",
  status: "Active",
  startDate: "",
  drawDate: "",
  wagering: true,
  wagerAmount: 1000,
  gamePlay: false,
  purchase: false,
  prizes: [{ id: 1, position: "#1", name: "", type: "Wulf Cash", value: 0, delivery: "Auto Credit", wageringMultiplier: 0 }],
  recurring: false,
  showOnHomepage: true,
  featured: false,
  progressiveTickets: false,
};

export default function EditCampaignModal({ open, initialData, campaigns = [], onClose, onSubmit }: Props) {
  const [form, setForm] = useState<any>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const positionOptions = Array.from({ length: 100 }, (_, i) => i + 1);

  const parseDateInputValue = (value?: string | null) => {
    if (!value) return null;

    const match = String(value)
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!match) return null;

    const [, year, month, day, hour, minute] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );

    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const formatDateInputValue = (date: Date) => {
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  const toDateInputValue = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return formatDateInputValue(date);
  };

  const addDaysToDateInput = (value: string, days: number) => {
    if (!value) return "";
    const date = parseDateInputValue(value);
    if (!date) return "";
    date.setDate(date.getDate() + days);
    return formatDateInputValue(date);
  };

  const getMaxDrawDateForType = (type: CampaignTypeLabel, startDate: string) => {
    if (!startDate) return "";
    return addDaysToDateInput(startDate, CAMPAIGN_MAX_DURATION_DAYS[type]);
  };

  const getTypeDurationLabel = (type: CampaignTypeLabel) => {
    if (type === "Daily") return "Draw must be within 24 hours of the start date.";
    if (type === "Weekly") return "Draw must be within 7 days of the start date.";
    return "Draw must be within 30 days of the start date.";
  };

  /**
   * "WEEKLY" -> "Weekly", matched against the Select's own options.
   *
   * A Select whose value is not one of its items renders an empty trigger, so
   * an unrecognised status must fall back to a real option rather than be
   * passed through.
   */
  const matchOption = <T extends string>(value: string | null | undefined, options: readonly T[]) =>
    options.find((option) => option.toLowerCase() === String(value ?? "").toLowerCase());

  useEffect(() => {
    if (initialData) {
      setForm({ 
        ...defaultForm, 
        title: initialData.title || "", 
        description: initialData.description || "",
        bannerImageUrl: initialData.bannerImageUrl || "",
        // The API stores these upper-cased (WEEKLY / DAILY / ACTIVE…) while the
        // Select options are title-cased, so the value has to be normalised or
        // the trigger finds no matching item and renders blank. The old chain
        // special-cased WEEKLY and MONTHLY and fell through for DAILY, which is
        // why a daily campaign opened with an empty Type.
        type: matchOption(initialData.type, TYPE_OPTIONS) ?? "Weekly",
        status: matchOption(initialData.status, STATUS_OPTIONS) ?? "Active",
        startDate: toDateInputValue(initialData.startDate),
        drawDate: toDateInputValue(initialData.drawDate),
        wagering: initialData.wagering,
        wagerAmount: Number(initialData.wagerAmount ?? 1000),
        gamePlay: initialData.gamePlay,
        purchase: initialData.purchase,
        prizes: initialData.prizes?.length ? initialData.prizes : defaultForm.prizes,
        recurring: initialData.recurring,
        showOnHomepage: initialData.showOnHomepage,
        featured: initialData.featured,
        progressiveTickets: initialData.progressiveTickets,
      });
    } else {
      setForm(defaultForm);
    }
  }, [initialData, open]);

  useEffect(() => {
    if (!form.startDate) return;

    const maxDrawDate = getMaxDrawDateForType(form.type as CampaignTypeLabel, form.startDate);
    if (!maxDrawDate) return;

    setForm((prev: any) => {
      if (!prev.startDate) return prev;

      let nextDrawDate = prev.drawDate;

      if (nextDrawDate && nextDrawDate <= prev.startDate) {
        nextDrawDate = "";
      }

      if (nextDrawDate && nextDrawDate > maxDrawDate) {
        nextDrawDate = maxDrawDate;
      }

      return nextDrawDate === prev.drawDate ? prev : { ...prev, drawDate: nextDrawDate };
    });
  }, [form.type, form.startDate]);

  const handleChange = (key: string, value: any) => {
    setForm((prev: any) => {
      const next = { ...prev, [key]: value };

      if (key === "showOnHomepage" && !value) {
        next.featured = false;
      }

      if (key === "featured" && value) {
        next.showOnHomepage = true;
        next.status = "Active";
      }

      if (key === "status" && value !== "Active") {
        next.showOnHomepage = false;
        next.featured = false;
      }

      return next;
    });
  };

  const handleTypeChange = (value: CampaignTypeLabel) => {
    setForm((prev: any) => {
      const next = {
        ...prev,
        type: value,
        recurring: value === "Daily" ? true : prev.recurring,
      };
      if (!next.startDate) return next;

      const maxDrawDate = getMaxDrawDateForType(value, next.startDate);
      if (next.drawDate && maxDrawDate && next.drawDate > maxDrawDate) {
        next.drawDate = maxDrawDate;
      }

      return next;
    });
  };

  const handleStartDateChange = (value: string) => {
    setForm((prev: any) => {
      const next = { ...prev, startDate: value };

      if (!value) {
        next.drawDate = "";
        return next;
      }

      const maxDrawDate = getMaxDrawDateForType(next.type as CampaignTypeLabel, value);

      if (next.drawDate && next.drawDate <= value) {
        next.drawDate = "";
      }

      if (next.drawDate && maxDrawDate && next.drawDate > maxDrawDate) {
        next.drawDate = maxDrawDate;
      }

      return next;
    });
  };

  const handleDrawDateChange = (value: string) => {
    setForm((prev: any) => {
      const maxDrawDate = getMaxDrawDateForType(prev.type as CampaignTypeLabel, prev.startDate);
      let nextDrawDate = value;

      if (prev.startDate && nextDrawDate && nextDrawDate <= prev.startDate) {
        nextDrawDate = prev.startDate;
      }

      if (maxDrawDate && nextDrawDate && nextDrawDate > maxDrawDate) {
        nextDrawDate = maxDrawDate;
      }

      return { ...prev, drawDate: nextDrawDate };
    });
  };

  const handlePrizeChange = (index: number, key: string, value: any) => {
    const newPrizes = [...form.prizes];
    newPrizes[index][key] = value;
    handleChange("prizes", newPrizes);
  };

  const parsePositionRange = (position: string, fallback: number) => {
    const clean = String(position || "").trim();

    if (clean.includes("-")) {
      const [fromRaw, toRaw] = clean.split("-");
      const from = Number(fromRaw.replace(/[^\d]/g, ""));
      const to = Number(toRaw.replace(/[^\d]/g, ""));
      if (Number.isFinite(from) && Number.isFinite(to) && from > 0 && to > 0) {
        return { from, to };
      }
    }

    const single = Number(clean.replace(/[^\d]/g, ""));
    if (Number.isFinite(single) && single > 0) {
      return { from: single, to: single };
    }

    return { from: fallback, to: fallback };
  };

  const getPositionMode = (position: string): "SINGLE" | "RANGE" => {
    return String(position || "").includes("-") ? "RANGE" : "SINGLE";
  };

  const handlePositionModeChange = (index: number, mode: "SINGLE" | "RANGE") => {
    const current = form.prizes[index];
    const { from, to } = parsePositionRange(current.position, index + 1);

    if (mode === "SINGLE") {
      handlePrizeChange(index, "position", `#${from}`);
      return;
    }

    const nextTo = to > from ? to : Math.min(from + 1, 100);
    handlePrizeChange(index, "position", `${from}-${nextTo}`);
  };

  const handlePositionRangeChange = (index: number, field: "from" | "to", value: number) => {
    const current = form.prizes[index];
    const { from: currentFrom, to: currentTo } = parsePositionRange(current.position, index + 1);

    let from = field === "from" ? value : currentFrom;
    let to = field === "to" ? value : currentTo;

    if (from > to) {
      if (field === "from") {
        to = from;
      } else {
        from = to;
      }
    }

    const position = from === to ? `#${from}` : `${from}-${to}`;
    handlePrizeChange(index, "position", position);
  };

  const addPrize = () => {
    const newPrize = { id: Date.now(), position: `#${form.prizes.length + 1}`, name: "", type: "Wulf Cash", value: 0, delivery: "Auto Credit", wageringMultiplier: 0 };
    handleChange("prizes", [...form.prizes, newPrize]);
  };

  const removePrize = (index: number) => {
    const newPrizes = form.prizes.filter((_: any, i: number) => i !== index);
    handleChange("prizes", newPrizes);
  };

  const validate = () => {
    if (!form.title.trim()) {
      toast.error("Campaign name is required");
      return false;
    }
    if (!form.startDate) {
      toast.error("Start date is required");
      return false;
    }
    if (!form.drawDate) {
      toast.error("Draw date is required");
      return false;
    }
    if (new Date(form.startDate) >= new Date(form.drawDate)) {
      toast.error("Start date must be before draw date");
      return false;
    }
    // A draw time already in the past is drawn the moment the cron or the next
    // admin page load sees it — with no tickets yet, that closes the campaign
    // as NO_ENTRIES seconds after it was created. Only block a draw date the
    // admin is actually choosing now; an existing past one stays editable.
    const drawDateChanged =
      !initialData || form.drawDate !== toDateInputValue(initialData.drawDate);
    if (drawDateChanged && (parseDateInputValue(form.drawDate)?.getTime() ?? 0) <= Date.now()) {
      toast.error("Draw date must be in the future");
      return false;
    }
    const maxDrawDate = getMaxDrawDateForType(form.type as CampaignTypeLabel, form.startDate);
    if (maxDrawDate && form.drawDate > maxDrawDate) {
      toast.error(getTypeDurationLabel(form.type as CampaignTypeLabel));
      return false;
    }
    if (!form.prizes || form.prizes.length === 0) {
      toast.error("At least one prize is required");
      return false;
    }
    for (let i = 0; i < form.prizes.length; i++) {
        const p = form.prizes[i];
        if (!p.name.trim()) {
            toast.error(`Prize #${i + 1} name is required`);
            return false;
        }
        if (p.value <= 0) {
            toast.error(`Prize #${i + 1} value must be greater than 0`);
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
      await onSubmit({
        ...form,
        prizes: (form.prizes as RafflePrize[]).map((prize, index) => ({
          ...prize,
          position: prize.position || `#${index + 1}`,
          value: Number(prize.value || 0),
          // 0 is the off switch (credited instantly); negatives are meaningless
          // and the backend rejects them. Wulf Coin has no rollover at all, so
          // it always sends 0.
          wageringMultiplier:
            prize.type === "Wulf Coin"
              ? 0
              : Math.max(0, Number(prize.wageringMultiplier || 0)),
        })),
      });
      onClose();
    } catch {
      // Parent's onSubmit already shows the error toast; just keep modal open.
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full bg-[#242B35] text-white text-sm rounded-md px-3 py-2 outline-none border-none focus:ring-1 focus:ring-[#C56CFF] transition-all placeholder:text-gray-500";
  const labelClass = "text-[11px] text-gray-300 mb-1.5 block";
  const maxDrawDate = getMaxDrawDateForType(form.type as CampaignTypeLabel, form.startDate);
  const nowDateInputValue = formatDateInputValue(new Date());
  const activeHomepageCampaigns = campaigns.filter(
    (campaign) =>
      campaign.id !== initialData?.id &&
      campaign.status === "ACTIVE" &&
      campaign.showOnHomepage,
  );
  const homepageLimitReached = activeHomepageCampaigns.length >= 3;
  const homepageSelectionDisabled =
    form.status !== "Active" || (homepageLimitReached && !form.showOnHomepage);
  const featuredSelectionDisabled =
    form.status !== "Active" ||
    (!form.showOnHomepage && homepageLimitReached) ||
    !form.showOnHomepage;
  const dailyCampaignRecurringLocked = form.type === "Daily";
  
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] lg:w-auto lg:min-w-[1050px] max-h-[90vh] p-0 bg-[#1A1E26] text-white border border-[#2A2F3A] shadow-2xl [&>button]:hidden overflow-y-auto scrollbar-hide ">
        
        {/* HEADER */}
        <div className="p-5 flex items-start justify-between gap-4">
          <DialogTitle className="text-xl font-bold text-white tracking-wide">
            {initialData ? "Edit Jackpot Campaign" : "Add New Jackpot Campaign"}
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
        <div className="p-7 overflow-y-auto max-h-[75vh]" style={{ scrollbarWidth: "thin", scrollbarColor: "#2A2F3A #15181E" }}>
          <div className="space-y-6">
            
            {/* Title */}
            <div>
              <label className={labelClass}>Campaign Name</label>
              <input
                placeholder="e.g. Weekly $100k Draw"
                className={inputClass}
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                placeholder="Description for Users..."
                className={inputClass + " min-h-[80px] py-3 resize-none"}
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Type */}
              <div>
                <Select
                  value={form.type}
                  onValueChange={(v) => handleTypeChange(v as CampaignTypeLabel)}
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div>
                <Select
                  value={form.status}
                  onValueChange={(v) => handleChange("status", v)}
                >
                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Banner upload removed: the player-facing jackpot page and
                homepage cards never render bannerImageUrl, so uploading one
                only produced an image nobody outside this table ever saw.
                Existing banners are left untouched — the field is simply no
                longer sent, so a stored URL stays as it is. */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Start Date */}
              <div>
                <label className={labelClass}>Start Date</label>
                <input
                  type="datetime-local"
                  className={inputClass + " text-gray-300"}
                  value={form.startDate}
                  max={form.drawDate || undefined}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </div>

              {/* Draw Date */}
              <div>
                <label className={labelClass}>Draw Date</label>
                <input
                  type="datetime-local"
                  className={inputClass + " text-gray-300"}
                  value={form.drawDate}
                  // Never earlier than the start, and never already past —
                  // a past draw time closes the campaign on the next cron tick.
                  min={
                    form.startDate && form.startDate > nowDateInputValue
                      ? form.startDate
                      : nowDateInputValue
                  }
                  max={maxDrawDate || undefined}
                  onChange={(e) => handleDrawDateChange(e.target.value)}
                />
                <p className="mt-1.5 text-[11px] text-gray-500">
                  {getTypeDurationLabel(form.type as CampaignTypeLabel)}
                </p>
              </div>
            </div>

            <div className="border-t border-[#2A2F3A]/50 w-full" />

            {/* Ticket Sources */}
            <div>
              <label className={labelClass}>Ticket Sources</label>
              <div className="space-y-3 mt-2">
                <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded bg-[#15181E] border border-[#2A2F3A] accent-[#C56CFF]"
                    checked={form.wagering}
                    onChange={(e) => handleChange("wagering", e.target.checked)}
                  />
                  <span className="text-sm font-semibold">Wagering</span>
                  <div className="flex items-center gap-2 ml-0 md:ml-4 w-full md:w-auto">
                    <span className="text-xs text-gray-400">1 Ticket Per</span>
                    <div className="relative flex items-center">
                      <input 
                        type="number" 
                        className={inputClass + " w-[90px] pl-2"}
                        value={form.wagerAmount}
                        onChange={(e) => handleChange("wagerAmount", Number(e.target.value))}
                      />
                    </div>
                    <span className="text-xs text-gray-400">Wagered</span>
                  </div>
                </div>

                {/* <div className="flex items-center gap-3 mt-4">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded bg-[#15181E] border border-[#2A2F3A] accent-[#C56CFF]"
                    checked={form.gamePlay}
                    onChange={(e) => handleChange("gamePlay", e.target.checked)}
                  />
                  {/* <span className="text-sm font-semibold">Game Play</span> */}
                {/* </div> */} 

                {/* <div className="flex items-center gap-3 mt-4">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded bg-[#15181E] border border-[#2A2F3A] accent-[#C56CFF]"
                    checked={form.purchase}
                    onChange={(e) => handleChange("purchase", e.target.checked)}
                  />
                  <span className="text-sm font-semibold">Purchase</span>
                </div> */}
              </div>
            </div>

            {/* Prizes */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={labelClass + " !mb-0"}>Prizes</label>
                <button onClick={addPrize} className="text-[#C56CFF] text-xs hover:underline flex items-center gap-1 font-semibold">
                  + Add Prize
                </button>
              </div>
              
              <div className="space-y-4">
                {form.prizes.map((prize: any, index: number) => (
                  <div key={prize.id} className="border border-[#2A2F3A] rounded-lg p-5 bg-[#1A1F28]/50 flex flex-col lg:flex-row items-start gap-4 relative">
                    {(() => {
                      const { from, to } = parsePositionRange(prize.position, index + 1);
                      const positionMode = getPositionMode(prize.position);
                      return (
                        <>
                          <div className="flex flex-col items-center w-full lg:w-auto lg:min-w-[120px]">
                            <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">POSITION</span>
                            <Select
                              value={positionMode}
                              onValueChange={(v) => handlePositionModeChange(index, v as "SINGLE" | "RANGE")}
                            >
                              <SelectTrigger className="mt-2 w-full h-9 bg-[#242B35] border-none text-white text-xs">
                                <SelectValue placeholder="Mode" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SINGLE">Single Position</SelectItem>
                                <SelectItem value="RANGE">Range</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className={`mt-1.5 w-full grid gap-1.5 ${positionMode === "RANGE" ? "grid-cols-2" : "grid-cols-1"}`}>
                              {positionMode === "SINGLE" ? (
                                <Select
                                  value={String(from)}
                                  onValueChange={(v) => handlePositionRangeChange(index, "from", Number(v))}
                                >
                                  <SelectTrigger className="bg-[#242B35] border-none text-white text-sm h-10">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {positionOptions.map((option) => (
                                      <SelectItem key={`single-${option}`} value={String(option)}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <>
                                  <Select
                                    value={String(from)}
                                    onValueChange={(v) => handlePositionRangeChange(index, "from", Number(v))}
                                  >
                                    <SelectTrigger className="bg-[#242B35] border-none text-white text-sm h-10">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {positionOptions.map((option) => (
                                        <SelectItem key={`from-${option}`} value={String(option)}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={String(to)}
                                    onValueChange={(v) => handlePositionRangeChange(index, "to", Number(v))}
                                  >
                                    <SelectTrigger className="bg-[#242B35] border-none text-white text-sm h-10">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {positionOptions.map((option) => (
                                        <SelectItem key={`to-${option}`} value={String(option)}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </>
                              )}
                            </div>
                            <span className="text-[9px] text-gray-500 mt-1">{positionMode === "RANGE" ? "From / To" : "Position"}</span>
                          </div>

                          <div className="flex-1 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <span className="block text-[10px] text-gray-400 mb-1">Name</span>
                                <input className={inputClass} placeholder="Enter Prize Name" value={prize.name} onChange={e => handlePrizeChange(index, "name", e.target.value)} />
                              </div>
                              <div>
                                <span className="block text-[10px] text-gray-400 mb-1">Type</span>
                                <div className="relative">
                                  <Select
                                    value={prize.type}
                                    onValueChange={(v) => handlePrizeChange(index, "type", v)}
                                  >
                                    <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Wulf Cash">
                                        <div className="flex items-center gap-2">
                                          <Image src={coingreen} alt="coin" width={16} height={16} />
                                          <span>Wulf Cash</span>
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="Wulf Coin">
                                        <div className="flex items-center gap-2">
                                          <Image src={coingold} alt="coin" width={16} height={16} />
                                          <span>Wulf Coin</span>
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>

                            <div className={`grid gap-3 grid-cols-1 md:${prize.type === "Wulf Coin" ? "grid-cols-2" : "grid-cols-3"}`}>
                              <div>
                                <span className="block text-[10px] text-gray-400 mb-1">Delivery</span>
                                <Select
                                  value={prize.delivery}
                                  onValueChange={(v) => handlePrizeChange(index, "delivery", v)}
                                >
                                  <SelectTrigger className="w-full h-10 bg-[#242B35] border-none text-white">
                                    <SelectValue placeholder="Select delivery" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Auto Credit">Auto Credit</SelectItem>
                                    <SelectItem value="Manual Contact">Manual Contact</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <span className="flex items-center gap-1 text-[10px] text-gray-400 mb-1">
                                  Prize Value 
                                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50 flex flex-col items-center justify-center">
                                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                  </span>
                                </span>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    className={inputClass + " pl-8"} 
                                    value={prize.value} 
                                    onChange={e => handlePrizeChange(index, "value", Number(e.target.value))} 
                                  />
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <Image
                                      src={prize.type === "Wulf Coin" ? coingold : coingreen}
                                      alt="coin"
                                      width={14}
                                      height={14}
                                    />
                                  </div>
                                </div>
                              </div>
                              {/* Wulf Coin is play money with no rollover, so a
                                  multiplier there would lock the prize with
                                  nothing able to release it. */}
                              {prize.type !== "Wulf Coin" && (
                                <div>
                                  <span className="block text-[10px] text-gray-400 mb-1">
                                    Wagering Multiplier
                                  </span>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      className={inputClass + " pr-7"}
                                      value={prize.wageringMultiplier ?? 0}
                                      onChange={e =>
                                        handlePrizeChange(index, "wageringMultiplier", Number(e.target.value))
                                      }
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                      x
                                    </span>
                                  </div>
                                  <span className="block text-[9px] text-gray-500 mt-1">
                                    {Number(prize.wageringMultiplier ?? 0) > 0
                                      ? `Winner must wager ${(Number(prize.value || 0) * Number(prize.wageringMultiplier)).toLocaleString()} before withdrawing`
                                      : "0 = credited instantly, no rollover"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePrize(index)}
                            disabled={form.prizes.length <= 1}
                            title="Delete prize"
                            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0 absolute top-2 right-2 lg:relative lg:top-0 lg:right-0 lg:self-start mt-1"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      );
                    })()}

                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Config Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              
              <div className="border border-[#2A2F3A] rounded-xl p-4 py-5 flex items-center gap-3 bg-[#15181E]/30">
                 <input
                   type="checkbox"
                   checked={dailyCampaignRecurringLocked ? true : form.recurring}
                   disabled={dailyCampaignRecurringLocked}
                   onChange={e => handleChange("recurring", e.target.checked)}
                   className="w-4 h-4 rounded bg-[#1A1F28] border border-[#2A2F3A] accent-[#C56CFF] disabled:opacity-60 disabled:cursor-not-allowed"
                 />
                 <span className="text-[13px] font-semibold">
                   Recurring Campaign
                   {dailyCampaignRecurringLocked ? " (Auto-enabled for Daily)" : ""}
                 </span>
              </div>
              <p className="text-[11px] text-gray-500 -mt-2">
                Daily jackpots automatically create the next day&apos;s campaign with the same prize pool.
              </p>
              
              <div className="border border-[#2A2F3A] rounded-xl p-4 flex flex-col justify-center space-y-4 bg-[#15181E]/30">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.showOnHomepage}
                    disabled={homepageSelectionDisabled}
                    onChange={e => handleChange("showOnHomepage", e.target.checked)}
                    className="w-4 h-4 rounded bg-[#1A1F28] border border-[#2A2F3A] accent-[#C56CFF] disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <span className={`text-[13px] font-semibold ${homepageSelectionDisabled ? "text-gray-500" : ""}`}>
                    Show on Homepage (Live Events)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    disabled={featuredSelectionDisabled}
                    onChange={e => handleChange("featured", e.target.checked)}
                    className="w-4 h-4 rounded bg-[#1A1F28] border border-[#2A2F3A] accent-[#C56CFF] disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <span className={`text-[13px] font-semibold ${featuredSelectionDisabled ? "text-gray-500" : "text-gray-400"}`}>
                    Featured Campaign (Hero Banner)
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-500">
                    Up to 3 active campaigns can be shown on the homepage. Each one gets its own card in the Live Events section.
                  </p>
                  {homepageLimitReached && !form.showOnHomepage && (
                    <p className="text-[11px] text-gray-500">
                      Homepage limit reached. Turn off one of the other homepage campaigns first.
                    </p>
                  )}
                  <p className="text-[11px] text-gray-500">
                    Hero banner can only be enabled for an active homepage campaign.
                  </p>
                </div>
              </div>

              <div className="border border-[#2A2F3A] rounded-xl p-4 py-5 flex items-center justify-between col-span-1 md:col-span-2 bg-[#15181E]/30">
                 <div className="flex flex-col gap-1">
                   <span className="text-[13px] font-semibold">Progressive Tickets</span>
                   <span className="text-[11px] text-gray-500">
                     {form.progressiveTickets
                       ? "On: one ticket every time the wager threshold is reached again."
                       : "Off: one ticket per player, once the wager threshold is reached."}
                   </span>
                 </div>
                 <input type="checkbox" checked={form.progressiveTickets} onChange={e => handleChange("progressiveTickets", e.target.checked)} className="w-4 h-4 rounded bg-[#1A1F28] border border-[#2A2F3A] accent-[#C56CFF]" />
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
            {isSubmitting ? "Saving..." : initialData ? "Update Campaign" : "Create Campaign"}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
