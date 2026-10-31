"use client";

import Image from "next/image";
import { Trophy as TrophyIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { coingreen, coingold } from "@/assets/icons";
import { Badge1, Badge2, Badge3 } from "@/assets/images/weeklytournament";
import { Race, RaceCurrency } from "@/types/race";

interface Props {
  open: boolean;
  onClose: () => void;
  race: Race | null;
}

const CURRENCY_LABEL: Record<RaceCurrency, string> = {
  wulfCash: "Wulf Cash",
  wulfCoin: "Wulf Coin",
};

export default function RacePrizesModal({ open, onClose, race }: Props) {
  const tiers = [...(race?.prizeStructure ?? [])].sort((a, b) => a.fromRank - b.fromRank);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[520px] p-0 bg-[#1A1E26] text-white border border-[#2A2F3A] shadow-2xl [&>button]:hidden overflow-hidden rounded-xl">
        {/* HEADER */}
        <div className="p-5">
          <DialogTitle className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <TrophyIcon size={18} className="text-[#FFB800]" />
            Prize Distribution
          </DialogTitle>
          {race?.name && (
            <p className="mt-1 text-xs text-gray-400 truncate">{race.name}</p>
          )}
        </div>

        <div className="border-t border-[#2A2F3A]/80 w-full" />

        {/* BODY */}
        <div className="p-5">
          <div className="bg-[#14171E] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
            <div className="grid grid-cols-2 text-gray-500 text-[9px] uppercase font-black tracking-widest bg-[#0F1115]">
              <div className="px-6 py-3 border-r border-gray-800 text-center">Ranking</div>
              <div className="px-6 py-3 text-center">Reward</div>
            </div>

            <div className="divide-y divide-gray-800/50 max-h-[55vh] overflow-y-auto">
              {tiers.length ? (
                tiers.map((tier, i) => {
                  const isSingle = tier.fromRank === tier.toRank;
                  const badge =
                    isSingle && tier.fromRank === 1
                      ? Badge1
                      : isSingle && tier.fromRank === 2
                        ? Badge2
                        : isSingle && tier.fromRank === 3
                          ? Badge3
                          : null;

                  return (
                    <div
                      key={i}
                      className="grid grid-cols-2 hover:bg-white/5 transition-colors border-t border-gray-800/30"
                    >
                      <div className="px-6 py-2 flex items-center justify-center border-r border-gray-800/50 text-white font-bold text-sm gap-3">
                        {badge && (
                          <Image src={badge} alt={`Rank ${tier.fromRank}`} width={24} height={28} />
                        )}
                        {tier.fromRank}
                        {!isSingle ? ` - ${tier.toRank}` : ""}
                      </div>
                      <div className="px-6 py-3 flex items-center justify-center gap-2">
                        <span className="text-[#FFB800] font-black text-lg drop-shadow-[0_0_8px_rgba(255,184,0,0.3)]">
                          {Number(tier.rewardAmount).toLocaleString()}
                        </span>
                        <Image
                          src={tier.rewardCurrency === "wulfCoin" ? coingold : coingreen}
                          alt={CURRENCY_LABEL[tier.rewardCurrency]}
                          title={CURRENCY_LABEL[tier.rewardCurrency]}
                          width={20}
                          height={20}
                          className="flex-shrink-0 drop-shadow-sm"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-gray-600 italic text-xs">
                  No prize distribution configured.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 flex justify-end border-t border-[#2A2F3A]/80 bg-[#1A1E26] rounded-b-xl">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded bg-[#2A2F3A]/40 hover:bg-[#2A2F3A] text-gray-200 text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
