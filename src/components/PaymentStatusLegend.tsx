"use client";

import { Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The decoder ring for three overlapping status vocabularies.
 *
 * A deposit carries the provider's word for what happened ("Settled"), our
 * record of the payment ("PAID"), and the deposit listing's word for the whole
 * outcome ("COMPLETED") — and they are not synonyms. COMPLETED means settled
 * AND credited; PROCESSING means settled and NOT credited, which is the only
 * state where a player is owed something. That distinction is invisible from the
 * words alone, so it lives one click away from every screen that shows them.
 */

const PILL = {
  green: "bg-emerald-900/40 text-emerald-400",
  blue: "bg-sky-900/40 text-sky-400",
  amber: "bg-amber-900/40 text-amber-400",
  red: "bg-red-900/40 text-red-400",
  gray: "bg-gray-700 text-gray-300",
} as const;

type PillTone = keyof typeof PILL;

function Pill({ tone, children }: { tone: PillTone; children: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] inline-block ${PILL[tone]}`}>
      {children}
    </span>
  );
}

function Row({
  left,
  tone,
  children,
}: {
  left: string;
  tone: PillTone;
  children: React.ReactNode;
}) {
  return (
    <tr className="flex flex-col sm:table-row border-b border-gray-800 last:border-0 sm:align-top py-2 sm:py-0">
      <td className="pb-1 sm:py-2 pr-3 whitespace-normal sm:whitespace-nowrap block sm:table-cell">
        <Pill tone={tone}>{left}</Pill>
      </td>
      <td className="pb-2 sm:py-2 text-gray-300 leading-relaxed block sm:table-cell">{children}</td>
    </tr>
  );
}

function Block({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm text-white">{title}</h3>
        {subtitle ? (
          <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      <table className="w-full text-xs block sm:table">
        <tbody className="block sm:table-row-group">{children}</tbody>
      </table>
    </section>
  );
}

interface Props {
  /** Which vocabulary the current screen shows first. */
  variant?: "deposits" | "webhooks";
  label?: string;
}

export default function PaymentStatusLegend({
  variant = "deposits",
  label = "What do these mean?",
}: Props) {
  const depositBlock = (
    <Block
      title="Deposit status"
      subtitle="What the transactions list shows for a payment overall."
    >
      <Row left="COMPLETED" tone="green">
        Money arrived <strong className="text-white">and</strong> the player's
        coins were granted. The normal successful deposit.
      </Row>
      <Row left="PROCESSING" tone="blue">
        Money arrived, coins were{" "}
        <strong className="text-white">not</strong> granted. The player is owed
        something — <strong className="text-white">the one to watch.</strong>
      </Row>
      <Row left="PENDING" tone="blue">
        We have not been told the money arrived. An open checkout, or a bank
        transfer still in flight. Nothing owed.
      </Row>
      <Row left="FAILED" tone="red">
        The payment was refused, refunded or charged back. The deposit did not
        fund the account.
      </Row>
      <Row left="EXPIRED" tone="amber">
        The checkout timed out at the provider before the player finished.
      </Row>
      <Row left="CANCELED" tone="amber">
        The player closed or cancelled the checkout.
      </Row>
    </Block>
  );

  const webhookBlock = (
    <Block
      title="Webhook result"
      subtitle="What we did with a notification the provider sent us."
    >
      <Row left="Processed" tone="green">
        Matched one of our records and updated it.
      </Row>
      <Row left="Unmatched" tone="amber">
        Verified as genuine, but nothing local matched it. If this is a payment
        event,{" "}
        <strong className="text-white">someone may have paid with no record</strong>
        {" "}on our side.
      </Row>
      <Row left="Rejected" tone="red">
        The signature or validation key did not verify — we answered 401. Usually
        a stale key in our environment.
      </Row>
      <Row left="Failed" tone="red">
        Our handler threw an error. The provider will retry for about 18 hours.
      </Row>
      <Row left="No change" tone="gray">
        Understood, but nothing needed updating — a duplicate, or a later event
        for something already resolved.
      </Row>
    </Block>
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Status guide"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-700/50 bg-[#1a2030]/50 px-3 text-xs text-gray-300 transition-all hover:border-purple-500/50 hover:bg-[#1a2030] hover:text-white shrink-0"
        >
          <Info className="h-4 w-4 text-purple-400" />
          {label}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white !w-full sm:!w-[460px] sm:!max-w-[460px] flex flex-col p-0"
      >
        <SheetHeader className="p-4 border-b border-gray-700">
          <SheetTitle className="text-white text-base">Status guide</SheetTitle>
          <p className="text-xs text-gray-400">
            Three vocabularies overlap here: the provider&apos;s word for the
            event, our record of the payment, and the deposit status. They are
            not synonyms.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
            <p className="text-xs text-gray-300 leading-relaxed break-words">
              <span className="text-white">In one line: </span>
              <span className="font-mono text-[11px] text-emerald-400">
                COMPLETED
              </span>{" "}
              = the provider says{" "}
              <span className="font-mono text-[11px]">Settled</span>{" "}
              <span className="text-white">and</span> the coins were credited. If
              the event says settled but the deposit says{" "}
              <span className="font-mono text-[11px] text-sky-400">
                PROCESSING
              </span>
              , the money arrived and the coins did not.
            </p>
          </div>

          {variant === "webhooks" ? webhookBlock : depositBlock}
          {variant === "webhooks" ? depositBlock : webhookBlock}

          <Block
            title="Coinflow event names"
            subtitle="What Coinflow calls it, and what it does to the deposit."
          >
            <Row left="Card Payment Authorized" tone="green">
              Card captured. Coins are granted here — we do not wait for
              settlement.
            </Row>
            <Row left="Settled" tone="green">
              Funds moved to the merchant account. Usually arrives after we have
              already credited.
            </Row>
            <Row left="Disbursed Funds" tone="green">
              Coinflow paid the money out to us. Bookkeeping only, no player
              impact.
            </Row>
            <Row left="USDC Payment Received" tone="green">
              The crypto rail&apos;s equivalent of a capture.
            </Row>
            <Row left="ACH Initiated / Batched" tone="blue">
              Bank transfer started or batched.{" "}
              <strong className="text-white">Not money yet</strong> — no coins
              yet.
            </Row>
            <Row left="Card Payment Declined" tone="red">
              The issuer refused. Nothing was taken.
            </Row>
            <Row left="ACH Failed / PIX Failed" tone="red">
              The bank refused.
            </Row>
            <Row left="Card Payment Voided" tone="amber">
              Authorisation cancelled before capture — the money never arrives.
              If we had already credited, it is treated as a reversal.
            </Row>
            <Row left="Payment / PIX Expiration" tone="amber">
              The player never finished in time.
            </Row>
            <Row left="ACH Returned" tone="red">
              The bank pulled the money back{" "}
              <strong className="text-white">after</strong> we had it.
            </Row>
            <Row left="Chargeback Opened / Lost" tone="red">
              Disputed and taken back. Coins may already be spent — needs a
              person.
            </Row>
            <Row left="Chargeback Won" tone="green">
              We won the dispute; the money stays and the deposit returns to
              completed.
            </Row>
            <Row left="Refund" tone="red">
              Refunded deliberately.
            </Row>
          </Block>

          <Block
            title="Breeze event names"
            subtitle="Breeze uses its own vocabulary for the same ideas."
          >
            <Row left="PAYMENT_CREATED" tone="blue">
              Checkout opened. Nothing paid.
            </Row>
            <Row left="PAYMENT_SUCCEEDED" tone="green">
              Paid, and the coins are granted.
            </Row>
            <Row left="PAYMENT_EXPIRED" tone="amber">
              The checkout timed out.
            </Row>
            <Row left="PAYMENT_ATTEMPT_FAILED" tone="red">
              The payment was declined.
            </Row>
            <Row left="PAYOUT_PAGE_STATUS_UPDATE" tone="gray">
              A withdrawal, not a deposit — shown under the Withdrawal flow.
            </Row>
          </Block>
        </div>
      </SheetContent>
    </Sheet>
  );
}
