export type RaceStatus = 'ACTIVE' | 'PAUSED' | 'ENDED' | 'COMPLETED';

// Matches backend RaceCurrency (values align with wallet currency strings).
export type RaceCurrency = 'wulfCash' | 'wulfCoin';

// One scoring basis per race (mutually exclusive).
export type RaceScoringType = 'VALID_BET' | 'WINNING_BET';

export interface RacePrizeTier {
  fromRank: number;
  toRank: number;
  rewardAmount: number;
  rewardCurrency: RaceCurrency;
}

export interface Race {
  id: string;
  name: string;
  description: string | null;
  banner: string | null;
  status: RaceStatus;
  startAt: string | null;
  endAt: string | null;
  entryFee: number | string;
  autoEnroll?: boolean;
  entryCurrency: RaceCurrency;
  maxParticipants: number | null;
  scoringType: RaceScoringType;
  rolloverMultiplier?: number | string;
  rolloverExpiryDays?: number | null;
  prizeStructure: RacePrizeTier[];
  totalParticipants: number;
  isSettling?: boolean;
  settledAt?: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RaceListResponse {
  items: Race[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminRaceQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: RaceStatus;
}

export interface RaceStats {
  raceId: string;
  name: string;
  status: RaceStatus;
  entryFee: number;
  entryCurrency: RaceCurrency;
  maxParticipants: number | null;
  participantCount: number;
  totalEntryCollected: number;
  totalPrizeDistributed: number;
  netRevenue: number;
}

export interface RaceParticipant {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  entrySpent: number;
  entryCurrency: RaceCurrency;
  score: number;
  finalRank: number | null;
  rewardAmount: number | null;
  rewardCurrency: RaceCurrency | null;
  rewardDistributed: boolean;
  joinedAt: string;
}

export interface RaceParticipantsResponse {
  items: RaceParticipant[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpsertRaceDto {
  name: string;
  description?: string;
  banner?: string;
  status?: RaceStatus;
  startAt?: string;
  endAt?: string;
  autoEnroll?: boolean;
  entryFee: number;
  entryCurrency: RaceCurrency;
  maxParticipants?: number;
  scoringType?: RaceScoringType;
  rolloverMultiplier?: number;
  rolloverExpiryDays?: number | null;
  prizeStructure?: RacePrizeTier[];
}
