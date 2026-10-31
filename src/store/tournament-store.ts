import { create } from "zustand";
import * as TournamentAPI from "@/api/tournament/tournament.api";
import {
  Tournament,
  TournamentWinner,
  CreateTournamentDto,
  UpdateTournamentDto,
} from "@/types/tournament";

interface TournamentState {
  tournaments: Tournament[];
  winners: TournamentWinner[];
  isLoading: boolean;
  error: string | null;
}

interface TournamentActions {
  fetchTournaments: () => Promise<void>;
  createTournament: (data: any) => Promise<void>;
  updateTournament: (id: string, data: UpdateTournamentDto) => Promise<void>;
  deleteTournament: (id: string) => Promise<void>;
  fetchWinners: (id: string) => Promise<void>;
  settleTournament: (id: string) => Promise<void>;
}

type TournamentStore = TournamentState & TournamentActions;

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  tournaments: [],
  winners: [],
  isLoading: false,
  error: null,

  fetchTournaments: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await TournamentAPI.getAllTournaments();
      set({ tournaments: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createTournament: async (data) => {
    set({ isLoading: true });
    try {
      await TournamentAPI.createTournament(data);
      await get().fetchTournaments();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateTournament: async (id, data) => {
    set({ isLoading: true });
    try {
      await TournamentAPI.updateTournament(id, data);
      await get().fetchTournaments();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  deleteTournament: async (id) => {
    set({ isLoading: true });
    try {
      await TournamentAPI.deleteTournament(id);
      await get().fetchTournaments();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  fetchWinners: async (id) => {
    set({ isLoading: true, winners: [] });
    try {
      const data = await TournamentAPI.getTournamentWinners(id);
      set({ winners: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  settleTournament: async (id) => {
    set({ isLoading: true });
    try {
      await TournamentAPI.settleTournament(id);
      await get().fetchTournaments();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },
}));
