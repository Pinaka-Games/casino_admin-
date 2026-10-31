"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Trophy, X } from "lucide-react";
import { RaffleCampaign } from "@/types/raffle";

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: RaffleCampaign | null;
}

export default function PrizeBreakdownModal({ open, onClose, campaign }: Props) {
  const prizes = campaign?.prizes ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-[900px] sm:max-w-[900px] max-h-[85vh] flex flex-col p-0 bg-[#1D222B] text-white border border-[#2A2F3A] hide-close-btn shadow-2xl [&>button]:hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-start p-4 sm:p-6 border-b border-[#2A2F3A]/50 bg-[#1D222B] rounded-t-lg">
          <DialogTitle className="text-xl font-bold flex items-center gap-3 tracking-wide text-white">
            <Trophy className="text-yellow-500 w-6 h-6" /> Prize Breakdown
          </DialogTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors mt-1">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 scrollbar-hide">
          {prizes.length === 0 ? (
            <div className="border border-[#2A2F3A] rounded-xl bg-[#15181E]/50 p-8 text-center text-sm text-gray-400">
              No prize breakdown has been configured for this campaign.
            </div>
          ) : (
            <div className="space-y-4">
              {prizes.map((prize) => (
                <div key={`${prize.position}-${prize.name}`} className="border border-[#2A2F3A] rounded-xl overflow-hidden bg-[#15181E]/50 group">
                  <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
                    <div className="flex min-w-0 items-start gap-3 sm:gap-5">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-[#242B35] border border-[#2A2F3A]/80 flex flex-col items-center justify-center flex-shrink-0 shadow-inner group-hover:border-[#C56CFF]/40 transition-colors">
                        <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">POS</span>
                        <span className="text-base sm:text-xl font-bold text-white">{prize.position}</span>
                      </div>

                      <div className="flex min-w-0 flex-col gap-1 sm:gap-1.5 sm:pt-1">
                        <h3 className="truncate text-base font-bold text-white">{prize.name}</h3>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-400">Type:</span>
                          <span className="text-[#C56CFF] font-medium">{prize.type}</span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">Method: {prize.delivery}</div>
                      </div>
                    </div>

                    <div className="flex flex-row items-center justify-between gap-3 border-t border-[#2A2F3A]/60 pt-3 sm:flex-col sm:items-end sm:justify-center sm:gap-1.5 sm:border-0 sm:pt-0 sm:h-full sm:text-right">
                      <span className="text-base font-bold text-white">1x</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Val:</span>
                        <div className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        </div>
                        <span className="text-sm font-bold text-white">{Number(prize.value || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 py-4 sm:px-6 sm:py-5 border-t border-[#2A2F3A]/50 bg-[#1D222B] rounded-b-lg flex justify-end">
          <button 
            onClick={onClose}
            className="bg-[#C56CFF] hover:bg-[#C56CFF]/80 text-white font-bold py-2.5 px-8 rounded-lg shadow-md transition-colors"
          >
            Close
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
