"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Crown, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  jackpotAdminApi,
  JackpotLastRound,
  JackpotParticipantsPage,
} from "@/api/jackpot/jackpot.api";

const PAGE_SIZE = 10;

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const curLabel = (c: string) => (c === "wulfCash" ? "WC$" : "WC");

/**
 * Participant pool for one jackpot (per-game pot or progressive tier), in two
 * tabs: the current round's live pool, and the last finished round — its
 * winner, pot at the draw, draw type (drop vs scheduled) and the full pool as
 * it stood when the draw happened (the live pool clears on every win).
 */
export default function JackpotParticipantsView() {
  const router = useRouter();
  const { jackpotId } = useParams<{ jackpotId: string }>();
  const searchParams = useSearchParams();
  const title = searchParams.get("title") || "Jackpot";

  const [tab, setTab] = useState<"current" | "last">("current");
  const [data, setData] = useState<JackpotParticipantsPage | null>(null);
  const [lastRound, setLastRound] = useState<JackpotLastRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoading, setLastLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);

  // Search is debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (!jackpotId) return;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await jackpotAdminApi.participants(
          jackpotId,
          page,
          PAGE_SIZE,
          search
        );
        setData(res);
      } catch {
        toast.error("Failed to load participants");
      } finally {
        setLoading(false);
      }
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [jackpotId, page, search, refreshTick]);

  // Last finished round — loaded once (and on refresh), independent of search.
  useEffect(() => {
    if (!jackpotId) return;
    (async () => {
      try {
        setLastLoading(true);
        setLastRound(await jackpotAdminApi.lastRound(jackpotId));
      } catch {
        toast.error("Failed to load last round");
      } finally {
        setLastLoading(false);
      }
    })();
  }, [jackpotId, refreshTick]);

  const round = lastRound?.round ?? null;

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      <div className="bg-[#191D24] mb-3 md:mb-4 px-3 md:px-4 py-3 rounded-lg flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="shrink-0 rounded-lg border-gray-600 text-gray-200 hover:bg-[#242B35]"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <h1 className="min-w-0 basis-full truncate text-base font-medium text-white md:basis-auto">
            Jackpot Participants — {title}
          </h1>
          {data?.pot && (
            <span className="whitespace-nowrap rounded-md bg-[#242B35] px-3 py-1 text-xs text-gray-300">
              Current Pot:{" "}
              <span className="font-medium text-[#04AD37] tabular-nums">
                {fmtMoney(data.pot.currentAmount)} {curLabel(data.pot.currency)}
              </span>
              {data.pot.dropTarget ? (
                <span className="text-gray-500">
                  {" "}
                  / drops at{" "}
                  {data.pot.dropTarget.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </span>
              ) : null}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          {tab === "current" && (
            <Input
              placeholder="Search username / name / email…"
              className="bg-[#242B35] border-gray-700 text-white max-w-xs"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          )}
          <Button
            type="button"
            variant="outline"
            disabled={loading || lastLoading}
            onClick={() => setRefreshTick((n) => n + 1)}
            title="Refresh pot & participants"
            className="rounded-lg border-gray-600 text-gray-200 hover:bg-[#242B35]"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading || lastLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex items-center gap-1 rounded-lg bg-[#191D24] p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("current")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            tab === "current"
              ? "bg-[#7C3AED] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Current Round{data ? ` (${data.total})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setTab("last")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            tab === "last"
              ? "bg-[#7C3AED] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Last Draw
          {lastRound ? ` (${lastRound.participants.length})` : ""}
        </button>
      </div>

      {tab === "current" ? (
        <>
          <p className="mb-3 px-1 text-xs text-gray-500">
            Users with a qualifying bet in the current round — the eligible pool
            for the next drop/draw. Clears when the pot is won.
          </p>

          <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E]">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-[#242B35] sticky top-0">
                <tr className="border-b border-gray-800 text-left text-white">
                  <th className="px-4 py-3 font-normal">#</th>
                  <th className="px-4 py-3 font-normal">User</th>
                  <th className="px-4 py-3 font-normal">Email</th>
                  <th className="px-4 py-3 font-normal">Qualifying Bets</th>
                  <th className="px-4 py-3 font-normal">Added to Pot</th>
                  <th className="px-4 py-3 font-normal">
                    Pot (before → after last bet)
                  </th>
                  <th className="px-4 py-3 font-normal">Last Bet</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-400" />
                    </td>
                  </tr>
                ) : data?.items.length ? (
                  data.items.map((row, idx) => (
                    <tr
                      key={row.userId}
                      className={`text-gray-300 hover:bg-[#1a2030] ${
                        idx % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-500 tabular-nums">
                        {(data.page - 1) * data.limit + idx + 1}
                      </td>
                      <td className="px-4 py-3 text-white">{row.name}</td>
                      <td className="px-4 py-3">{row.email || "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{row.betCount}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {/* Rows written before pot tracking have no snapshot yet —
                            show a dash instead of a misleading +0.00. */}
                        {row.lastPotAfter != null || row.contributed > 0 ? (
                          <span className="text-[#04AD37]">
                            +
                            {row.contributed.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                        {row.lastPotBefore != null && row.lastPotAfter != null ? (
                          <>
                            {fmtMoney(row.lastPotBefore)}
                            <span className="text-gray-500"> → </span>
                            <span className="text-white">
                              {fmtMoney(row.lastPotAfter)}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(row.lastBetAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      {search
                        ? "No participants match the search."
                        : round
                          ? "No participants in the current round yet — the pool cleared when the pot was last won (see the Last Draw tab)."
                          : "No participants in the current round yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
              <span>
                Page {data.page} of {data.totalPages} · {data.total} participants
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 bg-[#4A5568] hover:bg-[#5A6578] text-white px-3"
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  disabled={page >= data.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 bg-[#4A5568] hover:bg-[#5A6578] text-white px-3"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Rounds won before history tracking have no archived pool, but the
              winner is still known from the pot's own last-win stats. */}
          {!round && data?.lastWin && (
            <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
              <span className="rounded-md bg-[#242B35] px-3 py-1.5 text-xs text-gray-300">
                Winner:{" "}
                <span className="font-medium text-white">
                  {data.lastWin.name}
                </span>
              </span>
              {data.lastWin.amount != null && (
                <span className="rounded-md bg-[#242B35] px-3 py-1.5 text-xs text-gray-300">
                  Payout:{" "}
                  <span className="font-medium text-[#F0B90B] tabular-nums">
                    {fmtMoney(data.lastWin.amount)}{" "}
                    {curLabel(data.lastWin.currency)}
                  </span>
                </span>
              )}
              {data.lastWin.wonAt && (
                <span className="rounded-md bg-[#242B35] px-3 py-1.5 text-xs text-gray-300">
                  Won: {new Date(data.lastWin.wonAt).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Last round summary */}
          {round && (
            <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
              <span className="rounded-md bg-[#242B35] px-3 py-1.5 text-xs text-gray-300">
                Winner:{" "}
                <span className="font-medium text-white">
                  {round.winnerName ?? round.winnerUserId ?? "—"}
                </span>
                {round.winnerEmail && (
                  <span className="ml-1.5 text-gray-400">
                    ({round.winnerEmail})
                  </span>
                )}
              </span>
              <span className="rounded-md bg-[#242B35] px-3 py-1.5 text-xs text-gray-300">
                Payout:{" "}
                <span className="font-medium text-[#F0B90B] tabular-nums">
                  {fmtMoney(round.payout)} {curLabel(round.currency)}
                </span>
              </span>
              <span className="rounded-md bg-[#242B35] px-3 py-1.5 text-xs text-gray-300">
                Pot at draw:{" "}
                <span className="font-medium text-[#04AD37] tabular-nums">
                  {fmtMoney(round.potAmount)} {curLabel(round.currency)}
                </span>
              </span>
              <span className="rounded-md bg-[#242B35] px-3 py-1.5 text-xs text-gray-300">
                Draw type:{" "}
                <span
                  className={`font-medium ${
                    round.drawType === "scheduled"
                      ? "text-[#38BDF8]"
                      : "text-white"
                  }`}
                >
                  {round.drawType === "scheduled" ? "Scheduled" : "Drop target"}
                </span>
              </span>
              <span className="rounded-md bg-[#242B35] px-3 py-1.5 text-xs text-gray-300">
                Ended: {new Date(round.endedAt).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E]">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-[#242B35] sticky top-0">
                <tr className="border-b border-gray-800 text-left text-white">
                  <th className="px-4 py-3 font-normal">#</th>
                  <th className="px-4 py-3 font-normal">User</th>
                  <th className="px-4 py-3 font-normal">Email</th>
                  <th className="px-4 py-3 font-normal">Qualifying Bets</th>
                  <th className="px-4 py-3 font-normal">Added to Pot</th>
                  <th className="px-4 py-3 font-normal">Last Bet</th>
                  <th className="px-4 py-3 font-normal">Result</th>
                </tr>
              </thead>
              <tbody>
                {lastLoading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-400" />
                    </td>
                  </tr>
                ) : lastRound?.participants.length ? (
                  lastRound.participants.map((row, idx) => (
                    <tr
                      key={row.userId}
                      className={`hover:bg-[#1a2030] ${
                        row.isWinner
                          ? "bg-[#2a2416] text-[#F0B90B]"
                          : `text-gray-300 ${
                              idx % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                            }`
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          row.isWinner ? "font-medium text-[#F0B90B]" : "text-white"
                        }`}
                      >
                        {row.name}
                      </td>
                      <td className="px-4 py-3">{row.email || "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{row.betCount}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.contributed > 0 ? (
                          <span className="text-[#04AD37]">
                            +
                            {row.contributed.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.lastBetAt
                          ? new Date(row.lastBetAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.isWinner ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#F0B90B]/15 px-2.5 py-0.5 font-semibold text-[#F0B90B]">
                            <Crown className="h-3 w-3" />
                            WINNER
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      {data?.lastWin
                        ? "Participant list wasn't recorded for this round — round history is captured from the next draw onward. The winner shown above comes from the pot's own stats."
                        : "No finished round recorded yet — history is captured from the next draw onward."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
