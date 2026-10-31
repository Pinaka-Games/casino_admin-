import Image from "next/image"

export interface RankBonus {
  name: string
  wager: string
  bonus: string
  color: string
  image: any
}

interface RankBonusesListProps {
  ranks: RankBonus[]
}

export function RankBonusesList({ ranks }: RankBonusesListProps) {
  return (
    <div>
      <p className="text-xl text-white mb-5">Rank & Bonuses</p>
      <div className="bg-[#191D24] rounded-xl p-4 space-y-3 h-[90%] ">
        {ranks.map((rank, index) => (
          <div key={index} className="flex items-center justify-between bg-[#242B35] rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 ">
                <Image
                  src={rank.image}
                  alt="Rewards Vault"
                  width={45}
                  height={45}
                  className="object-contain"
                /></div>
              <div>
                <p className="text-white text-sm font-medium">{rank.name}</p>
                <p className="text-gray-500 text-xs">Wager {rank.wager}</p>
              </div>
            </div>
            <p className="text-green-400 text-sm font-medium">{rank.bonus}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
