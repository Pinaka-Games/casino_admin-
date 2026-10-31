"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { resolveRtp } from "@/api/games/games";
import { GameConfigItem } from "../types";

interface Props {
  providerId: string | number;
  categoryId: string | number;
  item: GameConfigItem;
  /** Auto-curated card (e.g. Hot Games) — no edit toggles, read-only status */
  readOnly?: boolean;
  onToggle: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void | Promise<void>;
  onToggleFeatured?: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void;
  onToggleNew?: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void;
}

export default function GameItem({
  providerId,
  categoryId,
  item,
  onToggle,
}: Props) {
  const getImageUrl = () => {
    const thumbnail = item.thumbnail;
    if (!thumbnail) return getDefaultPlaceholder();

    // 1. Direct string
    if (typeof thumbnail === "string") return thumbnail;

    // 2. Direct url string inside object
    if (typeof thumbnail?.url === "string") return thumbnail.url;

    // 3. Nested url object (SA Gaming style)
    if (typeof thumbnail?.url === "object" && thumbnail.url !== null) {
      const urls = thumbnail.url as Record<string, string>;
      // Prioritize specific sizes that look good in the UI
      return urls.s300x200 || urls.s660x380 || urls.s512x512 || urls.s208x147 || Object.values(urls).find(val => typeof val === "string") || getDefaultPlaceholder();
    }

    return getDefaultPlaceholder();
  };

  const getDefaultPlaceholder = () => `https://placehold.co/300x200/1a2030/white?text=${encodeURIComponent(item.name)}`;

  const [imgLoaded, setImgLoaded] = useState(false);

  // Optimistic enable state: flip the switch instantly, then persist. Revert if
  // the API call fails. Re-syncs whenever fresh data arrives from the server.
  const [active, setActive] = useState(item.isActive);
  const [saving, setSaving] = useState(false);
  useEffect(() => setActive(item.isActive), [item.isActive]);

  // RTP: the figure recorded for this game — the admin override where one is
  // set, else the provider's. Null means neither exists, and the badge then
  // invites one to be typed rather than printing a 0% nobody published.
  // Read-only: the provider's own figure, or nothing at all when they publish
  // none. Nothing in this console changes what a game pays.
  const rtp = resolveRtp(item);

  const handleSwitch = async (value: boolean) => {
    setActive(value);
    setSaving(true);
    try {
      await onToggle(providerId, categoryId, item.id, value);
    } catch {
      setActive(!value); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`relative group overflow-hidden rounded-xl border bg-[#1a2030] transition-all duration-300 hover:border-[#B93DEB]/50 hover:shadow-lg hover:shadow-[#B93DEB]/10 h-[180px] flex flex-col ${
        item.queued ? "border-dashed border-gray-700/70" : "border-gray-800"
      }`}
    >
      {/* GAME IMAGE */}
      <div className="relative h-28 w-full overflow-hidden bg-[#15181E]">
        {/* Rank in an auto-ranked group, and whether that rank is high enough to
            be on the home page today. A queued card is what gets promoted when
            one of the live games above it is switched off. */}
        {item.rank ? (
          <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                item.queued
                  ? "bg-[#15181E]/90 text-gray-400 border border-gray-700"
                  : "bg-[#B93DEB] text-white"
              }`}
            >
              #{item.rank}
            </span>
            {item.queued ? (
              <span className="rounded bg-[#15181E]/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400 border border-amber-500/30">
                Next up
              </span>
            ) : null}
          </div>
        ) : null}
        {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-gray-700/40" />}
        <img
          src={getImageUrl()}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(true)}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-110 ${imgLoaded ? "opacity-100" : "opacity-0"} ${item.queued ? "grayscale-[0.6] opacity-70" : ""}`}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2030] to-transparent opacity-60" />

        {/* RTP BADGE — top-RIGHT, clear of the rank badge an auto-ranked group
            draws on the left. */}
        {rtp !== null ? (
          <div
            className="absolute right-2 top-2 z-10 rounded-md border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur-md"
            title="RTP reported by the provider"
          >
            {rtp}%
          </div>
        ) : null}
      </div>

      {/* CONTENT */}
      <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-white text-[11px] font-medium leading-tight truncate"
            title={item.name}
          >
            {item.name}
          </span>

          <Switch
            checked={active}
            disabled={saving}
            onCheckedChange={handleSwitch}
            className="scale-75 origin-right cursor-pointer disabled:cursor-not-allowed data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
          />
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${item.isActive ? "bg-green-500 animate-pulse" : "bg-gray-500"
                }`}
            />

            <span className="text-[9px] text-gray-400 font-mono uppercase">
              ID: {String(item.id).slice(0, 8)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="px-2 py-0.5 bg-purple-500/10 rounded text-[9px] text-purple-400 border border-purple-500/20 font-medium"
              title={
                item.trendingScore === undefined
                  ? `Lifetime rounds played${
                      item.totalLaunches === undefined
                        ? ""
                        : ` · ${item.totalLaunches} launches`
                    }`
                  : "Bets in the last 7 days — what ranks this group"
              }
            >
              {item.trendingScore === undefined
                ? `${item.totalPlays || 0} Plays`
                : `${item.trendingScore} bets / 7d`}
            </div>
            {/* <div className="px-2 py-0.5 bg-[#242B35] rounded text-[9px] text-gray-300 border border-gray-700">
              {item.displayOrder}
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}