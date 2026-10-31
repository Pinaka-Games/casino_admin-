"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ChevronDown, X, GripVertical, Plus, Users } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

import { getAdminGamesPaged, getProvidersSummary, getThumbnailUrl, type Game } from "@/api/games/games";
import GameCardSkeletonGrid from "./GameCardSkeletonGrid";
import Pagination from "@/components/Pagination";
import { type SegmentType } from "@/api/personalization/personalization.api";
import { usePersonalizationStore } from "@/store/personalization-store";

const BROWSE_LIMIT = 60; // games per browse page

/** Merge games into a pool, deduped by id (later wins) */
function mergeGamesById(pool: Game[], incoming: Game[]): Game[] {
  if (incoming.length === 0) return pool;
  const map = new Map(pool.map((g) => [g.id, g]));
  incoming.forEach((g) => map.set(g.id, g));
  return Array.from(map.values());
}

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  segmentType: SegmentType;
  segmentValue: string;
}

interface ModalGame extends Game { _order?: number; }

const SEGMENT_LABELS: Record<SegmentType, string> = {
  default: "Default",
  age_group: "Age Group",
  country: "Country",
  ethnicity: "Ethnicity",
  gender: "Gender",
  state: "State",
};

const SEGMENT_OPTIONS: Record<SegmentType, string[]> = {
  default: ["All"],
  age_group: ["All", "18-24", "25-34", "35-44", "45-54", "55+"],
  country: ["All", "US", "UK", "Canada", "Australia", "Germany", "France"],
  ethnicity: ["All", "American", "African", "Asian", "European"],
  gender: ["All", "Male", "Female", "Non-binary"],
  state: ["All", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Kolkata", "Chennai"],
};

export default function OverrideModal({
  isOpen, onClose, segmentType, segmentValue,
}: OverrideModalProps) {
  const isDefaultSegment = segmentType === "default";
  const fetchRuleWithGames = usePersonalizationStore(
    (state) => state.fetchRuleWithGames
  );
  const fetchRulesBySegmentType = usePersonalizationStore(
    (state) => state.fetchRulesBySegmentType
  );
  const saveRule = usePersonalizationStore((state) => state.saveRule);
  const removeRule = usePersonalizationStore((state) => state.removeRule);
  const [activeSegmentValues, setActiveSegmentValues] = useState<string[]>([]);
  const [segmentOptions, setSegmentOptions] = useState<string[]>(SEGMENT_OPTIONS[segmentType] ?? ["All"]);
  const [segmentRuleIdsByValue, setSegmentRuleIdsByValue] = useState<Record<string, string>>({});
  const [segmentGameIdsByValue, setSegmentGameIdsByValue] = useState<Record<string, string[]>>({});
  const [customSegmentInput, setCustomSegmentInput] = useState("");
  const [allGames, setAllGames] = useState<ModalGame[]>([]); // selection pool (rule games), for resolving the ordered strip
  const [orderedGames, setOrderedGames] = useState<ModalGame[]>([]);
  const [providerOptions, setProviderOptions] = useState<string[]>([]);
  const [categoryOptionsState, setCategoryOptionsState] = useState<string[]>([]);
  const [browseGames, setBrowseGames] = useState<Game[]>([]); // current paginated page
  const [browsePage, setBrowsePage] = useState(1);
  const [browseMeta, setBrowseMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [browseLoading, setBrowseLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [segmentLoading, setSegmentLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add-game form
  const [addProvider, setAddProvider] = useState("All");
  const [addCategory, setAddCategory] = useState("All");
  const [showAddProvDd, setShowAddProvDd] = useState(false);
  const [showAddCatDd, setShowAddCatDd] = useState(false);

  // Bottom grid filters
  const [filterProvider, setFilterProvider] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showFilterProvDd, setShowFilterProvDd] = useState(false);
  const [showFilterCatDd, setShowFilterCatDd] = useState(false);

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const addProvRef = useRef<HTMLDivElement>(null);
  const addCatRef = useRef<HTMLDivElement>(null);
  const filterProvRef = useRef<HTMLDivElement>(null);
  const filterCatRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (addProvRef.current && !addProvRef.current.contains(e.target as Node)) setShowAddProvDd(false);
      if (addCatRef.current && !addCatRef.current.contains(e.target as Node)) setShowAddCatDd(false);
      if (filterProvRef.current && !filterProvRef.current.contains(e.target as Node)) setShowFilterProvDd(false);
      if (filterCatRef.current && !filterCatRef.current.contains(e.target as Node)) setShowFilterCatDd(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Load games on open
  useEffect(() => {
    if (!isOpen) return;
    const initialValues = segmentValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    setActiveSegmentValues(initialValues.length ? initialValues : ["All"]);
    setCustomSegmentInput("");
    setSegmentGameIdsByValue({});
  }, [isOpen, segmentValue]);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setLoading(true);
      try {
        const initialValues = segmentValue
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        const valuesToLoad = initialValues.length ? initialValues : ["All"];

        // No more full-table load: provider list comes from the cheap summary,
        // selected games come from each rule's own `games`, and the browse pool
        // is fetched page-by-page by the separate browse effect below.
        const [summary, ruleResponses, existingRules] = await Promise.all([
          getProvidersSummary(),
          Promise.all(
            valuesToLoad.map((value) => fetchRuleWithGames(segmentType, value))
          ),
          fetchRulesBySegmentType(segmentType),
        ]);
        const dynamicOptions = Array.from(new Set([
          ...(SEGMENT_OPTIONS[segmentType] ?? ["All"]),
          ...existingRules.map((rule) => rule.segmentValue).filter(Boolean),
          ...activeSegmentValues,
        ]));
        const nextRuleIdsByValue = existingRules.reduce<Record<string, string>>((acc, rule) => {
          const key = rule.segmentValue.trim().toLowerCase();
          if (key) acc[key] = rule.id;
          return acc;
        }, {});
        const nextGameIdsByValue = ruleResponses.reduce<Record<string, string[]>>((acc, response, index) => {
          const key = valuesToLoad[index]?.trim().toLowerCase();
          if (key) {
            acc[key] = response.rule?.gameIds ?? [];
          }
          return acc;
        }, {});
        // Seed the pool with the selected games returned by the rules so the
        // ordered strip resolves even before any browse page is loaded.
        const seedGames = ruleResponses.flatMap((r) => r.games ?? []);
        setProviderOptions(summary.map((s) => s.provider).filter(Boolean));
        // Exact category values straight from the data (server-filterable).
        setCategoryOptionsState(
          Array.from(new Set(summary.flatMap((s) => s.categories.map((c) => c.name)).filter(Boolean))).sort()
        );
        setSegmentOptions(dynamicOptions);
        setSegmentRuleIdsByValue(nextRuleIdsByValue);
        setAllGames((prev) => mergeGamesById(prev, seedGames));
        setSegmentGameIdsByValue(nextGameIdsByValue);
      } catch { toast.error("Failed to load games"); }
      finally { setLoading(false); }
    };
    load();
  }, [fetchRuleWithGames, fetchRulesBySegmentType, isOpen, segmentType, segmentValue]);

  // Reset everything when the modal closes so reopening is clean.
  useEffect(() => {
    if (isOpen) return;
    setAllGames([]);
    setBrowseGames([]);
    setBrowsePage(1);
    setBrowseMeta({ page: 1, totalPages: 1, total: 0 });
    setFilterProvider("All");
    setFilterCategory("All");
  }, [isOpen]);

  // Server-paginated browse grid. Both provider and category are filtered
  // server-side (exact values from the summary). One request at a time +
  // abort of the stale request → no fetch storm on rapid filter/page changes.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBrowseLoading(true);
    getAdminGamesPaged(
      {
        provider: filterProvider !== "All" ? filterProvider : undefined,
        category: filterCategory !== "All" ? filterCategory : undefined,
        page: browsePage,
        limit: BROWSE_LIMIT,
      },
      controller.signal,
    )
      .then((res) => {
        setBrowseGames(res.data.filter((g) => getThumbnailUrl(g.thumbnail) !== null));
        setBrowseMeta({ page: res.page, totalPages: res.totalPages, total: res.total });
      })
      .catch((err: any) => {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError" && err?.code !== "ERR_CANCELED") {
          toast.error("Failed to load games");
        }
      })
      .finally(() => {
        if (abortRef.current === controller) abortRef.current = null;
        setBrowseLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, filterProvider, filterCategory, browsePage]);

  useEffect(() => {
    if (!isOpen || loading || activeSegmentValues.length === 0) return;

    const missingValues = activeSegmentValues.filter((value) => {
      const normalizedValue = value.trim().toLowerCase();
      return normalizedValue && !(normalizedValue in segmentGameIdsByValue);
    });

    if (missingValues.length === 0) return;

    const loadMissing = async () => {
      setSegmentLoading(true);
      try {
        const ruleResponses = await Promise.all(
          missingValues.map((value) => fetchRuleWithGames(segmentType, value))
        );

        // Merge the rule's games into the pool so the ordered strip resolves.
        const seedGames = ruleResponses.flatMap((r) => r.games ?? []);
        setAllGames((prev) => mergeGamesById(prev, seedGames));

        setSegmentGameIdsByValue((prev) => {
          const next = { ...prev };
          ruleResponses.forEach((response, index) => {
            const key = missingValues[index]?.trim().toLowerCase();
            if (key) {
              next[key] = response.rule?.gameIds ?? [];
            }
          });
          return next;
        });
      } catch {
        toast.error("Failed to load games");
      } finally {
        setSegmentLoading(false);
      }
    };

    void loadMissing();
  }, [activeSegmentValues, fetchRuleWithGames, isOpen, loading, segmentGameIdsByValue, segmentType]);

  useEffect(() => {
    if (allGames.length === 0) {
      setOrderedGames([]);
      return;
    }

    const mergedIds: string[] = [];
    activeSegmentValues.forEach((value) => {
      const normalizedValue = value.trim().toLowerCase();
      const gameIds = segmentGameIdsByValue[normalizedValue] ?? [];
      gameIds.forEach((id) => {
        if (!mergedIds.includes(id)) {
          mergedIds.push(id);
        }
      });
    });

    const nextOrderedGames = mergedIds
      .map((id) => allGames.find((g) => g.id === id))
      .filter(Boolean) as ModalGame[];

    setOrderedGames(nextOrderedGames);
  }, [activeSegmentValues, allGames, segmentGameIdsByValue]);

  // Provider list comes from the summary endpoint (all providers, even before
  // their games are browsed); fall back to whatever is in the pool.
  const providers = useMemo(() => {
    const set = new Set<string>([...providerOptions, ...allGames.map((g) => g.provider)].filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [providerOptions, allGames]);

  // Category options come straight from the summary (exact, server-filterable).
  const categoryOptions = useMemo(
    () => ["All", ...categoryOptionsState],
    [categoryOptionsState]
  );

  // Add ALL games matching the chosen provider+category — fetched server-side
  // (bounded by the filter) so it works across pages, not just the visible one.
  const handleAddGame = useCallback(async () => {
    setAdding(true);
    try {
      const res = await getAdminGamesPaged({
        provider: addProvider !== "All" ? addProvider : undefined,
        category: addCategory !== "All" ? addCategory : undefined,
        page: 1,
        limit: 500,
      });
      const existing = new Set(orderedGames.map((g) => g.id));
      const toAdd = res.data.filter(
        (g) => getThumbnailUrl(g.thumbnail) !== null && !existing.has(g.id)
      );
      if (toAdd.length === 0) { toast("No new games to add for this selection"); return; }
      setOrderedGames((prev) => [...toAdd, ...prev]);
      toast.success(`Added ${toAdd.length} game${toAdd.length > 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to add games");
    } finally {
      setAdding(false);
    }
  }, [addProvider, addCategory, orderedGames]);

  // Add a single browsed game to the ordered selection.
  const handleAddOne = useCallback((game: Game) => {
    setOrderedGames((prev) => (prev.some((g) => g.id === game.id) ? prev : [game, ...prev]));
  }, []);

  // Remove from ordered list
  const handleRemove = useCallback((id: string) => {
    setOrderedGames((prev) => prev.filter((g) => g.id !== id));
  }, []);

  // Drag handlers — reorder the selected (ordered) strip.
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id); e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault(); setDragOverId(id);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    setOrderedGames((prev) => {
      const next = [...prev];
      const fi = next.findIndex((g) => g.id === draggedId);
      const ti = next.findIndex((g) => g.id === targetId);
      if (fi === -1 || ti === -1) return prev;
      const [removed] = next.splice(fi, 1);
      next.splice(ti, 0, removed);
      return next;
    });
    setDraggedId(null); setDragOverId(null);
  }, [draggedId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        activeSegmentValues.map((value) =>
          saveRule(segmentType, value, orderedGames.map((g) => g.id))
        )
      );
      toast.success("Personalization saved");
      onClose();
    } catch {}
    finally { setSaving(false); }
  };

  const handleAddSegmentOption = () => {
    if (isDefaultSegment) return;

    const nextValue = customSegmentInput.trim();
    if (!nextValue) return;

    setSegmentOptions((prev) => {
      if (prev.some((value) => value.toLowerCase() === nextValue.toLowerCase())) {
        return prev;
      }
      return [...prev, nextValue];
    });

    setActiveSegmentValues((prev) => {
      const withoutAll = prev.filter((value) => value !== "All");
      if (withoutAll.some((value) => value.toLowerCase() === nextValue.toLowerCase())) {
        return withoutAll;
      }
      return [...withoutAll, nextValue];
    });
    setSegmentGameIdsByValue((prev) => {
      const normalizedValue = nextValue.toLowerCase();
      if (normalizedValue in prev) return prev;
      return { ...prev, [normalizedValue]: [] };
    });

    setCustomSegmentInput("");
    toast.success(`${SEGMENT_LABELS[segmentType]} option added`);
  };

  const handleDeleteSegmentOption = useCallback(async (value: string) => {
    if (isDefaultSegment || value === "All") return;

    const normalizedValue = value.trim().toLowerCase();
    const ruleId = segmentRuleIdsByValue[normalizedValue];

    try {
      if (ruleId) {
        await removeRule(ruleId);
      }

      setSegmentOptions((prev) => prev.filter((item) => item.toLowerCase() !== normalizedValue));
      setActiveSegmentValues((prev) => {
        const next = prev.filter((item) => item.toLowerCase() !== normalizedValue && item !== "All");
        return next.length ? next : ["All"];
      });
      setSegmentRuleIdsByValue((prev) => {
        const next = { ...prev };
        delete next[normalizedValue];
        return next;
      });
      setSegmentGameIdsByValue((prev) => {
        const next = { ...prev };
        delete next[normalizedValue];
        return next;
      });

      toast.success(`${value} removed`);
    } catch {
      // Store already handles error toast.
    }
  }, [isDefaultSegment, removeRule, segmentRuleIdsByValue]);

  if (!isOpen) return null;

  const Dropdown = ({ containerRef, show, toggle, value, options, onSelect, label }: {
    containerRef?: React.RefObject<HTMLDivElement | null>; show: boolean; toggle: () => void;
    value: string; options: string[]; onSelect: (v: string) => void; label?: string;
  }) => (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-[#8292AA] text-xs mb-1">{label}</label>}
      <button onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#0F1117] border border-[#242B35] rounded-lg text-sm text-white hover:border-purple-600 transition-colors">
        <span className={value === "All" || value === "Select" ? "text-[#8292AA]" : "text-white"}>{value}</span>
        <ChevronDown className={`w-4 h-4 text-[#8292AA] transition-transform ${show ? "rotate-180" : ""}`} />
      </button>
      {show && (
        <div className="absolute top-full mt-1 w-full bg-[#14161b] border border-[#242B35] rounded-lg z-30 py-1 shadow-xl max-h-52 overflow-y-auto">
          {options.map((o) => (
            <button key={o} onClick={() => onSelect(o)}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${value === o ? "text-purple-400 bg-[#191D24]" : "text-white hover:bg-[#191D24]"}`}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative bg-[#14161b] rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center px-6 py-4 pr-16 border-b border-[#242B35]">
          <h2 className="text-white text-xl font-semibold">Override Recommendation</h2>
        </div>
        <button
          onClick={onClose}
          className="absolute right-6 top-4 z-20 rounded-full p-2 text-[#9AA7BC] hover:bg-[#1E2430] hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <GameCardSkeletonGrid count={8} cardClassName="w-[120px]" />
          ) : (
            <>
              <div className="rounded-xl border border-[#242B35] bg-[#171A20] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8292AA]">
                  {SEGMENT_LABELS[segmentType] ?? "Segment"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {segmentOptions.map((value) => (
                    <div
                      key={value}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                        activeSegmentValues.includes(value)
                          ? "border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-white"
                          : "border-[#2A3140] bg-transparent text-[#9AA7BC] hover:border-[#8B5CF6]/30 hover:text-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSegmentValues((prev) => {
                            const isSelected = prev.includes(value);
                            if (value === "All") {
                              return ["All"];
                            }
                            if (isSelected) {
                              const next = prev.filter((item) => item !== value && item !== "All");
                              return next.length ? next : ["All"];
                            }
                            return [...prev.filter((item) => item !== "All"), value];
                          });
                        }}
                        className="outline-none"
                      >
                        {value}
                      </button>
                      {!isDefaultSegment && value !== "All" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteSegmentOption(value);
                          }}
                          className="rounded-full p-0.5 text-[#9AA7BC] transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title={`Delete ${value}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {!isDefaultSegment && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={customSegmentInput}
                      onChange={(e) => setCustomSegmentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSegmentOption();
                        }
                      }}
                      placeholder={`Add ${SEGMENT_LABELS[segmentType] ?? "option"}`}
                      className="h-10 flex-1 rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#667085] focus:border-[#8B5CF6]"
                    />
                    <button
                      type="button"
                      onClick={handleAddSegmentOption}
                      className="rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 px-4 text-sm font-medium text-white transition-colors hover:bg-[#8B5CF6]/20"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* === TOP: Selected / Ordered Strip (drag to reorder) === */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white text-base font-semibold">
                    Selected
                    <span className="ml-2 text-sm font-medium text-[#8292AA]">({orderedGames.length})</span>
                  </h3>
                  {orderedGames.length > 1 && (
                    <span className="text-[#8292AA] text-xs">Drag to reorder</span>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {segmentLoading && (
                    <div className="flex min-h-[146px] items-center text-sm text-[#8292AA]">
                      Updating selected segment games...
                    </div>
                  )}
                  {!segmentLoading && orderedGames.length === 0 && (
                    <div className="flex min-h-[146px] items-center text-sm text-[#667085]">
                      No games selected yet — add from the grid below.
                    </div>
                  )}
                  {orderedGames.map((game) => {
                    const isDragging = draggedId === game.id;
                    const isOver = dragOverId === game.id;
                    return (
                      <div
                        key={game.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, game.id)}
                        onDragOver={(e) => handleDragOver(e, game.id)}
                        onDrop={(e) => handleDrop(e, game.id)}
                        onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                        style={{
                          opacity: isDragging ? 0.4 : 1,
                          border: isOver ? "2px solid #8b5cf6" : "2px solid transparent",
                          transition: "opacity 150ms, border 150ms",
                        }}
                        className="relative shrink-0 w-[116px] cursor-grab rounded-xl active:cursor-grabbing"
                      >
                        <div className="relative w-full h-[146px] rounded-xl overflow-hidden bg-[#1A2027]">
                          {getThumbnailUrl(game.thumbnail) ? (
                            <Image src={getThumbnailUrl(game.thumbnail)!} alt={game.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-gray-500 text-xs text-center px-2">{game.name}</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Users className="w-3 h-3 text-white" />
                            <span className="text-white text-[10px] font-medium">{game.totalPlays ?? 0}</span>
                          </div>
                          <button
                            onClick={() => handleRemove(game.id)}
                            className="absolute top-1.5 right-1.5 z-10 rounded-full bg-red-600 p-1 shadow-lg transition-transform hover:scale-105"
                            title="Remove game"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/50 rounded p-0.5">
                            <GripVertical className="w-3.5 h-3.5 text-white/70" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* === ADD GAME FORM === */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <Dropdown
                    containerRef={addProvRef}
                    show={showAddProvDd}
                    toggle={() => { setShowAddProvDd((v) => !v); setShowAddCatDd(false); }}
                    value={addProvider === "All" ? "Select" : addProvider}
                    options={providers}
                    onSelect={(v) => {
                      setAddProvider(v);
                      setShowAddProvDd(false);
                      // sagames only has Live casino games
                      if (v === "sagames") setAddCategory("Live casino");
                    }}
                    label="Provider name"
                  />
                  <Dropdown
                    containerRef={addCatRef}
                    show={showAddCatDd}
                    toggle={() => { setShowAddCatDd((v) => !v); setShowAddProvDd(false); }}
                    value={addCategory === "All" ? "Select" : addCategory}
                    options={categoryOptions}
                    onSelect={(v) => { setAddCategory(v); setShowAddCatDd(false); }}
                    label="Game Category"
                  />
                </div>
                <button
                  onClick={handleAddGame}
                  disabled={adding}
                  className="w-full py-3 bg-[#8B5CF6] hover:bg-[#7c3aed] text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  {adding ? "Adding…" : "Add Game"}
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-[#242B35]" />

              {/* === BROWSE FILTERS (server-side, reset to page 1) === */}
              <div className="grid grid-cols-2 gap-4">
                <Dropdown
                  containerRef={filterProvRef}
                  show={showFilterProvDd}
                  toggle={() => { setShowFilterProvDd((v) => !v); setShowFilterCatDd(false); }}
                  value={filterProvider}
                  options={providers}
                  onSelect={(v) => { setFilterProvider(v); setBrowsePage(1); setShowFilterProvDd(false); }}
                  label="Filter by Provider"
                />
                <Dropdown
                  containerRef={filterCatRef}
                  show={showFilterCatDd}
                  toggle={() => { setShowFilterCatDd((v) => !v); setShowFilterProvDd(false); }}
                  value={filterCategory}
                  options={categoryOptions}
                  onSelect={(v) => { setFilterCategory(v); setBrowsePage(1); setShowFilterCatDd(false); }}
                  label="Filter by Category"
                />
              </div>

              {/* === BROWSE GRID (vertical, paginated) === */}
              {browseLoading ? (
                <GameCardSkeletonGrid count={12} cardClassName="w-full" />
              ) : browseGames.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#667085]">
                  No games found for this filter.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {browseGames.map((game) => {
                    const alreadyAdded = orderedGames.some((g) => g.id === game.id);
                    return (
                      <div
                        key={game.id}
                        onClick={() => { if (!alreadyAdded) { handleAddOne(game); toast.success(`Added: ${game.name}`); } }}
                        className={`relative rounded-xl ${alreadyAdded ? "cursor-default" : "cursor-pointer"}`}
                        style={{ opacity: alreadyAdded ? 0.55 : 1, transition: "opacity 150ms" }}
                      >
                        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-[#1A2027]">
                          {getThumbnailUrl(game.thumbnail) ? (
                            <Image src={getThumbnailUrl(game.thumbnail)!} alt={game.name} fill sizes="160px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-gray-500 text-xs text-center px-2">{game.name}</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Users className="w-3 h-3 text-white" />
                            <span className="text-white text-[10px] font-medium">{game.totalPlays ?? 0}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!alreadyAdded) { handleAddOne(game); toast.success(`Added: ${game.name}`); } }}
                            disabled={alreadyAdded}
                            className={`absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200 ${
                              alreadyAdded
                                ? "bg-[#8B5CF6] border-[#8B5CF6] cursor-default shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                                : "bg-black/55 border-white/20 backdrop-blur-sm hover:bg-[#8B5CF6] hover:border-[#8B5CF6]"
                            }`}
                            title={alreadyAdded ? "Already added" : "Add game"}
                          >
                            {alreadyAdded ? (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <Plus className="w-3 h-3 text-white" />
                            )}
                          </button>
                        </div>
                        <p className="mt-1 truncate text-center text-[11px] text-[#9AA7BC]" title={game.name}>{game.name}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* === PAGINATION === */}
              {browseMeta.total > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-[#667085]">
                    {(browseMeta.page - 1) * BROWSE_LIMIT + 1}–
                    {Math.min(browseMeta.page * BROWSE_LIMIT, browseMeta.total)} of {browseMeta.total}
                  </p>
                  {browseMeta.totalPages > 1 && (
                    <Pagination
                      currentPage={browseMeta.page}
                      totalPages={browseMeta.totalPages}
                      onPageChange={setBrowsePage}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#242B35]">
          <button onClick={onClose} className="px-7 py-3 rounded-lg text-[#8292AA] hover:text-white hover:bg-[#242B35] transition-colors text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-9 py-3 rounded-lg bg-[#8B5CF6] hover:bg-[#7c3aed] text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
