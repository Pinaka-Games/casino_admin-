import api from "../config/axios.config";

// NOTE: the admin axios baseURL already includes `/admin`, so paths here are
// relative to it (backend controller is @Controller('admin/jackpot')).

export interface GameJackpotConfig {
  id: string;
  gameId: string;
  gameName: string;
  provider: string;
  enabled: boolean;
  seedAmount: number | string;
  currentAmount: number | string;
  contributionRate: number | string;
  winChance: number | string;
  mustHitCap: number | string | null;
  minBetToQualify: number | string;
  currency: string;
  /** Playthrough on a win. 1 = paid free and clear. No effect on wulfCoin. */
  wageringMultiplier: number | string;
  /** Fixed winner prize on a drop, regardless of the pot. Null = full pot. */
  fixedWinAmount: number | string | null;
  winnerPercent: number | string | null;
  totalContributed: number | string;
  totalWon: number | string;
  winCount: number;
  lastWonAt: string | null;
  lastWonAmount: number | string | null;
  drawAt: string | null;
  /** Participation-window start of a scheduled round; null = always open. */
  roundStartAt: string | null;
  /** Entry cutoff of a scheduled round; null = entry closes at drawAt. */
  participationEndAt: string | null;
}

export interface UpsertJackpotPayload {
  gameId: string;
  enabled?: boolean;
  seedAmount?: number;
  contributionRate?: number;
  winChance?: number;
  mustHitCap?: number | null;
  minBetToQualify?: number;
  currency?: string;
  wageringMultiplier?: number;
  /** Fixed winner prize on a drop; null = winner takes the full pot. */
  fixedWinAmount?: number | null;
  winnerPercent?: number | null;
  /** ISO timestamp for scheduled forced draw; null clears it. */
  drawAt?: string | null;
  /** ISO timestamp opening the participation window; must precede drawAt. Null clears. */
  roundStartAt?: string | null;
  /** ISO timestamp closing entry; after roundStartAt, not after drawAt. Null = closes at drawAt. */
  participationEndAt?: string | null;
}

export interface JackpotWin {
  id: string;
  wonAt: string;
  userId: string;
  amount: number | string;
  currency: string;
  gameName: string;
  /** Null on progressive tier wins — a tier spans every game, so it has no one provider. */
  provider: string | null;
  /** Set on progressive tier wins ("grand" / "major" / ...); null for per-game wins. */
  tier: string | null;
  username: string | null;
  userName: string | null;
}

export interface JackpotWinsPage {
  items: JackpotWin[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JackpotParticipantRow {
  userId: string;
  name: string;
  email: string | null;
  betCount: number;
  /** Total this user's bets added to the pot this round. */
  contributed: number;
  /** Pot value just before this user's latest qualifying bet. */
  lastPotBefore: number | null;
  /** Pot value right after this user's latest qualifying bet. */
  lastPotAfter: number | null;
  lastBetAt: string;
}

export interface JackpotPotSummary {
  label: string;
  currentAmount: number;
  seedAmount: number;
  dropTarget: number | null;
  currency: string;
}

export interface JackpotLastWin {
  userId: string;
  name: string;
  amount: number | null;
  currency: string;
  wonAt: string | null;
}

export interface JackpotRoundParticipantRow {
  userId: string;
  name: string;
  email: string | null;
  betCount: number;
  contributed: number;
  lastBetAt: string | null;
  isWinner: boolean;
}

export interface JackpotLastRound {
  round: {
    endedAt: string;
    drawType: "drop" | "scheduled";
    potAmount: number;
    payout: number;
    currency: string;
    winnerUserId: string | null;
    winnerName: string | null;
    /** Winner's email when the account has one on file. */
    winnerEmail: string | null;
  } | null;
  participants: JackpotRoundParticipantRow[];
}

export interface JackpotParticipantsPage {
  /** Live pot the round's bets built up; null if the jackpot id is unknown. */
  pot: JackpotPotSummary | null;
  /** Winner of the previous round; null if this pot has never been won. */
  lastWin: JackpotLastWin | null;
  items: JackpotParticipantRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- Global progressive tiers (Grand/Major/Minor/Mini) -------------------

export interface JackpotTierConfig {
  id: string;
  tier: "grand" | "major" | "minor" | "mini";
  rank: number;
  label: string;
  enabled: boolean;
  currency: string;
  seedAmount: number | string;
  currentAmount: number | string;
  shareRate: number | string;
  /** 'percent' = bet x shareRate; 'fixed' = shareAmount per bet. */
  shareType: "percent" | "fixed";
  shareAmount: number | string;
  dropTarget: number | string;
  minBetToQualify: number | string;
  /** Playthrough on a win. 1 = paid free and clear. No effect on wulfCoin. */
  wageringMultiplier: number | string;
  /** Fixed winner prize on a drop, regardless of the pot. Null = full pot. */
  fixedWinAmount: number | string | null;
  winnerPercent: number | string | null;
  totalContributed: number | string;
  totalWon: number | string;
  winCount: number;
  lastWonAt: string | null;
  lastWonAmount: number | string | null;
  drawAt: string | null;
  /** Participation-window start of a scheduled round; null = always open. */
  roundStartAt: string | null;
  /** Entry cutoff of a scheduled round; null = entry closes at drawAt. */
  participationEndAt: string | null;
}

export interface UpdateJackpotTierPayload {
  tier: "grand" | "major" | "minor" | "mini";
  enabled?: boolean;
  label?: string;
  seedAmount?: number;
  currentAmount?: number;
  shareRate?: number;
  shareType?: "percent" | "fixed";
  shareAmount?: number;
  dropTarget?: number;
  minBetToQualify?: number;
  currency?: string;
  wageringMultiplier?: number;
  /** Fixed winner prize on a drop; null = winner takes the full pot. */
  fixedWinAmount?: number | null;
  winnerPercent?: number | null;
  /** ISO timestamp for scheduled draw; null clears it. */
  drawAt?: string | null;
  /** ISO timestamp opening the participation window; must precede drawAt. Null clears. */
  roundStartAt?: string | null;
  /** ISO timestamp closing entry; after roundStartAt, not after drawAt. Null = closes at drawAt. */
  participationEndAt?: string | null;
}

export const jackpotAdminApi = {
  list: async (): Promise<GameJackpotConfig[]> => {
    const res = await api.get<GameJackpotConfig[]>("/jackpot");
    return res.data;
  },

  // ---- Tiers ----
  listTiers: async (): Promise<JackpotTierConfig[]> => {
    const res = await api.get<JackpotTierConfig[]>("/jackpot/tiers");
    return res.data;
  },

  updateTier: async (
    payload: UpdateJackpotTierPayload
  ): Promise<JackpotTierConfig> => {
    const res = await api.patch<JackpotTierConfig>("/jackpot/tiers", payload);
    return res.data;
  },

  /** Drag-and-drop order of the four cards; rank 1 = leftmost. */
  reorderTiers: async (
    updates: { tier: string; rank: number }[]
  ): Promise<JackpotTierConfig[]> => {
    const res = await api.put<JackpotTierConfig[]>("/jackpot/tiers/reorder", {
      updates,
    });
    return res.data;
  },

  setTierEnabled: async (
    tier: string,
    enabled: boolean
  ): Promise<JackpotTierConfig> => {
    const res = await api.patch<JackpotTierConfig>(
      `/jackpot/tiers/${tier}/enabled/${enabled}`
    );
    return res.data;
  },

  /** Current-round participant pool — works for a per-game pot id OR a tier id. */
  participants: async (
    jackpotId: string,
    page = 1,
    limit = 10,
    search = ""
  ): Promise<JackpotParticipantsPage> => {
    const res = await api.get<JackpotParticipantsPage>(
      `/jackpot/${jackpotId}/participants`,
      { params: { page, limit, search: search || undefined } }
    );
    return res.data;
  },

  /** Outcome + full participant pool of the most recently finished round. */
  lastRound: async (jackpotId: string): Promise<JackpotLastRound> => {
    const res = await api.get<JackpotLastRound>(
      `/jackpot/${jackpotId}/rounds/last`
    );
    return res.data;
  },

  wins: async (
    page = 1,
    limit = 10,
    gameId?: string,
    /** Winner/game/provider text match, plus whole-day won-date bounds. */
    filters: { search?: string; from?: string; to?: string } = {},
  ): Promise<JackpotWinsPage> => {
    const res = await api.get<JackpotWinsPage>("/jackpot/wins", {
      params: {
        page,
        limit,
        gameId: gameId || undefined,
        search: filters.search || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      },
    });
    return res.data;
  },

  upsert: async (payload: UpsertJackpotPayload): Promise<GameJackpotConfig> => {
    const res = await api.post<GameJackpotConfig>("/jackpot", payload);
    return res.data;
  },

  setEnabled: async (gameId: string, enabled: boolean): Promise<GameJackpotConfig> => {
    const res = await api.patch<GameJackpotConfig>(
      `/jackpot/${gameId}/enabled/${enabled}`
    );
    return res.data;
  },

  remove: async (gameId: string): Promise<void> => {
    await api.delete(`/jackpot/${gameId}`);
  },
};
