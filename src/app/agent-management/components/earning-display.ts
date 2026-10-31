"use client";

import { EarningRecord } from "@/types/profile.type";

export const getPlatformGrossAmount = (record: EarningRecord) => {
  return -Number(record.netProfit);
};

export const getDisplayCommissionPercent = (
  record: EarningRecord,
) => {
  const grossAmount = getPlatformGrossAmount(record);
  const commissionAmount = Number(record.commissionAmount || 0);

  if (!grossAmount) {
    return 0;
  }

  return (commissionAmount / grossAmount) * 100;
};

export const getDisplayCommissionAmount = (
record: EarningRecord, p0: boolean,
) => {
  return Number(record.commissionAmount || 0);
};
