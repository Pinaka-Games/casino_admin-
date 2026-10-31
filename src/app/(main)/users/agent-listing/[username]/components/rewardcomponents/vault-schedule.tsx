
"use client"

import Image from "next/image"
import { useRef, useEffect, useState } from "react"
import { money } from "@/assets/images/banner"
import { spinwheel, goldcoins } from "@/assets/images/banner"
import { coingold } from "@/assets/icons"

const scheduleCards = [
  {
    day: "Day 1",
    coins: "5 K",
    showMoney: true,
  },
  {
    day: "Day 2",
    coins: "5 K",
    isSpinwheel: true,
    showMoney: false,
  },
  {
    day: "Day 3",
    coins: "5 K",
    isGoldcoins: true,
    showMoney: false,
  },
  {
    day: "Day 4",
    coins: "5 K",
    showMoney: true,
  },
]

export function VaultSchedule() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isScrollable, setIsScrollable] = useState(false)

  useEffect(() => {
    // Check if carousel needs to be visible (for mobile/small screens)
    const handleResize = () => {
      if (scrollContainerRef.current) {
        const isSmallScreen = window.innerWidth < 768
        setIsScrollable(isSmallScreen)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <section>
      <h2 className="text-xl text-white mb-5">Vault Schedule</h2>

      <div className="hidden md:grid grid-cols-4 gap-3">
        {scheduleCards.map((card) => (
          <ScheduleCard key={card.day} card={card} />
        ))}
      </div>

      <div
        ref={scrollContainerRef}
        className="md:hidden overflow-x-auto scrollbar-hide"
        style={{
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
          {scheduleCards.map((card, index) => (
            <div
              key={card.day}
              style={{
                flex: "0 0 calc(100vw - 2rem)",
                maxWidth: "280px",
              }}
            >
              <ScheduleCard card={card} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ScheduleCard({ card }: { card: (typeof scheduleCards)[0] }) {
  return (
    <div className="bg-[#191D24] rounded-xl overflow-hidden h-full">
      <div className="bg-[#242B35] p-4 rounded-xl text-center">
        <span className="text-white">{card.day}</span>
      </div>
      <div className="p-4 flex flex-col items-center">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-6 h-6 relative">
            <Image src={coingold} alt="coin icon" fill className="object-contain" />
          </div>
          <span className="text-white font-bold">{card.coins}</span>
        </div>
        <div className="w-32 h-32 relative">
          {card.showMoney && (
            <>
              <div className="absolute bottom-0 left-0 w-16 h-12 z-10">
                <Image src={money || "/placeholder.svg"} alt="money" fill className="object-contain" />
              </div>
              <div className="absolute bottom-2 left-0 w-16 h-12 z-10">
                <Image src={money || "/placeholder.svg"} alt="money" fill className="object-contain" />
              </div>
              <div className="absolute bottom-2 left-20 w-16 h-12 z-10">
                <Image src={goldcoins || "/placeholder.svg"} alt="money" fill className="object-contain" />
              </div>
              <div className="absolute inset-0 translate-x-2">
                <Image src={coingold || "/placeholder.svg"} alt="coin" fill className="object-contain" />
              </div>
            </>
          )}
          {card.isSpinwheel && (
            <Image src={spinwheel || "/placeholder.svg"} alt="spin wheel" fill className="object-contain" />
          )}
          {card.isGoldcoins && (
            <>
              <Image src={coingold || "/placeholder.svg"} alt="gold coins" fill className="object-contain" />
              <div className="absolute bottom-0 left-0 w-16 h-12 z-10">
                <Image src={money || "/placeholder.svg"} alt="money" fill className="object-contain" />
              </div>
              <div className="absolute bottom-2 left-0 w-16 h-12 z-10">
                <Image src={money || "/placeholder.svg"} alt="money" fill className="object-contain" />
              </div>
              <div className="absolute bottom-2 left-20 w-16 h-12 z-10">
                <Image src={goldcoins || "/placeholder.svg"} alt="money" fill className="object-contain" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
