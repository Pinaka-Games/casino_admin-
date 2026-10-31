// types/cashbundletypes.ts

/** How discountValue is read. Mirrors the backend BundleDiscountType enum. */
export type BundleDiscountType = "percentage" | "flat";

/** Per-user discount window unit. Mirrors backend BundleDiscountDurationUnit. */
export type BundleDiscountDurationUnit =
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month";

// API RESPONSE TYPE
export interface ApiBundleResponse {
  id: string;
  name: string;
  description: string;
  wulfCoinAmount: number;
  bonusWulfCash: number;
  bonusWageringMultiplier: number;
  price: number;
  /** Wulf Cash granted, set independently of price. null = legacy 1:1 (= price). */
  wulfCashAmount?: number | null;
  discountEnabled: boolean;
  discountType: BundleDiscountType | null;
  discountValue: number | null;
  promoteOnHome: boolean;
  /** THE welcome offer — rendered in its own pop-up design. At most one bundle. */
  isWelcomeOffer?: boolean;
  /** Length of each user's discount window; null = evergreen sale. */
  discountDurationValue?: number | null;
  discountDurationUnit?: BundleDiscountDurationUnit | null;
  /** When the current campaign began (server-set). */
  discountStartedAt?: string | null;
  /** Free-spin template granted on purchase. null = none. */
  freeSpinConfigId?: string | null;
  isActive: boolean;
  displayOrder: number;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

// UI TYPE
// Wulf Cash granted is now an independent, admin-set amount (`wulfCashAmount`) —
// no longer locked to price. It defaults to price for legacy bundles, but an
// admin can issue more or less (a $30 bundle granting 50 Wulf Cash). Like the old
// rate, it holds on sale: a discount lowers the cash collected, not what is issued.
export interface CashBundle {
  id: string;
  name: string;
  coins: number; // from wulfCoinAmount
  free: number;  // from bonusWulfCash — EXTRA locked bonus, not the granted cash
  bonusWageringMultiplier: number; // rollover applied to `free`
  price: number; // list price, before any discount
  wulfCashAmount: number; // Wulf Cash granted, independent of price
  discountEnabled: boolean;
  discountType: BundleDiscountType | null;
  discountValue: number | null;
  promoteOnHome: boolean; // advertise this sale in the login pop-up
  /** THE welcome offer — rendered in its own pop-up design. At most one bundle. */
  isWelcomeOffer: boolean;
  // Per-user discount window. Both null = the sale never expires per user; set
  // together = each user gets this long from max(signup, campaign start).
  discountDurationValue: number | null;
  discountDurationUnit: BundleDiscountDurationUnit | null;
  // When the current campaign began (server-set on enable/terms-change). Anchors
  // the admin-facing countdown: campaign start + duration = when the sale ends for
  // users who were active at launch. Read-only; not sent back on save.
  discountStartedAt?: string | null;
  image?: string; // url string (optional)
  /** Free-spin template granted on purchase. null/undefined = none. */
  freeSpinConfigId?: string | null;
  isActive?: boolean;
  displayOrder?: number;
  description?: string;
}

// CREATE/UPDATE DTO
export interface CreateCashBundleDto {
  name: string;
  description: string;
  wulfCoinAmount: number;
  bonusWulfCash: number;
  bonusWageringMultiplier: number;
  price: number;
  wulfCashAmount: number;
  discountEnabled: boolean;
  discountType?: BundleDiscountType;
  discountValue?: number;
  // Nullable on the wire: an explicit null is how "No limit" clears a saved
  // window. Omitting them leaves the stored values in place (the update endpoint
  // patches with Object.assign), which is what kept an old countdown running.
  discountDurationValue?: number | null;
  discountDurationUnit?: BundleDiscountDurationUnit | null;
  promoteOnHome: boolean;
  /** THE welcome offer — rendered in its own pop-up design. At most one bundle. */
  isWelcomeOffer: boolean;
  displayOrder: number;
  icon: string;
  /** Optional free-spin template. Explicit null clears an existing wiring. */
  freeSpinConfigId?: string | null;
  isActive: boolean;
}

export interface UpdateCashBundleDto extends Partial<CreateCashBundleDto> {}

