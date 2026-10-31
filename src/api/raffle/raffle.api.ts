import apiClient from '../config/axios.config';
import {
  AdminRaffleCampaignQuery,
  RaffleCampaign,
  RaffleCampaignListResponse,
  RaffleParticipantsResponse,
  RaffleWinnersResponse,
  UpsertRaffleCampaignDto,
} from '@/types/raffle';

export const getAdminRaffleCampaigns = async (
  query: AdminRaffleCampaignQuery,
): Promise<RaffleCampaignListResponse> => {
  const response = await apiClient.get<RaffleCampaignListResponse>('/raffle/campaigns', {
    params: query,
  });
  return response.data;
};

export const createRaffleCampaign = async (
  data: UpsertRaffleCampaignDto,
): Promise<RaffleCampaign> => {
  const response = await apiClient.post<RaffleCampaign>('/raffle/campaigns', data);
  return response.data;
};

export const updateRaffleCampaign = async (
  id: string,
  data: UpsertRaffleCampaignDto,
): Promise<RaffleCampaign> => {
  const response = await apiClient.patch<RaffleCampaign>(`/raffle/campaigns/${id}`, data);
  return response.data;
};

export const deleteRaffleCampaign = async (id: string): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/raffle/campaigns/${id}`);
  return response.data;
};

export const getRaffleCampaignParticipants = async (
  id: string,
  page = 1,
  limit = 10,
): Promise<RaffleParticipantsResponse> => {
  const response = await apiClient.get<RaffleParticipantsResponse>(`/raffle/campaigns/${id}/participants`, {
    params: { page, limit },
  });
  return response.data;
};

export const getRaffleCampaignWinners = async (
  id: string,
): Promise<RaffleWinnersResponse> => {
  const response = await apiClient.get<RaffleWinnersResponse>(`/raffle/campaigns/${id}/winners`);
  return response.data;
};