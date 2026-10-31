"use client";

import React, { useState, useEffect, useCallback } from "react";
import FilterToolbar from "@/components/filters/FilterToolbar";
import { Activity, CheckCircle2, Clock, XCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import { utcDayEndISO, utcDayStartISO } from "@/lib/utils";
import UserBonusViewModal from "../components/userbonus-viewmodel";
import ExportCSV from "@/components/ExportCSV";
import {
  getAllUserBonusClaims,
  UserBonusClaim,
  UserBonusClaimsParams,
} from "@/api/bonus/bonus.api";
import { useUserBonusReportStore } from "@/store/user-bonus-report.store";
import ReportFilterDrawer, { FilterField } from "@/components/report/ReportFilterDrawer";
import CopyButton from "@/components/CopyButton";

/* ============================
   CONSTANTS
============================ */
const PAGE_SIZE = 1000;
const USERS_PER_PAGE = 10;

const bonusTypeOptions = [
  { value: "all", label: "All Bonus Types" },
  { value: "deposit_match", label: "Deposit Match" },
  { value: "free_spins", label: "Free Spins" },
  { value: "cashback", label: "Cashback" },
  { value: "reload_bonus", label: "Reload Bonus" },
  { value: "no_deposit", label: "Welcome Bonus" },
  { value: "profile_complete", label: "Profile Complete Bonus" },
  { value: "lossback", label: "Lossback" },
  { value: "hourly_rakeback", label: "Hourly Cashback" },
  { value: "daily_rakeback", label: "Daily Cashback" },
  { value: "weekly_rakeback", label: "Weekly Cashback" },
  { value: "monthly_rakeback", label: "Monthly Cashback" },
];

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
  { value: "forfeited", label: "Forfeited" },
];

// Per-status display meta — a meaningful icon + colour for the single-row layout.
type BonusStatusKey = "active" | "completed" | "expired" | "forfeited";
const STATUS_META: { key: BonusStatusKey; label: string; Icon: typeof Activity; color: string }[] = [
  { key: "active", label: "Active", Icon: Activity, color: "text-blue-400" },
  { key: "completed", label: "Completed", Icon: CheckCircle2, color: "text-green-400" },
  { key: "expired", label: "Expired", Icon: Clock, color: "text-yellow-400" },
  { key: "forfeited", label: "Forfeited", Icon: XCircle, color: "text-red-400" },
];

/* ============================
   TYPES
============================ */
interface UserBonusGroup {
  userId: string;
  user: { id: string; username: string | null; entity: string | null };
  bonuses: {
    name: string;
    type: string;
    active: number;
    completed: number;
    expired: number;
    forfeited: number;
    count: number;
  }[];
  claims: UserBonusClaim[];
}

interface BonusExportRow {
  username: string;
  bonus: string;
  type: string;
  active: number;
  completed: number;
  expired: number;
  forfeited: number;
}

/* ============================
   GROUPING HELPERS
============================ */
function groupClaims(
  claims: UserBonusClaim[],
  bonusType: string,
  status: string = "all"
): UserBonusGroup[] {
  const map = new Map<string, UserBonusGroup>();

  claims.forEach((c) => {
    if (bonusType !== "all" && c.bonus?.type !== bonusType) return;
    if (status !== "all" && c.status !== status) return;

    if (!map.has(c.userId)) {
      map.set(c.userId, {
        userId: c.userId,
        user: c.user,
        bonuses: [],
        claims: [],
      });
    }

    const group = map.get(c.userId)!;
    group.claims.push(c);

    const bonusName = c.bonus?.name ?? "Unknown";
    let entry = group.bonuses.find((b) => b.name === bonusName);
    if (!entry) {
      entry = { name: bonusName, type: c.bonus?.type ?? "", active: 0, completed: 0, expired: 0, forfeited: 0, count: 0 };
      group.bonuses.push(entry);
    }
    entry.count++;
    if (c.status === "active") entry.active += Number(c.bonusAmount);
    else if (c.status === "completed") entry.completed += Number(c.bonusAmount);
    else if (c.status === "expired") entry.expired += Number(c.bonusAmount);
    else if (c.status === "forfeited") entry.forfeited += Number(c.bonusAmount);
  });

  return Array.from(map.values());
}

function flattenExportRows(groups: UserBonusGroup[]): BonusExportRow[] {
  return groups.flatMap((u) =>
    u.bonuses.map((b) => ({
      username: u.user?.username ?? u.user?.entity ?? u.userId,
      bonus: b.name,
      type: b.type,
      active: b.active,
      completed: b.completed,
      expired: b.expired,
      forfeited: b.forfeited,
    }))
  );
}

/* ============================
   SKELETON
============================ */
const TableSkeleton = () => (
  <>
    {[...Array(6)].map((_, i) => (
      <tr
        key={i}
        className={`${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} animate-pulse`}
      >
        {[...Array(3)].map((_, j) => (
          <td key={j} className="px-4 py-6">
            <div className="h-3 w-full bg-gray-700/40 rounded" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/* ============================
   PAGE
============================ */
export default function UserBonusReportPage() {
  const {
    claims,
    loading,
    fetchClaims,
  } = useUserBonusReportStore();
  const [bonusType, setBonusType] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [filterOpen, setFilterOpen] = useState(false);

  /* MODAL */
  const [openView, setOpenView] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [viewRows, setViewRows] = useState<{ date: string; bonus: string; amount: number; activity: string }[]>([]);

  /* ============================
     FETCH
  ============================ */
  const fetchData = useCallback(
    async (p: number) => {
      const params: UserBonusClaimsParams = { page: p, limit: PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      // Whole UTC days — the boundary every report and money log uses.
      params.startDate = utcDayStartISO(startDate);
      params.endDate = utcDayEndISO(endDate);
      await fetchClaims(params);
      setUserPage(1);
    },
    [fetchClaims, search, startDate, endDate]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchData(1);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchData]);

  /* ============================
     GROUP CLAIMS BY USER
  ============================ */
  const grouped: UserBonusGroup[] = React.useMemo(
    () => groupClaims(claims, bonusType, status),
    [claims, bonusType, status]
  );

  const userTotalPages = Math.max(1, Math.ceil(grouped.length / USERS_PER_PAGE));
  const paginatedGroups = grouped.slice(
    (userPage - 1) * USERS_PER_PAGE,
    userPage * USERS_PER_PAGE
  );

  /* ============================
     EXPORT
  ============================ */
  const exportRows = React.useMemo(
    () => flattenExportRows(grouped),
    [grouped]
  );

  // Claims are aggregated per bonus, so a range export must re-fetch the
  // matching claims from the server and re-aggregate them.
  const fetchAllForExport = useCallback(
    async (range: { from?: Date; to?: Date }): Promise<BonusExportRow[]> => {
      const params: UserBonusClaimsParams = { page: 1, limit: PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      params.startDate = utcDayStartISO(range.from);
      params.endDate = utcDayEndISO(range.to);
      const res = await getAllUserBonusClaims(params);
      return flattenExportRows(groupClaims(res.data, bonusType, status));
    },
    [search, bonusType, status]
  );

  /* ============================
     VIEW HANDLER
  ============================ */
  const handleView = (group: UserBonusGroup) => {
    const displayName = group.user?.username ?? group.user?.entity ?? group.userId;
    setSelectedUser(displayName);
    const rows = group.claims.map((c) => ({
      date: new Date(c.createdAt).toLocaleString(),
      bonus: c.bonus?.name ?? "-",
      amount: Number(c.bonusAmount),
      activity: c.status,
    }));
    setViewRows(rows);
    setOpenView(true);
  };

  /* ============================
     RENDER
  ============================ */
  return (
    <>
      <div className="h-full bg-[#15181E] p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto w-full scrollbar-hide">
        <div className="flex flex-col gap-6">
          {/* HEADER */}
          <div className="bg-[#161A21] px-5 py-3 rounded-lg border border-[#242B35] flex flex-wrap items-center justify-between gap-3">
            <span className="text-md font-mono font-semibold text-gray-100">
              Report / User Bonus
            </span>
          </div>

          {/* FILTER BAR */}
          <div className="rounded-xl border border-[#242B35] bg-[#191D24] px-4 py-3">
            <FilterToolbar
              className="mb-0"
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by username / entity"
              activeCount={
                (bonusType !== "all" ? 1 : 0) +
                (status !== "all" ? 1 : 0) +
                (startDate || endDate ? 1 : 0)
              }
              onOpenFilters={() => setFilterOpen(true)}
              actions={
              <ExportCSV<BonusExportRow>
                data={exportRows}
                headers={["Username", "Bonus", "Type", "Active", "Completed", "Expired", "Forfeited"]}
                mapRow={(r) => [
                  r.username,
                  r.bonus,
                  r.type,
                  r.active.toFixed(4),
                  r.completed.toFixed(4),
                  r.expired.toFixed(4),
                  r.forfeited.toFixed(4),
                ]}
                fileName="user_bonus_report"
                fetchAll={fetchAllForExport}
              />
              }
            />
          </div>

          <ReportFilterDrawer
            open={filterOpen}
            onOpenChange={setFilterOpen}
            title="User Bonus Filters"
            description="Filter bonus claims by type, status and date."
            fields={[
              {
                kind: "select",
                key: "bonusType",
                label: "Bonus Type",
                options: bonusTypeOptions,
              },
              {
                kind: "select",
                key: "status",
                label: "Bonus Status",
                options: statusOptions,
              },
              { kind: "dateRange" },
            ] as FilterField[]}
            values={{ bonusType, status, startDate, endDate }}
            defaults={{ bonusType: "all", status: "all", startDate: undefined, endDate: undefined }}
            onApply={(v) => {
              setBonusType((v.bonusType as string) ?? "all");
              setStatus((v.status as string) ?? "all");
              setStartDate(v.startDate);
              setEndDate(v.endDate);
              setUserPage(1);
            }}
          />

          {/* TABLE CONTAINER */}
          <div className="rounded-xl border border-[#242B35] bg-[#191D24] overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full min-w-[200px]">
                <thead className="bg-[#242B35]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-white">Player</th>
                    <th className="px-4 py-3 text-left text-xs text-white">Bonuses</th>
                    <th className="px-4 py-3 text-center text-xs text-white">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#242B35]">
                  {loading ? (
                    <TableSkeleton />
                  ) : paginatedGroups.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-20 text-center">
                        <NoData title="No user bonus records found" />
                      </td>
                    </tr>
                  ) : (
                    paginatedGroups.map((group) => (
                      <tr
                        key={group.userId}
                        className="hover:bg-[#242B35]/30 transition-colors"
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-1.5 text-sm text-gray-100">
                            {group.user?.username ?? group.userId}
                            <CopyButton value={group.user?.username ?? group.userId} />
                          </div>
                          {group.user?.entity && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5 break-all">
                              {group.user.entity}
                              <CopyButton value={group.user.entity} />
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-xs text-gray-300 space-y-4">
                          {group.bonuses.map((b, i) => (
                            <div key={i} className="bg-[#15181E]/50 p-3 rounded-lg border border-[#242B35]">
                              <div className="font-bold text-sm text-white capitalize mb-2">
                                {b.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono">
                                {STATUS_META.map(({ key, label, Icon, color }) => (
                                  <span key={key} className="flex items-center gap-1.5">
                                    <Icon size={14} className={color} />
                                    <span className="text-gray-400">{label}:</span>
                                    <span className="text-gray-200">
                                      {b[key].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </td>

                        <td className="px-5 py-4 text-center align-top">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-white hover:bg-[#242B35]"
                              >
                                <Wrench size={18} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#191D24] text-white border-[#242B35]">
                              <DropdownMenuItem onClick={() => handleView(group)} className="hover:bg-[#242B35] cursor-pointer">
                                View History
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER / PAGINATION */}
          <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-5 py-3 flex justify-end">
            {userTotalPages > 1 && (
              <Pagination
                currentPage={userPage}
                totalPages={userTotalPages}
                onPageChange={setUserPage}
              />
            )}
          </div>
        </div>
      </div>

      {/* VIEW MODAL */}
      <UserBonusViewModal
        open={openView}
        onClose={() => setOpenView(false)}
        email={selectedUser}
        rows={viewRows}
      />
    </>
  );
}


