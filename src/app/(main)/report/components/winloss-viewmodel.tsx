import { X, Loader2 } from "lucide-react";
import { Search } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { reportsApi, GameReportRow } from "@/api/reports/reports";
import Pagination from "@/components/Pagination";

/* =========================
   TYPES
========================= */
export interface PlayerSummary {
  username: string; // This is provider name for this context
  category?: string;
  totalBet: string;
  totalBetCount: number;
  totalValidBet: string;
  totalWinLose: string;
  totalJackpotContribution: string;
  startDate?: string;
  endDate?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: PlayerSummary | null;
}

/* =========================
   COMPONENT
========================= */
export default function PlayerSummaryModal({
  open,
  onClose,
  data,
}: Props) {
  const [players, setPlayers] = useState<GameReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<"all" | "win" | "loss">("all");
  const itemsPerPage = 5; // Modal has limited space, fewer items per page

  useEffect(() => {
    if (open && data) {
      const fetchPlayers = async () => {
        setLoading(true);
        try {
          const response = await reportsApi.getGameReport({
            provider: data.username,
            category: data.category,
            startDate: data.startDate,
            endDate: data.endDate
          });
          setPlayers(response.data.items);
          setCurrentPage(1); // Reset to first page
        } catch (error) {
          console.error("Failed to fetch players summary:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchPlayers();
    } else {
      setPlayers([]);
    }
  }, [open, data]);

  // The modal loads one provider's rows in full, so both controls filter here.
  const visiblePlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (q) {
        const haystack = [p.player, p.username, p.email, p.game, p.roundId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (result !== "all") {
        // A player's own result: what they won against what they staked.
        const net = Number(p.totalWin || 0) - Number(p.totalBetAmount || 0);
        if (result === "win" && net <= 0) return false;
        if (result === "loss" && net > 0) return false;
      }

      return true;
    });
  }, [players, search, result]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, result]);

  const paginatedPlayers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return visiblePlayers.slice(start, start + itemsPerPage);
  }, [visiblePlayers, currentPage]);

  if (!open || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-6xl rounded-xl bg-[#15181E] flex flex-col max-h-[90vh] border border-white/5 shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-white text-lg font-medium">Player Details</h2>
            <p className="text-gray-400 text-xs mt-1">
              {data.username} {data.category ? `• ${data.category}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* SUMMARY TABLE */}
        <div className="p-2 pb-0 overflow-x-auto scrollbar-hide ">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-[#1E222B]">
              <tr className="text-gray-400">
                <Th className="rounded-tl-lg">Provider</Th>
                <Th>Total Bet</Th>
                <Th>Total Bet Count</Th>
                <Th>Total Valid Bet</Th>
                <Th>Total Win Lose</Th>
                <Th className="rounded-tr-lg">Jackpot Contributions</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#232733] text-white bg-[#191D24]">
                <Td className="border-b border-white/5">{data.username}</Td>
                <Td className="border-b border-white/5">{data.totalBet}</Td>
                <Td className="border-b border-white/5">{data.totalBetCount}</Td>
                <Td className="border-b border-white/5">{data.totalValidBet}</Td>
                <Td className="border-b border-white/5">{data.totalWinLose}</Td>
                <Td className="border-b border-white/5">{data.totalJackpotContribution}</Td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PLAYER LIST */}
        <div className="p-6 flex-1 flex flex-col min-h-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-white text-sm font-medium">Player Contributions</h3>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search player or game"
                  className="h-8 w-56 rounded-md border border-white/10 bg-[#191D24] pl-8 pr-2 text-xs text-white placeholder:text-gray-600 outline-none"
                />
              </div>

              <select
                value={result}
                onChange={(e) => setResult(e.target.value as "all" | "win" | "loss")}
                className="h-8 rounded-md border border-white/10 bg-[#191D24] px-2 text-xs text-white outline-none"
              >
                <option value="all">All players</option>
                <option value="win">Net winners</option>
                <option value="loss">Net losers</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto rounded-lg border border-white/5 bg-[#0D1017] scrollbar-hide mb-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-purple-500 h-8 w-8" />
                <p className="text-gray-400 text-sm">Fetching player logs...</p>
              </div>
            ) : visiblePlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-gray-500 text-sm">{search || result !== "all" ? "No players match these filters." : "No detailed logs found for this selection."}</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-[#191D24] sticky top-0 z-10 shadow-sm">
                  <tr className="text-gray-400">
                    <Th className="py-2">Player</Th>
                    <Th className="py-2">Game</Th>
                    <Th className="py-2">Bet Amount</Th>
                    <Th className="py-2">Valid Bet</Th>
                    <Th className="py-2">Win Amount</Th>
                    <Th className="py-2 text-right">Date</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedPlayers.map((p, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <Td className="py-2 text-white">
                        <div className="font-medium">{p.username}</div>
                        <div className="text-[10px] text-gray-500">ID: {p.playerId}</div>
                      </Td>
                      <Td className="py-2 text-gray-300">{p.game}</Td>
                      <Td className="py-2 text-white">{p.totalBetAmount.toFixed(2)}</Td>
                      <Td className="py-2 text-white">{p.validBet.toFixed(2)}</Td>
                      <Td className={`py-2 font-medium ${p.totalWin > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                        {p.totalWin.toFixed(2)}
                      </Td>
                      <Td className="py-2 text-right text-gray-500">
                        {new Date(p.date).toLocaleString()}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* COMMON PAGINATION */}
          {players.length > itemsPerPage && !loading && (
            <div className="flex justify-end pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(visiblePlayers.length / itemsPerPage)}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   TABLE HELPERS
========================= */
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left font-normal whitespace-nowrap uppercase tracking-wider text-[10px] ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}
