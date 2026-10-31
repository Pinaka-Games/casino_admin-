"use client"

import React, { useEffect, useMemo, useState } from "react"

import { cashbackAdminApi } from "@/api/cashback/cashback"
import { profileApi } from "@/api/users/users"
import { vipAdminApi, UserVipProgress } from "@/api/vip/vip"
import { ClaimedReward } from "@/types/cashback"

import { CashbackSection } from "../rewardcomponents/cashback-section"
import { ClaimedRewardsGrid } from "../rewardcomponents/claimed-rewards-grid"
import { CurrentRankCard } from "../rewardcomponents/current-rank-card"
import { RankBonusesList } from "../rewardcomponents/rank-bonuses-list"
import { VaultHeader } from "../rewardcomponents/vault-header"
import { VaultSchedule } from "../rewardcomponents/vault-schedule"

interface RewardsTabProps {
  username: string
}

export default function RewardsTab({ username }: RewardsTabProps) {
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [vipProgress, setVipProgress] = useState<UserVipProgress | null>(null)
  const [claimedRewards, setClaimedRewards] = useState<ClaimedReward[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserData() {
      let id: string | undefined

      try {
        setLoading(true)

        const userRes = await profileApi.getUserProfile(username)
        id = userRes.data.id
        setUserId(id)

        const vipRes = await vipAdminApi.getUserVipProgress(id)
        setVipProgress(vipRes.data)

        const rewardsRes = await cashbackAdminApi.getRewardsSummary(id)
        setClaimedRewards(rewardsRes.data)
      } catch (error) {
        console.error("Failed to fetch rewards tab data:", error)
      }

      setLoading(false)
    }

    if (username) {
      fetchUserData()
    }
  }, [username])

  const getTierColor = (name?: string) => {
    if (!name) return "#FACD02"
    const normalizedName = name.toLowerCase()
    if (normalizedName.includes("bronze")) return "#CD7F32"
    if (normalizedName.includes("silver")) return "#C0C0C0"
    if (normalizedName.includes("gold")) return "#FACD02"
    if (normalizedName.includes("platinum")) return "#E5E4E2"
    if (normalizedName.includes("diamond")) return "#B9F2FF"
    if (normalizedName.includes("master")) return "#FF6B6B"
    return "#FACD02"
  }

  const rankBonuses = useMemo(() => {
    if (!vipProgress) return []

    const xp = vipProgress.xp
    const upcoming = vipProgress.tiers.filter((tier) => tier.xp_required >= xp).slice(0, 3)

    return upcoming.map((tier) => ({
      name: tier.name,
      level: tier.level,
      wager: tier.xp_required.toLocaleString(),
      bonus: `+${(tier.xp_required - xp).toLocaleString()}`,
      color: getTierColor(tier.name),
      image: tier.badge,
    }))
  }, [vipProgress])

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="bg-[#1C2127] rounded-xl p-6 h-32 w-full" />

        <div className="space-y-4">
          <div className="h-6 w-48 bg-[#1C2127] rounded" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="min-w-[200px] h-48 bg-[#1C2127] rounded-xl flex-1" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="h-28 bg-[#1C2127] rounded-xl" />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-[#1C2127] rounded-xl" />
          <div className="h-40 bg-[#1C2127] rounded-xl" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <div key={index} className="h-24 bg-[#1C2127] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {userId && (
        <>
          <VaultHeader userId={userId} />
          <VaultSchedule userId={userId} />
          <CashbackSection userId={userId} />

          <div>
            <p className="text-xl text-white mb-5">Current Rank</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
              <CurrentRankCard
                rank={`${vipProgress?.currentTier?.name || ""} ${vipProgress?.currentTier?.level || ""}`}
                xp={vipProgress?.xp || 0}
                progress={vipProgress?.progress || 0}
                badge={vipProgress?.currentTier?.badge}
                color={getTierColor(vipProgress?.currentTier?.name)}
                wagerRemaining={`${(vipProgress?.nextTier?.xp_required || 0) - (vipProgress?.xp || 0)} XP to next rank`}
                onClaim={() => {}}
              />
              <RankBonusesList ranks={rankBonuses} />
            </div>
          </div>

          <ClaimedRewardsGrid rewards={claimedRewards} />
        </>
      )}
    </div>
  )
}
