import api from "@/api/config/axios.config";

export type AdjustableCurrency = "wulfCash" | "wulfCoin" | "bonusWulfCash";

export type BalanceSnapshot = Record<AdjustableCurrency, number>;

/**
 * Everything the Wallet tab edit form can change: Sweep Coin, Gold Coin, Bonus
 * balance and total XP.
 */
export type EditSnapshot = {
  wulfCash: number;
  wulfCoin: number;
  bonusWulfCash: number;
  xp: number;
};

/**
 * `bonusWulfCash` is optional: the API edits the bonus only when both
 * `expected` and `target` carry it, so send it only when it changed.
 */
export type EditableBalances = { wulfCash: number; wulfCoin: number; bonusWulfCash?: number };

export interface AdjustBalanceDto {
  userId: string;
  /** Balances the admin was looking at — the API refuses (409) if they moved. */
  expected: EditableBalances;
  /** New balances requested. */
  target: EditableBalances;
  /** Optional, up to 500 characters. Shown to the player when given. */
  reason?: string;
  /**
   * Sweep Coin / Bonus increase only. Sweep Coin: true = rollover lock, false =
   * immediately redeemable. Bonus: true = its own bonus rollover, false = stays locked.
   */
  applyWagering?: boolean;
  /** With applyWagering: requirement = increase × multiplier (1–1000). Omit for the system default. */
  wageringMultiplier?: number;
  /** XP the admin saw. Send with targetXp only when XP is being edited. */
  expectedXp?: number;
  /** New total XP (whole number). The VIP tier is re-derived from it. */
  targetXp?: number;
}

/**
 * A balance edit waiting for (or past) review on the Manual Deposit Listing.
 * Nothing touches the wallet until it is approved there.
 */
export interface BalanceAdjustmentRequest {
  id: string;
  userId: string;
  wulfCashDelta: number | string;
  wulfCoinDelta: number | string;
  xpDelta: number | string;
  reason?: string | null;
  applyWagering: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
}

/** Manual Deposit page "Top Out": amounts to take off the player. */
export interface TopoutBalanceDto {
  userId: string;
  wulfCash?: number;
  wulfCoin?: number;
  /** Optional, up to 500 characters. Shown to the player once approved. */
  reason?: string;
}

export const balanceAdjustmentApi = {
  /** Raises a PENDING request — approved from the Manual Deposit Listing. */
  adjust: (dto: AdjustBalanceDto) =>
    api.post<BalanceAdjustmentRequest>("/balance-adjustments", dto),

  /** Raises a PENDING debit — approved from the Manual Deposit Listing. */
  topout: (dto: TopoutBalanceDto) =>
    api.post<BalanceAdjustmentRequest>("/balance-adjustments/topout", dto),

  approve: (id: string) =>
    api.patch<BalanceAdjustmentRequest>(`/balance-adjustments/${id}/approve`),

  reject: (id: string, reason: string) =>
    api.patch<BalanceAdjustmentRequest>(`/balance-adjustments/${id}/reject`, {
      reason,
    }),
};
