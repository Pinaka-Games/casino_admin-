/**
 * Calendar dates — a day with no time and no timezone, such as a date of birth.
 *
 * `new Date("2000-06-18")` is parsed as midnight **UTC**, so
 * `.toLocaleDateString()` renders it as 17 June anywhere west of Greenwich. The
 * same record therefore read 18 June to a colleague in India and 17 June to one
 * in Chicago, which is how a player's date of birth appeared to be wrong.
 *
 * The fix is to build the Date from its parts in LOCAL time, so the calendar day
 * survives formatting. Locale formatting is preserved — only the shift is gone.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** `yyyy-MM-dd`, or null when there is no usable date. */
export function toCalendarDate(
  value: string | Date | null | undefined,
): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return [
      value.getUTCFullYear().toString().padStart(4, "0"),
      (value.getUTCMonth() + 1).toString().padStart(2, "0"),
      value.getUTCDate().toString().padStart(2, "0"),
    ].join("-");
  }

  const match = ISO_DATE.exec(String(value).trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/**
 * Display a calendar date as `yyyy-MM-dd`.
 *
 * One format everywhere, matching what the KYC panel shows. The same date of
 * birth was rendering three different ways across the back office — `3/29/1981`
 * on the player Basic Info tab, `03/29/1981` in the edit form, `1981-03-29` in
 * KYC Details — which makes two records look different when they are identical.
 *
 * ISO is the right one to standardise on: it is what the verification data
 * already uses, it sorts correctly, and it cannot be misread the way `3/4/1981`
 * can (March 4th to an American, 3rd April to everyone else) — worth something
 * on a screen where staff compare a date against a passport.
 *
 * Locale formatting is deliberately NOT used: `toLocaleDateString()` renders in
 * the viewer's language, so the same record would read differently depending on
 * who opened it.
 *
 * Use this for dates of birth and any other date-only value. For real instants
 * (created at, last seen) keep using `new Date(...)` — those genuinely are
 * points in time and SHOULD be shown in the viewer's own zone.
 */
export function formatCalendarDate(
  value: string | Date | null | undefined,
  fallback = "N/A",
): string {
  return toCalendarDate(value) ?? fallback;
}
