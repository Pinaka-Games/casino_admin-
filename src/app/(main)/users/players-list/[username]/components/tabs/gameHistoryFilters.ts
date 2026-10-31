import { FilterField, FilterValues } from "@/components/filters/types";

export const GAME_HISTORY_DEFAULTS: FilterValues = {
  search: "",
  range: "all",
  from: "",
  to: "",
  asset: "all",
  result: "all",
  freeSpins: "all",
  minBuyIn: "",
  maxBuyIn: "",
  minProfit: "",
  maxProfit: "",
};

export const GAME_HISTORY_FIELDS: FilterField[] = [
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
  {
    type: "select",
    key: "asset",
    label: "Currency",
    options: [
      { label: "All Currencies", value: "all" },
      { label: "Wulf Cash", value: "wulfCash" },
      { label: "Wulf Coin", value: "wulfCoin" },
    ],
  },
  {
    type: "select",
    key: "result",
    label: "Result",
    options: [
      { label: "All Rounds", value: "all" },
      { label: "Winning Rounds", value: "win" },
      { label: "Losing Rounds", value: "loss" },
    ],
  },
  {
    type: "select",
    key: "freeSpins",
    label: "Free Spins",
    options: [
      { label: "Include Free Spins", value: "all" },
      { label: "Free Spins Only", value: "only" },
      { label: "Paid Rounds Only", value: "exclude" },
    ],
  },
  {
    type: "numberRange",
    minKey: "minBuyIn",
    maxKey: "maxBuyIn",
    label: "Buy In",
  },
  {
    type: "numberRange",
    minKey: "minProfit",
    maxKey: "maxProfit",
    label: "Profit / Loss",
    hint: "Losses are negative, e.g. -10 to 0.",
  },
];

/** Columns the Game History table can be ordered by, server-side. */
export type GameHistorySortKey = "time" | "buyIn" | "multiplier" | "profit";
export type GameHistorySortDir = "asc" | "desc";

export interface GameHistorySort {
  key: GameHistorySortKey;
  dir: GameHistorySortDir;
}

/** Newest round first — what the table showed before sorting existed. */
export const DEFAULT_GAME_HISTORY_SORT: GameHistorySort = {
  key: "time",
  dir: "desc",
};

/**
 * `range: custom` is a UI-only value — the backend takes explicit dates instead,
 * so it is dropped and the two date keys are sent in its place.
 */
export const buildGameHistoryParams = (values: FilterValues) => {
  const params = new URLSearchParams();

  if (values.search.trim()) params.append("search", values.search.trim());
  if (values.asset !== "all") params.append("asset", values.asset);
  if (values.result !== "all") params.append("result", values.result);
  if (values.freeSpins !== "all") params.append("freeSpins", values.freeSpins);

  if (values.range === "custom") {
    if (values.from) params.append("from", values.from);
    if (values.to) params.append("to", values.to);
  } else if (values.range !== "all") {
    params.append("range", values.range);
  }

  (["minBuyIn", "maxBuyIn", "minProfit", "maxProfit"] as const).forEach((key) => {
    const value = (values[key] ?? "").trim();
    if (value !== "" && !isNaN(Number(value))) params.append(key, value);
  });

  return params;
};

/**
 * Sorting is applied by the API over whole rounds, not by the browser over the
 * ten rows on screen — page 1 of a "highest buy in" sort has to be the highest
 * buy ins in the history, not the highest of the newest ten.
 */
export const appendGameHistorySort = (
  params: URLSearchParams,
  sort: GameHistorySort
) => {
  if (sort.key !== DEFAULT_GAME_HISTORY_SORT.key || sort.dir !== DEFAULT_GAME_HISTORY_SORT.dir) {
    params.append("sortBy", sort.key);
    params.append("sortDir", sort.dir);
  }
  return params;
};
