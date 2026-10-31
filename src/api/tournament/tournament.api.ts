import apiClient from "../config/axios.config";
import {
  Tournament,
  TournamentWinner,
  CreateTournamentDto,
  UpdateTournamentDto,
} from "@/types/tournament";

/**
 * Get all tournaments (Backend calls them Leaderboard Campaigns)
 */
export const getAllTournaments = async (): Promise<Tournament[]> => {
  const response = await apiClient.get<Tournament[]>(`/admin/leaderboard`);
  return response.data;
};

/**
 * Get tournament by ID
 */
export const getTournamentById = async (id: string): Promise<Tournament> => {
  const response = await apiClient.get<Tournament>(`/admin/leaderboard/${id}`);
  return response.data;
};

/**
 * Create a new tournament
 */
export const createTournament = async (data: any): Promise<Tournament> => {
  const response = await apiClient.post<Tournament>(`/admin/leaderboard`, data);
  return response.data;
};

/**
 * Update an existing tournament
 */
export const updateTournament = async (
  id: string,
  data: UpdateTournamentDto
): Promise<Tournament> => {
  const response = await apiClient.patch<Tournament>(`/admin/leaderboard/${id}`, data);
  return response.data;
};

/**
 * Delete a tournament
 */
export const deleteTournament = async (id: string): Promise<void> => {
  await apiClient.delete(`/admin/leaderboard/${id}`);
};

/**
 * Get winners for a specific tournament
 */
export const getTournamentWinners = async (id: string): Promise<TournamentWinner[]> => {
  const response = await apiClient.get<TournamentWinner[]>(`/admin/leaderboard/${id}/winners`);
  return response.data;
};

/**
 * Manually trigger settlement for a tournament
 */
export const settleTournament = async (id: string): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>(`/admin/leaderboard/${id}/settle-now`);
  return response.data;
};
