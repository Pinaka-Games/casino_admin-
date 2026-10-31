import { FilterField, FilterValues, checkedValues } from "@/components/filters/types";

/**
 * Filters for the User Activity timeline.
 *
 * Kinds are a checkbox group rather than the single select this started as: an
 * investigation is normally "logins AND payments", and a one-at-a-time filter
 * made that two passes with the timeline's own ordering lost between them.
 * Nothing ticked means everything, which is also the default — so an untouched
 * filter costs no param and shows no chip.
 */
export const ACTIVITY_DEFAULTS: FilterValues = {
  search: "",
  kinds: "",
  range: "all",
  from: "",
  to: "",
  order: "desc",
};

export const ACTIVITY_FIELDS: FilterField[] = [
  {
    type: "checkboxGroup",
    key: "kinds",
    label: "Activity",
    options: [
      { label: "Logins", value: "login" },
      { label: "Logouts", value: "logout" },
      { label: "Game starts", value: "game_start" },
      { label: "Game ends", value: "game_end" },
      { label: "Payments & rewards", value: "transaction" },
      { label: "Redeems", value: "redeem" },
      { label: "Promo codes", value: "promo" },
      { label: "KYC & tax", value: "kyc" },
      { label: "Safer gambling", value: "responsible_gaming" },
      { label: "Risk & compliance", value: "risk" },
      { label: "Support", value: "support" },
      { label: "Account", value: "account" },
    ],
    hint: "Leave all unticked to show every kind of activity.",
  },
  {
    type: "select",
    key: "range",
    label: "Time Period",
    options: [
      { label: "All Time", value: "all" },
      { label: "Last 24 Hours", value: "24h" },
      { label: "Last 7 Days", value: "7d" },
      { label: "Last 30 Days", value: "30d" },
      { label: "Last 90 Days", value: "90d" },
      { label: "Custom Range", value: "custom" },
    ],
  },
  {
    type: "dateRange",
    fromKey: "from",
    toKey: "to",
    label: "Custom Dates",
    showWhen: (values) => values.range === "custom",
  },
];

/**
 * `range: custom` is a UI-only value — the API takes explicit dates instead, so
 * it is dropped and the two date keys are sent in its place. Same contract the
 * game-history filters use, so both tables answer a date filter identically.
 */
export const buildActivityParams = (values: FilterValues) => {
  const params: Record<string, string> = {};

  const kinds = checkedValues(values.kinds);
  if (kinds.length) params.kinds = kinds.join(",");

  // Matched server-side against the event label and its detail line. Kept out
  // of the sheet on purpose: it lives in the toolbar beside the kind pills,
  // where a search box is looked for.
  const search = values.search?.trim();
  if (search) params.search = search;

  // Newest-first is the default and sends nothing; reading the journey forwards
  // is the explicit case.
  if (values.order === "asc") params.order = "asc";

  if (values.range === "custom") {
    if (values.from) params.from = values.from;
    if (values.to) params.to = values.to;
  } else if (values.range !== "all") {
    params.range = values.range;
  }

  return params;
};
