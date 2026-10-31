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
import { Loader2 } from "lucide-react";

import api from "@/api/config/axios.config";
import CopyButton from "@/components/CopyButton";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import { EarningRecord, UserWithProfile } from "@/types/profile.type";

/**
 * The agent portal's Commission Deposit ledger, rendered admin-side.
 *
 * Support was reading a per-round commission story the agent could see and the
 * admin could not: the Revenue tab totals, but never says WHY a round paid what
 * it paid. Same endpoint (`/referral/earnings/:agentId`, the admin twin of the
 * portal's `/referral/earnings`) and the same derivations, so the two screens
 * cannot drift into telling different stories about one round.
 */

/** Signed, two decimals — the portal prints every money figure this way. */
export const money2 = (n: number) =>
  Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
/** Unsigned, four decimals — GGR / NGR / platform fee / commission, where sub-cent round figures matter. */
export const money4 = (n: number) =>
  Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
export const sign = (n: number) => (n >= 0 ? "+" : "−");

/**
 * Everything one ledger row means, resolved once.
 *
 * Mirrors the portal page's row logic deliberately — including which value wins
 * when the server sends both a stored figure and the parts it was derived from.
 */
export function readRow(row: EarningRecord) {
  const r = row as EarningRecord & Record<string, unknown>;
  const bonus = Number(r.bonusWagerAmount || 0);
  /*
    Real Stake = Bet − Bonus: the real Wulf Cash put down, which is also the 6%
    purchase-fee base. Read from the server-resolved `realWager`, exactly as the
    agent portal's Commission Deposit does, so the two screens show the same
    split. NOT `wagerAmount`: on a mixed-funded round that keeps the full stake
    (20.00 beside a 0.17 bonus), and on a bonus-only round it is the whole bet
    where the real stake is 0. `?? ` not `||`, so a genuine 0 stays 0.
  */
  const feeBase = Number(r.realWager ?? row.wagerAmount ?? 0);
  const realWager = feeBase;
  // Turnover as the player saw it. Fallback for rows written before
  // betTotalAmount existed, built from the FEE
  // BASE, not the commissionable share: on a mixed-funded win the latter already
  // contains the whole stake, so adding bonus to it would count that bonus twice.
  const betTotal = Number(r.betTotalAmount ?? feeBase + bonus);
  const payout = Number(r.payoutAmount || 0);
  // `grossAmount` is stored floored at 0, so a player win (bet 34, payout 68)
  // printed GGR +0.00 beside an NGR of −31.28 derived from the real −34.
  // `ggrAmount` is the server's signed figure — the one NGR is built from.
  const ggr = Number(
    r.ggrAmount ?? (Number(r.grossAmount || 0) || -Number(r.netProfit || 0)),
  );
  const platformFee = Number(r.platformFeeApplied || 0);
  // 6% of the REAL stake — bonus stake carries no purchase fee.
  const purchaseFee = Number(r.purchaseFeeAllocated || 0);
  // Platform fee % actually applied to this round (recorded breakdown, else the
  // active %) — resolved server-side. NOT grossPercent: that is the agent's
  // commission rate, and printed it as "(50.0%)" next to a 14% fee.
  const feePct = Number(r.platformFeePercent || 0);
  // NGR = GGR − purchase fee − platform fee. Bonus is already out of GGR, so it
  // is not subtracted twice.
  const ngr = Number(r.ngrAmount ?? ggr - purchaseFee - platformFee);
  // Accrued while the referrer was inactive, or fully bonus-funded: the round is
  // reporting-only, so the commission columns read 0 while GGR/NGR keep theirs.
  const forfeitReason = (r.forfeitReason as string) || null;
  const commission = forfeitReason ? 0 : Number(r.commissionAmount || 0);
  const subCommission = forfeitReason ? 0 : Number(r.deductionAmount || 0);
  const agentPct = Number(r.commissionPercent || 0);
  const subPct = Number(r.deductionPercent || 0);

  return {
    bonus,
    realWager,
    feeBase,
    betTotal,
    payout,
    ggr,
    platformFee,
    purchaseFee,
    feePct,
    ngr,
    forfeitReason,
    commission,
    subCommission,
    agentPct,
    subPct,
  };
}

const PAGE_SIZE = 10;

const LEDGER_FILTER_DEFAULTS: FilterValues = {
  search: "",
  status: "all",
  result: "all",
  from: "",
  to: "",
  minCommission: "",
  maxCommission: "",
  minWager: "",
  maxWager: "",
};

const LEDGER_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Credited", value: "credited" },
      { label: "Pending", value: "pending" },
      { label: "Forfeited / Reversed", value: "forfeited" },
    ],
  },
  {
    type: "select",
    key: "result",
    label: "Commission",
    options: [
      { label: "All Entries", value: "all" },
      { label: "Earned (positive)", value: "positive" },
      { label: "Clawed back (negative)", value: "negative" },
      { label: "Zero", value: "zero" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
  { type: "numberRange", minKey: "minCommission", maxKey: "maxCommission", label: "Commission" },
  { type: "numberRange", minKey: "minWager", maxKey: "maxWager", label: "Bet Amount" },
];

export default function CommissionLedgerTab({
  agent,
}: {
  agent: UserWithProfile;
}) {
  const [rows, setRows] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

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
    fields: LEDGER_FILTER_FIELDS,
    defaults: LEDGER_FILTER_DEFAULTS,
  });

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<EarningRecord[]>(
        `/referral/earnings/${agent.id}`,
      );
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      // A failed load and an empty ledger look identical otherwise, and "this
      // agent has earned nothing" is a very different answer from "the request
      // was refused".
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to load commission ledger";
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const filteredRows = useMemo(
    () =>
      applyClientFilters(rows, filters, {
        search: (r) => [r.id, r.gameLogId, r.referee?.username, r.refereeId, r.status],
        selects: [
          {
            key: "status",
            match: (r, v) => {
              const status = (r.status ?? "").toLowerCase();
              if (v === "forfeited") return /forfeit|revers|clawback|cancel/.test(status);
              if (v === "pending") return /pending|hold/.test(status);
              return !/forfeit|revers|clawback|cancel|pending|hold/.test(status);
            },
          },
          {
            key: "result",
            match: (r, v) => {
              const commission = Number(r.commissionAmount || 0);
              if (v === "positive") return commission > 0;
              if (v === "negative") return commission < 0;
              return commission === 0;
            },
          },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (r) => r.createdAt },
        numberRanges: [
          {
            minKey: "minCommission",
            maxKey: "maxCommission",
            get: (r) => Number(r.commissionAmount || 0),
          },
          {
            minKey: "minWager",
            maxKey: "maxWager",
            get: (r) => Number(r.betTotalAmount ?? r.wagerAmount ?? 0),
          },
        ],
      }),
    [rows, filters],
  );

  // The ledger is fetched in full, so sorting orders the whole thing — and the
  // footer totals stay over the filtered set either way, since order does not
  // change a sum.
  const { sort, toggle } = useTableSort<"date" | "bet" | "ggr" | "ngr" | "commission">();
  const filtered = useSortedRows(filteredRows, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    // readRow() is what the cells render, so the sort reads the same numbers.
    bet: (row) => readRow(row).betTotal,
    ggr: (row) => readRow(row).ggr,
    ngr: (row) => readRow(row).ngr,
    commission: (row) => readRow(row).commission,
  });

  useEffect(() => {
    setPage(1);
  }, [filters, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  // Footer totals over the FILTERED set, so a search narrows the sums with the
  // rows rather than leaving a total that describes something else.
  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => {
          const v = readRow(row);
          acc.bet += v.betTotal;
          // Kept apart from the turnover total: the Agent Report sums the REAL
          // (commissionable) stake, so without this the two screens differ by
          // exactly the bonus-funded play and look broken.
          acc.realStake += v.realWager;
          acc.payout += v.payout;
          acc.bonus += v.bonus;
          acc.ggr += v.ggr;
          acc.platformFee += v.platformFee;
          acc.ngr += v.ngr;
          acc.commission += v.commission;
          return acc;
        },
        {
          bet: 0,
          payout: 0,
          bonus: 0,
          realStake: 0,
          ggr: 0,
          platformFee: 0,
          ngr: 0,
          commission: 0,
        },
      ),
    [filtered],
  );

  return (
    <div className="space-y-4 text-white animate-in fade-in duration-500">
      <FilterToolbar
        title="Commission Ledger"
        countLabel={
          loading
            ? undefined
            : `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`
        }
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search entry ID, player or round"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
        onResetAll={resetFilters}
        actions={
          <ExportCSV<EarningRecord>
          data={filtered}
          fileName={`commission_ledger_${agent.username ?? agent.id}.csv`}
          headers={[
            "Entry ID",
            "Player",
            "Round ID",
            "Bet Amount",
            "Payout",
            "Bonus",
            "Real Stake",
            "GGR",
            "Platform Fee",
            "NGR",
            "Comm %",
            "Commission",
            "Sub-agent Commission",
            "Status",
            "Date",
          ]}
          mapRow={(row) => {
            const v = readRow(row);
            return [
              row.id,
              row.referee?.username ?? row.refereeId,
              row.gameLogId ?? "",
              v.betTotal.toFixed(2),
              v.payout.toFixed(2),
              v.bonus.toFixed(2),
              v.realWager.toFixed(2),
              v.ggr.toFixed(4),
              v.platformFee.toFixed(4),
              v.ngr.toFixed(4),
              v.agentPct,
              v.commission.toFixed(4),
              v.subCommission.toFixed(4),
              v.forfeitReason ?? row.status,
              row.createdAt,
            ];
          }}
          getRowDate={(row) => row.createdAt}
          locked={filtered.length === 0}
          lockedTitle="Nothing to export"
        />
        }
      />

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Ledger Filters"
        description="Filter this agent's commission entries"
        fields={LEDGER_FILTER_FIELDS}
        values={filters}
        defaults={LEDGER_FILTER_DEFAULTS}
        onApply={setFilters}
      />

      <div className="rounded-xl border border-[#242B35] bg-[#191D24] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-[#242B35]">
              <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 text-left font-medium">Entry ID</th>
                <th className="px-4 py-3 text-left font-medium">Game / Player</th>
                <SortableTh
                  label="Bet Amount"
                  sortKey="bet"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-4 py-3 text-right font-medium"
                />
                <th className="px-4 py-3 text-right font-medium">Payout</th>
                <th className="px-4 py-3 text-right font-medium">Bonus</th>
                <th className="px-4 py-3 text-right font-medium">Real Stake</th>
                <SortableTh
                  label="GGR"
                  sortKey="ggr"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-4 py-3 text-right font-medium"
                />
                <th className="px-4 py-3 text-right font-medium">Platform Fee</th>
                <SortableTh
                  label="NGR"
                  sortKey="ngr"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-4 py-3 text-right font-medium"
                />
                <th className="px-4 py-3 text-right font-medium">Comm %</th>
                <SortableTh
                  label="Commission"
                  sortKey="commission"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-4 py-3 text-right font-medium"
                />
                <SortableTh
                  label="Date"
                  sortKey="date"
                  sort={sort}
                  onToggle={toggle}
                  align="left"
                  className="px-4 py-3 text-left font-medium"
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-purple-400" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-sm">
                    <p className="text-red-400">{error}</p>
                    <button
                      type="button"
                      onClick={fetchLedger}
                      className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No commission entries for this agent.
                  </td>
                </tr>
              ) : (
                paginated.map((row, index) => {
                  const v = readRow(row);
                  const date = new Date(row.createdAt);
                  return (
                    <tr
                      key={row.id}
                      className={
                        index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs uppercase text-gray-300">
                            {row.id.slice(0, 8)}
                          </span>
                          <CopyButton value={row.id} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-bold uppercase text-gray-300">
                          {row.gameLogId ? "Game Play" : "Platform"}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <span className="truncate">
                            P: {row.referee?.username || row.refereeId.slice(0, 8)}
                          </span>
                          <CopyButton
                            value={row.referee?.username || row.refereeId}
                          />
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-right font-mono text-xs text-gray-300"
                        title={
                          v.betTotal
                            ? `Real ${money2(v.realWager)} + Bonus ${money2(v.bonus)}`
                            : undefined
                        }
                      >
                        {v.betTotal ? money2(v.betTotal) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-300">
                        {v.payout || v.betTotal ? money2(v.payout) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-300">
                        {v.bonus ? money2(v.bonus) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-300">
                        {v.realWager ? money2(v.realWager) : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-xs font-bold ${
                          v.ggr >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {sign(v.ggr)}
                        {money4(v.ggr)}
                      </td>
                      {/* Signed: a negative GGR (player won) credits the fee
                          back, which reads green rather than vanishing. */}
                      <td
                        className={`px-4 py-3 text-right font-mono text-xs font-bold ${
                          v.platformFee > 0
                            ? "text-red-400"
                            : v.platformFee < 0
                              ? "text-green-400"
                              : "text-gray-500"
                        }`}
                      >
                        {v.platformFee !== 0 ? (
                          <>
                            {v.platformFee > 0 ? "−" : "+"}
                            {money4(v.platformFee)}
                            <span className="ml-1 text-[9px] opacity-70">
                              ({v.feePct.toFixed(1)}%)
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-xs font-black ${
                          v.ngr >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                        title={`NGR ${sign(v.ngr)}${money4(v.ngr)} = GGR ${sign(
                          v.ggr,
                        )}${money4(v.ggr)} − purchase fee ${v.purchaseFee.toFixed(
                          2,
                        )}${
                          v.feeBase
                            ? ` (6% of ${v.feeBase.toFixed(2)} real stake)`
                            : ""
                        } − platform fee ${v.platformFee.toFixed(4)}`}
                      >
                        {sign(v.ngr)}
                        {money4(v.ngr)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.subPct > 0 ? (
                          <div className="leading-tight">
                            <div className="text-[10px] font-bold text-gray-300">
                              {v.agentPct}%{" "}
                              <span className="text-[8px] text-gray-500">
                                AGENT
                              </span>
                            </div>
                            <div className="mt-0.5 text-[9px] font-bold text-purple-400/80">
                              {v.subPct}%{" "}
                              <span className="text-[8px] text-gray-500">
                                SUB-AGENT
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-500">
                            {v.agentPct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono leading-tight">
                        <div
                          className={`text-xs font-black ${
                            v.forfeitReason
                              ? "text-gray-500"
                              : v.commission >= 0
                                ? "text-green-400"
                                : "text-red-400"
                          }`}
                        >
                          {sign(v.commission)}
                          {money4(v.commission)}
                        </div>
                        {/* Why the 0: recorded, never paid. */}
                        {v.forfeitReason && (
                          <div
                            className="mt-0.5 text-[8px] font-bold uppercase text-gray-500"
                            title={`Forfeited: ${v.forfeitReason}`}
                          >
                            {v.forfeitReason === "BONUS_FUNDED"
                              ? "Bonus-funded"
                              : "Forfeited"}
                          </div>
                        )}
                        {v.subCommission > 0 && (
                          <div className="mt-0.5 text-[9px] font-bold text-purple-400/80">
                            {sign(v.subCommission)}
                            {money4(v.subCommission)}{" "}
                            <span className="text-[8px] text-gray-500">
                              SUB-AGENT
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs leading-tight text-gray-300">
                        <span className="block">
                          {date.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        <span className="block text-[10px] text-gray-500">
                          {date.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && !error && filtered.length > 0 && (
              <tfoot className="bg-[#1C2128] text-xs font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-gray-400">
                    {filtered.length.toLocaleString()} entries
                  </td>
                  <td
                    className="px-4 py-3 text-right font-mono text-gray-300"
                    title="Turnover: real + bonus stake"
                  >
                    {money2(totals.bet)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {money2(totals.payout)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {money2(totals.bonus)}
                  </td>
                  {/* The Agent Report totals THIS column, not Bet Amount — the
                      two differ by the bonus-funded play. */}
                  <td
                    className="px-4 py-3 text-right font-mono text-gray-300"
                    title="Commissionable real stake — matches Total Bet on the Agent Report"
                  >
                    {money2(totals.realStake)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      totals.ggr >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {sign(totals.ggr)}
                    {money4(totals.ggr)}
                  </td>
                  {/* Same sign convention as the row cells: a charged fee
                      reads as a deduction. */}
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      totals.platformFee > 0
                        ? "text-red-400"
                        : totals.platformFee < 0
                          ? "text-green-400"
                          : "text-gray-500"
                    }`}
                  >
                    {totals.platformFee !== 0
                      ? `${totals.platformFee > 0 ? "−" : "+"}${money4(Math.abs(totals.platformFee))}`
                      : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      totals.ngr >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {sign(totals.ngr)}
                    {money4(totals.ngr)}
                  </td>
                  <td />
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      totals.commission >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {sign(totals.commission)}
                    {money4(totals.commission)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-end rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
