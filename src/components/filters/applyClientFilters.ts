import { FilterValues } from "./types";

/**
 * How a tab's rows answer its filter values. Tabs that already hold their whole
 * list in memory (most player detail tabs do) describe the mapping here instead
 * of writing the same search/date/amount loops again.
 */
export interface ClientFilterConfig<T> {
  /** Fields the toolbar search box matches against, case-insensitively. */
  search?: (row: T) => (string | null | undefined)[];
  /** One entry per select field; `match` is only called for non-default values. */
  selects?: { key: string; match: (row: T, value: string) => boolean }[];
  /** Inclusive whole-day comparison against the row's own timestamp. */
  dateRange?: {
    fromKey: string;
    toKey: string;
    get: (row: T) => string | null | undefined;
  };
  numberRanges?: { minKey: string; maxKey: string; get: (row: T) => number }[];
}

export function applyClientFilters<T>(
  rows: T[],
  values: FilterValues,
  config: ClientFilterConfig<T>
): T[] {
  const search = (values.search ?? "").trim().toLowerCase();

  const from = config.dateRange && values[config.dateRange.fromKey]
    ? new Date(`${values[config.dateRange.fromKey]}T00:00:00`)
    : null;
  const to = config.dateRange && values[config.dateRange.toKey]
    ? new Date(`${values[config.dateRange.toKey]}T23:59:59.999`)
    : null;

  return rows.filter((row) => {
    if (search && config.search) {
      const haystack = config
        .search(row)
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    for (const select of config.selects ?? []) {
      const value = values[select.key];
      // "all" is every tab's default for a select, so it never filters.
      if (!value || value === "all") continue;
      if (!select.match(row, value)) return false;
    }

    if (from || to) {
      const raw = config.dateRange!.get(row);
      if (!raw) return false;
      const date = new Date(raw);
      if (isNaN(date.getTime())) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
    }

    for (const range of config.numberRanges ?? []) {
      const minRaw = (values[range.minKey] ?? "").trim();
      const maxRaw = (values[range.maxKey] ?? "").trim();
      if (minRaw === "" && maxRaw === "") continue;

      const amount = range.get(row);
      const min = minRaw === "" ? null : Number(minRaw);
      const max = maxRaw === "" ? null : Number(maxRaw);
      if (min !== null && !isNaN(min) && amount < min) return false;
      if (max !== null && !isNaN(max) && amount > max) return false;
    }

    return true;
  });
}
