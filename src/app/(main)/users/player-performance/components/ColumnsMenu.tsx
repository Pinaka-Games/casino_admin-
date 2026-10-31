"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Check, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLUMN_GROUPS, PERFORMANCE_COLUMNS, type ColumnGroupId } from "./columns";

const STORAGE_KEY = "player-performance:hidden-column-groups";

/*
  Hidden groups live in localStorage, read through useSyncExternalStore so the
  server render (no storage) and the first client render agree, and the saved
  choice applies straight after hydration without a setState-in-effect pass.
  Storage can throw (private mode, blocked site data): the choice then holds
  in memory for this visit instead.
*/
const listeners = new Set<() => void>();
let memoryValue: string | null = null;

function readStored(): string {
  if (memoryValue !== null) return memoryValue;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStored(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    memoryValue = null;
  } catch {
    memoryValue = value;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const VALID = new Set<string>(COLUMN_GROUPS.map((g) => g.id));

function parse(raw: string): Set<ColumnGroupId> {
  if (!raw) return new Set();
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return new Set();
    return new Set(list.filter((x): x is ColumnGroupId => typeof x === "string" && VALID.has(x)));
  } catch {
    return new Set();
  }
}

export function useHiddenGroups() {
  const raw = useSyncExternalStore(subscribe, readStored, () => "");
  const hidden = useMemo(() => parse(raw), [raw]);

  const setGroupHidden = useCallback(
    (id: ColumnGroupId, hide: boolean) => {
      const next = new Set(hidden);
      if (hide) next.add(id);
      else next.delete(id);
      writeStored(JSON.stringify([...next]));
    },
    [hidden],
  );

  const showAll = useCallback(() => writeStored("[]"), []);

  return { hidden, setGroupHidden, showAll };
}

export default function ColumnsMenu({
  hidden,
  onToggle,
  onShowAll,
}: {
  hidden: Set<ColumnGroupId>;
  onToggle: (id: ColumnGroupId, hide: boolean) => void;
  onShowAll: () => void;
}) {
  // The table has no group band above its headers, so this menu is where the
  // grouping shows: each group lists the columns it holds.
  const columnsByGroup = useMemo(() => {
    const m = new Map<ColumnGroupId, string[]>();
    PERFORMANCE_COLUMNS.forEach((c) => m.set(c.group, [...(m.get(c.group) ?? []), c.label]));
    return m;
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-lg border-white/10 bg-[#1A2030] px-3 text-xs text-gray-300 hover:bg-[#252b3d] hover:text-white"
        >
          <Columns3 size={14} className="text-[#B93DEB]" />
          Columns
          {hidden.size > 0 && (
            <span className="rounded-md bg-purple-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
              {COLUMN_GROUPS.length - hidden.size}/{COLUMN_GROUPS.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-lg border border-[#2b323b] bg-[#191D24] p-3 text-white shadow-xl"
      >
        <p className="mb-2 text-xs font-medium text-gray-300">Column groups</p>
        <div className="space-y-1">
          {COLUMN_GROUPS.map((g) => {
            const visible = !hidden.has(g.id);
            const names = columnsByGroup.get(g.id) ?? [];
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={visible}
                onClick={() => onToggle(g.id, visible)}
                title={names.join(", ")}
                className={`flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                  visible
                    ? "bg-purple-600/20 text-white"
                    : "text-gray-400 hover:bg-[#242B35] hover:text-gray-200"
                }`}
              >
                <span className="min-w-0">
                  <span className="block">
                    {g.label}
                    <span className="ml-1.5 text-gray-500">({names.length})</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-gray-500">{names.join(" · ")}</span>
                </span>
                {visible && <Check size={14} className="mt-0.5 shrink-0 text-purple-400" />}
              </button>
            );
          })}
        </div>
        {hidden.size > 0 && (
          <button
            type="button"
            onClick={onShowAll}
            className="mt-3 w-full rounded-md border border-[#242B35] py-1.5 text-xs text-gray-300 hover:bg-[#242B35] hover:text-white"
          >
            Show all columns
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
