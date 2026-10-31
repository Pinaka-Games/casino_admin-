"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { useGameStore } from "@/store/game-store";

/**
 * Size picker for the home page's "Trending Now" rail.
 *
 * The rail is ranked by play activity, so unlike every other marketing group it
 * has no curated list to open — how many games it shows is the only thing there
 * is to configure, which is why this lives in the group header rather than in
 * Settings.
 */
export default function TrendingLimitControl() {
  const trendingLimit = useGameStore((s) => s.trendingLimit);
  const bounds = useGameStore((s) => s.trendingLimitBounds);
  const saving = useGameStore((s) => s.trendingSaving);
  const setTrendingLimit = useGameStore((s) => s.setTrendingLimit);
  const recalculate = useGameStore((s) => s.recalculateTrending);
  const [rescoring, setRescoring] = useState(false);

  // Local draft so typing a two-digit number doesn't fire a save per keystroke.
  const [draft, setDraft] = useState(String(trendingLimit));
  useEffect(() => setDraft(String(trendingLimit)), [trendingLimit]);

  const commit = async () => {
    const next = Number(draft);
    if (!Number.isFinite(next) || next === trendingLimit) {
      setDraft(String(trendingLimit));
      return;
    }
    // The backend clamps too — this only keeps the field from showing a value
    // that was never going to be saved.
    const clamped = Math.min(bounds.max, Math.max(bounds.min, Math.trunc(next)));
    try {
      await setTrendingLimit(clamped);
      toast.success(`Trending Now shows ${clamped} games`);
    } catch {
      setDraft(String(trendingLimit));
      toast.error("Failed to update Trending Now size");
    }
  };

  // The ranking runs off popularity scores the worker refreshes hourly, so a
  // burst of play is not reflected until that job fires. This queues it now.
  const handleRecalculate = async () => {
    setRescoring(true);
    try {
      await recalculate();
      toast.success("Ranking rescore queued — refresh in a minute to see the new order");
    } catch {
      toast.error("Failed to queue the rescore");
    } finally {
      setRescoring(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md border border-gray-700/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Auto-ranked by plays
      </span>
      <button
        onClick={handleRecalculate}
        disabled={rescoring}
        title="Recompute the play-activity scores this ranking is built from"
        className="flex items-center gap-1.5 rounded-md border border-gray-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-300 transition-colors hover:border-[#B93DEB] hover:text-[#B93DEB] disabled:opacity-50"
      >
        <RefreshCw size={11} className={rescoring ? "animate-spin" : ""} />
        <span>Recalculate</span>
      </button>
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
        <span>Show</span>
        <input
          type="number"
          min={bounds.min}
          max={bounds.max}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft(String(trendingLimit));
          }}
          className="w-14 rounded-md border border-gray-700 bg-[#15181E] px-2 py-1 text-center text-[11px] font-bold text-white outline-none transition-colors focus:border-[#B93DEB] disabled:opacity-50"
        />
        <span className="text-gray-500 normal-case font-normal">
          of {bounds.min}–{bounds.max}
        </span>
      </label>
    </div>
  );
}
