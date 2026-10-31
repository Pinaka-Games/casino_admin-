/**
 * Mirror of the API's name helper (`adminstrator/utils/player-name.ts`).
 *
 * A player's legal name is stored as three parts plus a composed `fullName`.
 * The API composes on write, so the form sends parts; this file only has to
 * turn a legacy composed string back into parts for rows written before the
 * columns existed.
 */

export interface NameParts {
  firstName: string;
  middleName: string;
  lastName: string;
}

export const EMPTY_NAME_PARTS: NameParts = {
  firstName: "",
  middleName: "",
  lastName: "",
};

const clean = (value?: string | null) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

/** Render the parts the way the API will, for display next to the inputs. */
export const composeFullName = (parts: Partial<NameParts>): string =>
  [parts.firstName, parts.middleName, parts.lastName]
    .map(clean)
    .filter(Boolean)
    .join(" ");

/**
 * Best-effort split of a composed name: first token given, last token family,
 * anything between them the middle name. Wrong for two-word surnames — which is
 * the whole reason the parts are stored, so a stored part always wins over this.
 */
export const splitFullName = (
  fullName?: string | null,
  knownMiddleName?: string | null,
): NameParts => {
  const tokens = clean(fullName).split(" ").filter(Boolean);
  const middleName = clean(knownMiddleName);

  if (tokens.length === 0) return { ...EMPTY_NAME_PARTS, middleName };
  if (tokens.length === 1) return { firstName: tokens[0], middleName, lastName: "" };

  return {
    firstName: tokens[0],
    middleName: middleName || (tokens.length > 2 ? tokens.slice(1, -1).join(" ") : ""),
    lastName: tokens[tokens.length - 1],
  };
};

/**
 * The parts to show for a profile, whichever era wrote it: stored parts when
 * the API has them, a split of the composed name when it does not.
 */
export const resolveNameParts = (source?: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
} | null): NameParts => {
  const firstName = clean(source?.firstName);
  const lastName = clean(source?.lastName);

  if (firstName || lastName) {
    return { firstName, middleName: clean(source?.middleName), lastName };
  }

  return splitFullName(source?.fullName, source?.middleName);
};
