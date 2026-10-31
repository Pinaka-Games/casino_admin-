"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { goldsafe, bar3, bar8, bar15, bar30 } from "@/assets/images/banner";
import { dailyStreakAdminApi, UserStreakData } from "@/api/daily-streak/daily-streak";

const milestoneImages = [bar3, bar8, bar15, bar30];
const milestoneColors = [
  "from-green-400 to-green-600",
  "from-yellow-400 to-yellow-600",
  "from-cyan-300 to-cyan-500",
  "from-purple-400 to-purple-600",
];

interface VaultHeaderProps {
  userId?: string;
}

export function VaultHeader({ userId }: VaultHeaderProps) {
  const [data, setData] = useState<UserStreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{ isEnabled: boolean; totalDays: number; milestoneDays: number[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const configRes = await dailyStreakAdminApi.getConfig();
      setConfig({
        isEnabled: configRes.data.isEnabled,
        totalDays: configRes.data.totalDays,
        milestoneDays: configRes.data.milestoneDays || [],
      });

      if (userId) {
        const res = await dailyStreakAdminApi.getUserStreak(userId);
        setData(res.data);
      }
    } catch {
      console.error("Failed to load streak header data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <section className="relative animate-pulse">
        <div className="h-7 w-32 bg-[#242B35] rounded-lg mb-5" />
        <div className="bg-[#1a1f26] rounded-xl p-4 md:p-6 h-40 flex justify-between items-center">
          <div className="w-full max-w-md">
              <div className="h-8 w-64 bg-[#242B35] rounded-lg mb-8" />
              <div className="h-6 w-full bg-[#242B35] rounded-full" />
          </div>
          <div className="w-32 h-32 bg-[#242B35] rounded-xl" />
        </div>
      </section>
    );
  }

  const currentDay = data?.exists ? data.currentStreakDay || 1 : 1;
  const totalDays = config?.totalDays || 14;
  const progressPercent = Math.min(
    totalDays <= 1 ? 100 : ((currentDay - 1) / (totalDays - 1)) * 100,
    100
  );
  const isEnabled = config?.isEnabled ?? true;

  const milestones = (data?.milestoneDays || config?.milestoneDays || [])
    .filter((day) => day >= 1 && day <= totalDays)
    .map((day, index) => ({
      day,
      color: milestoneColors[index % milestoneColors.length],
      image: milestoneImages[index % milestoneImages.length],
      completed: Boolean(data?.streakCompleted) || currentDay > day,
      isCurrent: currentDay === day,
      positionPercent: totalDays <= 1 ? 100 : ((day - 1) / (totalDays - 1)) * 100,
    }));

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl text-white">Rewards</h2>
        {!isEnabled && (
          <span className="text-xs font-semibold text-red-400 bg-red-900/30 border border-red-700/40 rounded-full px-3 py-1">
            Feature Disabled
          </span>
        )}
      </div>

      <div className="bg-[#1a1f26] rounded-xl p-4 md:p-6 relative overflow-visible">
        <div className="flex flex-row justify-between gap-4 md:gap-10 items-center md:items-start">
          <div className="w-full md:flex-1">
            <h3 className="text-white text-base md:text-2xl font-bold mb-4 md:mb-6 text-center md:text-left">
              <span className="md:inline text-[#088EF9]">
                Daily Streak Rewards
              </span>
              {data?.exists && (
                <span className="text-sm text-gray-400 ml-2 font-normal">
                  (Day {currentDay} of {totalDays})
                </span>
              )}
            </h3>

            <div className="relative mt-14 md:mt-20 mb-6 hidden md:block">
              {/* Track */}
              <div className="h-4 md:h-8 bg-[#2a3441] rounded-full relative border-4 md:border-8 border-[#8292AA] overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Milestone markers — icon above + circle on bar */}
              {milestones.map((milestone, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === milestones.length - 1;
                const translateClass = isFirst
                  ? "translate-x-0"
                  : isLast
                  ? "-translate-x-full"
                  : "-translate-x-1/2";

                return (
                  <div
                    key={milestone.day}
                    className={`absolute flex flex-col items-center gap-1 ${translateClass}`}
                    style={{ left: `${milestone.positionPercent}%`, bottom: 0 }}
                  >
                    {/* Day circle — sits ON the bar */}
                    <div
                      className={`w-6 h-6 md:w-8 md:h-8 text-center rounded-full flex items-center justify-center shadow-lg ${
                        milestone.completed
                          ? "bg-gradient-to-br from-green-200 to-green-700"
                          : milestone.isCurrent
                          ? `bg-gradient-to-br ${milestone.color} ring-2 ring-white/60`
                          : `bg-gradient-to-br ${milestone.color} opacity-50`
                      }`}
                    >
                      <span className="text-black text-[9px] md:text-[13px] font-bold leading-none">
                        {milestone.day}
                      </span>
                    </div>

                    {/* Reward icon — floats above the bar */}
                    <div
                      className="absolute w-6 h-6 md:w-8 md:h-8 rounded shadow-lg"
                      style={{ position: "absolute", bottom: "100%", marginBottom: "6px" }}
                    >
                      <Image
                        src={milestone.image}
                        alt={`Day ${milestone.day} Reward`}
                        fill
                        className={`object-contain ${milestone.completed || milestone.isCurrent ? "" : "grayscale opacity-70"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative shrink-0 w-20 h-20 md:w-40 md:h-40 -mt-8 md:mt-0">
            <Image
              src={goldsafe}
              alt="Daily Streak Rewards"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
