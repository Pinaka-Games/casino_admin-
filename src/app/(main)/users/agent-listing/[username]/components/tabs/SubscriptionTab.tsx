"use client";

import React, { useEffect, useState, useMemo } from "react";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import Image from "next/image";
import { agentimage } from "@/assets/images/banner";
import { Wrench, Loader2 } from "lucide-react";
import { adminGetUserPackage, adminGetUserPackageHistory } from "@/api/package/admin-package.api";
import { AgentActivePackage, PackageTransaction } from "@/types/agent-package.types";
import { format, parseISO, addMonths, addYears } from "date-fns";


const PACKAGE_FILTER_DEFAULTS: FilterValues = {
  search: "",
  type: "all",
  status: "all",
  from: "",
  to: "",
  minAmount: "",
  maxAmount: "",
};

const PACKAGE_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "type",
    label: "Type",
    options: [
      { label: "All Types", value: "all" },
      { label: "Buy", value: "BUY" },
      { label: "Upgrade", value: "UPGRADE" },
      { label: "Renew", value: "RENEW" },
      { label: "Cancel", value: "CANCEL" },
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
const SubscriptionTab = ({ userId }: { userId: string }) => {
  const [activePackage, setActivePackage] = useState<AgentActivePackage | null>(null);
  const [history, setHistory] = useState<PackageTransaction[]>([]);
  const [loading, setLoading] = useState(true);

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
    fields: PACKAGE_FILTER_FIELDS,
    defaults: PACKAGE_FILTER_DEFAULTS,
  });

  const visibleHistory = useMemo(
    () =>
      applyClientFilters(history, filters, {
        search: (row) => [row.type, row.status, row.currency, row.id],
        selects: [
          { key: "type", match: (row, v) => row.type === v },
          { key: "status", match: (row, v) => row.status === v },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (row) => row.createdAt },
        numberRanges: [
          { minKey: "minAmount", maxKey: "maxAmount", get: (row) => Number(row.amount || 0) },
        ],
      }),
    [history, filters],
  );

  useEffect(() => {
    if (!userId) return;
    
    setLoading(true);
    Promise.all([
      adminGetUserPackage(userId).catch(() => null),
      adminGetUserPackageHistory(userId).catch(() => [])
    ]).then(([pkgRes, histRes]) => {
      setActivePackage(pkgRes);
      setHistory(histRes || []);
    }).finally(() => {
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
     return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B93DEB]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8">
      {/* ================= SUBSCRIPTION CARD ================= */}
      <div className="bg-[#242B35] rounded-xl p-4 flex flex-col items-stretch gap-4 md:p-8 md:flex-row md:justify-between md:items-center md:gap-0">
        {/* LEFT */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 shrink-0 rounded-full bg-purple-500/20 flex items-center justify-center md:w-24 md:h-24">
            <Image
              src={activePackage?.package?.iconUrl || agentimage}
              alt="Agent"
              width={64}
              height={64}
              className="object-contain relative z-10"
            />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <p className="text-white text-lg font-semibold md:text-2xl">
                {activePackage ? activePackage.package?.name : "Free / Base"}
              </p>
            </div>
            {activePackage && activePackage.package?.interval && (
               <p className="text-xs text-gray-400 mt-1 capitalize">{activePackage.package.interval.toLowerCase()} Plan</p>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="text-left md:text-right">
          {activePackage ? (
            <>
              {(() => {
                const isActive =
                  activePackage.isActive ||
                  activePackage.autoRenew ||
                  (activePackage.endDate
                    ? new Date(activePackage.endDate) > new Date()
                    : false);
                return (
                  <p className={`font-medium ${isActive ? "text-green-400" : "text-red-400"}`}>
                    {isActive ? "Active" : "Inactive"}
                  </p>
                );
              })()}
              {/* <p className="text-gray-400 text-sm mt-1">
                Active till:{" "}
                <span className="text-white">
                  {activePackage.endDate
                    ? format(parseISO(activePackage.endDate), "dd MMM yyyy")
                    : activePackage.autoRenew && activePackage.startDate
                    ? format(
                        activePackage.package?.interval === "YEARLY"
                          ? addYears(parseISO(activePackage.startDate), 1)
                          : addMonths(parseISO(activePackage.startDate), 1),
                        "dd MMM yyyy"
                      )
                    : "N/A"}
                </span>
              </p> */}
              {/* {activePackage.autoRenew && (
                <p className="text-xs text-blue-400 mt-1">Auto-renew on</p>
              )} */}
            </>
          ) : (
            <p className="text-gray-500 font-medium">No Paid Package</p>
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
          searchPlaceholder="Search type, status or id"
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          onResetAll={resetFilters}
        />

        <div className="overflow-x-auto rounded-lg bg-[#15181E]">
          <table className="w-full min-w-[640px] table-fixed">
            {/* HEADERS */}
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-center text-white text-xs">
                  Date
                </th>
                <th className="px-4 py-3 text-center text-white text-xs">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-white text-xs">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-white text-xs">
                  Status
                </th>
                {/* <th className="px-4 py-3 text-center text-white text-xs">
                  Action
                </th> */}
              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {visibleHistory.length > 0 ? visibleHistory.map((row, index) => (
                <tr
                  key={row.id || index}
                  className={`hover:bg-[#1a2030] ${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.createdAt ? format(parseISO(row.createdAt), "dd MMM yyyy hh:mm a") : "N/A"}
                  </td>

                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    Package {row.type}
                  </td>

                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.amount}
                  </td>

                  <td className={`px-4 py-4 text-center text-xs font-medium ${row.status === 'SUCCESS' ? 'text-green-400' : row.status === 'FAILED' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {row.status}
                  </td>

                  {/* <td className="px-4 py-4 text-center">
                    <button className="text-orange-400 hover:text-orange-300 transition-colors">
                      <Wrench size={16} />
                    </button>
                  </td> */}
                </tr>
              )) : (
                 <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">
                       No package activity found.
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Package Filters"
        description="Filter this agent's package activity"
        fields={PACKAGE_FILTER_FIELDS}
        values={filters}
        defaults={PACKAGE_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default SubscriptionTab;
