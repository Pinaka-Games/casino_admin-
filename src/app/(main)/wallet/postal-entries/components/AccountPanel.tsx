"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import {
  POSTAL_CURRENCY_LABELS,
  PostalLookupResult,
} from "@/api/postal-request/postal-request.api";

import { INSET, TEXT_FAINT, TEXT_MUTED } from "../theme";

interface Props {
  lookup: PostalLookupResult | null;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 border-b border-white/[0.06] py-2 last:border-b-0">
    <span className={`text-sm ${TEXT_MUTED}`}>{label}</span>
    <span className="text-right text-sm font-medium text-white">{value ?? "—"}</span>
  </div>
);

/**
 * What the card is supposed to say.
 *
 * Everything here comes from the account the code was minted for, never from
 * the handwriting — that is the comparison the clerk is making. The warnings
 * below are shown as warnings, not verdicts: the server re-runs every one of
 * them when the entry is recorded, so a stale panel cannot approve anything.
 */
export default function AccountPanel({ lookup }: Props) {
  if (!lookup) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-[#2F3743] p-6 text-sm ${TEXT_FAINT}`}
      >
        Look a code up to see the account it belongs to.
      </div>
    );
  }

  if (!lookup.found) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex items-center gap-2 font-medium text-red-300">
          <XCircle className="h-4 w-4" /> Code not recognised
        </div>
        <p className="mt-2 text-sm text-red-200/80">
          Nothing was ever issued with this code. Recording it still keeps the
          envelope on file — a run of unknown codes is worth seeing.
        </p>
      </div>
    );
  }

  const warnings: string[] = [];
  if (lookup.expired) warnings.push("This code had expired before the card was opened.");
  if (lookup.codeStatus === "USED") warnings.push("This code was already used.");
  if (lookup.codeStatus === "VOID") warnings.push("This code was voided.");
  if (lookup.pendingOnCode) {
    warnings.push(
      "A card with this code is already waiting for review. Recording this one will refuse it as a duplicate.",
    );
  }
  if (lookup.account && !lookup.account.isActive) warnings.push("The account is inactive.");
  if (lookup.account && lookup.account.rgStatus !== "ACTIVE") {
    warnings.push(`Responsible-gaming status: ${lookup.account.rgStatus}.`);
  }
  if (
    lookup.limits &&
    lookup.limits.acceptedInWindow >= lookup.limits.maxEntriesPerUserMonth
  ) {
    warnings.push(
      `This player has reached the cap of ${lookup.limits.maxEntriesPerUserMonth} accepted entries in ${lookup.limits.windowDays} days.`,
    );
  }

  const currency = lookup.reward
    ? (POSTAL_CURRENCY_LABELS[lookup.reward.currency] ?? lookup.reward.currency)
    : "";

  return (
    <div className={`${INSET} space-y-3 rounded-lg p-4`}>
      {lookup.display && (
        <p className="font-mono text-sm tracking-wide text-white">{lookup.display}</p>
      )}

      <div className="flex items-center gap-2 font-medium text-white">
        {warnings.length === 0 ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-400" /> Account found
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-400" /> Check before crediting
          </>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 pl-6 text-sm text-amber-200">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div>
        <Row label="Username" value={lookup.account?.username} />
        <Row label="Email / phone on file" value={lookup.account?.entity} />
        <Row label="Profile name" value={lookup.account?.name} />
        <Row label="Legal name (verified)" value={lookup.kyc?.legalName} />
        <Row label="Verified address" value={lookup.kyc?.address} />
        <Row label="KYC status" value={lookup.kyc?.status ?? "Not started"} />
        <Row
          label="Code expires"
          value={
            lookup.expiresAt ? new Date(lookup.expiresAt).toLocaleDateString() : "—"
          }
        />
        <Row
          label={`Accepted in last ${lookup.limits?.windowDays ?? 30} days`}
          value={
            lookup.limits
              ? `${lookup.limits.acceptedInWindow} of ${lookup.limits.maxEntriesPerUserMonth}`
              : "—"
          }
        />
        <Row
          label="Reward on approval"
          value={
            !lookup.reward
              ? "—"
              : (lookup.reward.mode === "FIXED"
                  ? `${lookup.reward.fixed} ${currency}`
                  : `${lookup.reward.min}–${lookup.reward.max} ${currency} (drawn when recorded)`) +
                (Number(lookup.reward.goldCoinAmount) > 0
                  ? ` + ${lookup.reward.goldCoinAmount} ${POSTAL_CURRENCY_LABELS.wulfCoin}`
                  : "")
          }
        />
      </div>
    </div>
  );
}
