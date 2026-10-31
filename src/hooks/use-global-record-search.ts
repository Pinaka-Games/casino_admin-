"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import {
  GLOBAL_RECORD_SOURCES,
  type GlobalRecordEntry,
  type GlobalRecordSource,
} from "@/config/global-search-sources";

export type GlobalRecordGroup = {
  kind: GlobalRecordSource["kind"];
  label: string;
  entries: GlobalRecordEntry[];
};

/** Typing pause before a query is worth spending a round trip on. */
const DEBOUNCE_MS = 350;

/** A dropped request is normal here — every keystroke cancels the last one. */
const isAborted = (error: unknown) =>
  axios.isCancel(error) ||
  (error instanceof DOMException && error.name === "AbortError") ||
  (error as { code?: string })?.code === "ERR_CANCELED";

/**
 * Live record results for `query` — players, agents, games, bonuses — from the
 * sources this admin has permission to open.
 *
 * Every keystroke aborts the previous round of requests, so a slow endpoint can
 * never repaint the panel with results for a query the admin has moved past.
 * Sources are independent: one failing (or timing out) hides only its own
 * group, and the rest still render.
 */
export const useGlobalRecordSearch = (query: string) => {
  const { user, hasPermission, isHydrated } = useAuth();
  const [groups, setGroups] = useState<GlobalRecordGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isSuperadmin = user?.roles?.some(
    (role: any) => role.isActive && role.name === "superadmin"
  );

  // Keyed by value, not by identity: AuthContext rebuilds `hasPermission` on
  // every render, so memoising on the function itself would hand the effect a
  // fresh array each render and re-fire the search forever.
  const permittedKeys = isHydrated
    ? GLOBAL_RECORD_SOURCES.filter(
        (source) =>
          isSuperadmin || !source.permission || hasPermission(source.permission),
      )
        .map((source) => source.kind)
        .join(",")
    : "";

  const sources = useMemo(() => {
    const allowed = permittedKeys.split(",").filter(Boolean);
    return GLOBAL_RECORD_SOURCES.filter((source) =>
      allowed.includes(source.kind),
    );
  }, [permittedKeys]);

  useEffect(() => {
    const term = query.trim();

    abortRef.current?.abort();

    const usable = sources.filter((source) => term.length >= source.minLength);
    if (usable.length === 0) {
      abortRef.current = null;
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      const settled = await Promise.all(
        usable.map(async (source) => {
          try {
            const entries = await source.search(term, controller.signal);
            return { source, entries };
          } catch (error) {
            if (!isAborted(error)) {
              console.error(`Global search: ${source.kind} lookup failed`, error);
            }
            return { source, entries: [] as GlobalRecordEntry[] };
          }
        }),
      );

      if (controller.signal.aborted) return;

      setGroups(
        settled
          .filter((result) => result.entries.length > 0)
          .map(({ source, entries }) => ({
            kind: source.kind,
            label: source.label,
            entries,
          })),
      );
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, sources]);

  return { groups, loading };
};
