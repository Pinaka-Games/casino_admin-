"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import CopyButton from "@/components/CopyButton";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import { useRouter } from "next/navigation";
import { referralApi } from "@/api/referral/referral.api";
import { Loader2, Search } from "lucide-react";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import toast from "react-hot-toast";
import { UserWithProfile } from "@/types/profile.type";
import { Input } from "@/components/ui/input";

interface SubAgentRow {
  id: string;
  employeeId: string;
  username: string;
  email: string;
  referralCode: string;
  joinedAt: string;
  totalEarnings: number;
  pendingBalance: number;
  playersCount: number;
  isActive: boolean;
  ggr: number;
}

const PAGE_SIZE = 10;


const SUBAGENT_FILTER_DEFAULTS: FilterValues = {
  search: "",
  status: "all",
  players: "all",
  from: "",
  to: "",
  minEarnings: "",
  maxEarnings: "",
};

const SUBAGENT_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "status",
    label: "Account",
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
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Joined Between" },
  { type: "numberRange", minKey: "minEarnings", maxKey: "maxEarnings", label: "Total Earnings" },
];
export default function SubAgentTab({
  agent,
  onViewSubAgent,
}: {
  agent: UserWithProfile;
  onViewSubAgent?: (id: string) => void;
}) {
  const router = useRouter();
  const [subAgents, setSubAgents] = useState<SubAgentRow[]>([]);
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
    fields: SUBAGENT_FILTER_FIELDS,
    defaults: SUBAGENT_FILTER_DEFAULTS,
  });
  const agentLookupId = agent.agent?.id || (agent as any).agentRecordId || agent.id;
  const totalSubAgents = subAgents.length;

  const fetchSubAgents = async () => {
    if (!agentLookupId) return;

    setLoading(true);
    try {
      const response = await referralApi.getSubAgents(agentLookupId);
      const mapped = (response.data || []).map((item: any) => ({
        id: item.id,
        employeeId: item.employee?.id || item.employeeId || item.id,
        username:
          item.employee?.username ||
          item.username ||
          item.user?.username ||
          "-",
        email: item.employee?.email || item.email || item.user?.email || "-",
        referralCode: item.referralCode || item.agent?.referralCode || "-",
        joinedAt: item.createdAt || item.joinedAt || "",
        totalEarnings: item.totalEarnings || 0,
        pendingBalance: item.pendingBalance || 0,
        playersCount: item.playersCount || item.totalReferrals || 0,
        isActive: item.employee?.isActive ?? item.isActive ?? true,
        ggr: item.ggr ?? 0,
      }));
      setSubAgents(mapped);
    } catch (error) {
      console.error("Failed to fetch sub-agents:", error);
      toast.error("Failed to load sub-agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubAgents();
  }, [agentLookupId]);

  const filteredSubAgents = useMemo(
    () =>
      applyClientFilters(subAgents, filters, {
        search: (row) => [row.username, row.email, row.referralCode],
        selects: [
          { key: "status", match: (row, v) => row.isActive === (v === "active") },
          {
            key: "players",
            match: (row, v) =>
              v === "with" ? Number(row.playersCount) > 0 : Number(row.playersCount) === 0,
          },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (row) => row.joinedAt },
        numberRanges: [
          {
            minKey: "minEarnings",
            maxKey: "maxEarnings",
            get: (row) => Number(row.totalEarnings || 0),
          },
        ],
      }),
    [subAgents, filters],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const { sort, toggle } = useTableSort<"ggr" | "players" | "joined">();
  const sortedSubAgents = useSortedRows(filteredSubAgents, sort, {
    ggr: (row) => Number(row.ggr) || 0,
    players: (row) => Number(row.playersCount) || 0,
    joined: (row) => new Date(row.joinedAt).getTime(),
  });

  const totalPages = Math.max(
    1,
    Math.ceil(sortedSubAgents.length / PAGE_SIZE),
  );
  const pageData = sortedSubAgents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300 md:space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] items-center">
        <div>
          <p className="text-sm text-gray-400">
            Direct sub-agents for this agent account.
          </p>
          <h3 className="text-xl font-semibold text-white">
            Sub-Agent Listing
          </h3>
        </div>

        <FilterToolbar
          countLabel={
            loading
              ? undefined
              : `${filteredSubAgents.length} of ${totalSubAgents}`
          }
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search username, email or code"
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          onResetAll={resetFilters}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-[#191D24] p-4 border border-white/5">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Total Sub-Agents
          </p>
          <p className="mt-3 text-3xl font-bold text-white">
            {totalSubAgents}
          </p>
        </div>
        <div className="rounded-3xl bg-[#191D24] p-4 border border-white/5">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Total Players
          </p>
          <p className="mt-3 text-3xl font-bold text-white">
            {filteredSubAgents.reduce(
              (sum, item) => sum + item.playersCount,
              0,
            )}
          </p>
        </div>
        <div className="rounded-3xl bg-[#191D24] p-4 border border-white/5">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Pending Balance
          </p>
          {/* Negative pending is a clawback carry (referee net-won). With the
              negative-balance allowance removed (QA #40), balances display
              floored at zero; the wallet still nets the carry internally. */}
          <p className="mt-3 text-3xl font-bold text-white">
            {filteredSubAgents
              .reduce((sum, item) => sum + Math.max(0, item.pendingBalance), 0)
              .toFixed(2)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/5 bg-[#15181E]">
        <table className="min-w-full table-auto text-left">
          <thead className="bg-[#191D24] text-xs uppercase tracking-[0.2em] text-gray-500 whitespace-nowrap">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 ">Referral Code</th>
              <SortableTh
                label="Players"
                sortKey="players"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3"
              />
              <th className="px-4 py-3 ">Pending</th>
              <SortableTh
                label="GGR"
                sortKey="ggr"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3"
              />
              <SortableTh
                label="Joined"
                sortKey="joined"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3"
              />
              <th className="px-4 py-3 ">Status</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-gray-400">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#B93DEB]" />
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16">
                  <NoData
                    title={
                      hasAnyFilter
                        ? "No sub-agents match these filters"
                        : "No sub-agents found"
                    }
                  />
                </td>
              </tr>
            ) : (
              pageData.map((subAgent) => (
                <tr
                  key={subAgent.id}
                  className="border-t border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-4 text-sm text-white">
                    <span className="flex items-center gap-2">
                      {subAgent.username}
                      <CopyButton value={subAgent.username} />
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">
                    {subAgent.email}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">
                    <span className="flex items-center gap-2">
                      {subAgent.referralCode}
                      <CopyButton value={subAgent.referralCode} />
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm  text-gray-300">
                    {subAgent.playersCount}
                  </td>
                  <td className="px-4 py-4 text-sm text-center text-orange-400">
                    {Math.max(0, subAgent.pendingBalance).toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-sm text-center font-semibold">
                    <span className={subAgent.ggr >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {subAgent.ggr >= 0 ? "+" : ""}{subAgent.ggr.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">
                    {subAgent.joinedAt
                      ? new Date(subAgent.joinedAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )
                      : "-"}
                  </td>
                  <td className="px-4 py-4 text-sm text-center font-semibold">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${subAgent.isActive ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}
                    >
                      {subAgent.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() =>
                        onViewSubAgent
                          ? onViewSubAgent(subAgent.employeeId)
                          : router.push(`/users/agent-listing/${subAgent.employeeId}`)
                      }
                      className="rounded-md bg-[#B93DEB]/10 border border-[#B93DEB]/30 px-3 py-1.5 text-xs font-semibold text-[#B93DEB] hover:bg-[#B93DEB]/20 transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Sub-Agent Filters"
        description="Filter this agent's sub-agents"
        fields={SUBAGENT_FILTER_FIELDS}
        values={filters}
        defaults={SUBAGENT_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
}
