"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Wrench,
  ArrowUpDown,
  Pencil,
  Percent,
  ChevronDown,
  History,
  Search,
  Sliders,
  CircleDollarSign,
  X,
  Copy,
} from "lucide-react";
import Image from "next/image";
import { create } from "@/assets/images/action";
import NoData from "@/components/NoData";
import TableSkeleton from "@/components/TableSkeleton";
import CopyButton from "@/components/CopyButton";
import Pagination from "@/components/Pagination";
import { useAuthStore } from "@/store/auth-store";
import { referralApi } from "@/api/referral/referral.api";
import { getApiErrorMessage } from "@/lib/api-error";
import toast from "react-hot-toast";

import {
  AgentFilterSheet,
  FilterState,
} from "@/app/agent-management/components/AgentFilterSheet";
import {
  PAGE_HEAD,
  PAGE_SHELL,
  PAGE_TITLE,
  PAGINATION_BAR,
  SUMMARY_GRID,
  TOOLBAR,
  TOOLBAR_SEARCH,
} from "@/app/agent-management/components/responsive";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";

// Agent-specific modals
import CreateSubAgentModal from "./components/modals/CreateSubAgentModal";
import EditSubAgentModal from "./components/modals/EditSubAgentModal";
import SubAgentCommissionModal from "./components/modals/SubAgentCommissionModal";
import SubAgentDownlineModal from "./components/modals/SubAgentDownlineModal";
import SubAgentTransactionModal from "./components/modals/SubAgentTransactionModal";
import SubAgentDeleteRequestModal from "./components/modals/SubAgentDeleteRequestModal";
import SubAgentStatusRequestModal from "./components/modals/SubAgentStatusRequestModal";
import { subAgentDeleteRequestApi } from "@/api/sub-agent-delete-request/sub-agent-delete-request.api";
import { Switch } from "@/components/ui/switch";

// Sub-Agent Type (Mock)
interface SubAgent {
  id: string;
  username: string;
  email: string;
  joinedAt: string;
  commissionPercentage: number;
  totalEarnings: number;
  pendingBalance: number;
  playersCount: number;
  isActive: boolean;
  isBlocked: boolean;
  isFrozen: boolean;
  allowNegativeWallet: boolean;
  negativeWalletLimit: number;
  requestedBalance: number;
  referralCode: string; // ✅ Added
}

/** Raw shape returned by GET /referral/sub-agents before mapping. */
interface RawSubAgent {
  id: string;
  createdAt: string;
  employee?: { username?: string; email?: string; isActive?: boolean };
  commissionPercentage?: number;
  totalEarnings?: number;
  pendingBalance?: number;
  playersCount?: number;
  isBlocked?: boolean;
  isFrozen?: boolean;
  allowNegativeWallet?: boolean;
  negativeWalletLimit?: number;
  requestedBalance?: number;
  referralCode?: string;
}

import { FeatureGate, FeatureBadge } from "../components/FeatureGate";

export default function SubAgentsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = React.useState<SubAgent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");
  // Search is debounced so typing doesn't fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  // Sidebar Filter State
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [filters, setFilters] = React.useState<FilterState>({
    status: "All",
    startDate: undefined,
    endDate: undefined,
  });

  // Totals for the header cards — computed server-side across the whole
  // filtered set, since the client now only ever holds one page.
  const [summaryStats, setSummaryStats] = React.useState({
    totalSubAgents: 0,
    totalEarnings: 0,
    totalPendingBalance: 0,
    totalPlayers: 0,
  });

  // Feature Hooks
  const { canCreateSubAgent, subAgentLimit, isUnlimitedSubAgents } = useFeatureAccess();
  const { fetchCurrentPackage } = useAgentPackageStore();

  React.useEffect(() => {
    fetchCurrentPackage();
  }, [fetchCurrentPackage]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      // Reset alongside the term, not in a separate effect — otherwise the
      // fetch fires once for the stale page before the reset lands.
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSortingChange = React.useCallback(
    (updater: React.SetStateAction<SortingState>) => {
      setSorting(updater);
      setCurrentPage(1);
    },
    [],
  );

  const fetchSubAgents = React.useCallback(async () => {
    const authUser = user as { id?: string; agent?: { id?: string } } | null;
    const parentId = authUser?.agent?.id || authUser?.id;
    if (!parentId) return;

    try {
      setLoading(true);
      const sort = sorting[0];
      const res = await referralApi.getSubAgentsPaginated<RawSubAgent>({
        agentId: parentId,
        page: currentPage,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: filters.status !== "All" ? filters.status : undefined,
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        sortBy: sort?.id === "username" ? "username" : "joinedAt",
        sortDir: sort ? (sort.desc ? "DESC" : "ASC") : "DESC",
      });

      // Map backend data to frontend interface
      const mappedData: SubAgent[] = res.data.data.map((item: RawSubAgent) => ({
        id: item.id,
        username: item.employee?.username || "N/A",
        email: item.employee?.email || "N/A",
        joinedAt: item.createdAt,
        commissionPercentage: item.commissionPercentage || 0,
        totalEarnings: item.totalEarnings || 0,
        pendingBalance: item.pendingBalance || 0,
        playersCount: item.playersCount || 0,
        isActive: item.employee?.isActive ?? true,
        isBlocked: item.isBlocked ?? false,
        isFrozen: item.isFrozen ?? false,
        allowNegativeWallet: item.allowNegativeWallet ?? false,
        negativeWalletLimit: item.negativeWalletLimit ?? 0,
        requestedBalance: item.requestedBalance || 0,
        referralCode: item.referralCode || "N/A", // ✅ Added mapping
      }));

      setData(mappedData);
      setTotalCount(res.data.meta?.total ?? mappedData.length);
      setTotalPages(Math.max(1, res.data.meta?.totalPages ?? 1));
      setSummaryStats({
        totalSubAgents: res.data.summary?.totalSubAgents ?? 0,
        totalEarnings: res.data.summary?.totalEarnings ?? 0,
        totalPendingBalance: res.data.summary?.totalPendingBalance ?? 0,
        totalPlayers: res.data.summary?.totalPlayers ?? 0,
      });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to load sub-agents"));
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, debouncedSearch, filters, sorting]);

  React.useEffect(() => {
    fetchSubAgents();
  }, [fetchSubAgents]);

  // Modal states — reusing admin modals
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [openCommission, setOpenCommission] = React.useState(false);
  const [openDownline, setOpenDownline] = React.useState(false);
  const [openTransaction, setOpenTransaction] = React.useState(false);
  const [openDelete, setOpenDelete] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [statusModal, setStatusModal] = React.useState<{
    open: boolean;
    agent: SubAgent | null;
    deactivate: boolean;
  }>({ open: false, agent: null, deactivate: false });
  const [isSubmittingStatus, setIsSubmittingStatus] = React.useState(false);
  const [selectedAgent, setSelectedAgent] = React.useState<SubAgent | null>(
    null,
  );

  // Upgrade/limit modal — shown instead of a toast when the plan blocks creation.
  const [upgradeModal, setUpgradeModal] = React.useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

  const handleRequestDelete = async (reason: string) => {
    if (!selectedAgent) return;
    try {
      setIsDeleting(true);
      await subAgentDeleteRequestApi.create(selectedAgent.id, reason);
      toast.success("Deletion request sent to admin for approval");
      setOpenDelete(false);
      setSelectedAgent(null);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to send deletion request"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusRequest = async (reason: string) => {
    if (!statusModal.agent) return;
    try {
      setIsSubmittingStatus(true);
      // deactivate → targetBlocked=true
      await subAgentDeleteRequestApi.createStatus(
        statusModal.agent.id,
        reason,
        statusModal.deactivate,
      );
      toast.success("Status-change request sent to admin for approval");
      setStatusModal({ open: false, agent: null, deactivate: false });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to send status request"));
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleCreateClick = () => {
    if (!canCreateSubAgent) {
      setUpgradeModal({
        open: true,
        title: "Plan Upgrade Required",
        message: "Your current plan doesn’t include Sub-Agent creation. Upgrade your plan to start building your team.",
      });
      return;
    }
    // Must be the server total, not `data.length` — that's only one page now.
    if (!isUnlimitedSubAgents && totalCount >= subAgentLimit) {
      setUpgradeModal({
        open: true,
        title: "Sub-Agent Limit Reached",
        message: `You’ve reached your plan limit of ${subAgentLimit} sub-agent${subAgentLimit === 1 ? "" : "s"}. Upgrade your plan to create more.`,
      });
      return;
    }
    setOpenCreate(true);
  };

  // Search, status, date range, sorting and paging are all applied server-side
  // now — `data` already holds exactly the rows for the current page.
  const activeFilterCount =
    (filters.status && filters.status !== "All" ? 1 : 0) +
    (filters.startDate ? 1 : 0) +
    (filters.endDate ? 1 : 0);

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const formatJoinedAt = (value: unknown) => {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return { date: String(value), time: "" };
    return {
      date: date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const columns: ColumnDef<SubAgent>[] = [
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.getValue("email") as string;
        return (
          <div className="flex items-center gap-2 group/copy">
            <span
              className="text-gray-300 text-xs truncate lowercase"
              title={email}
            >
              {email}
            </span>
            {email && email !== "N/A" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(email, "Email");
                }}
                title="Copy email"
                className="shrink-0 text-gray-600 hover:text-purple-400 transition-colors"
              >
                <Copy size={13} />
              </button>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "username",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="flex items-center text-white text-xs font-normal hover:text-purple-400 transition-colors"
        >
          Username <ArrowUpDown className="ml-2 h-3 w-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs truncate">
          {row.getValue("username")}
        </div>
      ),
    },
    {
      accessorKey: "referralCode",
      header: "Referral Code",
      cell: ({ row }) => {
        const code = row.getValue("referralCode") as string;
        return (
          <div className="flex items-center gap-2 group/copy">
            <span className="text-purple-400 font-bold text-xs truncate">
              {code}
            </span>
            {code && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(code, "Referral code");
                }}
                title="Copy referral code"
                className="shrink-0 text-gray-600 hover:text-purple-400 transition-colors"
              >
                <Copy size={13} />
              </button>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "joinedAt",
      header: "Joined Date",
      cell: ({ row }) => {
        const f = formatJoinedAt(row.getValue("joinedAt"));
        if (!f) return <div className="text-gray-300 text-xs">N/A</div>;
        return (
          <div className="text-gray-300 text-xs leading-4 whitespace-normal">
            <span className="block">{f.date}</span>
            <span className="block text-gray-500">{f.time}</span>
          </div>
        );
      },
    },
    // {
    //   accessorKey: "commissionPercentage",
    //   header: "Comm. Rate",
    //   cell: ({ row }) => (
    //     <div className="text-gray-300 text-xs">
    //       {row.getValue("commissionPercentage")}%
    //     </div>
    //   ),
    // },
    {
      accessorKey: "totalEarnings",
      header: "Total Earnings",
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs">
          {(row.getValue("totalEarnings") as number).toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: "requestedBalance",
      header: "Freeze (Pending)",
      cell: ({ row }) => (
        <div className="text-orange-400 font-medium text-xs">
          {(row.getValue("requestedBalance") as number).toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: "pendingBalance",
      header: "Available Bal.",
      cell: ({ row }) => (
        <div className="text-blue-400 font-medium text-xs">
          {(row.getValue("pendingBalance") as number).toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: "playersCount",
      header: "Users Count",
      cell: ({ row }) => (
        <div className="text-gray-300 text-xs font-bold">
          {row.getValue("playersCount")}
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const blocked = row.original.isBlocked;
        const active = !blocked;
        return (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={active}
              onCheckedChange={(next) =>
                setStatusModal({
                  open: true,
                  agent: row.original,
                  // next=true → activate (deactivate=false); next=false → deactivate
                  deactivate: !next,
                })
              }
              className="data-[state=checked]:bg-[#04AD37]"
            />
            <span
              className={`text-xs font-medium ${active ? "text-[#04AD37]" : "text-red-400"}`}
            >
              {active ? "Active" : "Inactive"}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const agent = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()} className="text-start">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-red-400 hover:text-orange-400 transition-colors">
                  <Wrench size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                className="bg-[#1a2030] text-white border border-gray-700 p-2 min-w-[160px]"
              >
                <DropdownMenuLabel className="text-gray-400 text-xs px-2 py-1.5">
                  Actions
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700 mx-1 my-1" />

                {/* Edit */}
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedAgent(agent);
                    setOpenEdit(true);
                  }}
                  className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md"
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>

                {/* Commission */}
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedAgent(agent);
                    setOpenCommission(true);
                  }}
                  className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md"
                >
                  <Percent className="mr-2 h-4 w-4" /> Commission
                </DropdownMenuItem>

                {/* Downline */}
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedAgent(agent);
                    setOpenDownline(true);
                  }}
                  className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md"
                >
                  <ChevronDown className="mr-2 h-4 w-4" /> View Downline
                </DropdownMenuItem>

                {/* Transaction */}
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedAgent(agent);
                    setOpenTransaction(true);
                  }}
                  className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md"
                >
                  <History className="mr-2 h-4 w-4" /> Transaction
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // Sorting and paging are manual: the server already returned one sorted page,
  // so the client row models must not re-slice or re-sort it.
  const table = useReactTable({
    data,
    columns,
    pageCount: totalPages,
    state: {
      sorting,
      pagination: { pageIndex: currentPage - 1, pageSize: PAGE_SIZE },
    },
    manualPagination: true,
    manualSorting: true,
    onSortingChange: handleSortingChange,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: currentPage - 1, pageSize: PAGE_SIZE })
          : updater;
      setCurrentPage(next.pageIndex + 1);
    },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={`${PAGE_SHELL} max-w-full`}>
      {/* HEADER */}
      <div className={PAGE_HEAD}>
        <h1 className={PAGE_TITLE}>
          Agent Management / Sub-Agents Listing
        </h1>
        {!canCreateSubAgent && (
          <FeatureBadge />
        )}
      </div>

      {/* SUMMARY CARDS */}
      <div className="bg-[#191D24] rounded-lg p-3 sm:p-4 mb-3 md:mb-4 shrink-0">
        <div className={SUMMARY_GRID}>
          <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
            <div className="text-gray-400 text-xs sm:text-sm">Total Sub-Agents</div>
            <div className="text-white text-lg sm:text-2xl font-bold">{summaryStats.totalSubAgents}</div>
          </div>
          <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
            <div className="text-gray-400 text-xs sm:text-sm">Total Earnings</div>
            <div className="text-white text-lg sm:text-2xl font-bold">{summaryStats.totalEarnings.toFixed(2)}</div>
          </div>
          <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
            <div className="text-gray-400 text-xs sm:text-sm">Total Pending Balance</div>
            <div className="text-white text-lg sm:text-2xl font-bold">{summaryStats.totalPendingBalance.toFixed(2)}</div>
          </div>
          <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
            <div className="text-gray-400 text-xs sm:text-sm">Total Players</div>
            <div className="text-white text-lg sm:text-2xl font-bold">{summaryStats.totalPlayers}</div>
          </div>
        </div>
      </div>

      {/* SEARCH + FILTER */}
      <div className={`${TOOLBAR} mb-3 md:mb-4`}>
        <div className={TOOLBAR_SEARCH}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
          <Input
            placeholder="Search by email/username..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm h-10 pl-10 focus:ring-1 focus:ring-purple-500/30 font-medium"
          />
        </div>

        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setFilterOpen(true)}
            className={`h-10 w-10 bg-[#1a2030] text-white outline-none border-gray-700 hover:bg-[#242B35] ${
              activeFilterCount > 0
                ? "border border-purple-500/50 text-purple-500"
                : ""
            }`}
          >
            <Sliders size={18} />
          </Button>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* <div className="h-6 w-px bg-gray-800 mx-1" /> */}

        <Button
          variant="outline"
          size="icon"
          onClick={handleCreateClick}
          className="h-10 w-10 bg-[#1a2030] outline-none border-gray-700 hover:bg-[#242B35]"
          title="Create Sub-Agent"
        >
          <Image src={create} alt="Create" width={20} height={20} />
        </Button>
      </div>

      <AgentFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={handleApplyFilters}
        title="Sub-Agent Filters"
        description="Narrow down the sub-agent list."
        statusOptions={[
          { label: "All Status", value: "All" },
          { label: "Active", value: "ACTIVE" },
          { label: "Inactive", value: "INACTIVE" },
        ]}
      />

      {/* TABLE */}
      <div className="flex flex-col md:flex-1 md:min-h-0 bg-[#15181E] rounded-lg overflow-hidden">
        {/* ONE horizontal scroller around the header table AND the body table.
            Nine columns cannot read at phone width, and two separate scrollers
            would drift out of step, so both live inside this container and
            share a single width floor. The floor is released at `lg`, where the
            layout already had the room — desktop renders exactly as before. */}
        <div className="flex flex-col md:flex-1 md:min-h-0 overflow-x-auto agent-x-scroll">
        <div className="flex flex-col md:flex-1 md:min-h-0 min-w-[1100px] lg:min-w-0">
        <div className="shrink-0">
          <table className="w-full table-fixed">
            <thead className="bg-[#242B35]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-gray-800">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 md:px-4 py-3 text-left text-white text-xs font-normal"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          </table>
        </div>

        <div className="md:flex-1 md:overflow-y-auto scrollbar-hide">
          <FeatureGate allowed={canCreateSubAgent} showHeader={false}>
            <table className="w-full table-fixed border-collapse">
              <tbody>
                {loading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, rowIndex) => (
                    <tr
                      key={`skeleton-${rowIndex}`}
                      className={
                        rowIndex % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      }
                    >
                      {columns.map((column, cellIndex) => (
                        <td
                          key={`skeleton-cell-${cellIndex}`}
                          className="px-3 md:px-4 py-3"
                        >
                          <Skeleton
                            className="h-3 bg-gray-700/40"
                            style={{
                              // Vary widths so the placeholder reads as text, not bars.
                              width:
                                column.id === "actions"
                                  ? "1rem"
                                  : `${55 + ((cellIndex * 13) % 40)}%`,
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, index) => (
                    <tr
                      key={row.id}
                      onClick={() =>
                        router.push(
                          `/agent-management/sub-agents/${row.original.id}`,
                        )
                      }
                      className={`hover:bg-[#1a2030] cursor-pointer ${
                        index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-3 md:px-4 py-3 ${
                            cell.column.id === "joinedAt" ? "align-top" : "truncate"
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="py-10">
                      <NoData title="No Sub-Agents found" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          </FeatureGate>
        </div>
        </div>
        </div>

        {/* PAGINATION — pinned below the table, outside the scroll area */}
        {!loading && totalCount > 0 && (
          <div className={PAGINATION_BAR}>
            <span className="text-xs text-gray-400">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}{" "}
              sub-agents
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* MODALS — dedicated sub-agent modals */}
      <CreateSubAgentModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreateSuccess={fetchSubAgents}
      />

      <EditSubAgentModal
        open={openEdit}
        subAgentId={selectedAgent?.id || null}
        initialIsFrozen={selectedAgent?.isFrozen}
        onClose={() => {
          setOpenEdit(false);
          setSelectedAgent(null);
        }}
        onUpdateSuccess={fetchSubAgents}
      />

      <SubAgentCommissionModal
        open={openCommission}
        subAgentId={selectedAgent?.id || ""}
        username={selectedAgent?.username || ""}
        parentAgentId={user?.id}
        onClose={() => {
          setOpenCommission(false);
          setSelectedAgent(null);
        }}
        onUpdate={() => {}}
      />

      <SubAgentDownlineModal
        open={openDownline}
        subAgentId={selectedAgent?.id || ""}
        onClose={() => {
          setOpenDownline(false);
          setSelectedAgent(null);
        }}
      />

      <SubAgentTransactionModal
        open={openTransaction}
        subAgentId={selectedAgent?.id || ""}
        onClose={() => {
          setOpenTransaction(false);
          setSelectedAgent(null);
        }}
      />

      <SubAgentDeleteRequestModal
        open={openDelete}
        loading={isDeleting}
        username={selectedAgent?.username}
        onClose={() => {
          setOpenDelete(false);
          setSelectedAgent(null);
        }}
        onSubmit={handleRequestDelete}
      />

      <SubAgentStatusRequestModal
        open={statusModal.open}
        loading={isSubmittingStatus}
        username={statusModal.agent?.username}
        deactivate={statusModal.deactivate}
        onClose={() =>
          setStatusModal({ open: false, agent: null, deactivate: false })
        }
        onSubmit={handleStatusRequest}
      />

      {/* Plan upgrade / limit-reached modal */}
      {upgradeModal.open && (
        <div
          className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setUpgradeModal((p) => ({ ...p, open: false }))}
        >
          <div
            className="relative w-full max-w-md bg-[#191D24] border border-white/10 rounded-2xl p-5 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setUpgradeModal((p) => ({ ...p, open: false }))}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                <CircleDollarSign size={32} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                {upgradeModal.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {upgradeModal.message}
              </p>

              <div className="flex items-center gap-3 w-full mt-2">
                <button
                  onClick={() => setUpgradeModal((p) => ({ ...p, open: false }))}
                  className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-black hover:bg-white/10 transition-all"
                >
                  Maybe Later
                </button>
                <button
                  onClick={() => {
                    setUpgradeModal((p) => ({ ...p, open: false }));
                    router.push("/agent-management/agent-package-mgt");
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-[#B93DEB] hover:bg-[#A831D6] text-white text-xs font-black transition-all shadow-lg shadow-[#B93DEB]/20"
                >
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
