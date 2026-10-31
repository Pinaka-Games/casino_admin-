import { BonusType } from "@/types/bonus";

export const BONUS_REWARD_IMAGE_BY_TYPE: Partial<Record<BonusType, string>> = {
  [BonusType.HOURLY_RAKEBACK]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/reward1.svg",
  [BonusType.DAILY_RAKEBACK]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/reward2.svg",
  [BonusType.WEEKLY_RAKEBACK]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/reward3.svg",
  [BonusType.MONTHLY_RAKEBACK]:
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/reward4.svg",
};

export const BONUS_IMAGE_PRESETS: string[] = Array.from(
  new Set([
    ...Object.values(BONUS_REWARD_IMAGE_BY_TYPE),
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/trophy.svg",
    "https://wulf-asset-bucket.s3.us-east-1.amazonaws.com/wulfcasino/reward/wheel.svg",
  ]),
);

export const getBonusDefaultImageForType = (
  type?: BonusType,
): string | undefined => {
  if (!type) return undefined;
  return BONUS_REWARD_IMAGE_BY_TYPE[type];
};
