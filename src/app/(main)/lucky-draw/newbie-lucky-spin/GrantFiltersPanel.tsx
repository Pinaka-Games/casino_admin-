"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { GRANT_SOURCE_OPTIONS, GrantSourceKind, parseGrantSource } from "@/lib/free-spin-source";
import type { FreeSpin, FreeSpinGrant } from "@/types/free-spin";

export type GrantQuickRange = "all" | "today" | "7d" | "30d" | "custom";
export type GrantStatusFilter =
  | "all"
  | "granted"
  | "completed"
  | "cancelled"
  | "expired"
  /** Allocations that never reached AleaPlay — the ones an admin can retry. */
  | "failed";

export interface GrantFilters {
  source: GrantSourceKind | "all";
  status: GrantStatusFilter;
  /** FreeSpinConfig id, "" = any template. */
  configId: string;
  quickRange: GrantQuickRange;
  /** yyyy-mm-dd, only used when quickRange is "custom". */
  from: string;
  to: string;
  minSpins: string;
  maxSpins: string;
  /** Grants expiring within N days — the ops view for "who is about to lose spins". */
  expiringWithinDays: string;
}

/**
 * Status defaults to `granted` because the allocation table is an ops screen:
 * what matters day to day is who currently holds unplayed spins. Every other
 * status is one dropdown away rather than being hidden entirely, which is what
 * the table used to do.
 */
export const DEFAULT_GRANT_FILTERS: GrantFilters = {
  source: "all",
  status: "granted",
  configId: "",
  quickRange: "all",
  from: "",
  to: "",
  minSpins: "",
  maxSpins: "",
  expiringWithinDays: "",
};

/**
 * Screens can start from different defaults — the allocation table opens on
 * "granted", the activity log on "all" — so "is this filter active?" is always
 * measured against the caller's own baseline.
 */
export function countActiveFilters(
  f: GrantFilters,
  defaults: GrantFilters = DEFAULT_GRANT_FILTERS,
): number {
  let n = 0;
  if (f.source !== "all") n++;
  if (f.status !== defaults.status) n++;
  if (f.configId) n++;
  if (f.quickRange !== "all") n++;
  if (f.minSpins) n++;
  if (f.maxSpins) n++;
  if (f.expiringWithinDays) n++;
  return n;
}

/** Short labels for the chips shown above the table. */
export function describeActiveFilters(
  f: GrantFilters,
  configs: FreeSpin[],
  defaults: GrantFilters = DEFAULT_GRANT_FILTERS,
): { key: keyof GrantFilters; label: string }[] {
  const chips: { key: keyof GrantFilters; label: string }[] = [];

  if (f.source !== "all") {
    const label = GRANT_SOURCE_OPTIONS.find((o) => o.kind === f.source)?.label ?? f.source;
    chips.push({ key: "source", label: `Source: ${label}` });
  }
  if (f.status !== defaults.status) {
    chips.push({ key: "status", label: `Status: ${f.status}` });
  }
  if (f.configId) {
    const name = configs.find((c) => c.id === f.configId)?.name ?? "template";
    chips.push({ key: "configId", label: `Template: ${name}` });
  }
  if (f.quickRange !== "all") {
    const label =
      f.quickRange === "custom"
        ? `${f.from || "…"} → ${f.to || "…"}`
        : QUICK_RANGES.find((q) => q.value === f.quickRange)?.label ?? f.quickRange;
    chips.push({ key: "quickRange", label: `Granted: ${label}` });
  }
  if (f.minSpins) chips.push({ key: "minSpins", label: `Spins ≥ ${f.minSpins}` });
  if (f.maxSpins) chips.push({ key: "maxSpins", label: `Spins ≤ ${f.maxSpins}` });
  if (f.expiringWithinDays) {
    chips.push({ key: "expiringWithinDays", label: `Expires ≤ ${f.expiringWithinDays}d` });
  }

  return chips;
}

const QUICK_RANGES: { value: GrantQuickRange; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];

/** Start of the window a quick range covers, or null for "all time". */
function quickRangeStart(range: GrantQuickRange): Date | null {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "7d") return new Date(now.getTime() - 7 * 86_400_000);
  if (range === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  return null;
}

/**
 * ISO start of the filter's granted-date window, for the server query.
 * Returns undefined for "All time".
 */
export function grantedRangeStart(f: GrantFilters): string | undefined {
  if (f.quickRange === "custom") {
    return f.from ? `${f.from}T00:00:00` : undefined;
  }
  return quickRangeStart(f.quickRange)?.toISOString();
}

/** True when a grant passes every active filter. */
export function matchesGrantFilters(grant: FreeSpinGrant, f: GrantFilters): boolean {
  if (f.source !== "all" && parseGrantSource(grant.bonusLabel).kind !== f.source) return false;

  const status = (grant.status ?? "").toLowerCase();
  if (f.status === "failed") {
    // Failed allocations carry the pool's status (PENDING), so the flag is the
    // only reliable marker.
    if (grant.failed !== true) return false;
  } else if (f.status !== "all") {
    // "granted" also covers the legacy "active" spelling used by older rows.
    const wanted = f.status === "granted" ? ["granted", "active"] : [f.status];
    if (!wanted.includes(status)) return false;
  }

  if (f.configId && grant.freeSpinConfigId !== f.configId) return false;

  const granted = grant.grantedAt ? new Date(grant.grantedAt) : null;
  if (f.quickRange === "custom") {
    if (f.from && granted && granted < new Date(`${f.from}T00:00:00`)) return false;
    if (f.to && granted && granted > new Date(`${f.to}T23:59:59`)) return false;
  } else {
    const start = quickRangeStart(f.quickRange);
    if (start && granted && granted < start) return false;
  }

  const spins = Number(grant.config?.numberOfFreeSpins ?? grant.spinsGranted ?? 0);
  if (f.minSpins && spins < Number(f.minSpins)) return false;
  if (f.maxSpins && spins > Number(f.maxSpins)) return false;

  if (f.expiringWithinDays) {
    if (!grant.expiresAt) return false;
    const limit = Date.now() + Number(f.expiringWithinDays) * 86_400_000;
    const expires = new Date(grant.expiresAt).getTime();
    if (isNaN(expires) || expires > limit) return false;
  }

  return true;
}

export const ALLOCATION_STATUS_OPTIONS: { value: GrantStatusFilter; label: string }[] = [
  { value: "granted", label: "Granted (unplayed)" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
  { value: "failed", label: "Failed (not granted)" },
  { value: "all", label: "All statuses" },
];

interface Props {
  open: boolean;
  value: GrantFilters;
  configs: FreeSpin[];
  onApply: (next: GrantFilters) => void;
  onClose: () => void;
  /** Statuses this screen can show — the log only deals in finished grants. */
  statusOptions?: { value: GrantStatusFilter; label: string }[];
  /** What "Reset Filters" returns to, when a screen starts from its own baseline. */
  defaults?: GrantFilters;
}

const FIELD =
  "w-full h-10 bg-[#242B35] border border-gray-700 rounded-lg px-3 text-white text-sm focus:border-purple-500 focus:outline-none";
const LABEL = "text-xs text-gray-400";

/**
 * Right-hand filter drawer for the free-spin allocation table.
 *
 * Edits a draft copy so nothing changes behind the admin while they are still
 * choosing — the table only updates on Apply.
 */
export default function GrantFiltersPanel({
  open,
  value,
  configs,
  onApply,
  onClose,
  statusOptions = ALLOCATION_STATUS_OPTIONS,
  defaults = DEFAULT_GRANT_FILTERS,
}: Props) {
  const [draft, setDraft] = useState<GrantFilters>(value);

  // Re-sync whenever the panel is reopened, so a cancelled edit is discarded.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof GrantFilters>(key: K, val: GrantFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-gray-700 bg-[#1C2127] shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-700 px-4 py-4 md:px-6">
          <div>
            <h2 className="text-base font-semibold text-white">Grant Filters</h2>
            <p className="mt-1 text-xs text-gray-400">
              Narrow the allocation table by source, status, template and date.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close filters">
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-6">
          <div className="space-y-1">
            <label className={LABEL}>Quick Range</label>
            <select
              className={FIELD}
              value={draft.quickRange}
              onChange={(e) => set("quickRange", e.target.value as GrantQuickRange)}
            >
              {QUICK_RANGES.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>

          {draft.quickRange === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={LABEL}>Granted From</label>
                <input
                  type="date"
                  className={FIELD}
                  value={draft.from}
                  onChange={(e) => set("from", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL}>Granted To</label>
                <input
                  type="date"
                  className={FIELD}
                  value={draft.to}
                  onChange={(e) => set("to", e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className={LABEL}>Source</label>
            <select
              className={FIELD}
              value={draft.source}
              onChange={(e) => set("source", e.target.value as GrantSourceKind | "all")}
            >
              <option value="all">All sources</option>
              {GRANT_SOURCE_OPTIONS.map(({ kind, label }) => (
                <option key={kind} value={kind}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className={LABEL}>Status</label>
            <select
              className={FIELD}
              value={draft.status}
              onChange={(e) => set("status", e.target.value as GrantStatusFilter)}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className={LABEL}>Template</label>
            <select
              className={FIELD}
              value={draft.configId}
              onChange={(e) => set("configId", e.target.value)}
            >
              <option value="">All templates</option>
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.numberOfFreeSpins} spins
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={LABEL}>Min Spins</label>
              <input
                type="number"
                min={0}
                className={FIELD}
                placeholder="Min"
                value={draft.minSpins}
                onChange={(e) => set("minSpins", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className={LABEL}>Max Spins</label>
              <input
                type="number"
                min={0}
                className={FIELD}
                placeholder="Max"
                value={draft.maxSpins}
                onChange={(e) => set("maxSpins", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className={LABEL}>Expiring Within</label>
            <select
              className={FIELD}
              value={draft.expiringWithinDays}
              onChange={(e) => set("expiringWithinDays", e.target.value)}
            >
              <option value="">Any expiry</option>
              <option value="1">Next 24 hours</option>
              <option value="3">Next 3 days</option>
              <option value="7">Next 7 days</option>
            </select>
            <p className="text-[11px] text-gray-500">
              Spins the player still has to use before they run out.
            </p>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-700 px-4 py-4 md:px-6">
          <button
            type="button"
            onClick={() => setDraft(defaults)}
            className="h-10 rounded-lg border border-gray-600 px-5 text-sm text-gray-200 hover:bg-[#242B35]"
          >
            Reset Filters
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="h-10 rounded-lg bg-purple-600 px-6 text-sm font-medium text-white hover:bg-purple-700"
          >
            Apply Filters
          </button>
        </div>
      </aside>
    </div>
  );
}
