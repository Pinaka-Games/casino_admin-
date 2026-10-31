/**
 * Live record sources for the header search.
 *
 * `settings-search.ts` indexes destinations — pages and config fields — which
 * is static and instant. This file adds the other half an admin actually types:
 * the *records* themselves. A support ticket arrives quoting a player's email,
 * a game name, an agent's login, a bonus name; pasting that into the header bar
 * should land on the record, not on the listing page it happens to live in.
 *
 * Each source is a thin wrapper around an endpoint the listing pages already
 * use, capped at a handful of rows and permission-gated the same way the
 * sidebar is, so search can never surface a record the admin cannot open.
 */

import { profileApi } from "@/api/users/users";
import { getAdminGameOptions } from "@/api/games/games";
import { getAllBonuses } from "@/api/bonus/bonus.api";
import { NAV_PERMISSIONS } from "@/config/menu.config";
import type { Bonus } from "@/types/bonus";

export type GlobalRecordKind = "player" | "agent" | "game" | "bonus";

export type GlobalRecordEntry = {
  id: string;
  recordKind: GlobalRecordKind;
  /** Headline — the identifier an admin recognises (username, game name…). */
  title: string;
  /** Second line — the thing they most likely typed (email, provider, type). */
  subtitle?: string;
  href: string;
};

export type GlobalRecordSource = {
  kind: GlobalRecordKind;
  /** Group heading in the results panel. */
  label: string;
  permission?: string;
  /**
   * Shortest query worth a round trip. Emails and game names are long; one or
   * two characters would match half the database and tell the admin nothing.
   */
  minLength: number;
  search: (query: string, signal: AbortSignal) => Promise<GlobalRecordEntry[]>;
};

/** Rows per source. Enough to disambiguate, short enough to stay scannable. */
export const RECORD_RESULT_LIMIT = 5;

/** Query key the deep links use so a listing page can preselect a row. */
export const RECORD_HIGHLIGHT_PARAM = "highlight";

/**
 * A player/agent detail page is addressed by the account's ID.
 *
 * The route segment is named `[username]` and the page reads it as one, but
 * every listing pushes `row.id` into it and the profile endpoints behind it
 * take an id — a real username lands on "User data not available". Rows with no
 * id fall back to the listing so the result still goes somewhere useful.
 */
const profileHref = (base: string, id?: string) =>
  id ? `${base}/${encodeURIComponent(id)}` : base;

const searchProfiles = async (
  query: string,
  signal: AbortSignal,
  isAgent: boolean,
): Promise<GlobalRecordEntry[]> => {
  const request = isAgent ? profileApi.getAllAgents : profileApi.getAllUsers;
  const response = await request(
    { search: query, page: 1, limit: RECORD_RESULT_LIMIT },
    signal,
  );

  const rows = response.data?.data ?? [];
  const base = isAgent ? "/users/agent-listing" : "/users/players-list";

  return rows.map((row) => {
    const username = row.username || row.profile?.displayName || undefined;
    const email = row.profile?.email || row.email || undefined;

    return {
      id: `${isAgent ? "agent" : "player"}:${row.id}`,
      recordKind: (isAgent ? "agent" : "player") as GlobalRecordKind,
      title: username || email || row.id,
      subtitle: username && email ? email : undefined,
      href: profileHref(base, row.id),
    };
  });
};

/**
 * Bonuses have no server-side search — the list is small and the admin page
 * loads it whole — so it is fetched once and filtered here. Cached for the
 * session's search use only; the listing page keeps its own fresh copy, so a
 * stale name here can never be mistaken for the record's current state.
 */
let bonusCache: { at: number; rows: Bonus[] } | null = null;
const BONUS_CACHE_MS = 60_000;

const loadBonuses = async (): Promise<Bonus[]> => {
  if (bonusCache && Date.now() - bonusCache.at < BONUS_CACHE_MS) {
    return bonusCache.rows;
  }
  const rows = await getAllBonuses();
  bonusCache = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
  return bonusCache.rows;
};

/** Turn BONUS_TYPE_LIKE_THIS into "Bonus Type Like This" for display/matching. */
const humanizeType = (value?: string) =>
  (value ?? "")
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const GLOBAL_RECORD_SOURCES: GlobalRecordSource[] = [
  {
    kind: "player",
    label: "Players",
    permission: NAV_PERMISSIONS.USERS_PLAYER_LISTING,
    minLength: 3,
    search: (query, signal) => searchProfiles(query, signal, false),
  },
  {
    kind: "agent",
    label: "Agents",
    permission: NAV_PERMISSIONS.USERS_AGENT_LISTING,
    minLength: 3,
    search: (query, signal) => searchProfiles(query, signal, true),
  },
  {
    kind: "game",
    label: "Games",
    permission: NAV_PERMISSIONS.GAME_MANAGEMENT,
    minLength: 3,
    search: async (query, signal) => {
      const result = await getAdminGameOptions(
        { search: query, page: 1, limit: RECORD_RESULT_LIMIT },
        signal,
      );

      return (result?.data ?? []).map((game) => ({
        id: `game:${game.id}`,
        recordKind: "game" as GlobalRecordKind,
        title: game.name,
        subtitle: game.provider,
        // The catalogue has no per-game route: open the cross-provider view
        // ("all") with the name preloaded into its search box.
        href: `/game/game-listing?provider=all&search=${encodeURIComponent(
          game.name,
        )}`,
      }));
    },
  },
  {
    kind: "bonus",
    label: "Bonuses",
    permission: NAV_PERMISSIONS.SETTINGS_BONUS_LISTING,
    minLength: 2,
    search: async (query) => {
      const term = query.toLowerCase();
      return (await loadBonuses())
        .filter((bonus) => {
          const type = humanizeType(bonus.type).toLowerCase();
          return (
            bonus.name?.toLowerCase().includes(term) || type.includes(term)
          );
        })
        .slice(0, RECORD_RESULT_LIMIT)
        .map((bonus) => ({
          id: `bonus:${bonus.id}`,
          recordKind: "bonus" as GlobalRecordKind,
          title: bonus.name,
          subtitle: humanizeType(bonus.type),
          href: `/settings/bonus-listing?${RECORD_HIGHLIGHT_PARAM}=${encodeURIComponent(
            bonus.id,
          )}`,
        }));
    },
  },
];
