"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, CircleDashed, Info, Trophy, UserX, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    step: "1",
    title: "Tickets are earned",
    body:
      "Every settled real-money bet adds to the player's wager progress for each active campaign. One ticket is issued per wager milestone reached (the campaign's Wager Amount). DAILY campaigns cap a player at one ticket per day.",
  },
  {
    step: "2",
    title: "The draw fires automatically",
    body:
      "A scheduler sweeps every minute. Once a campaign's Draw date passes, its draw runs on the next sweep — no manual action, no admin button. Editing a campaign to COMPLETED also triggers it immediately.",
  },
  {
    step: "3",
    title: "Winners are picked",
    body:
      "One winner per configured prize, drawn with a cryptographic RNG from that campaign's ticket pool. A player can win at most one prize per draw, so fewer entrants than prizes means the lower prizes go unawarded. The selection is logged with a full RNG audit trail.",
  },
  {
    step: "4",
    title: "Prizes are credited and announced",
    body:
      "Prize value is credited to each winner's wallet straight away (Wulf Cash or Wulf Coin, per the prize type) and recorded as a transaction. The winner gets an in-app notification and a live socket event; this table switches to VIEW WINNERS in the same moment.",
  },
];

const STATES = [
  {
    icon: <Trophy size={13} className="text-green-500" />,
    label: "VIEW WINNERS",
    tone: "border-green-500/30 bg-green-500/10 text-green-500",
    body: "The draw completed and prizes are credited. Click to see each winner, rank, ticket number and prize value.",
  },
  {
    icon: <CalendarClock size={13} className="text-blue-400" />,
    label: "SCHEDULED",
    tone: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    body: "The campaign's start date is still in the future. It is not collecting tickets yet, so there is nothing to draw.",
  },
  {
    icon: <UserX size={13} className="text-yellow-500" />,
    label: "NO ENTRIES",
    tone: "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
    body: "The draw ran but the campaign had no tickets, so nothing was awarded. A recurring campaign still rolls forward to its next period.",
  },
  {
    icon: <CircleDashed size={13} className="text-gray-400" />,
    label: "IN PROGRESS",
    tone: "border-[#2A2F3A]/50 bg-[#15181E] text-gray-400",
    body: "The campaign is running — it has started and is collecting tickets, but its draw date has not been reached, so winners are not decided. If this persists after the draw date has passed, the draw is failing — check the API logs for \"Failed to auto-run draw\".",
  },
];

export default function WinnerAnnouncementInfoModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-[760px] sm:max-w-[760px] max-h-[85vh] flex flex-col p-0 bg-[#1D222B] text-white border border-[#2A2F3A] hide-close-btn shadow-2xl [&>button]:hidden">

        {/* HEADER */}
        <div className="flex justify-between items-start p-4 sm:p-6 border-b border-[#2A2F3A]/50 bg-[#1D222B] rounded-t-lg">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-3 tracking-wide text-white">
              <Info className="text-[#C56CFF] w-6 h-6" /> How Winners Are Announced
            </DialogTitle>
            <p className="mt-1.5 text-sm text-gray-400">
              When a draw runs, how winners are chosen, and what each Winners badge means.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors mt-1">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 scrollbar-hide space-y-4 sm:space-y-6">

          {/* Lifecycle */}
          <div className="space-y-3">
            {STEPS.map((item) => (
              <div key={item.step} className="flex gap-4 rounded-xl border border-[#2A2F3A] bg-[#15181E]/50 p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#C56CFF]/30 bg-[#C56CFF]/10 text-sm font-bold text-[#C56CFF]">
                  {item.step}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Badge legend */}
          <div>
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Winners column states
            </h3>
            <div className="space-y-3">
              {STATES.map((state) => (
                <div key={state.label} className="flex gap-4 rounded-xl border border-[#2A2F3A] bg-[#15181E]/50 p-4">
                  <span
                    className={`inline-flex h-fit flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded border px-3 py-1.5 text-[10px] font-bold uppercase ${state.tone}`}
                  >
                    {state.icon} {state.label}
                  </span>
                  <p className="min-w-0 text-sm leading-relaxed text-gray-400">{state.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#C56CFF]/20 bg-[#C56CFF]/5 p-4 text-sm leading-relaxed text-gray-300">
            <span className="font-bold text-[#C56CFF]">Recurring campaigns:</span>{" "}
            once a draw resolves, the campaign is marked COMPLETED and the next period is created
            automatically with the same prizes and rules. That is why a DAILY campaign appears as a
            stack of completed rows plus one active row.
          </div>
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
