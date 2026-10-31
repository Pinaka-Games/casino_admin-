"use client";

import { coingold ,coingreen} from "@/assets/icons";
import { favoriteGames, recentlyPlayedGames } from "@/data/rewardsdata";
import Image from "next/image";
import { useMemo, useState } from "react";

interface DeviceActivity {
  deviceId: string;
  lastLogin: string;
  ipAddress: string;
  location: string;
}

interface GameHistory {
  id: string;
  game: string;
  buyIn: number;
  multiplier: string;
  profitLoss: number;
}

const deviceActivities: DeviceActivity[] = [
  {
    deviceId: "Mac: 00-B0-D0-63-C2-26",
    lastLogin: "25 Jan 2025 10:00 am",
    ipAddress: "00-B0-D0-64-C1-36",
    location: "Texas, US",
  },
  {
    deviceId: "Mac: 00-B0-D0-63-C2-26",
    lastLogin: "25 Jan 2025 10:00 am",
    ipAddress: "00-B0-D0-64-C1-36",
    location: "Newyork, US",
  },
  {
    deviceId: "Mac: 00-B0-D0-63-C2-26",
    lastLogin: "25 Jan 2025 10:00 am",
    ipAddress: "00-B0-D0-64-C1-36",
    location: "Newyork, US",
  },
  {
    deviceId: "Mac: 00-B0-D0-63-C2-26",
    lastLogin: "25 Jan 2025 10:00 am",
    ipAddress: "00-B0-D0-64-C1-36",
    location: "Texas, US",
  },
];

const gameHistory: GameHistory[] = [
  {
    id: "1839346030849006395",
    game: "Crash",
    buyIn: 10,
    multiplier: "1.92",
    profitLoss: 20.25,
  },
  {
    id: "1839346030849006395",
    game: "Crash",
    buyIn: 10,
    multiplier: "0x",
    profitLoss: -10.05,
  },
];

const ActivityTab = () => {
  const gameHistoryWithCoin = useMemo(() => {
  const idCount: Record<string, number> = {};

  return gameHistory.map((row) => {
    idCount[row.id] = (idCount[row.id] || 0) + 1;

    return {
      ...row,
      coinType: idCount[row.id] === 1 ? "green" : "gold",
    };
  });
}, []);

  return (
    <div className="w-full overflow-x-hidden space-y-2">
      <div className="space-y-10 w-full">
      <Section title="Favorites games" data={favoriteGames} />
        <Section title="Recently Played Games" data={recentlyPlayedGames} />
      </div>
      <div>

        <h3 className="text-gray-400 text-md mb-3">Device activities</h3>

        <div className="rounded-lg bg-[#15181E]">
          <table className="w-full table-fixed">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-center text-xs text-white">
                  Device ID / Name
                </th>
                <th className="px-4 py-3 text-center text-xs text-white">
                  Last Login
                </th>
                <th className="px-4 py-3 text-center text-xs text-white">
                  IP address
                </th>
                <th className="px-4 py-3 text-center text-xs text-white">
                  Location
                </th>
                <th className="px-4 py-3 text-center text-xs text-white">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {deviceActivities.map((row, index) => (
                <tr
                  key={index}
                  className={`hover:bg-[#1a2030] ${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.deviceId}
                  </td>

                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.lastLogin}
                  </td>

                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.ipAddress}
                  </td>

                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.location}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <button className="bg-red-500 hover:bg-red-600 text-white text-xs px-4 py-2 rounded-lg">
                      Restrict
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= GAME HISTORY ================= */}
      <div>
        <h3 className="text-gray-400 text-md mb-3">Game History</h3>

        <div className="rounded-lg bg-[#15181E]">
          <table className="w-full table-fixed">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-center text-xs text-white">ID</th>
                <th className="px-4 py-3 text-center text-xs text-white">
                  Game
                </th>
                <th className="px-4 py-3 text-center text-xs text-white">
                  Buy In
                </th>
                <th className="px-4 py-3 text-center text-xs text-white">
                  Multiplier
                </th>
                <th className="px-4 py-3 text-center text-xs text-white">
                  Profit / Loss
                </th>
              </tr>
            </thead>

            <tbody>
              {gameHistoryWithCoin.map((row, index) => (
                <tr
                  key={index}
                  className={`hover:bg-[#1a2030] ${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.id}
                  </td>

                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.game}
                  </td>

                  <td className="px-4 py-4 text-center text-xs font-medium text-gray-300">
  <div className="flex items-center justify-center gap-1">
    <Image
      src={row.coinType === "green" ? coingreen : coingold}
      alt="coin"
      width={12}
      height={12}
    />
    <span>{row.buyIn.toFixed(2)}</span>
  </div>
</td>


                  <td className="px-4 py-4 text-center text-xs text-gray-300">
                    {row.multiplier}
                  </td>

                  <td
  className={`px-4 py-4 text-center text-xs font-medium ${
    row.profitLoss >= 0 ? "text-green-400" : "text-red-400"
  }`}
>
  <div className="flex items-center justify-center gap-1">
    <Image
      src={row.coinType === "green" ? coingreen : coingold}
      alt="coin"
      width={12}
      height={12}
    />
    <span>
      {row.profitLoss >= 0 ? "+" : ""}
      {row.profitLoss.toFixed(2)}
    </span>
  </div>
</td>


                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ActivityTab;



function Section({ title, data }: { title: string; data: any[] }) {
  const [expanded, setExpanded] = useState(false);

  // 👇 number of items per row depends on screen
  const ITEMS_PER_ROW = 8; // desktop reference
  const MAX_ROWS = 1;

  const maxVisibleItems = ITEMS_PER_ROW * MAX_ROWS;

  const shouldShowViewAll = data.length > maxVisibleItems;

  const visibleData = useMemo(() => {
    if (expanded) return data;
    return data.slice(0, maxVisibleItems);
  }, [expanded, data]);

  return (
    <div className="space-y-3 w-full">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-white/80 text-sm font-medium">{title}</h2>

        {shouldShowViewAll && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-md text-[#B93DEB] "
          >
            {expanded ? "Show Less" : "View All"}
          </button>
        )}
      </div>

      {/* GRID */}
      <div className="w-full overflow-hidden">
        <div
          className="
            grid
            gap-1 sm:gap-2 md:gap-2
            grid-cols-[repeat(auto-fit,minmax(80px,1fr))]
            sm:grid-cols-[repeat(auto-fit,minmax(100px,1fr))]
            md:grid-cols-[repeat(auto-fit,minmax(110px,1fr))]
            lg:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]
            transition-all
          "
        >
          {visibleData.map((game) => (
            <div
              key={game.id}
              className="
                bg-[#1A2027]
                rounded-xl
                overflow-hidden
                cursor-pointer
                transition-transform
                duration-300
                hover:-translate-y-1
              "
            >
              <div className="relative aspect-[3/4] w-full">
                <Image
                  src={game.image}
                  alt={game.title}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}