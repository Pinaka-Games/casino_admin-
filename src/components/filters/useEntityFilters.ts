"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FilterChip,
  FilterField,
  FilterValues,
  checkedValues,
  fieldKeys,
} from "./types";

interface UseEntityFiltersOptions {
  fields: FilterField[];
  defaults: FilterValues;
  /** Debounce for the toolbar search box, in ms. */
  searchDelay?: number;
}

/**
 * Owns the applied filter values for one tab.
 *
 * The sheet edits a draft and applies it in one go, so a request only fires on
 * Apply. The search box is the exception: it is live, so it is debounced here
 * before it joins the applied values.
 */
export function useEntityFilters({
  fields,
  defaults,
  searchDelay = 500,
}: UseEntityFiltersOptions) {
  const [values, setValues] = useState<FilterValues>(defaults);
  const [searchInput, setSearchInput] = useState(defaults.search ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setValues((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput }
      );
    }, searchDelay);
    return () => clearTimeout(timer);
  }, [searchInput, searchDelay]);

  const clearKeys = useCallback(
    (keys: string[]) =>
      setValues((prev) => {
        const next = { ...prev };
        keys.forEach((key) => {
          next[key] = defaults[key] ?? "";
        });
        return next;
      }),
    [defaults]
  );

  const reset = useCallback(() => {
    setSearchInput("");
    setValues(defaults);
  }, [defaults]);

  /** Fields differing from their default, ignoring hidden ones. */
  const changedFields = useMemo(
    () =>
      fields.filter((field) => {
        if (field.showWhen && !field.showWhen(values)) return false;
        return fieldKeys(field).some(
          (key) => (values[key] ?? "") !== (defaults[key] ?? "")
        );
      }),
    [fields, values, defaults]
  );

  const activeCount = changedFields.length;

  const chips: FilterChip[] = useMemo(
    () =>
      changedFields.map((field) => {
        const keys = fieldKeys(field);
        let label = field.label;

        if (field.type === "select") {
          const option = field.options.find((o) => o.value === values[field.key]);
          label = option ? option.label : `${field.label}: ${values[field.key]}`;
        } else if (field.type === "checkboxGroup") {
          const selected = checkedValues(values[field.key]);
          // One or two selections read better named than counted; past that the
          // chip would be longer than the row it sits on.
          const named = selected
            .map(
              (value) =>
                field.options.find((option) => option.value === value)?.label ??
                value,
            )
            .slice(0, 2)
            .join(", ");
          label =
            selected.length > 2
              ? `${field.label}: ${selected.length} selected`
              : `${field.label}: ${named}`;
        } else if (field.type === "text") {
          label = `${field.label}: ${values[field.key]}`;
        } else if (field.type === "dateRange") {
          label = `${values[field.fromKey] || "…"} → ${values[field.toKey] || "…"}`;
        } else if (field.type === "numberRange") {
          label = `${field.label} ${values[field.minKey] || "min"} - ${values[field.maxKey] || "max"}`;
        }

        return {
          key: keys.join("-"),
          label,
          clear: () => clearKeys(keys),
        };
      }),
    [changedFields, values, clearKeys]
  );

  const hasAnyFilter = activeCount > 0 || (values.search ?? "").trim() !== "";

  return {
    values,
    setValues,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset,
  };
}

/**
 * Appends every non-default value to a URLSearchParams, skipping blanks and
 * hidden fields. Tabs that need different param names map values themselves.
 */
export function appendFilterParams(
  params: URLSearchParams,
  fields: FilterField[],
  values: FilterValues,
  defaults: FilterValues
) {
  const push = (key: string) => {
    if (key === "search") return; // handled by the caller, it is always sent raw
    const value = (values[key] ?? "").trim();
    if (value === "" || value === (defaults[key] ?? "")) return;
    params.append(key, value);
  };

  fields.forEach((field) => {
    if (field.showWhen && !field.showWhen(values)) return;
    fieldKeys(field).forEach(push);
  });

  const search = (values.search ?? "").trim();
  if (search) params.append("search", search);
}
