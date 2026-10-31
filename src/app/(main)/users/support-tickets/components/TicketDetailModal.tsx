"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, ShieldAlert, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  supportApi,
  ACCOUNT_CHANGING_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_STYLES,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
} from "@/api/support/support.api";
import { usePermissions } from "@/hooks/user-permissions";
import { connectSocket, onSocketInstance } from "@/lib/socket";

const PRIORITIES: TicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

/**
 * One ticket: the thread, the reply box, and the decision.
 *
 * Staff see internal notes here; the player-facing endpoints filter them out
 * server-side, so what is rendered as "internal" genuinely never reaches them.
 */
export default function TicketDetailModal({
  ticketId,
  onClose,
  onChanged,
}: {
  ticketId: string;
  onClose: () => void;
  onChanged?: (t: TicketDetail) => void;
}) {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canDecide = isSuperAdmin || hasPermission("support:decisions");

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const [decision, setDecision] = useState<TicketStatus | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionReply, setDecisionReply] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supportApi
      .get(ticketId)
      .then((t) => alive && setTicket(t))
      .catch(() => alive && toast.error("Could not load this ticket."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ticketId]);

  /**
   * Live thread, for the ticket THIS modal has open.
   *
   * Without it an agent watching a thread sees nothing until they close and
   * reopen — which is exactly the moment a player is typing at them. The queue
   * behind the modal refreshes on the same events, but that only moves the row.
   *
   * Bound through `onSocketInstance` because a re-auth swaps the underlying
   * socket, and a handler left on the old one goes quiet without erroring.
   *
   * Staff see everything, internal notes included, so unlike the player side
   * there is nothing to filter here.
   */
  useEffect(() => {
    const bind = (s: any) => {
      if (!s) return () => { };

      const onMessage = (msg: any) => {
        if (msg?.ticketId !== ticketId) return;
        setTicket((current) => {
          if (!current) return current;
          // The socket echo of a reply this tab just posted arrives after the
          // response already appended it.
          if (current.messages.some((m) => m.id === msg.id)) return current;
          return { ...current, messages: [...current.messages, msg] };
        });
      };

      const onUpdated = (update: any) => {
        if (update?.id !== ticketId) return;
        setTicket((current) =>
          current
            ? {
              ...current,
              status: update.status ?? current.status,
              priority: update.priority ?? current.priority,
              resolutionNote: update.resolutionNote ?? current.resolutionNote,
            }
            : current
        );
      };

      s.on("support:ticket_message", onMessage);
      s.on("support:ticket_updated", onUpdated);
      return () => {
        s.off("support:ticket_message", onMessage);
        s.off("support:ticket_updated", onUpdated);
      };
    };

    let detach = bind(connectSocket());
    const off = onSocketInstance((next: any) => {
      detach();
      detach = bind(next);
    });

    return () => {
      detach();
      off();
    };
  }, [ticketId]);

  const apply = (t: TicketDetail) => {
    setTicket(t);
    onChanged?.(t);
  };

  const submitReply = async () => {
    if (!reply.trim()) return;
    setBusy("reply");
    try {
      apply(await supportApi.reply(ticketId, reply.trim(), isInternal));
      setReply("");
      toast.success(isInternal ? "Note added." : "Reply sent.");
    } catch {
      toast.error("Could not send that.");
    } finally {
      setBusy(null);
    }
  };

  const submitDecision = async () => {
    if (!decision) return;
    if (decision === "REJECTED" && !decisionNote.trim()) {
      toast.error("A rejection needs a reason.");
      return;
    }
    setBusy("decide");
    try {
      apply(
        await supportApi.decide(ticketId, {
          status: decision,
          note: decisionNote.trim() || undefined,
          reply: decisionReply.trim() || undefined,
        })
      );
      setDecision(null);
      setDecisionNote("");
      setDecisionReply("");
      toast.success("Decision recorded.");
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Could not record that decision."
      );
    } finally {
      setBusy(null);
    }
  };

  const changePriority = async (p: TicketPriority) => {
    setBusy("priority");
    try {
      apply(await supportApi.setPriority(ticketId, p));
    } catch {
      toast.error("Could not change priority.");
    } finally {
      setBusy(null);
    }
  };

  const accountChanging =
    !!ticket && ACCOUNT_CHANGING_CATEGORIES.includes(ticket.category);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#191D24]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-[#B93DEB]">
                {ticket?.reference ?? "…"}
              </span>
              {ticket && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TICKET_STATUS_STYLES[ticket.status].cls}`}
                >
                  {TICKET_STATUS_STYLES[ticket.status].label}
                </span>
              )}
              {ticket && (
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                  {TICKET_CATEGORY_LABELS[ticket.category]}
                </span>
              )}
            </div>
            <h3 className="mt-1 truncate text-base font-semibold text-white">
              {ticket?.subject ?? ""}
            </h3>
            {ticket?.player && (
              <p className="mt-0.5 truncate text-xs text-white/50">
                {ticket.player.username || ticket.player.entity || ticket.userId}
                {ticket.player.rgStatus &&
                  ticket.player.rgStatus !== "ACTIVE" && (
                    <span className="ml-2 text-amber-300">
                      · {ticket.player.rgStatus}
                    </span>
                  )}
                {!ticket.player.isActive && (
                  <span className="ml-2 text-red-300">· account disabled</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !ticket ? (
            <p className="py-12 text-center text-white/60">
              This ticket could not be loaded.
            </p>
          ) : (
            <div className="space-y-3">
              {ticket.messages.map((m) => {
                if (m.authorType === "SYSTEM") {
                  return (
                    <p
                      key={m.id}
                      className="py-1 text-center text-[11px] text-white/40"
                    >
                      {m.body} · {fmt(m.createdAt)}
                    </p>
                  );
                }
                const staff = m.authorType === "STAFF";
                return (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-xl border p-3 ${
                      staff
                        ? "ml-auto border-[#B93DEB]/30 bg-[#B93DEB]/10"
                        : "border-white/10 bg-[#0F141E]"
                    } ${m.isInternal ? "border-dashed border-amber-500/40 bg-amber-500/5" : ""}`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-white/50">
                      <span className="font-semibold text-white/70">
                        {m.authorName || (staff ? "Support" : "Player")}
                      </span>
                      {m.isInternal && (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Lock className="h-3 w-3" /> internal
                        </span>
                      )}
                      <span>{fmt(m.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-white/90">
                      {m.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        {ticket && (
          <div className="border-t border-white/10 bg-[#161A21] p-4">
            {decision ? (
              <div className="space-y-3">
                {accountChanging && decision === "RESOLVED" && (
                  <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {ticket.category === "ACCOUNT_REACTIVATION"
                        ? "Resolving this lifts the player's self-exclusion and reopens their account immediately."
                        : "Resolving this switches the player's account back on immediately."}
                    </span>
                  </div>
                )}
                <textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder={
                    decision === "REJECTED"
                      ? "Reason for rejection (required, internal)"
                      : "Internal note (optional)"
                  }
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-[#242B35] p-2 text-sm text-white outline-none focus:border-[#B93DEB]"
                />
                <textarea
                  value={decisionReply}
                  onChange={(e) => setDecisionReply(e.target.value)}
                  placeholder="Message the player will see (optional)"
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-[#242B35] p-2 text-sm text-white outline-none focus:border-[#B93DEB]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDecision(null)}
                    className="rounded-lg bg-[#3A4150] px-4 py-2 text-sm font-semibold text-white hover:bg-[#454d5e]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDecision}
                    disabled={
                      busy === "decide" ||
                      (decision === "REJECTED" && !decisionNote.trim())
                    }
                    className="rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a32fd4] disabled:opacity-50"
                  >
                    {busy === "decide" ? "Saving…" : `Confirm ${decision}`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={
                    isInternal
                      ? "Internal note — the player will not see this"
                      : "Reply to the player…"
                  }
                  rows={2}
                  className={`w-full rounded-lg border bg-[#242B35] p-2 text-sm text-white outline-none focus:border-[#B93DEB] ${
                    isInternal ? "border-amber-500/40" : "border-white/10"
                  }`}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="accent-[#B93DEB]"
                      />
                      Internal note
                    </label>
                    <select
                      value={ticket.priority}
                      onChange={(e) =>
                        changePriority(e.target.value as TicketPriority)
                      }
                      disabled={busy === "priority"}
                      className="rounded-lg border border-white/10 bg-[#242B35] px-2 py-1 text-xs text-white outline-none"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={submitReply}
                      disabled={!reply.trim() || busy === "reply"}
                      className="rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a32fd4] disabled:opacity-50"
                    >
                      {busy === "reply" ? "Sending…" : "Send"}
                    </button>
                    {ticket.isOpen &&
                      (canDecide ? (
                        <>
                          <button
                            onClick={() => setDecision("RESOLVED")}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => setDecision("REJECTED")}
                            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        // Shown rather than hidden: an agent who cannot decide
                        // should know the decision exists and who to ask,
                        // instead of wondering where the button went.
                        <span className="self-center text-xs text-white/40">
                          Resolving needs the Support Decisions permission
                        </span>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
