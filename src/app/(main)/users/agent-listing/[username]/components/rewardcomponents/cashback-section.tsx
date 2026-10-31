import Image from "next/image"
import {  money, bag, lootbox } from '@/assets/images/banner'
import {
  goldcoins,
} from "@/assets/images/banner"
import { coingold } from "@/assets/icons"

const scheduleCards = [
  {
    day: "5m 09s",
    coins: "5 K",
    showMoney: true,
  },
  {
    day: "5m 14s",
    coins: "5 K",
    isSpinwheel: false,
    showMoney: true,
  },
  {
    day: "5m 15s",
    coins: "5 K",
    isGoldcoins: true,
    showMoney: false,
  },
  {
    day: "5m 01s",
    coins: "5 K",
    showMoney: false,
    lootbox: true,
  },
]

export function CashbackSection() {
  return (
    <section>
      <h2 className="text-xl text-white mb-5">Cashback</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {scheduleCards.map((card) => (
          <div key={card.day} className="bg-[#191D24] rounded-xl overflow-hidden">

            <div className="p-4 flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 relative">
                  <Image src={coingold} alt="coin icon" fill className="object-contain" />
                </div>
                <span className="text-white font-bold">{card.coins}</span>
              </div>

              <div className="w-24 h-24 md:w-32 md:h-32 relative">
                {card.showMoney && (
                  <>
                    <div className="absolute bottom-0 left-0 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={money} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute bottom-2 left-0 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={money} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute bottom-2 left-14 md:left-20 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={goldcoins} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute inset-0 translate-x-2">
                      <Image src={coingold} alt="coin" fill className="object-contain" />
                    </div>
                  </>
                )}

                {card.isGoldcoins && (
                  <>
                    <Image src={bag} alt="gold coins" fill className="object-contain" />
                    <div className="absolute bottom-0 left-0 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={money} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute bottom-2 left-14 md:left-20 w-12 top-9 md:top-12 h-9 md:h-12 z-10">
                      <Image src={money} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute bottom-0 left-14 md:left-20 top-8 md:top-10 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={money} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute bottom-2 left-0 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={money} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute bottom-2 left-14 md:left-20 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={goldcoins} alt="money" fill className="object-contain" />
                    </div>
                  </>
                )}

                {card.lootbox && (
                  <>
                    <Image src={lootbox} alt="gold coins" fill className="object-contain" />
                    <div className="absolute bottom-0 left-0 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={money} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute bottom-2 left-0 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={money} alt="money" fill className="object-contain" />
                    </div>
                    <div className="absolute bottom-2 left-14 md:left-20 w-12 h-9 md:w-16 md:h-12 z-10">
                      <Image src={goldcoins} alt="money" fill className="object-contain" />
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Card Content */}
            <div className="p-4 flex flex-col items-center">
              <div className="bg-[#242B35] w-full px-4 py-1 rounded-4xl text-center ">
                <span className="text-gray-400 font-normal text-sm">{card.day}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
