/**
 * Shared responsive class strings for the agent / sub-agent module.
 *
 * Mobile-first: every constant's base value targets phones and re-pins the
 * current desktop value at `md:`/`lg:`, so desktop rendering stays identical to
 * what it was before. Nothing here is imported by the admin module.
 */

/**
 * Page shell. Replaces the old `h-screen flex flex-col p-6 overflow-hidden`,
 * which trapped content below the fold on mobile: the agent layout already owns
 * a 64px sticky header, so `h-screen` overflowed the viewport by exactly that
 * much and `overflow-hidden` made the last rows and the pagination bar
 * unreachable. Below `md` the page flows and the document scrolls; from `md` up
 * the original fixed-height / inner-scroll behaviour is restored.
 *
 * The `min-h` only paints background — it must NOT be allowed to stretch the
 * cards inside it. That stretch was what put a few hundred px of dead space
 * under a one-row table with the pagination bar shoved to the bottom of the
 * screen. The fix is NOT to drop the floor — without it a short page ends
 * mid-screen and exposes the layout's darker backdrop as a colour seam. It is
 * to gate the grow chain: every `flex-1` / `min-h-0` inside these pages is
 * written `md:flex-1 md:min-h-0`.
 *
 * Both halves need the gate. `flex-1` is `flex: 1 1 0%`, so ungated it stretches
 * the card into dead space; and an explicit `min-h-0` drops the
 * `min-height: auto` floor that otherwise holds a flex item at its content
 * height, so ungated it collapses the card toward zero. Gated, the card sits at
 * content height on phones and keeps the desktop fill-and-scroll-inside
 * behaviour from `md` up.
 */
export const PAGE_SHELL =
  "flex flex-col justify-start bg-[#15181E] p-3 sm:p-4 md:p-6 min-h-[calc(100dvh-4rem)] md:h-[calc(100dvh-4rem)] md:overflow-hidden";

/**
 * Breadcrumb / title bar: title left, trailing status pill right, on ONE row at
 * every width.
 *
 * Stays `flex-row` on phones deliberately. Stacking put the pill on its own line
 * where, as a stretched column child, it spanned the full bar and read as a
 * banner rather than a badge. The title carries `min-w-0` (see PAGE_TITLE) so it
 * absorbs the squeeze and wraps instead of pushing the pill off the edge.
 */
export const PAGE_HEAD =
  "bg-[#191D24] mb-3 md:mb-4 px-3 md:px-4 py-2 rounded-lg shrink-0 flex flex-row items-center justify-between gap-2 md:gap-3";

/**
 * `min-w-0` is required: as a flex item the title keeps its auto min-width
 * otherwise, so a long breadcrumb refuses to wrap and shoves the trailing pill
 * out of the bar.
 */
export const PAGE_TITLE =
  "min-w-0 text-sm md:text-base font-normal text-white leading-snug";

/**
 * Search + filter + export row. Stays a SINGLE row at every width: the search
 * field flexes and the icon buttons sit to its right.
 *
 * `[&>*:not(:first-child)]:shrink-0` pins every trailing control at its natural
 * size so only the search (the first child) absorbs the squeeze. Doing it from
 * the parent rather than per-button is what lets shared controls like
 * `<ExportCSV>` — which the admin module also renders — participate without
 * being modified.
 */
export const TOOLBAR =
  "bg-[#191D24] rounded-lg p-2 flex flex-nowrap items-center gap-2 shrink-0 [&>*:not(:first-child)]:shrink-0";

/** Search field inside TOOLBAR — flexes and is allowed to shrink to fit. */
export const TOOLBAR_SEARCH = "relative flex-1 min-w-0 group";

/**
 * Horizontal-scroll shell for every pseudo-table / real table. `agent-x-scroll`
 * adds iOS momentum scrolling and stops the gesture chaining to the page.
 */
export const TABLE_SCROLL = "overflow-x-auto agent-x-scroll";

/** Summary KPI strip — two tiles per row on phones instead of one tall column. */
export const SUMMARY_GRID =
  "grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4";

/**
 * Modal backdrop. `overflow-y-auto` + `items-start sm:items-center` is what
 * keeps a modal taller than the viewport reachable on a phone: it scrolls the
 * backdrop instead of centring the shell and pushing its buttons off-screen.
 */
export const MODAL_BACKDROP =
  "fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto";

export const MODAL_BODY_PAD = "p-4 sm:p-6";

export const MODAL_MAX = "max-h-[92dvh] overflow-y-auto scrollbar-hide";

/** Pagination footer — stacks the "showing x of y" line above the pager. */
export const PAGINATION_BAR =
  "shrink-0 border-t border-gray-800 bg-[#191D24] px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 agent-safe-bottom";
