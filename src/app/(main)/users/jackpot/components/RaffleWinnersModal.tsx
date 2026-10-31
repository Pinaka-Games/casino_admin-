"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trophy, X, Mail, Phone } from "lucide-react";
import { RaffleCampaign, RaffleWinner } from "@/types/raffle";

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: RaffleCampaign | null;
  winners: RaffleWinner[];
  isLoading?: boolean;
}

export default function RaffleWinnersModal({ open, onClose, campaign, winners, isLoading = false }: Props) {
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));

  const formatPrizeLabel = (winner: RaffleWinner): string => {
    const rank = winner.prize || `#${winner.rank}`;
    if (typeof winner.value === "number" && winner.value > 0) {
      const formatted = `$${winner.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return `${rank}  ·  ${formatted}`;
    }
    return rank;
  };

  const getPrimaryContact = (winner: RaffleWinner) => {
    if (winner.email) {
      return {
        label: "Email",
        value: winner.email,
        icon: Mail,
      };
    }

    if (winner.phone) {
      return {
        label: "Phone",
        value: winner.phone,
        icon: Phone,
      };
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="!w-[96vw] md:!w-[920px] lg:!w-[980px] !max-w-none max-h-[90vh] p-0 bg-[#1D222B] text-white border border-[#2A2F3A] hide-close-btn shadow-2xl overflow-hidden flex flex-col [&>button]:hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-start p-6 border-b border-[#2A2F3A]/50 bg-[#1D222B] rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-3 tracking-wide text-white uppercase">
              <Trophy className="text-yellow-500 w-6 h-6" /> Jackpot Winners
            </h2>
            <p className="text-sm text-gray-400 mt-1">{campaign?.title || "Test $1 Prize"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-gray-400">Loading winners...</div>
          ) : winners.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No winners have been drawn for this campaign yet.</div>
          ) : (
            <div className="space-y-4">
              {winners.map((winner) => (
                <div key={`${winner.drawId}-${winner.rank}`} className="border border-[#2A2F3A] rounded-xl overflow-hidden bg-[#15181E] flex flex-col md:flex-row shadow-sm border-l-[6px] border-l-[#C56CFF]">
                  <div className="p-3 border-b md:border-b-0 md:border-r border-[#2A2F3A]/50 flex flex-col items-center justify-center md:min-w-[118px] lg:min-w-[128px] bg-[#1D222B]/30">
                    <div className="flex flex-col items-center justify-center space-y-2 p-2 bg-[#242B35]/50 border border-[#2A2F3A] rounded-lg w-full h-full">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rank</span>
                      <span className="text-3xl font-extrabold text-yellow-500">#{winner.rank}</span>

                      <div className="bg-[#15181E] border border-[#2A2F3A] p-2 rounded text-center w-full shadow-inner mt-1">
                        <span className="block text-[10px] uppercase font-bold text-[#C56CFF] tracking-wider mb-1">Ticket No.</span>
                        <span className="block text-xs font-bold text-white tracking-widest leading-none break-all">
                          {winner.winnerTicketNumber || winner.winnerTicketId || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col gap-5 w-full">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-[#242B35] border border-[#2A2F3A]/80 flex items-center justify-center text-xl font-extrabold text-white shadow-inner">
                        {winner.initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white text-lg">{winner.name}</h3>
                          <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold uppercase rounded">Winner</span>
                        </div>
                        <span className="text-green-400 text-sm font-semibold">{formatPrizeLabel(winner)}</span>
                      </div>
                    </div>

                    {(() => {
                      const contact = getPrimaryContact(winner);

                      if (!contact) {
                        return (
                          <div className="bg-[#1D222B] border border-[#2A2F3A]/80 p-3 rounded-lg">
                            <span className="text-xs font-semibold text-gray-400">No email or phone available for this user.</span>
                          </div>
                        );
                      }

                      const ContactIcon = contact.icon;

                      return (
                        <div className="bg-[#1D222B] border border-[#2A2F3A]/80 p-3 rounded-lg flex items-center gap-3">
                          <div className="bg-[#15181E] p-2 rounded-md">
                            <ContactIcon className="w-4 h-4 text-[#C56CFF]" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{contact.label}</span>
                            <span className="text-xs font-semibold text-gray-200 mt-0.5 truncate" title={contact.value}>
                              {contact.value}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between pt-1">
                      <div className="px-4 py-2 border border-[#2A2F3A] bg-[#242B35]/40 rounded-lg">
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Status: <span className="text-gray-100">Completed</span></span>
                      </div>

                      <div className="text-right">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Date Drawn</span>
                        <span className="block text-xs font-bold text-gray-100">{formatDate(winner.drawnAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <p className="mt-2 text-center text-sm font-medium text-gray-400 italic">
                Use the verified contact details shown above to coordinate prize delivery.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
