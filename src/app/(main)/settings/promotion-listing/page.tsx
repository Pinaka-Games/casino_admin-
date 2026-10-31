"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PromotionDialog } from "./components/PromotionDialog";
import PromotionRemoveModal from "./components/PromotionRemoveModal";
import { usePromotionStore } from "@/store/promotion-store";
import { Promotion, PromotionType } from "@/types/promotion";
import Image from "next/image";
import { create } from "@/assets/images/action";
import ExportCSV from "@/components/ExportCSV";
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
import { Switch } from "@/components/ui/switch";

/* ================= CONSTANTS ================= */
const PAGE_SIZE = 10;

const TYPE_LABELS: Record<PromotionType, string> = {
  [PromotionType.FIRST_DEPOSIT]: "First Deposit",
  [PromotionType.SECOND_DEPOSIT]: "Second Deposit",
  [PromotionType.THIRD_DEPOSIT]: "Third Deposit",
  [PromotionType.FOURTH_DEPOSIT]: "Fourth Deposit",
  [PromotionType.FIFTH_DEPOSIT]: "Fifth Deposit",
  [PromotionType.NTH_DEPOSIT]: "Nth Deposit",
  [PromotionType.RELOAD_DEPOSIT]: "Reload Deposit",
};

/**
 * "Nth Deposit" says nothing on its own — which deposit it fires on is the
 * whole configuration, so it is shown alongside the type.
 */
const formatPromotionType = (row: Promotion): string => {
  const label = TYPE_LABELS[row.type] ?? row.type;
  if (row.type !== PromotionType.NTH_DEPOSIT) return label;
  return row.depositNumber ? `${label} (#${row.depositNumber})` : `${label} (not set)`;
};

const PROMOTION_FILTER_DEFAULTS: FilterValues = {
  search: "",
  type: "all",
  status: "all",
  minDeposit: "",
  maxDeposit: "",
};

const PROMOTION_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "type",
    label: "Promotion type",
    options: [
      { value: "all", label: "All types" },
      ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
    ],
  },
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { value: "all", label: "All" },
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
  },
  {
    type: "numberRange",
    minKey: "minDeposit",
    maxKey: "maxDeposit",
    label: "Min Deposit",
  },
];

export default function PromotionListingPage() {
  const {
    promotions,
    isLoading,
    fetchPromotions,
    deletePromotion,
    updatePromotion,
  } = usePromotionStore();
  
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Promotion | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Promotion | null>(null);
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
    fields: PROMOTION_FILTER_FIELDS,
    defaults: PROMOTION_FILTER_DEFAULTS,
  });

  /* ================= FETCH DATA ON MOUNT ================= */
  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  /* ================= FILTER + SORT ================= */
  // The whole list is in memory, so both cover every promotion rather than the
  // page on screen.
  const filteredRows = useMemo(
    () =>
      applyClientFilters(promotions, filters, {
        search: (row) => [row.name, row.description, formatPromotionType(row)],
        selects: [
          { key: "type", match: (row, v) => row.type === v },
          {
            key: "status",
            match: (row, v) => (v === "active") === Boolean(row.isActive),
          },
        ],
        numberRanges: [
          {
            minKey: "minDeposit",
            maxKey: "maxDeposit",
            get: (row) => Number(row.minDepositAmount || 0),
          },
        ],
      }),
    [promotions, filters]
  );

  const { sort, toggle } = useTableSort<
    "priority" | "minDeposit" | "maxBonus" | "percentage" | "validity"
  >();
  const visibleRows = useSortedRows(filteredRows, sort, {
    priority: (row) => Number(row.priority || 0),
    minDeposit: (row) => Number(row.minDepositAmount || 0),
    // Null means "no cap", which sorts as a blank rather than as zero.
    maxBonus: (row) =>
      row.maxBonusAmount == null ? null : Number(row.maxBonusAmount),
    percentage: (row) => Number(row.bonusPercentage || 0),
    validity: (row) => Number(row.validityDays || 0),
  });

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(visibleRows.length / PAGE_SIZE);

  // Clamped at render rather than reset from an effect: filtering can shrink
  // the list below the page being viewed, and an effect for that costs an extra
  // render pass to show the same rows.
  const page = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [visibleRows, page]);

  /* ================= ACTIONS ================= */
  const openCreate = () => {
    setSelected(null);
    setOpen(true);
  };

  const openEdit = (row: Promotion) => {
    setSelected(row);
    setOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    await deletePromotion(removeTarget.id);
    setRemoveTarget(null);
  };

  const handleToggleStatus = async (row: Promotion) => {
    try {
      await updatePromotion(row.id, { isActive: !row.isActive });
    } catch {
      // store surfaces the error toast
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#15181E] p-3 md:p-6">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-3 rounded-lg">
        <h1 className="text-base font-normal text-white">
          Settings / Promotion Listing
        </h1>
      </div>

      {/* TOP BAR */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-4 shrink-0">
        <div>
          <FilterToolbar
            className="mb-0"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search name, description or type"
            activeCount={activeCount}
            chips={chips}
            hasAnyFilter={hasAnyFilter}
            onOpenFilters={() => setSheetOpen(true)}
            onResetAll={resetFilters}
            actions={
              <>
          <ExportCSV
            data={promotions}
            fileName="promotions.csv"
            getRowDate={(row) => row.createdAt}
            headers={[
              "Name",
              "Description",
              "Type",
              "Priority",
              "Min Deposit",
              "Max Bonus",
              "Bonus Percentage",
              "Validity",
              "Status",
            ]}
            mapRow={(row) => [
              row.name,
              row.description || "-",
              formatPromotionType(row),
              row.priority,
              row.minDepositAmount,
              row.maxBonusAmount ?? "-",
              `${row.bonusPercentage}%`,
              `${row.validityDays} days`,
              row.isActive ? "Active" : "Inactive",
            ]}
          />

          <Button
            variant="outline"
            size="icon"
            className="border-gray-600"
            onClick={openCreate}
          >
            <Image src={create} alt="Create" width={20} height={20} />
          </Button>
                </>
            }
          />
        </div>
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Promotion Filters"
        description="Narrow the promotions this list shows."
        fields={PROMOTION_FILTER_FIELDS}
        values={filters}
        defaults={PROMOTION_FILTER_DEFAULTS}
        onApply={setFilters}
      />

      {/* TABLE */}
      <div className="flex-1 overflow-auto bg-[#15181E] rounded-lg">
        <table className="w-full min-w-[1150px] table-fixed">
          <thead className="bg-[#242B35]">
            <tr>
              {/* The numeric columns sort; the text ones are what search is
                  for, so they stay plain headers. */}
              {["Name", "Description", "Type"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs text-white">
                  {h}
                </th>
              ))}
              {(
                [
                  ["Priority", "priority"],
                  ["Min Deposit", "minDeposit"],
                  ["Max Bonus", "maxBonus"],
                  ["Bonus Percentage", "percentage"],
                  ["Validity", "validity"],
                ] as const
              ).map(([label, key]) => (
                <SortableTh
                  key={key}
                  label={label}
                  sortKey={key}
                  sort={sort}
                  onToggle={toggle}
                  className="px-4 py-3 text-left text-xs text-white"
                />
              ))}
              {["Status", "Action"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs text-white">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-gray-400">
                  Loading promotions...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16">
                  <NoData
                    title={
                      hasAnyFilter
                        ? "No promotions match these filters"
                        : "No promotions found"
                    }
                  />
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={row.id}
                  className={`${
                    index % 2 === 0
                      ? "bg-[#191D24]"
                      : "bg-[#161A21]"
                  } hover:bg-[#1a2030]`}
                >
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300 truncate">
                    {row.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {formatPromotionType(row)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.priority}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.minDepositAmount}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.maxBonusAmount || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.bonusPercentage}%
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {row.validityDays} days
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.isActive}
                        onCheckedChange={() => handleToggleStatus(row)}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500/60"
                      />
                      <span
                        className={`text-xs font-medium ${
                          row.isActive ? "text-green-400" : "text-red-400"
                        }`}
                      >
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

                      <DropdownMenuContent
                        align="end"
                        className="bg-[#1a2030] text-white border border-gray-600"
                      >
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400"
                          onClick={() => setRemoveTarget(row)}
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
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* MODAL */}
      <PromotionDialog
        open={open}
        onOpenChange={setOpen}
        data={selected}
      />

      {/* REMOVE CONFIRM MODAL */}
      <PromotionRemoveModal
        open={!!removeTarget}
        data={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
