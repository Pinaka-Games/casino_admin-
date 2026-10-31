"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useRouter } from "next/navigation";
import { referralApi } from "@/api/referral/referral.api";
import { profileApi } from "@/api/users/users";
import { Loader2, ChevronsUpDown, ChevronDown, ChevronUp, Trash2, Wrench, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/TableSearch/ListSearch";
import ExportCSV from "@/components/ExportCSV";
import { Switch } from "@/components/ui/switch";
import toast from "react-hot-toast";
import { usePresence, resolvePresence } from "@/hooks/use-presence";
import OnlineStatus, { formatOnlineStatus } from "@/components/OnlineStatus";

interface SubAgentRow {
  id: string;
  employeeId: string;
  username: string;
  email: string;
  referralCode: string;
  parentAgentUsername: string;
  parentAgentEmployeeId: string;
  createdAt: string;
  playersCount: number;
  ggr: number;
  isActive: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
}

const PAGE_SIZE = 10;


const SUBAGENT_LIST_DEFAULTS: FilterValues = {
  search: "",
  status: "all",
  online: "all",
  players: "all",
  from: "",
  to: "",
  minGgr: "",
  maxGgr: "",
};

const SUBAGENT_LIST_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "status",
    label: "Account Status",
    options: [
      { label: "All Accounts", value: "all" },
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
  },
  {
    type: "select",
    key: "players",
    label: "Players",
    options: [
      { label: "All Sub-Agents", value: "all" },
      { label: "Has players", value: "with" },
      { label: "No players yet", value: "without" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Created Between" },
  { type: "numberRange", minKey: "minGgr", maxKey: "maxGgr", label: "GGR" },
];
export default function SubAgentListingPage() {
  const router = useRouter();
  const [allSubAgents, setAllSubAgents] = useState<SubAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
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
    fields: SUBAGENT_LIST_FIELDS,
    defaults: SUBAGENT_LIST_DEFAULTS,
  });
  const [ggrSort, setGgrSort] = useState<"asc" | "desc" | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubAgentRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await referralApi.getSubAgents();
      const mapped = (response.data || []).map((item: any) => ({
        id: item.id,
        employeeId: item.employee?.id || item.employeeId || item.id,
        username: item.employee?.username || item.username || "-",
        email: item.employee?.email || item.email || "-",
        referralCode: item.referralCode || "-",
        parentAgentUsername:
          item.parentAgent?.employee?.username ||
          item.parentAgent?.referralCode ||
          "-",
        parentAgentEmployeeId: item.parentAgent?.employeeId || "",
        createdAt: item.createdAt || "",
        playersCount: item.playersCount || 0,
        ggr: item.ggr ?? 0,
        isActive: item.employee?.isActive ?? item.isActive ?? true,
        isOnline: Boolean(item.isOnline),
        lastSeenAt: item.lastSeenAt ?? null,
      }));
      setAllSubAgents(mapped);
    } catch {
      toast.error("Failed to load sub-agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Online Status updates live instead of only on a refresh. Presence is keyed
  // on the EMPLOYEE id — `row.id` here is the SubAgent record's own id.
  const presence = usePresence(load);
  const rowPresence = (row: SubAgentRow) =>
    resolvePresence(presence, row.employeeId, row);

  const handleStatusToggle = async (employeeId: string, nextIsActive: boolean) => {
    setUpdatingId(employeeId);
    try {
      await profileApi.updateUserProfile(employeeId, { isActive: nextIsActive });
      setAllSubAgents((prev) =>
        prev.map((s) =>
          s.employeeId === employeeId ? { ...s, isActive: nextIsActive } : s,
        ),
      );
      toast.success(nextIsActive ? "Account activated" : "Account deactivated");
    } catch {
      toast.error("Failed to update account status");
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmDelete = async () => {
    const row = deleteTarget;
    if (!row) return;
    try {
      setIsDeleting(true);
      await profileApi.deleteUserProfile(row.employeeId);
      setAllSubAgents((prev) => prev.filter((s) => s.id !== row.id));
      toast.success("Sub-agent deleted");
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to delete sub-agent");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGgrSort = () => {
    setGgrSort((prev) => (prev === "desc" ? "asc" : "desc"));
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    let list = applyClientFilters(allSubAgents, filters, {
      search: (row) => [
        row.username,
        row.email,
        row.referralCode,
        row.parentAgentUsername,
      ],
      selects: [
        { key: "status", match: (row, v) => row.isActive === (v === "active") },
        {
          key: "players",
          match: (row, v) =>
            v === "with" ? Number(row.playersCount) > 0 : Number(row.playersCount) === 0,
        },
      ],
      dateRange: { fromKey: "from", toKey: "to", get: (row) => row.createdAt },
      numberRanges: [
        { minKey: "minGgr", maxKey: "maxGgr", get: (row) => Number(row.ggr || 0) },
      ],
    });

    if (ggrSort) {
      const dir = ggrSort === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => dir * (a.ggr - b.ggr));
    }
    return list;
  }, [allSubAgents, filters, ggrSort]);

  // A narrowed filter can leave fewer pages than the one being viewed.
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const { sort, toggle } = useTableSort<"username" | "referrals" | "created">();
  const sortedRows = useSortedRows(filtered, sort, {
    username: (row) => row.username ?? "",
    referrals: (row) => Number(row.playersCount) || 0,
    created: (row) => new Date(row.createdAt).getTime(),
  });

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageData = sortedRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] px-3 py-3 rounded-lg flex items-center justify-between md:px-4">
        <h1 className="text-white text-base font-normal">
          User / Sub-Agent Listing
        </h1>
      </div>

      {/* SEARCH + EXPORT */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-3 mt-3 flex items-center gap-2 shrink-0 md:mb-4 md:mt-4">
        <div className="flex-1">
          <FilterToolbar
            className="mb-0"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search username, email, code or parent agent"
            activeCount={activeCount}
            chips={chips}
            hasAnyFilter={hasAnyFilter}
            onOpenFilters={() => setSheetOpen(true)}
            onResetAll={resetFilters}
          />
        </div>
        <ExportCSV
          data={filtered}
          fileName="sub_agent_listing.csv"
          getRowDate={(row) => row.createdAt}
          headers={[
            "Username",
            "Email",
            "Referral Code",
            "Parent Agent",
            "Total Referrals",
            "GGR",
            "Account Status",
            "Online Status",
            "Created",
          ]}
          mapRow={(row) => [
            row.username,
            row.email,
            row.referralCode,
            row.parentAgentUsername,
            row.playersCount,
            row.ggr.toFixed(2),
            row.isActive ? "Active" : "Inactive",
            formatOnlineStatus(rowPresence(row)),
            row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-",
          ]}
        />
      </div>

      {/* TABLE */}
      <div className="flex-1 flex flex-col rounded-lg bg-[#15181E] overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-hide">
          <table className="w-full min-w-[1080px] table-fixed">
            <thead className="bg-[#242B35] sticky top-0 z-10">
              <tr className="border-b border-gray-800">
                <SortableTh
                  label="User"
                  sortKey="username"
                  sort={sort}
                  onToggle={toggle}
                  className="px-4 py-3 text-left text-white text-xs"
                />
                <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">Email</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">Referral Code</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">Parent Agent</th>
                <SortableTh
                  label="Total Referrals"
                  sortKey="referrals"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-white text-xs"
                />
                <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">
                  <button
                    onClick={handleGgrSort}
                    className="flex items-center gap-1 hover:text-[#B93DEB] transition-colors"
                  >
                    GGR
                    {ggrSort === null && <ChevronsUpDown size={12} className="text-gray-400" />}
                    {ggrSort === "desc" && <ChevronDown size={12} className="text-[#B93DEB]" />}
                    {ggrSort === "asc" && <ChevronUp size={12} className="text-[#B93DEB]" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-white text-xs">Account Status</th>
                <th className="px-4 py-3 text-center text-white text-xs">Online Status</th>
                <SortableTh
                  label="Date"
                  sortKey="created"
                  sort={sort}
                  onToggle={toggle}
                  className="px-4 py-3 text-left text-white text-xs"
                />
                <th className="px-4 py-3 text-center text-white text-xs">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Loader2 className="animate-spin w-10 h-10 mx-auto text-purple-500" />
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16">
                    <NoData title="No sub-agents found" />
                  </td>
                </tr>
              ) : (
                pageData.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/users/agent-listing/${row.employeeId}?view=subagent`)}
                    className={`hover:bg-[#1a2030] cursor-pointer ${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.username}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.email}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.referralCode}
                    </td>
                    <td
                      className="px-4 py-3 text-xs truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.parentAgentEmployeeId ? (
                        <button
                          onClick={() =>
                            router.push(`/users/agent-listing/${row.parentAgentEmployeeId}`)
                          }
                          className="text-[#B93DEB] hover:underline truncate max-w-full text-left"
                        >
                          {row.parentAgentUsername}
                        </button>
                      ) : (
                        <span className="text-gray-400">{row.parentAgentUsername}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs text-center">
                      {row.playersCount}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span className={row.ggr >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {row.ggr >= 0 ? "+" : ""}
                        {row.ggr.toFixed(2)}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-center font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={row.isActive}
                          disabled={updatingId === row.employeeId}
                          onCheckedChange={(checked) =>
                            handleStatusToggle(row.employeeId, checked)
                          }
                          className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                        />
                        <span className={row.isActive ? "text-[#04AD37]" : "text-red-400"}>
                          {updatingId === row.employeeId
                            ? "Updating..."
                            : row.isActive
                              ? "Active"
                              : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <OnlineStatus {...rowPresence(row)} />
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs truncate">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-red-400 hover:text-orange-400">
                              <Wrench size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-[#1a2030] text-white border border-gray-700 p-2 min-w-[160px]"
                          >
                            <DropdownMenuLabel className="text-gray-400 text-xs px-2 py-1.5">
                              Actions
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-700 mx-1 my-1" />

                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/users/agent-listing/${row.employeeId}?view=subagent`,
                                )
                              }
                              className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-gray-700 mx-1 my-1" />

                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(row)}
                              className="text-sm text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 cursor-pointer rounded-md transition-colors"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="shrink-0 mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#15181E] rounded-2xl border border-gray-800 shadow-2xl p-4 md:p-6 space-y-4">
            <h2 className="text-white text-lg font-bold">Delete sub-agent?</h2>
            <p className="text-gray-400 text-sm">
              Permanently delete{" "}
              <span className="text-white font-medium">{deleteTarget.username}</span>
              {deleteTarget.email && deleteTarget.email !== "-" ? (
                <span className="text-gray-500"> ({deleteTarget.email})</span>
              ) : null}
              ? This removes the sub-agent account and cannot be undone. Past
              earnings/records are kept.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl border border-gray-700 text-white hover:bg-white/5 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="animate-spin" size={16} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Sub-Agent Filters"
        description="Filter the sub-agent listing"
        fields={SUBAGENT_LIST_FIELDS}
        values={filters}
        defaults={SUBAGENT_LIST_DEFAULTS}
        onApply={setFilters}
      />

    </div>
  );
}
