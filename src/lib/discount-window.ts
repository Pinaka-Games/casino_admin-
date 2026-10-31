import { BundleDiscountDurationUnit, CashBundle } from "@/types/cashbundletypes";

/**
 * When the campaign window closes: campaignStart + duration. Mirrors the backend's
 * addDiscountDuration (month is a calendar-month add, not 30 days). Returns null
 * for an evergreen sale (no duration) or when the campaign start is unknown.
 *
 * This is the admin-facing "expiry" and the moment an admin might want to
 * "Restart sale". For an ordinary bundle it is the end for EVERYONE. For the
 * welcome offer it is only the end for players who were already registered when
 * it started — later signups run their own window from their signup date.
 */
export function computeCampaignEnd(
  startedAt: string | null | undefined,
  value: number | null | undefined,
  unit: BundleDiscountDurationUnit | null | undefined,
): Date | null {
  const v = Number(value);
  if (!startedAt || !unit || !(v > 0)) return null;

  const start = new Date(startedAt);
  if (!Number.isFinite(start.getTime())) return null;

  const end = new Date(start);
  switch (unit) {
    case "minute":
      end.setTime(end.getTime() + v * 60_000);
      break;
    case "hour":
      end.setTime(end.getTime() + v * 3_600_000);
      break;
    case "day":
      end.setTime(end.getTime() + v * 86_400_000);
      break;
    case "week":
      end.setTime(end.getTime() + v * 7 * 86_400_000);
      break;
    case "month":
      end.setMonth(end.getMonth() + v);
      break;
    default:
      return null;
  }
  return end;
}

/**
 * "2d 3h" / "3h 5m" / "24m 5s" / "9s" for the time left until `end`, or null when
 * `end` is null or already past. Pass a live `now` (from a ticking state) to count
 * down in real time; under an hour it includes seconds so the change is visible.
 */
export function formatTimeLeft(
  end: Date | null,
  now: number = Date.now(),
): string | null {
  if (!end) return null;
  const ms = end.getTime() - now;
  if (ms <= 0) return null;

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const mins = Math.floor((totalSeconds % 3_600) / 60);
  const secs = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * The admin-facing sale-window status for a bundle: whether it has a live
 * time-boxed sale, and the time left on the campaign clock. `expired` means that
 * clock has run out — the cue to Restart.
 *
 * `perUser` says who the clock binds. An ordinary bundle runs ONE shared window:
 * when it ends the bundle is hidden from everyone, and players who register
 * afterwards never see it. The welcome offer is the exception — it re-anchors to
 * each player's signup, so it keeps running for every new registration until the
 * discount is switched off.
 */
export function getSaleWindowStatus(
  bundle: Pick<
    CashBundle,
    | "discountEnabled"
    | "discountDurationValue"
    | "discountDurationUnit"
    | "discountStartedAt"
  > & { isWelcomeOffer?: boolean },
  now: number = Date.now(),
): {
  timeBoxed: boolean;
  end: Date | null;
  timeLeft: string | null;
  expired: boolean;
  perUser: boolean;
} {
  const timeBoxed =
    !!bundle.discountEnabled &&
    Number(bundle.discountDurationValue) > 0 &&
    !!bundle.discountDurationUnit;

  const perUser = !!bundle.isWelcomeOffer;

  if (!timeBoxed) {
    return { timeBoxed: false, end: null, timeLeft: null, expired: false, perUser };
  }

  const end = computeCampaignEnd(
    bundle.discountStartedAt,
    bundle.discountDurationValue,
    bundle.discountDurationUnit,
  );
  const timeLeft = formatTimeLeft(end, now);
  return {
    timeBoxed: true,
    end,
    timeLeft,
    expired: !!end && timeLeft === null,
    perUser,
  };
}

/**
 * "1 week" / "6 days" / "36 hours" — the configured window length, for the
 * new-user side of a sale. Existing users count down from the campaign start, but
 * anyone who signs up later gets this full duration from THEIR signup, so there is
 * no single end date to show them: only the length. Null when not time-boxed.
 */
export function formatDiscountDuration(
  value: number | null | undefined,
  unit: BundleDiscountDurationUnit | null | undefined,
): string | null {
  const v = Number(value);
  if (!unit || !(v > 0)) return null;
  return `${v} ${unit}${v === 1 ? "" : "s"}`;
}
