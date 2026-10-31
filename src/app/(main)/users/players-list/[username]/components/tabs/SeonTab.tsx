"use client";

import { useEffect, useState, useMemo } from "react";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import TableSkeleton from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import SeonRiskDetailsModal from "../../../../components/SeonRiskDetailsModal";
import {
  listSeonRiskDecisions,
  getSeonRiskDecisionDetails,
  type SeonRiskDecisionRow,
} from "@/api/compliance/seon-risk.api";
import { profileApi } from "@/api/users/users";

const decisionBadge = (value: string) => {
  const styles: Record<string, string> = {
    ALLOW: "bg-green-500/20 text-green-400",
    BLOCK: "bg-red-500/20 text-red-400",
    STEP_UP: "bg-yellow-500/20 text-yellow-400",
  };
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[value] || "bg-gray-500/20 text-gray-400"}`}
    >
      {value === "STEP_UP" ? "REVIEW" : value}
    </span>
  );
};


const SEON_FILTER_DEFAULTS: FilterValues = {
  search: "",
  decision: "all",
  actionType: "all",
  vpn: "all",
  from: "",
  to: "",
  minScore: "",
  maxScore: "",
};

const SEON_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "decision",
    label: "Decision",
    options: [
      { label: "All Decisions", value: "all" },
      { label: "Allow", value: "ALLOW" },
      { label: "Block", value: "BLOCK" },
      { label: "Review", value: "STEP_UP" },
    ],
  },
  {
    type: "select",
    key: "actionType",
    label: "Action",
    options: [
      { label: "All Actions", value: "all" },
      { label: "Login", value: "login" },
      { label: "Registration", value: "registration" },
      { label: "Deposit", value: "deposit" },
      { label: "Redeem", value: "redeem" },
      { label: "KYC", value: "kyc" },
    ],
  },
  {
    type: "select",
    key: "vpn",
    label: "VPN / Proxy",
    options: [
      { label: "All", value: "all" },
      { label: "Yes", value: "true" },
      { label: "No", value: "false" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
  { type: "numberRange", minKey: "minScore", maxKey: "maxScore", label: "Risk Score" },
];

export default function SeonTab({ username }: { username: string }) {
  const [rows, setRows] = useState<SeonRiskDecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SeonRiskDecisionRow | null>(null);

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
    fields: SEON_FILTER_FIELDS,
    defaults: SEON_FILTER_DEFAULTS,
  });

  const filteredRows = useMemo(
    () =>
      applyClientFilters(rows, filters, {
        search: (row) => [row.actionType, row.decision, row.clientIp, row.countryCode, row.reason],
        selects: [
          { key: "decision", match: (row, v) => row.decision === v },
          { key: "actionType", match: (row, v) => (row.actionType ?? "").toLowerCase().includes(v) },
          { key: "vpn", match: (row, v) => String(Boolean(row.isVpnProxy)) === v },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (row) => row.createdAt },
        numberRanges: [
          { minKey: "minScore", maxKey: "maxScore", get: (row) => Number(row.score ?? 0) },
        ],
      }),
    [rows, filters]
  );

  const { sort, toggle } = useTableSort<"date" | "score">();
  const visibleRows = useSortedRows(filteredRows, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    score: (row) => Number(row.score ?? 0),
  });

  const [openModal, setOpenModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        // Older and pre-registration SEON checks are keyed by the account's
        // email/phone, while newer checks may use its UUID. Resolve all known
        // identifiers and merge the results so the player tab matches the
        // central SEON Risk Listing.
        const player = await profileApi.getUserProfile(username);
        const identifiers = [
          username,
          player.data?.id,
          player.data?.entity,
          player.data?.profile?.email,
          player.data?.profile?.phone,
        ].filter((value): value is string => Boolean(value?.trim()));

        const results = await Promise.all(
          [...new Set(identifiers.map((value) => value.trim()))].map((search) =>
            listSeonRiskDecisions({ search, page: 1, limit: 100 }),
          ),
        );
        const mergedRows = [...new Map(
          results.flatMap((result) => result?.rows || []).map((row) => [row.id, row]),
        ).values()];

        if (active) setRows(mergedRows);
      } catch {
        if (active) toast.error("Failed to load SEON decisions");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [username]);

  const handleView = async (id: string) => {
    try {
      setDetailLoading(true);
      const details = await getSeonRiskDecisionDetails(id);
      if (!details) {
        toast.error("Risk decision not found");
        return;
      }
      setSelected(details);
      setOpenModal(true);
    } catch {
      toast.error("Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  };

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
    <div className="space-y-3">
      <FilterToolbar
        title="SEON Risk Decisions"
        countLabel={`${visibleRows.length} ${visibleRows.length === 1 ? "decision" : "decisions"}`}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search action, IP or reason"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
        actions={
          <ExportCSV<SeonRiskDecisionRow>
            data={visibleRows}
            fileName="seon_decisions.csv"
            headers={["Date", "Action", "Decision", "IP", "Country", "Score", "VPN"]}
            getRowDate={(row) => row.createdAt}
            mapRow={(row) => [
              new Date(row.createdAt).toLocaleString(),
              row.actionType || "-",
              row.decision || "-",
              row.clientIp || "-",
              row.countryCode || "-",
              typeof row.score === "number" ? row.score : "-",
              row.isVpnProxy ? "Yes" : "No",
            ]}
          />
        }
        onResetAll={resetFilters}
      />

      <div className="overflow-x-auto rounded-lg bg-[#15181E] scrollbar-hide">
      <table className="w-full min-w-[760px]">
        <thead className="bg-[#242B35]">
          <tr className="border-b border-gray-800">
            <SortableTh
              label="Date"
              sortKey="date"
              sort={sort}
              onToggle={toggle}
              className="px-4 py-3 text-left text-white text-xs w-[190px]"
            />
            <th className="px-4 py-3 text-left text-white text-xs w-[140px]">Action</th>
            <th className="px-4 py-3 text-left text-white text-xs w-[120px]">Decision</th>
            <th className="px-4 py-3 text-left text-white text-xs w-[130px]">IP</th>
            <SortableTh
              label="Score"
              sortKey="score"
              sort={sort}
              onToggle={toggle}
              className="px-4 py-3 text-left text-white text-xs w-[80px]"
            />
            <th className="px-4 py-3 text-left text-white text-xs w-[100px]">VPN</th>
            <th className="px-4 py-3 text-center text-white text-xs w-[80px]">Details</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-16">
                <NoData
                  title={
                    hasAnyFilter
                      ? "No risk decisions match these filters"
                      : "No SEON risk decisions for this user"
                  }
                />
              </td>
            </tr>
          ) : (
            visibleRows.map((row, index) => (
              <tr
                key={row.id}
                className={`hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}
              >
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs truncate">{row.actionType}</td>
                <td className="px-4 py-3 text-xs">{decisionBadge(row.decision)}</td>
                <td className="px-4 py-3 text-gray-300 text-xs">{row.clientIp || "-"}</td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {typeof row.score === "number" ? row.score : "-"}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {typeof row.isVpnProxy === "boolean" ? (row.isVpnProxy ? "Yes" : "No") : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleView(row.id)}
                    disabled={detailLoading}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      <SeonRiskDetailsModal
        open={openModal}
        data={selected}
        onClose={() => {
          setOpenModal(false);
          setSelected(null);
        }}
      />

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="SEON Filters"
        description="Filter this player's risk decisions"
        fields={SEON_FILTER_FIELDS}
        values={filters}
        defaults={SEON_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
}
