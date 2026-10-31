"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Filter, Loader2, RefreshCw, ScrollText, Search, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { profileApi } from "@/api/users/users";
import { UserWithProfile } from "@/types/profile.type";
import { useFreeSpinConfigStore } from "@/store/free-spin-config-store";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/TableSearch/ListSearch";
import toast from "react-hot-toast";
import { FreeSpinAPI } from "@/api";
import { parseGrantSource, SOURCE_LABEL_PREFIXES } from "@/lib/free-spin-source";
import { getApiErrorMessage } from "@/api/messaging/error-message";
import AllocationDetailModal from "@/components/free-spin/AllocationDetailModal";
import {
  describeAllocationGames,
  groupGrantsByAllocation,
  type GrantAllocation,
} from "@/lib/free-spin-grants";
import {
  resolveSelections,
  summarizeGames,
  summarizeProviders,
  summarizeTemplateSpins,
} from "@/lib/free-spin-selection";
import ConfirmModal from "@/components/free-spin/ConfirmModal";
import GrantFiltersPanel, {
  countActiveFilters,
  describeActiveFilters,
  grantedRangeStart,
  DEFAULT_GRANT_FILTERS,
  type GrantFilters,
} from "./GrantFiltersPanel";

/**
 * Players fetched per page in the assign modal.
 *
 * 15 = 5 rows × 3 columns on desktop, so the last row is never ragged and a
 * page fits without scrolling the list.
 */
const PAGE_SIZE = 15;

/** How long to follow a queued grant job before calling it stuck. */
const JOB_POLL_INTERVAL_MS = 1_500;
const JOB_POLL_TIMEOUT_MS = 90_000;

type JobOutcome =
  | { kind: "completed"; granted?: number; failed?: number; skipped?: number; errors?: string[] }
  | { kind: "failed"; reason?: string }
  /** Job ran but its record is gone from the queue, so counts are unknown. */
  | { kind: "gone" }
  | { kind: "timeout" };

/**
 * Follow a queued grant job to completion.
 *
 * A job that never leaves `waiting` means nothing is consuming the queue —
 * i.e. the worker is down. That has to surface as a problem, not as success.
 */
async function pollJob(
  jobId: string,
  onState: (label: string) => void,
): Promise<JobOutcome> {
  const deadline = Date.now() + JOB_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, JOB_POLL_INTERVAL_MS));

    let job;
    try {
      job = await FreeSpinAPI.getFreeSpinJobStatus(jobId);
    } catch (err) {
      // A 404 means the queue no longer holds this job — it ran and its record
      // was cleaned up. Retrying can never succeed, so stop instead of
      // hammering the endpoint until the timeout.
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        return { kind: "gone" };
      }
      continue; // transient — keep trying until the deadline
    }

    const progress = job.progress;
    if (progress?.total) {
      onState(`Granting ${progress.processed ?? 0} of ${progress.total}…`);
    } else {
      onState(job.state === "active" ? "Granting…" : "Queued…");
    }

    if (job.state === "completed") {
      const r = job.returnValue ?? {};
      return {
        kind: "completed",
        granted: r.granted ?? progress?.granted,
        failed: r.failed ?? progress?.failed,
        skipped: r.skipped ?? progress?.skipped,
        errors: r.errors,
      };
    }
    if (job.state === "failed") {
      return { kind: "failed", reason: job.failedReason ?? undefined };
    }
  }

  return { kind: "timeout" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assign Free Spin Modal  (2-step: select users → select config → assign)
// ─────────────────────────────────────────────────────────────────────────────
function AssignFreeSpinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // step: 1 = pick users, 2 = pick config
  const [step, setStep] = useState<1 | 2>(1);

  // ── user selection state ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── config selection state ────────────────────────────────────────────────
  // Source the templates list from the shared zustand store so other surfaces
  // (FreeSpinConfigSelect pickers, the templates page itself) see the same
  // cached list. The store holds ALL templates; we filter to active ones
  // for this modal's grant flow.
  const allConfigs = useFreeSpinConfigStore((s) => s.configs);
  const loadingConfigs = useFreeSpinConfigStore((s) => s.loading);
  const fetchConfigsFromStore = useFreeSpinConfigStore((s) => s.fetchConfigs);
  const configs = useMemo(() => allConfigs.filter((c) => c.isActive), [allConfigs]);
  const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(new Set());
  const [configSearch, setConfigSearch] = useState("");

  // Same search reach as the templates page: any game inside `selections`
  // counts, not just the one mirrored onto gameName.
  const filteredConfigs = useMemo(() => {
    const term = configSearch.trim().toLowerCase();
    if (!term) return configs;

    return configs.filter((cfg) => {
      const values = [
        cfg.name,
        cfg.softwareName,
        cfg.gameName,
        String(cfg.numberOfFreeSpins ?? ""),
        ...resolveSelections(cfg).flatMap((s) => [
          s.softwareName ?? "",
          ...s.games.map((g) => g.name ?? String(g.id)),
        ]),
      ];
      return values.some((v) => String(v ?? "").toLowerCase().includes(term));
    });
  }, [configs, configSearch]);

  // ── assigning state ───────────────────────────────────────────────────────
  const [assigning, setAssigning] = useState(false);
  const [results, setResults] = useState<{
    granted: number;
    failed: number;
    skipped?: number;
    /** Accepted by the queue but never processed (worker down). */
    queued?: number;
    error?: string;
  } | null>(null);
  /** Live line while the queued job is being followed. */
  const [jobState, setJobState] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const allSelected = totalItems > 0 && selectedIds.size >= totalItems;
  const allOnPage = users.length > 0 && users.every((u) => selectedIds.has(u.id));
  const someOnPage = users.some((u) => selectedIds.has(u.id)) && !allOnPage;

  // ── fetch users ───────────────────────────────────────────────────────────
  // Returns ALL users (active, verified, etc.) — admins doing manual bulk
  // assignment must be free to grant to anyone, not just users with an
  // active VIP/subscription tier wired to free spins. The `freeSpinEligible`
  // backend filter was over-restrictive for this surface; if a user later
  // gets ineligible for some other reason, AleaPlay's grant call still
  // succeeds (it does not gate on subscription status).
  const fetchUsers = useCallback(async (term: string, pg: number) => {
    setLoadingUsers(true);
    try {
      const res = await profileApi.getAllUsers({ search: term, page: pg, limit: PAGE_SIZE });
      const data: UserWithProfile[] = res.data.data ?? [];
      const total = res.data.meta?.totalItems ?? res.data.meta?.total ?? data.length;
      setUsers(data);
      setTotalItems(total);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // reset on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSearch("");
    setPage(1);
    setSelectedIds(new Set());
    setSelectedConfigIds(new Set());
    setConfigSearch("");
    setResults(null);
    fetchUsers("", 1);
    // Hydrate the templates store. If it's already populated from a previous
    // page mount (e.g. user came from VIP / Spin Configuration), this is a
    // no-op. Otherwise it loads once and shares the cache with every other
    // surface that uses useFreeSpinConfigStore.
    if (allConfigs.length === 0 && !loadingConfigs) {
      void fetchConfigsFromStore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(val.trim(), 1), 350);
  };

  const toggleUser = (u: UserWithProfile) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(u.id)) {
        next.delete(u.id);
      } else {
        next.add(u.id);
      }
      return next;
    });
  };

  const toggleAll = async () => {
    if (allSelected) { setSelectedIds(new Set()); return; }
    setSelectingAll(true);
    try {
      const res = await profileApi.getAllUsers({ search: search.trim(), page: 1, limit: Math.max(totalItems, 1000) });
      const all: UserWithProfile[] = res.data.data ?? [];
      setSelectedIds(new Set(all.map((u) => u.id)));
    } catch {
      setSelectedIds((prev) => { const next = new Set(prev); users.forEach((u) => next.add(u.id)); return next; });
    } finally {
      setSelectingAll(false);
    }
  };

  const toggleConfig = (id: string) => {
    setSelectedConfigIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /**
   * Queue the grant, then follow the job to completion.
   *
   * The grant runs in the worker, so queueing successfully says nothing about
   * whether any spins were actually granted. This used to report
   * "Granted: N, Failed: 0" the moment the job was accepted, which showed a
   * green tick even when the worker was down and nothing was ever processed.
   */
  const handleAssign = async () => {
    if (selectedConfigIds.size === 0 || selectedIds.size === 0) return;
    const expected = selectedIds.size * selectedConfigIds.size;

    setAssigning(true);
    setJobState(null);
    try {
      const job = await FreeSpinAPI.grantBulkFreeSpinsJob(
        Array.from(selectedIds),
        Array.from(selectedConfigIds),
      );

      if (!job?.id) {
        // No job id to follow — report queued rather than claiming success.
        toast.success("Assignment queued.");
        setResults({ granted: 0, failed: 0, queued: expected });
        return;
      }

      setJobState("Queued…");
      const outcome = await pollJob(job.id, setJobState);

      if (outcome.kind === "completed") {
        const granted = outcome.granted ?? 0;
        const failed = outcome.failed ?? 0;
        if (failed > 0) {
          toast.error(`${granted} granted, ${failed} failed.`);
        } else {
          toast.success(`${granted} free spin grant${granted === 1 ? "" : "s"} created.`);
        }
        setResults({
          granted,
          failed,
          skipped: outcome.skipped ?? 0,
          // The worker reports why each grant failed; show that rather than
          // sending the admin to the server logs.
          error: outcome.errors?.length ? outcome.errors.join("\n") : undefined,
        });
      } else if (outcome.kind === "failed") {
        toast.error(outcome.reason || "The grant job failed.");
        setResults({ granted: 0, failed: expected, error: outcome.reason });
      } else if (outcome.kind === "gone") {
        // The job finished but its record had already been cleared, so the
        // counts are unknown. Don't claim success — point at the table, which
        // is the source of truth.
        toast.success("Assignment finished.");
        setResults({
          granted: 0,
          failed: 0,
          error:
            "The job finished but its record was already cleared from the queue, so per-grant counts are unavailable. Check the allocation table below for the new grants.",
        });
      } else {
        // Still waiting after the timeout — almost always a stopped worker.
        toast.error("Job is still queued — the free-spin worker may not be running.");
        setResults({
          granted: 0,
          failed: 0,
          queued: expected,
          error:
            "The job was accepted but never processed. Check that the worker service is running, then re-check the allocation table.",
        });
      }
    } catch {
      toast.error(`Failed to submit bulk assignment job`);
      setResults({ granted: 0, failed: expected });
    } finally {
      setAssigning(false);
      setJobState(null);
    }
  };

  const uname = (u: UserWithProfile) => u.username ?? u.profile?.displayName ?? u.id;
  const selectedConfigsList = configs.filter((c) => selectedConfigIds.has(c.id));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-6">
      {/* Sized to the viewport rather than to its content: picking players out of
          a list of hundreds is the slow part of this flow, so the list gets as
          much room as the screen allows. */}
      <div className="bg-[#1C2127] border border-gray-700 rounded-xl w-full max-w-6xl h-[92vh] max-h-[92vh] flex flex-col shadow-2xl">

        {/* ── header ── */}
        <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <Zap size={18} className="text-purple-400" />
            <h2 className="text-white font-semibold text-base">Assign Free Spin</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── step indicator ── */}
        <div className="flex items-center gap-2 px-4 py-3 md:px-6 border-b border-gray-700 bg-[#191D24] shrink-0">
          {[
            { n: 1, label: "Select Players" },
            { n: 2, label: "Select Free Spin" },
          ].map(({ n, label }, i) => (
            <React.Fragment key={n}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step > n ? "bg-green-500 text-white" : step === n ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400"
                }`}>
                  {step > n ? <CheckCircle2 size={14} /> : n}
                </div>
                <span className={`text-sm ${step === n ? "text-white font-medium" : "text-gray-500"}`}>{label}</span>
              </div>
              {i === 0 && <ChevronRight size={14} className="text-gray-600 shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* ── results screen ── */}
        {results ? (
          /* Summary of what actually happened, not just a tick: which
             templates went out, to how many players, and the job's own counts. */
          <>
            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 md:px-6 md:py-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  {results.granted > 0 && !results.failed && !results.queued ? (
                    <CheckCircle2 size={44} className="text-green-400" />
                  ) : (
                    <AlertTriangle size={44} className="text-amber-400" />
                  )}
                  <div>
                    <p className="text-white text-lg font-semibold">
                      {results.queued
                        ? "Not granted yet"
                        : results.failed > 0
                          ? "Finished with errors"
                          : "Assignment Complete"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {selectedConfigsList.length} template
                      {selectedConfigsList.length === 1 ? "" : "s"} ·{" "}
                      {selectedIds.size} player{selectedIds.size === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Granted", value: results.granted, tone: "text-green-400" },
                    { label: "Skipped", value: results.skipped ?? 0, tone: "text-gray-300" },
                    { label: "Failed", value: results.failed, tone: "text-red-400" },
                    { label: "Still queued", value: results.queued ?? 0, tone: "text-amber-400" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg border border-gray-700 bg-[#242B35] px-4 py-3 text-center"
                    >
                      <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {results.error && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <p className="mb-1 text-xs font-medium text-amber-200">Why it failed</p>
                    {/* Reasons come back one per line from the worker. */}
                    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-amber-300">
                      {results.error}
                    </pre>
                  </div>
                )}

                {selectedConfigsList.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                      Templates assigned
                    </p>
                    <div className="divide-y divide-gray-700 overflow-hidden rounded-lg border border-gray-700">
                      {selectedConfigsList.map((cfg) => (
                        <div
                          key={cfg.id}
                          className="flex items-center justify-between gap-4 bg-[#242B35] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{cfg.name}</p>
                            <p className="truncate text-xs text-gray-400">
                              {summarizeProviders(cfg)} · {summarizeGames(cfg)}
                              {cfg.grantExpiresInDays
                                ? ` · ${cfg.grantExpiresInDays}d expiry`
                                : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {/* The template's own number is per game; the player
                                gets the sum across its games. */}
                            <p className="text-sm font-semibold text-purple-300">
                              {summarizeTemplateSpins(cfg).totalSpins} spins
                            </p>
                            <p className="text-xs text-gray-500">
                              {cfg.numberOfFreeSpins}/game ·{" "}
                              {cfg.winningsTarget === "bonus_sc" ? "Wulf Coin" : "Wulf Cash"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Every game of a template is granted separately, so a player receives
                      the spins shown above in total — spread across that template&apos;s games.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 bg-[#191D24] px-4 py-4 md:px-6 rounded-b-xl shrink-0">
              {/* The job counts template×player allocations, not AleaPlay
                  bonuses — a 2-game template is one allocation but two bonuses,
                  so calling these "grants" would contradict the table. */}
              <span className="text-sm text-gray-400">
                {results.granted} of {selectedConfigsList.length * selectedIds.size} assignment
                {selectedConfigsList.length * selectedIds.size === 1 ? "" : "s"} completed
              </span>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium"
              >
                Done
              </button>
            </div>
          </>
        ) : step === 1 ? (
          <>
            {/* ── step 1: user list ── */}
            <div className="px-4 py-3 md:px-6 border-b border-gray-700 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  className="w-full h-9 bg-[#242B35] rounded-lg pl-8 pr-3 text-white text-sm border border-gray-700 focus:outline-none focus:border-purple-500"
                  placeholder="Search by username or email..."
                  value={search}
                  onChange={handleSearch}
                  autoFocus
                />
              </div>
            </div>

            {/* select-all */}
            <div className="flex items-center justify-between px-4 py-2.5 md:px-6 border-b border-gray-700 bg-[#191D24] shrink-0">
              <label className="flex items-center gap-3 cursor-pointer">
                {selectingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                ) : (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someOnPage; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                  />
                )}
                <span className="text-sm text-gray-300 select-none">
                  {selectingAll ? "Selecting all..." : `Select All (${totalItems.toLocaleString()})`}
                </span>
              </label>
              {selectedIds.size > 0 && (
                <span className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-full font-medium">
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 md:px-6 min-h-0">
              {loadingUsers ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-10">No players found</p>
              ) : (
                // Columns scale with the viewport — a wide screen shows ~24
                // players at once instead of 5, which is the difference between
                // scrolling and scanning.
                <div className="grid grid-cols-1 gap-1 py-1 md:grid-cols-2 xl:grid-cols-3">
                  {users.map((u) => (
                    <label key={u.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      selectedIds.has(u.id) ? "bg-purple-600/15 border border-purple-600/30" : "hover:bg-[#242B35] border border-transparent"
                    }`}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleUser(u)}
                        className="w-4 h-4 rounded accent-purple-600 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{uname(u)}</p>
                        <p className="text-gray-500 text-xs truncate">
                          {u.profile?.email || u.entity || u.email || "—"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-2 md:px-6 border-t border-gray-700 shrink-0">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={(pg) => { setPage(pg); fetchUsers(search.trim(), pg); }} />
              </div>
            )}

            {/* footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6 border-t border-gray-700 bg-[#191D24] rounded-b-xl shrink-0">
              <span className="text-sm text-gray-400">
                {selectedIds.size > 0 ? `${selectedIds.size} player${selectedIds.size > 1 ? "s" : ""} selected` : "No players selected"}
              </span>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg">
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-40"
                >
                  Next: Select Free Spin <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── step 2: config picker ── */}
            <div className="flex items-center gap-3 px-4 py-3 md:px-6 border-b border-gray-700 shrink-0">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  className="w-full h-9 bg-[#242B35] rounded-lg pl-8 pr-3 text-white text-sm border border-gray-700 focus:outline-none focus:border-purple-500"
                  placeholder="Search templates by name, provider or game..."
                  value={configSearch}
                  onChange={(e) => setConfigSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {selectedConfigIds.size > 0 && (
                <span className="shrink-0 rounded-full bg-purple-600 px-2.5 py-1 text-xs font-medium text-white">
                  {selectedConfigIds.size} selected
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 min-h-0">
              {loadingConfigs ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                </div>
              ) : filteredConfigs.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-10">
                  {configSearch
                    ? `No template matches "${configSearch}"`
                    : "No active free spin configs found"}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {filteredConfigs.map((cfg) => (
                    <label key={cfg.id} className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer border transition-colors ${
                      selectedConfigIds.has(cfg.id)
                        ? "bg-purple-600/15 border-purple-600/50"
                        : "bg-[#242B35] border-gray-700 hover:border-gray-500"
                    }`}>
                      <input
                        type="checkbox"
                        checked={selectedConfigIds.has(cfg.id)}
                        onChange={() => toggleConfig(cfg.id)}
                        className="mt-0.5 w-4 h-4 rounded accent-purple-600 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{cfg.name}</p>
                        <p className="mt-1 text-xs text-purple-300">
                          {summarizeTemplateSpins(cfg).totalSpins} spins total
                          <span className="text-gray-500"> ({cfg.numberOfFreeSpins}/game)</span>
                        </p>
                        {/* summarize* so a multi-game template reads "5 games"
                            instead of only its first game. */}
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          {summarizeProviders(cfg)} · {summarizeGames(cfg)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="text-gray-500 text-xs">Level {cfg.betLevel}</span>
                          {cfg.grantExpiresInDays ? (
                            <span className="text-gray-500 text-xs">{cfg.grantExpiresInDays}d expiry</span>
                          ) : null}
                          <span className={`text-xs font-medium ${cfg.winningsTarget === "bonus_sc" ? "text-yellow-400" : "text-green-400"}`}>
                            {cfg.winningsTarget === "bonus_sc" ? "Wulf Coin" : "Wulf Cash"}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* selected config summary */}
            {selectedConfigsList.length > 0 && (
              <div className="mx-4 mb-2 md:mx-6 px-4 py-2.5 bg-purple-600/10 border border-purple-600/30 rounded-lg shrink-0">
                <p className="text-xs text-gray-400">
                  Assigning{" "}
                  <span className="text-white font-medium">
                    {selectedConfigsList.length} config{selectedConfigsList.length > 1 ? "s" : ""}
                  </span>
                  {" "}×{" "}
                  <span className="text-purple-300 font-medium">
                    {selectedIds.size} player{selectedIds.size > 1 ? "s" : ""}
                  </span>
                  {" "}={" "}
                  <span className="text-white font-medium">
                    {selectedConfigsList.length * selectedIds.size} total grants
                  </span>
                </p>
              </div>
            )}

            {/* footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6 border-t border-gray-700 bg-[#191D24] rounded-b-xl shrink-0">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg"
              >
                ← Back
              </button>
              <button
                onClick={handleAssign}
                disabled={selectedConfigIds.size === 0 || assigning}
                className="flex items-center gap-2 px-6 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-40"
              >
                {assigning ? (
                  <><Loader2 size={14} className="animate-spin" /> {jobState ?? "Assigning..."}</>
                ) : (
                  <><Zap size={14} /> Assign {selectedConfigIds.size > 0 ? `${selectedConfigIds.size * selectedIds.size} Grant${selectedConfigIds.size * selectedIds.size !== 1 ? "s" : ""}` : ""}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grants Table
// ─────────────────────────────────────────────────────────────────────────────
import { FreeSpin, FreeSpinGrant } from "@/types/free-spin";
import { Wrench } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const GRANTS_PAGE_SIZE = 10;

function fmt(val?: string) {
  if (!val) return "-";
  const d = new Date(val);
  return isNaN(d.getTime())
    ? "-"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(d);
}

/**
 * Date and time as separate parts.
 *
 * Rendered on one line, "21/08/2026, 16:59:42" is wide enough that the Granted
 * and Expires columns ran into each other. Stacking the time under the date
 * halves the width without dropping the seconds, which support needs when
 * matching a grant against an AleaPlay log.
 */
function fmtParts(val?: string): { date: string; time: string } | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d),
  };
}

/** Stacked date-over-time cell body. */
function DateTimeCell({ value }: { value?: string }) {
  const parts = fmtParts(value);
  if (!parts) return <span className="text-gray-500">-</span>;

  return (
    <div className="leading-tight">
      <p className="text-gray-300 whitespace-nowrap">{parts.date}</p>
      <p className="text-[10px] text-gray-500 whitespace-nowrap">{parts.time}</p>
    </div>
  );
}

interface GrantsTableProps {
  refresh: number;
  search: string;
  filters: GrantFilters;
  configs: FreeSpin[];
  onClearFilter: (key: keyof GrantFilters) => void;
  onResetFilters: () => void;
}

function GrantsTable({
  refresh,
  search,
  filters,
  configs,
  onClearFilter,
  onResetFilters,
}: GrantsTableProps) {
  const [grants, setGrants] = useState<FreeSpinGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<GrantAllocation | null>(null);

  // Filtering, searching and paging all happen server-side now: only one page
  // is in memory, so filtering here would search a fraction of the data.
  const allocations = useMemo(() => groupGrantsByAllocation(grants), [grants]);

  const totalPages = Math.max(1, Math.ceil(total / GRANTS_PAGE_SIZE));
  const paged = allocations;
  const activeChips = useMemo(
    () => describeActiveFilters(filters, configs),
    [filters, configs],
  );

  // Any change to the query resets to page 1 — otherwise a narrower result set
  // can leave the viewer on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await FreeSpinAPI.getPlayerFreeSpinGrants({
        search: search.trim() || undefined,
        status: filters.status === "all" ? undefined : filters.status,
        source: filters.source === "all" ? undefined : SOURCE_LABEL_PREFIXES[filters.source]?.join(","),
        configId: filters.configId || undefined,
        grantedFrom: grantedRangeStart(filters),
        grantedTo: filters.quickRange === "custom" && filters.to ? `${filters.to}T23:59:59` : undefined,
        minSpins: filters.minSpins ? Number(filters.minSpins) : undefined,
        maxSpins: filters.maxSpins ? Number(filters.maxSpins) : undefined,
        expiringInDays: filters.expiringWithinDays ? Number(filters.expiringWithinDays) : undefined,
        page,
        limit: GRANTS_PAGE_SIZE,
      });
      setGrants(res.data);
      setTotal(res.total);
    } catch {
      setGrants([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, filters, page]);

  useEffect(() => { load(); }, [load, refresh]);

  /**
   * Cancel every bonus of one assignment.
   *
   * The backend takes either a casinoBonusId or a pool id; sending the pool id
   * cancels all of the assignment's games in one call, which is what the admin
   * means by "cancel this".
   */
  const handleCancelAllocation = async (allocation: GrantAllocation) => {
    setCancelling(allocation.key);
    try {
      const target = allocation.key.startsWith("grant:")
        ? (allocation.grants[0]?.sourceTransactionId ?? "")
        : allocation.key;
      const res = await FreeSpinAPI.cancelFreeSpins(target);
      // The API reports partial outcomes ("Cancelled 2 of 3 …"), so echo its
      // message rather than asserting success.
      toast.success(res.message);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to cancel"));
    } finally {
      setCancelling(null);
    }
  };

  /**
   * Re-send an allocation that never reached AleaPlay.
   *
   * Runs the ORIGINAL allocation again rather than assigning the template
   * afresh — each game keeps its idempotency key, so a player who partly
   * succeeded cannot end up with two lots of spins.
   */
  const handleRetryAllocation = async (a: GrantAllocation) => {
    const poolId = a.grants[0]?.poolId ?? a.key.replace(/^grant:/, "");
    if (!poolId) {
      toast.error("This allocation has no id to retry");
      return;
    }

    setRetrying(a.key);
    try {
      const res = await FreeSpinAPI.retryFreeSpinAllocation(poolId);
      toast.success(res.message);
      await load();
    } catch (err) {
      // AleaPlay's own reason — "game rollout DISABLED", "not allowed for
      // currency", and so on. Guessing helps nobody here.
      toast.error(getApiErrorMessage(err, "Retry failed"));
    } finally {
      setRetrying(null);
    }
  };

  const statusColor = (s: string) => {
    const n = s.toLowerCase();
    if (n === "granted" || n === "active") return "bg-green-500/20 text-green-400";
    if (n === "cancelled") return "bg-red-500/20 text-red-400";
    // Distinct from cancelled: nothing was ever granted, and it can be retried.
    if (n === "failed") return "bg-orange-500/20 text-orange-300";
    if (n === "partial") return "bg-amber-500/20 text-amber-300";
    if (n === "completed" || n === "used") return "bg-blue-500/20 text-blue-400";
    return "bg-gray-500/20 text-gray-400";
  };

  return (
    <div className="bg-[#191D24] rounded-lg overflow-hidden">
      {/* Active filters only — the strip disappears entirely when nothing is
          narrowing the table, so an unfiltered view is just the table. */}
      {activeChips.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-800">
        {activeChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onClearFilter(chip.key)}
            className="flex items-center gap-1 rounded-full bg-purple-600/20 px-2.5 py-1 text-[11px] text-purple-200 hover:bg-purple-600/30"
            title="Remove this filter"
          >
            {chip.label}
            <X size={11} />
          </button>
        ))}

        {activeChips.length > 1 && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-white"
          >
            Clear all
          </button>
        )}
      </div>
      )}

      {/* `w-full table-fixed` alone can never overflow its container, so opening
          the sidebar crushed all eleven columns instead of scrolling. The
          min-width gives the table a floor to scroll against. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] table-fixed">
          <thead className="bg-[#242B35]">
            <tr>
              {["Player", "Source", "Config", "Spins used", "Software", "Game", "Granted", "Expires", "Status", "Action"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs text-gray-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={10} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-purple-400 mx-auto" /></td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center text-gray-500 text-sm">No grants found</td></tr>
            ) : paged.map((a) => {
              const source = parseGrantSource(a.bonusLabel);
              const cancellable = a.grants.filter((g) =>
                ["granted", "active"].includes((g.status ?? "").toLowerCase()),
              );
              // A single-game assignment still has one transaction id worth
              // showing inline; multi-game ones live in the detail view.
              // AleaPlay's bonus id is NOT a column: it is a long opaque
              // string that cost a column of width on every row while only
              // mattering when someone is actually chasing a grant. It lives in
              // the detail view (View detail), alongside our own FS-… key, and
              // stays searchable from the box above.

              return (
                <tr key={a.key} className="bg-[#191D24] hover:bg-[#1a2030] transition-colors">
                  {/* Email or phone, not the generated username — it is what
                      support and AleaPlay identify a player by. Username stays
                      as the second line so the two can be tied together. */}
                  <td className="px-4 py-3 text-xs max-w-[190px]">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 truncate text-gray-200" title={a.contact ?? a.username ?? a.userId}>
                        {a.contact || a.username || a.userId || "-"}
                      </p>
                      <CopyButton
                        value={a.contact || a.username || a.userId}
                        size={12}
                      />
                    </div>
                    {a.contact && a.username && (
                      <p className="text-[10px] text-gray-500 truncate">{a.username}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block whitespace-nowrap px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide ${source.badgeClass}`}
                      title={a.bonusLabel ?? "Manual grant"}
                    >
                      {source.label}
                      {source.detail ? ` · ${source.detail}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white text-xs font-medium max-w-[180px]">
                    <p className="truncate">{a.configName}</p>
                    {/* AleaPlay's own reason, on the row rather than buried in a
                        modal: when an assignment fails for many players it is
                        almost always the same cause, and seeing it here is what
                        tells an admin to fix the template rather than retry. */}
                    {a.failureReason && (
                      <p
                        className="truncate text-[10px] font-normal text-orange-300"
                        title={a.failureReason}
                      >
                        {a.failureReason}
                      </p>
                    )}
                  </td>
                  {/* Used vs granted. AleaPlay only tells us about a round when
                      it PAYS OUT, so a losing round is invisible: "1/3" can mean
                      all three were played and two lost. The tooltip says so,
                      because the bare number reads like a bug otherwise. */}
                  <td
                    className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap"
                    title="Counts rounds AleaPlay reported a payout for. Losing rounds are not reported, so the real number played can be higher."
                  >
                    {a.totalSpins ? (
                      <span
                        className={
                          a.totalSpinsUsed >= a.totalSpins
                            ? "text-gray-500"
                            : a.totalSpinsUsed > 0
                              ? "text-amber-300"
                              : "text-gray-400"
                        }
                      >
                        {a.totalSpinsUsed}/{a.totalSpins}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">
                    {a.softwareName ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">
                    {a.gameCount > 1 ? (
                      <button
                        type="button"
                        onClick={() => setDetail(a)}
                        className="text-purple-300 underline underline-offset-2 hover:text-purple-200"
                        title="See every game in this assignment"
                      >
                        {describeAllocationGames(a)}
                      </button>
                    ) : (
                      describeAllocationGames(a)
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <DateTimeCell value={a.grantedAt} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <DateTimeCell value={a.expiresAt} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block whitespace-nowrap px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide ${statusColor(a.status)}`}>
                      {a.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-orange-400 hover:text-orange-300">
                          <Wrench size={15} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a2030] text-white border border-gray-700 p-1">
                        <DropdownMenuItem
                          className="text-xs text-gray-200 cursor-pointer hover:bg-[#242B35] rounded px-3 py-1.5"
                          onClick={() => setDetail(a)}
                        >
                          View detail
                        </DropdownMenuItem>
                        {a.retryable && (
                          <DropdownMenuItem
                            className="text-xs text-orange-300 cursor-pointer hover:bg-[#242B35] rounded px-3 py-1.5"
                            disabled={retrying === a.key}
                            onClick={() => handleRetryAllocation(a)}
                          >
                            {retrying === a.key
                              ? "Re-sending..."
                              : a.failed
                                ? "Retry grant"
                                : "Send missing games"}
                          </DropdownMenuItem>
                        )}
                        {cancellable.length > 0 ? (
                          <DropdownMenuItem
                            className="text-xs text-red-400 cursor-pointer hover:bg-[#242B35] rounded px-3 py-1.5"
                            disabled={cancelling === a.key}
                            onClick={() => handleCancelAllocation(a)}
                          >
                            {cancelling === a.key
                              ? "Cancelling..."
                              : a.gameCount > 1
                                ? `Cancel all ${cancellable.length}`
                                : "Cancel"}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AllocationDetailModal
        allocation={detail}
        onClose={() => setDetail(null)}
        onChanged={load}
      />

      {totalPages > 1 && (
        <div className="px-3 py-3 md:px-6 border-t border-gray-800">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function NewbieLuckySpinPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  // Search + filters live here, not in the table, so the whole toolbar sits in
  // one row with the primary action instead of being split across two cards.
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<GrantFilters>(DEFAULT_GRANT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryAllOpen, setRetryAllOpen] = useState(false);

  /**
   * Re-send every allocation still owed games.
   *
   * Confirmed first: it talks to AleaPlay once per outstanding allocation, so
   * it is not something to trigger by a stray click.
   */
  const handleRetryAll = async () => {
    setRetryingAll(true);
    try {
      const res = await FreeSpinAPI.retryAllFreeSpinAllocations({});
      if (res.failed > 0) {
        // Partial success is not success: the remaining failures usually share
        // one cause, and that is what the admin has to act on.
        toast.error(`${res.message} ${res.failed} still failing.`);
        res.errors.forEach((e) => console.warn("[free-spin retry]", e));
      } else {
        toast.success(res.message);
      }
      setRefresh((r) => r + 1);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Bulk retry failed"));
    } finally {
      setRetryingAll(false);
      setRetryAllOpen(false);
    }
  };

  const configs = useFreeSpinConfigStore((s) => s.configs);
  const fetchConfigs = useFreeSpinConfigStore((s) => s.fetchConfigs);
  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  const activeCount = countActiveFilters(filters);

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-3 space-y-4 md:p-6 md:space-y-6">
      <div className="bg-[#191D24] px-3 py-2 rounded-lg flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-4">
        <h1 className="text-white text-sm font-normal">VIP / Spin Allocation</h1>
        {/* Free Spin Configuration is reached from here rather than the sidebar
            — the templates and the grants that hand them out are one flow, and
            the activity log already hangs off this page the same way. */}
        <Link href="/lucky-draw/vip-lucky-spin" className="shrink-0">
          <Button
            variant="outline"
            className="h-9 w-full border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white md:w-auto"
          >
            Free Spin Configuration
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="bg-[#191D24] rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          {/* Filtering is live as you type, so the submit button would be dead weight. */}
          <ListSearch
            value={search}
            onChange={setSearch}
            showButton={false}
            placeholder="Search by email, phone, config, game, software, bonus ID..."
          />
        </div>

        {/* One sideways-scrolling strip on a phone — five buttons wrapped into
            three rows there. `md:contents` dissolves the wrapper so the desktop
            row lays out exactly as before. */}
        <div className="flex w-full items-center gap-3 overflow-x-auto scrollbar-hide md:contents">
        <button
          onClick={() => setFiltersOpen(true)}
          className="relative flex shrink-0 items-center gap-2 whitespace-nowrap h-9 px-4 bg-[#242B35] hover:bg-[#2b3340] border border-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <Filter size={16} className="text-[#B93DEB]" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-purple-600 px-1.5 text-[10px] font-bold leading-4">
              {activeCount}
            </span>
          )}
        </button>

        {/* The activity log has no sidebar entry — it lives one click from the
            allocation table, which is where an admin is when they need it. */}
        {/* Bulk retry — a bad template fails for EVERY player it was assigned
            to, so failures arrive in hundreds. Retrying them one at a time is
            not a workflow. Confirmed first because it talks to AleaPlay for
            every outstanding allocation. */}
        {/* Straight to the failures. An admin who hears "players did not get
            their spins" needs the list of who and why, not a filter dialog. */}
        <button
          onClick={() => router.push("/lucky-draw/free-spin-failures")}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap h-9 px-4 bg-[#242B35] hover:bg-[#2b3340] border border-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <AlertTriangle size={14} className="text-orange-300" />
          Failures
        </button>

        <button
          onClick={() => setRetryAllOpen(true)}
          disabled={retryingAll}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap h-9 px-4 bg-[#242B35] hover:bg-[#2b3340] border border-orange-500/40 text-orange-300 text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
          title="Re-send every allocation that is still owed games"
        >
          <RefreshCw size={14} className={retryingAll ? "animate-spin" : ""} />
          {retryingAll ? "Re-sending..." : "Retry failed"}
        </button>

        <button
          onClick={() => router.push("/lucky-draw/vip-lucky-spin-log")}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap h-9 px-4 bg-[#242B35] hover:bg-[#2b3340] border border-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <ScrollText size={14} />
          Activity Log
        </button>

        <button
          onClick={() => setModalOpen(true)}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap h-9 px-5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <Zap size={14} />
          Assign Free Spin
        </button>
        </div>
      </div>

      <GrantsTable
        refresh={refresh}
        search={search}
        filters={filters}
        configs={configs}
        onClearFilter={(key) =>
          setFilters((f) => ({ ...f, [key]: DEFAULT_GRANT_FILTERS[key] }))
        }
        onResetFilters={() => setFilters(DEFAULT_GRANT_FILTERS)}
      />

      <GrantFiltersPanel
        open={filtersOpen}
        value={filters}
        configs={configs}
        onApply={setFilters}
        onClose={() => setFiltersOpen(false)}
      />

      <AssignFreeSpinModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setRefresh((r) => r + 1); }}
      />

      <ConfirmModal
        open={retryAllOpen}
        busy={retryingAll}
        title="Re-send failed allocations"
        confirmLabel="Re-send all"
        message={
          <>
            <p>
              Every free-spin allocation still owed games will be sent to AleaPlay
              again.
            </p>
            <p className="mt-2 text-gray-400">
              Games already granted are left untouched, so nobody is
              double-granted. Expired allocations are skipped.
            </p>
            <p className="mt-2 text-amber-300">
              Fix the template first if the failures share a cause — otherwise
              they will fail again.
            </p>
          </>
        }
        onConfirm={handleRetryAll}
        onCancel={() => setRetryAllOpen(false)}
      />
    </div>
  );
}
