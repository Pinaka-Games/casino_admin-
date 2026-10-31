"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type {
  PerformanceSortKey,
  PlayerPerformanceRow,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import type { SortDir } from "@/store/player-performance-store";
import { TableSkeletonRows } from "@/components/report/ReportSkeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import NoData from "@/components/NoData";
import CopyValueButton from "./CopyValueButton";
import {
  COLUMN_GROUPS,
  PERFORMANCE_COLUMNS,
  columnHeader,
  playerIdentity,
  renderCell,
  tierLabel,
  type ColumnGroupId,
  type PerformanceColumn,
} from "./columns";

// The player detail Performance tab is commented out for now, so a row opens
// the profile on its default tab; restore `?tab=Performance` when that tab
// comes back.
export const playerPerformanceHref = (userId: string) =>
  `/users/players-list/${encodeURIComponent(userId)}`;

// The player column stays pinned while the metric columns scroll under it —
// from sm up only: on a phone it would cover most of the viewport.
const PLAYER_CELL =
  "sm:sticky sm:left-0 min-w-[220px] max-w-[290px] sm:min-w-[250px] sm:shadow-[6px_0_8px_-6px_rgba(0,0,0,0.7)]";

const HEADER_TEXT = "text-xs font-medium uppercase tracking-wider text-white";

function ColumnHeader({
  label,
  description,
  sortKey,
  sortBy,
  sortDir,
  onSort,
  align = "right",
  className = "",
  sortable = true,
}: {
  label: string;
  description: string;
  /** Absent: the column has no server sort, so the header only explains it. */
  sortKey?: PerformanceSortKey;
  sortBy: PerformanceSortKey;
  sortDir: SortDir;
  onSort: (key: PerformanceSortKey) => void;
  align?: "left" | "right";
  className?: string;
  /** False where the metric has no values in this view (Bonus/Dep % on Wulf Coins). */
  sortable?: boolean;
}) {
  const canSort = sortable && sortKey !== undefined;
  const active = canSort && sortBy === sortKey;
  const alignClass = align === "right" ? "ml-auto justify-end" : "";
  return (
    <th
      scope="col"
      aria-sort={canSort ? (active ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined}
      className={`whitespace-nowrap px-4 py-3 ${HEADER_TEXT} ${className}`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          {sortKey !== undefined ? (
            <button
              type="button"
              // aria-disabled, not disabled: a disabled button gets no pointer
              // events, so the definition tooltip would never open.
              onClick={() => canSort && onSort(sortKey)}
              aria-disabled={!canSort}
              className={`flex items-center gap-1 uppercase transition-colors ${
                canSort ? "hover:text-[#B93DEB]" : "cursor-default text-gray-500"
              } ${alignClass} ${active ? "text-[#B93DEB]" : ""}`}
            >
              {label}
              {!active && canSort && <ChevronsUpDown size={12} className="text-gray-400" />}
              {active && sortDir === "desc" && <ChevronDown size={12} />}
              {active && sortDir === "asc" && <ChevronUp size={12} />}
            </button>
          ) : (
            // Focusable so keyboard users can still reach the definition.
            <span tabIndex={0} className={`flex cursor-default items-center uppercase ${alignClass}`}>
              {label}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-left font-normal normal-case">
          {description}
        </TooltipContent>
      </Tooltip>
    </th>
  );
}

function StatusDot({ row }: { row: PlayerPerformanceRow }) {
  if (!row.isActive) {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-red-500"
        title="Account inactive"
        aria-label="Account inactive"
        role="img"
      />
    );
  }
  if (row.rgStatus && row.rgStatus !== "ACTIVE") {
    const label = `Responsible gaming: ${row.rgStatus.replace(/_/g, " ").toLowerCase()}`;
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
        title={label}
        aria-label={label}
        role="img"
      />
    );
  }
  // Keeps names aligned whether or not a row has a dot.
  return <span className="h-2 w-2 shrink-0" aria-hidden />;
}

/** Email first (else phone, else username), username beneath — each copyable. */
function PlayerCell({ row }: { row: PlayerPerformanceRow }) {
  const id = playerIdentity(row);
  const tier = tierLabel(row.tierName);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <StatusDot row={row} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          {/* A real link, so the player can be opened in a new tab. */}
          <Link
            href={playerPerformanceHref(row.userId)}
            onClick={(e) => e.stopPropagation()}
            title={id.primary}
            className="truncate font-semibold text-white hover:text-[#B93DEB]"
          >
            {id.primary}
          </Link>
          <CopyValueButton value={id.primary} what={id.kind} />
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-500">
          {id.kind !== "username" ? (
            <>
              <span className="truncate" title={row.username}>
                {row.username}
              </span>
              <CopyValueButton value={row.username} what="username" size={11} />
            </>
          ) : (
            <span className="truncate text-gray-600">No email or phone</span>
          )}
          {tier && (
            <span className="ml-1 shrink-0 rounded border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-[#F59E0B]">
              {tier}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PerformanceTable({
  rows,
  limit,
  currency,
  sortBy,
  sortDir,
  onSort,
  skeleton,
  dimmed,
  hiddenGroups,
  onRowClick,
  emptyAction,
}: {
  rows: PlayerPerformanceRow[];
  limit: number;
  currency: ReportCurrency;
  sortBy: PerformanceSortKey;
  sortDir: SortDir;
  onSort: (key: PerformanceSortKey) => void;
  /** First load only: nothing to show yet. */
  skeleton: boolean;
  /** A refetch is replacing what is shown: keep it, but dimmed. */
  dimmed: boolean;
  hiddenGroups: Set<ColumnGroupId>;
  onRowClick: (userId: string) => void;
  emptyAction?: ReactNode;
}) {
  const visibleGroups = new Set(
    COLUMN_GROUPS.filter((g) => !hiddenGroups.has(g.id)).map((g) => g.id),
  );
  // Group order, then column order within it.
  const columns: PerformanceColumn[] = COLUMN_GROUPS.flatMap((g) =>
    visibleGroups.has(g.id) ? PERFORMANCE_COLUMNS.filter((c) => c.group === g.id) : [],
  );
  const colCount = columns.length + 1;
  const startsGroup = (i: number) => i === 0 || columns[i - 1].group !== columns[i].group;
  const dimClass = `transition-opacity duration-200 ${dimmed ? "opacity-60" : "opacity-100"}`;

  // Outside the table: centred in a td, the message would sit under columns
  // scrolled out of view on a narrow screen.
  if (!skeleton && rows.length === 0) {
    return (
      <div
        aria-busy={dimmed}
        className={`flex flex-col items-center gap-3 rounded-xl border border-[#242B35] bg-[#191D24] px-4 py-10 ${dimClass}`}
      >
        <NoData title="No players match these filters" />
        {emptyAction}
      </div>
    );
  }

  return (
    <div
      aria-busy={skeleton || dimmed}
      className={`overflow-hidden rounded-xl border border-[#242B35] bg-[#191D24] ${dimClass}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-[#242B35]">
              <ColumnHeader
                sortKey="email"
                label="Player"
                description="Email (else phone, else username), with the username beneath. Sorts by email; players without one sort last. Red dot: account inactive. Amber dot: responsible-gaming restriction."
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                align="left"
                className={`${PLAYER_CELL} z-20 bg-[#242B35] text-left`}
              />
              {columns.map((col, i) => (
                <ColumnHeader
                  key={col.id}
                  sortKey={col.sortKey}
                  label={columnHeader(col, currency)}
                  description={col.description}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  align={col.align ?? "right"}
                  sortable={!(col.cashOnly && currency === "wulfCoin")}
                  className={`${col.align === "left" ? "text-left" : "text-right"} ${
                    startsGroup(i) ? "border-l border-[#2E3542]" : ""
                  }`}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {skeleton ? (
              <TableSkeletonRows rows={Math.min(limit, 10)} cols={colCount} />
            ) : (
              rows.map((row, index) => {
                const zebra = index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]";
                const cell = `${zebra} border-b border-[#242B35]/40 transition-colors group-hover:bg-[#1E2330]`;
                return (
                  <tr
                    key={row.userId}
                    onClick={() => onRowClick(row.userId)}
                    className="group cursor-pointer"
                  >
                    <td className={`${PLAYER_CELL} ${cell} z-10 px-4 py-3`}>
                      <PlayerCell row={row} />
                    </td>
                    {columns.map((col, i) => (
                      <td
                        key={col.id}
                        className={`${cell} whitespace-nowrap px-4 py-3 tabular-nums ${
                          col.align === "left" ? "text-left" : "text-right"
                        } ${startsGroup(i) ? "border-l border-l-[#2E3542]" : ""}`}
                      >
                        {renderCell(col, row, currency)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
