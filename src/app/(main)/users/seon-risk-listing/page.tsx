"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Eye, Loader2, Settings, Power, Filter } from "lucide-react";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import NoData from "@/components/NoData";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SeonRiskDetailsModal from "../components/SeonRiskDetailsModal";
import SeonConfigModal from "../components/SeonConfigModal";
import SeonControlsModal from "../components/SeonControlsModal";
import SeonRiskFilterSheet, {
  type DecisionFilter,
  type SeonRiskFilterValues,
  type VpnFilter,
} from "../components/SeonRiskFilterSheet";
import { useSeonRiskStore } from "@/store/seon-risk-store";
import { useClearSearchOnLeave } from "@/hooks/use-clear-search-on-leave";
import { listSeonRiskDecisions, type SeonRiskDecisionRow } from "@/api/compliance";

/**
 * Render a stored timestamp in the viewer's local time. The backend stores UTC;
 * if the API returns a naive string (no timezone/offset), treat it as UTC so the
 * date AND time are correct instead of being off by the local offset.
 */
function formatSeonDate(value: string | null | undefined): string {
  if (!value) return "-";
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const iso = hasZone ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function SeonRiskListingPage() {
  const {
    rows,
    total,
    currentPage,
    pageSize,
    isLoading,
    isDetailsLoading,
    error,
    filters,
    appliedFilters,
    selectedRisk,
    fetchSeonRiskList,
    applyFilters,
    setPage,
    setFilter,
    fetchSeonRiskDetails,
    setSelectedRisk,
    clearError,
  } = useSeonRiskStore();

  // Search text lives in a module-level store, so it survives navigation —
  // clear it on the way out or the next visit opens pre-filtered.
  useClearSearchOnLeave(() =>
    useSeonRiskStore.setState((s) => ({ filters: { ...s.filters, search: "" } })),
  );
  const [openDetailsModal, setOpenDetailsModal] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const prevSearchRef = useRef(filters.search);

  useEffect(() => {
    void fetchSeonRiskList({ page: 1, limit: pageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Live (debounced) search — refetch on every keystroke in the search box.
  const prevAppliedSearchRef = useRef(filters.search);
  useEffect(() => {
    if (prevAppliedSearchRef.current === filters.search) return;
    const timer = setTimeout(() => {
      prevAppliedSearchRef.current = filters.search;
      void applyFilters();
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search, applyFilters]);

  const handleApplyFilters = () => {
    void applyFilters();
    toast.success("Filters applied");
  };

  const handleViewDetails = async (id: string) => {
    try {
      const details = await fetchSeonRiskDetails(id);
      if (!details) {
        toast.error("Risk decision not found");
        return;
      }
      setOpenDetailsModal(true);
    } catch {
      // Error toast is handled centrally through store error state.
    }
  };

  const sheetFilters = useMemo<SeonRiskFilterValues>(
    () => ({
      actionType: filters.actionType,
      decision: filters.decision as DecisionFilter,
      countryCode: filters.countryCode,
      vpn: filters.vpn as VpnFilter,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      scoreMin: filters.scoreMin,
      scoreMax: filters.scoreMax,
    }),
    [
      filters.actionType,
      filters.countryCode,
      filters.dateFrom,
      filters.dateTo,
      filters.decision,
      filters.scoreMax,
      filters.scoreMin,
      filters.vpn,
    ],
  );

  const handleApplySheetFilters = (nextFilters: SeonRiskFilterValues) => {
    setFilter("actionType", nextFilters.actionType);
    setFilter("decision", nextFilters.decision as DecisionFilter);
    setFilter("countryCode", nextFilters.countryCode);
    setFilter("vpn", nextFilters.vpn as VpnFilter);
    setFilter("dateFrom", nextFilters.dateFrom);
    setFilter("dateTo", nextFilters.dateTo);
    setFilter("scoreMin", nextFilters.scoreMin);
    setFilter("scoreMax", nextFilters.scoreMax);
    handleApplyFilters();
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setPage(totalPages);
    }
  }, [currentPage, setPage, totalPages]);

  const getDecisionBadge = (value: string) => {
    const styles: Record<string, string> = {
      ALLOW: "bg-green-500/20 text-green-400",
      BLOCK: "bg-red-500/20 text-red-400",
      STEP_UP: "bg-yellow-500/20 text-yellow-400",
    };
    // Display-only: SEON's states are ALLOW / REVIEW / BLOCK. Our enforcement calls
    // the middle state STEP_UP (OTP), but show it as REVIEW here to match SEON.
    const labels: Record<string, string> = {
      STEP_UP: "REVIEW",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[value] || "bg-gray-500/20 text-gray-400"}`}
      >
        {labels[value] || value}
      </span>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden relative">
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg">
        <h1 className="text-base font-normal text-white">User / SEON Risk Listing</h1>
      </div>

      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <Input
            placeholder="Search user/IP/action..."
            value={filters.search}
            onChange={(event) => setFilter("search", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleApplyFilters();
              }
            }}
            className="bg-[#242B35]! text-white placeholder:text-gray-500 text-sm pl-4"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setConfigOpen(true)}
          title="SEON settings"
          className="bg-[#1a2030] border-gray-700 hover:bg-[#242B35]"
        >
          <Settings size={20} className="text-purple-400" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setControlsOpen(true)}
          title="SEON controls (enable/disable per flow)"
          className="bg-[#1a2030] border-gray-700 hover:bg-[#242B35]"
        >
          <Power size={20} className="text-green-400" />
        </Button>

        <Button
          variant="outline"
          onClick={() => setFilterOpen(true)}
          className="gap-2 bg-[#1a2030] border-gray-700 text-white hover:bg-[#242B35] hover:text-white shrink-0"
        >
          <Filter size={18} className="text-[#B93DEB]" />
            Filters
        </Button>

        <ExportCSV
          data={rows}
          fileName="seon_risk_decisions.csv"
          getRowDate={(row) => row.createdAt}
          fetchAll={async (range) => {
            // Pull the COMPLETE matching dataset (all pages), not just the
            // current page. Popover range overrides the applied date filter.
            const dateFrom = range.from ? range.from.toISOString() : appliedFilters.dateFrom;
            const dateTo = range.to ? range.to.toISOString() : appliedFilters.dateTo;
            const EXPORT_LIMIT = 500;
            const all: SeonRiskDecisionRow[] = [];
            let page = 1;
            // Safety valve: cap at 100 pages (50k rows).
            for (let i = 0; i < 100; i++) {
              const res = await listSeonRiskDecisions({
                ...appliedFilters,
                page,
                limit: EXPORT_LIMIT,
                dateFrom,
                dateTo,
              });
              all.push(...res.rows);
              if (all.length >= res.total || res.rows.length === 0) break;
              page += 1;
            }
            return all;
          }}
          headers={[
            "ID",
            "Date",
            "Action Type",
            "Decision",
            "Reason",
            "User Identifier",
            "IP",
            "Country",
            "Score",
            "VPN/Proxy",
          ]}
          mapRow={(row) => [
            row.id,
            formatSeonDate(row.createdAt),
            row.actionType,
            row.decision,
            row.reason || "-",
            row.userIdentifier || "-",
            row.clientIp || "-",
            row.countryCode || "-",
            typeof row.score === "number" ? row.score : "-",
            typeof row.isVpnProxy === "boolean" ? String(row.isVpnProxy) : "-",
          ]}
        />
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide relative">
        <table className="w-full min-w-[1020px]">
          <thead className="bg-[#242B35] sticky top-0 z-10">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-white text-xs w-[190px] whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[140px]">Action</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[120px]">Decision</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[180px]">User</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[130px]">IP</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[80px]">Score</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[100px]">VPN</th>
              <th className="px-4 py-3 text-center text-white text-xs w-[80px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr
                  key={`skeleton-${i}`}
                  className={i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}
                >
                  {Array.from({ length: 8 }).map((__, c) => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-3 w-full max-w-[140px] rounded bg-gray-700/40 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16">
                  <NoData title="No SEON risk decisions found" />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}
                >
                  <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                    {formatSeonDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">{row.actionType}</td>
                  <td className="px-4 py-3 text-xs">{getDecisionBadge(row.decision)}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs" title={row.userIdentifier || "-"}>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{row.userIdentifier || "-"}</span>
                      <CopyButton value={row.userIdentifier} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{row.clientIp || "-"}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {typeof row.score === "number" ? row.score : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {typeof row.isVpnProxy === "boolean" ? (row.isVpnProxy ? "Yes" : "No") : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleViewDetails(row.id)}
                      disabled={isDetailsLoading}
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

      {/* Outside the scroller: the table is wider than the viewport now, so a
          pager inside it would slide away with the rows. */}
      {totalPages > 1 && (
        <div className="shrink-0 pt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <SeonRiskDetailsModal
        open={openDetailsModal}
        data={selectedRisk}
        onClose={() => {
          setOpenDetailsModal(false);
          setSelectedRisk(null);
        }}
      />

      <SeonConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />

      <SeonControlsModal open={controlsOpen} onClose={() => setControlsOpen(false)} />

      <SeonRiskFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={sheetFilters}
        onApply={handleApplySheetFilters}
      />
    </div>
  );
}
