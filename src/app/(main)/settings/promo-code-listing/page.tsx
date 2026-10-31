"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import FilterToolbar from "@/components/filters/FilterToolbar";
import CopyButton from "@/components/CopyButton";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import NoData from "@/components/NoData";

import PromoCodeUpsertModal from "./components/PromoCodeUpsertModal";
import {
  PromoCodesFilterSheet,
  PromoCodesFilters,
  DEFAULT_PROMO_FILTERS,
} from "./components/PromoCodesFilterSheet";
import Image from "next/image";
import { create } from "@/assets/images/action";
import toast from "react-hot-toast";

import {
  PromoCode,
  CreatePromoCodeDto,
  getAllPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from "@/api/promo-codes/promo-codes.api";
import { profileApi } from "@/api/users/users";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 10;

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

  const [promoFilters, setPromoFilters] = useState<PromoCodesFilters>(
    DEFAULT_PROMO_FILTERS
  );
  const [filterOpen, setFilterOpen] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [editRow, setEditRow] = useState<PromoCode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [agentMap, setAgentMap] = useState<
    Record<string, { name: string; email: string }>
  >({});

  useEffect(() => {
    profileApi.getAllAgents({ limit: 1000 }).then((res) => {
      const map: Record<string, { name: string; email: string }> = {};
      for (const a of res.data.data ?? []) {
        const email = (a as any).entity ?? a.email ?? a.profile?.email ?? "";
        const label = a.username ?? a.profile?.fullName ?? a.id;
        map[a.id] = { name: label, email };
      }
      setAgentMap(map);
    }).catch(() => {});
  }, []);

  // Flatten an agent id to "Name (email)" for CSV/Excel export.
  const agentLabel = (id: string) => {
    const a = agentMap[id];
    if (!a) return id;
    return a.email ? `${a.name} (${a.email})` : a.name;
  };

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllPromoCodes();
      const now = new Date();
      const expired = data.filter(
        (r) => r.isActive && r.endDate && new Date(r.endDate) < now
      );
      const updates = await Promise.allSettled(
        expired.map((r) => updatePromoCode(r.id, { isActive: false }))
      );
      const updatedMap = new Map<string, PromoCode>();
      expired.forEach((r, i) => {
        const res = updates[i];
        if (res.status === "fulfilled") updatedMap.set(r.id, res.value);
      });
      const merged = data.map((r) => updatedMap.get(r.id) ?? r);
      setRows(merged);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const filtersActive = useMemo(() => {
    return (
      promoFilters.discountType !== "all" ||
      promoFilters.status !== "all" ||
      !!promoFilters.startDateFrom ||
      !!promoFilters.endDateTo ||
      promoFilters.createdAtRange !== "all"
    );
  }, [promoFilters]);

  const filtered = useMemo(() => {
    let result = rows;

    const q = search.toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q)
      );
    }

    if (promoFilters.discountType !== "all") {
      result = result.filter((r) => r.discountType === promoFilters.discountType);
    }

    if (promoFilters.status !== "all") {
      const active = promoFilters.status === "active";
      result = result.filter((r) => r.isActive === active);
    }

    const checkDateRange = (
      dateStr: string | null | undefined,
      range: string,
      from: string,
      to: string
    ) => {
      if (range === "all") return true;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const now = new Date();

      if (range === "7d") {
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        return d >= start && d <= now;
      }
      if (range === "30d") {
        const start = new Date(now);
        start.setDate(now.getDate() - 30);
        return d >= start && d <= now;
      }
      if (range === "custom") {
        const fromDate = from ? new Date(`${from}T00:00:00`) : null;
        const toDate = to ? new Date(`${to}T23:59:59`) : null;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      }
      return true;
    };

    if (promoFilters.startDateFrom) {
      const fromDate = new Date(`${promoFilters.startDateFrom}T00:00:00`);
      result = result.filter((r) => {
        if (!r.startDate) return false;
        return new Date(r.startDate) >= fromDate;
      });
    }

    if (promoFilters.endDateTo) {
      const toDate = new Date(`${promoFilters.endDateTo}T23:59:59`);
      result = result.filter((r) => {
        if (!r.endDate) return false;
        return new Date(r.endDate) <= toDate;
      });
    }

    if (promoFilters.createdAtRange !== "all") {
      result = result.filter((r) =>
        checkDateRange(r.createdAt, promoFilters.createdAtRange, promoFilters.createdAtFrom, promoFilters.createdAtTo)
      );
    }

    return result;
  }, [rows, search, promoFilters]);

  const { sort, toggle } = useTableSort<
    | "code"
    | "minPurchase"
    | "startDate"
    | "endDate"
    | "createdAt"
    | "totalClaimed"
    | "maxUsage"
    | "maxPerUser"
  >();
  const sortedRows = useSortedRows(filtered, sort, {
    code: (row) => row.code ?? "",
    minPurchase: (row) => Number(row.minPurchaseAmount ?? 0),
    startDate: (row) => (row.startDate ? new Date(row.startDate).getTime() : null),
    endDate: (row) => (row.endDate ? new Date(row.endDate).getTime() : null),
    createdAt: (row) => new Date(row.createdAt).getTime(),
    totalClaimed: (row) => Number(row.totalClaimed ?? 0),
    maxUsage: (row) => Number(row.maxUsage ?? 0),
    maxPerUser: (row) => Number(row.maxUsagePerUser ?? 0),
  });

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  const handleUpsert = async (data: CreatePromoCodeDto, id?: string) => {
    if (id) {
      const updated = await updatePromoCode(id, data);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } else {
      const created = await createPromoCode(data);
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
      await deletePromoCode(deleteId);
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      toast.success("Promo code deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggleStatus = async (row: PromoCode) => {
    try {
      const updated = await updatePromoCode(row.id, { isActive: !row.isActive });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update status");
    }
  };

  const getDiscountLabel = (row: PromoCode) => {
    if (row.discountType === "percentage") return `${row.discountValue}%`;
    return `$${row.discountValue}`;
  };

  const openCreate = () => {
    setEditRow(null);
    setOpenModal(true);
  };

  return (
    <div className="h-full bg-[#15181E] p-3 md:p-6">
      <div className="h-full grid grid-rows-[auto_auto_1fr_auto] gap-4">

        {/* HEADER */}
        <div className="bg-[#191D24] px-4 py-3 rounded-lg">
          <h1 className="text-base font-normal text-white">
            Settings / Promo Code Listing
          </h1>
        </div>

        {/* TOP BAR */}
        <div className="bg-[#191D24] rounded-lg p-2">
          <FilterToolbar
            className="mb-0"
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search code…"
            activeCount={filtersActive ? 1 : 0}
            onOpenFilters={() => setFilterOpen(true)}
            actions={
              <>
            <ExportCSV
              data={rows}
              fileName="promo_codes.csv"
              getRowDate={(r) => r.createdAt}
              headers={[
                "Code", "Discount", "Type", "Min Purchase",
                "Start Date", "End Date", "Created At",
                "Total Claimed", "Max Usage", "Max/User",
                "Assigned Agent", "Status",
              ]}
              mapRow={(r) => [
                r.code,
                getDiscountLabel(r),
                r.discountType,
                r.minPurchaseAmount,
                formatDateShort(r.startDate),
                formatDateShort(r.endDate),
                formatDateShort(r.createdAt),
                r.totalClaimed,
                r.maxUsage,
                r.maxUsagePerUser,
                r.agent ? agentLabel(r.agent) : "—",
                r.isActive ? "Active" : "Inactive",
              ]}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 p-0 flex items-center justify-center bg-[#242B35] text-white border border-gray-600 shrink-0"
              onClick={openCreate}
              title="Create Promo Code"
            >
              <Image src={create} alt="Create" width={20} height={20} />
            </Button>
              </>
            }
          />
        </div>

        {/* TABLE */}
        <div className="bg-[#15181E] rounded-lg overflow-hidden">
          <div className="h-full overflow-y-auto overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <table className="min-w-[1400px] w-full">
                <thead className="bg-[#242B35] sticky top-0 z-10">
                  <tr>
                    {/* Dates, counts and the code sort. Discount, Type,
                        Assigned Agent, Status and Action do not — they are
                        either badges or a single control. */}
                    {(
                      [
                        ["Code", "code"],
                        ["Discount", null],
                        ["Type", null],
                        ["Min Purchase", "minPurchase"],
                        ["Start Date", "startDate"],
                        ["End Date", "endDate"],
                        ["Created At", "createdAt"],
                        ["Total Claimed", "totalClaimed"],
                        ["Max Usage", "maxUsage"],
                        ["Max/User", "maxPerUser"],
                        ["Assigned Agent", null],
                        ["Status", null],
                        ["Action", null],
                      ] as const
                    ).map(([label, key]) =>
                      key ? (
                        <SortableTh
                          key={label}
                          label={label}
                          sortKey={key}
                          sort={sort}
                          onToggle={toggle}
                          className="px-4 py-3 text-xs text-white text-left whitespace-nowrap"
                        />
                      ) : (
                        <th
                          key={label}
                          className="px-4 py-3 text-xs text-white text-left whitespace-nowrap"
                        >
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-20">
                        <NoData title="No promo codes found" />
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-[#1a2030]">
                        <td className="px-4 py-3 text-xs text-purple-300 font-mono font-bold tracking-wider">
                          <span className="flex items-center gap-1.5">
                            {row.code}
                            <CopyButton value={row.code} size={12} />
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="bg-green-500/20 text-green-400 border border-green-500/30 rounded px-2 py-0.5 font-semibold">
                            {getDiscountLabel(row)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-300 capitalize">
                          {row.discountType}
                        </td>
                        <td className="px-4 py-3 text-xs text-white">
                          {row.minPurchaseAmount}
                        </td>
                        <td className="px-4 py-3 text-xs text-white whitespace-nowrap">
                          {formatDateShort(row.startDate)}
                        </td>
                        <td className="px-4 py-3 text-xs text-white whitespace-nowrap">
                          {formatDateShort(row.endDate)}
                        </td>
                        <td className="px-4 py-3 text-xs text-white whitespace-nowrap">
                          {formatDateShort(row.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-xs text-blue-400 font-medium">
                          {row.totalClaimed}
                        </td>
                        <td className="px-4 py-3 text-xs text-white">{row.maxUsage}</td>
                        <td className="px-4 py-3 text-xs text-white">{row.maxUsagePerUser}</td>
                        <td className="px-4 py-3 text-xs">
                          {row.agent ? (
                            <div className="flex flex-col max-w-[180px] leading-tight">
                              <span className="text-purple-300 font-medium truncate">
                                {agentMap[row.agent]?.name ?? row.agent}
                              </span>
                              {agentMap[row.agent]?.email && (
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-gray-500 truncate">
                                    {agentMap[row.agent]?.email}
                                  </span>
                                  <CopyButton
                                    value={agentMap[row.agent]?.email}
                                    size={11}
                                  />
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={row.isActive}
                              onCheckedChange={() => handleToggleStatus(row)}
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
                              <button className="text-orange-400">
                                <Wrench size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditRow(row);
                                  setOpenModal(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(row.id)}
                                className="text-red-400 focus:text-red-400"
                              >
                                Delete
                              </DropdownMenuItem>
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
          onClose={() => { setOpenModal(false); setEditRow(null); }}
          onSubmit={handleUpsert}
        />

        <PromoCodesFilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          filters={promoFilters}
          onApply={(f) => {
            setPromoFilters(f);
            setPage(1);
          }}
        />

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
