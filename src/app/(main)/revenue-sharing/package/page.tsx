"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import CopyButton from "@/components/CopyButton";
import ExportCSV from "@/components/ExportCSV";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Wrench,
  Loader2,
  Eye,
  Copy,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { useRevenueSharingStore, RevenueSharingRow } from "@/store/revenue-sharing-store";
import { useClearSearchOnLeave } from "@/hooks/use-clear-search-on-leave";
import { profileApi } from "@/api/users/users";
import AgentCommissionModal from "@/app/(main)/users/components/agent-list/AgentCommissionModal";
import {
  PromoCode,
  CreatePromoCodeDto,
  getAllPromoCodes,
  createPromoCode,
  updatePromoCode,
  approvePromoCode,
  rejectPromoCode,
  getPromoCodeSettings,
  updatePromoCodeSettings,
} from "@/api/promo-codes/promo-codes.api";
import PromoCodeUpsertModal from "@/app/(main)/settings/promo-code-listing/components/PromoCodeUpsertModal";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Helper to format numeric values (no currency sign) */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/** Normalizes category names for matching */
const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Lookup plan bonus rate by fuzzy-matching category name */
const getPlanRate = (
  ggrRates: Record<string, number>,
  categoryName: string,
): number => {
  if (!ggrRates || !categoryName) return 0;
  const normCat = normalizeKey(categoryName);
  const key = Object.keys(ggrRates).find((k) => normalizeKey(k) === normCat);
  return key ? Number(ggrRates[key] || 0) : 0;
};

/** Formats joined date string into date and time */
const formatJoinedAt = (dateString?: string) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return {
    date: format(date, "dd MMM yyyy"),
    time: format(date, "hh:mm a"),
  };
};

/** Row shape consumed by the agents CSV export. Shared by the in-memory
 *  `csvData` and the paginated `fetchAll` so their element types match. */
const toAgentCsvRow = (row: RevenueSharingRow) => ({
  Username: row.username,
  Email: row.email,
  "Package Plan": row.packagePlan,
  Players: row.playersCount,
  "Total Earning": formatCurrency(row.totalEarning),
});

export default function RevenueSharingPackagePage() {
  const { 
    rows, 
    isLoading, 
    totalPages, 
    currentPage, 
    searchQuery,
    fetchRevenueData, 
    setPage,
    setSearchQuery
  } = useRevenueSharingStore();

  // Search text lives in a module-level store, so it survives navigation —
  // clear it on the way out or the next visit opens pre-filtered.
  useClearSearchOnLeave(() =>
    useRevenueSharingStore.setState({ searchQuery: "", currentPage: 1 }),
  );


  const [activeTab, setActiveTab] = useState<"agents" | "promoCodes">("agents");

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  // Commission modal (Configure Commission)
  const [commOpen, setCommOpen] = useState(false);
  const [commAgent, setCommAgent] = useState<{ id: string; username: string } | null>(null);

  // Promo codes tab state
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");
  const [promoPage, setPromoPage] = useState(1);
  const [openPromoModal, setOpenPromoModal] = useState(false);
  const [editPromo, setEditPromo] = useState<PromoCode | null>(null);
  const PROMO_PAGE_SIZE = 10;

  // Approval mode settings
  const [approvalSettingsOpen, setApprovalSettingsOpen] = useState(false);
  const [approvalMode, setApprovalMode] = useState<"manual" | "auto">("auto");
  const [savingApprovalMode, setSavingApprovalMode] = useState(false);

  useEffect(() => {
    getPromoCodeSettings().then((res) => {
      setApprovalMode(res.approvalMode ?? "auto");
    }).catch(() => {});
  }, []);

  const handleSaveApprovalMode = async (mode: "manual" | "auto") => {
    setSavingApprovalMode(true);
    try {
      await updatePromoCodeSettings(mode);
      setApprovalMode(mode);
      toast.success(`Approval mode set to ${mode === "manual" ? "Manual" : "Auto"}`);
      setApprovalSettingsOpen(false);
    } catch {
      toast.error("Failed to update approval mode");
    } finally {
      setSavingApprovalMode(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const updated = await approvePromoCode(id);
      setPromoCodes((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success("Promo code approved");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const updated = await rejectPromoCode(id);
      setPromoCodes((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success("Promo code rejected");
    } catch {
      toast.error("Failed to reject");
    }
  };

  const fetchAgentPromos = useCallback(async () => {
    setPromoLoading(true);
    try {
      const data = await getAllPromoCodes();
      const now = new Date();
      const agentCodes = data.filter((p) => !!p.agent);
      const expired = agentCodes.filter(
        (p) => p.isActive && p.endDate && new Date(p.endDate) < now
      );
      const updates = await Promise.allSettled(
        expired.map((p) => updatePromoCode(p.id, { isActive: false }))
      );
      const updatedMap = new Map<string, PromoCode>();
      expired.forEach((p, i) => {
        const res = updates[i];
        if (res.status === "fulfilled") updatedMap.set(p.id, res.value);
      });
      setPromoCodes(agentCodes.map((p) => updatedMap.get(p.id) ?? p));
    } catch {
      toast.error("Failed to load agent promo codes");
    } finally {
      setPromoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "promoCodes") fetchAgentPromos();
  }, [activeTab, fetchAgentPromos]);

  // Human identity of the code's agent. `agent` itself is the employee UUID —
  // shown only as a last resort for legacy rows the server could not resolve.
  const promoAgentLabel = (p: PromoCode) =>
    p.agentEmail || p.agentUsername || p.agent || "";

  const filteredPromos = useMemo(() => {
    const q = promoSearch.toLowerCase();
    if (!q) return promoCodes;
    return promoCodes.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        promoAgentLabel(p).toLowerCase().includes(q) ||
        (p.agent ?? "").toLowerCase().includes(q)
    );
  }, [promoCodes, promoSearch]);

  const promoTotalPages = Math.ceil(filteredPromos.length / PROMO_PAGE_SIZE);
  const paginatedPromos = useMemo(() => {
    const start = (promoPage - 1) * PROMO_PAGE_SIZE;
    return filteredPromos.slice(start, start + PROMO_PAGE_SIZE);
  }, [filteredPromos, promoPage]);

  const handlePromoUpsert = async (data: CreatePromoCodeDto, id?: string) => {
    if (id) {
      const updated = await updatePromoCode(id, data);
      setPromoCodes((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } else {
      const created = await createPromoCode(data);
      setPromoCodes((prev) => [created, ...prev]);
    }
    setOpenPromoModal(false);
    setEditPromo(null);
  };

  const handlePromoToggle = async (row: PromoCode) => {
    try {
      const updated = await updatePromoCode(row.id, { isActive: !row.isActive });
      setPromoCodes((prev) => prev.map((p) => (p.id === row.id ? updated : p)));
    } catch {
      toast.error("Failed to update status");
    }
  };

  const formatDateShort = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }) : "—";

  const handleViewDetails = (row: any) => {
    setSelectedRow(row);
    setDetailOpen(true);
  };

  const handleOpenCommission = (row: any) => {
    setCommAgent({ id: row.agentId, username: row.username });
    setCommOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  const csvData = useMemo(() => rows.map(toAgentCsvRow), [rows]);

  const promoCsvData = useMemo(() =>
    filteredPromos.map((p) => ({
      Code: p.code,
      Agent: promoAgentLabel(p),
      Discount: p.discountType === "percentage" ? `${p.discountValue}%` : `$${p.discountValue}`,
      "Min Purchase": p.minPurchaseAmount,
      "Max Usage": p.maxUsage,
      Claimed: p.totalClaimed,
      Status: p.isActive ? "Active" : "Inactive",
    })),
  [filteredPromos]);

  return (
    <div className="flex flex-col h-full space-y-4 p-3 md:p-6 bg-[#0B0E14]">
      {/* Title bar of its own, matching every other listing page — the tabs and
          search sit in their own bar below rather than sharing this one. */}
      <div className="rounded-lg bg-[#191D24] px-3 py-3 md:px-4">
        <h1 className="text-base font-normal text-white">
          Revenue Sharing Package
        </h1>
      </div>

      {/* Tabs (left) | Search + Actions (right). Stacked on a phone: the tabs,
          a 256px search box and two buttons ran ~560px on one row. */}
      <div className="rounded-lg bg-[#191D24] px-3 py-3 md:px-4">
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          {/* Tabs on the left — sized to match the Tabs component used on Vault
              Management so the two pages read the same. */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-[#151B23] p-1 shrink-0">
            {(["agents", "promoCodes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors md:flex-initial ${
                  activeTab === tab
                    ? "bg-purple-600 text-white"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                {tab === "agents" ? "Agents" : "Promo Codes"}
              </button>
            ))}
          </div>

          {/* Search + Export on the right */}
          <div className="flex w-full items-center gap-1.5 shrink-0 md:w-auto">
            <div className="relative group min-w-0 flex-1 md:w-64 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={15} />
              {activeTab === "agents" ? (
                <Input
                  placeholder="Search agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-[#15181E] border-gray-700 text-white text-sm placeholder:text-gray-600 focus:border-purple-500/50 rounded-lg"
                />
              ) : (
                <Input
                  placeholder="Search code or agent..."
                  value={promoSearch}
                  onChange={(e) => { setPromoSearch(e.target.value); setPromoPage(1); }}
                  className="pl-9 h-10 bg-[#15181E] border-gray-700 text-white text-sm placeholder:text-gray-600 focus:border-purple-500/50 rounded-lg"
                />
              )}
            </div>
            {activeTab === "agents" ? (
              <ExportCSV
                data={csvData}
                fileName={`revenue-sharing-agents.csv`}
                headers={["Username", "Email", "Package Plan", "Players", "Total Earning"]}
                mapRow={(row) => [row.Username, row.Email, row["Package Plan"], row.Players, row["Total Earning"]]}
                fetchAll={async () => {
                  // Server-paginated store keeps only the current page in `rows`;
                  // loop every page (reusing the active search) so export is not
                  // limited to the visible page. No date field, so range is unused.
                  const EXPORT_LIMIT = 100;
                  const all: ReturnType<typeof toAgentCsvRow>[] = [];
                  let page = 1;
                  for (let i = 0; i < 100; i++) {
                    const res = await profileApi.getRevenueSharingPackages({
                      page,
                      limit: EXPORT_LIMIT,
                      search: searchQuery,
                    });
                    const pageRows: RevenueSharingRow[] = res.data?.data ?? [];
                    all.push(...pageRows.map(toAgentCsvRow));
                    const pageCount = res.data?.meta?.totalPages ?? 1;
                    if (page >= pageCount || pageRows.length === 0) break;
                    page += 1;
                  }
                  return all;
                }}
              />
            ) : (
              <ExportCSV
                data={promoCsvData}
                fileName={`agent-promo-codes.csv`}
                headers={["Code", "Agent", "Discount", "Min Purchase", "Max Usage", "Claimed", "Status"]}
                mapRow={(row) => [row.Code, row.Agent, row.Discount, row["Min Purchase"], row["Max Usage"], row.Claimed, row.Status]}
              />
            )}
            <button
              onClick={() => setApprovalSettingsOpen(true)}
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#15181E] border border-gray-700 text-gray-400 hover:text-purple-400 hover:border-purple-500/50 transition-colors"
              title="Approval Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#15181E] rounded-lg relative scrollbar-hide">

        {/* ── PROMO CODES TAB ── */}
        {activeTab === "promoCodes" && (
          <>
            {promoLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-[#242B35] sticky top-0 z-10">
                  <tr>
                    {["Code", "Agent", "Discount", "Type", "Min Purchase", "Start Date", "End Date", "Max Usage", "Claimed", "Approval", "Status", "Action"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-white font-normal whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedPromos.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-16">
                        <NoData title="No agent promo codes found" />
                      </td>
                    </tr>
                  ) : (
                    paginatedPromos.map((row, index) => (
                      <tr key={row.id} className={`${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} hover:bg-[#1a2030]`}>
                        <td className="px-4 py-3 text-xs text-purple-300 font-mono font-bold">
                          <span className="flex items-center gap-1.5">
                            {row.code}
                            <CopyButton value={row.code} size={12} />
                          </span>
                        </td>
                        {/* Email (or username) resolved server-side; the raw
                            employee UUID shows only for unresolvable legacy rows. */}
                        <td className="px-4 py-3 text-xs text-blue-300" title={row.agent || undefined}>
                          <span className="flex items-center gap-1.5">
                            {promoAgentLabel(row) || "—"}
                            <CopyButton value={promoAgentLabel(row)} size={12} />
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="bg-green-500/20 text-green-400 border border-green-500/30 rounded px-2 py-0.5 font-semibold">
                            {row.discountType === "percentage" ? `${row.discountValue}%` : `$${row.discountValue}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-300 capitalize">{row.discountType}</td>
                        <td className="px-4 py-3 text-xs text-white">{row.minPurchaseAmount}</td>
                        <td className="px-4 py-3 text-xs text-white whitespace-nowrap">{formatDateShort(row.startDate)}</td>
                        <td className="px-4 py-3 text-xs text-white whitespace-nowrap">{formatDateShort(row.endDate)}</td>
                        <td className="px-4 py-3 text-xs text-white">{row.maxUsage}</td>
                        <td className="px-4 py-3 text-xs text-blue-400 font-medium">{row.totalClaimed}</td>
                        {/* Approval status */}
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {row.approvalStatus === "pending" ? (
                            <span className="inline-flex items-center gap-1 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded px-2 py-0.5 text-[10px] font-semibold">
                              <Clock size={10} /> Pending
                            </span>
                          ) : row.approvalStatus === "rejected" ? (
                            <span className="inline-flex items-center gap-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded px-2 py-0.5 text-[10px] font-semibold">
                              <XCircle size={10} /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded px-2 py-0.5 text-[10px] font-semibold">
                              <CheckCircle size={10} /> Approved
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={row.isActive}
                              onCheckedChange={() => handlePromoToggle(row)}
                              className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500/60"
                            />
                            <span className={`text-xs font-medium ${row.isActive ? "text-green-400" : "text-red-400"}`}>
                              {row.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-orange-400 hover:text-orange-300 transition-colors">
                                <Wrench size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1a2030] text-white border border-gray-700">
                              <DropdownMenuItem onClick={() => { setEditPromo(row); setOpenPromoModal(true); }} className="cursor-pointer hover:bg-[#242B35]">
                                Edit
                              </DropdownMenuItem>
                              {row.approvalStatus === "pending" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleApprove(row.id)} className="cursor-pointer text-green-400 hover:bg-[#242B35] focus:text-green-400">
                                    <CheckCircle size={13} className="mr-1.5" /> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleReject(row.id)} className="cursor-pointer text-red-400 hover:bg-[#242B35] focus:text-red-400">
                                    <XCircle size={13} className="mr-1.5" /> Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
            {promoTotalPages > 1 && (
              // Sticky so the pager stays in view while the wide promo table is
              // scrolled sideways on a phone — it lives inside the scroller.
              <div className="sticky left-0 mt-4 pb-4">
                <Pagination currentPage={promoPage} totalPages={promoTotalPages} onPageChange={setPromoPage} />
              </div>
            )}
          </>
        )}

        {/* ── AGENTS TAB ── */}
        {activeTab === "agents" && (
        <>
        {isLoading && rows.length > 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        )}

        <table className="w-full border-collapse scrollbar-hide">
          <thead className="bg-[#242B35]">
            <tr>
              {[
                "Username",
                "Email",
                // "Package Plan",  // parked — see the matching cell below
                "Players",
                "Total Earning",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs text-white font-normal whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
                    </div>
                  </td>
                </tr>
              ) : null
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16">
                  <NoData title="No agent revenue data found" />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                return (
                  <tr
                    key={row.id}
                    className={`${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    } hover:bg-[#1a2030]`}
                  >
                    <td className="px-4 py-3 text-white text-xs">
                      <span className="flex items-center gap-1.5">
                        {row.username}
                        <CopyButton value={row.username} size={12} />
                      </span>
                    </td>

                    <td className="px-4 py-3 text-white text-xs">
                      <span className="flex items-center gap-1.5">
                        {row.email}
                        <CopyButton value={row.email} size={12} />
                      </span>
                    </td>

                    {/* Package Plan — parked for now. Header entry above is
                        commented out to match; colSpan on the empty/loading
                        rows dropped from 6 to 5. */}
                    {/* <td className="px-4 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {row.packagePlan}
                      </span>
                    </td> */}

                    <td className="px-4 py-3 text-white text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                        {row.playersCount}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-white text-xs font-medium">
                      {formatCurrency(row.totalEarning)}
                    </td>

                    <td className="px-4 py-3 text-start">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-red-400 hover:text-orange-400 transition-colors">
                            <Wrench size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          side="bottom"
                          className="bg-[#1a2030] text-white border border-gray-700 p-2 min-w-[180px]"
                        >
                          <DropdownMenuLabel className="text-gray-400 text-xs px-2 py-1.5">
                            Actions
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-gray-700 mx-1 my-1" />

                          <DropdownMenuItem
                            onClick={() => handleViewDetails(row)}
                            className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>

                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </>
        )}
      </div>

      {activeTab === "agents" && totalPages > 1 && (
        <div className="mt-4">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* ── Detail Modal ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        {/* `max-w-md` alone replaces DialogContent's own phone gutter, so the
            explicit width keeps 1rem either side on a phone. */}
        <DialogContent className="w-[calc(100%-2rem)] bg-[#191D24] text-white border-gray-800 max-w-md p-0 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-4 pb-2 border-b border-gray-800 shrink-0 md:p-6 md:pb-2">
            <DialogTitle className="text-base font-bold uppercase tracking-tight text-white">
              Revenue sharing Details
            </DialogTitle>
          </DialogHeader>

          {selectedRow && (
            <div className="px-4 space-y-2 overflow-y-auto flex-1 scrollbar-hide py-4 md:px-6">
              {/* Profile Section */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-bold text-white mb-1">
                    {selectedRow.username}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                      <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                      <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">
                        {selectedRow.playersCount} Users
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase transition-colors ${
                        selectedRow.isActive
                          ? "bg-green-500/20 text-green-500 border border-green-500/30"
                          : "bg-red-500/20 text-red-500 border border-red-500/30"
                      }`}
                    >
                      {selectedRow.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {selectedRow.isFrozen && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-orange-500/20 text-orange-500 border border-orange-500/30">
                      Frozen
                    </span>
                  )}
                </div>
              </div>

              {/* Core Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#242B35] rounded-lg p-3 space-y-1 border border-gray-700/50">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">
                    Referral Code
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-purple-400 tracking-wider">
                      {selectedRow.referralCode}
                    </p>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedRow.referralCode, "Referral Code")
                      }
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <div className="bg-[#242B35] rounded-lg p-3 space-y-1 border border-gray-700/50">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">
                    Joined Date
                  </p>
                  <p className="text-sm font-semibold text-gray-200">
                    {formatJoinedAt(selectedRow.joinedAt)?.date || "N/A"}
                  </p>
                </div>
              </div>

              {/* Package & Commission Section */}
              <div className="bg-[#242B35] rounded-lg p-3 border border-gray-700/50 space-y-1.5">
                {/* Per-category commission breakdown */}
                {Array.isArray(selectedRow.commissions) &&
                  selectedRow.commissions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">
                          Commission Breakdown
                        </p>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                          {selectedRow.packagePlan}
                        </span>
                      </div>
                      {[...(selectedRow.commissions || [])]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((c: any) => {
                          const planRate = getPlanRate(
                            selectedRow.ggrRates || {},
                            c.name,
                          );
                          const total = Number(c.baseRate) + planRate;
                          return (
                            <div
                              key={c.name}
                              className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] px-3 py-2 rounded-lg bg-[#1A1F2B] border border-white/5 hover:border-purple-500/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-gray-200 font-bold min-w-[80px]">
                                  {c.name}
                                </span>
                                <span className="text-gray-400">
                                  [{Number(c.baseRate).toFixed(1)}% (base)]
                                  <span className="mx-1 text-gray-500">+</span>
                                  <span className="text-green-500/90 font-medium">
                                    ({planRate.toFixed(1)}% package)
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">=</span>
                                <span className="text-[#B93DEB] font-black text-xs">
                                  {total.toFixed(1)}%
                                </span>
                                <span className="text-[9px] text-gray-400 ml-1 font-medium uppercase tracking-tighter">
                                  total share
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
              </div>

              {/* Stats Section in 3-column grid */}
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#2A313C] p-2 rounded-lg border border-gray-700/30">
                    <span className="text-[8px] text-gray-500 uppercase block font-bold mb-1 tracking-tighter">
                      Base Share
                    </span>
                    <span className="text-sm font-black text-white block">
                      {formatCurrency(selectedRow.baseShare)}
                    </span>
                  </div>
                  <div className="bg-[#2A313C] p-2 rounded-lg border border-gray-700/30">
                    <span className="text-[8px] text-gray-500 uppercase block font-bold mb-1 tracking-tighter">
                      Total Share
                    </span>
                    <span className="text-sm font-black text-white block">
                      {formatCurrency(selectedRow.totalShare)}
                    </span>
                  </div>
                  <div className="bg-purple-900/60 p-2 rounded-lg border border-purple-500/30 relative overflow-hidden group">
                    <span className="text-[8px] text-purple-300/80 uppercase block font-bold mb-1 tracking-tighter relative z-10">
                      Earnings
                    </span>
                    <span className="text-sm font-black text-white block relative z-10">
                      {formatCurrency(selectedRow.totalEarning)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Promo Code Create/Edit Modal ── */}
      <PromoCodeUpsertModal
        open={openPromoModal}
        data={editPromo}
        onClose={() => { setOpenPromoModal(false); setEditPromo(null); }}
        onSubmit={handlePromoUpsert}
      />

      {/* ── Commission Management Modal (Custom Rates) ── */}
      <AgentCommissionModal
        agentId={commAgent?.id || ""}
        username={commAgent?.username || ""}
        open={commOpen}
        onClose={() => {
          setCommOpen(false);
          setCommAgent(null);
          fetchRevenueData();
        }}
      />

      {/* ── Approval Settings Modal ── */}
      <Dialog open={approvalSettingsOpen} onOpenChange={setApprovalSettingsOpen}>
        <DialogContent className="w-[calc(100%-2rem)] bg-[#1a2030] border border-gray-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Settings size={16} className="text-purple-400" />
              Promo Code Approval Settings
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-1">
            Choose how agent-created promo codes are approved.
          </p>
          <div className="space-y-3 mt-1">
            {(["auto", "manual"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setApprovalMode(mode)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                  approvalMode === mode
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-gray-700 bg-[#242B35] hover:border-gray-500"
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  approvalMode === mode ? "border-purple-500" : "border-gray-500"
                }`}>
                  {approvalMode === mode && (
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold capitalize text-white">{mode === "auto" ? "Auto Approval" : "Manual Approval"}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {mode === "auto"
                      ? "Agent promo codes are approved immediately after creation."
                      : "Agent promo codes stay Pending until an admin approves them here."}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setApprovalSettingsOpen(false)}
              className="px-4 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveApprovalMode(approvalMode)}
              disabled={savingApprovalMode}
              className="px-4 py-1.5 text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {savingApprovalMode && <Loader2 size={12} className="animate-spin" />}
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
