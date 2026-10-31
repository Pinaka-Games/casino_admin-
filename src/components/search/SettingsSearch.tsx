"use client";

/**
 * Global settings search for the admin console.
 *
 * A search bar in the header that finds any destination in the sidebar AND any
 * individual field on System Configuration, then navigates straight to it —
 * a config toggle deep-links to the page with that field scrolled into view and
 * highlighted, not just to the page.
 *
 * Keyboard: ⌘K / Ctrl+K focuses it, ↑/↓ move, Enter opens, Esc closes.
 * Results are permission-filtered, so nothing unreachable is ever offered.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CornerDownLeft,
  SlidersHorizontal,
  FileText,
  User,
  Handshake,
  Gamepad2,
  Gift,
  Loader2,
} from "lucide-react";
import { useSettingsSearch } from "@/hooks/use-settings-search";
import { useGlobalRecordSearch } from "@/hooks/use-global-record-search";
import type { SettingsSearchEntry } from "@/config/settings-search";
import type { GlobalRecordKind } from "@/config/global-search-sources";

/**
 * One row of the results panel, whatever it came from — a sidebar destination,
 * a System Configuration field, or a live record (player, agent, game, bonus).
 * Flattening the two sources into a single shape keeps one keyboard cursor
 * walking the whole panel.
 */
type ResultRow = {
  id: string;
  title: string;
  /** Second line: the breadcrumb for a destination, the email/provider for a record. */
  caption: string;
  href: string;
  icon: typeof FileText;
  /** Tailwind classes for the leading icon chip. */
  tone: string;
};

const RECORD_ICONS: Record<GlobalRecordKind, typeof FileText> = {
  player: User,
  agent: Handshake,
  game: Gamepad2,
  bonus: Gift,
};

const RECORD_TONES: Record<GlobalRecordKind, string> = {
  player: "bg-[#22C55E]/10 text-[#4ADE80]",
  agent: "bg-[#38BDF8]/10 text-[#7DD3FC]",
  game: "bg-[#B93DEB]/10 text-[#C77BF0]",
  bonus: "bg-[#F59E0B]/10 text-[#F59E0B]",
};

/** Wrap the part of `text` matching `query` so the hit is visible at a glance. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return <>{text}</>;

  // Longest first, so "payment manager" doesn't get chopped by "pay".
  const pattern = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const parts = text.split(new RegExp(`(${pattern})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        terms.includes(part.toLowerCase()) ? (
          <mark key={i} className="bg-transparent text-[#D98BFF] font-semibold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function SettingsSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [shortcutHint, setShortcutHint] = useState("Ctrl K");

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useSettingsSearch(query);
  const { groups: recordGroups, loading: recordsLoading } =
    useGlobalRecordSearch(query);

  // Group for display while keeping one flat list for the keyboard cursor —
  // the two must stay in the same order.
  //
  // Destinations come first (a page is the broader answer, and it is the one
  // that resolves instantly), then the live records, one section per source.
  const groups = useMemo(() => {
    const byBreadcrumb = new Map<string, SettingsSearchEntry[]>();
    results.forEach((entry) => {
      const bucket = byBreadcrumb.get(entry.breadcrumb);
      if (bucket) bucket.push(entry);
      else byBreadcrumb.set(entry.breadcrumb, [entry]);
    });

    const destinationSections = Array.from(byBreadcrumb, ([heading, entries]) => ({
      heading,
      rows: entries.map<ResultRow>((entry) => ({
        id: entry.id,
        title: entry.title,
        caption: `${entry.kind === "setting" ? "Setting" : "Page"} · ${entry.breadcrumb}`,
        href: entry.href,
        icon: entry.kind === "setting" ? SlidersHorizontal : FileText,
        tone:
          entry.kind === "setting"
            ? "bg-[#F59E0B]/10 text-[#F59E0B]"
            : "bg-[#B93DEB]/10 text-[#C77BF0]",
      })),
    }));

    const recordSections = recordGroups.map((group) => ({
      heading: group.label,
      rows: group.entries.map<ResultRow>((entry) => ({
        id: entry.id,
        title: entry.title,
        caption: entry.subtitle
          ? `${group.label.replace(/s$/, "")} · ${entry.subtitle}`
          : group.label.replace(/s$/, ""),
        href: entry.href,
        icon: RECORD_ICONS[entry.recordKind],
        tone: RECORD_TONES[entry.recordKind],
      })),
    }));

    return [...destinationSections, ...recordSections];
  }, [results, recordGroups]);

  const flatResults = useMemo(
    () => groups.flatMap((group) => group.rows),
    [groups],
  );

  useEffect(() => setActiveIndex(0), [query]);

  // Record results land after the destinations, so the list can also shrink
  // (a source returning nothing) — never leave the cursor past the last row.
  useEffect(() => {
    setActiveIndex((i) => (i < flatResults.length ? i : 0));
  }, [flatResults.length]);

  useEffect(() => {
    // ⌘ on Mac, Ctrl elsewhere. navigator is client-only, hence the effect.
    const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
    setShortcutHint(isMac ? "⌘ K" : "Ctrl K");
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  const go = useCallback(
    (row: ResultRow) => {
      close();
      setQuery("");
      inputRef.current?.blur();
      router.push(row.href);
    },
    [close, router],
  );

  // ⌘K / Ctrl+K from anywhere focuses the bar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close when the click lands outside the bar and its result panel.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-result-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      close();
      inputRef.current?.blur();
      return;
    }
    if (!open || flatResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % flatResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = flatResults[activeIndex];
      if (row) go(row);
    }
  };

  const showPanel = open && query.trim().length > 0;
  // Running index across groups, so the keyboard cursor matches what's drawn.
  let renderIndex = -1;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search settings, pages, players, agents, games…"
          aria-label="Search settings and records"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="settings-search-results"
          className="h-10 w-full rounded-lg border border-[#2C323D] bg-[#15181E] pl-9 pr-16 text-sm text-white placeholder:text-gray-500 outline-none transition-colors focus:border-[#B93DEB]"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[#2C323D] bg-[#191D24] px-1.5 py-0.5 text-[10px] font-medium text-gray-500 sm:block">
          {shortcutHint}
        </kbd>
      </div>

      {showPanel && (
        <div
          id="settings-search-results"
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[26rem] overflow-y-auto rounded-xl border border-[#2C323D] bg-[#191D24] py-2 shadow-2xl"
        >
          {flatResults.length === 0 ? (
            recordsLoading ? (
              <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-gray-500">
                <Loader2 size={14} className="animate-spin" />
                Searching…
              </p>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                No setting, page or record matches “{query.trim()}”.
              </p>
            )
          ) : (
            <>
              {groups.map((group) => (
                <div key={group.heading} className="mb-1 last:mb-0">
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {group.heading}
                  </p>
                  {group.rows.map((row) => {
                    renderIndex += 1;
                    const index = renderIndex;
                    const isActive = index === activeIndex;
                    const Icon = row.icon;

                    return (
                      <button
                        key={row.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-result-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => go(row)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive ? "bg-[#B93DEB]/15" : "hover:bg-white/5"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${row.tone}`}
                        >
                          <Icon size={14} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">
                            <Highlighted text={row.title} query={query} />
                          </span>
                          <span className="block truncate text-[11px] text-gray-500">
                            <Highlighted text={row.caption} query={query} />
                          </span>
                        </span>

                        {isActive && (
                          <CornerDownLeft
                            size={14}
                            className="shrink-0 text-gray-500"
                            aria-hidden
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Destinations resolve instantly; records land a beat later.
                  Say so, or the panel looks like it already has the answer. */}
              {recordsLoading && (
                <p className="flex items-center gap-2 px-4 py-2 text-[11px] text-gray-500">
                  <Loader2 size={12} className="animate-spin" />
                  Searching players, agents, games…
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
