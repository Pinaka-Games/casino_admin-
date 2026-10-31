"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useTournamentStore } from "@/store/tournament-store";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { TournamentTable } from "./components/TournamentTable";
import { TournamentModal } from "./components/TournamentModal";
import { TournamentWinnerListModal } from "./components/TournamentWinnerListModal";

export default function TournamentPage() {
  const { 
    tournaments, 
    winners, 
    isLoading, 
    fetchTournaments, 
    createTournament, 
    updateTournament, 
    fetchWinners,
    settleTournament 
  } = useTournamentStore();

  const [modalOpen, setModalOpen] = React.useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Tournament | null>(null);
  const [prefill, setPrefill] = React.useState<Partial<Tournament> | null>(null);

  React.useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handleSubmit = async (data: any) => {
    try {
      if (selected) {
        await updateTournament(selected.id, data);
        toast.success("Tournament updated successfully");
      } else {
        await createTournament(data);
        toast.success("Tournament created successfully");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    }
  };


  const handleSettle = async (t: Tournament) => {
    try {
      await settleTournament(t.id);
      toast.success("Settlement triggered successfully");
    } catch (err: any) {
      toast.error(err.message || "Settlement trigger failed");
    }
  };

  const handleViewWinners = (t: Tournament) => {
    setSelected(t);
    fetchWinners(t.id);
    setWinnerModalOpen(true);
  };


  if (isLoading && tournaments.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <TournamentTable
        data={tournaments}
        onCreate={() => {
          setSelected(null);
          setPrefill(null);
          setModalOpen(true);
        }}
        onEdit={(t) => {
          setSelected(t);
          setPrefill(null);
          setModalOpen(true);
        }}
        onDuplicate={(t) => {
          // Open create form pre-filled from this tournament. Copy title
          // (marked) + banner + prizes; admin sets a new event id + window.
          setSelected(null);
          setPrefill({
            title: `${t.title} (Copy)`,
            bannerUrl: t.bannerUrl,
            prizes: t.prizes,
          });
          setModalOpen(true);
        }}
        onViewWinners={handleViewWinners}
        onSettle={handleSettle}
        onUpdateStatus={async (t, status) => {
          try {
            await updateTournament(t.id, { status });
            toast.success(`Tournament status updated to ${status.replace('_', ' ')}`);
          } catch (err: any) {
            toast.error("Failed to update status");
          }
        }}
      />

      <TournamentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tournament={selected}
        prefill={prefill}
        onSubmit={handleSubmit}
      />

      <TournamentWinnerListModal
        open={winnerModalOpen}
        onOpenChange={setWinnerModalOpen}
        tournament={selected}
        winners={winners}
        isLoading={isLoading}
      />
    </div>
  );
}
