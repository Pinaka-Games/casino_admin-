"use client";

import TrendingAge from "./components/TrendingAge";
import TrendingCountry from "./components/TrendingCountry";
import TrendingDefault from "./components/TrendingDefault";
import TrendingEthnicity from "./components/TrendingEthnicity";
import TrendingGender from "./components/TrendingGender";
import TrendingState from "./components/TrendingState";
import PersonalizationStatusToggle from "./components/PersonalizationStatusToggle";

export default function PersonalizationPage() {
  return (
    <div className="flex flex-col bg-[#15181E] p-3 md:p-4 min-w-0 overflow-x-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-3 px-3 md:px-4 py-2 rounded-md flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h1 className="whitespace-nowrap text-base font-normal text-white">
          Settings / Personalization
        </h1>
        <PersonalizationStatusToggle />
      </div>
      {/* CONTENT */}
      <div className="flex flex-col gap-4">
        <TrendingDefault />
        <TrendingEthnicity />
        <TrendingCountry />
        <TrendingGender />
        <TrendingState />
        <TrendingAge />
      </div>
    </div>
  );
}
