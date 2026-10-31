"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ChevronDown, X, GripVertical, Plus, Users, Gamepad2, ArrowLeft, LayoutGrid } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

import {
  getAdminGamesPaged,
  getProvidersSummary,
  getAdminProviders,
  getThumbnailUrl,
  type Game,
  type AdminProvider,
} from "@/api/games/games";
import { getProviderLogo, getProviderLogoBySlug } from "../data/provider-logos";
import {
  createCollection,
  updateCollection,
  getAdminCollection,
  type GameCollection,
} from "@/api/games/collections";
import { getSidebarTree, SIDEBAR_ICON_KEYS, type SidebarMenuGroup } from "@/api/sidebar/sidebar";
import Pagination from "@/components/Pagination";
import { useDragAutoScroll } from "@/hooks/use-drag-auto-scroll";

const groupLabel = (g: SidebarMenuGroup) => g.title || g.titleKey || "(menu)";

const BROWSE_LIMIT = 60; // games per browse page

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the modal edits this collection; otherwise it creates a new one. */
  collection?: GameCollection | null;
  /** Called after a successful create/update so the list can refresh. */
  onSaved: () => void;
}

export default function CollectionModal({
  isOpen,
  onClose,
  collection,
  onSaved,
}: CollectionModalProps) {
  const editing = !!collection;

  const [name, setName] = useState("");
  // Spanish name shown to players on the /es site. Blank = let the backend
  // translate the English name (admin-entered text is never overwritten).
  const [nameEs, setNameEs] = useState("");
  const [iconKey, setIconKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [showInSidebar, setShowInSidebar] = useState(false);
  const [orderedGames, setOrderedGames] = useState<Game[]>([]);

  // Sidebar menu placement: add under an existing menu, or create a new one.
  const [menuGroups, setMenuGroups] = useState<SidebarMenuGroup[]>([]);
  const [placementMode, setPlacementMode] = useState<"existing" | "new">("existing");
  const [menuGroupSel, setMenuGroupSel] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState("");

  const [providerOptions, setProviderOptions] = useState<string[]>([]);
  const [categoryOptionsState, setCategoryOptionsState] = useState<string[]>([]);

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
  // Native HTML5 drag will not scroll the strip, so without this the last game
  // can never be dropped at the front of a long collection.
  const strip = useDragAutoScroll<HTMLDivElement>();

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

  // Seed the form + provider/category options each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setName(collection?.name ?? "");
      setNameEs(collection?.translations?.es ?? "");
      setIconKey(collection?.iconKey ?? "");
      setEnabled(collection?.enabled ?? true);
      setShowInSidebar(collection?.showInSidebar ?? false);
      try {
        const [summary, detail, tree, provs] = await Promise.all([
          getProvidersSummary(),
          collection ? getAdminCollection(collection.id) : Promise.resolve(null),
          getSidebarTree().catch(() => [] as SidebarMenuGroup[]),
          getAdminProviders().catch(() => [] as AdminProvider[]),
        ]);
        if (cancelled) return;
        setMenuGroups(tree);
        setStudios(provs);
        // Preselect the menu this category's sidebar item currently lives in.
        const currentItem = collection
          ? tree.flatMap((g) => g.items).find((it) => it.collectionId === collection.id)
          : undefined;
        setMenuGroupSel(currentItem?.groupId ?? tree[0]?.id ?? "");
        setPlacementMode(currentItem || tree.length > 0 ? "existing" : "new");
        setProviderOptions(summary.map((s) => s.provider).filter(Boolean));
        setCategoryOptionsState(
          Array.from(new Set(summary.flatMap((s) => s.categories.map((c) => c.name)).filter(Boolean))).sort(),
        );
        const catCount = new Map<string, number>();
        for (const s of summary) for (const c of s.categories) catCount.set(c.name, (catCount.get(c.name) || 0) + (c.count || 0));
        setCategoryList(
          Array.from(catCount.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
        );
        setOrderedGames(detail?.games ?? []);
        // Seed the form from the persisted record (the passed-in collection may be
        // a partial without name/enabled/showInSidebar — e.g. from the layout row).
        if (detail?.collection) {
          setName(detail.collection.name ?? "");
          setNameEs(detail.collection.translations?.es ?? "");
          setIconKey(detail.collection.iconKey ?? "");
          setEnabled(detail.collection.enabled ?? true);
          setShowInSidebar(detail.collection.showInSidebar ?? false);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load collection");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, collection]);

  // Reset transient state when closed so reopening is clean.
  useEffect(() => {
    if (isOpen) return;
    setOrderedGames([]);
    setBrowseGames([]);
    setBrowsePage(1);
    setBrowseMeta({ page: 1, totalPages: 1, total: 0 });
    setFilterCategory("All");
    setStudios([]);
    setCategoryList([]);
    setAddSearch("");
    setGameQuery("");
    setSelected(null);
    setAddMode("provider");
    setName("");
    setNameEs("");
    setIconKey("");
    setEnabled(true);
    setShowInSidebar(false);
    setMenuGroups([]);
    setPlacementMode("existing");
    setMenuGroupSel("");
    setNewGroupName("");
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
        setBrowseGames(res.data.filter((g) => getThumbnailUrl(g.thumbnail) !== null));
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

      const existing = new Set(orderedGames.map((g) => g.id));
      const toAdd = all.filter((g) => getThumbnailUrl(g.thumbnail) !== null && !existing.has(g.id));
      if (toAdd.length === 0) {
        toast("No new games to add for this selection");
        return;
      }
      setOrderedGames((prev) => [...prev, ...toAdd]);
      toast.success(`Added ${toAdd.length} game${toAdd.length > 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to add games");
    } finally {
      setAdding(false);
    }
  }, [orderedGames, addMode, selected, byName, gameQuery]);

  const handleAddOne = useCallback((game: Game) => {
    setOrderedGames((prev) => (prev.some((g) => g.id === game.id) ? prev : [...prev, game]));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setOrderedGames((prev) => prev.filter((g) => g.id !== id));
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
      setOrderedGames((prev) => {
        const next = [...prev];
        const fi = next.findIndex((g) => g.id === draggedId);
        const ti = next.findIndex((g) => g.id === targetId);
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give the collection a name");
      return;
    }
    setSaving(true);
    try {
      const payload: Parameters<typeof updateCollection>[1] = {
        name: name.trim(),
        // Always sent, including empty: an empty Spanish field means "derive it
        // from the English name", which is also how a stale one gets refreshed.
        translations: { es: nameEs.trim() },
        iconKey,
        enabled,
        showInSidebar,
        gameIds: orderedGames.map((g) => g.id),
      };
      // When in the sidebar, tell the backend which menu to place it under
      // (existing group) or to create a new menu with the given name.
      if (showInSidebar) {
        if (placementMode === "new") payload.sidebarGroupName = newGroupName.trim() || name.trim();
        else if (menuGroupSel) payload.sidebarGroupId = menuGroupSel;
      }
      if (editing && collection) {
        await updateCollection(collection.id, payload);
        toast.success("Collection updated");
      } else {
        await createCollection(payload);
        toast.success("Collection created");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save collection");
    } finally {
      setSaving(false);
    }
  };

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
          <h2 className="text-white text-xl font-semibold">
            {editing ? "Edit Collection" : "Create Collection"}
          </h2>
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
          {/* Name + icon + visibility + sidebar */}
          <div className="rounded-xl border border-[#242B35] bg-[#171A20] px-4 py-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <div>
                <label className="block text-[#8292AA] text-xs mb-1">Category name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Weekend Specials"
                  className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#667085] focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="block text-[#8292AA] text-xs mb-1">Icon</label>
                <select
                  value={iconKey}
                  onChange={(e) => setIconKey(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none focus:border-[#8B5CF6]"
                >
                  <option value="">No icon</option>
                  {SIDEBAR_ICON_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Spanish name — a category invented here has no entry in the app's
                translation files, so without this it stays English on the /es
                site while everything around it translates. */}
            <div>
              <label className="block text-[#8292AA] text-xs mb-1">
                Category name (Spanish)
              </label>
              <input
                value={nameEs}
                onChange={(e) => setNameEs(e.target.value)}
                placeholder="Leave blank to translate automatically"
                className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#667085] focus:border-[#8B5CF6]"
              />
              <p className="mt-1 text-[11px] text-[#667085]">
                Shown to players browsing in Spanish. Left blank, it is translated
                from the English name on save.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                className={`flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
                  enabled ? "border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-white" : "border-[#2A3140] bg-transparent text-[#9AA7BC]"
                }`}
                title="Toggle whether this category shows on the home page"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-green-400" : "bg-gray-500"}`} />
                {enabled ? "On home page" : "Hidden from home"}
              </button>
              <button
                type="button"
                onClick={() => setShowInSidebar((v) => !v)}
                className={`flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
                  showInSidebar ? "border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-white" : "border-[#2A3140] bg-transparent text-[#9AA7BC]"
                }`}
                title="Also show this category in the player sidebar menu"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${showInSidebar ? "bg-[#B93DEB]" : "bg-gray-500"}`} />
                {showInSidebar ? "In sidebar" : "Not in sidebar"}
              </button>
            </div>
          </div>

          {/* Sidebar placement — where to show this category */}
          {showInSidebar && (
            <div className="rounded-xl border border-[#242B35] bg-[#171A20] px-4 py-4 space-y-3">
              <p className="text-sm font-medium text-white">Where do you want to show this?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPlacementMode("existing")}
                  disabled={menuGroups.length === 0}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                    placementMode === "existing" ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-white" : "border-[#2A3140] text-[#9AA7BC] hover:text-white"
                  }`}
                >
                  📂 Add under an existing menu
                </button>
                <button
                  type="button"
                  onClick={() => setPlacementMode("new")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    placementMode === "new" ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-white" : "border-[#2A3140] text-[#9AA7BC] hover:text-white"
                  }`}
                >
                  ➕ Create a new menu
                </button>
              </div>

              {placementMode === "existing" ? (
                <div>
                  <label className="block text-[#8292AA] text-xs mb-1">Menu (this category becomes a submenu)</label>
                  <select
                    value={menuGroupSel}
                    onChange={(e) => setMenuGroupSel(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none focus:border-[#8B5CF6]"
                  >
                    {menuGroups.map((g) => (
                      <option key={g.id} value={g.id}>{groupLabel(g)}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[#8292AA] text-xs mb-1">New menu name</label>
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={name.trim() || "e.g. New Arrivals"}
                    className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#667085] focus:border-[#8B5CF6]"
                  />
                </div>
              )}
              <p className="text-[11px] text-[#667085]">
                Manage menus &amp; order in <span className="text-gray-400">Settings → Home &amp; Menus → Menu Management</span>.
              </p>
            </div>
          )}

          {/* Selected / Ordered Strip (drag to reorder) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white text-base font-semibold">
                Selected
                <span className="ml-2 text-sm font-medium text-[#8292AA]">({orderedGames.length})</span>
              </h3>
              {orderedGames.length > 1 && (
                <span className="text-[#8292AA] text-xs">
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
                <div className="flex min-h-[146px] items-center text-sm text-[#8292AA]">Loading…</div>
              )}
              {!loading && orderedGames.length === 0 && (
                <div className="flex min-h-[146px] items-center text-sm text-[#667085]">
                  No games selected yet — add from the grid below.
                </div>
              )}
              {orderedGames.map((game, idx) => {
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
                    onDragEnd={() => { strip.stop(); setDraggedId(null); setDragOverId(null); }}
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
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-white text-[10px] font-bold">
                        #{idx + 1}
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

          {/* Add games — browse by Provider / Category, or look one up by name */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Add games</h3>
              <p className="text-[11px] text-[#8292AA]">
                {byName ? (
                  <>
                    Type a game&apos;s name to find it across every provider, then add it.
                  </>
                ) : (
                  <>
                    Open a provider or category, then <span className="text-gray-300">Select all</span> or add games one by one.
                  </>
                )}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-[#2A3140] bg-[#11141A] p-1">
              {(["provider", "category", "game"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setAddMode(m); setSelected(null); setAddSearch(""); setBrowsePage(1); }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    addMode === m ? "bg-[#8B5CF6] text-white" : "text-[#9AA7BC] hover:text-white"
                  }`}
                >
                  {m === "provider" ? "By Provider" : m === "category" ? "By Category" : "By Game Name"}
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
                  <div className="py-10 text-center text-sm text-[#667085]">No providers found.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {filteredStudios.map((p) => {
                      // Resolve by slug (same source as the provider grid), name as fallback.
                      const logo = getProviderLogoBySlug(p.slug) ?? getProviderLogo(p.name);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setSelected(p.name); setBrowsePage(1); }}
                          className="group relative flex h-[92px] items-center justify-center rounded-xl border border-[#242B35] bg-[#14171D] px-3 transition-all hover:-translate-y-0.5 hover:border-[#B93DEB]"
                        >
                          {logo ? (
                            <Image src={logo} alt={p.name} width={120} height={36} className="max-h-9 w-auto max-w-[80%] object-contain opacity-80 group-hover:opacity-100" />
                          ) : p.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.logo} alt={p.name} className="max-h-9 max-w-[80%] object-contain opacity-80 group-hover:opacity-100" />
                          ) : (
                            <span className="flex items-center gap-1.5 text-center text-sm font-bold capitalize text-white">
                              <Gamepad2 size={15} className="shrink-0 text-[#B93DEB]" />{p.name}
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
                <div className="py-10 text-center text-sm text-[#667085]">No categories found.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {filteredCategories.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => { setSelected(c.name); setBrowsePage(1); }}
                      className="group relative flex h-[92px] items-center justify-center rounded-xl border border-[#242B35] bg-[#14171D] px-3 text-center transition-all hover:-translate-y-0.5 hover:border-[#B93DEB]"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-bold capitalize text-white">
                        <LayoutGrid size={15} className="shrink-0 text-[#B93DEB]" />{c.name}
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
                  <ArrowLeft size={15} /> Back to {addMode === "provider" ? "providers" : "categories"}
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

          {/* Browse grid — shared by the name search and an opened provider or
              category, so results look and behave the same however they were
              reached. */}
          {(byName ? !!gameQuery : !!selected) && (
            <>
              {browseLoading ? (
                <div className="py-10 text-center text-sm text-[#667085]">Loading games…</div>
              ) : browseGames.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#667085]">No games found.</div>
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

          {/* Pagination */}
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
            {saving ? "Saving…" : editing ? "Save changes" : "Create collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
