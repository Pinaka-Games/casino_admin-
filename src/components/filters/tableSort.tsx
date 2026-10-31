"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

export interface TableSort<K extends string> {
  key: K | null;
  dir: SortDir;
}

/** How a row yields the value for each sortable column. */
export type SortAccessors<T, K extends string> = Record<
  K,
  (row: T) => number | string | null | undefined
>;

/**
 * Client-side column sorting for the detail tabs.
 *
 * These tables hold their whole list in memory and paginate it locally, so
 * sorting here covers every row, not just the page on screen. A table the SERVER
 * pages (Game History) must sort in SQL instead — see `sortBy` on bet-history.
 */
export function useTableSort<K extends string>(initial: TableSort<K> = { key: null, dir: "desc" }) {
  const [sort, setSort] = useState<TableSort<K>>(initial);

  /** First click sorts high-to-low, which is what money columns are asked for. */
  const toggle = useCallback(
    (key: K) =>
      setSort((prev) =>
        prev.key === key
          ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
          : { key, dir: "desc" }
      ),
    []
  );

  return { sort, setSort, toggle };
}

/** Applies the active sort; returns the rows untouched when nothing is sorted. */
export function useSortedRows<T, K extends string>(
  rows: T[],
  sort: TableSort<K>,
  accessors: SortAccessors<T, K>
): T[] {
  return useMemo(() => {
    if (!sort.key) return rows;

    const read = accessors[sort.key];
    if (!read) return rows;

    const factor = sort.dir === "asc" ? 1 : -1;

    // Sorting a copy: the caller's array is also what pagination and the totals
    // read from, and mutating it in place would reorder those too.
    return [...rows].sort((a, b) => {
      const left = read(a);
      const right = read(b);

      // Blanks sink to the bottom whichever way the column is pointing, so an
      // empty cell never occupies the top of a "highest first" list.
      const leftMissing = left === null || left === undefined || left === "";
      const rightMissing = right === null || right === undefined || right === "";
      if (leftMissing && rightMissing) return 0;
      if (leftMissing) return 1;
      if (rightMissing) return -1;

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }

      return String(left).localeCompare(String(right)) * factor;
    });
  }, [rows, sort, accessors]);
}

interface SortableThProps<K extends string> {
  label: string;
  sortKey: K;
  sort: TableSort<K>;
  onToggle: (key: K) => void;
  /** The th's own classes, so each table keeps its existing header styling. */
  className?: string;
  /** Where the button sits inside the cell. */
  align?: "left" | "center" | "right";
}

/** A column header that sorts, styled like the GGR control on Agent Listing. */
export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
  className = "",
  align = "left",
}: SortableThProps<K>) {
  const active = sort.key === sortKey;
  const justify =
    align === "center" ? "justify-center mx-auto" : align === "right" ? "justify-end ml-auto" : "";

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={`flex items-center gap-1 hover:text-[#B93DEB] transition-colors ${justify}`}
      >
        {label}
        {!active && <ChevronsUpDown size={12} className="text-gray-400" />}
        {active && sort.dir === "desc" && <ChevronDown size={12} className="text-[#B93DEB]" />}
        {active && sort.dir === "asc" && <ChevronUp size={12} className="text-[#B93DEB]" />}
      </button>
    </th>
  );
}
