import Image from "next/image"
import { goldsafe, diamond, coin } from "@/assets/images/banner"

const milestones = [
  { day: 3, color: "from-green-400 to-green-600", iconBg: "bg-gradient-to-br from-green-400 to-green-500", completed: true },
  { day: 8, color: "from-yellow-400 to-yellow-600", iconBg: "bg-gradient-to-br from-yellow-400 to-yellow-500", completed: false },
  { day: 15, color: "from-cyan-300 to-cyan-500", iconBg: "bg-gradient-to-br from-cyan-300 to-cyan-400", completed: false },
  { day: 22, color: "from-pink-400 to-pink-600", iconBg: "bg-gradient-to-br from-pink-400 to-pink-500", completed: false },
  { day: 30, color: "from-purple-400 to-purple-600", iconBg: "bg-gradient-to-br from-purple-400 to-purple-500", completed: false },
]

export function VaultHeader() {
  return (
    <section className="relative">
      <h2 className="text-xl text-white mb-5">Rewards</h2>
      <div className="bg-[#1a1f26] rounded-xl p-4 md:p-6 relative overflow-visible">
        <div className="flex flex-row justify-between gap-4 md:gap-10 items-center md:items-start">
          <div className="w-full md:flex-1">
            <h3 className="text-white text-base md:text-lg font-medium mb-4 md:mb-6 text-center md:text-left">
              14 Day <span className="text-[#088EF9]">Rewards Vault</span>
            </h3>
        
            <div className="relative mt-12 md:mt-18 mb-4">
              <div className="h-4 md:h-6 bg-[#2a3441] rounded-full relative border-4 md:border-8 border-[#8292AA]">
                <div className="absolute left-0 top-0 h-full w-[30%] bg-linear-to-r from-green-500 to-green-400 rounded-full" />
              </div>

              <div
                className="absolute -top-3 md:-top-4 -translate-y-1/2 left-0 right-0 flex justify-between px-1 md:px-2"
                style={{ width: "100%" }}
              >
                {milestones.map((milestone, index) => (
                  <div
                    key={milestone.day}
                    className="flex flex-col items-center relative"
                  >
                    {/* Treasure Chest Icon */}
                    <div
                      className={`w-4 h-4 md:w-8 md:h-8 ${milestone.iconBg} rounded flex items-center justify-center -mt-2 md:-mt-3 shadow-lg relative`}
                    >
                      <svg viewBox="0 0 24 24" className="w-2 h-2 md:w-5 md:h-5 text-white" fill="currentColor">
                        <path d="M5 4h14a2 2 0 012 2v4a2 2 0 01-2 2h-1v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6H5a2 2 0 01-2-2V6a2 2 0 012-2zm7 8v4m-2-2h4" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="absolute top-3 md:top-5 -translate-y-1/2 left-0 right-0 flex justify-between px-1 md:px-2"
                style={{ width: "100%" }}
              >
                {milestones.map((milestone, index) => (
                  <div
                    key={milestone.day}
                    className="flex flex-col items-center relative"
                  >
                    <div
                      className={`w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center -mt-2 md:-mt-3 shadow-lg ${
                        milestone.completed
                          ? "bg-linear-to-br from-green-500 to-green-700"
                          : `bg-linear-to-br ${milestone.color}`
                      }`}
                    >
                      <span className="text-black text-[8px] md:text-[10px] font-bold">
                        {milestone.day}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Image positioned half in, half out */}
          <div className="relative shrink-0 w-20 h-20 md:w-40 md:h-40 -mt-8 md:mt-0">
            {/* Main Image */}
            <Image
              src={goldsafe}
              alt="Rewards Vault"
              fill
              className="object-contain"
            />

            {/* Diamond Top Right */}
            <div className="absolute w-10 h-10 md:w-12 md:h-12 right-3 -bottom-2 md:right-4 md:bottom-4">
              <Image
                src={diamond}
                alt="Diamond"
                fill
                className="object-contain"
              />
            </div>

            {/* Bottom Row Items */}
            <div className="absolute bottom-2 left-2 md:bottom-1 md:left-1 flex gap-2 md:gap-3">
              {/* Coin */}
              <div className="relative w-8 h-8 md:w-10 md:h-10">
                <Image
                  src={coin}
                  alt="Coin"
                  fill
                  className="object-contain"
                />
              </div>

              {/* Small Diamond */}
              <div className="relative w-6 h-6 md:w-8 md:h-8">
                <Image
                  src={diamond}
                  alt="Small Diamond"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}