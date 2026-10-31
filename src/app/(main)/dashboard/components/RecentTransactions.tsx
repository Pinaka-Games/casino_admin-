"use client";

import { coingold, coingreen, fortuneicon } from "@/assets/icons";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { reportsApi, type GameReportRow } from "@/api/reports/reports";
import { toReportDay } from "@/lib/utils";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination/Pagination";
import { useDashboardStore } from "@/store/dashboard-store";
import RoundDetailModal, { type RoundDetail } from "@/components/game/RoundDetailModal";

type CurrencyFilter = "all" | "wulfCash" | "wulfCoin";

/** Columns the recent-plays log can be ordered by. */
type SortKey = "game" | "user" | "buyIn" | "multiplier" | "winLoss";

export default function RecentTransactions() {
  const { fromDate, toDate, refreshKey } = useDashboardStore();
  const PAGE_SIZE = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [allData, setAllData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  // Currency filter for the log: All, real money (Wulf Cash) or virtual (Wulf Coins).
  const [currency, setCurrency] = useState<CurrencyFilter>("all");
  // The row whose full detail is open. Every field the modal shows already
  // came back with the list, so opening it costs no extra request.
  const [selected, setSelected] = useState<RoundDetail | null>(null);

  /** A report row as the shared round-detail view wants it. */
  const toRoundDetail = (row: GameReportRow): RoundDetail => {
    const bet = Number(row.totalBetAmount) || 0;
    const win = Number(row.totalWin) || 0;
    return {
      gameName: row.game,
      gameImage: row.gameImage,
      gameId: row.gameId,
      gameType: row.gameType,
      provider: row.gameProvider,
      roundId: row.roundId,
      transactionId: row.betId,
      transactionType: row.transactionType,
      status: row.status,
      playedAt: row.date,
      betAmount: bet,
      winAmount: win,
      // The API settles this; fall back to the figure the row itself implies.
      profit: row.netProfit == null ? win - bet : Number(row.netProfit),
      payoutMultiplier: row.payoutMultiplier,
      isCashPlay:
        row.playCurrency === "wulfCash" ||
        (!row.playCurrency && row.playMode === "sweeps"),
      player: row.username,
      playerEmail: row.email,
    };
  };

  /**
   * Column sorting. The whole log for the selected range is already in
   * `allData` and paged locally, so ordering here covers every row rather than
   * the ten on screen.
   */
  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>({
    key: null,
    dir: "desc",
  });

  const toggleSort = (key: SortKey) => {
    // First click sorts high-to-low, which is what these columns get asked.
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );
    setPage(1);
  };

  const sortedData = useMemo(() => {
    if (!sort.key) return allData;

    const read = (item: any) => {
      const buyIn = parseFloat(item.totalBetAmount) || 0;
      const win = parseFloat(item.totalWin) || 0;
      switch (sort.key) {
        case "game":
          return item.game ?? "";
        case "user":
          return item.username ?? "";
        case "buyIn":
          return buyIn;
        // Same derivation the cells use, so the order matches what is rendered.
        case "multiplier":
          return buyIn > 0 ? win / buyIn : 0;
        default:
          return win - buyIn;
      }
    };

    const factor = sort.dir === "asc" ? 1 : -1;
    return [...allData].sort((a, b) => {
      const left = read(a);
      const right = read(b);
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [allData, sort]);

  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);
  const data = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    // A newer range / currency / refresh supersedes this request: abort it so a
    // slow response cannot land over the one the admin just asked for.
    const controller = new AbortController();

    const fetchData = async () => {
      setIsLoading(true);
      setPage(1);
      try {
        const params: { startDate?: string; endDate?: string; currency?: "wulfCash" | "wulfCoin" } = {};
        // Date-only: the API reads it as a calendar day. See toReportDay.
        if (fromDate) params.startDate = toReportDay(fromDate);
        if (toDate) params.endDate = toReportDay(toDate);
        if (currency !== "all") params.currency = currency;

        // The rows only. The full Game Report also computed a range-wide count
        // and totals on every load that this list never displays.
        const res = await reportsApi.getRecentPlays(params, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setAllData(res.data.items);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch recent game plays", error);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [fromDate, toDate, refreshKey, currency]);

  const CURRENCY_TABS: { value: CurrencyFilter; label: string; icon?: any }[] = [
    { value: "all", label: "All" },
    { value: "wulfCash", label: "Wulf Cash", icon: coingreen },
    { value: "wulfCoin", label: "Wulf Coins", icon: coingold },
  ];

  const UserAvatar = ({ username }: { username: string }) => {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none"
        style={{
          width: 22,
          height: 22,
          fontSize: 9,
          background: "linear-gradient(135deg,#B93DEB55,#9b2fd133)",
          border: "1px solid rgba(185,61,235,0.3)",
        }}
      >
        {username?.charAt(0)?.toUpperCase() ?? "U"}
      </div>
    );
  };

  const HEADERS: { label: string; align: string; key: SortKey; justify: string }[] = [
    { label: "Game", align: "text-left rounded-l-lg", key: "game", justify: "justify-start" },
    { label: "User", align: "text-center", key: "user", justify: "justify-center" },
    { label: "Buy-In", align: "text-center", key: "buyIn", justify: "justify-center" },
    { label: "Multiplier", align: "text-center", key: "multiplier", justify: "justify-center" },
    { label: "Win / Loss", align: "text-right rounded-r-lg", key: "winLoss", justify: "justify-end" },
  ];

  const SkeletonRow = ({ idx }: { idx: number }) => (
    <div
      className="grid grid-cols-5 px-6 py-3.5 items-center"
      style={{
        background: idx % 2 === 0 ? "#1a1d27" : "#13151e",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg sk" />
        <div className="h-3 w-28 rounded sk" />
      </div>
      <div className="flex justify-center">
        <div className="h-3 w-24 rounded sk" />
      </div>
      <div className="flex justify-center">
        <div className="h-3 w-20 rounded sk" />
      </div>
      <div className="flex justify-center">
        <div className="h-3 w-14 rounded sk" />
      </div>
      <div className="flex justify-end">
        <div className="h-3 w-20 rounded sk" />
      </div>
    </div>
  );

  return (
    <div className="w-full mt-2">
      <style>{`
        .sk {
          background: linear-gradient(90deg,#1e2330 25%,#252b3a 50%,#1e2330 75%);
          background-size: 200% 100%;
          animation: sk 1.5s infinite;
        }
        @keyframes sk {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .row-item { transition: all 0.2s ease-out; }
        .row-item:hover { background: #1f2334 !important; }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h2 className="text-white text-md font-bold tracking-tight">
              Recent Game Plays Logs
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Currency filter: All / Wulf Cash / Wulf Coins */}
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-[#13151e] p-1">
            {CURRENCY_TABS.map((tab) => {
              const active = currency === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setCurrency(tab.value)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[#B93DEB] text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {tab.icon && (
                    <Image src={tab.icon} alt="" width={13} height={13} />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="w-full rounded-xl overflow-hidden shadow-2xl border border-white/5"
        style={{ background: "#1a1d27" }}
      >
        {/* Five columns of game/user/amount data do not fit a phone, and
            squeezing them turned every cell into stacked single characters.
            Header and rows share ONE horizontal scroller so the columns stay
            aligned while it scrolls; the pagination below sits outside it and
            stays reachable without scrolling sideways. */}
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
        {/* Table Header */}
        <div className="grid grid-cols-5 px-2 py-2">
          {HEADERS.map((h, i) => (
            <span
              key={i}
              className={`text-white/60 py-2.5 px-6 bg-[#13151e] text-[13px] font-bold uppercase tracking-wider ${h.align}`}
            >
              <button
                type="button"
                onClick={() => toggleSort(h.key)}
                className={`flex w-full items-center gap-1 hover:text-white transition-colors ${h.justify}`}
              >
                {h.label}
                {sort.key !== h.key && (
                  <ChevronsUpDown size={12} className="text-white/30" />
                )}
                {sort.key === h.key && sort.dir === "desc" && (
                  <ChevronDown size={12} className="text-[#B93DEB]" />
                )}
                {sort.key === h.key && sort.dir === "asc" && (
                  <ChevronUp size={12} className="text-[#B93DEB]" />
                )}
              </button>
            </span>
          ))}
        </div>

        {/* Data Rows */}
        <div className="px-2 pb-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} idx={i} />
            ))
          ) : data.length > 0 ? (
            data.map((item, index) => {
              const isWin = item.totalWin > 0;
              const buyIn = parseFloat(item.totalBetAmount) || 0;
              const win = parseFloat(item.totalWin) || 0;
              const multiplier = buyIn > 0 ? win / buyIn : 0;
              const rowBg = index % 2 === 0 ? "#1a1d27" : "#13151e";
              // A round is played entirely in ONE currency — you cannot buy in
              // with Wulf Coins and win Wulf Cash. So the buy-in and the win/loss
              // must always show the SAME currency, taken from playCurrency
              // (falling back to playMode: 'sweeps' => cash, 'gold' => coins).
              const isCashPlay =
                item.playCurrency === "wulfCash" ||
                (!item.playCurrency && item.playMode === "sweeps");
              const currencyIcon = isCashPlay ? coingreen : coingold;
              // Buy-in number is tinted to its currency (gold = coins,
              // green = cash) so the amount and its coin icon always agree.
              const buyInColor = isCashPlay ? "#03B739" : "#DBA727";

              return (
                <div
                  key={index}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(toRoundDetail(item))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(toRoundDetail(item));
                    }
                  }}
                  title="View round details"
                  className="row-item grid grid-cols-5 px-6 py-3.5 items-center rounded-lg mb-0.5 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B93DEB]"
                  style={{ background: rowBg }}
                >
                  {/* Game */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-[#161B23] border border-white/5">
                      {item.gameImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.gameImage}
                          alt={item.game}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              fortuneicon.src ?? (fortuneicon as any);
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image
                            src={fortuneicon}
                            alt="game"
                            width={20}
                            height={20}
                            className="opacity-80"
                          />
                        </div>
                      )}
                    </div>
                    <span className="text-white/90 text-[13px] font-semibold truncate max-w-[150px]">
                      {item.game}
                    </span>
                  </div>

                  {/* User */}
                  <div className="flex items-center justify-center gap-2">
                    <UserAvatar username={item.username} />
                    <span className="text-white/80 text-[12px] font-medium truncate max-w-[100px]">
                      {item.username}
                    </span>
                  </div>

                  {/* Buy-In */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className="font-bold text-[14px] tabular-nums"
                      style={{ color: buyInColor }}
                    >
                      {buyIn.toFixed(2)}
                    </span>
                    {/* The coin icon and the amount's colour already say which
                        currency this round was played in, so the text pill was
                        saying it a third time. */}
                    <Image src={currencyIcon} alt={isCashPlay ? "Wulf Cash" : "Wulf Coin"} width={14} height={14} />
                  </div>

                  {/* Multiplier */}
                  <div className="flex justify-center">
                    <span
                      className="font-bold text-[13px] tabular-nums px-2 py-0.5 rounded"
                      style={{
                        color: isWin ? "#03B739" : "#6b7280",
                        background: isWin
                          ? "rgba(3,183,57,0.10)"
                          : "rgba(107,114,128,0.10)",
                      }}
                    >
                      {multiplier.toFixed(2)}x
                    </span>
                  </div>

                  {/* Win/Loss */}
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className={`font-bold text-[14px] tabular-nums ${isWin ? "text-[#03B739]" : "text-[#EF4444]"}`}
                    >
                      {isWin ? `+${win.toFixed(2)}` : `-${buyIn.toFixed(2)}`}
                    </span>
                    <Image
                      src={currencyIcon}
                      alt="win-loss"
                      width={14}
                      height={14}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center">
              <NoData title="No Recent Game Logs Found" />
            </div>
          )}
        </div>
          </div>
        </div>

        {/* Pagination Footer */}
        {!isLoading && allData.length > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 border-t border-white/5 sm:px-6"
            style={{ background: "#13151e" }}
          >
            {/* Info. On a phone the framing words wrap onto their own lines
                and push the pager sideways, so only the counts are kept there —
                "1–10 of 20" says the same thing in one line. */}
            <span className="whitespace-nowrap text-[12px] text-white/40 tabular-nums">
              <span className="hidden sm:inline">Showing </span>
              <span className="text-white/70 font-semibold">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, allData.length)}
              </span>{" "}
              of{" "}
              <span className="text-white/70 font-semibold">
                {allData.length}
              </span>
              <span className="hidden sm:inline"> records</span>
            </span>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      <RoundDetailModal round={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
