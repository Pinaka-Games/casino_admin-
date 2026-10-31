"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { Switch } from "@/components/ui/switch";

import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import BonusUpsertModal from "./components/BonusUpsertModal";
import BonusRemoveModal from "./components/BonusRemoveModal";
import Image from "next/image";
import { create } from "@/assets/images/action";
import { BonusAPI } from "@/api";
import { Bonus, CreateBonusDto, BonusType } from "@/types/bonus";
import { toast } from "react-hot-toast";
import { RECORD_HIGHLIGHT_PARAM } from "@/config/global-search-sources";
import { useDeepLinkParam } from "@/hooks/use-deep-link-param";

/* =========================
   CONSTANTS
========================= */
const PAGE_SIZE = 10;

// ✅ Identify cashback types
const RAKEBACK_TYPES: BonusType[] = [
  BonusType.HOURLY_RAKEBACK,
  BonusType.DAILY_RAKEBACK,
  BonusType.WEEKLY_RAKEBACK,
  BonusType.MONTHLY_RAKEBACK,
];

/**
 * A bonus only reaches players when it is BOTH enabled and inside its
 * start/end window — the award queries filter on the dates as well as the
 * flag. Showing a plain "Active" for a bonus whose endDate has passed hid
 * exactly that case: an enabled-but-expired Profile Complete bonus that could
 * never be granted, while an older one silently won instead.
 */
type BonusScheduleState = "ACTIVE" | "INACTIVE" | "EXPIRED" | "SCHEDULED";

const getBonusScheduleState = (row: {
  isActive?: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}): BonusScheduleState => {
  if (!row.isActive) return "INACTIVE";

  const now = Date.now();
  const start = row.startDate ? new Date(row.startDate).getTime() : null;
  const end = row.endDate ? new Date(row.endDate).getTime() : null;

  if (end !== null && !Number.isNaN(end) && end < now) return "EXPIRED";
  if (start !== null && !Number.isNaN(start) && start > now) return "SCHEDULED";
  return "ACTIVE";
};

const BONUS_STATE_LABEL: Record<BonusScheduleState, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  EXPIRED: "Expired",
  SCHEDULED: "Scheduled",
};

const BONUS_STATE_CLASS: Record<BonusScheduleState, string> = {
  ACTIVE: "text-green-400",
  INACTIVE: "text-red-400",
  EXPIRED: "text-amber-400",
  SCHEDULED: "text-blue-400",
};

const BONUS_STATE_HINT: Record<BonusScheduleState, string> = {
  ACTIVE: "Enabled and inside its date window — can be awarded.",
  INACTIVE: "Disabled — cannot be awarded.",
  EXPIRED: "Enabled, but its end date has passed. It can NOT be awarded until the end date is extended.",
  SCHEDULED: "Enabled, but its start date is in the future. It cannot be awarded yet.",
};

const isCashbackType = (type?: BonusType) =>
  !!type && RAKEBACK_TYPES.includes(type);

// Hidden-list, not a whitelist: anything a player can actually be granted MUST
// be listed here, or it becomes a live bonus with no way to see, edit or switch
// it off. That is exactly what happened with No Deposit — the rows kept paying
// new players 50 while the admin table showed nothing.
//
// Only the rates driven from elsewhere stay out: cashback comes from VIP Tier
// Rewards and those rows read 0.00 / "VIP Tier" in every column, with one
// duplicate per past deactivation.
const ADMIN_HIDDEN_BONUS_TYPES: BonusType[] = [
  BonusType.CASHBACK,
  BonusType.HOURLY_RAKEBACK,
  BonusType.DAILY_RAKEBACK,
  BonusType.WEEKLY_RAKEBACK,
  BonusType.MONTHLY_RAKEBACK,
  BonusType.LOSSBACK,
];

const isAdminVisibleType = (type?: BonusType) =>
  !!type && !ADMIN_HIDDEN_BONUS_TYPES.includes(type);

// Listing sort order. Profile Complete leads because there is only ever one of
// it — keeping it pinned on top makes it obvious at a glance whether it exists
// and whether it is active. Retired types (Reload, Free Spins) sort last: they
// cannot be created any more, but an existing row still reaches players, so it
// has to stay visible and switchable.
const BONUS_TYPE_ORDER: BonusType[] = [
  BonusType.PROFILE_COMPLETE,
  BonusType.NO_DEPOSIT,
  BonusType.DEPOSIT_MATCH,
  BonusType.RELOAD_BONUS,
  BonusType.FREE_SPINS,
];

const BONUS_TYPE_LABELS: Record<BonusType, string> = {
  [BonusType.DEPOSIT_MATCH]: "Deposit Match",
  [BonusType.RELOAD_BONUS]: "Reload Bonus",
  [BonusType.NO_DEPOSIT]: "Welcome Bonus",
  [BonusType.PROFILE_COMPLETE]: "Profile Complete Bonus",
  [BonusType.HOURLY_RAKEBACK]: "Hourly Cashback",
  [BonusType.DAILY_RAKEBACK]: "Daily Cashback",
  [BonusType.WEEKLY_RAKEBACK]: "Weekly Cashback",
  [BonusType.MONTHLY_RAKEBACK]: "Monthly Cashback",
  [BonusType.CASHBACK]: "Instant Rebate",
  [BonusType.FREE_SPINS]: "Free Spins",
  [BonusType.LOSSBACK]: "Cashback on Net Losses (Lossback)",
};

export default function BonusListing() {
  const [rows, setRows] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [openModal, setOpenModal] = useState(false);
  const [editRow, setEditRow] = useState<Bonus | null>(null);

  const [removeRow, setRemoveRow] = useState<Bonus | null>(null);
  const [openRemoveModal, setOpenRemoveModal] = useState(false);

  // Fetch bonuses on component mount
  useEffect(() => {
    fetchBonuses();
  }, []);

  const fetchBonuses = async () => {
    try {
      setLoading(true);
      const data = await BonusAPI.getAllBonuses(false);
      setRows(data);
    } catch (error) {
      console.error("Failed to fetch bonuses:", error);
      toast.error("Failed to load bonuses");
    } finally {
      setLoading(false);
    }
  };

  const getTypeSortIndex = (type: BonusType) => {
    const idx = BONUS_TYPE_ORDER.indexOf(type);
    return idx === -1 ? BONUS_TYPE_ORDER.length : idx;
  };

  const presentTypes = useMemo(() => {
    const present = new Set(
      rows
        .map((row) => row.type as BonusType)
        .filter((type) => isAdminVisibleType(type))
    );
    return [...present].sort((a, b) => getTypeSortIndex(a) - getTypeSortIndex(b));
  }, [rows]);

  const BONUS_FILTER_DEFAULTS: FilterValues = useMemo(
    () => ({ search: "", type: "all", status: "all" }),
    []
  );

  const bonusFilterFields: FilterField[] = useMemo(
    () => [
      {
        type: "select",
        key: "type",
        label: "Bonus type",
        options: [
          { value: "all", label: "All Types" },
          // Built from the rows actually loaded, so a retired type that still
          // has a live row (Reload, Free Spins) is filterable instead of being
          // stuck in the list with no way to isolate it.
          ...presentTypes.map((type) => ({
            value: type,
            label: BONUS_TYPE_LABELS[type] ?? type,
          })),
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
    ],
    [presentTypes]
  );

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
    fields: bonusFilterFields,
    defaults: BONUS_FILTER_DEFAULTS,
  });

  const search = (filters.search ?? "").trim().toLowerCase();

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => isAdminVisibleType(row.type as BonusType))
        .filter((row) =>
          filters.type === "all" ? true : row.type === filters.type
        )
        .filter((row) =>
          filters.status === "all"
            ? true
            : (filters.status === "active") === Boolean(row.isActive)
        )
        .filter((row) =>
          search
            ? [row.name, BONUS_TYPE_LABELS[row.type as BonusType] ?? row.type]
                .filter(Boolean)
                .some((field) => String(field).toLowerCase().includes(search))
            : true
        )
        // Default order: grouped by type, then by name. A column sort below
        // replaces it entirely rather than layering on top.
        .sort((a, b) => {
          const ai = getTypeSortIndex(a.type as BonusType);
          const bi = getTypeSortIndex(b.type as BonusType);
          if (ai !== bi) return ai - bi;
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        }),
    [rows, filters, search]
  );

  const { sort, toggle } = useTableSort<
    "match" | "maxBonus" | "minDeposit" | "wagering" | "validity"
  >();
  const visibleRows = useSortedRows(filteredRows, sort, {
    match: (row) => Number(row.matchPercentage ?? 0),
    maxBonus: (row) => Number(row.maxBonus ?? 0),
    minDeposit: (row) => Number(row.minDeposit ?? 0),
    wagering: (row) => Number(row.wageringMultiplier ?? 0),
    validity: (row) => Number(row.validityDays ?? 0),
  });

  // Profile Complete and the Welcome Bonus are single-record: one of each, ever.
  // Checked against `rows` (every non-archived bonus), not the filtered page, so
  // a type filter can never make a taken slot look free.
  const profileCompleteExists = useMemo(
    () => rows.some((r) => r.type === BonusType.PROFILE_COMPLETE),
    [rows]
  );
  const welcomeBonusExists = useMemo(
    () => rows.some((r) => r.type === BonusType.NO_DEPOSIT),
    [rows]
  );

  // Manageable types that actually have a row right now, in listing order.
  // Rows the backend returned that this page deliberately does not manage.
  const hiddenRowCount = useMemo(
    () => rows.filter((row) => !isAdminVisibleType(row.type as BonusType)).length,
    [rows]
  );

  const totalPages = Math.ceil(visibleRows.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [visibleRows, currentPage]);

  /* =========================
     DEEP LINK FROM GLOBAL SEARCH
     ?highlight=<bonusId> — the header search sends the admin straight to one
     bonus. Land on the page that actually holds it, then flash the row, so a
     bonus sitting on page 3 is not silently "not found".
  ========================= */
  const highlightId = useDeepLinkParam(RECORD_HIGHLIGHT_PARAM);
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);
  // Consumed once: paging away afterwards must not yank the admin back.
  const [handledHighlight, setHandledHighlight] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId || loading || handledHighlight === highlightId) return;

    const position = visibleRows.findIndex((row) => row.id === highlightId);
    if (position === -1) return;

    setCurrentPage(Math.floor(position / PAGE_SIZE) + 1);
    setHandledHighlight(highlightId);
  }, [highlightId, loading, visibleRows, handledHighlight]);

  useEffect(() => {
    if (!highlightId) return;
    highlightedRowRef.current?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [highlightId, paginatedRows]);

  const handleUpsertBonus = async (data: CreateBonusDto) => {
    try {
      if (editRow) {
        // UPDATE
        await BonusAPI.updateBonus(editRow.id, data);
        toast.success("Bonus updated successfully");
      } else {
        // CREATE
        await BonusAPI.createBonus(data);
        toast.success("Bonus created successfully");
      }

      // Refresh the list
      await fetchBonuses();
      setOpenModal(false);
      setEditRow(null);
    } catch (error: any) {
      console.error("Failed to save bonus:", error);
      
      let errorMessage = "Failed to save bonus";
      if (error?.response?.data?.message) {
        // Handle validation errors (array of messages)
        if (Array.isArray(error.response.data.message)) {
          errorMessage = error.response.data.message.join(", ");
        } else {
          errorMessage = error.response.data.message;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const handleToggleStatus = async (row: Bonus) => {
    try {
      const updated = await BonusAPI.updateBonus(row.id, {
        isActive: !row.isActive,
      });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      toast.success(updated.isActive ? "Bonus activated" : "Bonus deactivated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update status");
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeRow) return;

    try {
      const result = await BonusAPI.deleteBonus(removeRow.id);
      // Update local state directly — calling fetchBonuses() here would run its
      // own try/catch and could fire a second toast simultaneously. An archived
      // bonus stays in the list flagged Deleted; a hard-deleted one is dropped.
      setRows((prev) => prev.filter((r) => r.id !== removeRow.id));
      toast.success(
        result.archived
          ? `Bonus archived — ${result.claimCount} existing claim${
              result.claimCount === 1 ? "" : "s"
            } will run to completion.`
          : "Bonus removed successfully",
      );
      setOpenRemoveModal(false);
      setRemoveRow(null);
    } catch (error: any) {
      console.error("Failed to delete bonus:", error);
      const raw = error?.response?.data?.message;
      const msg = Array.isArray(raw)
        ? raw.join(", ")
        : typeof raw === "string"
        ? raw
        : "Failed to delete bonus";
      toast.error(msg);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg">
        <h1 className="text-base font-normal text-white">
          Settings / Bonus Listing
        </h1>
      </div>

      {/* TOP BAR */}
      <div className="bg-[#191D24] rounded-lg p-3 mb-4 shrink-0">
        <FilterToolbar
          className="mb-0"
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search bonus name or type"
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          onResetAll={resetFilters}
          actions={
            <>
          <ExportCSV
            data={visibleRows}
            fileName="bonus_list.csv"
            getRowDate={(row) => row.createdAt}
            headers={[
              "Image URL",
              "Name",
              "Type",
              "Match %",
              "Max Bonus",
              "Min Deposit",
              "Wagering",
              "Validity",
              "Status",
            ]}
            mapRow={(row) => {
              const cashback = isCashbackType(row.type as BonusType);
              const matchPercent = Number(row.matchPercentage ?? 0);
              const cashbackPercent = Number((row as any).cashbackPercentage ?? 0);
              const isDynamicFromVipTier =
                cashback ||
                row.type === BonusType.RELOAD_BONUS ||
                (row.type === BonusType.DEPOSIT_MATCH && matchPercent <= 0);
              const percentDisplay = isDynamicFromVipTier
                ? "VIP Tier"
                : `${cashback ? cashbackPercent : matchPercent}%`;
              const percentLabel = cashback ? "Cashback" : "Match";
              return [
                row.imageUrl || "No Image",
                row.name,
                BONUS_TYPE_LABELS[row.type as BonusType] ?? row.type,
                `${percentDisplay} (${percentLabel})`,
                row.maxBonus ?? 0,
                row.minDeposit ?? 0,
                `${row.wageringMultiplier ?? 0}x`,
                cashback ? "No Validity" : `${row.validityDays ?? 0} days`,
                cashback
                  ? "VIP Tier"
                  : BONUS_STATE_LABEL[getBonusScheduleState(row)],
              ];
            }}
          />

          {/* CREATE */}
          <Button
            className="h-9 w-9 p-0 flex items-center justify-center bg-[#242B35] text-white border border-gray-600"
            title="Create bonus"
            onClick={() => {
              setEditRow(null);
              setOpenModal(true);
            }}
          >
            <Image src={create} alt="Create" width={20} height={20} />
          </Button>
            </>
          }
        />
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Bonus Filters"
        description="Narrow the bonuses this list shows."
        fields={bonusFilterFields}
        values={filters}
        defaults={BONUS_FILTER_DEFAULTS}
        onApply={setFilters}
      />

      {/* TABLE */}
      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide ">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
          </div>
        ) : (
          <table className="w-full min-w-[980px] items-center justify-center text-center table-fixed">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs text-white w-16">
                  Icon
                </th>
                <th className="px-4 py-3 text-center text-xs text-white w-24">Name</th>
                <th className="px-4 py-3 text-center text-xs text-white w-24">Type</th>
                <SortableTh
                  label="Match %"
                  sortKey="match"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-24"
                />
                <SortableTh
                  label="Max Bonus"
                  sortKey="maxBonus"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-24"
                />
                <SortableTh
                  label="Min Deposit"
                  sortKey="minDeposit"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-32"
                />
                <SortableTh
                  label="Wagering"
                  sortKey="wagering"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-28"
                />
                <SortableTh
                  label="Validity"
                  sortKey="validity"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-28"
                />
                <th className="px-4 py-3 text-center text-xs text-white w-24">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs text-white w-20">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20">
                    <NoData title="No bonus data found" />
                    {/* This page shows only the types an admin can manage here.
                        Without this note, a database full of cashback or retired
                        bonuses looked identical to an empty one, and the reason
                        the table was blank was impossible to tell from the UI. */}
                    {hiddenRowCount > 0 && (
                      <p className="mt-3 text-center text-xs text-gray-500">
                        {hiddenRowCount} cashback bonus
                        {hiddenRowCount === 1 ? "" : "es"} exist but {hiddenRowCount === 1 ? "is" : "are"}{" "}
                        not managed here — their rates are configured in VIP Tier Rewards.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => {
                  const cashback = isCashbackType(row.type as BonusType);
                  const percentLabel = cashback ? "Cashback" : "Match";
                  const cashbackPercent = Number((row as any).cashbackPercentage ?? 0);
                  const matchPercent = Number(row.matchPercentage ?? 0);
                  const isDynamicFromVipTier =
                    cashback ||
                    row.type === BonusType.RELOAD_BONUS ||
                    (row.type === BonusType.DEPOSIT_MATCH && matchPercent <= 0);
                  const percentDisplay = isDynamicFromVipTier
                    ? "VIP Tier"
                    : `${cashback ? cashbackPercent : matchPercent}%`;

                  return (
                    <tr
                      key={row.id}
                      ref={row.id === highlightId ? highlightedRowRef : undefined}
                      className={`hover:bg-[#1a2030] ${
                        index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      } ${
                        row.id === highlightId
                          ? "ring-1 ring-inset ring-[#B93DEB] bg-[#B93DEB]/10"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt={row.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-[#242B35] flex items-center justify-center text-gray-500 text-xs">
                            No Image
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-300 text-xs">
                        {row.name}
                      </td>

                      <td className="px-4 py-3 text-gray-300 text-xs capitalize">
                        {BONUS_TYPE_LABELS[row.type as BonusType] ?? row.type}
                      </td>

                      {/* ✅ Show correct % */}
                      <td className="px-4 py-3 text-blue-400 text-xs">
                        {percentDisplay}{" "}
                        <span className="text-[10px] text-gray-500">
                          ({percentLabel})
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-300 text-xs">
                        {row.maxBonus ?? 0}
                      </td>

                      <td className="px-4 py-3 text-gray-300 text-xs text-center">
                        {row.minDeposit ?? 0}
                      </td>

                      <td className="px-4 py-3 text-gray-300 text-xs text-center">
                        {row.wageringMultiplier ?? 0}x
                      </td>

                      <td className="px-4 py-3 text-gray-300 text-xs text-center">
                        {cashback ? "No Validity" : `${row.validityDays ?? 0} days`}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {cashback ? (
                          // Cashback on/off is controlled from VIP Tier Rewards,
                          // not from this row.
                          <span className="text-xs text-gray-400">VIP Tier</span>
                        ) : (
                          (() => {
                            const state = getBonusScheduleState(row);
                            return (
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={row.isActive}
                                  onCheckedChange={() => handleToggleStatus(row)}
                                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500/60"
                                />
                                <span
                                  title={BONUS_STATE_HINT[state]}
                                  className={`text-xs font-medium cursor-help ${BONUS_STATE_CLASS[state]}`}
                                >
                                  {BONUS_STATE_LABEL[state]}
                                </span>
                              </div>
                            );
                          })()
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-orange-400 hover:text-orange-300">
                              <Wrench size={16} />
                            </button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent
                            align="end"
                            className="bg-[#1a2030] text-white border border-white p-2"
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                setEditRow(row);
                                setOpenModal(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={() => {
                                setRemoveRow(row);
                                setOpenRemoveModal(true);
                              }}
                            >
                              Delete
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
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* MODAL */}
      <BonusUpsertModal
        open={openModal}
        initialData={editRow}
        // Profile Complete is a single system reward, not a campaign, and the
        // Welcome Bonus is the single no-deposit signup offer — once one exists
        // the modal drops that type from the Type list so a second cannot be
        // started. It reappears after the existing one is deleted.
        profileCompleteExists={profileCompleteExists}
        welcomeBonusExists={welcomeBonusExists}
        onClose={() => {
          setOpenModal(false);
          setEditRow(null);
        }}
        onSubmit={handleUpsertBonus}
      />

      <BonusRemoveModal
        open={openRemoveModal}
        data={removeRow}
        onClose={() => {
          setOpenRemoveModal(false);
          setRemoveRow(null);
        }}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
