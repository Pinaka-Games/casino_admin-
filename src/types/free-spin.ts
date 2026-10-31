/**
 * Wallet the spins are played in.
 *
 * AleaPlay keeps the two apart: a GC bonus only exists in a gold session and an
 * SC bonus only in a sweeps one. GC is the free currency, so gold spins cost
 * nothing and their winnings never touch Wulf Cash.
 */
export enum SpinCurrency {
  SC = "SC",
  GC = "GC",
}

export enum WinningsTarget {
  REAL_SC = "real_sc",
  BONUS_SC = "bonus_sc",
}

export type FreeSpinGrantStatus = "active" | "used" | "expired" | "cancelled" | "granted" | "completed";

export interface FreeSpinSelectionGame {
  /** AleaPlay providerGameId */
  id: number;
  name?: string;
  /** Spins on this game. Omitted means "use the template's default". */
  spins?: number;
}

/** One provider and the games of that provider a template covers. */
export interface FreeSpinSelection {
  softwareId: number;
  softwareName?: string;
  games: FreeSpinSelectionGame[];
}

export interface FreeSpin {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  /**
   * Providers + games the template covers. Null on templates created before
   * multi-select — fall back to the softwareId/gameId pair below.
   */
  selections?: FreeSpinSelection[];
  /** Primary provider — mirrors selections[0]. */
  softwareId: number;
  softwareName?: string;   // snapshot: provider name e.g. "Felix Gaming"
  /** Primary game — mirrors selections[0].games[0]. */
  gameId: number;
  gameName?: string;       // snapshot: game name e.g. "Aztec Gems"
  betLevel: number;
  numberOfFreeSpins: number;
  casinoCampaignId?: string;
  grantExpiresInDays?: number;
  spinCurrency?: SpinCurrency;
  winningsTarget: WinningsTarget;
  winningsWageringMultiplier?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFreeSpinDto {
  name: string;
  description?: string;
  imageUrl?: string;
  /** Providers + games. The backend mirrors the first entry onto softwareId/gameId. */
  selections: FreeSpinSelection[];
  softwareId?: number;
  softwareName?: string;
  gameId?: number;
  gameName?: string;
  betLevel: number;
  /**
   * Spins per game by default. Each selected game becomes its own AleaPlay
   * bonus, so the player's total is this × games unless a game overrides it.
   */
  numberOfFreeSpins: number;
  casinoCampaignId?: string;
  grantExpiresInDays?: number;
  spinCurrency?: SpinCurrency;
  winningsTarget: WinningsTarget;
  winningsWageringMultiplier?: number;
  isActive?: boolean;
}

export interface UpdateFreeSpinDto extends Partial<CreateFreeSpinDto> {}

export interface FreeSpinGrant {
  id: string;
  freeSpinConfigId: string;
  userId: string;
  username?: string;
  /**
   * The player's email or phone — `users.entity`, which holds whichever they
   * registered with. Support and AleaPlay both identify players by this rather
   * than by a generated username.
   */
  contact?: string;
  /** Our idempotency id (`FS-…`). Cancel acts on this, so it is never dropped. */
  sourceTransactionId: string;
  /**
   * AleaPlay's OWN bonus id, returned by their Grant API. This is the value
   * their support checks against, and the one they send back on PROMO_PAYOUT.
   * Empty on grants whose Grant response carried no id — those are exactly the
   * ones whose payouts cannot be matched, so a blank here is a real signal.
   */
  aleaBonusId?: string;
  /** Rounds we have evidence of — a floor, since a losing round pays nothing. */
  spinsUsed?: number;
  /** Wallet the spins play in. */
  currency?: string;
  /** Bet level sent to AleaPlay (1–5). */
  level?: number;
  /** AleaPlay casino/environment the grant was issued against. */
  casinoId?: string;
  environmentId?: string;
  grantedAt: string;
  expiresAt?: string;
  status: FreeSpinGrantStatus;
  spinsGranted?: number;
  softwareName?: string;
  gameName?: string;
  softwareId?: number;
  gameId?: number;
  /** Every game the grant covers. One entry now — AleaPlay allows one per bonus. */
  gameIds?: number[];
  /**
   * The allocation this grant belongs to. One admin assignment of a template
   * produces one grant per game, all sharing this id.
   */
  poolId?: string;
  /**
   * Nothing in this allocation reached AleaPlay. Such rows have no grant behind
   * them — they exist so a failure is visible instead of vanishing — and are the
   * only ones that can be retried.
   */
  failed?: boolean;
  /**
   * The allocation behind this grant still has games that never reached
   * AleaPlay — a partial failure. The granted games look healthy on their own,
   * so without this the missing one is invisible and unfixable.
   */
  retryable?: boolean;
  /** AleaPlay's own reason this player missed their spins. */
  failureReason?: string;
  failedAt?: string;
  /** How many times this allocation has been sent, retries included. */
  grantAttempts?: number;
  bonusLabel?: string;
  config?: {
    name: string;
    numberOfFreeSpins: number;
    softwareId: number;
    softwareName?: string;
    gameId: number;
    gameName?: string;
  };
}
