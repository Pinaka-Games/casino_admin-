"use client"
import { motion, AnimatePresence } from 'framer-motion'
import { vipcard } from '@/assets/images/vip'

interface CurrentRankCardProps {
  rank: string
  xp: number
  progress: number
  wagerRemaining: string
  badge?: any
  color?: string
  onClaim: () => void
}

export function CurrentRankCard({ rank, xp, progress, wagerRemaining, badge, color, onClaim }: CurrentRankCardProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className="pt-14 flex flex-col relative">
      {/* Badge floats above the card — on the outer relative wrapper so overflow-hidden on card doesn't clip it */}
      <div className="absolute top-0 left-16 z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={rank}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {badge && (
              <img
                src={typeof badge === 'object' ? badge.src : badge}
                alt="VIP Badge"
                className="h-28 w-28 object-contain drop-shadow-xl"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className="relative flex-1 rounded-2xl bg-cover bg-center text-white overflow-hidden"
        style={{ backgroundImage: `url(${vipcard.src})` }}
      >
        <div className="relative z-10 flex flex-col gap-6 p-5 pt-16 sm:p-6 sm:pt-16">
          {/* Tier name + XP */}
          <div className="flex justify-between">
            <AnimatePresence mode="wait">
              <motion.h1
                key={rank}
                className="text-2xl ml-1 px-12 py-2 font-bold"
                style={{ color: color || '#FACD02' }}
              >
                {rank}
              </motion.h1>
            </AnimatePresence>
            <div className="text-sm font-semibold text-white sm:text-base">
              <strong>XP :</strong> {xp}
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white opacity-90">Your VIP Progress</span>
              <motion.span className="font-semibold text-white" key={clampedProgress}>
                {clampedProgress.toFixed(2)}%
              </motion.span>
            </div>

            <div className="relative w-full bg-[#1F1D24] rounded-full h-3">
              {/* Progress Fill */}
              <motion.div
                className="rounded-full h-3 bg-yellow-400"
                animate={{ width: `${clampedProgress.toFixed(2)}%` }}
              />
              {/* Circle Indicator */}
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-yellow-400 rounded-full border-2 border-gray-300"
                animate={{ left: `calc(${clampedProgress.toFixed(2)}% - 8px)` }}
              />
            </div>

            <p className="text-xs text-gray-300 pt-1">{wagerRemaining}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
