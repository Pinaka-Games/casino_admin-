/**
 * Getting an agent back into the panel after Coinflow's hosted page.
 *
 * The hosted Coinflow withdraw page opens in a SEPARATE TAB, and once the agent
 * finishes adding a bank account Coinflow navigates that tab to whatever
 * `bankAccountLinkRedirect` was minted with. It used to be an unconfigured
 * server default that resolved to Google, so the agent was dropped on an
 * unrelated site with their payout half-finished. The panel now names its own
 * return route, and this module is the one place that route, its channel and
 * its payload are described.
 *
 * The returning tab cannot rely on `window.opener`: Coinflow is cross-origin and
 * may sever the opener with COOP. A BroadcastChannel (plus a localStorage ping
 * for browsers without one) reaches the original tab regardless.
 */

export const COINFLOW_RETURN_PATH = "/payout-return";
export const COINFLOW_RETURN_CHANNEL = "coinflow-payout-return";
/** Written to localStorage so a `storage` event wakes tabs with no channel. */
export const COINFLOW_RETURN_PING_KEY = "coinflow:payout-return";

export interface CoinflowReturnSignal {
  source: typeof COINFLOW_RETURN_CHANNEL;
  status: "success" | "failed";
}

/**
 * Where Coinflow should send the agent once they finish linking. Carries `next`
 * so the return tab can offer a way back to the exact page they started from
 * when it cannot close itself.
 */
export function buildCoinflowReturnUrl(
  status: "success" | "failed" = "success",
): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = new URL(COINFLOW_RETURN_PATH, window.location.origin);
  url.searchParams.set("status", status);
  url.searchParams.set("next", window.location.href);
  return url.toString();
}

/** Tell any other panel tab that the agent came back from Coinflow. */
export function announceCoinflowReturn(status: "success" | "failed"): void {
  if (typeof window === "undefined") return;
  const signal: CoinflowReturnSignal = {
    source: COINFLOW_RETURN_CHANNEL,
    status,
  };

  try {
    const channel = new BroadcastChannel(COINFLOW_RETURN_CHANNEL);
    channel.postMessage(signal);
    channel.close();
  } catch {
    /* no BroadcastChannel — the storage ping below still fires */
  }

  try {
    // The value has to change for a `storage` event to fire in other tabs.
    window.localStorage.setItem(
      COINFLOW_RETURN_PING_KEY,
      `${status}:${Date.now()}`,
    );
  } catch {
    /* storage blocked — the waiter's own poll still catches up */
  }

  try {
    window.opener?.postMessage(signal, window.location.origin);
  } catch {
    /* opener severed by Coinflow's COOP — expected, not an error */
  }
}

/**
 * Run `onReturn` when a Coinflow tab reports back. Returns an unsubscribe.
 * Every channel is wired because each one fails in a different browser: the
 * opener message needs a surviving opener, the storage event needs storage, and
 * BroadcastChannel needs a same-origin tab that is still open.
 */
export function onCoinflowReturn(onReturn: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const isSignal = (data: unknown): boolean =>
    !!data &&
    typeof data === "object" &&
    (data as CoinflowReturnSignal).source === COINFLOW_RETURN_CHANNEL;

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(COINFLOW_RETURN_CHANNEL);
    channel.onmessage = (event) => {
      if (isSignal(event.data)) onReturn();
    };
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === COINFLOW_RETURN_PING_KEY && event.newValue) onReturn();
  };
  const onMessage = (event: MessageEvent) => {
    if (event.origin === window.location.origin && isSignal(event.data)) {
      onReturn();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("message", onMessage);
    try {
      channel?.close();
    } catch {
      /* already closed */
    }
  };
}
