"use client";

import React from "react";

interface GameRow {
  gameName: string;
  playerName: string;
  buyIn: number;
  multiplier: string;
  profitLoss: number;
}

const gameData: GameRow[] = [
  {
    gameName: "Crash",
    playerName: "—",
    buyIn: 10,
    multiplier: "1.92",
    profitLoss: 20.25,
  },
  {
    gameName: "Crash",
    playerName: "—",
    buyIn: 10,
    multiplier: "0x",
    profitLoss: -10.05,
  },
];

const RevenueTab = () => {
  return (
    <div className="space-y-6">
      {/* ================= GAME TABLE ================= */}
      <div className="overflow-x-auto rounded-lg bg-[#15181E]">
        <table className="w-full min-w-[640px] table-fixed">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-center text-white text-xs">
                Game name
              </th>
              <th className="px-4 py-3 text-center text-white text-xs">
                Player name
              </th>
              <th className="px-4 py-3 text-center text-white text-xs">
                Buy In
              </th>
              <th className="px-4 py-3 text-center text-white text-xs">
                Multiplier
              </th>
              <th className="px-4 py-3 text-center text-white text-xs">
                Profit / Loss
              </th>
            </tr>
          </thead>

          <tbody>
            {gameData.map((row, index) => (
              <tr
                key={index}
                className={`hover:bg-[#1a2030] ${
                  index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                }`}
              >
                <td className="px-4 py-3 text-gray-300 text-xs text-center">
                  {row.gameName}
                </td>

                <td className="px-4 py-3 text-gray-400 text-xs text-center">
                  {row.playerName}
                </td>

                <td className="px-4 py-3 text-gray-300 text-xs">
                  <div className="flex items-center justify-center gap-1">
                    💰 {row.buyIn}
                  </div>
                </td>

                <td className="px-4 py-3 text-gray-300 text-xs text-center">
                  {row.multiplier}
                </td>

                <td
                  className={`px-4 py-3 text-xs text-center font-medium ${
                    row.profitLoss >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {row.profitLoss >= 0 ? "+" : ""}
                  {row.profitLoss.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= STATISTICS ================= */}
      <div>
        <h3 className="text-gray-400 text-md mb-3">Statistics</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Downline member" value="46582" />
          <StatCard title="Agent Earnings" value="$11,665.70" sub="Last 30 days" />
          <StatCard
            title="Platform Earning"
            value="$966.91"
            sub="Last 30 days"
          />
          <StatCard title="Agent Balance" value="$2,035.97" />
          <StatCard title="Settlement" value="Bi Weekly" />
          <StatCard title="Bonus" value="$965.17" />
          <StatCard title="Total Cashback" value="$765.84" />
        </div>
      </div>
    </div>
  );
};

/* ================= STAT CARD ================= */
const StatCard = ({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) => {
  return (
    <div className="bg-[#15181E] rounded-xl p-5 space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-gray-400 text-sm">{title}</p>
        {sub && (
          <p className="text-gray-500 text-xs whitespace-nowrap">{sub}</p>
        )}
      </div>

      <p className="text-white text-2xl font-semibold">{value}</p>
    </div>
  );
};

export default RevenueTab;

