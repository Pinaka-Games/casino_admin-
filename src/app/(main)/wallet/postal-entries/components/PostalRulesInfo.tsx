"use client";

import React from "react";

import InfoButton, { InfoSection } from "@/components/InfoButton";
import {
  MANUAL_REJECTION_REASONS,
  POSTAL_CURRENCY_LABELS,
  POSTAL_FIXED_RULES,
  PostalSettings,
  REJECTION_REASON_LABELS,
} from "@/api/postal-request/postal-request.api";

const B = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-white">{children}</span>
);

/**
 * Every rule the postal route runs on, in one list.
 *
 * Built from the live (or unsaved) form values so what it says is what the
 * route will do once saved — a static help text would drift the first time
 * somebody changed the reward.
 */
export default function PostalRulesInfo({ settings }: { settings: PostalSettings }) {
  const currency = POSTAL_CURRENCY_LABELS[settings.rewardCurrency] ?? settings.rewardCurrency;
  const isSweeps = settings.rewardCurrency === "wulfCash";
  const goldCoins = isSweeps ? Number(settings.rewardGoldCoinAmount) || 0 : 0;
  const goldCoinsPart =
    goldCoins > 0 ? (
      <>
        {" "}
        plus <B>{goldCoins}</B> {POSTAL_CURRENCY_LABELS.wulfCoin}
      </>
    ) : null;

  const reward =
    settings.rewardMode === "FIXED" ? (
      <>
        Every accepted card pays <B>{settings.rewardAmountFixed}</B> {currency}
        {goldCoinsPart}.
      </>
    ) : (
      <>
        Each accepted card pays a random amount between <B>{settings.rewardAmountMin}</B> and{" "}
        <B>{settings.rewardAmountMax}</B> {currency}
        {goldCoinsPart}, drawn once when the envelope is recorded — the reviewer approves the
        number they see.
      </>
    );

  const sections: InfoSection[] = [
    {
      heading: "Set on this page",
      intro: "Current values, including anything not yet saved.",
      items: [
        <>
          Route is <B>{settings.enabled ? "OPEN" : "CLOSED"}</B>. When closed, the mail-in
          link disappears from the coin-pack page and the profile menu, the player page shows
          that entry is unavailable, and new codes and new envelopes are refused.
        </>,
        <>
          A code is valid for <B>{settings.codeTtlDays} day{settings.codeTtlDays === 1 ? "" : "s"}</B>{" "}
          from when it was generated. Judged when the card is opened — a card that arrived in
          time is still creditable if review takes longer. A change applies to codes generated
          afterwards; codes players already hold keep their date.
        </>,
        <>
          A player can hold <B>{settings.maxActiveCodesPerUser}</B> unused code
          {settings.maxActiveCodesPerUser === 1 ? "" : "s"} at once. Asking for another returns
          the one they already hold.
        </>,
        <>
          A player can generate <B>{settings.codesPerDay}</B> code
          {settings.codesPerDay === 1 ? "" : "s"} in any rolling 24 hours.
        </>,
        reward,
        <>
          Accepted entries per player are capped at <B>{settings.maxEntriesPerUserMonth}</B> in
          any rolling {POSTAL_FIXED_RULES.entryCapWindowDays} days. Checked when a card is
          recorded and again when it is approved, so a stack of cards already in the queue
          cannot all be credited past it.
        </>,
        isSweeps ? (
          <>
            Wagering is <B>{settings.applyWagering ? "ON" : "OFF"}</B>:{" "}
            {settings.applyWagering ? (
              settings.wageringMultiplier != null ? (
                <>
                  the credited Sweeps Coins must be wagered <B>{settings.wageringMultiplier}×</B>{" "}
                  before they can be redeemed.
                </>
              ) : (
                "the credited Sweeps Coins must be wagered at the system default multiplier before they can be redeemed."
              )
            ) : (
              "the credited Sweeps Coins are immediately redeemable."
            )}
          </>
        ) : (
          <>
            Wagering does not apply — Gold Coins are never redeemable, so there is nothing to
            lock.
          </>
        ),
        <>The mailing address and declaration shown to the player are the ones saved here.</>,
      ],
    },
    {
      heading: "Fixed by the Sweepstakes Rules",
      intro: "Not editable here — changing any of these means changing the published rules.",
      items: [
        <>
          Codes are random digits, written as <B>{POSTAL_FIXED_RULES.codeFormat}</B>.
        </>,
        <>A code can be used once, and only credits the account that generated it.</>,
        <>A refused card burns its code. The player needs a new code to try again.</>,
      ],
    },
    {
      heading: "Refused automatically when the envelope is recorded",
      items: [
        "The code does not match any code we issued (the envelope is still kept on record).",
        "The code has already been used, or was burned by an earlier refusal.",
        `The code is older than its validity window (${settings.codeTtlDays} day${
          settings.codeTtlDays === 1 ? "" : "s"
        } for codes generated now).`,
        "The account is inactive, or under a responsible-gaming pause or self-exclusion.",
        "The player has reached the accepted-entries cap.",
      ],
    },
    {
      heading: "Refused by the reviewer",
      intro: "Reasons offered in the Reject dialog. The chosen reason is sent to the player.",
      items: MANUAL_REJECTION_REASONS.map((r) => REJECTION_REASON_LABELS[r]),
    },
    {
      heading: "What happens on approval",
      items: [
        "The code is marked used first, so two people approving the same card credit it once.",
        "The amount is credited through a manual deposit tagged Postcard, so it appears in the ledger, the player's transactions and the Manual Deposit Listing. A Sweeps Coins + Gold Coins reward is one Manual Pair: both halves are approved, or rejected, together.",
        "If the credit fails part-way, the code is handed back and the half-made deposit is withdrawn, so the card can be approved again without paying twice.",
        "The player gets an in-app notification and, if their login is an email address, an email.",
        "Every open Postal Entries screen refreshes, and the decision is written to the activity log.",
      ],
    },
  ];

  return (
    <InfoButton
      title="Postal entry rules"
      description="Everything the mail-in route checks, and where each rule comes from."
      sections={sections}
      label="Rules"
    />
  );
}
