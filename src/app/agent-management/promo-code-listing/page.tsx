"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Wrench, Clock, Eye, X, Copy, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatureAccess } from "@/hooks/use-feature-access";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import TableSkeleton from "@/components/TableSkeleton";

import PromoCodeUpsertModal from "./components/PromoCodeUpsertModal";
import CopyButton from "@/components/CopyButton";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { create } from "@/assets/images/action";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/api-error";

import {
  PromoCode,
  CreatePromoCodeDto,
  getAllAgentPromoCodes,
  createAgentPromoCode,
  updateAgentPromoCode,
  deleteAgentPromoCode,
} from "@/api/promo-codes/promo-codes-agent.api";
import { agentGetCurrentPackage } from "@/api/package/agent-package.api";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import {
  PAGE_HEAD,
  PAGE_SHELL,
  PAGE_TITLE,
  TOOLBAR,
  TOOLBAR_SEARCH,
} from "@/app/agent-management/components/responsive";

const PAGE_SIZE = 10;

/**
 * Columns are consolidated (discount+type, min–max, start→end, usage) so the
 * table fits the viewport. It used to be 15 columns at a 1400px min-width
 * inside a hidden-scrollbar container, which read as a broken layout.
 */
const TABLE_HEADERS: { label: string; width: string }[] = [
  { label: "Code", width: "w-[16%]" },
  { label: "Discount", width: "w-[10%]" },
  { label: "Purchase (Min – Max)", width: "w-[13%]" },
  { label: "Validity", width: "w-[16%]" },
  { label: "Usage", width: "w-[11%]" },
  { label: "Source", width: "w-[10%]" },
  { label: "Approval", width: "w-[9%]" },
  { label: "Status", width: "w-[10%]" },
  { label: "Action", width: "w-[5%]" },
];

function formatDateShort(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function PromoCodeListing() {
  const [rows, setRows] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [editRow, setEditRow] = useState<PromoCode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewRow, setViewRow] = useState<PromoCode | null>(null);
  const [promoDiscountRule, setPromoDiscountRule] = useState<{
    minPurchase: number;
    maxPurchase: number;
    maxPercent: number;
  } | null>(null);
  const [packageDateRange, setPackageDateRange] = useState<{
    startsAt: Date | null;
    endsAt: Date | null;
  }>({ startsAt: null, endsAt: null });

  const { canManagePromoCodes, isLoaded } = useFeatureAccess();

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllAgentPromoCodes();
      setRows(data);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to load promo codes"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  useEffect(() => {
    const loadCurrentPackageRule = async () => {
      try {
        const pkg = await agentGetCurrentPackage();
        const features = pkg?.package?.features ?? {};
        const minPurchase = Number(features?.promoDiscountMinPurchase ?? 0) || 0;
        const maxPurchase = Number(features?.promoDiscountMaxPurchase ?? 0) || 0;
        const maxPercent = Number(features?.promoDiscountPercent ?? 0) || 0;
        setPromoDiscountRule({ minPurchase, maxPurchase, maxPercent });
        // The package payload has used both spellings over time.
        const pkgDates = pkg as {
          startsAt?: string;
          startDate?: string;
          endsAt?: string;
          endDate?: string;
        } | null;
        const startsAtRaw = pkgDates?.startsAt ?? pkgDates?.startDate ?? null;
        const endsAtRaw = pkgDates?.endsAt ?? pkgDates?.endDate ?? null;
        setPackageDateRange({
          startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
          endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        });
      } catch {
        setPromoDiscountRule(null);
        setPackageDateRange({ startsAt: null, endsAt: null });
      }
    };
    loadCurrentPackageRule();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        (r.agent ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleUpsert = async (data: CreatePromoCodeDto, id?: string) => {
    if (id) {
      const updated = await updateAgentPromoCode(id, data);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } else {
      const created = await createAgentPromoCode(data);
      setRows((prev) => [created, ...prev]);
    }
    setOpenModal(false);
    setEditRow(null);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAgentPromoCode(deleteId);
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      toast.success("Promo code deleted");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to delete"));
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggleStatus = async (row: PromoCode) => {
    try {
      const updated = await updateAgentPromoCode(row.id, { isActive: !row.isActive });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    }
  };

  const getDiscountLabel = (row: PromoCode) => {
    if (row.discountType === "percentage") return `${row.discountValue}%`;
    return `$${row.discountValue}`;
  };

  if (isLoaded && !canManagePromoCodes) {
    return (
      <div className="h-full bg-[#15181E] flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <div className="bg-[#191D24] p-6 sm:p-10 rounded-2xl border border-white/5 shadow-2xl max-w-md w-full">
          <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/20">
            <Wrench className="text-purple-500 w-10 h-10" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Feature Locked</h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed text-balance">
            Promo Code Listing is not available in your current plan. Please upgrade your package to start using this feature.
          </p>
          <Button 
            onClick={() => window.location.href = '/agent-management/agent-package-mgt'}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-6 rounded-xl transition-all"
          >
            Upgrade Plan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-1 md:min-h-0">

        {/* HEADER */}
        <div className={PAGE_HEAD}>
          <h1 className={PAGE_TITLE}>
            Agent Management / Promo Code Listing
          </h1>
        </div>

        {/* TOP BAR — search separate, same as other pages */}
        <div className={TOOLBAR}>
          <div className={TOOLBAR_SEARCH}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
            <Input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search code, agent…"
              className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm h-10 pl-10 focus:ring-1 focus:ring-purple-500/30 font-medium"
            />
          </div>
          <Button
            className="h-10 w-10 p-0 flex items-center justify-center bg-[#242B35] text-gray-400 hover:text-white border-none shrink-0"
            onClick={() => { setEditRow(null); setOpenModal(true); }}
            title="Create new"
          >
            <Image src={create} alt="Create" width={18} height={18} />
          </Button>
        </div>

        {/* TABLE */}
        <div className="bg-[#15181E] rounded-lg overflow-hidden">
          <div className="h-full overflow-y-auto overflow-x-auto agent-x-scroll scrollbar-hide">
            {loading ? (
              <table className="w-full table-fixed min-w-[1120px] lg:min-w-0">
                <thead className="bg-[#242B35]">
                  <tr>
                    {TABLE_HEADERS.map((h) => (
                      <th
                        key={h.label}
                        className={`px-3 sm:px-4 py-3 text-xs text-white text-left font-normal whitespace-nowrap ${h.width}`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: PAGE_SIZE }).map((_, rowIndex) => (
                    <tr
                      key={`promo-skeleton-${rowIndex}`}
                      className={rowIndex % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}
                    >
                      {TABLE_HEADERS.map((h, cellIndex) => (
                        <td key={h.label} className="px-4 py-3">
                          <Skeleton
                            className="h-3 bg-gray-700/40"
                            style={{ width: `${50 + ((cellIndex * 17) % 40)}%` }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full table-fixed min-w-[1120px] lg:min-w-0">
                <thead className="bg-[#242B35] sticky top-0 z-10">
                  <tr>
                    {TABLE_HEADERS.map((h) => (
                      <th
                        key={h.label}
                        className={`px-3 sm:px-4 py-3 text-xs text-white text-left font-normal whitespace-nowrap ${h.width}`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={TABLE_HEADERS.length} className="py-20">
                        <NoData title="No promo codes found" />
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, index) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-[#1a2030] ${
                          index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-purple-300 font-mono font-bold tracking-wider truncate">
                              {row.code}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(row.code);
                                toast.success("Code copied");
                              }}
                              title="Copy code"
                              className="shrink-0 text-gray-600 hover:text-purple-400 transition-colors"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                          {row.description && (
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">
                              {row.description}
                            </p>
                          )}
                        </td>

                        {/* Discount value carries its own type, so the old
                            separate "Type" column was redundant. */}
                        <td className="px-4 py-3 text-xs">
                          <span className="bg-green-500/20 text-green-400 border border-green-500/30 rounded px-2 py-0.5 font-semibold">
                            {getDiscountLabel(row)}
                          </span>
                          <p className="text-[10px] text-gray-500 capitalize mt-1">
                            {row.discountType}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-xs text-white whitespace-nowrap">
                          {row.minPurchaseAmount || 0}
                          <span className="text-gray-600"> – </span>
                          {row.maxPurchaseAmount != null ? row.maxPurchaseAmount : "∞"}
                        </td>

                        <td className="px-4 py-3 text-xs text-gray-300 leading-4">
                          <span className="block whitespace-nowrap">
                            {formatDateShort(row.startDate)}
                          </span>
                          <span className="block text-gray-500 whitespace-nowrap">
                            → {formatDateShort(row.endDate)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span className="text-blue-400 font-medium">
                            {row.totalClaimed}
                          </span>
                          <span className="text-gray-500"> / {row.maxUsage}</span>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {row.maxUsagePerUser} per user
                          </p>
                        </td>

                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {row.isAdminAssigned ? (
                            <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded px-2 py-0.5 text-[10px] font-semibold">
                              Admin Assigned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded px-2 py-0.5 text-[10px] font-semibold">
                              Self Created
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {row.approvalStatus === "pending" ? (
                            <span className="inline-flex items-center gap-1 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded px-2 py-0.5 text-[10px] font-semibold">
                              <Clock size={10} /> Pending
                            </span>
                          ) : row.approvalStatus === "rejected" ? (
                            <span className="inline-flex items-center gap-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded px-2 py-0.5 text-[10px] font-semibold">
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded px-2 py-0.5 text-[10px] font-semibold">
                              Approved
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {/* Rejected codes cannot be activated either — the
                                API rejects it, so don't offer the toggle. */}
                            <Switch
                              checked={row.isActive}
                              disabled={row.approvalStatus !== "approved"}
                              onCheckedChange={() => handleToggleStatus(row)}
                              title={
                                row.approvalStatus === "pending"
                                  ? "Awaiting admin approval"
                                  : row.approvalStatus === "rejected"
                                    ? "Rejected by admin"
                                    : undefined
                              }
                              className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500/60 disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                            <span
                              className={`text-xs font-medium ${
                                row.approvalStatus === "pending"
                                  ? "text-yellow-400"
                                  : row.approvalStatus === "rejected"
                                    ? "text-red-400"
                                    : row.isActive
                                      ? "text-green-400"
                                      : "text-gray-400"
                              }`}
                            >
                              {row.approvalStatus === "pending"
                                ? "Pending"
                                : row.approvalStatus === "rejected"
                                  ? "Rejected"
                                  : row.isActive
                                    ? "Active"
                                    : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-orange-400 hover:text-orange-300 transition-colors" title="Actions">
                                <Wrench size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewRow(row)}>
                                View Details
                              </DropdownMenuItem>
                              {!row.isAdminAssigned && (
                                <>
                                  <DropdownMenuItem onClick={() => { setEditRow(row); setOpenModal(true); }}>
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(row.id)}
                                    className="text-red-400 focus:text-red-400"
                                  >
                                    Delete
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
          </div>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}

        <PromoCodeUpsertModal
          open={openModal}
          data={editRow}
          promoDiscountRule={promoDiscountRule}
          packageDateRange={packageDateRange}
          onClose={() => { setOpenModal(false); setEditRow(null); }}
          onSubmit={handleUpsert}
        />

        {/* View Details modal — full promo code detail for any row */}
        {viewRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setViewRow(null)}>
            <div className="bg-[#191D24] border border-gray-700 rounded-xl p-4 sm:p-6 w-full max-w-md text-white max-h-[92dvh] overflow-y-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Promo Code Details</h2>
                <button onClick={() => setViewRow(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-3 text-sm">
                {([
                  ["Code", <span key="code" className="font-mono font-bold text-purple-300">{viewRow.code}</span>],
                  ["Discount", viewRow.discountType === "percentage" ? `${viewRow.discountValue}%` : `$${viewRow.discountValue}`],
                  ["Type", <span key="type" className="capitalize">{viewRow.discountType}</span>],
                  ["Min Purchase", viewRow.minPurchaseAmount ? `$${viewRow.minPurchaseAmount}` : "No minimum"],
                  ["Max Purchase", viewRow.maxPurchaseAmount ? `$${viewRow.maxPurchaseAmount}` : "No limit"],
                  ["Total Claimed", <span key="claimed" className="text-blue-400">{viewRow.totalClaimed}</span>],
                  ["Max Usage", viewRow.maxUsage],
                  ["Max/User", viewRow.maxUsagePerUser],
                  ["Start Date", formatDateShort(viewRow.startDate)],
                  ["End Date", formatDateShort(viewRow.endDate)],
                  ["Created At", formatDateShort(viewRow.createdAt)],
                  ["Source", viewRow.isAdminAssigned
                    ? <span key="source" className="text-blue-400">Admin Assigned</span>
                    : <span key="source" className="text-purple-400">Self Created</span>],
                  ["Approval", viewRow.approvalStatus === "pending"
                    ? <span key="appr" className="text-yellow-400">Pending</span>
                    : viewRow.approvalStatus === "rejected"
                    ? <span key="appr" className="text-red-400">Rejected</span>
                    : <span key="appr" className="text-green-400">Approved</span>],
                  ["Status", viewRow.isActive ? <span key="status" className="text-green-400">Active</span> : <span key="status" className="text-red-400">Inactive</span>],
                ] as [string, React.ReactNode][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                    <span className="text-gray-400 text-xs">{label}</span>
                    <span className="text-xs font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <AlertDialogContent className="bg-[#101318] text-white border border-white/10">
            <AlertDialogHeader>Confirm Delete?</AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={confirmDelete}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
