export enum TournamentStatus {
  UPCOMING = 'UPCOMING',
  IN_PROGRESS = 'IN_PROGRESS',
  STOPPED = 'STOPPED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Prize {
  rankStart: number;
  rankEnd: number;
  amount: number;
  currency: 'WulfCash' | 'WulfCoin';
}

export interface Tournament {
  id: string;
  title: string;
  externalEventId: string;
  provider: string;
  bannerUrl?: string;
  startTime: string;
  endTime: string;
  status: TournamentStatus;
  prizes: Prize[];
  rolloverMultiplier?: number | string;
  rolloverExpiryDays?: number | null;
  isPaid: boolean;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTournamentDto {
  title: string;
  externalEventId: string;
  provider: string;
  bannerUrl?: string;
  startTime: string;
  endTime: string;
  prizes: Prize[];
  rolloverMultiplier?: number;
  rolloverExpiryDays?: number | null;
}

export interface UpdateTournamentDto extends Partial<CreateTournamentDto> {
  status?: TournamentStatus;
}

export interface TournamentWinner {
  id: string;
  campaignId: string;
  userId: string;
  username: string;
  rank: number;
  score: number;
  prizeAmount: number;
  prizeCurrency: string;
  isPaid: boolean;
  paidAt?: string;
}
