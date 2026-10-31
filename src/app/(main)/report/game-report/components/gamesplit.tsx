'use client'

import Image from 'next/image'
import { X } from 'lucide-react'

interface GameSlipDetail {
  username: string
  userId: number
  slipId: string
  dateTime: string
  provider: string
  gameName: string
  gameImage: string
  buyIn: number
  payout: number
  profit: number
}

interface Props {
  open: boolean
  onClose: () => void
  data: GameSlipDetail
}

export default function GameSlipDetailModal({ open, onClose, data }: Props) {
  if (!open) return null

  const gameImageSrc = typeof data.gameImage === 'string' && data.gameImage.trim() !== ''
    ? data.gameImage
    : "/sugar-rush.png"

  return (
    <div className="fixed inset-0 z-50 bg-black/70">
      <div className="flex h-screen w-screen flex-col bg-[#0f141b] text-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232b36] px-6 py-4">
          <h2 className="text-lg font-semibold">
            Game Slip Detail
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1.2fr_2.6fr_1fr_1fr] bg-[#1b222c] px-6 py-3 text-sm font-semibold text-gray-300">
          <div>Username</div>
          <div className="text-center">Game Slip Detail</div>
          <div className="text-center">Payout</div>
          <div className="text-right">Profit</div>
        </div>

        {/* Row */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1.2fr_2.6fr_1fr_1fr] px-6 py-10 text-sm bg-[#0f141b]">

            {/* Username */}
            <div className="flex items-center">
              <div>
                <p className="font-medium text-gray-200">
                  {data.username}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  (ID: {data.userId})
                </p>
              </div>
            </div>

            {/* Game Slip Detail */}
            <div className="flex flex-col items-center text-center gap-1">
              <p className="text-gray-300 text-sm">
                <span className="font-semibold">ID:</span> {data?.slipId}
              </p>
              <p className="text-xs text-gray-400">
                {data?.dateTime}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {data?.provider}
              </p>

              <div className="flex items-center gap-4">
                <span className="font-semibold text-base">
                  {data?.gameName}
                </span>
                {/* <Image
                  src={gameImageSrc}
                  alt={data?.gameName}
                  width={52}
                  height={52}
                  className="rounded-md object-contain bg-[#1b222c]"
                /> */}
              </div>

              <p className="mt-4 text-gray-300">
                Buy-in Amount:{' '}
                <span className="font-semibold">
                  {data.buyIn}
                </span>
              </p>
            </div>

            {/* Payout */}
            <div className="flex items-center justify-center font-semibold text-gray-200">
              {data.payout.toFixed(2)}
            </div>

            {/* Profit */}
            <div
              className={`flex items-center justify-end font-semibold ${data.profit < 0 ? 'text-red-500' : 'text-green-500'
                }`}
            >
              {data.profit.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
