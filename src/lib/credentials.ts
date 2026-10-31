/**
 * Cleanup for credentials the user PASTED rather than typed.
 *
 * The account-credentials email renders the username / email / password inside
 * an HTML table. Copying a value out of that table — from Gmail, Outlook, or
 * any webmail — routinely drags along characters that are invisible on screen
 * but very much present in the input: a non-breaking space from the cell
 * padding, a zero-width space from the line-break rules, a trailing newline
 * from the row itself.
 *
 * Those characters are why "copy the credentials, paste them in, press Login"
 * did nothing: `<input type="email">` only strips ASCII whitespace, so a
 * pasted U+00A0 left the field constraint-invalid and the browser refused to
 * submit the form — silently, with no request and no error toast.
 *
 * Normalising here means the value that reaches validation (and the API) is
 * the one the recipient can actually see.
 */

/**
 * Space-like and zero-width code points that survive a copy out of HTML.
 * Listed by number rather than as literals: on screen every one of them is
 * indistinguishable from a plain space, which is precisely how they get past
 * a reviewer — and why they cause this bug in the first place.
 */
const INVISIBLE_RANGES: Array<[number, number]> = [
  [0x00a0, 0x00a0], // no-break space  ← the one HTML email padding produces
  [0x1680, 0x1680], // ogham space mark
  [0x180e, 0x180e], // mongolian vowel separator
  [0x2000, 0x200d], // en/em spaces … zero-width joiner
  [0x2028, 0x2029], // line / paragraph separator
  [0x202f, 0x202f], // narrow no-break space
  [0x205f, 0x205f], // medium mathematical space
  [0x2060, 0x2060], // word joiner
  [0x3000, 0x3000], // ideographic space
  [0xfeff, 0xfeff], // zero-width no-break space (BOM)
];

const INVISIBLE_CHARS = new RegExp(
  `[${INVISIBLE_RANGES.map(([from, to]) =>
    from === to
      ? String.fromCodePoint(from)
      : `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`,
  ).join("")}]`,
  "g",
);

/**
 * Folds exotic whitespace to a plain space, then trims. Whitespace INSIDE the
 * value is kept — an email never has any, and a password is the user's to
 * choose — so this only removes what the clipboard added at the edges.
 */
export function sanitizeCredential(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(INVISIBLE_CHARS, " ").trim();
}
