"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { coingreen, coingold } from "@/assets/icons";
import { MaskGroup, Trophy as TrophyImg, Badge1, Badge2, Badge3 } from "@/assets/images/weeklytournament";
import { X, Trophy as TrophyIcon, Clock, Swords } from "lucide-react";

// Inline Countdown Logic
function useCountdown(initial: number) {
  const [t, setT] = React.useState(initial);

  React.useEffect(() => {
    setT(initial);
  }, [initial]);

  React.useEffect(() => {
    const id = setInterval(() => setT((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    days: pad(Math.floor(t / 86400)),
    hours: pad(Math.floor((t % 86400) / 3600)),
    minutes: pad(Math.floor((t % 3600) / 60)),
    seconds: pad(t % 60),
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament | null;
}

export function TournamentDetailsModal({ open, onOpenChange, tournament }: Props) {
  if (!tournament) return null;

  // Calculate seconds remaining if active
  const now = Date.now();
  const startTime = new Date(tournament.startTime).getTime();
  const endTime = new Date(tournament.endTime).getTime();
  
  let initial = 0;
  let statusText = "";
  let statusColor = "";

  // 1. Explicit Status Handling (Sync with Backend)
  if (tournament.status === TournamentStatus.STOPPED) {
    statusText = "STOPPED";
    statusColor = "text-red-400";
  } else if (tournament.status === TournamentStatus.CANCELLED) {
    statusText = "CANCELLED";
    statusColor = "text-gray-500";
  } else if (tournament.status === TournamentStatus.COMPLETED) {
    statusText = "COMPLETED";
    statusColor = "text-blue-400";
  } else if (now < startTime) {
    // 2. Fallback to Time-based for UPCOMING/IN_PROGRESS transitions
    initial = Math.floor((startTime - now) / 1000);
    statusText = "STARTS IN";
    statusColor = "text-yellow-400";
  } else if (now < endTime) {
    initial = Math.floor((endTime - now) / 1000);
    statusText = "ENDS IN";
    statusColor = "text-green-400";
  } else {
    statusText = "COMPLETED";
    statusColor = "text-gray-500";
  }

  const isTerminal = [TournamentStatus.COMPLETED, TournamentStatus.STOPPED, TournamentStatus.CANCELLED].includes(tournament.status as TournamentStatus) || (statusText === "COMPLETED");

  const { days, hours, minutes, seconds } = useCountdown(initial);

  // Group flat prize entries by rank range so WulfCash + WulfCoin awarded at the
  // same rank show together on one row.
  const isCash = (c: string) => c === "WulfCash" || c === "SC";
  const groupedPrizes = React.useMemo(() => {
    const map = new Map<string, { rankStart: number; rankEnd: number; cash: number; coin: number }>();
    for (const p of tournament?.prizes || []) {
      const key = `${p.rankStart}-${p.rankEnd}`;
      const g = map.get(key) || { rankStart: p.rankStart, rankEnd: p.rankEnd, cash: 0, coin: 0 };
      if (isCash(p.currency)) g.cash += Number(p.amount) || 0;
      else g.coin += Number(p.amount) || 0;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => a.rankStart - b.rankStart);
  }, [tournament?.prizes]);

  const units = [
    { val: days, label: "Days" },
    { val: hours, label: "Hours" },
    { val: minutes, label: "Minutes" },
    { val: seconds, label: "Seconds" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-[#0F1115] text-white border-gray-800 p-0 overflow-hidden shadow-2xl rounded-3xl">
        <DialogHeader className="p-4 pb-1 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Swords className="text-purple-500" size={24} />
             </div>
             <DialogTitle className="text-xl font-bold">
                Tournament Details
             </DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-8 pb-4 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-hide pt-2">
          {/* PREMIUM TOURNAMENT BANNER */}
          <div className="relative w-full py-6 px-6 rounded-2xl overflow-hidden border border-[#7A5A1C]/30 shadow-2xl flex items-center justify-center gap-6 min-h-[180px]">
             {/* BACKGROUND IMAGE FROM ASSETS */}
             <div className="absolute inset-0 z-0">
                <Image 
                    src={MaskGroup} 
                    alt="Tournament Background" 
                    fill 
                    className="object-cover"
                />
                <div className="absolute inset-0 bg-black/30 z-1" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#2B1D0E]/60 via-transparent to-[#2B1D0E]/60 z-2" />
             </div>
             
             {/* Trophy Image from Assets */}
             <div className="relative z-10 w-24 h-24 hidden sm:flex items-center justify-center shrink-0">
                 <div className="absolute inset-0 bg-[#FFB800]/10 blur-3xl rounded-full" />
                 <Image 
                    src={TrophyImg} 
                    alt="Trophy" 
                    width={80} 
                    height={80} 
                    className="object-contain drop-shadow-[0_0_15px_rgba(255,184,0,0.6)]" 
                 />
             </div>

             <div className="relative z-10 flex flex-col items-center sm:items-start text-center sm:text-left space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-white uppercase drop-shadow-md">
                    {tournament.title}
                </h2>
                
                <div className="flex flex-col items-center sm:items-start gap-3">
                   <div className={`px-3 py-1 rounded-full bg-black/40 border border-[#FFB800]/20 text-[9px] uppercase font-black tracking-[0.2em] ${statusColor}`}>
                      {statusText}
                   </div>
                   
                   {!isTerminal && (
                    <div className="flex items-center gap-1">
                        {units.map((u, i) => (
                        <div key={i} className="flex items-center">
                            <div className="flex flex-col items-center">
                                <span className="tabular-nums text-2xl font-black text-[#FFB800] drop-shadow-[0_0_10px_rgba(255,184,0,0.4)] leading-none">
                                    {u.val}
                                </span>
                                <span className="text-[8px] text-[#FFB800]/60 uppercase font-bold tracking-tighter mt-1">
                                    {u.label}
                                </span>
                            </div>
                            {i < units.length - 1 && (
                                <span className="text-xl font-bold text-[#FFB800]/40 mx-2 mb-3">:</span>
                            )}
                        </div>
                        ))}
                    </div>
                   )}
                </div>
             </div>
          </div>

          {/* PRIZE DISTRIBUTION SECTION */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 px-1">
                <TrophyIcon size={16} className="text-[#FFB800]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Prize Distribution</h3>
             </div>

             <div className="bg-[#14171E] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                <div className="grid grid-cols-[180px_minmax(0,1fr)] text-gray-500 text-[9px] uppercase font-black tracking-widest bg-[#0F1115]">
                    <div className="px-6 py-3 border-r border-gray-800 text-center">Ranking</div>
                    <div className="px-6 py-3 text-center">Rewards</div>
                </div>

                <div className="divide-y divide-gray-800/50">
                    {groupedPrizes.length ? (
                        groupedPrizes.map((g, i) => {
                            const isSingle = g.rankStart === g.rankEnd;
                            const badge = isSingle && g.rankStart === 1 ? Badge1 :
                                          isSingle && g.rankStart === 2 ? Badge2 :
                                          isSingle && g.rankStart === 3 ? Badge3 : null;

                            return (
                                <div key={i} className="grid grid-cols-[180px_minmax(0,1fr)] hover:bg-white/5 transition-colors border-t border-gray-800/30">
                                    <div className="px-6 py-1 flex items-center justify-center border-r border-gray-800/50 text-white font-bold text-sm gap-3">
                                        {badge && (
                                            <Image src={badge} alt={`Rank ${g.rankStart}`} width={24} height={28} />
                                        )}
                                        {g.rankStart}{!isSingle ? ` - ${g.rankEnd}` : ""}
                                    </div>
                                    <div className="min-w-0 px-6 py-3 flex items-center justify-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                                        {g.cash > 0 && (
                                          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 text-emerald-300">
                                            <Image src={coingreen} alt="WulfCash" width={18} height={18} className="flex-shrink-0 drop-shadow-sm" />
                                            <span className="font-black text-base tabular-nums drop-shadow-[0_0_8px_rgba(16,185,129,0.25)]">{g.cash.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-emerald-200/70">WulfCash</span>
                                          </span>
                                        )}
                                        {g.coin > 0 && (
                                          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#FFB800]/20 bg-[#FFB800]/10 px-2.5 text-[#FFD166]">
                                            <Image src={coingold} alt="WulfCoin" width={18} height={18} className="flex-shrink-0 drop-shadow-sm" />
                                            <span className="font-black text-base tabular-nums drop-shadow-[0_0_8px_rgba(255,184,0,0.3)]">{g.coin.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-[#FFE6A3]/70">WulfCoin</span>
                                          </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-12 text-center text-gray-600 italic text-xs">
                            No prize distribution configured.
                        </div>
                    )}
                </div>
             </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
