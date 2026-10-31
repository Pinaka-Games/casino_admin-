"use client";

import { useEffect, useState } from "react";
import api from "@/api/config/axios.config";
import { connectSocket } from "@/lib/socket";
import type {
  PaymentAudience,
  PaymentAvailability,
  PaymentDirection,
  PaymentGatewayKey,
} from "@/types/system-config";

/**
 * Which payment gateways the admin currently offers (Settings → Payment
 * Manager), for the agent-facing flows in this app: the payout request modal
 * and the agent package checkout.
 *
 * Cached in a module so the several modals that need it don't each fire the
 * same request, and refreshed live from the `payment_methods_updated` socket
 * event so a change in Payment Manager reflects without a reload.
 *
 * Defaults to BOTH gateways available: this only decides which buttons to draw
 * and the request itself is gated server-side. Failing open shows a button that
 * may then be refused; failing closed would hide payouts entirely over a
 * transient network error, which is far worse.
 */
export type GatewayAvailability = Record<PaymentGatewayKey, boolean>;

const ALL_AVAILABLE: GatewayAvailability = { coinflow: true, breeze: true };

const CACHE_TTL_MS = 30_000;
let cache: PaymentAvailability | null = null;
let cacheAt = 0;
let inflight: Promise<PaymentAvailability | null> | null = null;

const subscribers = new Set<(value: PaymentAvailability | null) => void>();

const publish = (value: PaymentAvailability | null) => {
  cache = value;
  cacheAt = Date.now();
  subscribers.forEach((notify) => notify(value));
};

function load(force = false): Promise<PaymentAvailability | null> {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) {
    return Promise.resolve(cache);
  }
  if (!inflight) {
    inflight = api
      .get<PaymentAvailability>("/system-config/payment-methods/availability")
      .then((res) => {
        publish(res.data);
        return res.data;
      })
      // Keep the last good answer on a transient failure.
      .catch(() => cache)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function usePaymentAvailability(
  audience: PaymentAudience,
  direction: PaymentDirection,
): GatewayAvailability {
  const [availability, setAvailability] = useState<PaymentAvailability | null>(
    cache,
  );

  useEffect(() => {
    let cancelled = false;

    const notify = (value: PaymentAvailability | null) => {
      if (!cancelled) setAvailability(value);
    };
    subscribers.add(notify);
    void load().then(notify);

    const socket = connectSocket();
    const handleUpdate = (payload: PaymentAvailability) => {
      // The event carries the whole map, so trust it rather than round-tripping
      // to the API on every admin save.
      if (payload?.player && payload?.agent) {
        publish(payload);
        return;
      }
      void load(true);
    };
    // A save that happened while this tab was disconnected produced an event
    // nobody received; the cache is only refreshed on mount, so a long-open
    // dashboard would keep the stale answer. Re-sync on every (re)connect.
    const handleConnect = () => {
      void load(true).then(notify);
    };

    socket.on("payment_methods_updated", handleUpdate);
    socket.on("connect", handleConnect);

    return () => {
      cancelled = true;
      subscribers.delete(notify);
      socket.off("payment_methods_updated", handleUpdate);
      socket.off("connect", handleConnect);
    };
  }, []);

  return availability?.[audience]?.[direction] ?? ALL_AVAILABLE;
}
