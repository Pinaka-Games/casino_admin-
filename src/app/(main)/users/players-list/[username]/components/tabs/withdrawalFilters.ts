import { FilterField, FilterValues } from "@/components/filters/types";

export const WITHDRAWAL_DEFAULTS: FilterValues = {
  search: "",
  status: "all",
  method: "all",
  from: "",
  to: "",
  minAmount: "",
  maxAmount: "",
};

export const WITHDRAWAL_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Pending", value: "PENDING" },
      { label: "Approved", value: "APPROVED" },
      { label: "Processed", value: "PROCESSED" },
      { label: "Rejected", value: "REJECTED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
  {
    type: "select",
    key: "method",
    label: "Payment Method",
    options: [
      { label: "All Methods", value: "all" },
      { label: "Card", value: "card" },
      { label: "Bank", value: "bank" },
      { label: "Crypto", value: "crypto" },
    ],
    hint: "Matches the method recorded on the request.",
  },
  {
    type: "dateRange",
    fromKey: "from",
    toKey: "to",
    label: "Requested Between",
  },
  {
    type: "numberRange",
    minKey: "minAmount",
    maxKey: "maxAmount",
    label: "Amount",
  },
];

interface FilterableRedeem {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  productName?: string | null;
  notes: string | null;
  createdAt: string;
}

/** The whole request list arrives in one call, so every filter runs client-side. */
export function filterWithdrawalRows<T extends FilterableRedeem>(
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
        row.status,
        row.paymentMethod,
        row.productName,
        row.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (values.status !== "all" && row.status !== values.status) return false;

    if (values.method !== "all") {
      const method = (row.paymentMethod ?? "").toLowerCase();
      if (!method.includes(values.method)) return false;
    }

    if (from || to) {
      const created = new Date(row.createdAt);
      if (isNaN(created.getTime())) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
    }

    const amount = Number(row.amount) || 0;
    if (min !== null && !isNaN(min) && amount < min) return false;
    if (max !== null && !isNaN(max) && amount > max) return false;

    return true;
  });
}
