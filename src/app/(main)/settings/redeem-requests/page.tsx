"use client";

import { useEffect, useState } from "react";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { Sliders } from "lucide-react";
import type { FilterField, FilterValues } from "@/components/filters/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, ChevronDown, ArrowLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Pagination from "@/components/Pagination";
import CopyButton from "@/components/CopyButton";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  redeemApi,
  RedeemRequest,
  RedeemStatus,
  type RedeemDateBasis,
} from "@/api/redeem/redeem.api";
import { systemConfigApi } from "@/api/system-config/system-config.api";
import type { SystemConfigWithdrawRedeem } from "@/types/system-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import { coingreen } from "@/assets/icons";

const PAGE_SIZE = 10;

interface RedeemLimitsForm {
  redeem_daily_limit_enabled: boolean;
  redeem_daily_limit_amount: number;
  min_redemption_chips: number;
  max_pending_requests: number;
}

const STATUS_COLORS: Record<RedeemStatus, string> = {
  PENDING: "text-yellow-400",
  APPROVED: "text-green-400",
  REJECTED: "text-red-400",
  PROCESSED: "text-blue-400",
  CANCELLED: "text-gray-400",
};

const STATUS_LABELS: Record<RedeemStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PROCESSED: "Processed",
  CANCELLED: "Cancelled",
};

// CANCELLED is intentionally absent: it is a player action, not a status an admin
// can assign. It still appears in the listing and its filters.
const ALL_STATUSES: RedeemStatus[] = ["PENDING", "APPROVED", "REJECTED", "PROCESSED"];


/**
 * `/redeem/list` already accepts these — the screen just never exposed them, so
 * an operator could search a player but not narrow by date, method or size.
 */
const REDEEM_FILTER_DEFAULTS: FilterValues = {
  search: "",
  dateBasis: "created",
  paymentMethod: "",
  payoutStatus: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

const REDEEM_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "dateBasis",
    label: "Date Basis",
    options: [
      { label: "Requested date", value: "created" },
      { label: "Paid date", value: "paid" },
    ],
    hint: "Paid date drops requests that never released.",
  },
  { type: "dateRange", fromKey: "dateFrom", toKey: "dateTo", label: "Date Range" },
  {
    type: "text",
    key: "paymentMethod",
    label: "Payment Method",
    placeholder: "Breeze, Coinflow…",
  },
  {
    type: "text",
    key: "payoutStatus",
    label: "Payout Status",
    placeholder: "PROCESSING, COMPLETED…",
  },
  { type: "numberRange", minKey: "amountMin", maxKey: "amountMax", label: "Amount" },
];
export default function RedeemRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RedeemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<RedeemStatus | "ALL">("ALL");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(REDEEM_FILTER_DEFAULTS);

  const activeFilterCount = REDEEM_FILTER_FIELDS.reduce((count, field) => {
    const keys =
      field.type === "dateRange"
        ? [field.fromKey, field.toKey]
        : field.type === "numberRange"
          ? [field.minKey, field.maxKey]
          : [field.key];
    return keys.some(
      (key) => (filters[key] ?? "") !== (REDEEM_FILTER_DEFAULTS[key] ?? ""),
    )
      ? count + 1
      : count;
  }, 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  // Debounced so the list query is not re-run per keystroke.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(id);
  }, [search]);

  // Status update modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<RedeemRequest | null>(null);
  const [newStatus, setNewStatus] = useState<RedeemStatus>("APPROVED");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Redeem limits config
  const [withdrawRedeem, setWithdrawRedeem] =
    useState<SystemConfigWithdrawRedeem | null>(null);
  const [limitsModalOpen, setLimitsModalOpen] = useState(false);
  const [limitsForm, setLimitsForm] = useState<RedeemLimitsForm>({
    redeem_daily_limit_enabled: true,
    redeem_daily_limit_amount: 1000,
    min_redemption_chips: 20,
    max_pending_requests: 3,
  });
  const [limitsSaving, setLimitsSaving] = useState(false);

  const loadLimits = async () => {
    try {
      const res = await systemConfigApi.get();
      setWithdrawRedeem(res.config.withdraw_redeem);
    } catch {
      // non-fatal — table still works without the limits card
    }
  };

  useEffect(() => {
    loadLimits();
  }, []);

  const openLimitsEdit = () => {
    if (withdrawRedeem) {
      setLimitsForm({
        redeem_daily_limit_enabled: withdrawRedeem.redeem_daily_limit_enabled ?? true,
        redeem_daily_limit_amount: withdrawRedeem.redeem_daily_limit_amount ?? 1000,
        min_redemption_chips: withdrawRedeem.min_redemption_chips ?? 20,
        max_pending_requests: withdrawRedeem.max_pending_requests ?? 3,
      });
    }
    setLimitsModalOpen(true);
  };

  const handleSaveLimits = async () => {
    if (!withdrawRedeem) return;

    const dailyAmt = Number(limitsForm.redeem_daily_limit_amount) || 0;
    const minAmt = Number(limitsForm.min_redemption_chips) || 0;
    if (limitsForm.redeem_daily_limit_enabled && dailyAmt > 0 && minAmt > dailyAmt) {
      toast.error(
        "Minimum redemption cannot be greater than the daily limit amount.",
      );
      return;
    }

    setLimitsSaving(true);
    try {
      const next: SystemConfigWithdrawRedeem = {
        ...withdrawRedeem,
        redeem_daily_limit_enabled: limitsForm.redeem_daily_limit_enabled,
        redeem_daily_limit_amount: Number(limitsForm.redeem_daily_limit_amount) || 0,
        min_redemption_chips: Number(limitsForm.min_redemption_chips) || 0,
        max_pending_requests: Number(limitsForm.max_pending_requests) || 0,
      };
      const res = await systemConfigApi.patchSection("withdraw_redeem", next);
      setWithdrawRedeem(res.config.withdraw_redeem);
      toast.success("Redeem limits updated");
      setLimitsModalOpen(false);
    } catch {
      toast.error("Failed to update redeem limits");
    } finally {
      setLimitsSaving(false);
    }
  };

  /**
   * Server-paginated: /redeem/all hydrates every request with its payout pages
   * and its user, which is unbounded and times out as the table grows. /redeem/list
   * also does the email/phone search, which a client-side filter could only apply
   * to the page already loaded.
   */
  const load = async (page = currentPage) => {
    setLoading(true);
    try {
      const res = await redeemApi.list({
        status: filterStatus === "ALL" ? undefined : filterStatus,
        search: debouncedSearch || undefined,
        dateBasis: filters.dateBasis as RedeemDateBasis,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        paymentMethod: filters.paymentMethod || undefined,
        payoutStatus: filters.payoutStatus || undefined,
        amountMin: filters.amountMin || undefined,
        amountMax: filters.amountMax || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setRequests(res.data.data);
      setTotal(res.data.total);
    } catch {
      toast.error("Failed to load redeem requests");
    } finally {
      setLoading(false);
    }
  };

  // A filter change always lands the operator back on page 1 — page 4 of the
  // old result set means nothing for the new one.
  useEffect(() => {
    setCurrentPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, debouncedSearch, filters]);

  useEffect(() => {
    load(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginated = requests;

  const openEdit = (row: RedeemRequest) => {
    setSelected(row);
    setNewStatus(row.status);
    setNotes(row.notes ?? "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await redeemApi.updateStatus(selected.id, {
        status: newStatus,
        notes: notes || undefined,
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === selected.id ? res.data : r))
      );
      toast.success("Status updated");
      setModalOpen(false);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 md:p-6 w-full">
      {/* Entered from Withdrawal Listing — this page is no longer in the
          sidebar, so it has to offer the way back. */}
      <div className="bg-[#191D24] mb-6 px-4 py-3 rounded-lg flex items-center justify-between gap-4">
        <h1 className="text-base font-normal text-white">
          Wallet / Redeem Requests
        </h1>
        <Link href="/wallet/withdrawal-listing">
          <Button
            variant="outline"
            className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Withdrawal Listing
          </Button>
        </Link>
      </div>

      {/* FILTER BAR — search, status and Edit Limits on one line. The limits
          themselves live in that dialog rather than a summary card above the
          table. */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or phone..."
            className="h-9 w-72 rounded-md border-gray-700/50 bg-[#242B35] pl-9 text-sm text-white placeholder:text-gray-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className={`h-9 rounded-md border-[#3b414d] bg-[#242B35] px-3 text-sm text-white hover:bg-[#2b323b] ${
            activeFilterCount > 0 ? "border-purple-500/60 text-purple-300" : ""
          }`}
        >
          <Sliders className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 rounded-md bg-purple-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-w-[150px] justify-between rounded-md border-[#3b414d] bg-[#242B35] px-3 text-sm text-white hover:bg-[#2b323b]"
            >
              <span>
                {filterStatus === "ALL" ? "All Statuses" : STATUS_LABELS[filterStatus]}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[150px] border-[#3a4250] bg-[#1a2030] text-white"
          >
            <DropdownMenuItem onClick={() => setFilterStatus("ALL")}>
              All Statuses
            </DropdownMenuItem>
            {ALL_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => setFilterStatus(s)}>
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={openLimitsEdit}
          disabled={!withdrawRedeem}
          className="ml-auto h-9 bg-purple-600 hover:bg-purple-700 text-white"
        >
          Edit Limits
        </Button>
      </div>
      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-[#0E1117]">
              <th className="text-left text-gray-400 font-medium px-4 py-3">ID</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Email</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Amount (SC)</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Payment Method</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Status</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Time</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-10">
                  Loading...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-10">
                  No records found.
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-800/50 hover:bg-[#0E1117]/60 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      {row.id.slice(0, 8)}…
                      <CopyButton value={row.id} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[220px] truncate" title={row.userEmail ?? row.userId}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => router.push(`/users/players-list/${row.userId}`)}
                        className="text-[#B93DEB] hover:underline truncate max-w-full text-left"
                      >
                        {row.userEmail ?? `${row.userId.slice(0, 8)}…`}
                      </button>
                      <CopyButton value={row.userEmail ?? row.userId} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">
                    {Number(row.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {row.paymentMethod ?? "—"}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${STATUS_COLORS[row.status]}`}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(row)}
                      className="text-purple-400 hover:text-purple-300 text-xs underline underline-offset-2"
                    >
                      Edit
                    </button>
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
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Status Edit Modal. `min-w-0` throughout and `break-all` on the ids are
          load-bearing: a payout note carries an unbroken ~90-char Coinflow
          session id, and a grid child defaults to min-width:auto, so without
          them that one token stretches the dialog past its own max width and the
          content spills outside the box. */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#191D24] border-gray-800 text-white w-[calc(100vw-2rem)] max-w-md overflow-hidden">
          <DialogHeader className="min-w-0">
            <DialogTitle>Update Redeem Status</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-2 min-w-0 max-h-[60vh] overflow-y-auto">
              <div className="text-sm text-gray-400 min-w-0">
                <span className="text-gray-500">Request ID: </span>
                <span className="font-mono text-gray-300 break-all">{selected.id}</span>
              </div>
              <div className="text-sm text-gray-400">
                <span className="text-gray-500">Amount: </span>
                <span className="text-white font-bold">{Number(selected.amount).toFixed(2)} SC</span>
              </div>

              {/* Status selector */}
              <div className="space-y-1">
                <label className="text-sm text-gray-400">New Status</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setNewStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                        newStatus === s
                          ? "border-purple-500 bg-purple-900/40 text-purple-300"
                          : "border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1 min-w-0">
                <label className="text-sm text-gray-400">
                  Notes <span className="text-gray-600">(optional)</span>
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Rejection reason, payment reference, etc."
                  className="w-full min-w-0 max-h-48 overflow-y-auto break-all bg-[#0E1117] border-gray-700 text-white resize-none"
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter className="min-w-0">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem Limits Edit Modal */}
      <Dialog open={limitsModalOpen} onOpenChange={setLimitsModalOpen}>
        <DialogContent className="bg-[#191D24] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Redeem Limits</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-gray-400 -mt-1">
            Rules for redeem requests across both Fiat and Crypto. Min redemption and max
            pending are per user. The daily cap defaults to platform-wide (all users
            combined) and resets at midnight in the platform&apos;s Default Timezone — set
            <span className="text-gray-300"> Daily Redeem Limit Scope</span> to USER in
            System Configuration to make it a per-player cap resetting at each
            player&apos;s own local midnight. It counts pending, approved and paid
            requests; rejected/denied requests free the allowance again.
          </p>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-[#0E1117] px-4 py-3">
              <Label className="text-sm text-white">Enable limit</Label>
              <Switch
                checked={limitsForm.redeem_daily_limit_enabled}
                onCheckedChange={(v) =>
                  setLimitsForm((p) => ({ ...p, redeem_daily_limit_enabled: v }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-gray-300">
                Daily Limit Amount (all users / day)
              </Label>
              <div className="relative flex items-center">
                <Image
                  src={coingreen}
                  alt="Wulf Cash"
                  width={18}
                  height={18}
                  className="absolute left-3 pointer-events-none"
                />
                <Input
                  type="number"
                  min={0}
                  value={limitsForm.redeem_daily_limit_amount}
                  onChange={(e) =>
                    setLimitsForm((p) => ({
                      ...p,
                      redeem_daily_limit_amount: Number(e.target.value),
                    }))
                  }
                  className="bg-[#0E1117] border-gray-700 text-white pl-10 pr-24"
                />
                <span className="absolute right-3 text-xs font-medium text-gray-400 pointer-events-none">
                  Wulf Cash
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-gray-300">
                Minimum Redemption (chips per request)
              </Label>
              <Input
                type="number"
                min={0}
                value={limitsForm.min_redemption_chips}
                onChange={(e) =>
                  setLimitsForm((p) => ({
                    ...p,
                    min_redemption_chips: Number(e.target.value),
                  }))
                }
                className="bg-[#0E1117] border-gray-700 text-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-gray-300">
                Max Open Requests (per user, concurrent — not daily)
              </Label>
              <Input
                type="number"
                min={0}
                value={limitsForm.max_pending_requests}
                onChange={(e) =>
                  setLimitsForm((p) => ({
                    ...p,
                    max_pending_requests: Number(e.target.value),
                  }))
                }
                className="bg-[#0E1117] border-gray-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLimits}
              disabled={limitsSaving}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {limitsSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Redeem Filters"
        description="Filter redeem requests by date, method and amount"
        fields={REDEEM_FILTER_FIELDS}
        values={filters}
        defaults={REDEEM_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
}
