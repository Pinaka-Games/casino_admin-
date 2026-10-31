"use client";

import React, { useEffect, useState, useMemo } from "react";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import TableSkeleton from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import { agentimage } from "@/assets/images/banner";
import { Loader2, Wrench } from "lucide-react";
import api from "@/api/config/axios.config";
import NoData from "@/components/NoData";

interface SubscriptionPlan {
  name: string;
  iconUrl?: string;
}

interface UserSubscription {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  autoRenew: boolean;
  plan?: SubscriptionPlan;
  vipTier?: {
    name: string;
    badge?: string;
  };
}

import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";

const SUBSCRIPTION_FILTER_DEFAULTS: FilterValues = {
  search: "",
  type: "all",
  status: "all",
  from: "",
  to: "",
  minAmount: "",
  maxAmount: "",
};

const SUBSCRIPTION_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "type",
    label: "Type",
    options: [
      { label: "All Types", value: "all" },
      { label: "Buy", value: "BUY" },
      { label: "Upgrade", value: "UPGRADE" },
      { label: "Renew", value: "RENEW" },
    ],
  },
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Success", value: "SUCCESS" },
      { label: "Pending", value: "PENDING" },
      { label: "Failed", value: "FAILED" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
  { type: "numberRange", minKey: "minAmount", maxKey: "maxAmount", label: "Amount" },
];

interface SubscriptionTxn {
  id: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  planName?: string | null;
  fromPlanName?: string | null;
  toPlanName?: string | null;
  paymentMethod?: string | null;
}

const statusPillClass = (s: string) => {
  switch (s?.toUpperCase()) {
    case "SUCCESS":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "CANCELED":
    case "CANCEL":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "FAILED":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "PENDING":
      return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    default:
      return "bg-gray-500/15 text-gray-300 border-gray-500/30";
  }
};

const SubscriptionTab = ({ username }: { username: string }) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(
    null,
  );
  const [history, setHistory] = useState<SubscriptionTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    values: filters,
    setValues: setFilters,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset: resetFilters,
  } = useEntityFilters({
    fields: SUBSCRIPTION_FILTER_FIELDS,
    defaults: SUBSCRIPTION_FILTER_DEFAULTS,
  });

  // A CANCEL row is bookkeeping, not a purchase, so it never reaches the table.
  const filteredHistory = useMemo(
    () =>
      applyClientFilters(
        history.filter((row) => row.type?.toUpperCase() !== "CANCEL"),
        filters,
        {
          search: (row) => [
            row.planName,
            row.fromPlanName,
            row.toPlanName,
            row.paymentMethod,
            row.status,
            row.type,
          ],
          selects: [
            { key: "type", match: (row, v) => (row.type ?? "").toUpperCase() === v },
            { key: "status", match: (row, v) => (row.status ?? "").toUpperCase() === v },
          ],
          dateRange: { fromKey: "from", toKey: "to", get: (row) => row.createdAt },
          numberRanges: [
            { minKey: "minAmount", maxKey: "maxAmount", get: (row) => Number(row.amount || 0) },
          ],
        }
      ),
    [history, filters]
  );

  // The whole history arrives in one call, so sorting covers all of it.
  const { sort, toggle } = useTableSort<"date" | "amount" | "type" | "status">();
  const visibleHistory = useSortedRows(filteredHistory, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    amount: (row) => Number(row.amount) || 0,
    type: (row) => (row.type ?? "").toUpperCase(),
    status: (row) => (row.status ?? "").toUpperCase(),
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // The [username] route param is actually the user UUID
        const userId = username;

        // Fetch subscription and history in parallel
        const [subRes, histRes] = await Promise.allSettled([
          api.get(`/subscription/user/${userId}`),
          api.get(`/subscription/user/${userId}/history`),
        ]);

        if (subRes.status === "fulfilled") {
          setSubscription(subRes.value.data);
        }
        if (histRes.status === "fulfilled") {
          setHistory(histRes.value.data || []);
        }
      } catch (err: any) {
        console.error("Failed to fetch subscription data:", err);
        setError("Failed to load subscription data.");
      } finally {
        setLoading(false);
      }
    };

    if (username) fetchData();
  }, [username]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40 bg-gray-700/40" />
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#15181E]">
          <TableSkeleton rows={5} cols={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  const isActive = subscription?.status === "ACTIVE";

  // Priority for icons: plan iconUrl > VIP tier badge > default fallback
  const planIcon = subscription?.plan?.iconUrl || subscription?.vipTier?.badge || agentimage;

  return (
    <div className="space-y-5 md:space-y-8">
      {/* ================= SUBSCRIPTION CARD ================= */}
      <div className="bg-[#242B35] rounded-xl p-4 md:p-8 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-between sm:items-center">
        {/* LEFT */}
        <div className="flex min-w-0 items-center gap-3 md:gap-5">
          <div className="w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full bg-purple-500/10 flex items-center justify-center overflow-hidden">
            <img
              src={typeof planIcon === 'string' ? planIcon : (planIcon as any).src}
              alt="Plan"
              className="w-full h-full object-cover"
              onError={(e: any) => {
                e.target.src = agentimage.src;
              }}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
              <p className="text-white text-xl md:text-2xl font-bold">
                {subscription?.plan?.name || "Basic"}
              </p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isActive
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {subscription?.status || "FREE"}
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              Subscribed on:{" "}
              <span className="text-white font-medium">
                {formatDate(subscription?.startsAt)}
              </span>
            </p>
            {/* {subscription?.autoRenew && (
              <p className="text-xs text-purple-400 mt-1">
                🔄 Auto-renew enabled
              </p>
            )} */}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-1 text-left sm:text-right sm:shrink-0">
          <p className="text-gray-400 text-sm">
            Active till:{" "}
            <span className="text-white font-medium">
              {formatDate(subscription?.endsAt)}
            </span>
          </p>
          {!subscription?.endsAt && (
            <p className="text-gray-500 text-xs whitespace-nowrap">No expiry (free plan)</p>
          )}
        </div>
      </div>

      {/* ================= ACTIVITIES ================= */}
      <div>
        <FilterToolbar
          title="Activities"
          countLabel={`${visibleHistory.length} ${visibleHistory.length === 1 ? "record" : "records"}`}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search plan, method or status"
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          actions={
            <ExportCSV<SubscriptionTxn>
              data={visibleHistory}
              fileName="subscription_activities.csv"
              headers={["Date", "Plan", "Type", "Amount", "Currency", "Payment Method", "Status"]}
              getRowDate={(row) => row.createdAt}
              mapRow={(row) => [
                formatDate(row.createdAt),
                row.toPlanName || row.planName || "-",
                row.type || "-",
                Number(row.amount || 0).toFixed(2),
                row.currency || "-",
                row.paymentMethod || "-",
                row.status || "-",
              ]}
            />
          }
          onResetAll={resetFilters}
        />

        <div className="rounded-lg bg-[#15181E] overflow-x-auto">
          <table className="w-full min-w-[720px] table-auto">
            {/* HEADERS */}
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <SortableTh
                label="Date"
                sortKey="date"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs whitespace-nowrap"
              />
                <th className="px-4 py-3 text-left text-white text-xs whitespace-nowrap">
                  Plan
                </th>
                <SortableTh
                label="Type"
                sortKey="type"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs whitespace-nowrap"
              />
                <SortableTh
                label="Amount"
                sortKey="amount"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs whitespace-nowrap"
              />
                <th className="px-4 py-3 text-left text-white text-xs whitespace-nowrap">
                  Payment Method
                </th>
                <SortableTh
                label="Status"
                sortKey="status"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs whitespace-nowrap"
              />
              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {visibleHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <NoData
                      title={
                        hasAnyFilter
                          ? "No records match these filters"
                          : "No subscription history found"
                      }
                    />
                  </td>
                </tr>
              ) : (
                visibleHistory
                  .map((row: SubscriptionTxn, index: number) => {
                    const upper = row.type?.toUpperCase();
                    const amountNum = Number(row.amount || 0);
                    const typeBadge =
                      upper === "UPGRADE"
                        ? "Buy (Upgrade)"
                        : upper === "RENEW"
                          ? "Buy (Renew)"
                          : "Buy";
                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-[#1a2030] ${
                          index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                        }`}
                      >
                        <td className="px-4 py-4 text-left text-xs text-gray-300 whitespace-nowrap">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-left text-xs text-white whitespace-nowrap">
                          {upper === "UPGRADE" && row.fromPlanName && row.toPlanName ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-[#C05CFF]">{row.toPlanName}</span>
                              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                                from {row.fromPlanName}
                              </span>
                            </div>
                          ) : (
                            row.toPlanName || row.planName || "—"
                          )}
                        </td>
                        <td className="px-4 py-4 text-left text-xs text-gray-300 whitespace-nowrap">
                          {typeBadge}
                        </td>
                        <td className="px-4 py-4 text-left text-xs text-gray-300 whitespace-nowrap">
                          {amountNum > 0 ? `${row.currency} ${amountNum.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-4 text-left text-xs text-gray-300 whitespace-nowrap">
                          {row.paymentMethod ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-left whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusPillClass(row.status)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Subscription Filters"
        description="Filter this player's subscription activity"
        fields={SUBSCRIPTION_FILTER_FIELDS}
        values={filters}
        defaults={SUBSCRIPTION_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default SubscriptionTab;
