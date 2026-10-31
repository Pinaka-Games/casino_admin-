"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import toast from "react-hot-toast";


import {
  facebook2,
  telegram2,
  linkedin,
  whatsaap,
} from "@/assets/images/referral";
import Image from "next/image";

interface ReferralPromotionProps {
  agentCode: string;    
}

export function ReferralPromotion({ agentCode }: ReferralPromotionProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  /**
   * Base URL of the PLAYER site — where a referred user actually registers.
   *
   * This must never fall back to the admin origin. Doing so emitted links like
   * "https://admin-staging.wulfcasino.com/en/register?ref=XXXX": a valid-looking
   * URL pointing at the admin panel, where no player can sign up. Referrals
   * shared that way are lost silently, and the agent never earns on them.
   *
   * The value is NOT derived from the admin host either. The two are not
   * mirror images per environment — the admin panel at
   * admin-staging.wulfcasino.com pairs with the player site at
   * dev.wulfcasino.com (hestabit_User/src/app/layout.tsx) — so any host rewrite
   * would just produce a different wrong link. Configured explicitly, or the UI
   * says so.
   */
  const getUserFrontendUrl = () =>
    (process.env.NEXT_PUBLIC_USER_FRONTEND_URL || "").replace(/\/$/, "");

  const userFrontendUrl = getUserFrontendUrl();
  const referralLink = userFrontendUrl
    ? `${userFrontendUrl}/en/register?ref=${agentCode}`
    : "";

  const handleCopy = (text: string, type: "code" | "link") => {
    if (!text) {
      toast.error("Not available");
      return;
    }
    navigator.clipboard.writeText(text);
    
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
    
    toast.success(`${type === "code" ? "Referral code" : "Referral link"} copied!`);
  };

  return (
    <Card className="p-4 sm:p-6 bg-[#191D24] border-gray-800 overflow-hidden">
      <div className="space-y-4">
        {/* INPUTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* REFERRAL LINK */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400 block px-1">
              Referral Link
            </label>
            <div className="flex gap-2 items-center min-w-0">
              <input
                readOnly
                value={referralLink || "Player site URL not configured"}
                className={`flex-1 min-w-0 h-11 rounded-lg bg-[#1C2128] border px-3 sm:px-4 text-xs sm:text-sm focus:outline-none transition-colors ${
                  referralLink
                    ? "border-gray-800 text-white focus:border-purple-500/50"
                    : "border-red-500/40 text-red-400"
                }`}
              />
              <button
                onClick={() => handleCopy(referralLink, 'link')}
                disabled={!referralLink}
                className="shrink-0 rounded-lg bg-[#B93DEB] hover:bg-[#A030D0] transition-colors flex items-center justify-center w-11 h-11 disabled:opacity-40 disabled:cursor-not-allowed"
                title={copiedLink ? "Copied!" : "Copy link"}
              >
                {copiedLink ? (
                  <Check size={18} className="text-white" />
                ) : (
                  <Copy size={18} className="text-white" />
                )}
              </button>
            </div>
            {/* Better a visible gap than a link to the admin panel: a player
                cannot register there, so sharing it loses the referral. */}
            {!referralLink && (
              <p className="text-[11px] text-red-400/80 px-1">
                Set NEXT_PUBLIC_USER_FRONTEND_URL on the admin app to the player
                site URL. The referral code below still works when entered manually.
              </p>
            )}
          </div>

          {/* REFERRAL CODE */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400 block px-1">
              Referral Code
            </label>
            <div className="flex gap-2 items-center min-w-0">
              <input
                readOnly
                value={agentCode || "------"}
                className="flex-1 min-w-0 h-11 rounded-lg bg-[#1C2128] border border-gray-800 px-3 sm:px-4 text-sm font-bold font-mono tracking-wider text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
              <button
                onClick={() => handleCopy(agentCode, 'code')}
                className="shrink-0 rounded-lg bg-[#B93DEB] hover:bg-[#A030D0] transition-colors flex items-center justify-center w-11 h-11"
                title={copiedCode ? "Copied!" : "Copy code"}
              >
                {copiedCode ? (
                  <Check size={18} className="text-white" />
                ) : (
                  <Copy size={18} className="text-white" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* SOCIAL SHARES */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 pt-1">
          <span className="text-sm font-medium text-gray-400 whitespace-nowrap">
            Share via socials
          </span>
          <div className="flex items-center gap-2">
            {[
              {
                icon: facebook2,
                action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank')
              },
              {
                icon: telegram2,
                action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join me on Wulf Casino!")}`, '_blank')
              },
              {
                icon: linkedin,
                action: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`, '_blank')
              },
              {
                icon: whatsaap,
                action: () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent("Join me on Wulf Casino! " + referralLink)}`, '_blank')
              },
            ].map((item, i) => (
              <div
                key={i}
                // Sharing an empty URL would post a bare "Join me on Wulf Casino!"
                // with nothing to click, so the icons go inert until the player
                // site URL is configured.
                onClick={referralLink ? item.action : undefined}
                aria-disabled={!referralLink}
                className={`w-9 h-9 rounded-full bg-[#1C2128] border border-gray-800 flex items-center justify-center transition-colors group/icon ${
                  referralLink
                    ? "cursor-pointer hover:border-gray-700 hover:bg-[#242B35]"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                <Image src={item.icon} alt="social" width={20} height={20} className="opacity-80 group-hover/icon:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
