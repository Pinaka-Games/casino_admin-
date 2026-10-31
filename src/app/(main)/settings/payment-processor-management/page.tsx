"use client";

import { useCallback, useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import { PermissionGuard } from "@/components/guard/permission-guard";
import { NAV_PERMISSIONS } from "@/config/menu.config";
import { formatUtcDateTime, formatUtcDateTimeFull } from "@/lib/utils";

import {
  paymentTransactionsApi,
  type PaymentTransaction,
  type PaymentTransactionQuery,
} from "@/api/payment-transactions/payment-transactions.api";
import { TransactionDetailDrawer } from "./components/TransactionDetailDrawer";
import PaymentStatusLegend from "@/components/PaymentStatusLegend";
import {
  TransactionFilters,
  DEFAULT_TRANSACTION_FILTERS,
  type TransactionFilterValues,
} from "./components/TransactionFilters";

const PAGE_SIZE = 10;

// Export pulls the filtered set in server-sized chunks. 200 is the API's
// `limit` ceiling. Chunks are cursor-based and therefore all cost the same, so
// the backstop can be generous: 500 × 200 = 100,000 rows, up from the 5,000 a
// page-numbered walk could afford before it got too slow to finish.
const EXPORT_CHUNK_SIZE = 200;
const EXPORT_MAX_CHUNKS = 500;

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-emerald-900/40 text-emerald-400",
  COMPLETED: "bg-emerald-900/40 text-emerald-400",
  PROCESSED: "bg-emerald-900/40 text-emerald-400",
  Successful: "bg-emerald-900/40 text-emerald-400",
  PROCESSING: "bg-sky-900/40 text-sky-400",
  PENDING: "bg-sky-900/40 text-sky-400",
  CREATED: "bg-sky-900/40 text-sky-400",
  UNPAID: "bg-gray-700 text-gray-300",
  EXPIRED: "bg-amber-900/40 text-amber-400",
  CANCELED: "bg-amber-900/40 text-amber-400",
  FAILED: "bg-red-900/40 text-red-400",
  REFUNDED: "bg-red-900/40 text-red-400",
};

// UTC, like User Deposit logs — rendering in the viewer's zone made the two
// screens (and their exports) disagree by the offset. See formatUtcDateTime.
const formatDate = (iso: string) => formatUtcDateTime(iso);

const getApiMessage = (error: unknown, fallback: string) => {
  const err = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return err?.response?.data?.message || err?.message || fallback;
};

export default function PaymentProcessorManagementPage() {
  const [rows, setRows] = useState<PaymentTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilterValues>(
    DEFAULT_TRANSACTION_FILTERS,
  );
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<PaymentTransaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query: PaymentTransactionQuery = {
        flow: filters.flow,
        provider: filters.provider,
        page,
        limit: PAGE_SIZE,
      };
      if (filters.status !== "all") query.status = filters.status;
      if (filters.dateFrom) query.dateFrom = filters.dateFrom;
      if (filters.dateTo) query.dateTo = filters.dateTo;
      if (filters.amountMin) query.amountMin = filters.amountMin;
      if (filters.amountMax) query.amountMax = filters.amountMax;
      if (search) query.search = search;
      const res = await paymentTransactionsApi.list(query);
      setRows(res.data);
      // The table never sends a cursor, so `total` is always a number here.
      setTotal(res.total ?? 0);
    } catch (error) {
      toast.error(getApiMessage(error, "Failed to load transactions"));
    } finally {
      setLoading(false);
    }
  }, [filters, search, page]);

  const applyFilters = (next: TransactionFilterValues) => {
    setFilters(next);
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_TRANSACTION_FILTERS);
    setPage(1);
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const baseQuery: PaymentTransactionQuery = {
        flow: filters.flow,
        provider: filters.provider,
      };
      if (filters.status !== "all") baseQuery.status = filters.status;
      if (filters.dateFrom) baseQuery.dateFrom = filters.dateFrom;
      if (filters.dateTo) baseQuery.dateTo = filters.dateTo;
      if (filters.amountMin) baseQuery.amountMin = filters.amountMin;
      if (filters.amountMax) baseQuery.amountMax = filters.amountMax;
      if (search) baseQuery.search = search;

      // Walk the result set with a KEYSET CURSOR, not page numbers.
      //
      // Numbered paging made each chunk re-read every row down to that page,
      // across all four transaction sources, mapping every one of them through
      // the provider-JSON extraction just to return the last 200. On 977 rows
      // that was 4s for chunk 1 and 61s for chunk 4 — past the client's 12s
      // timeout, so the walk threw and the export produced nothing. With a
      // cursor every chunk costs the same as the first, so the full set is
      // actually reachable.
      const collected: PaymentTransaction[] = [];
      let reportedTotal = 0;
      let cursor: string | undefined;
      let chunks = 0;
      // Backstop against a server that never stops handing back a cursor.
      while (chunks < EXPORT_MAX_CHUNKS) {
        const res = await paymentTransactionsApi.list({
          ...baseQuery,
          limit: EXPORT_CHUNK_SIZE,
          cursor,
        });
        chunks += 1;
        // Only the first (cursorless) chunk carries the count.
        if (res.total !== null) reportedTotal = res.total;
        collected.push(...res.data);
        if (!res.nextCursor || res.data.length === 0) break;
        cursor = res.nextCursor;
      }

      if (collected.length === 0) {
        toast.error("No transactions to export");
        return;
      }

      const truncated = reportedTotal > collected.length;

      const rows = collected.map((r) => ({
        Date: formatUtcDateTimeFull(r.date),
        Flow: r.flow,
        Provider: r.provider,
        "Page ID": r.pageId ?? r.clientReferenceId,
        "Client Reference ID": r.clientReferenceId,
        "Customer Email": r.customerEmail ?? "-",
        Amount: r.amount,
        "Total (incl. Tax)": r.totalWithTax ?? "-",
        Currency: r.currency?.toUpperCase() ?? "",
        Status: r.status,
        "Payment Method": r.paymentType
          ? `${r.provider} (${r.paymentType})`
          : r.provider,
        "Decline Reason": r.declineReason ?? "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 50 },
        { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
        { wch: 28 }, { wch: 30 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
      const buf = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const fileName = `payment-transactions-${filters.flow}-${ts}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(
        truncated
          ? `Exported ${rows.length} of ${reportedTotal} rows — narrow the filters to export the rest`
          : `Exported ${rows.length} rows`,
      );
    } catch (error) {
      toast.error(getApiMessage(error, "Failed to export"));
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /**
   * Debounced search: the applied `search` follows the input instead of waiting
   * for Enter. Clearing the box previously left the old term applied — the
   * filtered results stayed on screen until you pressed Enter on an empty field.
   *
   * An emptied box resets immediately (no debounce): there is nothing to wait
   * for, and the delay made "clear" feel broken.
   */
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;

    if (next === "") {
      setSearch("");
      setPage(1);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Enter still works — it just applies the current text without waiting out the
  // debounce.
  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#15181E] p-3 md:p-6">
      {/* TITLE — Payment Manager lives behind the button here rather than in the
          sidebar: this page is what the processors DID, that page is what they
          are ALLOWED to do, and admins move between the two constantly. */}
      <div className="bg-[#191D24] mb-3 px-4 py-2 rounded-lg flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-normal text-white">
          Settings / Payment Processor Transactions
        </h1>

        <div className="flex items-center gap-2">
          {/* The raw notifications behind these rows. Sits next to Payment
              Manager for the same reason: what the processors DID, what they are
              ALLOWED to do, and what they TOLD us. */}
          <PermissionGuard permission={NAV_PERMISSIONS.SETTINGS_PAYMENT_MANAGER}>
            <Link
              href="/settings/payment-manager"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#B93DEB] px-3 text-sm text-white transition hover:bg-[#a234d1]"
            >
              <SlidersHorizontal size={15} />
              Payment Manager
            </Link>
          </PermissionGuard>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#191D24] mb-4 px-3 py-3 rounded-lg flex flex-wrap items-center gap-2">
        {/* Flow toggle */}
        <div className="inline-flex rounded-lg bg-[#242B35] p-1">
          <button
            onClick={() => applyFilters({ ...filters, flow: "pay-in" })}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md ${
              filters.flow === "pay-in"
                ? "bg-[#B93DEB] text-white"
                : "text-gray-300 hover:text-white"
            }`}
          >
            <ArrowDownToLine size={14} />
            Pay-ins
          </button>
          <button
            onClick={() => applyFilters({ ...filters, flow: "pay-out" })}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md ${
              filters.flow === "pay-out"
                ? "bg-[#B93DEB] text-white"
                : "text-gray-300 hover:text-white"
            }`}
          >
            <ArrowUpFromLine size={14} />
            Pay-outs
          </button>
          <button
            onClick={() => applyFilters({ ...filters, flow: "all" })}
            className={`px-3 py-1.5 text-xs rounded-md ${
              filters.flow === "all"
                ? "bg-[#B93DEB] text-white"
                : "text-gray-300 hover:text-white"
            }`}
          >
            All
          </button>
        </div>

        {/* Search — applies as you type (debounced); see the effect above. */}
        <form onSubmit={onSearchSubmit} className="flex-1 min-w-[240px]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search email / page ID / reference"
              className="w-full h-10 pl-9 pr-9 bg-[#242B35] rounded-lg text-white text-xs placeholder:text-gray-500 outline-none"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </form>

        <PaymentStatusLegend variant="deposits" />

        <TransactionFilters
          values={filters}
          onApply={applyFilters}
          onReset={resetFilters}
        />

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#242B35] px-3 text-sm text-white hover:bg-[#2c3543] disabled:opacity-60"
          aria-label="Export to Excel"
        >
          {exporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
        </button>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto bg-[#15181E] rounded-lg">
        <table className="w-auto min-w-full text-xs">
          <thead className="bg-[#242B35] text-white">
            <tr>
              <th className="px-4 py-3 text-left whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Page ID</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Customer Email</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Total (incl. Tax)</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">Payment Method</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-16">
                  <div className="flex items-center justify-center text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16">
                  <NoData title="No transactions found" />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={`${row.flow}-${row.id}`}
                  onClick={() => {
                    setSelected(row);
                    setDrawerOpen(true);
                  }}
                  className={`cursor-pointer hover:bg-[#1f242e] ${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-blue-400 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {row.pageId ?? row.clientReferenceId}
                      <CopyButton
                        value={row.pageId ?? row.clientReferenceId}
                        size={12}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {row.customerEmail ?? "-"}
                      <CopyButton value={row.customerEmail} size={12} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {row.amount.toFixed(2)} {row.currency?.toUpperCase()}
                  </td>
                  {/* What the player was charged, tax and processor fees
                      included. Pay-outs have no such figure. */}
                  <td className="px-4 py-3 text-gray-300">
                    {row.totalWithTax != null
                      ? `${row.totalWithTax.toFixed(2)} ${row.currency?.toUpperCase() ?? ""}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full ${
                        STATUS_COLORS[row.status] ??
                        "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {(() => {
                      const provider = row.provider
                        ? row.provider.charAt(0).toUpperCase() +
                          row.provider.slice(1)
                        : "—";
                      if (!row.paymentType) return provider;
                      return `${provider} (${row.paymentType.toUpperCase()})`;
                    })()}
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

      <TransactionDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        row={selected}
      />
    </div>
  );
}
