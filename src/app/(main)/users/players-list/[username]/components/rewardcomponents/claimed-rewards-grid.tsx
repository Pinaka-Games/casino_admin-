export interface ClaimedReward {
  label: string
  value: string
}

interface ClaimedRewardsGridProps {
  rewards: ClaimedReward[]
}

export function ClaimedRewardsGrid({ rewards }: ClaimedRewardsGridProps) {
  // Same wording the player sees on /rewards. These used to differ ("Daily
  // Streak Reward" here vs "Vault" there for the identical figure), which made
  // the two screens look like they were reporting different things.
  const getLabel = (label: string) => {
    const mapping: Record<string, string> = {
      totalRewards: "Total Rewards",
      nextReward: "Next Reward",
      vault: "Vault",
      vaultCoins: "Vault Coins",
      dailyStreak: "Vault",
      instantRebate: "Instant Rebate",
      instantCashback: "Instant Cashback",
      dailyBonus: "Daily Bonus",
      weeklyBonus: "Weekly Cashback",
      monthlyBonus: "Monthly Cashback",
      rankupBonus: "Rankup Bonus",
    };
    return mapping[label] || label.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  };

  return (
    <div>
      <p className="text-xl text-white mb-5">Claimed Rewards</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {rewards.map((reward, index) => (
          <div key={index} className="bg-[#191D24] rounded-xl p-4">
            <p className="text-[#9590C0] text-[16px] mb-1">{getLabel(reward.label)}</p>
            <p className="text-white text-lg md:text-3xl font-medium">{reward.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

