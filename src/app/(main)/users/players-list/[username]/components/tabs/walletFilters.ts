import { FilterField, FilterValues } from "@/components/filters/types";

export const WALLET_ALL = "All";

/**
 * Provider status strings are free-form (PROCESSING, CANCELED, REQUIRES_ACTION,
 * PAYOUT_FAILED…), so the filter buckets them the same way the row's colour
 * does instead of listing every literal.
 */
export const statusBucket = (label: string): "success" | "pending" | "failed" => {
  if (/REJECT|FAIL|CANCEL|EXPIRE/i.test(label)) return "failed";
  if (/PENDING|PROCESS|CREATED|REQUIRE/i.test(label)) return "pending";
  return "success";
};

export const WALLET_DEFAULTS: FilterValues = {
  search: "",
  type: WALLET_ALL,
  source: WALLET_ALL,
  status: "all",
  currency: "all",
  from: "",
  to: "",
  minAmount: "",
  maxAmount: "",
};

export const buildWalletFields = (
  typeOptions: { value: string; label: string }[],
  sourceOptions: { value: string; label: string }[]
): FilterField[] => [
  { type: "select", key: "type", label: "Type", options: typeOptions },
  { type: "select", key: "source", label: "Source", options: sourceOptions },
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Successful", value: "success" },
      { label: "Pending / Processing", value: "pending" },
      { label: "Failed / Cancelled", value: "failed" },
    ],
  },
  {
    type: "select",
    key: "currency",
    label: "Currency",
    options: [
      { label: "All Currencies", value: "all" },
      { label: "Wulf Cash", value: "wulfCash" },
      { label: "Wulf Coin", value: "wulfCoin" },
      { label: "Bonus Cash", value: "bonusWulfCash" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
  {
    type: "numberRange",
    minKey: "minAmount",
    maxKey: "maxAmount",
    label: "Amount",
    hint: "Compares the size of the movement, ignoring credit/debit sign.",
  },
];

interface FilterableRow {
  id: string;
  createdAt: string;
  type: string;
  source: string;
  sourceDetail: string | null;
  reason: string | null;
  status: { label: string };
  entries: { currency: string | null; amount: number | null }[];
}

/**
 * Type and source are sent to the API (it pages on them); everything else is
 * applied here, because rows are grouped client-side — a redeem and its refund
 * are one row — so the server cannot filter what it never assembled.
 */
export function filterWalletRows<T extends FilterableRow>(
  rows: T[],
  values: FilterValues
): T[] {
  const search = (values.search ?? "").trim().toLowerCase();
  const from = values.from ? new Date(`${values.from}T00:00:00`) : null;
  const to = values.to ? new Date(`${values.to}T23:59:59.999`) : null;
  const min = values.minAmount.trim() === "" ? null : Number(values.minAmount);
  const max = values.maxAmount.trim() === "" ? null : Number(values.maxAmount);

  return rows.filter((row) => {
    if (search) {
      const haystack = [
        row.id,
        row.type,
        row.source,
        row.sourceDetail,
        row.reason,
        row.status.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (values.status !== "all" && statusBucket(row.status.label) !== values.status) {
      return false;
    }

    if (values.currency !== "all") {
      const hasCurrency = row.entries.some(
        (entry) => entry.currency === values.currency && entry.amount !== null
      );
      if (!hasCurrency) return false;
    }

    if (from || to) {
      const created = new Date(row.createdAt);
      if (isNaN(created.getTime())) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
    }

    if (min !== null || max !== null) {
      const amounts = row.entries
        .map((entry) => Math.abs(Number(entry.amount) || 0))
        .filter((amount) => amount > 0);
      const largest = amounts.length ? Math.max(...amounts) : 0;
      if (min !== null && !isNaN(min) && largest < min) return false;
      if (max !== null && !isNaN(max) && largest > max) return false;
    }

    return true;
  });
}
