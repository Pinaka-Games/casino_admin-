"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Paperclip, Settings, Search } from "lucide-react";
import toast from "react-hot-toast";

import { connectSocket, onSocketInstance } from "@/lib/socket";
import ExportCSV from "@/components/ExportCSV";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MANUAL_REJECTION_REASONS,
  POSTAL_CURRENCY_LABELS,
  PostalRedemptionRecord,
  PostalRedemptionStatus,
  PostalRejectionReason,
  REJECTION_REASON_LABELS,
  postalRequestApi,
} from "@/api/postal-request/postal-request.api";

import FraudPanel from "./components/FraudPanel";
import IntakeForm from "./components/IntakeForm";
import {
  ACCENT,
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD,
  PAGE,
  PANEL,
  TEXT_FAINT,
  TEXT_MUTED,
} from "./theme";

const PAGE_SIZE = 10;

const STATUS_TABS: Array<{ value: PostalRedemptionStatus | "ALL"; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

/** The API takes whole days as YYYY-MM-DD, in the operator's own timezone. */
const toDateParam = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
};

/**
 * Placeholder rows while a page of the queue loads.
 *
 * Rows rather than a spinner: the table keeps its height, so the pager and the
 * filters underneath do not jump the moment results land.
 */
const SkeletonRows = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-t border-[#242B35]">
        {Array.from({ length: 7 }).map((__, cell) => (
          <td key={cell} className="p-3">
            <div
              className="h-3 animate-pulse rounded bg-white/10"
              style={{ width: `${55 + ((cell * 13) % 40)}%` }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const statusPill = (status: PostalRedemptionStatus) => {
  const tone =
    status === "APPROVED"
      ? "bg-green-500/15 text-green-300 border border-green-500/30"
      : status === "REJECTED"
        ? "bg-red-500/15 text-red-300 border border-red-500/30"
        : "bg-amber-500/15 text-amber-300 border border-amber-500/30";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
};

/**
 * The mail room.
 *
 * The queue is the record of every envelope that was opened, refusals included —
 * a card that matched no code is still a thing that arrived, and a run of them
 * is how somebody mailing guessed codes becomes visible.
 */
export default function PostalEntriesPage() {
  const [rows, setRows] = useState<PostalRedemptionRecord[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [status, setStatus] = useState<PostalRedemptionStatus | "ALL">("PENDING");
  const [codeFilter, setCodeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  // Only the FIRST load shows skeletons. A socket-driven refresh replaces the
  // numbers in place; blanking them every time an envelope is opened elsewhere
  // would make the header flicker all morning.
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState<PostalRedemptionRecord | null>(null);
  const [reason, setReason] = useState<PostalRejectionReason>("ILLEGIBLE");
  const [detail, setDetail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, counts] = await Promise.all([
        postalRequestApi.list({
          status: status === "ALL" ? undefined : status,
          code: codeFilter.trim() || undefined,
          page,
          limit: PAGE_SIZE,
        }),
        postalRequestApi.stats(),
      ]);
      setRows(list.data.data);
      setTotalPages(list.data.meta.totalPages || 1);
      setStats(counts.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not load postal entries");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [status, codeFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Live queue.
   *
   * Anyone else with this page open — a second clerk, or the same admin in
   * another tab — would otherwise keep seeing a card that has already been
   * decided until they happen to reload, and click approve on it.
   *
   * Bound through `onSocketInstance` rather than by grabbing the socket once —
   * a re-auth swaps the instance, and a handler left on the old one goes quiet
   * without erroring, which looks exactly like a quiet mail day.
   *
   * The event only says "something moved": the list is filtered and paginated
   * server-side, so it reloads rather than patching a row that may no longer
   * belong on this page at all.
   */
  useEffect(() => {
    const bind = (s: any) => {
      if (!s) return () => {};
      const refresh = () => void load();
      s.on("postal-entry:changed", refresh);
      return () => s.off("postal-entry:changed", refresh);
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

  const approve = async (row: PostalRedemptionRecord) => {
    setBusyId(row.id);
    try {
      const res = await postalRequestApi.approve(row.id);
      // The API refuses rather than credits when the player reached the cap
      // after this card was recorded — the entry comes back REJECTED, not an
      // error, because that decision is real and has been saved.
      if (res.data.status === "REJECTED") {
        toast.error(
          `Not credited: ${
            res.data.rejectionReason
              ? (REJECTION_REASON_LABELS[res.data.rejectionReason] ?? res.data.rejectionReason)
              : "refused"
          }. The entry has been rejected.`,
        );
      } else {
        toast.success("Entry approved and credited");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not approve this entry");
    } finally {
      setBusyId(null);
    }
  };

  const submitRejection = async () => {
    if (!rejecting) return;
    if (reason === "OTHER" && !detail.trim()) {
      toast.error("Describe the problem when choosing Other");
      return;
    }
    setBusyId(rejecting.id);
    try {
      await postalRequestApi.reject(rejecting.id, reason, detail.trim() || undefined);
      toast.success("Entry rejected");
      setRejecting(null);
      setDetail("");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not reject this entry");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={`${PAGE} min-h-screen space-y-6 p-4 md:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Postal Entries</h1>
          <p className={`text-sm ${TEXT_MUTED}`}>
            Mail-in entries — the free, no-purchase route into the sweepstakes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Server-side fetch, so the export covers the whole filtered set
              rather than the ten rows currently on screen. */}
          <ExportCSV
            data={rows}
            fileName="postal-entries"
            headers={[
              "Code",
              "Player",
              "Email / phone",
              "Status",
              "Amount",
              "Currency",
              "Gold Coins (extra)",
              "Postmark date",
              "Rejection reason",
              "Rejection detail",
              "Opened at",
              "Processed at",
            ]}
            mapRow={(row) => [
              row.enteredCode,
              row.user?.username ?? "",
              row.user?.entity ?? "",
              row.status,
              Number(row.amount).toFixed(2),
              row.currency,
              Number(row.goldCoinAmount) > 0 ? Number(row.goldCoinAmount).toFixed(2) : "",
              row.postmarkDate ?? "",
              row.rejectionReason
                ? (REJECTION_REASON_LABELS[row.rejectionReason] ?? row.rejectionReason)
                : "",
              row.rejectionDetail ?? "",
              formatDateTime(row.createdAt),
              formatDateTime(row.processedAt),
            ]}
            fetchAll={async (range) => {
              const res = await postalRequestApi.export({
                status: status === "ALL" ? undefined : status,
                code: codeFilter.trim() || undefined,
                from: range.from ? toDateParam(range.from) : undefined,
                to: range.to ? toDateParam(range.to) : undefined,
              });
              return res.data;
            }}
          />
          <Link href="/wallet/postal-entries/settings">
            <Button variant="outline" className={`gap-2 ${BTN_SECONDARY}`}>
              <Settings className="h-4 w-4" /> Settings
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Pending", value: stats.pending },
          { label: "Approved", value: stats.approved },
          { label: "Rejected", value: stats.rejected },
        ].map((c) => (
          <div key={c.label} className={`${PANEL} p-4`}>
            <p className={`text-sm ${TEXT_MUTED}`}>{c.label}</p>
            {loading && !loaded ? (
              <div className="mt-2 h-6 w-12 animate-pulse rounded bg-white/10" />
            ) : (
              <p className="mt-1 text-2xl font-semibold text-white">{c.value}</p>
            )}
          </div>
        ))}
      </div>

      <IntakeForm onRecorded={load} />

      <FraudPanel />

      <div className={PANEL}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#242B35] p-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={status === t.value ? "default" : "outline"}
                className={status === t.value ? BTN_PRIMARY : BTN_SECONDARY}
                onClick={() => {
                  setStatus(t.value);
                  setPage(1);
                }}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Search className={`h-4 w-4 ${TEXT_FAINT}`} />
            <Input
              value={codeFilter}
              onChange={(e) => {
                setCodeFilter(e.target.value.replace(/\D/g, ""));
                setPage(1);
              }}
              placeholder="Filter by code"
              className={`w-44 ${FIELD}`}
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#15181E] text-left text-white/60">
              <tr>
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Player</th>
                <th className="p-3 font-medium">Postmark date</th>
                <th className="p-3 font-medium">Reward</th>
                <th className="p-3 font-medium">Opened</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && <SkeletonRows />}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[#242B35] align-top text-white/85"
                >
                  <td className="p-3 font-mono text-white">
                    {row.enteredCode}
                    {row.imageUrl && (
                      <a
                        href={row.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`mt-1 flex items-center gap-1 font-sans text-xs underline ${ACCENT}`}
                      >
                        <Paperclip className="h-3 w-3" /> Scan
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    {row.user ? (
                      <div>
                        <div>{row.user.username ?? "—"}</div>
                        <div className={`text-xs ${TEXT_MUTED}`}>
                          {row.user.entity ?? ""}
                        </div>
                      </div>
                    ) : (
                      <span className={TEXT_FAINT}>No matching account</span>
                    )}
                  </td>
                  <td className="p-3">{row.postmarkDate ?? "—"}</td>
                  <td className="p-3">
                    {Number(row.amount).toFixed(2)}{" "}
                    <span className={`text-xs ${TEXT_MUTED}`}>
                      {POSTAL_CURRENCY_LABELS[row.currency] ?? row.currency}
                    </span>
                    {Number(row.goldCoinAmount) > 0 && (
                      <div>
                        + {Number(row.goldCoinAmount).toFixed(2)}{" "}
                        <span className={`text-xs ${TEXT_MUTED}`}>
                          {POSTAL_CURRENCY_LABELS.wulfCoin}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">{formatDateTime(row.createdAt)}</td>
                  <td className="p-3">
                    {statusPill(row.status)}
                    {row.rejectionReason && (
                      <div className={`mt-1 text-xs ${TEXT_MUTED}`}>
                        {REJECTION_REASON_LABELS[row.rejectionReason] ??
                          row.rejectionReason}
                        {row.rejectionDetail ? ` — ${row.rejectionDetail}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {row.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className={BTN_PRIMARY}
                          disabled={busyId === row.id}
                          onClick={() => approve(row)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={BTN_DANGER}
                          disabled={busyId === row.id}
                          onClick={() => {
                            setRejecting(row);
                            setReason("ILLEGIBLE");
                            setDetail("");
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className={`text-xs ${TEXT_MUTED}`}>
                        {formatDateTime(row.processedAt)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && rows.length === 0 && <NoData />}
        </div>

        {totalPages > 1 && (
          <div className="border-t border-[#242B35] p-3">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="border-[#242B35] bg-[#191D24] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Reject postal entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              {/* The reason is sent to the player. A refusal they cannot act on
                  just produces the same wrong card again next week. */}
              <Label className="text-white/80">Reason (shown to the player)</Label>
              <select
                className="w-full rounded-md border border-[#2F3743] bg-[#242B35] p-2 text-sm text-white"
                value={reason}
                onChange={(e) => setReason(e.target.value as PostalRejectionReason)}
              >
                {MANUAL_REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REJECTION_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">
                Detail {reason === "OTHER" ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="What exactly was wrong with the card?"
                maxLength={500}
                className={FIELD}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className={BTN_SECONDARY}
              onClick={() => setRejecting(null)}
            >
              Cancel
            </Button>
            <Button
              className={BTN_DANGER}
              onClick={submitRejection}
              disabled={busyId === rejecting?.id}
            >
              Reject entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
