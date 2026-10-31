export type RaffleCampaignType = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type RaffleCampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type RaffleDrawStatus = 'PENDING' | 'COMPLETED' | 'NO_ENTRIES';

export interface RafflePrize {
  position: string;
  name: string;
  type: string;
  value: number;
  delivery: string;
  /** Playthrough applied once the prize is credited. 0 = credited with no rollover. */
  wageringMultiplier?: number;
}

export interface RaffleDraw {
  id: string;
  weekNumber: number;
  year: number;
  status: RaffleDrawStatus;
  campaignId: string | null;
  winnerId: string | null;
  winnerTicketId: string | null;
  prize: string | null;
  totalTickets: number;
  drawnAt: string | null;
  createdAt: string;
}

export interface RaffleCampaign {
  id: string;
  title: string;
  description: string | null;
  type: RaffleCampaignType;
  status: RaffleCampaignStatus;
  bannerImageUrl: string | null;
  startDate: string | null;
  drawDate: string | null;
  wagering: boolean;
  wagerAmount: number | string;
  gamePlay: boolean;
  purchase: boolean;
  prizes: RafflePrize[];
  recurring: boolean;
  showOnHomepage: boolean;
  featured: boolean;
  progressiveTickets: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RaffleCampaignListItem extends RaffleCampaign {
  prizeCount: number;
  tickets: number;
  entrants: number;
  progress: number;
  actionState: 'VIEW_WINNERS' | 'IN_PROGRESS';
  draw: RaffleDraw | null;
}

export interface RaffleOverview {
  operationalCampaigns: number;
  concurrentCampaigns: number;
  cumulativeCampaigns: number;
  uniqueEntrantBase: number;
  networkTicketVolume: number;
  averageTicketsPerEntrant: number;
  totalDistributedValue: number;
}

export interface RaffleCampaignListResponse {
  items: RaffleCampaignListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  overview: RaffleOverview;
}

export interface RaffleParticipant {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  initial: string;
  tickets: number;
  lastEntry: string;
}

export interface RaffleParticipantsResponse {
  items: RaffleParticipant[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RaffleWinner {
  rank: number;
  drawId: string;
  drawnAt: string;
  prize: string;
  value: number | null;
  winnerTicketId: string | null;
  winnerTicketNumber?: string | null;
  winnerId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  initial: string;
}

export interface RaffleWinnersResponse {
  items: RaffleWinner[];
}

export interface AdminRaffleCampaignQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: RaffleCampaignStatus;
  type?: RaffleCampaignType;
}

export interface UpsertRaffleCampaignDto {
  title: string;
  description?: string;
  type?: RaffleCampaignType;
  status?: RaffleCampaignStatus;
  bannerImageUrl?: string;
  startDate?: string;
  drawDate?: string;
  wagering?: boolean;
  wagerAmount?: number;
  gamePlay?: boolean;
  purchase?: boolean;
  prizes?: RafflePrize[];
  recurring?: boolean;
  showOnHomepage?: boolean;
  featured?: boolean;
  progressiveTickets?: boolean;
}