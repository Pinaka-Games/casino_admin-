"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import NoData from "@/components/NoData";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import AmlAlertDetailsModal from "../components/AmlAlertDetailsModal";
import { useAmlAlertsStore } from "@/store/aml-alerts-store";
import { useClearSearchOnLeave } from "@/hooks/use-clear-search-on-leave";
import CopyButton from "@/components/CopyButton";

function formatDate(value: string | null | undefined): string {
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

const severityBadge = (value: string) => {
  const styles: Record<string, string> = {
    HIGH: "bg-red-500/20 text-red-400",
    MEDIUM: "bg-yellow-500/20 text-yellow-400",
    LOW: "bg-blue-500/20 text-blue-400",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[value] || "bg-gray-500/20 text-gray-400"}`}>
      {value}
    </span>
  );
};

const statusBadge = (value: string) => {
  const styles: Record<string, string> = {
    OPEN: "bg-blue-500/20 text-blue-400",
    IN_PROGRESS: "bg-yellow-500/20 text-yellow-400",
    FALSE_POSITIVE: "bg-gray-500/20 text-gray-300",
    CLOSED: "bg-green-500/20 text-green-400",
    ESCALATED: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[value] || "bg-gray-500/20 text-gray-400"}`}>
      {value}
    </span>
  );
};

export default function AmlAlertsPage() {
  const {
    rows,
    total,
    currentPage,
    pageSize,
    isLoading,
    isDetailsLoading,
    error,
    filters,
    selected,
    fetchList,
    applyFilters,
    setPage,
    setFilter,
    fetchDetails,
    setSelected,
    clearError,
  } = useAmlAlertsStore();

  // Search text lives in a module-level store, so it survives navigation —
  // clear it on the way out or the next visit opens pre-filtered.
  useClearSearchOnLeave(() =>
    useAmlAlertsStore.setState((s) => ({ filters: { ...s.filters, search: "" } })),
  );
  const [openDetails, setOpenDetails] = useState(false);
  const prevSearchRef = useRef(filters.search);

  useEffect(() => {
    void fetchList({ page: 1, limit: pageSize });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Clear-search auto-refetch (mirrors the SEON risk listing behaviour).
  useEffect(() => {
    const prev = prevSearchRef.current;
    prevSearchRef.current = filters.search;
    if (prev !== "" && filters.search.trim() === "") {
      const timer = setTimeout(() => void applyFilters(), 250);
      return () => clearTimeout(timer);
    }
  }, [filters.search, applyFilters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setPage(totalPages);
  }, [currentPage, setPage, totalPages]);

  const handleView = async (id: string) => {
    const details = await fetchDetails(id);
    if (details) setOpenDetails(true);
  };

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-120">
        <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden relative">
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg">
        <h1 className="text-base font-normal text-white">Compliance / AML Alerts</h1>
      </div>

      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <Input
            placeholder="Search user / summary / source..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void applyFilters();
            }}
            className="bg-[#242B35]! text-white placeholder:text-gray-500 text-sm pl-4"
          />
        </div>

        <select
          value={filters.severity}
          onChange={(e) => {
            setFilter("severity", e.target.value);
            void applyFilters();
          }}
          className="bg-[#1a2030] border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
        >
          <option value="">All severity</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => {
            setFilter("status", e.target.value);
            void applyFilters();
          }}
          className="bg-[#1a2030] border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
        >
          <option value="">All status</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="FALSE_POSITIVE">False Positive</option>
          <option value="CLOSED">Closed</option>
          <option value="ESCALATED">Escalated</option>
        </select>

        <ExportCSV
          data={rows}
          fileName="aml_alerts.csv"
          headers={["ID", "Date", "Source", "Severity", "Status", "User", "Summary", "Assigned To"]}
          mapRow={(row) => [
            row.id,
            formatDate(row.createdAt),
            row.sourceType,
            row.severity,
            row.status,
            row.userIdentifier || "-",
            row.summary || "-",
            row.assignedTo || "-",
          ]}
        />
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#242B35] sticky top-0 z-10">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-white text-xs w-[190px]">Date</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[150px]">Source</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[100px]">Severity</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[130px]">Status</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[200px]">User</th>
              <th className="px-4 py-3 text-left text-white text-xs">Summary</th>
              <th className="px-4 py-3 text-left text-white text-xs w-[130px]">Assigned</th>
              <th className="px-4 py-3 text-center text-white text-xs w-[80px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16">
                  <NoData title="No AML alerts found" />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}
                >
                  <td className="px-4 py-3 text-gray-300 text-xs">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">{row.sourceType}</td>
                  <td className="px-4 py-3 text-xs">{severityBadge(row.severity)}</td>
                  <td className="px-4 py-3 text-xs">{statusBadge(row.status)}</td>
                  <td
                    className="px-4 py-3 text-gray-300 text-xs truncate"
                    title={row.userIdentifier || "-"}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{row.userIdentifier || "-"}</span>
                      <CopyButton value={row.userIdentifier} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate" title={row.summary || "-"}>
                    {row.summary || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">
                    {row.assignedTo || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleView(row.id)}
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

      {/* Outside the scroller, so the pager stays put while the rows scroll. */}
      {totalPages > 1 && (
        <div className="shrink-0 pt-4">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <AmlAlertDetailsModal
        open={openDetails}
        data={selected}
        onClose={() => {
          setOpenDetails(false);
          setSelected(null);
        }}
      />
    </div>
  );
}
