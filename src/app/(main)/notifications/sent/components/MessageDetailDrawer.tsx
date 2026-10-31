"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination";
import {
  getMessageRecipients,
  resendFailed,
  sortAudiences,
  type AdminMessage,
  type AdminMessageRecipientRow,
  type MessageAudience,
  type MessageRecipientStatus,
} from "@/api/messaging/messaging.api";
import { getApiErrorMessage } from "@/api/messaging/error-message";

interface Props {
  message: AdminMessage | null;
  onClose: () => void;
  /** Called after a resend, so the parent list picks up the new counts. */
  onChanged: () => void;
}

const RECIPIENT_STATUSES: { label: string; value: MessageRecipientStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Sent", value: "SENT" },
  { label: "Failed", value: "FAILED" },
  { label: "Skipped", value: "SKIPPED" },
  { label: "Pending", value: "PENDING" },
];

/** Badge colour + short label per pool, matching the compose screen. */
const AUDIENCE_BADGE: Record<MessageAudience, string> = {
  AGENT: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  SUBAGENT: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  EMPLOYEE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  PLAYER: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

const AUDIENCE_SHORT: Record<MessageAudience, string> = {
  AGENT: "Agent",
  SUBAGENT: "Sub",
  EMPLOYEE: "Staff",
  PLAYER: "Player",
};

const statusClass = (status: string) => {
  switch (status) {
    case "SENT":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "FAILED":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "SKIPPED":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    default:
      return "bg-gray-500/15 text-gray-300 border-gray-500/30";
  }
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

/**
 * Detail view for one send: exactly what went out, and what happened to each
 * recipient.
 *
 * The body is rendered the way the recipient received it — mail as HTML on a
 * white sheet, in-app as the notification card — because "what did we actually
 * say" is the question this panel exists to answer.
 */
export default function MessageDetailDrawer({
  message,
  onClose,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<"preview" | "recipients">("preview");
  const [rows, setRows] = useState<AdminMessageRecipientRow[]>([]);
  const [aggregateOnly, setAggregateOnly] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [status, setStatus] = useState<MessageRecipientStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const messageId = message?.id;

  const loadRecipients = useCallback(async () => {
    if (!messageId) return;
    setLoading(true);
    try {
      const res = await getMessageRecipients(messageId, {
        status,
        search,
        page,
        limit: 25,
      });
      setRows(res.data);
      setAggregateOnly(res.aggregateOnly);
      setNote(res.note);
      setTotalPages(res.totalPages);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load recipients"));
    } finally {
      setLoading(false);
    }
  }, [messageId, status, search, page]);

  // Reset per-message state when a different row is opened.
  useEffect(() => {
    setTab("preview");
    setStatus("");
    setSearch("");
    setPage(1);
  }, [messageId]);

  useEffect(() => {
    if (tab === "recipients") void loadRecipients();
  }, [tab, loadRecipients]);

  const handleResend = async () => {
    if (!messageId) return;
    setResending(true);
    try {
      const result = await resendFailed(messageId);
      if (result.retried === 0) {
        toast("Nothing to retry — no failed recipients");
      } else {
        toast.success(`Retried ${result.retried}: ${result.sent} sent, ${result.failed} failed`);
      }
      await loadRecipients();
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Resend failed"));
    } finally {
      setResending(false);
    }
  };

  if (!message) return null;

  const isMail = message.channel === "MAIL";
  // In-app notifications are persisted the moment they are created, so only
  // the contact channels have anything to retry.
  const canResend =
    message.channel !== "MESSAGE" &&
    !message.aggregateOnly &&
    message.failedCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      <aside className="relative w-full max-w-2xl h-full bg-[#15181E] border-l border-[#242B35] flex flex-col">
        <header className="px-5 py-4 border-b border-[#242B35] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              {message.channel === "MAIL"
                ? "Email"
                : message.channel === "SMS"
                  ? "SMS"
                  : "In-app message"}{" "}
              ·{" "}
              {sortAudiences(message.audiences ?? [])
                .map((a) => AUDIENCE_SHORT[a] ?? a)
                .join(" + ")}{" "}
              · {message.mode}
            </p>
            <h2 className="text-white text-base font-semibold truncate">
              {message.subject}
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {message.senderName ?? "—"} · {formatDate(message.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="grid grid-cols-4 gap-px bg-[#242B35] shrink-0">
          {[
            { label: "Recipients", value: message.totalRecipients },
            { label: "Sent", value: message.sentCount },
            { label: "Failed", value: message.failedCount },
            { label: "Skipped", value: message.skippedCount },
          ].map((s) => (
            <div key={s.label} className="bg-[#191D24] px-4 py-3">
              <p className="text-gray-500 text-[11px]">{s.label}</p>
              <p className="text-white text-lg">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="px-5 pt-4 flex items-center gap-2 shrink-0">
          {(["preview", "recipients"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                tab === t
                  ? "bg-[#B93DEB] text-white"
                  : "bg-[#242B35] text-gray-300 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
          {canResend && (
            <Button
              onClick={handleResend}
              disabled={resending}
              className="ml-auto h-9 bg-purple-500 hover:bg-purple-600 text-white"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${resending ? "animate-spin" : ""}`}
              />
              Resend failed
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "preview" ? (
            <>
              {isMail ? (
                <div className="rounded-lg overflow-hidden border border-[#242B35]">
                  <div className="bg-[#242B35] px-4 py-2 text-xs text-gray-400">
                    Subject: <span className="text-white">{message.subject}</span>
                  </div>
                  {/* Bodies are sanitized server-side before storage, so this
                      renders the delivered HTML rather than a re-render of it. */}
                  <div
                    className="bg-white text-black px-4 py-3 text-sm [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5"
                    dangerouslySetInnerHTML={{ __html: message.body }}
                  />
                </div>
              ) : (
                <div className="bg-[#15181d] border-l-2 border-[#B93DEB] rounded-lg px-4 py-3">
                  <p className="text-white font-semibold text-sm break-words">
                    {message.subject}
                  </p>
                  <p className="text-gray-300 text-[13px] mt-1 whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                </div>
              )}

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs">Status</dt>
                  <dd className="text-white">{message.status}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs">Channel</dt>
                  <dd className="text-white">
                    {message.channel === "MAIL"
                      ? "Email"
                      : message.channel === "SMS"
                        ? "SMS"
                        : "In-app message"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs">Expires</dt>
                  <dd className="text-white">{formatDate(message.expiresAt)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs">Sent by</dt>
                  <dd className="text-white">{message.senderName ?? "—"}</dd>
                </div>
              </dl>

              {message.errorSample && message.errorSample.length > 0 && (
                <div className="mt-5">
                  <p className="text-gray-400 text-xs mb-2">Failure sample</p>
                  <ul className="space-y-1">
                    {message.errorSample.map((e, i) => (
                      <li
                        key={i}
                        className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-3 py-2"
                      >
                        {e.address ? `${e.address}: ` : ""}
                        {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  placeholder="Search recipient or address"
                  className="h-9 flex-1 min-w-[200px] bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm outline-none"
                />
                {RECIPIENT_STATUSES.map((s) => (
                  <button
                    key={s.value || "all"}
                    onClick={() => {
                      setPage(1);
                      setStatus(s.value);
                    }}
                    className={`px-3 py-1.5 rounded text-xs transition-colors ${
                      status === s.value
                        ? "bg-[#B93DEB] text-white"
                        : "bg-[#242B35] text-gray-300 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {aggregateOnly ? (
                <p className="text-gray-400 text-sm bg-[#191D24] rounded-lg p-4">
                  {note ??
                    "Whole-audience send — per-recipient rows are not stored."}
                </p>
              ) : loading ? (
                <p className="text-gray-500 text-sm p-4">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="text-gray-500 text-sm p-4">No recipients match.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-[#242B35] overflow-hidden">
                    {rows.map((r, i) => (
                      <div
                        key={r.id}
                        className={`flex items-center gap-3 px-4 py-2.5 ${
                          i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm truncate">
                            {r.recipientName ?? r.recipientId}
                          </p>
                          <p className="text-gray-500 text-xs truncate">
                            {r.address ?? "in-app"}
                            {r.errorReason ? ` · ${r.errorReason}` : ""}
                          </p>
                        </div>
                        {/* Which pool this recipient came from — a send can
                            span several, so the name alone is ambiguous. */}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${AUDIENCE_BADGE[r.recipientType]}`}
                        >
                          {AUDIENCE_SHORT[r.recipientType] ?? r.recipientType}
                        </span>
                        <span className="text-gray-500 text-xs shrink-0">
                          {formatDate(r.sentAt)}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${statusClass(r.status)}`}
                        >
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
