"use client";

import React from "react";
import NoData from "@/components/NoData";

/* ============================
   TYPES
============================ */
interface DownlineRow {
  username: string;
  displayName: string;
  fullName: string;
  phone: string;
  registeredOn: string;
}

/* ============================
   MOCK DATA (AS PER IMAGE)
============================ */
const downlineData: DownlineRow[] = [
  {
    username: "dueltmp+zq6p0@gmail.com",
    displayName: "FuUPGnCDNW",
    fullName: "John",
    phone: "-",
    registeredOn: "2025-07-31 02:09 Am",
  },
  {
    username: "b.runol.ev.a.r.fe.so@gmail.com",
    displayName: "varmjFoqJE",
    fullName: "Tony",
    phone: "-",
    registeredOn: "2025-07-31 02:09 Am",
  },
];

const DownlineTab = () => {
  return (
    <div className="overflow-x-auto rounded-lg bg-[#15181E]">
      <table className="w-full min-w-[640px] table-fixed">
        {/* HEADERS */}
        <thead className="bg-[#242B35]">
          <tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left text-white text-xs">
              Username
            </th>
            <th className="px-4 py-3 text-left text-white text-xs">
              Display Name
            </th>
            <th className="px-4 py-3 text-left text-white text-xs">
              Full Name
            </th>
            <th className="px-4 py-3 text-left text-white text-xs">
              Phone
            </th>
            <th className="px-4 py-3 text-left text-white text-xs">
              Registered On
            </th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody>
          {downlineData.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-16">
                <NoData title="No downline found" />
              </td>
            </tr>
          ) : (
            downlineData.map((row, index) => (
              <tr
                key={index}
                className={`hover:bg-[#1a2030] ${
                  index % 2 === 0
                    ? "bg-[#191D24]"
                    : "bg-[#161A21]"
                }`}
              >
                <td className="px-4 py-3 text-gray-300 text-xs truncate">
                  {row.username}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs truncate">
                  {row.displayName}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs truncate">
                  {row.fullName}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs truncate">
                  {row.phone}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs truncate">
                  {row.registeredOn}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DownlineTab;
