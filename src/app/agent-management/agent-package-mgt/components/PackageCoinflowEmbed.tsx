"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CoinflowCheckoutParams } from "@/api/package/agent-package.api";

// Which payment methods the embedded checkout offers. Only methods enabled on the
// merchant account in the Coinflow dashboard actually appear. Override via
// NEXT_PUBLIC_COINFLOW_PAYMENT_METHODS (comma-separated). Mirrors the user-side
// subscription embed.
const ALLOWED_PAYMENT_METHODS: string[] =
  process.env.NEXT_PUBLIC_COINFLOW_PAYMENT_METHODS?.split(",")
    .map((m) => m.trim())
    .filter(Boolean) ?? [
    "card",
    "ach",
    "fasterPayments",
    "sepa",
    "pix",
    "usdc",
    "googlePay",
    "applePay",
    "credits",
    "crypto",
    "wire",
    "cashApp",
    "rain",
  ];

// Coinflow recurring checkout via the official SDK: <CoinflowPurchase planCode=…>.
// On success the agent-package webhook/confirm activates the plan.
const CoinflowPurchase = dynamic(
  () => import("@coinflowlabs/react").then((mod) => mod.CoinflowPurchase),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[360px] sm:min-h-[560px] items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-[#B146F5]" />
      </div>
    ),
  },
);

interface Props {
  checkout: CoinflowCheckoutParams;
  // paymentId comes from Coinflow's in-page success event; the page posts it to
  // the backend confirm endpoint so activation doesn't depend on the webhook.
  onSuccess: (paymentId?: string) => void;
}

export function PackageCoinflowEmbed({ checkout, onSuccess }: Props) {
  const [handled, setHandled] = useState(false);
  const [contentHeight, setContentHeight] = useState<string>("720px");

  if (!checkout?.sessionKey || !checkout?.merchantId || !checkout?.planCode) {
    return null;
  }

  // Tell Coinflow which origin is embedding it (must also be allow-listed in the
  // Coinflow merchant dashboard, or the submit fails server validation).
  const origins =
    typeof window !== "undefined" ? [window.location.origin] : undefined;

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        overflowY: "auto",
        background: "#fff",
      }}
    >
      <div style={{ height: contentHeight, width: "100%" }}>
        <CoinflowPurchase
          sessionKey={checkout.sessionKey}
          merchantId={checkout.merchantId}
          env={checkout.env as never}
          planCode={checkout.planCode}
          {...(checkout.email ? { email: checkout.email } : {})}
          webhookInfo={checkout.webhookInfo}
          chargebackProtectionData={
            (checkout.chargebackProtectionData ?? []) as never
          }
          origins={origins}
          // Resolved by the API from Payment Manager (agent pay-in rails). The
          // local list is only the fallback for a session minted before the
          // server started sending it.
          allowedPaymentMethods={
            (checkout.allowedPaymentMethods?.length
              ? checkout.allowedPaymentMethods
              : ALLOWED_PAYMENT_METHODS) as never
          }
          loaderBackground="#ffffff"
          handleHeightChange={(height) => {
            if (height) {
              setContentHeight(height.endsWith("px") ? height : `${height}px`);
            }
          }}
          onSuccess={(args) => {
            if (handled) return;
            setHandled(true);
            const paymentId =
              typeof args === "string" ? args : (args as any)?.paymentId;
            onSuccess(paymentId);
          }}
        />
      </div>
    </div>
  );
}
