import type { FreeSpin, FreeSpinSelection } from "@/types/free-spin";

/**
 * Selections of a template, falling back to the legacy single provider/game
 * pair for templates saved before multi-select shipped.
 */
export function resolveSelections(config: Partial<FreeSpin>): FreeSpinSelection[] {
  if (config.selections?.length) return config.selections;
  if (!config.softwareId || !config.gameId) return [];
  return [
    {
      softwareId: Number(config.softwareId),
      softwareName: config.softwareName,
      games: [{ id: Number(config.gameId), name: config.gameName }],
    },
  ];
}

/** "Playson" / "Playson +2" — provider column of the config tables. */
export function summarizeProviders(config: Partial<FreeSpin>): string {
  const selections = resolveSelections(config);
  if (!selections.length) return "-";

  const [first, ...rest] = selections;
  const name = first.softwareName ?? String(first.softwareId);
  return rest.length ? `${name} +${rest.length}` : name;
}

/**
 * What one player actually receives from a template.
 *
 * `numberOfFreeSpins` is the PER-GAME default, and each game may override it,
 * so the player's total is the sum across games — never the template's own
 * number. Anywhere that shows a spin count to an admin should show this.
 */
export function summarizeTemplateSpins(config: Partial<FreeSpin>): {
  gameCount: number;
  totalSpins: number;
} {
  const defaultSpins = Number(config.numberOfFreeSpins) || 0;

  return resolveSelections(config).reduce(
    (acc, selection) => {
      for (const game of selection.games) {
        const spins = Number(game.spins) > 0 ? Number(game.spins) : defaultSpins;
        acc.gameCount += 1;
        acc.totalSpins += spins;
      }
      return acc;
    },
    { gameCount: 0, totalSpins: 0 },
  );
}

/** "Aztec Gems" / "5 games" — game column of the config tables. */
export function summarizeGames(config: Partial<FreeSpin>): string {
  const selections = resolveSelections(config);
  const total = selections.reduce((sum, s) => sum + s.games.length, 0);
  if (!total) return "-";
  if (total === 1) {
    const only = selections[0].games[0];
    return only.name ?? `#${only.id}`;
  }
  return `${total} games`;
}
