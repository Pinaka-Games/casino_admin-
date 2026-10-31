"use client"

import { UserStreakData } from "@/api/daily-streak/daily-streak"
import { CheckCircle2, Clock, Flame } from "lucide-react"

interface UserStreakCardProps {
  streakData: UserStreakData | null
  loading?: boolean
}

export function UserStreakCard({ streakData, loading }: UserStreakCardProps) {
  if (loading) {
    return (
      <div className="w-full">
        <p className="text-xl text-white mb-5">Daily Streak Status</p>
        <div className="bg-[#191D24] rounded-xl p-6 h-[300px] animate-pulse" />
      </div>
    )
  }

  if (!streakData || !streakData.exists) {
    return (
      <div className="w-full">
        <p className="text-xl text-white mb-5">Daily Streak Status</p>
        <div className="bg-[#191D24] rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Flame className="w-12 h-12 text-gray-600 mb-3" />
          <p className="text-gray-400">No active streak found for this user.</p>
        </div>
      </div>
    )
  }

  const currentDay = streakData.currentStreakDay || 0
  const rewards = streakData.rewards || []

  return (
    <div className="w-full">
      <p className="text-xl text-white mb-5">Daily Streak Status</p>
      <div className="bg-[#191D24] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#B93DEB]/20 p-2 rounded-lg">
              <Flame className="w-6 h-6 text-[#B93DEB]" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Current Progress</p>
              <p className="text-lg font-bold text-white">Day {currentDay} of 7</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Last Claimed</p>
            <div className="flex items-center gap-2 text-white font-medium justify-end">
              <Clock className="w-4 h-4 text-[#B93DEB]" />
              {streakData.lastRewardClaimDate 
                ? new Date(streakData.lastRewardClaimDate).toLocaleString()
                : "Never"}
            </div>
          </div>
        </div>

        {/* Success / Completion Status */}
        {streakData.streakCompleted && (
          <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-500 font-medium font-outfit">
              User has completed the full 7-day streak!
            </p>
          </div>
        )}

        {/* 7-Day Grid */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => {
            const dayNum = i + 1
            const isCompleted = dayNum < currentDay || (dayNum === currentDay && rewards.find(r => r.day === dayNum)?.isClaimed)
            const isCurrent = dayNum === currentDay && !isCompleted
            const reward = rewards.find(r => r.day === dayNum)

            return (
              <div 
                key={dayNum}
                className={`relative flex flex-col items-center p-2 rounded-lg border transition-all ${
                  isCompleted 
                    ? "bg-green-500/10 border-green-500/30 text-green-500" 
                    : isCurrent
                    ? "bg-[#B93DEB]/10 border-[#B93DEB]/40 text-[#B93DEB]"
                    : "bg-[#242B35] border-transparent text-gray-500"
                }`}
              >
                <span className="text-[10px] font-bold uppercase mb-1">Day {dayNum}</span>
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Flame className={`w-5 h-5 ${isCurrent ? "animate-pulse" : ""}`} />
                )}
                {reward && (
                  <span className="mt-1 text-[9px] font-medium truncate max-w-full">
                    {reward.amount} {reward.rewardType.split('_')[1] || reward.rewardType}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        
        <p className="mt-6 text-xs text-gray-500 text-center font-outfit">
          Streak will reset if the user misses a consecutive day of logging in and claiming.
        </p>
      </div>
    </div>
  )
}
