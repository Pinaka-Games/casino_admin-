"use client"

import Image from "next/image"
import { useState, useEffect, useCallback, useRef } from "react"
import { coingreen } from "@/assets/icons"
import { CashbackProgress, CashbackType } from "@/types/cashback"
import { cashbackAdminApi } from "@/api/cashback/cashback"
import { connectSocket } from "@/lib/socket"

// Events that make this player's cashback snapshot stale. The first three are
// the same cron events the player's own /rewards page listens to; the last
// three are emitted straight from CashbackService for whoever is watching.
const CASHBACK_EVENTS = [
  "rakeback_available",
  "rakeback_expired",
  "rakeback_carried_forward",
  "cashback:progress",
  "cashback:credited",
  "cashback:claimed",
] as const

// Accrual fires on every wager, so a busy player would otherwise trigger a
// refetch per spin.
const REFRESH_DEBOUNCE_MS = 1500

// Same artwork the player sees on /rewards.
const cashbackImageUrls: Record<CashbackType, string> = {
  [CashbackType.INSTANT]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/wheel.svg",
  [CashbackType.HOURLY]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/reward1.svg",
  [CashbackType.DAILY]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/reward2.svg",
  [CashbackType.WEEKLY]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/reward3.svg",
  [CashbackType.MONTHLY]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/reward4.svg",
}

const cashbackLabels: Record<CashbackType, string> = {
  [CashbackType.INSTANT]: "Instant Rebate",
  [CashbackType.HOURLY]: "Hourly Cashback",
  [CashbackType.DAILY]: "Daily Cashback",
  [CashbackType.WEEKLY]: "Weekly Cashback",
  [CashbackType.MONTHLY]: "Monthly Cashback",
}

interface CashbackSectionProps {
  userId?: string;
}

export function CashbackSection({ userId }: CashbackSectionProps) {
  const [cashbackData, setCashbackData] = useState<CashbackProgress[]>([])
  const [loading, setLoading] = useState(true)

  const loadCashback = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId) return;
    try {
      if (!opts?.silent) setLoading(true)
      const res = await cashbackAdminApi.getUserCashback(userId)
      const data = res.data
      
      const progressArray: CashbackProgress[] = []
      // Instant first, mirroring the player's card order.
      if (data.instant) progressArray.push(data.instant)
      if (data.hourly) progressArray.push(data.hourly)
      if (data.daily) progressArray.push(data.daily)
      if (data.weekly) progressArray.push(data.weekly)
      if (data.monthly) progressArray.push(data.monthly)
      
      setCashbackData(progressArray)
    } catch (error) {
      console.error("Failed to fetch cashback progress:", error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadCashback()
  }, [loadCashback])

  // Live updates while this player's detail page is open.
  //
  // Cashback events are emitted to the player's own room (`user:{id}`), which
  // an admin socket never joins — so we explicitly ask the gateway to put this
  // socket in `watch:user:{id}` for as long as the section is mounted. The
  // server emits nothing to that room when it is empty, so an unwatched player
  // costs nothing.
  const loadCashbackRef = useRef(loadCashback)
  loadCashbackRef.current = loadCashback

  useEffect(() => {
    if (!userId) return

    const socket = connectSocket()
    if (!socket) return

    let timer: ReturnType<typeof setTimeout> | null = null

    // Silent refetch: replacing the cards with skeletons on every wager would
    // make the section flicker constantly for an active player.
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void loadCashbackRef.current({ silent: true })
      }, REFRESH_DEBOUNCE_MS)
    }

    const watch = () => socket.emit("admin:watch-user", { userId })

    // Room membership is per-connection, so it has to be re-claimed after a
    // reconnect (sleep, wifi drop, deploy) or the section silently goes stale.
    watch()
    socket.on("connect", watch)
    CASHBACK_EVENTS.forEach((event) => socket.on(event, scheduleRefresh))

    return () => {
      if (timer) clearTimeout(timer)
      CASHBACK_EVENTS.forEach((event) => socket.off(event, scheduleRefresh))
      socket.off("connect", watch)
      socket.emit("admin:unwatch-user", { userId })
    }
  }, [userId])

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
    return amount.toFixed(2)
  }

  const formatTimer = (seconds: number, prefix?: string): string => {
    if (seconds <= 0) return "Ready to Claim"

    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    let str: string
    if (days > 0) str = `${days}d ${hours}h`
    else if (hours > 0) str = `${hours}h ${minutes}m`
    else str = `${minutes}m ${secs}s`

    return prefix ? `${prefix} ${str}` : str
  }

  if (loading) {
    return (
      <section>
        <h2 className="text-xl text-white mb-5">Cashback &amp; Rebate</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-[#191D24] rounded-xl overflow-hidden min-h-[16rem]">
              <div className="p-4 flex flex-col items-center">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-6 h-6 bg-[#242B35] rounded-full" />
                  <div className="w-16 h-5 bg-[#242B35] rounded-md" />
                </div>
                <div className="w-24 h-24 md:w-32 md:h-32 bg-[#242B35] rounded-full relative" />
                <div className="mt-4 w-24 h-3 bg-[#242B35] rounded-md" />
              </div>
              <div className="p-4 pt-0">
                <div className="w-full px-4 py-2 h-8 rounded-lg bg-[#242B35]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (cashbackData.length === 0) {
    return (
      <section>
        <h2 className="text-xl text-white mb-5">Cashback &amp; Rebate</h2>
        <div className="bg-[#191D24] rounded-xl p-8 text-center">
          <p className="text-gray-400">No cashback data available for this user.</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-xl text-white mb-5">Cashback</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cashbackData.map((cashback) => {
          const isInstantCard = cashback.cashbackType === CashbackType.INSTANT
          const nextClaimSecs = cashback.secondsUntilClaimable ?? 0
          const balance = cashback.availableToClaimAmount
          const minAmt = cashback.minClaimAmount || 0
          const periodEndSecs = cashback.periodEndDate
            ? Math.max(
                0,
                Math.floor((new Date(cashback.periodEndDate).getTime() - Date.now()) / 1000),
              )
            : 0

          // Same rule the player's card uses. Reading `isClaimable` alone made
          // admin show "Ready to Claim" while the player was still counting
          // down, or while the balance sat under the minimum.
          const isClaimable =
            !isInstantCard &&
            !!cashback.isClaimable &&
            nextClaimSecs <= 0 &&
            balance >= minAmt

          // Instant rebate is auto-credited, so its headline is what has been
          // paid out, not a claimable balance.
          const displayAmount = isInstantCard
            ? cashback.totalCashbackClaimed
            : cashback.availableToClaimAmount

          return (
            <div key={cashback.id} className="bg-[#191D24] rounded-xl overflow-hidden relative flex h-full flex-col">
              <div className="p-4 flex flex-1 flex-col items-center">
                {/* Amount Display — Wulf Cash, not coins. */}
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-6 h-6 relative">
                    <Image src={coingreen} alt="wulf cash" fill className="object-contain" />
                  </div>
                  <span className="text-white font-bold">
                    {formatCurrency(displayAmount)}
                  </span>
                </div>

                {/* Image Section */}
                <div className="w-24 h-24 md:w-32 md:h-32 relative">
                  <Image
                    src={cashbackImageUrls[cashback.cashbackType]}
                    alt={cashbackLabels[cashback.cashbackType]}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>

                {/* Bonus Name */}
                <div className="mt-3">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">
                    {cashbackLabels[cashback.cashbackType].toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Status Footer — read-only mirror of the player's button state. */}
              <div className="mt-auto p-4 pt-0">
                <div className={`
                  w-full px-4 py-2 rounded-lg text-xs font-semibold text-center
                  ${isClaimable
                    ? "bg-purple-600/20 text-purple-400 border border-purple-600/30 font-bold"
                    : "bg-[#242B35] text-gray-400"
                  }
                `}>
                  {(() => {
                    if (isInstantCard) return "Auto Credited";
                    if (isClaimable) {
                      return periodEndSecs > 0
                        ? `Claim (Exp in ${formatTimer(periodEndSecs)})`
                        : "Ready to Claim";
                    }
                    if (nextClaimSecs > 0) return formatTimer(nextClaimSecs, "Next:");
                    if (periodEndSecs > 0) return formatTimer(periodEndSecs, "Next:");
                    if (balance <= 0) return "Keep Wagering";
                    return "Ready to Claim";
                  })()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
