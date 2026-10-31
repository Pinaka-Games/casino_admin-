import type { FreeSpinGrant } from "@/types/free-spin";

/**
 * One assignment as the admin performed it: a player receiving a template.
 *
 * AleaPlay grants against a single game, so assigning a 3-game template creates
 * 3 bonuses. Listing those as 3 unrelated rows misrepresents what happened —
 * the admin did one thing. This groups them back together, with the individual
 * grants kept for the detail view.
 */
export interface GrantAllocation {
  /** `poolId` when present, else the grant's own id (pre-grouping records). */
  key: string;
  userId: string;
  username?: string;
  /** Email or phone — how support and AleaPlay identify the player. */
  contact?: string;
  configId?: string;
  configName: string;
  bonusLabel?: string;
  softwareName?: string;
  /** Earliest grant time in the group. */
  grantedAt: string;
  expiresAt?: string;
  totalSpins: number;
  /**
   * Rounds the player has actually used across the assignment. A floor, not an
   * exact figure: AleaPlay only reports a round when it pays out, so a losing
   * round is invisible until the grant is closed by the paid-bet signal or by
   * expiry — at which point it is recorded as fully used.
   */
  totalSpinsUsed: number;
  /** Nothing reached AleaPlay — the allocation can be retried. */
  failed: boolean;
  /** Some games are still missing, whether or not any were granted. */
  retryable: boolean;
  /** Why the last attempt failed — AleaPlay's words, not ours. */
  failureReason?: string;
  /** Attempts so far, so a repeatedly-failing allocation is obvious. */
  grantAttempts?: number;
  gameCount: number;
  /** Rolled up from the individual grants — see `summarizeStatus`. */
  status: string;
  grants: FreeSpinGrant[];
}

/**
 * Roll per-game statuses into one.
 *
 * Mixed states are reported as `partial` rather than being flattened to a
 * single status: "2 of 3 cancelled" is the kind of thing an admin has to see.
 */
function summarizeStatus(grants: FreeSpinGrant[]): string {
  const statuses = new Set(grants.map((g) => (g.status ?? "").toLowerCase()));
  if (statuses.size === 1) return [...statuses][0];
  // Anything still playable dominates: the player can act on it right now.
  if (statuses.has("granted") || statuses.has("active")) return "partial";
  if (statuses.has("completed")) return "completed";
  return [...statuses][0] ?? "unknown";
}

/** Group flat grant rows into the assignments that produced them. */
export function groupGrantsByAllocation(grants: FreeSpinGrant[]): GrantAllocation[] {
  const byKey = new Map<string, FreeSpinGrant[]>();

  for (const grant of grants) {
    // Grants created before allocations were grouped have no poolId; each one
    // stands alone so nothing is silently merged.
    const key = grant.poolId || `grant:${grant.id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), grant]);
  }

  return Array.from(byKey.entries())
    .map(([key, rows]) => {
      const [first] = rows;
      const grantedAt = rows
        .map((r) => r.grantedAt)
        .sort()
        .at(0) as string;

      return {
        key,
        userId: first.userId,
        username: first.username,
        contact: first.contact,
        configId: first.freeSpinConfigId,
        configName: first.config?.name ?? first.bonusLabel ?? "Manual Grant",
        bonusLabel: first.bonusLabel,
        softwareName: first.softwareName ?? first.config?.softwareName,
        grantedAt,
        expiresAt: first.expiresAt,
        totalSpins: rows.reduce(
          (sum, r) => sum + (Number(r.spinsGranted) || Number(r.config?.numberOfFreeSpins) || 0),
          0,
        ),
        totalSpinsUsed: rows.reduce((sum, r) => sum + (Number(r.spinsUsed) || 0), 0),
        failed: rows.some((r) => r.failed === true),
        retryable: rows.some((r) => r.failed === true || r.retryable === true),
        failureReason: rows.find((r) => r.failureReason)?.failureReason,
        grantAttempts: rows.find((r) => r.grantAttempts)?.grantAttempts,
        gameCount: rows.length,
        // A failed allocation reports as FAILED rather than as its pool status
        // (PENDING), which read like "in progress" for something that had
        // already stopped and needed an admin.
        status: rows.some((r) => r.failed === true) ? "failed" : summarizeStatus(rows),
        grants: rows,
      } satisfies GrantAllocation;
    })
    .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
}

/** Game names in an allocation, for the collapsed row. */
export function describeAllocationGames(allocation: GrantAllocation): string {
  if (allocation.gameCount === 1) {
    const only = allocation.grants[0];
    return only.gameName ?? only.config?.gameName ?? "-";
  }
  return `${allocation.gameCount} games`;
}
