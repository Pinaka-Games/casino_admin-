"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { connectSocket, onSocketInstance } from "@/lib/socket";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import UsDateInput from "@/components/UsDateInput";
import Pagination from "@/components/Pagination";
import { PermissionGuard } from "@/components/guard/permission-guard";
import {
  supportApi,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_STYLES,
  TICKET_STATUS_STYLES,
  type TicketCategory,
  type TicketRow,
  type TicketStats,
  type TicketStatus,
} from "@/api/support/support.api";
import TicketDetailModal from "./components/TicketDetailModal";

const PAGE_SIZE = 25;

/** ALL first, then the two that need somebody to act. */
const STATUS_TABS: Array<{ key: TicketStatus | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CLOSED", label: "Closed" },
];

const CATEGORIES = Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[];

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

/**
 * Every request a player has made, in one queue.
 *
 * Deliberately one table rather than a screen per request type: reactivation
 * asks, device problems and payment questions are worked by the same people in
 * the same sitting, and splitting them by category would mean nobody sees the
 * whole backlog.
 */
function SupportTicketsView() {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<TicketStatus | "ALL">("OPEN");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  // Opened-date bounds; the API applies them across the whole queue, not just
  // the page on screen.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);

  // Debounced so typing a ticket reference does not fire a request per keypress.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 500);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        supportApi.list({
          page,
          limit: PAGE_SIZE,
          status: status === "ALL" ? undefined : status,
          category: category || undefined,
          search: debounced || undefined,
          from: from || undefined,
          to: to || undefined,
        }),
        supportApi.stats().catch(() => null),
      ]);
      setRows(list.tickets);
      setTotal(list.total);
      if (s) setStats(s);
    } catch {
      toast.error("Could not load the support queue.");
    } finally {
      setLoading(false);
    }
  }, [page, status, category, debounced, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Live queue.
   *
   * Subscribed through `onSocketInstance` rather than by grabbing the socket
   * once: a re-auth swaps the instance, and a handler bound to the old one goes
   * quiet without erroring — the queue would simply stop updating and nobody
   * would notice until a ticket sat unanswered.
   *
   * Every event just reloads the page of results. The list is filtered, sorted
   * and paginated server-side, so patching a row in place would be guessing at
   * whether it still belongs on this page — a resolved ticket under the "Open"
   * tab has to leave, not turn green.
   */
  useEffect(() => {
    const bind = (s: any) => {
      if (!s) return () => { };
      const refresh = () => void load();

      s.on("support:ticket_created", refresh);
      s.on("support:ticket_message", refresh);
      s.on("support:ticket_updated", refresh);

      return () => {
        s.off("support:ticket_created", refresh);
        s.off("support:ticket_message", refresh);
        s.off("support:ticket_updated", refresh);
      };
    };

    // connectSocket() is idempotent and returns the live instance.
    let detach = bind(connectSocket());
    const off = onSocketInstance((next: any) => {
      detach();
      detach = bind(next);
    });

    return () => {
      detach();
      off();
    };
  }, [load]);

  // Any filter change starts again from the first page — otherwise a narrowed
  // result set leaves you on page 4 of 1.
  useEffect(() => {
    setPage(1);
  }, [status, category, debounced]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  /** Patch one row in place so closing the modal does not lose scroll. */
  const patchRow = (t: TicketRow) => {
    setRows((prev) => prev.map((r) => (r.id === t.id ? { ...r, ...t } : r)));
    void supportApi.stats().then(setStats).catch(() => { });
  };

  return (
    <div className="min-h-screen bg-[#15181E] p-3 md:p-6 text-white">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Support Tickets</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Account reactivation, activation and every other player request.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* This screen is entered from Responsible Gaming — it has no sidebar
              entry of its own — so it carries the way back itself, styled like
              the header's own Go Back control. */}
          <Link
            href="/users/responsible-gaming"
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#191D24] px-3 py-2 text-sm text-white/80 hover:bg-[#242B35]"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </Link>
        </div>
      </div>

      {/* Status tabs, with counts so the backlog is visible without clicking */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.key === "ALL" ? stats?.total : stats?.byStatus?.[tab.key];
          const active = status === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-[#B93DEB] bg-[#B93DEB]/15 text-[#C77DFF]"
                  : "border-white/10 bg-[#191D24] text-white/70 hover:bg-[#242B35]"
              }`}
            >
              {tab.label}
              {typeof count === "number" && (
                <span className="ml-1.5 text-xs opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Reference, subject, username or email"
          className="min-w-[260px] flex-1 rounded-lg border border-white/10 bg-[#242B35] px-3 py-2 text-sm text-white outline-none focus:border-[#B93DEB]"
        />
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-white/40">From</span>
          <UsDateInput
            value={from}
            onChange={(iso) => {
              setFrom(iso);
              setPage(1);
            }}
            className="h-[38px] rounded-lg border border-white/10 bg-[#242B35] px-3 flex items-center text-sm text-white"
          />
          <span className="text-[11px] uppercase tracking-wider text-white/40">To</span>
          <UsDateInput
            value={to}
            onChange={(iso) => {
              setTo(iso);
              setPage(1);
            }}
            className="h-[38px] rounded-lg border border-white/10 bg-[#242B35] px-3 flex items-center text-sm text-white"
          />
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
                setPage(1);
              }}
              className="rounded-lg bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wider text-white/60 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TicketCategory | "")}
          className="rounded-lg border border-white/10 bg-[#242B35] px-3 py-2 text-sm text-white outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TICKET_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#191D24]">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#242B35] text-left text-xs uppercase tracking-wide text-white/60">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-white/60">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8">
                  <NoData />
                </td>
              </tr>
            ) : (
              rows.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className={`cursor-pointer border-b border-white/5 text-sm transition hover:bg-[#242B35] ${
                    i % 2 ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#C77DFF]">
                    {t.reference}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3">
                    {t.player?.username || t.player?.entity || "—"}
                    {t.player?.rgStatus && t.player.rgStatus !== "ACTIVE" && (
                      <span className="ml-1.5 text-[11px] text-amber-300">
                        {t.player.rgStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/80">
                    {TICKET_CATEGORY_LABELS[t.category]}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-white/80">
                    {t.subject}
                  </td>
                  <td
                    className={`px-4 py-3 text-xs font-semibold ${TICKET_PRIORITY_STYLES[t.priority]}`}
                  >
                    {t.priority}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TICKET_STATUS_STYLES[t.status].cls}`}
                    >
                      {TICKET_STATUS_STYLES[t.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {fmt(t.lastMessageAt ?? t.createdAt)}
                    {t.lastMessageBy === "PLAYER" && t.isOpen && (
                      <span className="ml-1.5 text-amber-300">
                        · awaiting reply
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {openId && (
        <TicketDetailModal
          ticketId={openId}
          onClose={() => setOpenId(null)}
          onChanged={patchRow}
        />
      )}
    </div>
  );
}

export default function SupportTicketsPage() {
  // RoutePermissionGuard already gates this route from menu.config; this second
  // guard is what protects the page if the menu entry is ever renamed, since
  // routes with no matching rule fail OPEN.
  return (
    <PermissionGuard permission="support:tickets">
      <SupportTicketsView />
    </PermissionGuard>
  );
}
