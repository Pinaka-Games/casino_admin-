import apiClient from '../config/axios.config';
import {
  AdminRaceQuery,
  Race,
  RaceListResponse,
  RaceParticipantsResponse,
  RaceStats,
  UpsertRaceDto,
} from '@/types/race';

export const getAdminRaces = async (
  query: AdminRaceQuery,
): Promise<RaceListResponse> => {
  const response = await apiClient.get<RaceListResponse>('/races', {
    params: query,
  });
  return response.data;
};

export const getRaceDetails = async (id: string): Promise<Race> => {
  const response = await apiClient.get<Race>(`/races/${id}`);
  return response.data;
};

export const createRace = async (data: UpsertRaceDto): Promise<Race> => {
  const response = await apiClient.post<Race>('/races', data);
  return response.data;
};

export const updateRace = async (
  id: string,
  data: UpsertRaceDto,
): Promise<Race> => {
  const response = await apiClient.patch<Race>(`/races/${id}`, data);
  return response.data;
};

export const pauseRace = async (id: string): Promise<Race> => {
  const response = await apiClient.patch<Race>(`/races/${id}/pause`);
  return response.data;
};

export const resumeRace = async (id: string): Promise<Race> => {
  const response = await apiClient.patch<Race>(`/races/${id}/resume`);
  return response.data;
};

export const settleRace = async (
  id: string,
): Promise<{ raceId: string; status: string }> => {
  const response = await apiClient.post<{ raceId: string; status: string }>(
    `/races/${id}/settle`,
  );
  return response.data;
};

export const archiveRace = async (
  id: string,
): Promise<{ id: string; archived: boolean }> => {
  const response = await apiClient.patch<{ id: string; archived: boolean }>(
    `/races/${id}/archive`,
  );
  return response.data;
};

export const restoreRace = async (
  id: string,
): Promise<{ id: string; archived: boolean }> => {
  const response = await apiClient.patch<{ id: string; archived: boolean }>(
    `/races/${id}/restore`,
  );
  return response.data;
};

export const deleteRace = async (
  id: string,
): Promise<{ id: string; deleted: boolean }> => {
  const response = await apiClient.delete<{ id: string; deleted: boolean }>(
    `/races/${id}`,
  );
  return response.data;
};

export const getRaceStats = async (id: string): Promise<RaceStats> => {
  const response = await apiClient.get<RaceStats>(`/races/${id}/stats`);
  return response.data;
};

export const getRaceParticipants = async (
  id: string,
  page = 1,
  limit = 10,
  search = '',
): Promise<RaceParticipantsResponse> => {
  const response = await apiClient.get<RaceParticipantsResponse>(
    `/races/${id}/participants`,
    { params: { page, limit, search: search || undefined } },
  );
  return response.data;
};
