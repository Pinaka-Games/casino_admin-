/**
 * Payout destinations and the rails they settle over — the agent-panel copy of
 * the backend's `withdraw-speed.util.ts` catalogue (the player app carries the
 * same file at `components/common/payments/coinflow-payout-rails.ts`).
 *
 * Coinflow's `speed` on the delegated payout API is a RAIL, not a "how fast do
 * you want it" preference: it has to match the destination the requester linked
 * or the payout is rejected with "Account not supported for this speed". So the
 * speed picker is filtered by destination rather than offered freely — a debit
 * card can only be `card`, PayPal only `paypal`, and a US bank account is the one
 * destination with a genuine choice of four.
 *
 * A rail only reaches the requester if Coinflow has enabled it on the merchant
 * account, and only if the admin left it on in Payment Manager (the backend drops
 * the rest before the list ever gets here).
 */

export const COINFLOW_WITHDRAW_SPEEDS = [
  "asap",
  "same_day",
  "standard",
  "card",
  "iban",
  "pix",
  "eft",
  "venmo",
  "paypal",
  "wire",
  "interac",
] as const;

export type CoinflowWithdrawSpeed = (typeof COINFLOW_WITHDRAW_SPEEDS)[number];

/** Canonical destination tokens returned by the backend. */
export type CoinflowDestinationType =
  | "BANK_ACCOUNT"
  | "IBAN"
  | "CARD"
  | "PAYPAL"
  | "VENMO"
  | "PIX"
  | "EFT"
  | "INTERAC";

export interface PayoutSpeedInfo {
  label: string;
  /** When the money lands. */
  delivery: string;
  /** The underlying rail, shown as the sub-label. */
  rail: string;
}

export const PAYOUT_SPEED_INFO: Record<CoinflowWithdrawSpeed, PayoutSpeedInfo> = {
  asap: { label: "Instant", delivery: "Seconds", rail: "RTP instant transfer" },
  same_day: {
    label: "Same day",
    delivery: "Within 24 business hours",
    rail: "Same-day ACH",
  },
  standard: {
    label: "Standard",
    delivery: "2–3 business days",
    rail: "Standard ACH",
  },
  wire: { label: "Wire", delivery: "Same business day", rail: "Bank wire" },
  card: {
    label: "To your debit card",
    delivery: "Usually within 30 minutes",
    rail: "Push-to-card",
  },
  iban: {
    label: "To your IBAN",
    delivery: "1–2 business days",
    rail: "SEPA / IBAN transfer",
  },
  paypal: { label: "PayPal", delivery: "Usually minutes", rail: "PayPal" },
  venmo: { label: "Venmo", delivery: "Usually minutes", rail: "Venmo" },
  pix: { label: "Pix", delivery: "Seconds", rail: "Pix (Brazil)" },
  eft: { label: "EFT", delivery: "1–3 business days", rail: "EFT (Canada)" },
  interac: {
    label: "Interac e-Transfer",
    delivery: "Usually minutes",
    rail: "Interac (Canada)",
  },
};

export interface PayoutDestinationInfo {
  label: string;
  /** Rails this destination may be paid over, default first. */
  speeds: CoinflowWithdrawSpeed[];
}

export const PAYOUT_DESTINATION_INFO: Record<
  CoinflowDestinationType,
  PayoutDestinationInfo
> = {
  BANK_ACCOUNT: {
    label: "Bank account",
    speeds: ["standard", "same_day", "asap", "wire"],
  },
  IBAN: { label: "IBAN", speeds: ["iban"] },
  CARD: { label: "Debit card", speeds: ["card"] },
  PAYPAL: { label: "PayPal", speeds: ["paypal"] },
  VENMO: { label: "Venmo", speeds: ["venmo"] },
  PIX: { label: "Pix", speeds: ["pix"] },
  EFT: { label: "EFT (Canada)", speeds: ["eft"] },
  INTERAC: { label: "Interac e-Transfer", speeds: ["interac"] },
};

/**
 * Normalise whatever the API hands back to a catalogue key. Covers the canonical
 * tokens and free-form strings from older records.
 */
export function normalizeDestinationType(
  type?: string | null,
): CoinflowDestinationType | null {
  const raw = (type ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!raw) return null;

  const exact = (
    Object.keys(PAYOUT_DESTINATION_INFO) as CoinflowDestinationType[]
  ).find((key) => key.replace(/[^A-Z]/g, "") === raw);
  if (exact) return exact;

  // Most specific first, so an IBAN is never swallowed by the bank rule.
  const keywords: Array<[CoinflowDestinationType, string[]]> = [
    ["PAYPAL", ["PAYPAL"]],
    ["VENMO", ["VENMO"]],
    ["INTERAC", ["INTERAC"]],
    ["PIX", ["PIX"]],
    ["EFT", ["EFT"]],
    ["IBAN", ["IBAN", "SEPA"]],
    ["CARD", ["CARD", "DEBIT"]],
    ["BANK_ACCOUNT", ["BANK", "ACH", "WIRE", "RTP"]],
  ];
  return (
    keywords.find(([, words]) => words.some((word) => raw.includes(word)))?.[0] ??
    null
  );
}

/** Rails offered for a destination; every rail when it is unrecognised. */
export function speedsForDestination(
  type?: string | null,
): CoinflowWithdrawSpeed[] {
  const key = normalizeDestinationType(type);
  return key
    ? PAYOUT_DESTINATION_INFO[key].speeds
    : [...COINFLOW_WITHDRAW_SPEEDS];
}

export function destinationLabel(type?: string | null): string {
  const key = normalizeDestinationType(type);
  return key ? PAYOUT_DESTINATION_INFO[key].label : (type ?? "—");
}

export function speedLabel(speed?: string | null): string {
  if (!speed) return "—";
  // 'instant' is the legacy label an earlier picker used for RTP.
  const key = speed === "instant" ? "asap" : speed;
  return PAYOUT_SPEED_INFO[key as CoinflowWithdrawSpeed]?.label ?? speed;
}
