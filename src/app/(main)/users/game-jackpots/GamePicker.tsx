"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import {
  getAdminGameOptions,
  getAdminGameProviders,
  GameOption,
  GameProviderOption,
} from "@/api/games/games";

const PAGE_SIZE = 20;

interface GamePickerProps {
  value: string;
  onChange: (gameId: string, game: GameOption) => void;
  /** Game ids to hide (already-configured games). */
  exclude?: string[];
}

export default function GamePicker({ value, onChange, exclude }: GamePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [providers, setProviders] = useState<GameProviderOption[]>([]);
  const [provOpen, setProvOpen] = useState(false);
  const [provSearch, setProvSearch] = useState("");
  const [items, setItems] = useState<GameOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GameOption | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Bumped on every new query so a slow in-flight response can't overwrite a newer one.
  const reqId = useRef(0);

  const fetchPage = useCallback(
    async (pageNum: number, term: string, prov: string, append: boolean) => {
      const myReq = ++reqId.current;
      setLoading(true);
      try {
        const res = await getAdminGameOptions({
          search: term,
          provider: prov,
          page: pageNum,
          limit: PAGE_SIZE,
          exclude,
        });
        if (myReq !== reqId.current) return; // stale
        setItems((prev) => (append ? [...prev, ...res.data] : res.data));
        setHasMore(res.hasMore);
        setPage(pageNum);
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    },
    [exclude],
  );

  // Load first page when opened; debounce search typing. Re-runs on provider change.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchPage(1, search, provider, false), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, search, provider, fetchPage]);

  // Load provider list once when first opened.
  useEffect(() => {
    if (!open || providers.length) return;
    getAdminGameProviders().then(setProviders).catch(() => {});
  }, [open, providers.length]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    fetchPage(page + 1, search, provider, true);
  }, [loading, hasMore, page, search, provider, fetchPage]);

  // Auto-load the next page when the bottom sentinel scrolls into view.
  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root, rootMargin: "80px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [open, loadMore, items.length]);

  const label = selected
    ? `${selected.name} (${selected.provider})`
    : value
      ? "Selected game"
      : "Select a game";

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-gray-700 bg-[#242B35] px-3 text-sm text-white"
      >
        <span className={value ? "text-white" : "text-gray-400"}>{label}</span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-gray-700 bg-[#1a2030] text-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-gray-700 px-3 py-2">
            <Search size={14} className="text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games…"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
            />
          </div>
          {providers.length > 1 && (
            <div className="relative border-b border-gray-700 px-3 py-2">
              <button
                type="button"
                onClick={() => setProvOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded border border-gray-700 bg-[#242B35] px-2 py-1 text-sm text-white"
              >
                <span className="truncate">{provider || "All providers"}</span>
                <ChevronDown size={14} className="shrink-0 text-gray-400" />
              </button>
              {provOpen && (
                <div className="absolute left-3 right-3 z-10 mt-1 rounded-md border border-gray-700 bg-[#161b24] shadow-lg">
                  <div className="flex items-center gap-2 border-b border-gray-700 px-2 py-1.5">
                    <Search size={12} className="text-gray-400" />
                    <input
                      autoFocus
                      value={provSearch}
                      onChange={(e) => setProvSearch(e.target.value)}
                      placeholder="Search providers…"
                      className="w-full bg-transparent text-xs text-white outline-none placeholder:text-gray-500"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto overscroll-contain">
                    <button
                      type="button"
                      onClick={() => {
                        setProvider("");
                        setProvOpen(false);
                        setProvSearch("");
                      }}
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[#242B35]"
                    >
                      All providers
                    </button>
                    {providers
                      .filter((p) =>
                        p.provider.toLowerCase().includes(provSearch.toLowerCase())
                      )
                      .map((p) => (
                        <button
                          key={p.provider}
                          type="button"
                          onClick={() => {
                            setProvider(p.provider);
                            setProvOpen(false);
                            setProvSearch("");
                          }}
                          className="block w-full truncate px-3 py-1.5 text-left text-xs hover:bg-[#242B35]"
                        >
                          {p.provider} ({p.count})
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={scrollRef} className="max-h-72 overflow-y-auto overscroll-contain">
            {items.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelected(g);
                  onChange(g.id, g);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#242B35]"
              >
                <span>
                  {g.name} ({g.provider})
                </span>
                {value === g.id && <Check size={14} className="text-purple-400" />}
              </button>
            ))}
            {loading && (
              <div className="flex items-center justify-center py-3 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
              </div>
            )}
            {!loading && !items.length && (
              <div className="py-4 text-center text-sm text-gray-400">No games found.</div>
            )}
            {!loading && hasMore && (
              <button
                type="button"
                onClick={loadMore}
                className="w-full py-2 text-center text-xs text-purple-400 hover:bg-[#242B35]"
              >
                Load more
              </button>
            )}
            {/* Auto-load trigger. */}
            <div ref={sentinelRef} className="h-1" />
          </div>
        </div>
      )}
    </div>
  );
}
