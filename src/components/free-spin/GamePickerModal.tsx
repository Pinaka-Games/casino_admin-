"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Layers, Loader2, Search, X } from "lucide-react";

import {
  getAllFreeSpinGames,
  getFreeSpinGames,
  type FreeSpinGameOption,
} from "@/api/games/games";
import type { FreeSpinSelection } from "@/types/free-spin";

type SelectedGame = FreeSpinSelection["games"][number];

const PAGE_SIZE = 20;

interface Props {
  open: boolean;
  onClose: () => void;
  softwareId: number;
  softwareName?: string;
  /** Games already on the template — the starting point for this session. */
  selected: SelectedGame[];
  /** Template-level spins, shown as the placeholder on each game's box. */
  defaultSpins?: number;
  onConfirm: (games: SelectedGame[]) => void;
}

/**
 * Full-size game picker for a free-spin template.
 *
 * Replaces the inline dropdown, which put a scrolling list inside an already
 * scrolling form: picking more than a couple of games meant losing sight of
 * what was picked. Same shape as the recipient picker — browse on the left,
 * running selection on the right — so the two multi-selects in the admin behave
 * identically.
 *
 * Each game is granted as its own AleaPlay bonus, so the right-hand panel is
 * also where a game's spin count is overridden; the running total at the bottom
 * is what one player actually costs.
 *
 * Selection is staged locally and handed back only on Done — cancelling leaves
 * the template untouched.
 */
export default function GamePickerModal({
  open,
  onClose,
  softwareId,
  softwareName,
  selected,
  defaultSpins,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState<SelectedGame[]>(selected);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<FreeSpinGameOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  /** Set when 'Add all' hit the server's cap, so the notice can be shown inline. */
  const [truncatedAt, setTruncatedAt] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Bumped per query so a slow in-flight response can't overwrite a newer one.
  const reqId = useRef(0);

  // Reopening starts from what the template currently holds, so a cancelled
  // session cannot leak into the next one.
  useEffect(() => {
    if (!open) return;
    setDraft(selected);
    setSearch("");
    setItems([]);
    setPage(1);
    setTruncatedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchPage = useCallback(
    async (pageNum: number, term: string, append: boolean) => {
      const myReq = ++reqId.current;
      setLoading(true);
      try {
        const res = await getFreeSpinGames({
          softwareId,
          search: term,
          page: pageNum,
          limit: PAGE_SIZE,
        });
        if (myReq !== reqId.current) return; // stale
        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
        setHasMore(res.hasMore);
        setTotal(res.total ?? 0);
        setPage(pageNum);
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    },
    [softwareId],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchPage(1, search, false), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, search, fetchPage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    fetchPage(page + 1, search, true);
  }, [loading, hasMore, page, search, fetchPage]);

  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { root, rootMargin: "80px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [open, loadMore, items.length]);

  const draftIds = useMemo(() => new Set(draft.map((g) => g.id)), [draft]);

  const toggle = (game: FreeSpinGameOption) => {
    const id = Number(game.providerGameId);
    setDraft((prev) =>
      prev.some((g) => g.id === id)
        ? prev.filter((g) => g.id !== id)
        : [...prev, { id, name: game.name }],
    );
  };

  const allShownSelected =
    items.length > 0 && items.every((g) => draftIds.has(Number(g.providerGameId)));

  const toggleAllShown = () => {
    if (allShownSelected) {
      const shown = new Set(items.map((g) => Number(g.providerGameId)));
      setDraft((prev) => prev.filter((g) => !shown.has(g.id)));
      return;
    }
    setDraft((prev) => {
      const merged = new Map(prev.map((g) => [g.id, g]));
      items.forEach((g) => {
        const id = Number(g.providerGameId);
        if (!merged.has(id)) merged.set(id, { id, name: g.name });
      });
      return Array.from(merged.values());
    });
  };

  /**
   * Add every game the current search matches, not only the pages scrolled into
   * view — a provider can carry hundreds of titles and scrolling to tick them
   * all is not a selection method.
   */
  const addAllMatching = async () => {
    setBulkLoading(true);
    try {
      const res = await getAllFreeSpinGames({ softwareId, search });
      setDraft((prev) => {
        const merged = new Map(prev.map((g) => [g.id, g]));
        res.data.forEach((g) => {
          const id = Number(g.providerGameId);
          if (!merged.has(id)) merged.set(id, { id, name: g.name });
        });
        return Array.from(merged.values());
      });
      if (res.truncated) {
        // Inline rather than a browser alert: this modal is already open, and an
        // alert on top of it looks like an error when it is only a note that the
        // selection was capped.
        setTruncatedAt(res.total);
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const perGameDefault = Number(defaultSpins) > 0 ? Number(defaultSpins) : 0;
  const totalSpins = draft.reduce(
    (sum, g) => sum + (Number(g.spins) > 0 ? Number(g.spins) : perGameDefault),
    0,
  );

  if (!open) return null;

  return (
    // Above the config dialog (z-50) that opens this one.
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[min(86vh,760px)] w-full max-w-[min(1100px,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border border-[#242B35] bg-[#15181E] text-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#242B35] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base text-white">Choose games</h2>
            <p className="truncate text-xs text-gray-500">
              {softwareName ?? `Provider #${softwareId}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Browse on the left, running selection on the right. */}
        {/* Stacked on a phone, the panes were auto-height rows: the game list
            grew to its content and was clipped, so it never scrolled and the
            selection pane sat below the fold. Sized rows keep both scrollable. */}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1.4fr)_minmax(0,1fr)] overflow-hidden md:grid-rows-none md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* ── Browse ── */}
          <div className="flex flex-col overflow-hidden border-b border-[#242B35] md:border-b-0 md:border-r">
            <div className="shrink-0 space-y-3 p-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search games by name"
                  className="h-10 w-full rounded border border-[#3b414d] bg-[#242B35] pl-9 pr-3 text-sm text-white outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-gray-300">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={toggleAllShown}
                    className="size-4 accent-[#B93DEB]"
                  />
                  Select all shown ({items.length})
                </label>

                {total > items.length && (
                  <button
                    type="button"
                    onClick={addAllMatching}
                    disabled={bulkLoading}
                    title={
                      search
                        ? "Add every game matching this search"
                        : "Add every game this provider has"
                    }
                    className="flex items-center gap-1 rounded bg-[#242B35] px-2 py-1 text-[11px] text-gray-300 hover:text-white disabled:opacity-50"
                  >
                    {bulkLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Layers className="size-3" />
                    )}
                    Add all {total}
                  </button>
                )}
              </div>
            </div>

            {truncatedAt !== null && (
              <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <p className="flex-1 text-[11px] leading-relaxed text-amber-200">
                  This provider has more games than can be added at once. The first{" "}
                  {truncatedAt} were selected — narrow the search to pick the rest.
                </p>
                <button
                  type="button"
                  onClick={() => setTruncatedAt(null)}
                  className="shrink-0 text-amber-300 hover:text-amber-100"
                  aria-label="Dismiss"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pb-2">
              {loading && !items.length ? (
                <p className="p-4 text-sm text-gray-500">Loading games…</p>
              ) : !items.length ? (
                <p className="p-4 text-sm text-gray-500">
                  No games match this search.
                </p>
              ) : (
                items.map((game) => {
                  const active = draftIds.has(Number(game.providerGameId));
                  return (
                    <div
                      key={game.id}
                      onClick={() => toggle(game)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#20262f]"
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          active ? "border-[#B93DEB] bg-[#B93DEB]" : "border-[#4b5563]"
                        }`}
                      >
                        {active && <Check className="size-3 text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{game.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          #{game.providerGameId}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}

              {loading && items.length > 0 && (
                <div className="flex items-center justify-center py-3 text-gray-400">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
              {!loading && hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  className="w-full rounded py-2 text-center text-[11px] text-purple-400 hover:bg-[#20262f]"
                >
                  Load more
                </button>
              )}
              <div ref={sentinelRef} className="h-1" />
            </div>

            <p className="shrink-0 border-t border-[#242B35] px-4 py-2 text-xs text-gray-500">
              Showing {items.length} of {total}. Search to reach the rest.
            </p>
          </div>

          {/* ── Running selection ── */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
              <p className="text-sm text-white">
                Selected <span className="text-[#B93DEB]">{draft.length}</span>
              </p>
              {draft.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {draft.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">
                  Nothing selected yet. Pick games from the list on the left.
                </p>
              ) : (
                draft.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[#20262f]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {game.name ?? `#${game.id}`}
                    </span>

                    {/* Blank means "use the template's per-game number". */}
                    <input
                      type="number"
                      min={1}
                      value={game.spins ?? ""}
                      placeholder={defaultSpins ? String(defaultSpins) : "spins"}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setDraft((prev) =>
                          prev.map((g) =>
                            g.id === game.id
                              ? {
                                  ...g,
                                  spins:
                                    e.target.value && next > 0 ? next : undefined,
                                }
                              : g,
                          ),
                        );
                      }}
                      className="h-7 w-16 shrink-0 rounded border border-gray-600 bg-[#242B35] px-2 text-center text-xs text-white [appearance:textfield] focus:border-purple-500 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label={`Spins for ${game.name ?? game.id}`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => prev.filter((g) => g.id !== game.id))
                      }
                      className="shrink-0 text-gray-500 hover:text-white"
                      aria-label={`Remove ${game.name ?? game.id}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {draft.length > 0 && (
              <p className="shrink-0 border-t border-[#242B35] px-4 py-2 text-xs text-gray-400">
                <span className="text-white">
                  {totalSpins} spin{totalSpins === 1 ? "" : "s"} per player
                </span>{" "}
                — each game is granted separately. Leave a box blank to use the
                template default.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#242B35] px-5 py-4">
          <p className="text-xs text-gray-500">
            Search as many times as you need — the selection on the right is kept.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-gray-600 px-4 text-sm text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(draft);
                onClose();
              }}
              className="h-10 rounded-lg bg-purple-500 px-6 text-sm text-white hover:bg-purple-600"
            >
              Done{draft.length > 0 ? ` (${draft.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
