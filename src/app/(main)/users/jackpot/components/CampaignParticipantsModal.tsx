"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { User, X, Mail, Ticket } from "lucide-react";
import { RaffleCampaign, RaffleParticipant } from "@/types/raffle";

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: RaffleCampaign | null;
  participants: RaffleParticipant[];
  page: number;
  totalPages: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

export default function CampaignParticipantsModal({
  open,
  onClose,
  campaign,
  participants,
  page,
  totalPages,
  isLoading = false,
  onPageChange,
}: Props) {
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="!w-[96vw] md:!w-[980px] lg:!w-[1100px] !max-w-none max-h-[90vh] p-0 bg-[#1D222B] text-white border border-[#2A2F3A] hide-close-btn shadow-2xl overflow-hidden flex flex-col [&>button]:hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-start p-4 sm:p-6 border-b border-[#2A2F3A]/50 bg-[#1D222B] rounded-t-lg">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-3 tracking-wide text-white">
              <User className="text-[#C56CFF] w-6 h-6" /> CAMPAIGN PARTICIPANTS
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-1">{campaign?.title || "Test $1 Prize"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="border border-[#2A2F3A] rounded-xl overflow-hidden">
            
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 items-center px-6 py-4 border-b border-[#2A2F3A] bg-[#15181E]/50">
              <div className="col-span-6 text-[10px] uppercase font-bold text-gray-400 tracking-wider">User Details</div>
              <div className="col-span-3 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center">Ticket Count</div>
              <div className="col-span-3 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Last Entry</div>
            </div>

            {/* Table Rows */}
            <div className="p-4 space-y-4 bg-[#15181E]">
              {isLoading ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">Loading participants...</div>
              ) : participants.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">No participants found for this campaign.</div>
              ) : (
                participants.map((participant) => (
                  <div key={participant.userId} className="flex flex-col gap-3 sm:grid sm:grid-cols-12 sm:items-center px-3 py-3 sm:px-5 sm:py-4 bg-[#1D222B]/60 border border-[#2A2F3A] rounded-xl hover:bg-[#1A1F28] transition-colors">
                    <div className="sm:col-span-6 flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[#242B35] border border-[#2A2F3A]/80 flex items-center justify-center text-lg font-bold text-white shadow-inner">
                        {participant.initial}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-white text-base leading-tight">{participant.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1 text-gray-400">
                          <Mail className="w-3.5 h-3.5 text-[#C56CFF]" />
                          <span className="text-xs">{participant.email || "No email on file"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-3 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-2 h-full">
                      <div className="bg-[#242B35] border border-[#2A2F3A]/80 rounded-md px-4 py-1.5 flex items-center gap-2">
                        <Ticket size={14} className="text-[#C56CFF]" />
                        <span className="font-bold text-white text-sm">{participant.tickets}</span>
                      </div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-2">Tickets Held</span>
                    </div>

                    <div className="sm:col-span-3 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 h-full">
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Last Ticket Generated</span>
                      <span className="font-bold text-white text-sm">{formatDate(participant.lastEntry)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Pagination Simulated */}
            <div className="px-6 py-4 bg-[#15181E]/50 border-t border-[#2A2F3A] flex justify-center items-center gap-3">
              <div className="flex items-center gap-3 text-xs text-gray-400 font-medium tracking-wide">
                <span
                  className={`px-1 ${page <= 1 ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:text-white"}`}
                  onClick={() => page > 1 && onPageChange(page - 1)}
                >
                  &lt;
                </span>
                <span className="w-7 h-7 flex items-center justify-center bg-white text-black rounded-full font-bold shadow-sm">{page}</span>
                <span
                  className={`px-1 ${page >= totalPages ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:text-white"}`}
                  onClick={() => page < totalPages && onPageChange(page + 1)}
                >
                  &gt;
                </span>

                <span className="ml-3 text-gray-300">of {Math.max(totalPages, 1)}</span>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
