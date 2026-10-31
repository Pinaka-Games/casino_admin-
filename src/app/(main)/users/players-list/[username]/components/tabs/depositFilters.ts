import { FilterField, FilterValues } from "@/components/filters/types";
import { statusBucket } from "./walletFilters";

export const DEPOSIT_DEFAULTS: FilterValues = {
  search: "",
  source: "all",
  tag: "all",
  status: "all",
  discount: "all",
  from: "",
  to: "",
  minPaid: "",
  maxPaid: "",
};

export const DEPOSIT_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "source",
    label: "Product Type",
    options: [
      { label: "All Products", value: "all" },
      { label: "Bundle Purchase", value: "BUNDLE_PURCHASE" },
      { label: "Subscription Buy", value: "SUBSCRIPTION_BUY" },
      { label: "Subscription Upgrade", value: "SUBSCRIPTION_UPGRADE" },
      { label: "Subscription Renew", value: "SUBSCRIPTION_RENEW" },
      { label: "Manual Deposit (Admin)", value: "MANUAL_DEPOSIT" },
      { label: "Breeze Payin", value: "BREEZE_PAYIN" },
    ],
  },
  {
    type: "select",
    key: "tag",
    label: "Tag",
    options: [
      { label: "All Tags", value: "all" },
      { label: "Postcard", value: "postcard" },
      { label: "Social Media", value: "social_media" },
      { label: "Other", value: "other" },
      { label: "Untagged", value: "none" },
    ],
  },
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Completed", value: "success" },
      { label: "Pending / Processing", value: "pending" },
      { label: "Failed / Cancelled", value: "failed" },
    ],
  },
  {
    type: "select",
    key: "discount",
    label: "Discount",
    options: [
      { label: "All Purchases", value: "all" },
      { label: "Discounted Only", value: "yes" },
      { label: "Full Price Only", value: "no" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
  {
    type: "numberRange",
    minKey: "minPaid",
    maxKey: "maxPaid",
    label: "Amount Paid",
    hint: "The fiat amount charged, in dollars.",
  },
];

interface FilterableDeposit {
  createdAt: string;
  paid: number;
  original: number | null;
  promoCode?: string | null;
  paymentMethod: string | null;
  tag: string | null;
  tagKey: string | null;
  source: string;
  status: string;
}

/** The whole deposit history is already in memory, so every filter runs here. */
export function filterDepositRows<T extends FilterableDeposit>(
  rows: T[],
  values: FilterValues
): T[] {
  const search = (values.search ?? "").trim().toLowerCase();
  const from = values.from ? new Date(`${values.from}T00:00:00`) : null;
  const to = values.to ? new Date(`${values.to}T23:59:59.999`) : null;
  const min = values.minPaid.trim() === "" ? null : Number(values.minPaid);
  const max = values.maxPaid.trim() === "" ? null : Number(values.maxPaid);

  return rows.filter((row) => {
    if (search) {
      const haystack = [
        row.source,
        row.status,
        row.tag,
        row.promoCode,
        row.paymentMethod,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (values.source !== "all" && row.source !== values.source) return false;

    if (values.tag !== "all") {
      const key = row.tagKey ?? "none";
      if (key !== values.tag) return false;
    }

    if (values.status !== "all" && statusBucket(row.status) !== values.status) {
      return false;
    }

    if (values.discount !== "all") {
      // `original` is only set when a discount actually applied.
      const discounted = row.original !== null && row.original > row.paid;
      if (values.discount === "yes" && !discounted) return false;
      if (values.discount === "no" && discounted) return false;
    }

    if (from || to) {
      const created = new Date(row.createdAt);
      if (isNaN(created.getTime())) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
    }

    if (min !== null && !isNaN(min) && row.paid < min) return false;
    if (max !== null && !isNaN(max) && row.paid > max) return false;

    return true;
  });
}
