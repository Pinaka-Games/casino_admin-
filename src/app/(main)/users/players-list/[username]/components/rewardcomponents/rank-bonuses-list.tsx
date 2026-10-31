import { motion, AnimatePresence } from "framer-motion"

export interface RankBonus {
  name: string
  wager: string
  bonus: string
  color: string
  image: any
  level?: number
}

interface RankBonusesListProps {
  ranks: RankBonus[]
}

export function RankBonusesList({ ranks }: RankBonusesListProps) {
  return (
    <div className="bg-[#191D24] p-3 rounded-xl flex flex-col">
      <span className="text-lg text-white px-2 mb-1">Next VIP Rewards</span>

      <div className="space-y-2 mt-1">
        <AnimatePresence mode="popLayout">
          {ranks.map((rank, index) => (
            <motion.div
              key={index}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[#2f394a] p-2 sm:p-3"
            >
              <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                <img
                  src={typeof rank.image === 'object' ? rank.image.src : rank.image}
                  alt="Badge"
                  className="h-12 w-12 flex-shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white text-sm sm:text-base">
                    {rank.name} {rank.level}
                  </div>
                  <div className="text-white text-sm sm:text-base">
                    <span className="text-[#9DA8AA]">Wager </span>
                    {rank.wager}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-green-400 sm:text-base">
                {rank.bonus}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
