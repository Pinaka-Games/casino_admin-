"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, X } from "lucide-react";
import toast from "react-hot-toast";

import { FreeSpinAPI } from "@/api";
import { getApiErrorMessage } from "@/api/messaging/error-message";
import ConfirmModal from "@/components/free-spin/ConfirmModal";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import { groupGrantsByAllocation, type GrantAllocation } from "@/lib/free-spin-grants";
import { parseGrantSource } from "@/lib/free-spin-source";

const PAGE_SIZE = 10;

const fmt = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

/**
 * AleaPlay returns a wall of JSON, repeated once per failed game. Rendered raw
 * it filled the screen and told an admin nothing — the error CODE is the part
 * that identifies what to change.
 */
const shortCause = (reason?: string): string => {
  if (!reason) return "No reason recorded";

  const codes = [...reason.matchAll(/"code"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (codes.length) {
    const unique = [...new Set(codes)];
    return unique.length === 1 ? unique[0] : `${unique[0]} +${unique.length - 1} more`;
  }

  const firstClause = reason.split(";")[0].trim();
  return firstClause.length > 90 ? `${firstClause.slice(0, 90)}…` : firstClause;
};

/**
 * Free-spin failures.
 *
 * The question an admin arrives with is "which players did not get their spins,
 * and why". One flat, paginated table answers the who; the cause is a short code
 * per row with the full AleaPlay response behind View, because that response
 * runs to hundreds of characters of repeated JSON and is unreadable inline.
 */
export default function FreeSpinFailuresPage() {
  const router = useRouter();
  const [allocations, setAllocations] = useState<GrantAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryAllOpen, setRetryAllOpen] = useState(false);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<GrantAllocation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // `status=failed` is served from allocations that never reached AleaPlay.
      // They have no grant rows, so the normal query cannot see them.
      const res = await FreeSpinAPI.getPlayerFreeSpinGrants({
        status: "failed",
        page: 1,
        limit: 100,
      });
      setAllocations(groupGrantsByAllocation(res.data ?? []));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not load failures"));
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(allocations.length / PAGE_SIZE));
  const paginated = useMemo(
    () => allocations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [allocations, page],
  );

  // Clearing failures shrinks the list, which can strand the admin on a page
  // that no longer exists.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const retryOne = async (a: GrantAllocation) => {
    const poolId = a.grants[0]?.poolId ?? a.key.replace(/^grant:/, "");
    if (!poolId) return;

    setRetryingKey(a.key);
    try {
      const res = await FreeSpinAPI.retryFreeSpinAllocation(poolId);
      toast.success(res.message);
      await load();
    } catch (err) {
      // Short toast only. A toast carrying 600 characters of AleaPlay JSON
      // covered half the screen; the full text lives in the detail modal.
      toast.error(shortCause(getApiErrorMessage(err, "Retry failed")));
    } finally {
      setRetryingKey(null);
    }
  };

  const retryAll = async () => {
    setRetryingAll(true);
    try {
      const res = await FreeSpinAPI.retryAllFreeSpinAllocations({});
      if (res.failed > 0) {
        toast.error(`${res.message} ${res.failed} still failing.`);
      } else {
        toast.success(res.message);
      }
      await load();
    } catch (err) {
      toast.error(shortCause(getApiErrorMessage(err, "Bulk retry failed")));
    } finally {
      setRetryingAll(false);
      setRetryAllOpen(false);
    }
  };

  return (
    <div className="min-h-screen space-y-4 bg-[#0a0e1a] p-3 md:p-6">
      <div className="flex flex-col items-stretch gap-2 rounded-lg bg-[#191D24] px-3 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/lucky-draw/newbie-lucky-spin")}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
          >
            <ArrowLeft size={14} />
            Allocation
          </button>
          <h1 className="text-sm font-normal text-white">
            Free Spin / Failures
            {allocations.length > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                {allocations.length} not granted
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-700 bg-[#242B35] px-4 text-sm text-white hover:bg-[#2b3340]"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {allocations.length > 0 && (
            <button
              onClick={() => setRetryAllOpen(true)}
              disabled={retryingAll}
              className="flex h-9 items-center gap-2 rounded-lg border border-orange-500/40 bg-[#242B35] px-4 text-sm font-medium text-orange-300 hover:bg-[#2b3340] disabled:opacity-50"
            >
              <RefreshCw size={14} className={retryingAll ? "animate-spin" : ""} />
              {retryingAll ? "Re-sending..." : `Retry all ${allocations.length}`}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-[#191D24]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
          </div>
        ) : allocations.length === 0 ? (
          <div className="py-16">
            <NoData title="No failed free-spin allocations" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed">
              <thead className="bg-[#242B35]">
                <tr>
                  {[
                    "Player",
                    "Source",
                    "Template",
                    "Spins",
                    "Reason",
                    "Attempts",
                    "Assigned",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {paginated.map((a) => {
                  const source = parseGrantSource(a.bonusLabel);
                  return (
                    <tr key={a.key} className="bg-[#191D24] hover:bg-[#1a2030]">
                      <td className="px-4 py-3 text-xs">
                        <p
                          className="truncate text-gray-200"
                          title={a.contact || a.userId}
                        >
                          {a.contact || a.username || a.userId}
                        </p>
                        {a.contact && a.username && (
                          <p className="truncate text-[10px] text-gray-500">
                            {a.username}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${source.badgeClass}`}
                        >
                          {source.label}
                        </span>
                      </td>
                      <td className="truncate px-4 py-3 text-xs text-white">
                        {a.configName}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {a.totalSpins || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span
                          className="block truncate font-mono text-[11px] text-orange-300"
                          title={a.failureReason}
                        >
                          {shortCause(a.failureReason)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {a.grantAttempts ?? 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                        {fmt(a.grantedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDetail(a)}
                            className="rounded border border-gray-600 px-3 py-1 text-[11px] text-gray-300 hover:text-white"
                          >
                            View
                          </button>
                          <button
                            onClick={() => retryOne(a)}
                            disabled={retryingKey === a.key}
                            className="rounded border border-orange-500/40 px-3 py-1 text-[11px] text-orange-300 hover:bg-orange-500/10 disabled:opacity-40"
                          >
                            {retryingKey === a.key ? "..." : "Retry"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Full AleaPlay response — too long for a cell, and the part that
          actually tells an admin what to change. */}
      {detail && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-[#1C2127] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-700 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-white">
                  {detail.configName}
                </h2>
                <p className="mt-1 truncate text-xs text-gray-400">
                  {detail.contact || detail.username || detail.userId} ·{" "}
                  {detail.totalSpins} spins · attempt {detail.grantAttempts ?? 1}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                aria-label="Close"
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange-300" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-300">
                    Why it failed
                  </p>
                  <p className="mt-2 wrap-break-word font-mono text-[11px] leading-relaxed text-orange-100">
                    {detail.failureReason || "No reason recorded"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-700 bg-[#191D24] px-5 py-4">
              <button
                onClick={() => setDetail(null)}
                className="h-9 rounded-lg border border-gray-600 px-4 text-sm text-gray-300 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const target = detail;
                  setDetail(null);
                  void retryOne(target);
                }}
                className="h-9 rounded-lg bg-orange-600 px-5 text-sm font-medium text-white hover:bg-orange-700"
              >
                Retry this
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={retryAllOpen}
        busy={retryingAll}
        title="Re-send failed allocations"
        confirmLabel={`Re-send all ${allocations.length}`}
        message={
          <>
            <p>
              All {allocations.length} failed allocation
              {allocations.length === 1 ? "" : "s"} will be sent to AleaPlay again.
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
        onConfirm={retryAll}
        onCancel={() => setRetryAllOpen(false)}
      />
    </div>
  );
}
