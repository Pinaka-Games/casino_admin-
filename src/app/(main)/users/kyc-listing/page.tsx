"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Flag,
  Loader2,
  Lock,
  LockOpen,
  Settings,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import KycLockSettingsModal from "./components/KycLockSettingsModal";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import NoData from "@/components/NoData";
import CopyButton from "@/components/CopyButton";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import toast from "react-hot-toast";

import { useKycStore } from "@/store/kyc-store";
import { useClearSearchOnLeave } from "@/hooks/use-clear-search-on-leave";
import type { AdminKycRow } from "@/api/kyc/kyc.admin.api";
import {
  getKycDetails,
  listKycProfiles,
  unlockUserKyc,
} from "@/api/kyc/kyc.admin.api";
import KYCDetailsModal from "../components/KYCDetailsModal";

const KYC_FILTER_DEFAULTS: FilterValues = {
  search: "",
  status: "all",
  level: "all",
  flagged: "all",
  from: "",
  to: "",
};

const KYC_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "status",
    label: "Status",
    // The only filter the list endpoint understands, so it is the one that
    // narrows the whole dataset rather than the page on screen.
    hint: "Applied across every page.",
    options: [
      { label: "All Status", value: "all" },
      { label: "Approved", value: "APPROVED" },
      { label: "Pending Review", value: "PENDING_REVIEW" },
      { label: "Rejected", value: "REJECTED" },
      { label: "In Progress", value: "IN_PROGRESS" },
      { label: "Not Started", value: "NOT_STARTED" },
    ],
  },
  {
    type: "select",
    key: "level",
    label: "Level",
    hint: "Narrows the rows currently loaded.",
    options: [
      { label: "All Levels", value: "all" },
      { label: "id-and-liveness", value: "id-and-liveness" },
      { label: "Done by Admin", value: "Done by Admin" },
    ],
  },
  {
    type: "select",
    key: "flagged",
    label: "Admin approved",
    hint: "The flag shown beside the status badge.",
    options: [
      { label: "Any", value: "all" },
      { label: "Flagged", value: "yes" },
      { label: "Not flagged", value: "no" },
    ],
  },
  {
    type: "dateRange",
    fromKey: "from",
    toKey: "to",
    label: "Updated Between",
    hint: "Narrows the rows currently loaded.",
  },
];

export default function UserAgentListing() {
  const {
    rows,
    total,
    currentPage,
    pageSize,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    fetchKycList,
    setPage,
    setSearch,
    setStatusFilter,
    clearError,
  } = useKycStore();

  // Search text lives in a module-level store, so it survives navigation —
  // clear it on the way out or the next visit opens pre-filtered.
  useClearSearchOnLeave(() =>
    useKycStore.setState({ searchQuery: "", currentPage: 1 }),
  );

  const {
    values: filters,
    setValues: setFilters,
    searchInput: localSearch,
    setSearchInput: setLocalSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset: resetFilters,
  } = useEntityFilters({
    fields: KYC_FILTER_FIELDS,
    defaults: KYC_FILTER_DEFAULTS,
  });
  const [openDetailsModal, setOpenDetailsModal] = useState(false);
  const [lockSettingsOpen, setLockSettingsOpen] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState<AdminKycRow | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<AdminKycRow | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  /* ------------------ INITIAL FETCH ------------------ */
  useEffect(() => {
    fetchKycList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------ ERROR HANDLING ------------------ */
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  /* ------------------ LIVE (DEBOUNCED) SEARCH ON EVERY KEYSTROKE ------------------ */
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(localSearch.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, setSearch]);

  useEffect(() => {
    const next = filters.status === "all" ? "" : filters.status;
    if (next !== statusFilter) setStatusFilter(next);
  }, [filters.status, statusFilter, setStatusFilter]);

  /* ------------------ VIEW DETAILS ------------------ */
  const handleViewDetails = async (kycId: string) => {
    setLoadingDetails(true);
    try {
      const details = await getKycDetails(kycId);
      setSelectedKyc(details);
      setOpenDetailsModal(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load KYC details");
    } finally {
      setLoadingDetails(false);
    }
  };

  /* ------------------ UNBLOCK (KYC-DEADLINE LOCK) ------------------ */
  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setUnblocking(true);
    try {
      await unlockUserKyc(unblockTarget.userId);
      toast.success("Account unblocked");
      setUnblockTarget(null);
      fetchKycList();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to unblock account");
    } finally {
      setUnblocking(false);
    }
  };

  /* ------------------ STATUS BADGE ------------------ */
  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      APPROVED: {
        label: "Approved",
        className: "bg-green-500/20 text-green-400",
      },
      PENDING_REVIEW: {
        label: "Pending",
        className: "bg-yellow-500/20 text-yellow-400",
      },
      REJECTED: { label: "Rejected", className: "bg-red-500/20 text-red-400" },
      IN_PROGRESS: {
        label: "In Progress",
        className: "bg-blue-500/20 text-blue-400",
      },
      NOT_STARTED: {
        label: "Not Started",
        className: "bg-gray-500/20 text-gray-400",
      },
    };

    const config = map[status] || {
      label: status,
      className: "bg-gray-500/20 text-gray-400",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  /* ------------------ FORMAT LAST EVENT ------------------ */
  const formatLastEvent = (lastEvent: any) => {
    if (!lastEvent) return "-";
    if (typeof lastEvent === "object" && lastEvent.type) return lastEvent.type;
    if (typeof lastEvent === "string")
      return lastEvent.length > 30 ? lastEvent.slice(0, 30) + "..." : lastEvent;

    const str = JSON.stringify(lastEvent);
    return str.length > 30 ? str.slice(0, 30) + "..." : str;
  };

  /* ------------------ CLIENT-SIDE NARROWING ------------------ */
  // Search and Status are answered by the server; these three refine the page
  // that came back, which is why their sheet fields say so.
  const filteredRows = useMemo(
    () =>
      applyClientFilters(rows, filters, {
        selects: [
          { key: "level", match: (row, v) => (row.levelName || "") === v },
          {
            key: "flagged",
            match: (row, v) => (v === "yes") === Boolean(row.isAdminApproved),
          },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (row) => row.updatedAt },
      }),
    [rows, filters],
  );

  const { sort, toggle } = useTableSort<"level" | "updated" | "status">();
  const visibleRows = useSortedRows(filteredRows, sort, {
    level: (row) => row.levelName || "",
    updated: (row) => new Date(row.updatedAt).getTime(),
    status: (row) => row.status,
  });

  const totalPages = useMemo(
    () => Math.ceil(total / pageSize),
    [total, pageSize],
  );


  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden relative">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg">
        <h1 className="text-base font-normal text-white">User / KYC Listing</h1>
      </div>

      {/* TOP BAR */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-4 shrink-0">
        <FilterToolbar
          className="mb-0"
          searchValue={localSearch}
          onSearchChange={setLocalSearchInput}
          searchPlaceholder="Search by entity, user ID..."
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          onResetAll={resetFilters}
          actions={
          <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLockSettingsOpen(true)}
            title="KYC settings — account lock and profile vs document"
            className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <ExportCSV
            data={rows}
            fileName="kyc_list.csv"
            getRowDate={(row) => row.createdAt}
            fetchAll={async (range) => {
              // Pull the COMPLETE matching dataset (all pages), not just the
              // current page, replicating the active search + status filters.
              const EXPORT_LIMIT = 500;
              const all: AdminKycRow[] = [];
              let page = 1;
              for (let i = 0; i < 100; i++) {
                const res = await listKycProfiles({
                  page,
                  limit: EXPORT_LIMIT,
                  search: searchQuery,
                  status: statusFilter,
                });
                all.push(...res.rows);
                if (all.length >= res.total || res.rows.length === 0) break;
                page += 1;
              }
              // The KYC list API has no date params, so apply the popover
              // range client-side over the full result set.
              if (!range.from && !range.to) return all;
              return all.filter((row) => {
                const t = new Date(row.createdAt).getTime();
                if (Number.isNaN(t)) return false;
                if (range.from && t < range.from.getTime()) return false;
                if (range.to && t > range.to.getTime()) return false;
                return true;
              });
            }}
            headers={[
              "KYC ID",
              "User ID",
              "Entity",
              "Status",
              "Level Name",
              "Applicant ID",
              "Last Event",
              "Created At",
              "Updated At",
            ]}
            mapRow={(row) => [
              row.id,
              row.userId,
              row.user?.entity || "-",
              row.status,
              row.levelName || "-",
              row.applicantId || "-",
              row.lastEvent ? JSON.stringify(row.lastEvent) : "-",
              new Date(row.createdAt).toLocaleString(),
              new Date(row.updatedAt).toLocaleString(),
            ]}
          />
          </>
          }
        />
      </div>

      <KycLockSettingsModal
        open={lockSettingsOpen}
        onOpenChange={setLockSettingsOpen}
      />

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="KYC Filters"
        description="Status searches every page; the rest narrow the rows on screen."
        fields={KYC_FILTER_FIELDS}
        values={filters}
        defaults={KYC_FILTER_DEFAULTS}
        onApply={setFilters}
      />

      {/* TABLE */}
      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] relative">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#242B35] sticky top-0 z-10">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-white text-xs w-[110px]">
                User ID
              </th>
              <th className="px-4 py-3 text-left text-white text-xs w-[200px]">
                Entity
              </th>
              <SortableTh
                label="Level Name"
                sortKey="level"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs w-[150px]"
              />
              <th className="px-4 py-3 text-left text-white text-xs w-[180px]">
                Last Event
              </th>
              <SortableTh
                label="Updated At"
                sortKey="updated"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs w-[160px]"
              />
              <SortableTh
                label="Status"
                sortKey="status"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-left text-white text-xs w-[120px]"
              />
              <th className="px-4 py-3 text-center text-white text-xs w-[70px]">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr
                  key={`skeleton-${i}`}
                  className={i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}
                >
                  {Array.from({ length: 7 }).map((__, c) => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-3 w-full max-w-[140px] rounded bg-gray-700/40 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16">
                  <NoData
                    title={
                      hasAnyFilter
                        ? "No KYC profiles match these filters"
                        : "No KYC data found"
                    }
                  />
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[#1a2030] ${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  <td className="px-4 py-3 text-gray-300 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span>{row.userId?.slice?.(0, 8) || "-"}...</span>
                      <CopyButton value={row.userId} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{row.user?.entity || "-"}</span>
                      <CopyButton value={row.user?.entity} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">
                    {row.levelName || "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-gray-300 text-xs truncate"
                    title={row.lastEvent ? JSON.stringify(row.lastEvent) : "-"}
                  >
                    {formatLastEvent(row.lastEvent)}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {getStatusBadge(row.status)}
                      {row.isAdminApproved && (
                        <span className="relative group inline-flex items-center">
                          <Flag
                            size={14}
                            className="text-purple-400 fill-purple-400/40 cursor-pointer"
                          />
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-[#0b0f14] px-2 py-1 text-[11px] font-medium text-purple-200 border border-purple-500/40 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                            Approved by admin
                          </span>
                        </span>
                      )}
                      {/* Profile disagrees with the document. Admin-only: the
                          status above is Sumsub's own decision either way. */}
                      {(row.identityVerdict === "NAME_MISMATCH" ||
                        row.identityVerdict === "DOB_MISMATCH" ||
                        row.identityVerdict === "GENDER_MISMATCH") && (
                        <span
                          className="inline-flex items-center"
                          title={
                            row.identityVerdict === "NAME_MISMATCH"
                              ? "Identity flag: the name on the document does not match the profile"
                              : row.identityVerdict === "DOB_MISMATCH"
                                ? "Identity flag: date of birth differs from the document"
                                : "Identity flag: gender differs from the document"
                          }
                        >
                          <ShieldAlert
                            size={14}
                            className={
                              row.identityVerdict === "NAME_MISMATCH"
                                ? "text-red-400"
                                : "text-amber-400"
                            }
                          />
                        </span>
                      )}
                      {row.user?.kycLockedAt && (
                        <span
                          className="inline-flex items-center"
                          title={`Blocked for missing the KYC deadline (${new Date(
                            row.user.kycLockedAt,
                          ).toLocaleString()})`}
                        >
                          <Lock size={14} className="text-red-400" />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-purple-400 hover:text-purple-300">
                          <Wrench size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[#1a2030] text-white p-2"
                      >
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem
                          disabled={loadingDetails}
                          onClick={() => handleViewDetails(row.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        {row.user?.kycLockedAt && (
                          <DropdownMenuItem
                            onClick={() => setUnblockTarget(row)}
                          >
                            <LockOpen className="mr-2 h-4 w-4" />
                            Unblock
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      <AlertDialog
        open={!!unblockTarget}
        onOpenChange={(o) => {
          if (!o && !unblocking) setUnblockTarget(null);
        }}
      >
        <AlertDialogContent className="bg-[#15181E] text-white border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock account?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              <span className="text-white">
                {unblockTarget?.user?.entity || unblockTarget?.userId}
              </span>{" "}
              was blocked for not completing KYC in time. Unblocking lets them
              sign in again without approving KYC, and restarts their KYC grace
              period from now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={unblocking}
              className="bg-[#242B35] border-gray-700 text-white hover:bg-[#2c3441] hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleUnblock}
              disabled={unblocking}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {unblocking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Unblock
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KYCDetailsModal
        open={openDetailsModal}
        data={selectedKyc}
        onClose={() => {
          setOpenDetailsModal(false);
          setSelectedKyc(null);
        }}
      />
    </div>
  );
}
