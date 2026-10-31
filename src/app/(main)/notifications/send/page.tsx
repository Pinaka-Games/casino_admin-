"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Check,
  Eye,
  History,
  Mail,
  MessageSquare,
  Smartphone,
  UserPlus,
  X,
} from "lucide-react";
import Image from "next/image";
import { logo } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RichTextEditor from "@/components/RichTextEditor";
import RecipientPickerModal from "./components/RecipientPickerModal";
import {
  getAudienceCount,
  sendMessage,
  recipientKey,
  sortAudiences,
  canReach,
  reachFor,
  AUDIENCE_ORDER,
  type AudienceCounts,
  type MessageAudience,
  type MessageChannel,
  type MessageMode,
  type RecipientOption,
} from "@/api/messaging/messaging.api";
import { getApiErrorMessage } from "@/api/messaging/error-message";

/**
 * Pools in canonical order (see AUDIENCE_ORDER) — players first, then the
 * staff hierarchy.
 */
const AUDIENCES: {
  key: MessageAudience;
  label: string;
  short: string;
  hint: string;
}[] = [
  { key: "PLAYER", label: "Players", short: "Player", hint: "Casino players in the user app" },
  { key: "AGENT", label: "Agents", short: "Agent", hint: "Affiliate agents" },
  { key: "SUBAGENT", label: "Sub-Agents", short: "Sub", hint: "Sub-agents under an agent" },
  { key: "EMPLOYEE", label: "Employees", short: "Staff", hint: "Internal staff accounts" },
];

/**
 * How wide the send goes.
 *
 * "One recipient" used to be its own mode, which only made the picker refuse a
 * second click — picking one person is just a selection of size one. The wire
 * still distinguishes SINGLE from BULK, so that is derived at send time.
 */
type SendScope = "PICK" | "ALL";

const SCOPES: { key: SendScope; label: string; hint: string }[] = [
  { key: "PICK", label: "Choose recipients", hint: "Hand-pick one or many across the selected groups" },
  { key: "ALL", label: "Everyone", hint: "Every member of the selected groups" },
];

/** Badge colour per pool, so a mixed recipient list stays readable at a glance. */
const AUDIENCE_BADGE: Record<MessageAudience, string> = {
  AGENT: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  SUBAGENT: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  EMPLOYEE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  PLAYER: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

const audienceShort = (audience: MessageAudience) =>
  AUDIENCES.find((a) => a.key === audience)?.short ?? audience;

const audienceLabel = (audience: MessageAudience) =>
  AUDIENCES.find((a) => a.key === audience)?.label ?? audience;

const MAX_MESSAGE = 2000;

/**
 * SMS cap, matching the server's.
 *
 * 160 GSM-7 characters is one billed segment; four is where the cost stops
 * being obvious and carriers start reassembling concatenations unreliably.
 */
const MAX_SMS = 640;
const SMS_SEGMENT = 160;

const CHANNELS: {
  key: MessageChannel;
  label: string;
  hint: string;
  icon: typeof MessageSquare;
}[] = [
  {
    key: "MESSAGE",
    label: "Message",
    hint: "In-app notification",
    icon: MessageSquare,
  },
  { key: "MAIL", label: "Mail", hint: "Email to their address", icon: Mail },
  { key: "SMS", label: "SMS", hint: "Text to their phone", icon: Smartphone },
];

/**
 * Chips shown in the compose column before collapsing into "+N more".
 *
 * The full list lives in the picker modal; this is a reminder of who is
 * selected, not a second place to manage them.
 */
const CHIP_PREVIEW_LIMIT = 12;

export default function SendNotificationPage() {
  const router = useRouter();

  const [channel, setChannel] = useState<MessageChannel>("MESSAGE");
  // Several pools at once — "Agents + Sub-Agents" is the common case, and
  // sending that twice was the old flow's biggest cost.
  const [audiences, setAudiences] = useState<MessageAudience[]>(["PLAYER"]);
  const [scope, setScope] = useState<SendScope>("PICK");

  // Browsing now lives in RecipientPickerModal; this screen only holds the
  // resulting selection.
  const [pickerOpen, setPickerOpen] = useState(false);

  // Selection holds full rows keyed by pool+id: the chip row must show a name
  // and mail-reachability for people no longer in the filtered list, and ids
  // are only unique within their own pool.
  const [selected, setSelected] = useState<RecipientOption[]>([]);

  const [counts, setCounts] = useState<AudienceCounts | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isMail = channel === "MAIL";
  const isSms = channel === "SMS";
  /** Both of these leave the app and so need a contact detail on file. */
  const isContactChannel = isMail || isSms;
  const audienceKey = audiences.join(",");

  // The API still separates a one-person send from a bulk one; the UI no longer
  // has to, so it is derived from what was actually picked.
  const mode: MessageMode =
    scope === "ALL" ? "ALL" : selected.length === 1 ? "SINGLE" : "BULK";

  // Local YYYY-MM-DD for the date input's `min`, so past days can't be picked.
  const todayStr = useMemo(() => {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  }, []);

  const toggleAudience = (audience: MessageAudience) => {
    setAudiences((prev) => {
      if (prev.includes(audience)) {
        // Never leave the send with no target — the last chip stays put.
        return prev.length === 1 ? prev : prev.filter((a) => a !== audience);
      }
      // Held in canonical order, so the summary line reads the same regardless
      // of the order the chips were clicked in.
      return sortAudiences([...prev, audience]);
    });
  };

  // Dropping a pool must drop anyone picked from it, or the send would carry
  // recipients the chips no longer claim (the API rejects that outright).
  useEffect(() => {
    setSelected((prev) => prev.filter((r) => audiences.includes(r.audience)));
  }, [audiences]);

  // Switching channel or mode invalidates the rest of the selection: a mail
  // send has a different reachable set than an in-app one.
  useEffect(() => {
    setSelected([]);
    setErrors({});
  }, [channel, scope]);

  // Blast radius, per pool and combined.
  useEffect(() => {
    let cancelled = false;
    getAudienceCount(audiences)
      .then((r) => !cancelled && setCounts(r))
      .catch(() => !cancelled && setCounts(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey]);

  /** How many are picked from each pool — shown on the audience chips. */
  const selectedByAudience = useMemo(() => {
    const map = new Map<MessageAudience, number>();
    selected.forEach((r) =>
      map.set(r.audience, (map.get(r.audience) ?? 0) + 1),
    );
    return map;
  }, [selected]);

  /**
   * Chips grouped by pool in canonical order, so a mixed selection reads as
   * "players, then agents, then …" rather than in click order.
   */
  const selectedSorted = useMemo(
    () =>
      [...selected].sort(
        (a, b) =>
          AUDIENCE_ORDER.indexOf(a.audience) -
            AUDIENCE_ORDER.indexOf(b.audience) ||
          a.username.localeCompare(b.username),
      ),
    [selected],
  );

  /** Selected recipients this channel cannot reach — no contact detail on file. */
  const unreachable = useMemo(
    () =>
      isContactChannel ? selected.filter((r) => !canReach(r, channel)) : [],
    [isContactChannel, channel, selected],
  );

  const validate = () => {
    const e: Record<string, string> = {};

    if (audiences.length === 0) e.audience = "Select at least one group";
    if (scope !== "ALL" && selected.length === 0) {
      e.recipient = "Select at least one recipient";
    }
    if (!subject.trim()) {
      e.subject = isMail ? "Subject is required" : "Title is required";
    }
    if (subject.length > 255) e.subject = "Must be 255 characters or fewer";
    if (!body.trim()) e.body = "Message body is required";

    if (
      isContactChannel &&
      scope !== "ALL" &&
      selected.length > 0 &&
      unreachable.length === selected.length
    ) {
      e.recipient = isSms
        ? "None of the selected recipients have a phone number"
        : "None of the selected recipients have an email address";
    }

    if (isSms && body.length > MAX_SMS) {
      e.body = `Must be ${MAX_SMS} characters or fewer`;
    }

    // A past expiry would create a notification the retention job deletes on
    // its next run. Compare on date only, so "today" is allowed.
    if (expiresAt) {
      const chosen = new Date(expiresAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen.getTime() < today.getTime()) {
        e.expiresAt = "Expiry date cannot be in the past";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isFormValid =
    !!subject.trim() &&
    !!body.trim() &&
    audiences.length > 0 &&
    (scope === "ALL" || selected.length > 0);

  const resetForm = () => {
    setSubject("");
    setBody("");
    setExpiresAt("");
    setSelected([]);
    setErrors({});
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await sendMessage({
        channel,
        audiences,
        mode,
        recipients:
          scope === "ALL"
            ? undefined
            : selected.map((r) => ({ id: r.id, audience: r.audience })),
        subject: subject.trim(),
        body,
        expiresAt: expiresAt || undefined,
        confirmAll: scope === "ALL" ? true : undefined,
      });

      if (result.queued) {
        toast.success(
          `Started — delivering to ~${result.totalRecipients} recipient(s) in the background`,
        );
      } else {
        toast.success(`Sent to ${result.sent} recipient(s)`);
      }

      // Skipped rows are a real outcome, not a detail: an admin who assumes
      // everyone was reached will not follow up with the ones who weren't.
      if (result.skipped) {
        toast(`${result.skipped} skipped (no email address on file)`);
      }
      if (result.failed) {
        toast.error(`${result.failed} failed — see Sent history for details`);
      }

      resetForm();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to send"));
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleSend = () => {
    if (!validate()) return;
    // An ALL send is not recoverable once delivered — make it a decision.
    if (scope === "ALL") {
      setConfirmOpen(true);
      return;
    }
    void submit();
  };

  const audiencesLabel = audiences.map(audienceLabel).join(" + ");

  const allCount = reachFor(counts ?? undefined, channel);
  /** How many of the audience this channel simply cannot reach. */
  const unreachableInAudience =
    counts && allCount !== null ? counts.count - allCount : 0;

  const recipientSummary =
    scope === "ALL"
      ? `Everyone in ${audiencesLabel}${allCount !== null ? ` (${allCount})` : ""}`
      : selected.length === 0
        ? "None selected"
        : selected.length === 1
          ? selected[0].username
          : `${selected.length} selected`;

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg flex items-center justify-between shrink-0">
        <h1 className="text-base font-normal text-white">
          Notifications / Compose
        </h1>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => router.push("/notifications/sent")}
        >
          <History className="w-4 h-4 mr-2" />
          Sent history
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4 overflow-hidden">
        {/* ── Left: channel, audiences, recipients ── */}
        <div className="bg-[#191D24] rounded-lg p-3 md:p-5 flex flex-col overflow-hidden">
          <Label className="text-white text-sm">Channel</Label>
          <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              const active = channel === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setChannel(c.key)}
                  title={c.hint}
                  className={`flex flex-col gap-1 px-3 py-3 rounded-lg text-left transition-colors border ${
                    active
                      ? "bg-[#B93DEB]/15 border-[#B93DEB] text-white"
                      : "bg-[#242B35] border-transparent text-gray-300 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${active ? "text-[#B93DEB]" : ""}`}
                  />
                  <span className="text-sm">{c.label}</span>
                  <span className="text-[11px] text-gray-400 leading-tight">
                    {c.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-white text-sm">
              Send to <span className="text-gray-500">(pick one or more)</span>
            </Label>
            <button
              onClick={() =>
                setAudiences(
                  audiences.length === AUDIENCES.length
                    ? ["PLAYER"]
                    : AUDIENCES.map((a) => a.key),
                )
              }
              className="text-[11px] text-[#B93DEB] hover:underline"
            >
              {audiences.length === AUDIENCES.length ? "Clear" : "Select all"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 mb-4">
            {AUDIENCES.map((a) => {
              const active = audiences.includes(a.key);
              const picked = selectedByAudience.get(a.key) ?? 0;
              const audienceTotal = counts?.byAudience?.[a.key];
              return (
                <button
                  key={a.key}
                  onClick={() => toggleAudience(a.key)}
                  title={a.hint}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors border ${
                    active
                      ? "bg-[#B93DEB]/15 border-[#B93DEB] text-white"
                      : "bg-[#242B35] border-transparent text-gray-300 hover:text-white"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                      active
                        ? "bg-[#B93DEB] border-[#B93DEB]"
                        : "border-[#4b5563]"
                    }`}
                  >
                    {active && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{a.label}</span>
                    <span className="block text-[11px] text-gray-400">
                      {scope !== "ALL" && picked > 0
                        ? `${picked} picked`
                        : audienceTotal
                          ? `${reachFor(audienceTotal, channel)} available`
                          : a.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.audience && (
            <p className="text-red-400 text-xs -mt-2 mb-2">{errors.audience}</p>
          )}

          <Label className="text-white text-sm">How many</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-4">
            {SCOPES.map((m) => (
              <button
                key={m.key}
                onClick={() => setScope(m.key)}
                title={m.hint}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  scope === m.key
                    ? "bg-purple-500 text-white"
                    : "bg-[#242B35] text-gray-300 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {scope === "ALL" ? (
            <div className="bg-[#242B35] rounded-lg p-3 md:p-4 text-sm text-gray-300">
              <p className="text-white font-semibold mb-2">
                {recipientSummary}
              </p>
              <div className="space-y-1 mb-2">
                {audiences.map((a) => {
                  const row = counts?.byAudience?.[a];
                  return (
                    <div
                      key={a}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="text-gray-400">{audienceLabel(a)}</span>
                      <span className="text-gray-200">
                        {row
                          ? isContactChannel
                            ? `${reachFor(row, channel)} reachable of ${row.count}`
                            : `${row.count}`
                          : "…"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-gray-400 text-[13px]">
                {isSms
                  ? "One text per recipient, billed per segment. Delivery continues in the background for large audiences."
                  : isMail
                    ? "One email per recipient. Delivery continues in the background for large audiences."
                    : "A separate notification is created for every recipient, so it appears in their history even if they are offline right now."}
              </p>
              {isContactChannel && unreachableInAudience > 0 && (
                <p className="text-amber-400/90 text-[13px] mt-2">
                  {unreachableInAudience} of {counts?.count} have no{" "}
                  {isSms ? "phone number" : "email address"} on file and will be
                  skipped.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Picking happens in a modal: this column is ~330px wide, which
                  left the inline list three rows tall and made choosing anyone
                  past the first search result an exercise in scrolling. */}
              <button
                onClick={() => setPickerOpen(true)}
                className="w-full text-left bg-[#242B35] hover:bg-[#2b333f] transition-colors rounded-lg p-3 md:p-4 border border-[#3b414d]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">
                      {selected.length === 0
                        ? "Choose recipients"
                        : recipientSummary}
                    </p>
                    <p className="text-gray-400 text-[13px] mt-0.5">
                      {selected.length === 0
                        ? `Search ${audiencesLabel.toLowerCase()} by name or email`
                        : "Click to change the selection"}
                    </p>
                  </div>
                  <span className="flex items-center gap-2 text-[#B93DEB] text-sm shrink-0">
                    <UserPlus className="w-4 h-4" />
                    {selected.length === 0 ? "Select" : "Edit"}
                  </span>
                </div>

                {selectedByAudience.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {AUDIENCES.filter((a) => selectedByAudience.has(a.key)).map(
                      (a) => (
                        <span
                          key={a.key}
                          className={`text-[10px] px-2 py-0.5 rounded border ${AUDIENCE_BADGE[a.key]}`}
                        >
                          {selectedByAudience.get(a.key)} {a.short}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </button>

              {/* A short preview of the selection, so the compose column still
                  shows WHO without reopening the modal. */}
              {selected.length > 0 && (
                <div className="mt-3 flex-1 overflow-y-auto flex flex-wrap gap-2 content-start">
                  {selectedSorted.slice(0, CHIP_PREVIEW_LIMIT).map((r) => (
                    <span
                      key={recipientKey(r)}
                      className={`inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border ${AUDIENCE_BADGE[r.audience]}`}
                    >
                      <span className="opacity-70">{audienceShort(r.audience)}</span>
                      {r.username}
                      <button
                        onClick={() =>
                          setSelected((prev) =>
                            prev.filter(
                              (s) => recipientKey(s) !== recipientKey(r),
                            ),
                          )
                        }
                        className="opacity-60 hover:opacity-100"
                        aria-label={`Remove ${r.username}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {selected.length > CHIP_PREVIEW_LIMIT && (
                    <button
                      onClick={() => setPickerOpen(true)}
                      className="text-[11px] text-[#B93DEB] hover:underline px-2"
                    >
                      +{selected.length - CHIP_PREVIEW_LIMIT} more
                    </button>
                  )}
                  <button
                    onClick={() => setSelected([])}
                    className="text-[11px] text-gray-400 hover:text-white px-2"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {isContactChannel && unreachable.length > 0 && (
                <p className="text-amber-400/90 text-xs mt-2">
                  {unreachable.length} selected have no{" "}
                  {isSms ? "phone number" : "email address"} and will be skipped.
                </p>
              )}
              {errors.recipient && (
                <p className="text-red-400 text-xs mt-1">{errors.recipient}</p>
              )}
            </>
          )}
        </div>

        {/* ── Right: the message ── */}
        <div className="bg-[#191D24] rounded-lg p-3 md:p-5 flex flex-col overflow-y-auto min-w-0">
          <div className="bg-[#242B35] rounded-lg px-4 py-2.5 mb-4">
            <p className="text-gray-400 text-xs">
              Sending as {isSms ? "SMS" : isMail ? "email" : "in-app message"}
            </p>
            <p className="text-white text-sm font-semibold break-words">
              {audiencesLabel} · {recipientSummary}
            </p>
            {isContactChannel && unreachable.length > 0 && (
              <p className="text-amber-400/90 text-xs mt-1">
                {unreachable.length} selected recipient(s) have no{" "}
                {isSms ? "phone number" : "email address"} and will be skipped.
              </p>
            )}
          </div>

          {/* No category picker: players never surfaced one, and on the staff
              side it only changed an inbox icon. Every send is a plain message,
              which is what the backend now defaults to. */}
          <Label className="text-white text-sm">
            {isMail ? "Subject" : isSms ? "Reference" : "Title"}
          </Label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={255}
            className="w-full h-10 mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm outline-none"
            placeholder={
              isMail
                ? "Email subject"
                : isSms
                  ? "Internal label for the sent history"
                  : "Notification title"
            }
          />
          {isSms && !errors.subject && (
            <p className="text-gray-500 text-xs mt-1">
              Not sent to the phone — a text carries no subject line. This only
              names the send in your history.
            </p>
          )}
          {errors.subject && (
            <p className="text-red-400 text-xs mt-1">{errors.subject}</p>
          )}

          <Label className="text-white text-sm mt-4">
            {isMail ? "Email body" : isSms ? "Text message" : "Message"}
          </Label>
          {isMail ? (
            <div className="mt-1">
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Write your email…"
              />
            </div>
          ) : (
            <>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={isSms ? MAX_SMS : MAX_MESSAGE}
                rows={isSms ? 5 : 8}
                className="w-full mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 py-2 text-white text-sm outline-none resize-none"
                placeholder={
                  isSms ? "Write the text message" : "Write the notification body"
                }
              />
              <div className="flex justify-between mt-1">
                {/* Segments, not just characters: each one past the first is
                    billed again, and that is invisible from a character count. */}
                <span className="text-gray-500 text-xs">
                  {isSms
                    ? `${Math.max(1, Math.ceil(body.length / SMS_SEGMENT))} segment(s) × ${
                        selected.length || allCount || 0
                      } recipient(s)`
                    : ""}
                </span>
                <span className="text-gray-500 text-xs">
                  {body.length}/{isSms ? MAX_SMS : MAX_MESSAGE}
                </span>
              </div>
            </>
          )}
          {errors.body && (
            <p className="text-red-400 text-xs mt-1">{errors.body}</p>
          )}

          <Label className="text-white text-sm mt-4">
            Expires on <span className="text-gray-500">(optional)</span>
          </Label>
          <input
            type="date"
            value={expiresAt}
            min={todayStr}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full h-10 mt-1 bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm outline-none"
          />
          {errors.expiresAt ? (
            <p className="text-red-400 text-xs mt-1">{errors.expiresAt}</p>
          ) : (
            <p className="text-gray-500 text-xs mt-1">
              {isContactChannel
                ? `Applies to the in-app record of this send, not to the ${isSms ? "text" : "email"} itself.`
                : "Set this on promotional sends so they are cleaned up automatically instead of sitting in inboxes forever."}
            </p>
          )}

          {/* Preview moved into a modal: inline it competed with the editor
              for the same column and pushed the send buttons below the fold. */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={submitting}
              className="h-10"
            >
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={!subject.trim() && !body.trim()}
              className="h-10"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={handleSend}
              disabled={!isFormValid || submitting}
              className="bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 h-10 px-6"
            >
              {submitting
                ? "Sending…"
                : isSms
                  ? "Send SMS"
                  : isMail
                    ? "Send email"
                    : "Send message"}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview — rendered the way the recipient will actually see it: mail as
          HTML on a white sheet, in-app as the notification card. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#15181E] border-[#242B35] text-white sm:max-w-[min(760px,calc(100vw-3rem))] w-full max-h-[85vh] p-0 gap-0 grid-rows-[auto_1fr_auto]"
        >
          <DialogHeader className="px-5 py-4 border-b border-[#242B35] space-y-0">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-white text-base font-normal">
                {isSms
                  ? "SMS preview"
                  : isMail
                    ? "Email preview"
                    : "Notification preview"}
              </DialogTitle>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto p-3 md:p-5 bg-[#0f1216]">
            {isSms ? (
              <>
                <p className="text-gray-500 text-xs mb-4 text-center">
                  As it arrives on {recipientSummary}&apos;s phone
                </p>

                {/* A phone mock rather than a plain box: an SMS is judged on
                    how much of it fits on a lock screen, and that only reads
                    at the real width. */}
                <div className="mx-auto w-[300px] rounded-[28px] border-4 border-[#2b323d] bg-black overflow-hidden shadow-lg">
                  <div className="bg-[#1c1f25] px-4 py-2 flex items-center justify-between text-[11px] text-gray-400">
                    <span>Messages</span>
                    <span>now</span>
                  </div>
                  <div className="px-3 py-4 min-h-[220px]">
                    <p className="text-center text-[11px] text-gray-500 mb-3">
                      Wulf Casino
                    </p>
                    <div className="bg-[#26262a] text-white text-sm rounded-2xl rounded-bl-md px-3.5 py-2.5 max-w-[85%] whitespace-pre-wrap break-words">
                      {body || "Your text message"}
                    </div>
                  </div>
                </div>

                <p className="text-gray-500 text-xs mt-4 text-center">
                  {Math.max(1, Math.ceil(body.length / SMS_SEGMENT))} segment(s)
                  per recipient · sent from the platform&apos;s Twilio number
                </p>
              </>
            ) : isMail ? (
              <>
                {/* Envelope details first — who it comes from and who it lands
                    on are as much a part of "is this right?" as the body. */}
                <dl className="mb-4 space-y-1.5 text-sm">
                  <div className="flex gap-3">
                    <dt className="text-gray-500 w-16 shrink-0">From</dt>
                    {/* The API sends admin mail under the Support category, and
                        SendGrid renders the sender as "<brand> <category>" —
                        this is the name that actually shows in the inbox. */}
                    <dd className="text-gray-200">Wulf Casino Support</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="text-gray-500 w-16 shrink-0">To</dt>
                    <dd className="text-gray-200">{recipientSummary}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="text-gray-500 w-16 shrink-0">Subject</dt>
                    <dd className="text-white font-medium break-words">
                      {subject || (
                        <span className="text-gray-500 font-normal">
                          (no subject)
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>

                {/* The branded shell the API wraps every send in, reproduced at
                    the 600px width mail clients render it at — a bare white
                    strip of body HTML looked nothing like what arrives. */}
                <div className="mx-auto max-w-[600px] overflow-hidden shadow-lg">
                  {/* 20px/30px padding and a 40px logo, matching the header the
                      template actually renders. */}
                  <div className="bg-black px-[30px] py-5 flex items-center justify-between gap-4">
                    <Image
                      src={logo}
                      alt="Wulf Casino"
                      width={140}
                      height={40}
                      className="object-contain h-10 w-auto"
                    />
                    <span className="text-white text-[13px] font-bold">
                      Stay Untamed
                    </span>
                  </div>

                  {/* Type scale copied from base.template.ts — 24px title,
                      15px body on 1.6 — so the preview measures the same as the
                      delivered mail rather than approximating it. */}
                  <div className="bg-white pt-10 pb-5">
                    <h1 className="text-black text-2xl font-bold mb-5 px-[30px] break-words">
                      {subject || "Your subject line"}
                    </h1>
                    <div
                      className="px-[30px] text-[#444] text-[15px] leading-[1.6] [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_p]:mb-4 [&_h1]:text-lg [&_h2]:text-base [&_h1]:font-bold [&_h2]:font-bold [&_h1]:text-black [&_h2]:text-black [&_strong]:text-black [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600"
                      dangerouslySetInnerHTML={{
                        __html: body || "<p>Your message body</p>",
                      }}
                    />
                    <div className="mt-10 pt-5 px-[30px] border-t border-[#f0f0f0]">
                      <p className="text-[#444] text-[15px] font-bold m-0">
                        Thank you for trusting us.
                      </p>
                      <p className="text-[#444] text-[15px] mt-1.5 leading-[1.6]">
                        Kind Regards,
                        <br />
                        Wulf Casino Team
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#f5f5f5] border-t border-[#eee] px-[30px] py-[30px] text-center">
                    <p className="text-[#999] text-[12px] m-0">
                      © {new Date().getFullYear()} Wulf Casino. All rights
                      reserved.
                    </p>
                    <p className="text-[#bbb] text-[11px] underline mt-2">
                      Unsubscribe
                    </p>
                  </div>
                </div>

                <p className="text-gray-500 text-xs mt-4 text-center">
                  Header, sign-off and footer are added by the platform — only
                  the body between them is yours.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-xs mb-3">
                  As it appears in {recipientSummary}&apos;s inbox
                </p>
                <div className="rounded-lg border border-[#242B35] overflow-hidden">
                  <div className="flex items-start gap-3 bg-[#191D24] px-4 py-3">
                    <span className="mt-0.5 w-8 h-8 rounded-full bg-[#B93DEB]/15 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-[#B93DEB]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-white font-semibold text-sm break-words">
                          {subject || "Your notification title"}
                        </p>
                        <span className="text-gray-500 text-[11px] shrink-0">
                          now
                        </span>
                      </div>
                      <p className="text-gray-300 text-[13px] mt-1 whitespace-pre-wrap break-words">
                        {body || "Your message body"}
                      </p>
                    </div>
                    <span className="mt-2 w-2 h-2 rounded-full bg-[#B93DEB] shrink-0" />
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-4">
                  Unread until they open it; it stays in their history even if
                  they are offline right now.
                </p>
              </>
            )}
          </div>

          <div className="px-5 py-4 border-t border-[#242B35] flex justify-end">
            <Button
              className="h-10 px-6 bg-purple-500 hover:bg-purple-600 text-white"
              onClick={() => setPreviewOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RecipientPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        audiences={audiences}
        channel={channel}
        selected={selected}
        onConfirm={setSelected}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-[#191D24] border-[#242B35] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Send to everyone in {audiencesLabel}?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {isSms
                ? `This texts ${allCount ?? "all"} recipient(s) and is billed per segment. An SMS cannot be recalled once delivered.`
                : isMail
                  ? `This emails ${allCount ?? "all"} recipient(s). Email cannot be recalled once delivered.`
                  : `This creates a notification for ${counts?.count ?? "all"} recipient(s).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#242B35] border-[#3b414d] text-white hover:bg-[#2c3440]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {submitting ? "Sending…" : "Yes, send it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
