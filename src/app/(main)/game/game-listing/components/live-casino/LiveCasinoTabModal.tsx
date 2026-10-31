"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  GripVertical,
  Plus,
  Users,
  Gamepad2,
  ArrowLeft,
  LayoutGrid,
  Eye,
  EyeOff,
  Pencil,
  Loader2,
  Wand2,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  getAdminGamesPaged,
  getProvidersSummary,
  getAdminProviders,
  getThumbnailUrl,
  type Game,
  type AdminProvider,
} from "@/api/games/games";
import {
  createLiveCasinoTab,
  updateLiveCasinoTab,
  getLiveCasinoTab,
  LIVE_CASINO_ICON_KEYS,
  type LiveCasinoAutoRule,
  type LiveCasinoSourceType,
  type LiveCasinoTab,
  type LiveCasinoTabGame,
  type LiveCasinoTabPayload,
} from "@/api/games/live-casino";
import { getProviderLogo, getProviderLogoBySlug } from "../../data/provider-logos";
import Pagination from "@/components/Pagination";
import { useDragAutoScroll } from "@/hooks/use-drag-auto-scroll";
import { LIVE_CASINO_TAB_ICONS, DEFAULT_TAB_ICON } from "./tabIcons";
import GameEditModal from "./GameEditModal";

const BROWSE_LIMIT = 60; // games per browse page

/** A game as the editor holds it: the record plus its place in THIS tab. */
interface TabGameDraft {
  game: Game;
  /** Shows in this tab (independent of the game's own enabled flag) */
  isActive: boolean;
}

const AUTO_RULES: { value: LiveCasinoAutoRule; label: string; hint: string }[] = [
  { value: "popular", label: "Most played", hint: "Live games ranked by play count." },
  { value: "new", label: "Newest", hint: "Games flagged new, else the most recently added." },
  { value: "all", label: "All live games", hint: "The whole live dealer catalogue." },
  {
    value: "subcategory",
    label: "Matches a term",
    hint: "Games whose sub-category or title matches the terms below.",
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the modal edits this tab; otherwise it creates a new one. */
  tab?: LiveCasinoTab | null;
  /** Called after a successful create/update so the list can refresh. */
  onSaved: () => void;
}

/**
 * Create / edit one Live Casino Category (a Social Live Casino tab): its label,
 * icon, visibility, which tab opens first, where it gets its games, and — for
 * hand-picked tabs — the ordered games themselves.
 */
export default function LiveCasinoTabModal({ isOpen, onClose, tab, onSaved }: Props) {
  const editing = !!tab;

  // Tab settings
  const [name, setName] = useState("");
  // Spanish label shown to players on the /es site. Blank = let the backend
  // translate the English name (admin-entered text is never overwritten).
  const [nameEs, setNameEs] = useState("");
  const [iconKey, setIconKey] = useState<string>("flame");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [sourceType, setSourceType] = useState<LiveCasinoSourceType>("manual");
  const [autoRule, setAutoRule] = useState<LiveCasinoAutoRule>("popular");
  const [autoFilter, setAutoFilter] = useState("");
  const [maxGames, setMaxGames] = useState<string>("0");

  // Games in this tab
  const [drafts, setDrafts] = useState<TabGameDraft[]>([]);
  /** Read-only preview of what a rule currently matches. */
  const [autoPreview, setAutoPreview] = useState<Game[]>([]);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  // Add games: browse a provider or category and drill into one, or go straight
  // to a game by name — the only way to reach one game without first knowing
  // which of ~30 providers it belongs to.
  const [addMode, setAddMode] = useState<"provider" | "category" | "game">("provider");
  const [studios, setStudios] = useState<AdminProvider[]>([]);
  const [categoryList, setCategoryList] = useState<{ name: string; count: number }[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  /**
   * Debounced copy of the search box, used only by the "By Game" mode: that one
   * queries the server, so it must not fire on every keystroke. The provider and
   * category lists are already in memory and filter instantly.
   */
  const [gameQuery, setGameQuery] = useState("");
  const byName = addMode === "game";

  const [browseGames, setBrowseGames] = useState<Game[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseMeta, setBrowseMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [browseLoading, setBrowseLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // Native HTML5 drag will not scroll the strip, so without this the last game
  // can never be dropped at the front of a long tab.
  const strip = useDragAutoScroll<HTMLDivElement>();

  // Seed the form + provider/category options each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [summary, detail, provs] = await Promise.all([
          getProvidersSummary(),
          tab ? getLiveCasinoTab(tab.id) : Promise.resolve(null),
          getAdminProviders().catch(() => [] as AdminProvider[]),
        ]);
        if (cancelled) return;

        setStudios(provs);
        const catCount = new Map<string, number>();
        for (const s of summary)
          for (const c of s.categories) catCount.set(c.name, (catCount.get(c.name) || 0) + (c.count || 0));
        setCategoryList(
          Array.from(catCount.entries())
            .map(([n, count]) => ({ name: n, count }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );

        // Seed from the persisted record — the row passed in may be stale.
        const source = detail?.tab ?? tab ?? null;
        setName(source?.name ?? "");
        setNameEs(source?.translations?.es ?? "");
        setIconKey(source?.iconKey ?? "flame");
        setIsActive(source?.isActive ?? true);
        setIsDefault(source?.isDefault ?? false);
        setSourceType(source?.sourceType ?? "manual");
        setAutoRule(source?.autoRule ?? "popular");
        setAutoFilter(source?.autoFilter ?? "");
        setMaxGames(String(source?.maxGames ?? 0));

        const games: LiveCasinoTabGame[] = detail?.games ?? [];
        if ((source?.sourceType ?? "manual") === "auto") {
          setAutoPreview(games);
          setDrafts([]);
        } else {
          setAutoPreview([]);
          setDrafts(games.map((g) => ({ game: g, isActive: g.tabGameActive !== false })));
        }
      } catch {
        if (!cancelled) toast.error("Failed to load the tab");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, tab]);

  // Reset transient state when closed so reopening is clean.
  useEffect(() => {
    if (isOpen) return;
    setDrafts([]);
    setAutoPreview([]);
    setBrowseGames([]);
    setBrowsePage(1);
    setBrowseMeta({ page: 1, totalPages: 1, total: 0 });
    setStudios([]);
    setCategoryList([]);
    setAddSearch("");
    setGameQuery("");
    setSelected(null);
    setAddMode("provider");
    setEditingGame(null);
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(() => setGameQuery(addSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [addSearch]);

  // A new term is a new result set, so never land on page 4 of it.
  useEffect(() => {
    setBrowsePage(1);
  }, [gameQuery]);

  // Server-paginated browse grid for whatever is currently in scope — the
  // selected provider/category, or the typed game name. One request at a time,
  // aborting stale ones; nothing loads until there is something to load.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!isOpen || (byName ? !gameQuery : !selected)) {
      setBrowseGames([]);
      setBrowseMeta({ page: 1, totalPages: 1, total: 0 });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBrowseLoading(true);
    getAdminGamesPaged(
      {
        studio: addMode === "provider" ? selected ?? undefined : undefined,
        category: addMode === "category" ? selected ?? undefined : undefined,
        // Matched case-insensitively across the whole catalogue by the API.
        search: byName ? gameQuery : undefined,
        page: browsePage,
        limit: BROWSE_LIMIT,
      },
      controller.signal,
    )
      .then((res) => {
        setBrowseGames(res.data);
        setBrowseMeta({ page: res.page, totalPages: res.totalPages, total: res.total });
      })
      .catch((err: { name?: string; code?: string }) => {
        // An aborted request is this effect superseding itself, not a failure.
        if (err?.name !== "CanceledError" && err?.name !== "AbortError" && err?.code !== "ERR_CANCELED") {
          toast.error("Failed to load games");
        }
      })
      .finally(() => {
        if (abortRef.current === controller) abortRef.current = null;
        setBrowseLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, addMode, selected, gameQuery, byName, browsePage]);

  const filteredStudios = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return q ? studios.filter((s) => s.name.toLowerCase().includes(q)) : studios;
  }, [studios, addSearch]);

  const filteredCategories = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return q ? categoryList.filter((c) => c.name.toLowerCase().includes(q)) : categoryList;
  }, [categoryList, addSearch]);

  const addOne = useCallback((game: Game) => {
    setDrafts((prev) =>
      prev.some((d) => d.game.id === game.id) ? prev : [...prev, { game, isActive: true }],
    );
  }, []);

  // Add EVERY game currently in scope — the selected provider/category, or every
  // match for the typed name. Paginates across all pages so the whole set is
  // added, not just the first page.
  const addAllForTarget = useCallback(async () => {
    if (byName ? !gameQuery : !selected) return;
    setAdding(true);
    try {
      const PAGE = 500;
      const MAX = 5000; // safety cap
      const all: Game[] = [];
      let page = 1;
      while (true) {
        const res = await getAdminGamesPaged({
          studio: addMode === "provider" ? selected ?? undefined : undefined,
          category: addMode === "category" ? selected ?? undefined : undefined,
          search: byName ? gameQuery : undefined,
          page,
          limit: PAGE,
        });
        all.push(...res.data);
        if (res.data.length < PAGE || page >= res.totalPages || all.length >= MAX) break;
        page += 1;
      }

      const existing = new Set(drafts.map((d) => d.game.id));
      const toAdd = all.filter((g) => !existing.has(g.id));
      if (toAdd.length === 0) {
        toast("No new games to add for this selection");
        return;
      }
      setDrafts((prev) => [...prev, ...toAdd.map((game) => ({ game, isActive: true }))]);
      toast.success(`Added ${toAdd.length} game${toAdd.length > 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to add games");
    } finally {
      setAdding(false);
    }
  }, [drafts, addMode, selected, byName, gameQuery]);

  const removeOne = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.game.id !== id));
  }, []);

  const toggleOne = useCallback((id: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.game.id === id ? { ...d, isActive: !d.isActive } : d)),
    );
  }, []);

  // Drag handlers — reorder the selected strip.
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      strip.stop();
      if (!draggedId || draggedId === targetId) {
        setDraggedId(null);
        setDragOverId(null);
        return;
      }
      setDrafts((prev) => {
        const next = [...prev];
        const fi = next.findIndex((d) => d.game.id === draggedId);
        const ti = next.findIndex((d) => d.game.id === targetId);
        if (fi === -1 || ti === -1) return prev;
        const [removed] = next.splice(fi, 1);
        next.splice(ti, 0, removed);
        return next;
      });
      // The strip is still scrolled where the drag ended, so follow the card to
      // its new slot instead of leaving it off-screen.
      strip.reveal(draggedId);
      setDraggedId(null);
      setDragOverId(null);
    },
    [draggedId, strip],
  );

  /** Turn a rule into an editable list, pre-filled with what it matches today. */
  const convertToManual = () => {
    setDrafts(autoPreview.map((game) => ({ game, isActive: true })));
    setAutoPreview([]);
    setSourceType("manual");
    toast.success("Converted to a hand-picked list — reorder and save");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give the tab a name");
      return;
    }
    if (sourceType === "auto" && autoRule === "subcategory" && !autoFilter.trim()) {
      toast.error("Enter at least one term to match");
      return;
    }
    setSaving(true);
    try {
      const payload: LiveCasinoTabPayload = {
        name: name.trim(),
        // Always sent, including empty: an empty Spanish field means "derive it
        // from the English name", which is also how a stale one gets refreshed.
        translations: { es: nameEs.trim() },
        iconKey,
        isActive,
        isDefault,
        sourceType,
        maxGames: Math.max(0, Number(maxGames) || 0),
      };
      if (sourceType === "auto") {
        payload.autoRule = autoRule;
        payload.autoFilter = autoRule === "subcategory" ? autoFilter.trim() : "";
      } else {
        payload.games = drafts.map((d) => ({ gameId: d.game.id, isActive: d.isActive }));
      }

      if (editing && tab) {
        await updateLiveCasinoTab(tab.id, payload);
        toast.success("Tab updated");
      } else {
        await createLiveCasinoTab(payload);
        toast.success("Tab created");
      }
      onSaved();
      onClose();
    } catch (err) {
      // The backend refuses game edits on a rule-driven tab with an explanatory
      // message — surface it rather than a generic failure.
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message || "Failed to save the tab");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const activeCount = drafts.filter((d) => d.isActive).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#14161b]">
        {/* Header */}
        <div className="flex items-center border-b border-[#242B35] px-6 py-4 pr-16">
          <h2 className="text-xl font-semibold text-white">
            {editing ? "Edit Live Casino Category" : "Create Live Casino Category"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="absolute right-6 top-4 z-20 rounded-full p-2 text-[#9AA7BC] transition-colors hover:bg-[#1E2430] hover:text-white"
          title="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Name + visibility */}
          <div className="space-y-4 rounded-xl border border-[#242B35] bg-[#171A20] px-4 py-4">
            <div>
              <label className="mb-1 block text-xs text-[#8292AA]">Tab name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Live Roulette"
                className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#667085] focus:border-[#8B5CF6]"
              />
            </div>

            {/* A tab invented here has no entry in the app's translation files, so
                without this it stays English on the /es site while everything
                around it translates. */}
            <div>
              <label className="mb-1 block text-xs text-[#8292AA]">Tab name (Spanish)</label>
              <input
                value={nameEs}
                onChange={(e) => setNameEs(e.target.value)}
                placeholder="Leave blank to translate automatically"
                className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#667085] focus:border-[#8B5CF6]"
              />
            </div>

            {/* Icon */}
            <div>
              <label className="mb-1.5 block text-xs text-[#8292AA]">Icon</label>
              <div className="flex flex-wrap gap-2">
                {LIVE_CASINO_ICON_KEYS.map((key) => {
                  const Icon = LIVE_CASINO_TAB_ICONS[key] ?? DEFAULT_TAB_ICON;
                  const on = iconKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIconKey(key)}
                      title={key}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                        on
                          ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-white"
                          : "border-[#2A3140] bg-[#11141A] text-[#8292AA] hover:border-[#8B5CF6]/50 hover:text-white"
                      }`}
                    >
                      <Icon size={17} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-white"
                    : "border-[#2A3140] bg-transparent text-[#9AA7BC]"
                }`}
                title="Show or hide this tab on the player site"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-green-400" : "bg-gray-500"}`} />
                {isActive ? "Visible to players" : "Hidden"}
              </button>
              <button
                type="button"
                onClick={() => setIsDefault((v) => !v)}
                className={`flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
                  isDefault
                    ? "border-amber-400/40 bg-amber-400/10 text-white"
                    : "border-[#2A3140] bg-transparent text-[#9AA7BC]"
                }`}
                title="Open the section on this tab"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${isDefault ? "bg-amber-400" : "bg-gray-500"}`} />
                {isDefault ? "Opens first" : "Not the default tab"}
              </button>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#8292AA]">Max games</label>
                <input
                  value={maxGames}
                  onChange={(e) => setMaxGames(e.target.value.replace(/[^0-9]/g, ""))}
                  className="h-11 w-24 rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none focus:border-[#8B5CF6]"
                  title="0 = show every game in this tab"
                />
                <span className="text-[11px] text-[#667085]">0 = no limit</span>
              </div>
            </div>
          </div>

          {/* Source */}
          <div className="space-y-3 rounded-xl border border-[#242B35] bg-[#171A20] px-4 py-4">
            <p className="text-sm font-medium text-white">Where does this tab get its games?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSourceType("manual")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  sourceType === "manual"
                    ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-white"
                    : "border-[#2A3140] text-[#9AA7BC] hover:text-white"
                }`}
              >
                🎯 Hand-picked list
              </button>
              <button
                type="button"
                onClick={() => setSourceType("auto")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  sourceType === "auto"
                    ? "border-sky-400/50 bg-sky-400/10 text-white"
                    : "border-[#2A3140] text-[#9AA7BC] hover:text-white"
                }`}
              >
                ⚡ Fill automatically
              </button>
            </div>

            {sourceType === "auto" ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-[#8292AA]">Rule</label>
                  <select
                    value={autoRule}
                    onChange={(e) => setAutoRule(e.target.value as LiveCasinoAutoRule)}
                    className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none focus:border-[#8B5CF6]"
                  >
                    {AUTO_RULES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-[#667085]">
                    {AUTO_RULES.find((r) => r.value === autoRule)?.hint}
                  </p>
                </div>
                {autoRule === "subcategory" && (
                  <div>
                    <label className="mb-1 block text-xs text-[#8292AA]">
                      Match terms (comma separated)
                    </label>
                    <input
                      value={autoFilter}
                      onChange={(e) => setAutoFilter(e.target.value)}
                      placeholder="e.g. roulette,rot"
                      className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#667085] focus:border-[#8B5CF6]"
                    />
                    <p className="mt-1 text-[11px] text-[#667085]">
                      Matched against a game&apos;s sub-category or title. Providers use
                      different codes for the same table, hence more than one term.
                    </p>
                  </div>
                )}
                {editing && autoPreview.length > 0 && (
                  <button
                    type="button"
                    onClick={convertToManual}
                    className="flex items-center gap-1.5 rounded-lg border border-[#2A3140] px-3 py-2 text-sm font-medium text-[#9AA7BC] transition-colors hover:border-[#8B5CF6] hover:text-white"
                  >
                    <Wand2 size={14} />
                    Convert to a hand-picked list ({autoPreview.length} games)
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Auto preview (read-only) */}
          {sourceType === "auto" && (
            <div>
              <h3 className="mb-2 text-base font-semibold text-white">
                Currently matching
                <span className="ml-2 text-sm font-medium text-[#8292AA]">
                  ({autoPreview.length})
                </span>
              </h3>
              {loading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-[#8292AA]">
                  <Loader2 size={14} className="animate-spin" />
                  Loading…
                </div>
              ) : autoPreview.length === 0 ? (
                <p className="py-6 text-sm text-[#667085]">
                  {editing
                    ? "This rule matches no games right now."
                    : "Save the tab to see what the rule matches."}
                </p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {autoPreview.slice(0, 40).map((game, idx) => (
                    <div key={game.id} className="relative w-[92px] shrink-0">
                      <div className="relative h-[118px] w-full overflow-hidden rounded-xl bg-[#1A2027]">
                        {getThumbnailUrl(game.thumbnail) ? (
                          <Image
                            src={getThumbnailUrl(game.thumbnail)!}
                            alt={game.name}
                            fill
                            sizes="92px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center px-1">
                            <span className="text-center text-[10px] text-gray-500">{game.name}</span>
                          </div>
                        )}
                        <div className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                          #{idx + 1}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hand-picked: ordered strip + add games */}
          {sourceType === "manual" && (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">
                    Games in this tab
                    <span className="ml-2 text-sm font-medium text-[#8292AA]">
                      ({drafts.length}
                      {activeCount !== drafts.length ? ` · ${activeCount} shown` : ""})
                    </span>
                  </h3>
                  {drafts.length > 1 && (
                    <span className="text-xs text-[#8292AA]">
                      Drag to reorder — hold near an edge to scroll
                    </span>
                  )}
                </div>
                <div
                  ref={strip.ref}
                  onDragOver={strip.onDragOver}
                  onDrop={strip.stop}
                  onDragLeave={strip.stop}
                  className="flex gap-3 overflow-x-auto pb-2"
                >
                  {loading && (
                    <div className="flex min-h-[146px] items-center gap-2 text-sm text-[#8292AA]">
                      <Loader2 size={14} className="animate-spin" />
                      Loading…
                    </div>
                  )}
                  {!loading && drafts.length === 0 && (
                    <div className="flex min-h-[146px] items-center text-sm text-[#667085]">
                      No games in this tab yet — add them from the grid below.
                    </div>
                  )}
                  {drafts.map((d, idx) => {
                    const game = d.game;
                    const isDragging = draggedId === game.id;
                    const isOver = dragOverId === game.id;
                    return (
                      <div
                        key={game.id}
                        data-drag-id={game.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, game.id)}
                        onDragOver={(e) => handleDragOver(e, game.id)}
                        onDrop={(e) => handleDrop(e, game.id)}
                        onDragEnd={() => {
                          strip.stop();
                          setDraggedId(null);
                          setDragOverId(null);
                        }}
                        style={{
                          opacity: isDragging ? 0.4 : 1,
                          border: isOver ? "2px solid #8b5cf6" : "2px solid transparent",
                          transition: "opacity 150ms, border 150ms",
                        }}
                        className="relative w-[116px] shrink-0 cursor-grab rounded-xl active:cursor-grabbing"
                      >
                        <div
                          className={`relative h-[146px] w-full overflow-hidden rounded-xl bg-[#1A2027] ${
                            d.isActive ? "" : "grayscale"
                          }`}
                        >
                          {getThumbnailUrl(game.thumbnail) ? (
                            <Image
                              src={getThumbnailUrl(game.thumbnail)!}
                              alt={game.name}
                              fill
                              sizes="116px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="px-2 text-center text-xs text-gray-500">
                                {game.name}
                              </span>
                            </div>
                          )}
                          <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                            #{idx + 1}
                          </div>
                          <button
                            onClick={() => removeOne(game.id)}
                            className="absolute right-1.5 top-1.5 z-10 rounded-full bg-red-600 p-1 shadow-lg transition-transform hover:scale-105"
                            title="Remove from this tab"
                          >
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                          {!d.isActive && (
                            <div className="absolute inset-x-0 top-9 bg-black/70 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-gray-300">
                              Hidden
                            </div>
                          )}
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/50 p-0.5">
                            <GripVertical className="h-3.5 w-3.5 text-white/70" />
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <button
                            onClick={() => toggleOne(game.id)}
                            title={d.isActive ? "Hide from this tab" : "Show in this tab"}
                            className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                              d.isActive
                                ? "border-[#2A3140] text-[#9AA7BC] hover:text-white"
                                : "border-amber-500/40 text-amber-400"
                            }`}
                          >
                            {d.isActive ? <Eye size={10} /> : <EyeOff size={10} />}
                            {d.isActive ? "Shown" : "Hidden"}
                          </button>
                          <button
                            onClick={() => setEditingGame(game)}
                            title="Edit this game (name, thumbnail)"
                            className="flex items-center gap-1 rounded-md border border-[#2A3140] px-1.5 py-0.5 text-[10px] font-medium text-[#9AA7BC] transition-colors hover:border-[#8B5CF6] hover:text-white"
                          >
                            <Pencil size={10} />
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add games — browse by Provider / Category, or look one up by name */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">Add games</h3>
                  <p className="text-[11px] text-[#8292AA]">
                    {byName ? (
                      <>Type a game&apos;s name to find it across every provider, then add it.</>
                    ) : (
                      <>
                        Open a provider or category, then{" "}
                        <span className="text-gray-300">Select all</span> or add games one by one.
                      </>
                    )}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-lg border border-[#2A3140] bg-[#11141A] p-1">
                  {(["provider", "category", "game"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setAddMode(m);
                        setSelected(null);
                        setAddSearch("");
                        setBrowsePage(1);
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        addMode === m ? "bg-[#8B5CF6] text-white" : "text-[#9AA7BC] hover:text-white"
                      }`}
                    >
                      {m === "provider"
                        ? "By Provider"
                        : m === "category"
                          ? "By Category"
                          : "By Game Name"}
                    </button>
                  ))}
                </div>
              </div>

              {byName ? (
                /* BY NAME — search the whole catalogue, no provider to open first */
                <>
                  <input
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder="Search games by name…"
                    autoFocus
                    className="h-10 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none placeholder:text-[#667085] focus:border-[#8B5CF6]"
                  />
                  {!gameQuery ? (
                    <div className="py-10 text-center text-sm text-[#667085]">
                      Start typing to find a game.
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-[#9AA7BC]">
                        <span className="font-semibold text-white">{browseMeta.total}</span>{" "}
                        {browseMeta.total === 1 ? "match" : "matches"} for{" "}
                        <span className="text-white">&ldquo;{gameQuery}&rdquo;</span>
                      </span>
                      <button
                        onClick={addAllForTarget}
                        disabled={adding || browseMeta.total === 0}
                        className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7c3aed] disabled:opacity-50"
                        title="Add every game matching this search"
                      >
                        {adding ? "Adding…" : `Add all${browseMeta.total ? ` (${browseMeta.total})` : ""}`}
                      </button>
                    </div>
                  )}
                </>
              ) : !selected ? (
                /* STEP 1 — provider OR category grid */
                <>
                  <input
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder={addMode === "provider" ? "Search providers…" : "Search categories…"}
                    className="h-10 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none placeholder:text-[#667085] focus:border-[#8B5CF6]"
                  />
                  {addMode === "provider" ? (
                    filteredStudios.length === 0 ? (
                      <div className="py-10 text-center text-sm text-[#667085]">
                        No providers found.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {filteredStudios.map((p) => {
                          // Resolve by slug (same source as the provider grid), name as fallback.
                          const logo = getProviderLogoBySlug(p.slug) ?? getProviderLogo(p.name);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelected(p.name);
                                setBrowsePage(1);
                              }}
                              className="group relative flex h-[92px] items-center justify-center rounded-xl border border-[#242B35] bg-[#14171D] px-3 transition-all hover:-translate-y-0.5 hover:border-[#B93DEB]"
                            >
                              {logo ? (
                                <Image
                                  src={logo}
                                  alt={p.name}
                                  width={120}
                                  height={36}
                                  className="max-h-9 w-auto max-w-[80%] object-contain opacity-80 group-hover:opacity-100"
                                />
                              ) : p.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.logo}
                                  alt={p.name}
                                  className="max-h-9 max-w-[80%] object-contain opacity-80 group-hover:opacity-100"
                                />
                              ) : (
                                <span className="flex items-center gap-1.5 text-center text-sm font-bold capitalize text-white">
                                  <Gamepad2 size={15} className="shrink-0 text-[#B93DEB]" />
                                  {p.name}
                                </span>
                              )}
                              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B93DEB] backdrop-blur-sm">
                                {p.gameCount} Games
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )
                  ) : filteredCategories.length === 0 ? (
                    <div className="py-10 text-center text-sm text-[#667085]">
                      No categories found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {filteredCategories.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            setSelected(c.name);
                            setBrowsePage(1);
                          }}
                          className="group relative flex h-[92px] items-center justify-center rounded-xl border border-[#242B35] bg-[#14171D] px-3 text-center transition-all hover:-translate-y-0.5 hover:border-[#B93DEB]"
                        >
                          <span className="flex items-center gap-1.5 text-sm font-bold capitalize text-white">
                            <LayoutGrid size={15} className="shrink-0 text-[#B93DEB]" />
                            {c.name}
                          </span>
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B93DEB] backdrop-blur-sm">
                            {c.count} Games
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* STEP 2 — header for the opened provider/category */
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      onClick={() => setSelected(null)}
                      className="flex items-center gap-1.5 text-sm font-medium text-[#9AA7BC] transition-colors hover:text-white"
                    >
                      <ArrowLeft size={15} /> Back to{" "}
                      {addMode === "provider" ? "providers" : "categories"}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold capitalize text-white">{selected}</span>
                      <span className="rounded bg-[#B93DEB]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B93DEB]">
                        {browseMeta.total} games
                      </span>
                      <button
                        onClick={addAllForTarget}
                        disabled={adding || browseMeta.total === 0}
                        className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7c3aed] disabled:opacity-50"
                        title="Add every game shown here"
                      >
                        {adding ? "Adding…" : `Select all${browseMeta.total ? ` (${browseMeta.total})` : ""}`}
                      </button>
                    </div>
                </div>
              )}

              {/* Browse grid — shared by the name search and an opened provider
                  or category, so results look and behave the same however they
                  were reached. */}
              {(byName ? !!gameQuery : !!selected) && (
                <>
                  {browseLoading ? (
                    <div className="py-10 text-center text-sm text-[#667085]">Loading games…</div>
                  ) : browseGames.length === 0 ? (
                    <div className="py-10 text-center text-sm text-[#667085]">No games found.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                      {browseGames.map((game) => {
                        const alreadyAdded = drafts.some((d) => d.game.id === game.id);
                        return (
                          <div
                            key={game.id}
                            onClick={() => {
                              if (!alreadyAdded) {
                                addOne(game);
                                toast.success(`Added: ${game.name}`);
                              }
                            }}
                            className={`relative rounded-xl ${alreadyAdded ? "cursor-default" : "cursor-pointer"}`}
                            style={{ opacity: alreadyAdded ? 0.55 : 1, transition: "opacity 150ms" }}
                          >
                            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#1A2027]">
                              {getThumbnailUrl(game.thumbnail) ? (
                                <Image
                                  src={getThumbnailUrl(game.thumbnail)!}
                                  alt={game.name}
                                  fill
                                  sizes="160px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <span className="px-2 text-center text-xs text-gray-500">
                                    {game.name}
                                  </span>
                                </div>
                              )}
                              <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                                <Users className="h-3 w-3 text-white" />
                                <span className="text-[10px] font-medium text-white">
                                  {game.totalPlays ?? 0}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!alreadyAdded) {
                                    addOne(game);
                                    toast.success(`Added: ${game.name}`);
                                  }
                                }}
                                disabled={alreadyAdded}
                                className={`absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200 ${
                                  alreadyAdded
                                    ? "cursor-default border-[#8B5CF6] bg-[#8B5CF6] shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                                    : "border-white/20 bg-black/55 backdrop-blur-sm hover:border-[#8B5CF6] hover:bg-[#8B5CF6]"
                                }`}
                                title={alreadyAdded ? "Already added" : "Add game"}
                              >
                                {alreadyAdded ? (
                                  <svg
                                    className="h-3 w-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <Plus className="h-3 w-3 text-white" />
                                )}
                              </button>
                            </div>
                            <p className="mt-1 truncate text-center text-[11px] text-[#9AA7BC]" title={game.name}>
                              {game.name}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {browseMeta.total > 0 && (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-[#667085]">
                        {(browseMeta.page - 1) * BROWSE_LIMIT + 1}–
                        {Math.min(browseMeta.page * BROWSE_LIMIT, browseMeta.total)} of{" "}
                        {browseMeta.total}
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#242B35] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-7 py-3 text-sm font-medium text-[#8292AA] transition-colors hover:bg-[#242B35] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#8B5CF6] px-9 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#7c3aed] disabled:opacity-60"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Create tab"}
          </button>
        </div>
      </div>

      {/* Editing the game record itself (name / thumbnail / availability) —
          the same game may appear in other tabs and in the lobby, so this
          intentionally writes through to the game, not to the membership. */}
      <GameEditModal
        game={editingGame}
        onClose={() => setEditingGame(null)}
        onSaved={(updated) => {
          setDrafts((prev) =>
            prev.map((d) => (d.game.id === updated.id ? { ...d, game: updated } : d)),
          );
          setEditingGame(null);
        }}
      />
    </div>
  );
}
