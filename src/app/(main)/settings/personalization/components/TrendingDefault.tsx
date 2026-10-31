"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Menu } from "lucide-react";
import Image from "next/image";

import { notfound } from "@/assets/icons";
import EmptyStatePage from "@/components/emptystatePage";
import dynamic from "next/dynamic";
import GameCardSkeletonGrid from "./GameCardSkeletonGrid";

// Heavy modal (drag, multi-segment, game browse) — load only when opened.
const OverrideModal = dynamic(() => import("./OverrideModal"), { ssr: false });
import { type SegmentType } from "@/api/personalization/personalization.api";
import { getThumbnailUrl, normalizeCategory } from "@/api/games/games";
import type { Game } from "@/api/games/games";
import { usePersonalizationStore } from "@/store/personalization-store";

const SEGMENT_TYPE: SegmentType = "default";
const SEGMENT_VALUE = "All";
const GAME_CATEGORIES = ["All", "Slots", "Live casino", "Table games", "Fast games"];
const COLLAPSED_COUNT = 8;

function Section({ data, expanded }: { data: Game[]; expanded: boolean }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isTouchDevice =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const visible = useMemo(
    () => (expanded ? data : data.slice(0, COLLAPSED_COUNT)),
    [expanded, data]
  );

  return (
    <div className="mb-2 min-w-0">
      <div className={`${expanded ? "overflow-x-hidden" : "overflow-x-auto scrollbar-hide"} overflow-y-visible pt-2 pb-2`}>
        <div className={expanded
            ? "grid grid-cols-[repeat(auto-fit,140px)] justify-between gap-x-4 gap-y-5"
            // Collapsed: a plain flex row ran past the right edge with no way
            // to reach the cards beyond it. Scrolls instead, and the cards keep
            // their size rather than being squeezed.
            : "flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide [&>*]:shrink-0"}>
          {visible.map((game) => (
            <div
              key={game.id}
              onMouseEnter={() => {
                if (!isTouchDevice) setHoveredId(game.id);
              }}
              onMouseLeave={() => {
                if (!isTouchDevice) setHoveredId(null);
              }}
              style={{
                transform: hoveredId === game.id ? "translateY(-8px)" : "translateY(0px)",
                transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform",
              }}
              className="relative w-[140px] shrink-0 cursor-pointer touch-none md:touch-auto"
            >
              <div className="relative w-full aspect-3/4 rounded-xl overflow-hidden bg-[#1A2027]">
                {getThumbnailUrl(game.thumbnail) ? (
                  <Image
                    src={getThumbnailUrl(game.thumbnail)!}
                    alt={game.name}
                    fill
                    sizes="(max-width: 640px) 50vw,(max-width: 1024px) 25vw,12vw"
                    className="object-cover transition-transform duration-300"
                    style={{ transform: hoveredId === game.id ? "scale(1.1)" : "scale(1)" }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#1A2027]">
                    <span className="text-gray-500 text-xs text-center px-2">{game.name}</span>
                  </div>
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundColor:
                      hoveredId === game.id ? "rgba(0,0,0,0.24)" : "rgba(0,0,0,0)",
                    transition: "background-color 200ms ease",
                  }}
                />
                <div
                  className="absolute top-6 left-0 right-0 text-center pointer-events-none"
                  style={{
                    opacity: hoveredId === game.id ? 1 : 0,
                    transform: hoveredId === game.id ? "translateY(0)" : "translateY(6px)",
                    transition: "all 200ms ease",
                  }}
                >
                  <p className="text-white text-sm font-semibold px-2 truncate">{game.name}</p>
                </div>
              </div>
              <div className="text-center pt-2 pointer-events-none">
                <p className="text-[#8292AA] text-md font-normal">{game.totalPlays ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TrendingDefault() {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(GAME_CATEGORIES[0]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const fetchRuleWithGames = usePersonalizationStore(
    (state) => state.fetchRuleWithGames
  );
  const personalizationEnabled = usePersonalizationStore(
    (state) => state.personalizationEnabled
  );

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRuleWithGames(SEGMENT_TYPE, SEGMENT_VALUE);
      setGames(data.games ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [fetchRuleWithGames, personalizationEnabled]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const filteredGames = useMemo(() => {
    if (selectedCategory === "All") {
      return games.filter((g) => getThumbnailUrl(g.thumbnail) !== null);
    }

    return games.filter(
      (g) =>
        getThumbnailUrl(g.thumbnail) !== null &&
        normalizeCategory(g.category) === selectedCategory
    );
  }, [games, selectedCategory]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false);
      }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="w-full bg-[#191D24] px-4 pt-4 rounded-2xl">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-400 text-md">
            Access by <span className="text-white">Default</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-6">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-gray-400 text-sm">Filter by Categories:</span>
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowCategoryMenu((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-transparent text-white rounded-lg hover:bg-gray-800/50 transition-colors text-sm font-medium"
              >
                {selectedCategory}
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showCategoryMenu ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>
              {showCategoryMenu && (
                <div className="absolute -right-12 top-full mt-2 w-44 bg-[#15181E] rounded-lg shadow-xl z-50 border border-purple-700 py-2 animate-in fade-in zoom-in-95">
                  {GAME_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setShowCategoryMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        selectedCategory === cat
                          ? "text-purple-500 bg-gray-800/40"
                          : "text-white hover:bg-gray-800/60"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-gray-400 text-sm">Override Access</span>
            <button
              onClick={() => setShowOverrideModal(true)}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            {filteredGames.length > COLLAPSED_COUNT && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-sm font-medium text-[#B93DEB] hover:text-[#a02dd1] transition-colors whitespace-nowrap"
              >
                {expanded ? "Show Less" : "View All"}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <GameCardSkeletonGrid count={COLLAPSED_COUNT} />
      ) : filteredGames.length === 0 ? (
        <div className="text-center">
          <EmptyStatePage type="default" imageWidth={180} imageHeight={160} image={notfound} />
        </div>
      ) : (
        <Section data={filteredGames} expanded={expanded} />
      )}

      <OverrideModal
        isOpen={showOverrideModal}
        onClose={() => {
          setShowOverrideModal(false);
          fetchGames();
        }}
        segmentType={SEGMENT_TYPE}
        segmentValue={SEGMENT_VALUE}
      />
    </div>
  );
}
