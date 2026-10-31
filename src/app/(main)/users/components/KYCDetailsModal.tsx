// components/KYCDetailsModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { AdminKycRow } from "@/api/kyc/kyc.admin.api";
import {
  applyDocumentIdentity,
  requestProfileUpdate,
  syncUserKyc,
} from "@/api/kyc/kyc.admin.api";
import CopyButton from "@/components/CopyButton";
import { formatCalendarDate } from "@/lib/calendar-date";

/** Prefilled wording for a correction request. The admin can rewrite it. */
const DEFAULT_CORRECTION_REASON =
  "Your details do not match your identity document.";

/** Consistent, readable display only; the original KYC values stay untouched. */
const formatNameForDisplay = (value?: string | null): string | null => {
  const name = String(value ?? "").trim();
  if (!name) return null;

  return name
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase()}`,
    );
};

/**
 * Sumsub reports gender as M/F while the profile stores the form's words, so
 * both sides of the comparison read the same. Anything else ("Prefer not to
 * say") is shown as entered.
 */
const formatGenderForDisplay = (value?: string | null): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === "M" || upper === "MALE") return "Male";
  if (upper === "F" || upper === "FEMALE") return "Female";
  return raw;
};

interface KYCDetailsModalProps {
  open: boolean;
  data: AdminKycRow | null;
  onClose: () => void;
}

export default function KYCDetailsModal({
  open,
  data: propData,
  onClose,
}: KYCDetailsModalProps) {
  // Local copy so a "Sync from Sumsub" refresh updates the modal in place.
  const [data, setData] = useState<AdminKycRow | null>(propData);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<null | "apply" | "request">(null);
  // The correction request used to go through window.prompt — an OS dialog that
  // ignores the app's styling, cannot explain that the text reaches the player,
  // and gives no room to write more than a line.
  const [askOpen, setAskOpen] = useState(false);
  const [askReason, setAskReason] = useState(DEFAULT_CORRECTION_REASON);
  useEffect(() => setData(propData), [propData]);

  if (!open || !data) return null;

  // Pull the latest status/data from Sumsub (recovery for a missed/late webhook).
  const handleSync = async () => {
    if (!data || syncing) return;
    setSyncing(true);
    try {
      const updated = await syncUserKyc(data.userId);
      if (updated) setData(updated);
    } catch {
      // Swallow — the button re-enables so the admin can retry.
    } finally {
      setSyncing(false);
    }
  };

  // The document is right and the profile is wrong — copy the extracted name and
  // date of birth across. Available on a HELD profile too: that is the case it
  // exists for, where Sumsub read the details correctly and the player typed
  // them wrong.
  const handleApplyDocument = async () => {
    if (!data || busy) return;
    setBusy("apply");
    try {
      const updated = await applyDocumentIdentity(data.userId);
      if (updated) setData(updated);
    } catch {
      // Swallow — the button re-enables so the admin can retry.
    } finally {
      setBusy(null);
    }
  };

  // Hand the profile back to the player instead. Reopens their name/date-of-birth
  // fields until they save and tells them what to fix. Does not un-verify them.
  const handleRequestUpdate = async () => {
    if (!data || busy) return;
    const reason = askReason.trim();
    if (!reason) return;
    setBusy("request");
    try {
      const updated = await requestProfileUpdate(data.userId, reason);
      if (updated) setData(updated);
      setAskOpen(false);
      setAskReason(DEFAULT_CORRECTION_REASON);
    } catch {
      // Swallow — the dialog stays open so the admin can retry.
    } finally {
      setBusy(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      APPROVED: "text-green-400",
      PENDING_REVIEW: "text-yellow-400",
      REJECTED: "text-red-400",
      IN_PROGRESS: "text-blue-400",
      NOT_STARTED: "text-gray-400",
    };
    return colors[status] || "text-gray-400";
  };

  // Small read-only row, hidden when the value is empty.
  const Row = ({ label, value }: { label: string; value?: string | null }) =>
    value && String(value).trim() ? (
      <div className="flex justify-between items-start">
        <span className="text-gray-400 text-sm">{label}:</span>
        <span className="text-white text-sm text-right max-w-[70%] break-words">
          {value}
        </span>
      </div>
    ) : null;

  const documentName = [data.firstName, data.middleName, data.lastName]
    .map((p) => (p ? String(p).trim() : ""))
    .filter(Boolean)
    .join(" ");
  const fullName = formatNameForDisplay(documentName) || "";

  const hasIdentity = Boolean(
    fullName ||
      data.dob ||
      data.gender ||
      data.nationality ||
      data.placeOfBirth ||
      data.countryOfBirth,
  );
  const hasDocument = Boolean(
    data.docType ||
      data.docNumber ||
      data.docCountry ||
      data.docIssuedDate ||
      data.docValidUntil,
  );
  const hasAddress = Boolean(data.addressFormatted || data.addressCountry);
  // Shown whenever a comparison was made — a clean MATCH is worth stating too,
  // otherwise an admin cannot tell "checked and fine" from "never checked".
  const hasIdentityCheck = Boolean(data.identityVerdict);
  // An admin-only flag: the KYC status is Sumsub's decision whatever this says.
  // A name mismatch is the serious one, so it gets the red panel.
  const identityBlocked = data.identityVerdict === "NAME_MISMATCH";
  const identityFlagged =
    identityBlocked ||
    data.identityVerdict === "DOB_MISMATCH" ||
    data.identityVerdict === "GENDER_MISMATCH";

  const hasReview = Boolean(
    data.reviewAnswer ||
      data.reviewRejectType ||
      (data.rejectLabels && data.rejectLabels.length) ||
      data.moderationComment ||
      data.clientComment,
  );

  // Parse a date-ish value; falls back to the raw string when unparseable.
  const formatMaybeDate = (v: unknown): string | null => {
    if (v == null || v === "") return null;
    const d = new Date(typeof v === "number" ? v : String(v));
    return Number.isNaN(d.getTime())
      ? String(v)
      : d.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
  };

  // Turn a Sumsub webhook `type` into a human label.
  const humanizeEventType = (type?: string): string => {
    if (!type) return "Event";
    const map: Record<string, string> = {
      applicantCreated: "Applicant Created",
      applicantPending: "Pending Review",
      applicantSubmitted: "Documents Submitted",
      applicantReviewed: "Applicant Reviewed",
      applicantOnHold: "On Hold",
      applicantWorkflowCompleted: "Workflow Completed",
      applicantReset: "Applicant Reset",
      applicantDeleted: "Applicant Deleted",
      applicantPersonalInfoChanged: "Personal Info Changed",
      applicantLevelChanged: "Level Changed",
    };
    return (
      map[type] ||
      type.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())
    );
  };

  // Sumsub webhook payload (ids + reviewResult only — no personal data).
  const ev: any = data.lastEvent || {};
  const evAnswer: string | undefined = ev?.reviewResult?.reviewAnswer;
  const evAnswerCls =
    evAnswer === "GREEN"
      ? "bg-green-500/15 text-green-300 border-green-500/25"
      : evAnswer === "RED"
        ? "bg-red-500/15 text-red-300 border-red-500/25"
        : "bg-gray-500/15 text-gray-300 border-gray-500/25";
  const evRejectLabels =
    Array.isArray(ev?.reviewResult?.rejectLabels) &&
    ev.reviewResult.rejectLabels.length
      ? ev.reviewResult.rejectLabels.join(", ")
      : null;
  const evTime = formatMaybeDate(ev?.createdAt ?? ev?.createdAtMs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center ">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#191D24] rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-[#191D24] z-10">
          <h2 className="text-xl font-semibold text-white">KYC Details</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-purple-500/40 text-purple-300 hover:bg-purple-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? "Syncing…" : "Sync from Sumsub"}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Information */}
          <div className="bg-[#242B35] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-4">
              User Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">User ID:</span>
                <div className="flex items-center gap-2 max-w-[70%]">
                  <span className="text-white text-sm font-mono break-all text-right">
                    {data.userId}
                  </span>
                  <CopyButton value={data.userId} size={14} />
                </div>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Email:</span>
                <div className="flex items-center gap-2 max-w-[70%]">
                  <span className="text-white text-sm break-all text-right">
                    {data.user?.entity || "-"}
                  </span>
                  <CopyButton value={data.user?.entity || ""} size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* KYC Information */}
          <div className="bg-[#242B35] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-4">
              KYC Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">KYC ID:</span>
                <div className="flex items-center gap-2 max-w-[70%]">
                  <span className="text-white text-sm font-mono break-all text-right">
                    {data.id}
                  </span>
                  <CopyButton value={data.id} size={14} />
                </div>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Applicant ID:</span>
                <div className="flex items-center gap-2 max-w-[70%]">
                  <span className="text-white text-sm font-mono break-all text-right">
                    {data.applicantId || "-"}
                  </span>
                  <CopyButton value={data.applicantId || ""} size={14} />
                </div>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Level Name:</span>
                <span className="text-white text-sm text-right max-w-[70%]">
                  {data.levelName || "-"}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Status:</span>
                <span
                  className={`text-sm font-semibold ${getStatusColor(data.status)}`}
                >
                  {data.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-[#242B35] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-4">
              Timestamps
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Submitted At:</span>
                <span className="text-white text-sm text-right">
                  {(data as any).submittedAt
                    ? formatDate((data as any).submittedAt)
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Created At:</span>
                <span className="text-white text-sm text-right">
                  {formatDate(data.createdAt)}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Updated At:</span>
                <span className="text-white text-sm text-right">
                  {formatDate(data.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Identity check — does the document belong to the account holder?
              Sumsub is never told who the account claims to be, so this panel
              is the only place the difference shows. It never changes the KYC
              status; the admin settles it with the two buttons below. */}
          {hasIdentityCheck && (
            <div
              className={`rounded-lg p-4 ${
                identityBlocked
                  ? "bg-red-500/10 border border-red-500/30"
                  : "bg-[#242B35]"
              }`}
            >
              <h3
                className={`text-sm font-semibold mb-4 ${
                  identityBlocked ? "text-red-300" : "text-purple-400"
                }`}
              >
                Identity Check
                {identityBlocked ? " — document may belong to someone else" : ""}
              </h3>

              <div className="space-y-3">
                <Row
                  label="Result"
                  value={
                    {
                      MATCH: "Matches the account holder",
                      DOB_MISMATCH:
                        "Name matches; date of birth differs from the document",
                      GENDER_MISMATCH:
                        "Name and date of birth match; gender differs from the document",
                      NAME_MISMATCH:
                        "Document holder may not be the account holder",
                      UNVERIFIABLE:
                        "Could not compare — no name on the profile or the document",
                    }[data.identityVerdict as string] ?? data.identityVerdict
                  }
                />
                <Row
                  label="Account claimed"
                  value={
                    [
                      formatNameForDisplay(data.claimedName),
                      data.claimedDob ? formatCalendarDate(data.claimedDob) : null,
                      formatGenderForDisplay(data.claimedGender),
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                <Row
                  label="Document says"
                  value={
                    [
                      fullName,
                      data.dob ? formatCalendarDate(data.dob) : null,
                      formatGenderForDisplay(data.gender),
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                />
                {data.identityMismatchReasons?.length ? (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400 text-sm">Details:</span>
                    <span className="text-amber-300 text-sm text-right max-w-[70%] break-words">
                      {data.identityMismatchReasons.join(" ")}
                    </span>
                  </div>
                ) : null}
                {data.reviewHold === "IDENTITY" ? (
                  // Held before the comparison became a flag only. The next
                  // sync applies Sumsub's own decision.
                  <p className="text-xs text-red-200/80 pt-1 border-t border-red-500/20">
                    Held under the old identity rule. Use &quot;Sync from
                    Sumsub&quot; to apply Sumsub&apos;s decision.
                  </p>
                ) : identityFlagged ? (
                  <p
                    className={`text-xs pt-1 border-t ${
                      identityBlocked
                        ? "text-red-200/80 border-red-500/20"
                        : "text-amber-200/80 border-white/10"
                    }`}
                  >
                    Admin-only flag — the KYC status is Sumsub&apos;s decision
                    and the player has not been told. Use the document details,
                    or ask the player to correct theirs.
                  </p>
                ) : null}

                {data.profileEditRequestedAt ? (
                  <p className="text-xs text-amber-300/90 pt-1 border-t border-white/10">
                    Correction requested — the player&apos;s name, date of
                    birth and gender are unlocked until they save.
                    {data.profileEditReason
                      ? ` Reason given: ${data.profileEditReason}`
                      : ""}
                  </p>
                ) : null}

                {/* The two ways to resolve a discrepancy: trust the document, or
                    ask the player. Approving outright stays on the main action
                    bar — this panel is about fixing the DATA, not the status. */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleApplyDocument}
                    disabled={busy !== null}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === "apply"
                      ? "Applying…"
                      : "Use document details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAskOpen(true)}
                    disabled={busy !== null}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === "request"
                      ? "Sending…"
                      : "Ask player to correct"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review Result (Sumsub verdict + rejection detail) */}
          {hasReview && (
            <div className="bg-[#242B35] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">
                Review Result
              </h3>
              <div className="space-y-3">
                <Row label="Answer" value={data.reviewAnswer} />
                <Row label="Reject Type" value={data.reviewRejectType} />
                <Row
                  label="Reject Labels"
                  value={
                    data.rejectLabels && data.rejectLabels.length
                      ? data.rejectLabels.join(", ")
                      : null
                  }
                />
                <Row
                  label="Moderation Comment"
                  value={data.moderationComment}
                />
                {data.clientComment && String(data.clientComment).trim() ? (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400 text-sm">
                      Internal Comment:
                    </span>
                    <span className="text-amber-300 text-sm text-right max-w-[70%] break-words">
                      {data.clientComment}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Identity (extracted from the Sumsub document) */}
          {hasIdentity && (
            <div className="bg-[#242B35] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">
                Identity
              </h3>
              <div className="space-y-3">
                <Row label="Full Name" value={fullName} />
                <Row
                  label="Date of Birth"
                  value={data.dob ? formatCalendarDate(data.dob) : null}
                />
                <Row label="Gender" value={formatGenderForDisplay(data.gender)} />
                <Row label="Nationality" value={data.nationality} />
                <Row label="Place of Birth" value={data.placeOfBirth} />
                <Row label="Country of Birth" value={data.countryOfBirth} />
              </div>
            </div>
          )}

          {/* Document */}
          {hasDocument && (
            <div className="bg-[#242B35] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">
                Document
              </h3>
              <div className="space-y-3">
                <Row label="Type" value={data.docType} />
                <Row label="Number" value={data.docNumber} />
                <Row label="Issuing Country" value={data.docCountry} />
                <Row label="Issued Date" value={data.docIssuedDate} />
                <Row label="Valid Until" value={data.docValidUntil} />
              </div>
            </div>
          )}

          {/* Address */}
          {hasAddress && (
            <div className="bg-[#242B35] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">
                Address
              </h3>
              <div className="space-y-3">
                <Row label="Address" value={data.addressFormatted} />
                <Row label="Country" value={data.addressCountry} />
              </div>
            </div>
          )}

          {/* Last Event — structured view of the latest Sumsub webhook */}
          {data.lastEvent && Object.keys(data.lastEvent).length > 0 && (
            <div className="bg-[#242B35] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">
                Last Event
              </h3>

              {/* Event + verdict badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/25">
                  {humanizeEventType(ev?.type)}
                </span>
                {evAnswer ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${evAnswerCls}`}
                  >
                    {evAnswer}
                  </span>
                ) : null}
                {ev?.reviewStatus ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-gray-300 border border-gray-500/25 capitalize">
                    {String(ev.reviewStatus)}
                  </span>
                ) : null}
                {ev?.sandboxMode ? (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    Sandbox
                  </span>
                ) : null}
              </div>

              <div className="space-y-3">
                <Row label="Event Time" value={evTime} />
                <Row label="Reject Type" value={ev?.reviewResult?.reviewRejectType} />
                <Row label="Reject Labels" value={evRejectLabels} />
                <Row
                  label="Comment"
                  value={ev?.reviewResult?.moderationComment}
                />
                <Row label="Level" value={ev?.levelName} />
                <Row label="Applicant Type" value={ev?.applicantType} />
                <Row label="Inspection ID" value={ev?.inspectionId} />
                <Row label="Correlation ID" value={ev?.correlationId} />
              </div>

              {/* Raw payload, collapsed by default */}
              <details className="mt-3">
                <summary className="cursor-pointer select-none text-xs text-gray-400 hover:text-gray-200">
                  Raw payload
                </summary>
                <div className="mt-2 bg-[#15181E] rounded p-4 overflow-x-auto">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words">
                    {JSON.stringify(data.lastEvent, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Correction request. Sits above the details modal rather than replacing
          it, so the admin keeps the claimed-vs-document comparison in view while
          writing the message the player will read. */}
      {askOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => (busy ? null : setAskOpen(false))}
          />
          <div className="relative w-full max-w-md rounded-lg bg-[#191D24] shadow-xl border border-gray-700">
            <div className="p-5 border-b border-gray-700">
              <h3 className="text-base font-semibold text-white">
                Ask player to correct their details
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                This message is shown to the player, and their name, date of
                birth and gender are unlocked until they save. Their verification is not
                affected.
              </p>
            </div>

            <div className="p-5">
              <label
                htmlFor="kyc-correction-reason"
                className="block text-xs font-medium text-gray-400 mb-2"
              >
                What should they correct?
              </label>
              <textarea
                id="kyc-correction-reason"
                value={askReason}
                onChange={(e) => setAskReason(e.target.value)}
                rows={3}
                maxLength={300}
                autoFocus
                disabled={busy !== null}
                className="w-full rounded-lg bg-[#15181E] border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-purple-500 disabled:opacity-60"
                placeholder="Explain what is wrong, in words the player will understand."
              />
              <p className="mt-1 text-right text-[11px] text-gray-500">
                {askReason.trim().length}/300
              </p>
            </div>

            <div className="flex justify-end gap-2 p-5 pt-0">
              <button
                type="button"
                onClick={() => setAskOpen(false)}
                disabled={busy !== null}
                className="rounded-lg border border-white/20 px-4 py-2 text-xs font-medium text-gray-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestUpdate}
                disabled={busy !== null || !askReason.trim()}
                className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "request" ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
