"use client";

import React, { useMemo, useState, useEffect, useEffectEvent } from "react";
import { Search } from "lucide-react";
import { X } from "lucide-react";

import DatePicker from "@/components/DatePicker";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import CopyButton from "@/components/CopyButton";
import { Skeleton } from "@/components/ui/skeleton";
import ExportCSV from "@/components/ExportCSV";
import { profileApi } from "@/api/users/users";
import { EarningRecord } from "@/types/profile.type";
import { format } from "date-fns";
// Same row derivations as the agent's Commission Ledger tab, so this history
// and the ledger never tell two different stories about one round.
import {
  money2,
  money4,
  readRow,
  sign,
} from "../../agent-listing/[username]/components/tabs/CommissionLedgerTab";

const PAGE_SIZE = 10;
const COLUMNS = 13;

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: string;
}

const statusClass = (status: string) =>
  status === "UNCLAIMED"
    ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
    : status === "VOIDED"
      ? "bg-gray-500/10 text-gray-400 border border-gray-500/20"
      : "bg-green-500/10 text-green-500 border border-green-500/20";

export default function AgentTransactionModal({
  open,
  onClose,
  agentId
}: Props) {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useEffectEvent(async () => {
    try {
      setLoading(true);
      const res = await profileApi.getAgentEarningHistoryById(agentId);
      setRows(res.data || []);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (open && agentId) {
      fetchTransactions();
    }
  }, [open, agentId]);

  /* ============================
     FILTERING
  ============================ */
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const date = new Date(row.createdAt);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;

      if (q) {
        const haystack = [row.id, row.gameLogId, row.referee?.username, row.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [rows, startDate, endDate, search]);

  /* ============================
     PAGINATION
  ============================ */
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  // Footer totals over the filtered set, as the Commission Ledger does.
  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          const v = readRow(row);
          acc.bet += v.betTotal;
          acc.payout += v.payout;
          acc.bonus += v.bonus;
          acc.realStake += v.realWager;
          acc.ggr += v.ggr;
          acc.platformFee += v.platformFee;
          acc.ngr += v.ngr;
          acc.commission += v.commission;
          return acc;
        },
        { bet: 0, payout: 0, bonus: 0, realStake: 0, ggr: 0, platformFee: 0, ngr: 0, commission: 0 },
      ),
    [filteredRows],
  );

  if (!open) return null;

  const th = "px-4 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-wider";
  const num = "px-4 py-4 text-right font-mono text-xs";

  return (
    <div className="fixed inset-0 z-[9999] bg-[#15181E] animate-in fade-in duration-300">
      <div className="w-full h-full bg-[#15181E] flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 " />

        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-800 shrink-0 md:px-8 md:py-5">
          <div>
            <h2 className="text-white text-xl font-black tracking-tight uppercase">
              Transaction History
            </h2>
            <p className="text-gray-500 text-[10px] mt-0.5 italic">Detailed log of referral commissions and payouts.</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all border border-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* ================= FILTER BAR ================= */}
        <div className="px-4 mt-4 shrink-0 md:px-8 md:mt-6">
          <div className="bg-[#191D24] border border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-3 md:flex-nowrap md:gap-4">
            <div className="grid w-full grid-cols-[auto_1fr] items-center gap-2 md:flex md:w-auto">
              <span className="text-gray-500 text-[10px] uppercase font-bold ml-2">From</span>
              <DatePicker date={startDate} onChange={setStartDate} />
              <span className="text-gray-500 text-[10px] uppercase font-bold">To</span>
              <DatePicker date={endDate} onChange={setEndDate} />
            </div>

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search entry, round or player"
                className="h-10 w-full rounded-xl border border-gray-800 bg-[#15181E] pl-9 pr-3 text-sm text-white placeholder:text-gray-600"
              />
            </div>

            <ExportCSV
              data={filteredRows}
              fileName={`transactions_${agentId.substring(0,8)}.csv`}
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
                "Status",
                "Date",
              ]}
              mapRow={(row) => {
                const v = readRow(row);
                return [
                  row.id,
                  row.referee?.username || row.refereeId,
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
                  v.forfeitReason ?? row.status,
                  format(new Date(row.createdAt), "yyyy-MM-dd HH:mm"),
                ];
              }}
              getRowDate={(row) => row.createdAt}
            />
          </div>
        </div>

        {/* ================= TABLE ================= */}
        <div className="flex-1 overflow-y-auto p-4 pt-4 scrollbar-hide md:p-8 md:pt-6">
          <div className="rounded-2xl bg-[#191D24] border border-gray-800 overflow-x-auto shadow-lg">
            <table className="w-full min-w-[1200px] text-left border-collapse">
              <thead className="bg-[#15181E] border-b border-gray-800">
                <tr>
                  <th className={th}>Entry ID</th>
                  <th className={th}>Player</th>
                  <th className={`${th} text-right`}>Bet Amount</th>
                  <th className={`${th} text-right`}>Payout</th>
                  <th className={`${th} text-right`}>Bonus</th>
                  <th className={`${th} text-right`}>Real Stake</th>
                  <th className={`${th} text-right`}>GGR</th>
                  <th className={`${th} text-right`}>Platform Fee</th>
                  <th className={`${th} text-right`}>NGR</th>
                  <th className={`${th} text-right`}>Comm %</th>
                  <th className={`${th} text-right`}>Commission</th>
                  <th className={`${th} text-center`}>Status</th>
                  <th className={th}>Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-800/50">
                {loading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <tr key={`txn-skeleton-${i}`}>
                      {Array.from({ length: COLUMNS }).map((__, j) => (
                        <td key={j} className="px-4 py-4">
                          <Skeleton className="h-3 w-14 bg-gray-700/40" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS} className="py-24">
                      <NoData title="No transaction history found" />
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const v = readRow(row);
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs uppercase text-gray-300">
                              {row.id.slice(0, 8)}
                            </span>
                            <CopyButton value={row.id} />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-300 font-bold">{row.referee?.username || "N/A"}</p>
                          <p className="text-[10px] text-gray-500 font-mono italic">ID: {row?.refereeId?.substring(0,8)}</p>
                        </td>
                        <td
                          className={`${num} text-gray-300`}
                          title={v.betTotal ? `Real ${money2(v.realWager)} + Bonus ${money2(v.bonus)}` : undefined}
                        >
                          {v.betTotal ? money2(v.betTotal) : "—"}
                        </td>
                        <td className={`${num} text-gray-300`}>
                          {v.payout || v.betTotal ? money2(v.payout) : "—"}
                        </td>
                        <td className={`${num} text-gray-300`}>
                          {v.bonus ? money2(v.bonus) : "—"}
                        </td>
                        <td className={`${num} text-gray-300`}>
                          {v.realWager ? money2(v.realWager) : "—"}
                        </td>
                        <td className={`${num} font-bold ${v.ggr >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {sign(v.ggr)}
                          {money4(v.ggr)}
                        </td>
                        {/* Signed: a player win credits the fee back. */}
                        <td
                          className={`${num} font-bold ${
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
                          className={`${num} font-black ${v.ngr >= 0 ? "text-green-400" : "text-red-400"}`}
                          title={`NGR = GGR ${sign(v.ggr)}${money4(v.ggr)} − purchase fee ${v.purchaseFee.toFixed(2)}${
                            v.feeBase ? ` (6% of ${v.feeBase.toFixed(2)} real stake)` : ""
                          } − platform fee ${v.platformFee.toFixed(4)}`}
                        >
                          {sign(v.ngr)}
                          {money4(v.ngr)}
                        </td>
                        <td className="px-4 py-4 text-right text-[10px] font-bold text-gray-400">
                          {v.agentPct}%
                          {v.subPct > 0 && (
                            <div className="text-[9px] text-purple-400/80">
                              {v.subPct}% SUB-AGENT
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono leading-tight">
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
                          {v.forfeitReason && (
                            <div
                              className="mt-0.5 text-[8px] font-bold uppercase text-gray-500"
                              title={`Forfeited: ${v.forfeitReason}`}
                            >
                              {v.forfeitReason === "BONUS_FUNDED" ? "Bonus-funded" : "Forfeited"}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${statusClass(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs leading-tight text-gray-300 whitespace-nowrap">
                          <span className="block">{format(new Date(row.createdAt), "dd MMM")}</span>
                          <span className="block text-[10px] text-gray-500">
                            {format(new Date(row.createdAt), "hh:mm a")}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {!loading && filteredRows.length > 0 && (
                <tfoot className="bg-[#1C2128] text-xs font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-gray-400">
                      {filteredRows.length.toLocaleString()} entries
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">{money2(totals.bet)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">{money2(totals.payout)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">{money2(totals.bonus)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">{money2(totals.realStake)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${totals.ggr >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {sign(totals.ggr)}
                      {money4(totals.ggr)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${totals.platformFee > 0 ? "text-red-400" : totals.platformFee < 0 ? "text-green-400" : "text-gray-500"}`}>
                      {totals.platformFee !== 0
                        ? `${totals.platformFee > 0 ? "−" : "+"}${money4(totals.platformFee)}`
                        : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${totals.ngr >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {sign(totals.ngr)}
                      {money4(totals.ngr)}
                    </td>
                    <td />
                    <td className={`px-4 py-3 text-right font-mono ${totals.commission >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {sign(totals.commission)}
                      {money4(totals.commission)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ================= PAGINATION ================= */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
