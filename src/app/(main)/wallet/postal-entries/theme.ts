/**
 * The wallet section's palette, in one place.
 *
 * These pages cannot use the shadcn semantic tokens (`bg-card`, `bg-primary`,
 * `text-muted-foreground`): this app's dark theme leaves them as generic greys —
 * `--primary` resolves to near-white — so a `<Button>` with no explicit colour
 * rendered as a washed-out grey slab next to the purple buttons on every
 * neighbouring screen. Manual Deposit and its listing hardcode the same hex
 * values; this file is those values named.
 */

/** Page ground. */
export const PAGE = "bg-[#15181E]";

/** Panel / card surface. */
export const PANEL = "rounded-xl border border-[#242B35] bg-[#191D24]";

/** Inset surface: inputs, code chips, nested blocks. */
export const INSET = "bg-[#242B35] border border-[#242B35]";

/** Form control. */
export const FIELD =
  "bg-[#242B35] border-[#2F3743] text-white placeholder:text-white/35 focus-visible:ring-purple-500/40";

/** Primary action. Matches the Submit button on Manual Deposit. */
export const BTN_PRIMARY =
  "bg-purple-600 hover:bg-purple-700 text-white border-0";

/** Secondary action. */
export const BTN_SECONDARY =
  "border-[#2F3743] bg-[#242B35] text-white/80 hover:bg-[#2C3441] hover:text-white";

/** Destructive-ish action: refusing a card is not a delete, but it is a no. */
export const BTN_DANGER =
  "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200";

/** Accent, used for icons and links. */
export const ACCENT = "text-[#C05CFF]";

export const TEXT_MUTED = "text-white/55";
export const TEXT_FAINT = "text-white/40";
