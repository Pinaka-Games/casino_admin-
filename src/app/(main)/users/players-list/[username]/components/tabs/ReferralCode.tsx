"use client";

import { useEffect, useState, useMemo } from "react";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import TableSkeleton from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import { Eye, Loader2, Copy } from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import { profileApi } from "@/api/users/users";
import { ReferralStats, ReferralDetail } from "@/types/profile.type";
import { ReferralDetails } from "../../../../components/ReferralDetails";

const REFERRAL_FILTER_DEFAULTS: FilterValues = {
  search: "",
  earning: "all",
  from: "",
  to: "",
  minWagered: "",
  maxWagered: "",
  minIncome: "",
  maxIncome: "",
};

const REFERRAL_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "earning",
    label: "Income",
    options: [
      { label: "All Referrals", value: "all" },
      { label: "Earning (positive)", value: "positive" },
      { label: "Costing (negative)", value: "negative" },
      { label: "No income yet", value: "zero" },
    ],
    hint: "Income goes negative when a referral wins.",
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Joined Between" },
  { type: "numberRange", minKey: "minWagered", maxKey: "maxWagered", label: "Total Wagered" },
  { type: "numberRange", minKey: "minIncome", maxKey: "maxIncome", label: "Total Income" },
];

export default function ReferralCode({ username }: { username: string }) {
  const [data, setData] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDetailsModal, setOpenDetailsModal] = useState(false);
  const [selectedDetailUser, setSelectedDetailUser] = useState<any>(null);

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
    fields: REFERRAL_FILTER_FIELDS,
    defaults: REFERRAL_FILTER_DEFAULTS,
  });

  const filteredReferrals = useMemo(
    () =>
      applyClientFilters(data?.referrals ?? [], filters, {
        search: (ref) => [ref.username, ref.email],
        selects: [
          {
            key: "earning",
            match: (ref, v) => {
              const income = Number(ref.totalIncome || 0);
              if (v === "positive") return income > 0;
              if (v === "negative") return income < 0;
              return income === 0;
            },
          },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (ref) => ref.joinedAt },
        numberRanges: [
          { minKey: "minWagered", maxKey: "maxWagered", get: (ref) => Number(ref.totalWagered || 0) },
          { minKey: "minIncome", maxKey: "maxIncome", get: (ref) => Number(ref.totalIncome || 0) },
        ],
      }),
    [data, filters]
  );

  const { sort, toggle } = useTableSort<"joined" | "wagered" | "ggr" | "income">();
  const visibleReferrals = useSortedRows(filteredReferrals, sort, {
    joined: (ref) => new Date(ref.joinedAt).getTime(),
    wagered: (ref) => Number(ref.totalWagered || 0),
    // Same fallback the cell renders, so the order matches the figures shown.
    ggr: (ref) => Number(ref.totalGgr ?? ref.totalLoss ?? 0),
    income: (ref) => Number(ref.totalIncome || 0),
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        // Assuming username here acts as the user ID for fetching referral stats
        const res = await profileApi.getAgentReferralStatsById(username);
        if (active) setData(res.data || null);
      } catch (err) {
        if (active) toast.error("Failed to load referral details");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40 bg-gray-700/40" />
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#15181E]">
          <TableSkeleton rows={5} cols={7} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#15181E] p-4 rounded-lg border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">Referral Code</p>
          {/* Support reads this out or pastes it into another system, so it
              gets the same copy control the contact fields use. */}
          <div className="flex items-center gap-2">
            <p className="text-white text-lg font-semibold">{data?.referralCode || "-"}</p>
            {data?.referralCode && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(data.referralCode);
                  toast.success("Copied");
                }}
                title="Copy referral code"
                className="shrink-0 cursor-pointer text-gray-500 transition-colors hover:text-purple-400"
              >
                <Copy size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="bg-[#15181E] p-4 rounded-lg border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">Total Referrals</p>
          <p className="text-white text-lg font-semibold">{data?.totalReferrals || 0}</p>
        </div>
        <div className="bg-[#15181E] p-4 rounded-lg border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">Total Earnings</p>
          <p className={`text-lg font-semibold ${Number(data?.totalEarnings || 0) < 0 ? "text-red-400" : "text-green-400"}`}>
            ${Number(data?.totalEarnings || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-[#15181E] p-4 rounded-lg border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">Pending Income</p>
          <p className="text-white text-lg font-semibold text-yellow-400">
            ${data?.pendingIncome?.toFixed(2) || "0.00"}
          </p>
        </div>
      </div>

      {/* Referrals Table */}
      <FilterToolbar
        title="Referrals"
        countLabel={`${visibleReferrals.length} ${visibleReferrals.length === 1 ? "referral" : "referrals"}`}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search username or email"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
        actions={
          <ExportCSV
            data={visibleReferrals}
            fileName="player_referrals.csv"
            headers={["Username", "Email", "Joined At", "Total Wagered", "GGR", "Total Income"]}
            getRowDate={(row) => row.joinedAt}
            mapRow={(row) => [
              row.username ?? "-",
              row.email ?? "-",
              row.joinedAt ? new Date(row.joinedAt).toLocaleString() : "-",
              Number(row.totalWagered || 0).toFixed(2),
              Number(row.totalGgr ?? row.totalLoss ?? 0).toFixed(2),
              Number(row.totalIncome || 0).toFixed(2),
            ]}
          />
        }
        onResetAll={resetFilters}
      />

      <div className="overflow-x-auto rounded-lg bg-[#15181E] scrollbar-hide border border-gray-800">
        <table className="w-full min-w-[760px]">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-white text-xs">Username</th>
              <th className="px-4 py-3 text-left text-white text-xs">Email</th>
              <SortableTh
                label="Joined At"
                sortKey="joined"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs"
              />
              <SortableTh
                label="Total Wagered"
                sortKey="wagered"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs"
              />
              <SortableTh
                label="GGR"
                sortKey="ggr"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs"
              />
              <SortableTh
                label="Total Income"
                sortKey="income"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs"
              />
              <th className="px-4 py-3 text-center text-white text-xs">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleReferrals.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16">
                  <NoData
                    title={
                      hasAnyFilter
                        ? "No referrals match these filters"
                        : "No referrals found for this user"
                    }
                  />
                </td>
              </tr>
            ) : (
              visibleReferrals.map((ref, idx) => (
                <tr key={idx} className="bg-[#191D24] hover:bg-[#1a2030] border-b border-gray-800 last:border-0">
                  <td className="px-4 py-3 text-gray-300 text-xs">{ref.username || "-"}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{ref.email || "-"}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {ref.joinedAt ? new Date(ref.joinedAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">${ref.totalWagered?.toFixed(2) || "0.00"}</td>
                  {/* GGR and income are signed — a referral who wins pushes both
                      negative. Same figures the player's referral page shows. */}
                  <td className={`px-4 py-3 text-xs ${Number(ref.totalGgr ?? ref.totalLoss ?? 0) < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    ${Number(ref.totalGgr ?? ref.totalLoss ?? 0).toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-xs ${Number(ref.totalIncome || 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                    ${Number(ref.totalIncome || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        setSelectedDetailUser({
                          id: ref.refereeId,
                          username: ref.username,
                          referralCode: ref.referralCode,
                          referredBy: data?.referralCode || "-",
                          createdAt: ref.joinedAt,
                          updatedAt: ref.joinedAt,
                          referralsCount: 0 // We might not have this, but pass 0 for now
                        });
                        setOpenDetailsModal(true);
                      }}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      <Eye size={18} className="mx-auto" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ReferralDetails
        open={openDetailsModal}
        onOpenChange={setOpenDetailsModal}
        user={selectedDetailUser}
      />

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Referral Filters"
        description="Filter this player's referrals"
        fields={REFERRAL_FILTER_FIELDS}
        values={filters}
        defaults={REFERRAL_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
}
