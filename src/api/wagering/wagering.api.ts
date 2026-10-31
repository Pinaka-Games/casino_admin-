import api from "../config/axios.config";

/**
 * Rollover (wagering) data for one player — the same payload the player sees on
 * their own Roll Over page, read through the admin endpoint.
 */

export type RolloverStatus =
  | "NOT_STARTED"
  | "ONGOING"
  | "DONE"
  | "EXPIRED"
  | "CANCELED";

export type RolloverEntryType = "deposit" | "bonus" | "winnings";

export interface RolloverListEntry {
  id: string;
  /** user_bonus id for bonuses, transaction id for deposits. */
  referenceId: string | null;
  type: RolloverEntryType;
  /** Display label, e.g. "Bundle: 150k Pack", "Welcome Bonus". */
  label: string;
  /** Credited amount ($ / Wulf Cash). */
  amount: number;
  /** 1 for plain deposits; bonus wageringMultiplier (2, 5, …) for bonuses. */
  wageringMultiplier: number;
  /** amount × wageringMultiplier */
  wageringRequired: number;
  wageringCompleted: number;
  progressPct: number;
  status: RolloverStatus;
  createdAt: string | null;
  expiresAt: string | null;
}

export interface RolloverSummary {
  totalWagered: number;
  totalBonusWagered: number;
  betCount: number;
  isLocked: boolean;
  rolloverRequired: number;
  rolloverCompleted: number;
  rolloverRemaining: number;
  rolloverProgressPct: number;
  rolloverSource: string | null;
  isComplete: boolean;
}

export interface FullRolloverResponse {
  summary: RolloverSummary;
  entries: RolloverListEntry[];
}

/**
 * Paths are relative to `/api/v1/admin` — the shared axios baseURL already ends
 * in `/admin`, so the backend's `@Controller('admin/wagering')` is reached as
 * `/wagering/...`, not `/admin/wagering/...` (that resolves to
 * `/api/v1/admin/admin/wagering` and 404s). Same convention as sessions and
 * activity-logs.
 */
export const wageringAdminApi = {
  /** GET /admin/wagering/users/:id/rollover-list */
  getUserRolloverList: (
    userId: string,
    params?: { status?: RolloverStatus; type?: RolloverEntryType },
  ) =>
    api.get<FullRolloverResponse>(`/wagering/users/${userId}/rollover-list`, {
      params,
    }),
};
