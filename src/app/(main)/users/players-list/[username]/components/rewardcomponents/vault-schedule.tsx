"use client"

import Image from "next/image"
import { useRef, useEffect, useState, useCallback } from "react"
import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react"
import { money, goldcoins, crown, spinwheel } from "@/assets/images/banner"
import { coingold, coingreen } from "@/assets/icons"
import { dailyStreakAdminApi, UserStreakData } from "@/api/daily-streak/daily-streak";

interface VaultScheduleProps {
  userId?: string;
}

export function VaultSchedule({ userId }: VaultScheduleProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showAll, setShowAll] = useState(false)
  const [data, setData] = useState<UserStreakData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await dailyStreakAdminApi.getUserStreak(userId);
      setData(res.data);
    } catch {
      console.error("Failed to load user streak data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const scrollLeft = () =>
    scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" });

  const scrollRight = () =>
    scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" });

  if (loading) return <VaultScheduleSkeleton />;
  if (!data || !data.exists || !data.rewards || data.rewards.length === 0) return null;

  const rewards = data.rewards;
  const currentDay = data.currentStreakDay;
  const streakCompleted = data.streakCompleted;

  return (
    <section className="w-full flex flex-col gap-4">
      {/* HEADER WITH CONTROLS */}
      <div className="flex justify-between items-center w-full">
        <h2 className="text-xl text-white font-medium">
          Daily Streak Rewards Schedule
        </h2>

        <div className="flex items-center gap-2">
          {/* SCROLL BUTTONS - Only show when NOT in grid view */}
          {!showAll && (
            <div className="hidden md:flex items-center gap-2 mr-1">
              <button
                onClick={scrollLeft}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#2A2F3A] hover:bg-[#3A404D] border border-white/5 transition-all hover:scale-105 active:scale-95 group"
                aria-label="Scroll Left"
              >
                <ChevronLeft className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={scrollRight}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#2A2F3A] hover:bg-[#3A404D] border border-white/5 transition-all hover:scale-105 active:scale-95 group"
                aria-label="Scroll Right"
              >
                <ChevronRight className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
              </button>
            </div>
          )}

          {/* VIEW TOGGLE */}
          <button
            onClick={() => setShowAll(!showAll)}
            className="h-9 px-4 flex items-center gap-2 rounded-xl bg-[#2A2F3A] hover:bg-[#B93DEB]/20 hover:text-[#B93DEB] border border-white/5 text-white text-sm font-medium transition-all hover:scale-105 active:scale-95 group"
          >
            {showAll ? (
              <>
                <List className="w-4 h-4" />
                <span>View Less</span>
              </>
            ) : (
              <>
                <LayoutGrid className="w-4 h-4" />
                <span>View All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CAROUSEL / GRID CONTAINER */}
      <div
        ref={scrollRef}
        className={`w-full pb-2 ${showAll
          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 cursor-default"
          : "flex gap-3 overflow-x-auto scroll-smooth snap-x [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
          }`}
      >
        {rewards.map((reward) => (
          <div 
            key={reward.day}
            // 200px could not hold the three reward tiles plus the milestone
            // banner, so their labels wrapped and the card looked broken. On a
            // phone the card takes most of the width, with the next one just
            // peeking to show the row scrolls.
            className={
              showAll
                ? ""
                : "min-w-[78%] sm:min-w-[240px] md:min-w-[280px] snap-start"
            }
          >
            <ScheduleCard 
              reward={reward} 
              isCurrent={currentDay !== undefined && reward.day === currentDay}
              streakCompleted={streakCompleted || false}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// Matches the player's screen: exact, comma-grouped, never abbreviated. The
// admin previously rendered "10K", which disagreed with the "10,000" the player
// was looking at on the same reward.
const formatAmount = (amount: number): string =>
  amount.toLocaleString("en-US", { maximumFractionDigits: 2 });

const formatSpinCount = (count: number): string =>
  Math.max(0, Math.floor(count)).toLocaleString("en-US");

/** Anything unparseable reads as 0 — never NaN, which silently hides a row. */
const toCount = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A day can grant Wulf Cash + Wulf Coin + free spins together. Legacy rows carry
 * only `rewardType`/`amount`, so fall back to those — same normalisation the
 * player's card does, so both screens read identically.
 */
function rewardAmountsOf(reward: any) {
  const cash = reward.cashAmount ?? (reward.rewardType === "WULF_CASH" ? reward.amount : 0);
  const coin = reward.coinAmount ?? (reward.rewardType === "WULF_COIN" ? reward.amount : 0);
  const spins = reward.freeSpinAmount ?? (reward.rewardType === "FREE_SPIN" ? reward.amount : 0);
  return { cash: toCount(cash), coin: toCount(coin), spins: toCount(spins) };
}

/**
 * One tile per non-zero reward — mirrors the player's "BONUS REWARDS" row. Each
 * tile is labelled: a bare number under a small icon read as cash whatever the
 * reward actually was, which is how free spins ended up looking like a payout.
 */
function rewardTiles(a: { cash: number; coin: number; spins: number }) {
  const tiles: { icon: any; value: string; label: string }[] = [];
  if (a.cash > 0) tiles.push({ icon: coingreen, value: formatAmount(a.cash), label: "Cash" });
  if (a.coin > 0) tiles.push({ icon: coingold, value: formatAmount(a.coin), label: "Coin" });
  if (a.spins > 0)
    tiles.push({ icon: spinwheel, value: formatSpinCount(a.spins), label: "Free Spins" });
  return tiles;
}

function ScheduleCard({ reward, isCurrent, streakCompleted }: { reward: any, isCurrent: boolean, streakCompleted: boolean }) {
  const milestoneBonusCash = toCount(reward.milestoneBonusCash);
  const milestoneBonusCoin = toCount(reward.milestoneBonusCoin);
  const milestoneBonusFreeSpin = toCount(reward.milestoneBonusFreeSpin);
  const amounts = rewardAmountsOf(reward);
  const tiles = rewardTiles(amounts);

  return (
    <div className={`bg-[#191D24] rounded-xl overflow-hidden h-full border ${isCurrent ? 'border-[#B93DEB]' : 'border-transparent'} relative flex flex-col`}>
      {isCurrent && (
        <div className="absolute -top-1 -right-1 z-10 w-8 h-8 rotate-12">
            <Image src={crown} alt="current streak crown" fill className="object-contain" />
        </div>
      )}
      {reward.isMilestone && (
        <div className="absolute left-3 top-3 z-10 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
          Milestone
        </div>
      )}
      <div className={`p-4 rounded-xl text-center ${isCurrent ? 'bg-[#B93DEB]/20' : 'bg-[#242B35]'}`}>
        <span className="text-white">Day {reward.day}</span>
      </div>
      <div className="p-4 flex flex-col items-center flex-grow">
        <div className="w-28 h-28 relative">
          <div className="transition-all duration-300">
            {amounts.cash <= 0 && amounts.coin <= 0 && amounts.spins > 0 ? (
              <Image src={spinwheel || "/placeholder.svg"} alt="spin wheel" fill className="object-contain" />
            ) : (
              <>
                <div className="absolute inset-0 translate-x-2">
                  <Image src={amounts.cash > 0 ? coingreen : coingold} alt="coin" fill className="object-contain" />
                </div>
                {/* A day granting spins alongside cash/coin still shows the wheel,
                    so a free-spin reward is never read as a cash-only day. */}
                <div className="absolute bottom-0 left-0 w-16 h-12 z-10">
                  <Image
                    src={(amounts.spins > 0 ? spinwheel : money) || "/placeholder.svg"}
                    alt={amounts.spins > 0 ? "spin wheel" : "money"}
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="absolute bottom-2 left-20 w-16 h-12 z-10">
                  <Image src={goldcoins || "/placeholder.svg"} alt="coins" fill className="object-contain" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* BONUS REWARDS row — one tile per currency, exactly like the player's
            card. A single icon+amount here showed only one of the day's rewards. */}
        <div className="flex items-center gap-2 w-full mt-auto mb-2">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#BB9B49]" />
          <span className="text-[10px] font-bold tracking-[0.15em] text-[#EBD197] uppercase whitespace-nowrap">
            Bonus Rewards
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-[#BB9B49] to-transparent" />
        </div>

        {tiles.length > 0 && (
          <div
            className={`w-full grid gap-2 ${tiles.length === 1 ? "grid-cols-1" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
          >
            {tiles.map((tl, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-1 rounded-lg bg-[#0E131C] border border-white/10 px-1 py-2"
              >
                <span className="relative w-6 h-6 shrink-0">
                  <Image src={tl.icon} alt="" fill className="object-contain" />
                </span>
                <span className="text-white font-bold text-sm leading-none">{tl.value}</span>
                <span className="text-[9px] uppercase tracking-wide text-white/45 leading-none text-center">
                  {tl.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {(milestoneBonusCash > 0 || milestoneBonusCoin > 0 || milestoneBonusFreeSpin > 0) && (
          <div className="mt-3 w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Special Milestone Bonus
            </p>
            <p className="text-sm font-bold text-white">
              {[
                milestoneBonusCash > 0 ? `+${formatAmount(milestoneBonusCash)} Wulf Cash` : null,
                milestoneBonusCoin > 0 ? `+${formatAmount(milestoneBonusCoin)} Wulf Coin` : null,
                milestoneBonusFreeSpin > 0
                  ? `+${formatSpinCount(milestoneBonusFreeSpin)} Spins`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        )}
      </div>
      {/* Button Section */}
      <div className="p-4 pt-0">
        {reward.isClaimed ? (
          <button
            disabled
            className="w-full px-4 py-2.5 rounded-lg text-xs font-bold transition-all border border-[#2a2e3e] bg-[#191D24] text-gray-500 cursor-not-allowed uppercase"
          >
            Claimed
          </button>
        ) : isCurrent ? (
          <button
            disabled
            className="w-full px-4 py-2.5 rounded-lg text-xs font-bold transition-all border border-[#7c3aed] bg-[#7c3aed]/20 text-purple-300 cursor-not-allowed uppercase"
          >
            Next Reward
          </button>
        ) : (
          <button
            disabled
            className="w-full px-4 py-2.5 rounded-lg text-xs font-bold transition-all border border-[#2a2e3e] bg-[#191D24] text-gray-400/50 cursor-not-allowed uppercase"
          >
            Locked
          </button>
        )}
      </div>
    </div>
  )
}

function VaultScheduleSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="h-7 w-48 bg-[#242B35] rounded-lg mb-5" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#191D24] rounded-xl overflow-hidden h-64 border border-transparent">
            <div className="h-14 bg-[#242B35] w-full" />
            <div className="p-4 flex flex-col items-center gap-4">
               <div className="h-6 w-24 bg-[#242B35] rounded-lg" />
               <div className="h-32 w-32 bg-[#242B35] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
