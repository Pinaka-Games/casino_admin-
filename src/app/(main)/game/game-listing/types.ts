/* ===============================
   RUNTIME GAME ITEM (API / UI)
================================ */
export type GameItem = {
  id: string; // Changed to string for UUID
  name: string;
  provider: string;
  gameCode?: string;
  totalPlaying?: string;
  category: string;
  isNew: boolean;
  isFeatured: boolean;
  isHot: boolean;
  isRecommend: boolean;
  isLobby: boolean;
  isActive: boolean;
  displayOrder: number;
  sequence?: number | string;
  thumbnail?: any;
  totalPlays?: number;
};

/* ===============================
   STATIC CONFIG TYPES (REFACTORED)
================================ */
export type GameConfigItem = {
  id: string | number;
  name: string;
  isActive: boolean;
  displayOrder?: number;
  thumbnail?: any;
  isFeatured?: boolean;
  isNew?: boolean;
  totalPlays?: number;
  /** Lifetime launches, shown alongside rounds so the two are never conflated */
  totalLaunches?: number;
  /** Return to player %, as the provider reports it. Display only. */
  rtp?: number | string | null;
  /** 1-based position in an auto-ranked group (Trending Now) */
  rank?: number;
  /**
   * Bets in the trending window. Present only on cards in a window-ranked group,
   * where the card must show the number that put it in that position — lifetime
   * `totalPlays` does not, and printing it there makes the order look wrong.
   */
  trendingScore?: number;
  /**
   * Ranked below the live cut-off: not on the home page today, but first in
   * line if one of the games above it is switched off.
   */
  queued?: boolean;
};

export type GameCategory = {
  id: string | number;
  name: string;
  displayOrder?: number;
  isActive?: boolean;
  items: GameConfigItem[];
  /** True total in this category (server count); items may be a preview subset */
  count?: number;
  /** Auto-curated group (e.g. Hot Games) — cards render without edit toggles */
  readOnly?: boolean;
  /**
   * Derived group with no collection behind it (e.g. Trending Now, which the
   * backend ranks by plays). There is nothing to open in the category editor,
   * so the header shows the ranking rule instead of an "Edit Category" button.
   */
  autoCurated?: boolean;
  /** Short header hint explaining how an `autoCurated` group is built */
  autoCuratedHint?: string;
  /**
   * Controls rendered in the group header (e.g. the Trending rail's size
   * picker). Replaces the plain `autoCuratedHint` badge when present.
   */
  headerAction?: React.ReactNode;
};

export type GameProvider = {
  id: string | number;
  name: string;
  categories: GameCategory[];
  /** True total games for this provider (server count) */
  totalGames?: number;
};
