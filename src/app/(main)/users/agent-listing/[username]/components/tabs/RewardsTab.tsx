"use client";

import React, { useState } from "react";

import { VaultHeader } from "../rewardcomponents/vault-header";
import { VaultSchedule } from "../rewardcomponents/vault-schedule";
import { CashbackSection } from "../rewardcomponents/cashback-section";
import { CurrentRankCard } from "../rewardcomponents/current-rank-card";
import {
  RankBonus,
  RankBonusesList,
} from "../rewardcomponents/rank-bonuses-list";
import {
  ClaimedReward,
  ClaimedRewardsGrid,
} from "../rewardcomponents/claimed-rewards-grid";

import { diamondcoin, platinumcoin, mastercoin } from "@/assets/images/banner";
import DisableRewardToggle from "../rewardcomponents/DisableRewardToggle";

/* ------------------ DATA ------------------ */

const ranks: RankBonus[] = [
  {
    name: "Platinum",
    wager: "$465,000.00",
    bonus: "+$34.00",
    color: "bg-cyan-400",
    image: platinumcoin,
  },
  {
    name: "Diamond",
    wager: "$645,000.00",
    bonus: "+$164.00",
    color: "bg-purple-400",
    image: diamondcoin,
  },
  {
    name: "Master",
    wager: "$855,000.00",
    bonus: "+$614.00",
    color: "bg-red-400",
    image: mastercoin,
  },
];

const claimedRewards: ClaimedReward[] = [
  { label: "Total Rewards", value: "$17,509.22" },
  { label: "Vault", value: "$11,665.70" },
  { label: "Instant Cashback", value: "$966.91" },
  { label: "Daily Bonus", value: "$2,035.97" },
  { label: "Weekly Bonus", value: "$1,509.22" },
  { label: "Monthly Bonus", value: "$965.17" },
  { label: "Bonus Bonus", value: "$765.84" },
];

const handleClaim = () => {
};

/* ------------------ COMPONENT ------------------ */

const RewardsTab = () => {
  const [isDisabled, setIsDisabled] = useState(false);

  return (
    <div className="px-4 mx-auto space-y-6">
      {/* TOGGLE */}
      <DisableRewardToggle value={isDisabled} onChange={setIsDisabled} />

      {/* REWARD CONTENT */}
      {!isDisabled && (
        <>
          <VaultHeader />
          <VaultSchedule />
          <CashbackSection />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CurrentRankCard
              rank="Gold"
              progress={30}
              wagerRemaining="$0.80"
              onClaim={handleClaim}
            />
            <RankBonusesList ranks={ranks} />
          </div>

          <ClaimedRewardsGrid rewards={claimedRewards} />
        </>
      )}
    </div>
  );
};

export default RewardsTab;

