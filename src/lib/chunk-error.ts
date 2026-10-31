/**
 * Recovery for version skew — the failure that looks like "the CSS/JS broke
 * after a deploy".
 *
 * The shape of it: a browser is holding the HTML from build N. That HTML names
 * chunks by content hash (`_next/static/chunks/<hash>.js`), which is correct
 * and is what lets those files be cached forever. Then build N+1 ships, the
 * container is replaced, and build N's files no longer exist on disk. The next
 * client-side navigation asks for a hash that 404s, the dynamic import
 * rejects, and — with no boundary and no handler — the app dies on a blank
 * screen that only a manual hard refresh clears.
 *
 * Reloading fixes it completely, because the reload fetches fresh HTML naming
 * the chunks that DO exist. So the whole job here is: recognise that specific
 * failure, and reload once.
 *
 * The reason this needs a guard at all is the case where reloading does NOT
 * fix it — a genuinely broken deploy serving 404s for every chunk. Left
 * unguarded, that turns one blank screen into an infinite reload loop, which
 * is strictly worse: it burns the user's data, hammers the origin, and hides
 * the error UI that would have told them what happened. Hence the counter
 * below: at most two reloads in a ten-minute window. A real skew needs exactly
 * one; the second is the safety net; the third never happens.
 */

/**
 * The wording browsers use for a chunk that would not load. Deliberately
 * pattern-matched rather than checked by class: the failure arrives as a
 * webpack `ChunkLoadError`, a native `TypeError` from a failed dynamic import,
 * or a bare string, and the text differs per engine.
 *
 * The MIME-type entries are the same failure seen through a different server:
 * when a missing asset is answered with an HTML error page instead of a 404,
 * the browser rejects the module on content type rather than status.
 */
const CHUNK_ERROR_PATTERNS: RegExp[] = [
  /ChunkLoadError/i,
  /Loading chunk [^\s]+ failed/i,
  /Loading CSS chunk [^\s]+ failed/i,
  // Chrome / Firefox, native ESM dynamic import.
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  // Safari, same cause.
  /Importing a module script failed/i,
  // A 404 answered with an HTML body.
  /Expected a JavaScript(?:-or-Wasm)? module script/i,
  /is not a valid JavaScript MIME type/i,
];

/** Everything Next emits with a content hash lives under this prefix. */
const HASHED_ASSET_PREFIX = "/_next/static/";

const matchesChunkText = (text: string): boolean =>
  CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text));

/**
 * Is this the version-skew failure, as opposed to any of the ordinary runtime
 * errors an error boundary also catches?
 *
 * This has to be narrow. A false positive reloads the page out from under a
 * user who hit a normal bug — losing whatever they had typed and showing them
 * nothing about what went wrong — so anything not clearly a chunk fetch is
 * left alone to reach the error UI.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "string") return matchesChunkText(error);

  if (error instanceof Error) {
    return matchesChunkText(`${error.name}: ${error.message}`);
  }

  // Not an Error instance — a plain rejection value, or an Error that crossed a
  // realm boundary and failed `instanceof`. Read the same two fields by hand.
  if (typeof error === "object") {
    const { name, message } = error as { name?: unknown; message?: unknown };
    const text = [name, message].filter((v) => typeof v === "string").join(": ");
    if (text) return matchesChunkText(text);
  }

  return false;
}

/**
 * Did a `<script>` or `<link>` for one of our hashed assets fail to load?
 *
 * These failures never surface as an exception. The browser fires an `error`
 * event on the element itself, and that event does not bubble — it is only
 * observable during the capture phase on `window`, with no message attached.
 * So this is matched on the element and its URL rather than on any text.
 */
export function isHashedAssetLoadFailure(target: EventTarget | null): boolean {
  if (!target) return false;

  const url =
    target instanceof HTMLScriptElement
      ? target.src
      : target instanceof HTMLLinkElement
        ? target.href
        : null;

  if (!url) return false;

  try {
    const parsed = new URL(url, window.location.href);
    // Same-origin only. A third-party SDK failing to load is a different
    // problem with a different answer, and reloading will not help it.
    if (parsed.origin !== window.location.origin) return false;
    return parsed.pathname.startsWith(HASHED_ASSET_PREFIX);
  } catch {
    return false;
  }
}

const RELOAD_STATE_KEY = "wulf-admin:chunk-reload";
/** Reload budget window. See the file header for why a budget exists. */
const RELOAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_RELOADS_PER_WINDOW = 2;

type ReloadState = { at: number; n: number };

/**
 * sessionStorage, not localStorage: the budget should be per tab and should die
 * with the tab. Every access is wrapped because storage throws outright when
 * cookies are blocked, and a thrown storage read must not become the reason the
 * recovery does not run.
 */
const readState = (): ReloadState | null => {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReloadState>;
    if (typeof parsed?.at !== "number" || typeof parsed?.n !== "number") return null;
    return { at: parsed.at, n: parsed.n };
  } catch {
    return null;
  }
};

const writeState = (state: ReloadState): void => {
  try {
    window.sessionStorage.setItem(RELOAD_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable. Losing the budget is survivable; refusing to reload
    // is not, so this is swallowed and the reload proceeds.
  }
};

/**
 * Reload once to pick up the current build.
 *
 * Returns whether a reload was actually started, so a caller can fall back to
 * showing its error UI when the budget is spent.
 */
export function recoverFromChunkError(): boolean {
  if (typeof window === "undefined") return false;

  const now = Date.now();
  const state = readState();
  const inWindow = state !== null && now - state.at < RELOAD_WINDOW_MS;
  const used = inWindow ? state.n : 0;

  if (used >= MAX_RELOADS_PER_WINDOW) return false;

  writeState({ at: inWindow ? state.at : now, n: used + 1 });
  window.location.reload();
  return true;
}
