// Age helpers for admin registration forms.

/**
 * Whole-years age from a calendar date, or null if unparseable/empty.
 *
 * Counted on the calendar rather than in milliseconds. `new Date("2005-06-18")`
 * is midnight **UTC**, so reading it back with local getters returned 17 June in
 * any negative-offset zone — the gate then measured a different birthday
 * depending on where the admin was sitting, and could refuse someone on the very
 * day they came of age.
 */
export const getAge = (dob?: string): number | null => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob ?? "").trim());
  if (!iso) return null;

  const [birthYear, birthMonth, birthDay] = [
    Number(iso[1]),
    Number(iso[2]),
    Number(iso[3]),
  ];

  // "Today" is a real instant, so the admin's own local day is the right one.
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  const monthDiff = now.getMonth() + 1 - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDay)) age--;
  return age;
};

export const MIN_AGE = 21;

export const isUnderAge = (dob?: string): boolean => {
  const age = getAge(dob);
  return age !== null && age < MIN_AGE;
};

/**
 * Latest legal DOB (today minus MIN_AGE years) as ISO `yyyy-mm-dd`.
 * Use as the `max` on a DOB input so the picker can't select an under-age
 * or future date and doesn't default the calendar to today.
 */
export const getMaxDobDate = (minAge = MIN_AGE): string => {
  const d = new Date();
  // Built from local components, not via toISOString(): converting a local date
  // to UTC pushes it a day forward west of Greenwich, which would have let
  // someone a day too young past the picker.
  const year = d.getFullYear() - minAge;
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};
