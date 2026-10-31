"use client";

export default function TierSettingsCard() {
  return (
    <div className="space-y-4 min-w-[360px]">
      {/* Deposit Settings */}
      <div className="bg-[#1a2030] rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold text-white">
            Deposit Settings
          </h4>
          <span className="text-xs text-gray-300">USD</span>
        </div>

        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex justify-between">
            <span>Minimum Deposit</span>
            <span>-</span>
          </div>
          <div className="flex justify-between">
            <span>Minimum Wager</span>
            <span>-</span>
          </div>
        </div>
      </div>

      {/* Withdrawal Settings */}
      <div className="bg-[#1a2030] rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold text-white">
            Withdrawal Settings
          </h4>
          <span className="text-xs text-gray-300">USD</span>
        </div>

        <div className="space-y-2 text-sm text-gray-400">
          <SettingRow label="Withdrawal Count Limit" value="3" />
          <SettingRow label="Minimum Withdrawal Bank" value="50" />
          <SettingRow label="Maximum Withdrawal Bank" value="30000" />
          <SettingRow label="Minimum Withdrawal EWallet" value="50" />
          <SettingRow label="Maximum Withdrawal EWallet" value="10000" />
          <SettingRow label="Minimum Withdrawal Crypto" value="100" />
          <SettingRow label="Maximum Withdrawal Crypto" value="5000" />
          <SettingRow label="Withdrawal Per Day" value="50000" />
          <SettingRow label="Withdrawal Per Week" value="-" />
          <SettingRow label="Withdrawal Per Month" value="-" />
        </div>
      </div>
    </div>
  );
}

/* ============================
   SMALL ROW COMPONENT
============================ */
function SettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
