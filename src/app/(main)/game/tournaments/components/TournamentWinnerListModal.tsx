"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tournament, TournamentWinner } from "@/types/tournament";
import NoData from "@/components/NoData";
import Image from "next/image";
import { coingreen, coingold } from "@/assets/icons";
import { Loader2, Trophy } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament | null;
  winners: TournamentWinner[];
  isLoading: boolean;
}

type WinnerRow = {
  id: string;
  rank: number;
  username: string;
  cash: number;
  coin: number;
  isPaid: boolean;
};

const isCashCurrency = (currency: string) => currency === "SC" || currency === "WulfCash";

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

function PrizeAmountRow({ cash, coin }: { cash: number; coin: number }) {
  if (cash <= 0 && coin <= 0) {
    return <span className="text-gray-500">-</span>;
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-2 whitespace-nowrap">
      {cash > 0 && (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 text-emerald-300">
          <Image src={coingreen} alt="WulfCash" width={15} height={15} className="shrink-0" />
          <span className="font-semibold tabular-nums">{formatAmount(cash)}</span>
          <span className="hidden text-[10px] font-medium text-emerald-200/70 sm:inline">WulfCash</span>
        </span>
      )}
      {coin > 0 && (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#FFB800]/20 bg-[#FFB800]/10 px-2 text-[#FFD166]">
          <Image src={coingold} alt="WulfCoin" width={15} height={15} className="shrink-0" />
          <span className="font-semibold tabular-nums">{formatAmount(coin)}</span>
          <span className="hidden text-[10px] font-medium text-[#FFE6A3]/70 sm:inline">WulfCoin</span>
        </span>
      )}
    </div>
  );
}

export function TournamentWinnerListModal({ open, onOpenChange, tournament, winners, isLoading }: Props) {
  const winnerRows = React.useMemo<WinnerRow[]>(() => {
    const rows = new Map<string, WinnerRow>();

    for (const winner of winners) {
      const key = `${winner.rank}-${winner.userId || winner.username}`;
      const row = rows.get(key) ?? {
        id: key,
        rank: winner.rank,
        username: winner.username,
        cash: 0,
        coin: 0,
        isPaid: true,
      };

      const amount = Number(winner.prizeAmount) || 0;
      if (isCashCurrency(winner.prizeCurrency)) row.cash += amount;
      else row.coin += amount;
      row.isPaid = row.isPaid && winner.isPaid;
      rows.set(key, row);
    }

    return Array.from(rows.values()).sort((a, b) => a.rank - b.rank || a.username.localeCompare(b.username));
  }, [winners]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] bg-[#15181E] text-white border-none p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-6 pb-4">
          <DialogTitle className="text-lg sm:text-xl font-medium text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 shrink-0 text-yellow-500" />
            <span className="shrink-0">Standings:</span>
            <span className="truncate max-w-[220px] sm:max-w-none">{tournament?.title}</span>
          </DialogTitle>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1">
            SA Event ID: <span className="font-mono text-purple-400">{tournament?.externalEventId}</span>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-4 sm:px-6 pb-6 custom-scrollbar">
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full min-w-[620px] text-[11px] sm:text-xs">
              <thead className="bg-[#242B35] sticky top-0 z-10">
                <tr className="border-b border-gray-800">
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left text-white font-normal w-20">Rank</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-left text-white font-normal">Player</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right text-white font-normal w-[310px]">Prize</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center text-white font-normal w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-20">
                       <div className="flex flex-col items-center justify-center gap-3">
                         <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
                         <span className="text-gray-500 text-xs italic">Fetching standings...</span>
                       </div>
                    </td>
                  </tr>
                ) : winnerRows.length > 0 ? (
                  winnerRows.map((winner, index) => (
                    <tr
                      key={winner.id}
                      className={`hover:bg-[#1a2030] transition-colors ${
                        index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      }`}
                    >
                      <td className="py-2 sm:py-3 px-3 sm:px-4 font-bold text-yellow-500">#{winner.rank}</td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 truncate max-w-[170px] sm:max-w-[220px]">
                        <div className="font-medium text-gray-200 truncate">{winner.username}</div>
                      </td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 text-right">
                        <PrizeAmountRow cash={winner.cash} coin={winner.coin} />
                      </td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 text-center">
                        {winner.isPaid ? (
                          <span className="text-[#C362EA] text-[10px] font-bold">PAID</span>
                        ) : (
                          <span className="text-red-400 text-[10px] font-bold whitespace-nowrap">UNPAID</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <NoData title="No winner data available." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}