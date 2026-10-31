"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { connectSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import {
  agentPaymentApi,
  AgentPaymentRequest,
  AgentPaymentStatus,
} from "@/api/agent-payment/agent-payment.api";

const OPEN_STATUSES: string[] = [
  AgentPaymentStatus.PENDING_AGENT,
  AgentPaymentStatus.AGENT_APPROVED,
  AgentPaymentStatus.PENDING_ADMIN,
  AgentPaymentStatus.ADMIN_APPROVED,
];
const NOTIFY_STATUSES: string[] = [
  AgentPaymentStatus.COMPLETED,
  AgentPaymentStatus.REJECTED_BY_ADMIN,
];
/** Cap per check so a backlog (agent away for a while) isn't a toast wall. */
const MAX_TOASTS_PER_CHECK = 3;

type SeenMap = Record<string, string>;

const storageKey = (userId: string) => `agent-payout-seen:${userId}`;

function readSeen(userId: string): SeenMap | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as SeenMap) : null;
  } catch {
    return null;
  }
}

function writeSeen(userId: string, seen: SeenMap) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(seen));
  } catch {
    // storage unavailable — worst case a toast repeats on next load
  }
}

/**
 * Tells the agent / sub-agent when one of THEIR payout requests is settled
 * (Breeze or Coinflow) or rejected by admin. Mounted in the agent layout.
 *
 * It used to toast only on the live `agent-payment:updated` socket event, which
 * misses the usual case: the payout completes while the agent is on the
 * provider's tab (event lands in a background tab, the toast expires unseen) or
 * during the return redirect (event fires before the page is listening). So
 * this toasts every settled request the server hasn't marked as announced
 * (requesterNotifiedAt), then acknowledges it — so a new browser never repeats
 * an old one. Re-checks on load, on the socket event, when the tab becomes
 * visible, and every 30s while a request is still open.
 */
export function PayoutStatusToaster() {
  const userId = useAuthStore((s) => s.user?.id);
  const hasOpenRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let checking = false;

    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const rows: AgentPaymentRequest[] =
          (await agentPaymentApi.myRequests()).data || [];
        if (!alive) return;
        hasOpenRef.current = rows.some((r) => OPEN_STATUSES.includes(r.status));

        // The server is the source of truth for "already announced"
        // (requesterNotifiedAt), so a new browser or device doesn't repeat old
        // settlements. localStorage only stops two open tabs both toasting the
        // same row before the acknowledgement lands.
        const next: SeenMap = { ...(readSeen(userId) ?? {}) };
        const toAck: string[] = [];
        let shown = 0;
        for (const r of rows) {
          if (!NOTIFY_STATUSES.includes(r.status) || r.requesterNotifiedAt) continue;
          toAck.push(r.id);
          if (next[r.id] === r.status) continue; // another tab already toasted
          next[r.id] = r.status;
          if (shown >= MAX_TOASTS_PER_CHECK) continue;
          shown += 1;
          const amount = Number(r.amount ?? 0).toFixed(2);
          const provider = (r.paymentDetails as any)?.provider;
          const via =
            provider === "BREEZE" ? " via Breeze" : provider === "COINFLOW" ? " via Coinflow" : "";
          if (r.status === AgentPaymentStatus.COMPLETED) {
            toast.success(
              `Your payout of ${amount}${via} has been processed successfully.`,
              { id: `payout-${r.id}-done`, duration: 8000 },
            );
          } else {
            toast.error(
              `Your payout of ${amount} was rejected by admin. The amount is back in your balance.`,
              { id: `payout-${r.id}-rejected`, duration: 8000 },
            );
          }
        }
        if (toAck.length) {
          // Best effort — if it fails, the local seen map still stops a repeat here.
          void agentPaymentApi.ackNotified(toAck).catch(() => undefined);
        }
        writeSeen(userId, next);
      } catch {
        // best effort — try again on the next trigger
      } finally {
        checking = false;
      }
    };

    void check();

    const socket = connectSocket();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onUpdated = () => {
      clearTimeout(debounce);
      // Let the server finish the commit + readiness before refetching.
      debounce = setTimeout(() => void check(), 800);
    };
    socket.on("agent-payment:updated", onUpdated);

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    const poll = setInterval(() => {
      if (hasOpenRef.current) void check();
    }, 30000);

    return () => {
      alive = false;
      clearTimeout(debounce);
      clearInterval(poll);
      socket.off("agent-payment:updated", onUpdated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return null;
}
