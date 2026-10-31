"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SystemConfigCardLower() {
  // Left Panel State
  const [maxBonus, setMaxBonus] = useState("2333.29");
  const [bonusAmount, setBonusAmount] = useState("46.66");
  const [minDeposit, setMinDeposit] = useState("116.66");
  const [rollover, setRollover] = useState("3");
  const [minWager, setMinWager] = useState("233.32");

  // Middle Panel State
  const [maxEsportsWin, setMaxEsportsWin] = useState("200000");
  const [maxCasinoWin, setMaxCasinoWin] = useState("200000");
  const [maxSlotsWin, setMaxSlotsWin] = useState("200000");
  const [maxBoardWin, setMaxBoardWin] = useState("200000");
  const [maxFishingWin, setMaxFishingWin] = useState("200000");
  const [maxLotteryWin, setMaxLotteryWin] = useState("200000");
  const [maxFastGameWin, setMaxFastGameWin] = useState("200000");

  // Right Panel State
  const [wulfPrefix, setWulfPrefix] = useState("AJD");
  const [agentPrefix, setAgentPrefix] = useState("AJD");
  const [agentMandatory, setAgentMandatory] = useState(true);
  const [hustleMode, setHustleMode] = useState(true);
  const [hustleTime, setHustleTime] = useState("300");
  const [hustleBuyIn, setHustleBuyIn] = useState("10");
  const [allowDevices, setAllowDevices] = useState("2");
  const [allowMultipleLogin, setAllowMultipleLogin] = useState("1");

  return (
    <div className="min-h-screen mt-3">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 max-w-[1400px]">
        {/* LEFT PANEL - Referral Bonus */}
        <div className="bg-[#191D24] rounded-xl p-4 space-y-6">
          <h2 className="text-white text-lg font-semibold">
            Referral Bonus (WW)
          </h2>

          {/* Max Bonus */}
          <div className="space-y-2">
            <Label className="text-sm text-white">Max Bonus</Label>
            <div className="flex items-center bg-[#242B35] border border-[#2C323D] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
              <div className="bg-[#15181E] px-4 py-2 text-sm text-gray-300 min-w-[60px] flex justify-center">
                WW
              </div>
              <input
                type="text"
                value={maxBonus}
                onChange={(e) => setMaxBonus(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Bonus Amount */}
          <div className="space-y-2">
            <Label className="text-sm text-white">Bonus Amount</Label>
            <div className="flex items-center bg-[#242B35] border border-[#2C323D] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
              <div className="bg-[#15181E] px-4 py-2 text-sm text-gray-300 min-w-[60px] flex justify-center">
                WW
              </div>
              <input
                type="text"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Min Deposit */}
          <div className="space-y-2">
            <Label className="text-sm text-white">Min Deposit</Label>
            <div className="flex items-center bg-[#242B35] border border-[#2C323D] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
              <div className="bg-[#15181E] px-4 py-2 text-sm text-gray-300 min-w-[60px] flex justify-center">
                USD
              </div>
              <input
                type="text"
                value={minDeposit}
                onChange={(e) => setMinDeposit(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Rollover */}
          <div className="space-y-2">
            <Label className="text-sm text-white">Rollover</Label>
            <div className="flex items-center bg-[#242B35] border border-[#2C323D] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
              <div className="bg-[#15181E] px-4 py-2 text-sm text-gray-300 min-w-[60px] flex justify-center">
                x
              </div>
              <input
                type="text"
                value={rollover}
                onChange={(e) => setRollover(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Min Wager */}
          <div className="space-y-2">
            <Label className="text-sm text-white">Min Wager</Label>
            <div className="flex items-center bg-[#242B35] border border-[#2C323D] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
              <div className="bg-[#15181E] px-4 py-2 text-sm text-gray-300 min-w-[60px] flex justify-center">
                USD
              </div>
              <input
                type="text"
                value={minWager}
                onChange={(e) => setMinWager(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="bg-purple-500 text-white hover:bg-purple-600 w-fit">
              Save
            </Button>
          </div>
        </div>

        {/* MIDDLE PANEL - Max Winning Settings */}
        <div className="bg-[#191D24] rounded-xl p-4 space-y-6">
          <h2 className="text-white text-lg font-semibold">
            Max Winning Settings
          </h2>

          {[
            {
              label: "Max Esports Win",
              value: maxEsportsWin,
              setter: setMaxEsportsWin,
            },
            {
              label: "Max Casino Win",
              value: maxCasinoWin,
              setter: setMaxCasinoWin,
            },
            {
              label: "Max Slots Win",
              value: maxSlotsWin,
              setter: setMaxSlotsWin,
            },
            {
              label: "Max Board Win",
              value: maxBoardWin,
              setter: setMaxBoardWin,
            },
            {
              label: "Max Fishing Win",
              value: maxFishingWin,
              setter: setMaxFishingWin,
            },
            {
              label: "Max Lottery Win",
              value: maxLotteryWin,
              setter: setMaxLotteryWin,
            },
            {
              label: "Max Fast Game Win",
              value: maxFastGameWin,
              setter: setMaxFastGameWin,
            },
          ].map((item, idx) => (
            <div key={idx} className="space-y-2">
              <Label className="text-sm text-white">{item.label}</Label>

              <div className="flex items-center bg-[#242B35] border border-[#2C323D] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
                {/* USD prefix */}
                <div className="bg-[#15181E] px-4 py-2 text-sm text-gray-300 flex items-center">
                  USD
                </div>

                {/* Input */}
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button className="bg-purple-500 text-white hover:bg-purple-600 w-fit">
              Save
            </Button>
          </div>
        </div>

        {/* RIGHT PANEL - Username & Settings */}
        <div className="space-y-3">
          {/* Wulf Casino Username Prefix */}
          <div className="bg-[#191D24] rounded-xl p-4 space-y-4">
            <h2 className="text-white text-lg font-semibold">
              Wulf Casino Username Prefix
            </h2>
            <input
              className="w-full bg-[#242B35] border border-[#2C323D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              type="text"
              value={wulfPrefix}
              onChange={(e) => setWulfPrefix(e.target.value)}
            />
            <div className="flex justify-end">
              <Button className="bg-purple-500 text-white hover:bg-purple-600 w-fit">
                Save
              </Button>
            </div>
          </div>

          {/* Agent Username Prefix */}
          <div className="bg-[#191D24] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white text-lg font-semibold">
                Agent Username Prefix
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Is Mandatory on Agent Setup
                </span>
                <Switch
                  checked={agentMandatory}
                  onCheckedChange={setAgentMandatory}
                  className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                />
              </div>
            </div>
            <input
              className="w-full bg-[#242B35] border border-[#2C323D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              type="text"
              value={agentPrefix}
              onChange={(e) => setAgentPrefix(e.target.value)}
            />
            <div className="flex justify-end">
              <Button className="bg-purple-500 text-white hover:bg-purple-600 w-fit">
                Save
              </Button>
            </div>
          </div>

          {/* Hustle Mode - Outside the grid */}
          <div className="bg-[#191D24] rounded-xl p-4 space-y-4 mt-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white text-lg font-semibold">Hustle Mode</h2>
              <Switch
                checked={hustleMode}
                onCheckedChange={setHustleMode}
                className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-white">Time</Label>
                <div className="flex items-center justify-between bg-[#242B35] border border-[#2C323D] rounded-lg px-3 py-2 text-sm text-white focus-within:ring-2 focus-within:ring-purple-500">
                  <input
                    type="text"
                    value={hustleTime}
                    onChange={(e) => setHustleTime(e.target.value)}
                    className="bg-transparent outline-none w-full text-white"
                  />
                  <span className="text-gray-400 ml-2">sec</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-white">Buy-in increments</Label>
                <div className="flex items-center justify-between bg-[#242B35] border border-[#2C323D] rounded-lg px-3 py-2 text-sm text-white focus-within:ring-2 focus-within:ring-purple-500">
                  <input
                    type="text"
                    value={hustleBuyIn}
                    onChange={(e) => setHustleBuyIn(e.target.value)}
                    className="bg-transparent outline-none w-full text-white"
                  />
                  <span className="text-gray-400 ml-2">%</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button className="bg-purple-500 text-white hover:bg-purple-600 w-fit">
                Save
              </Button>
            </div>
          </div>

          {/* IP & Device Restriction */}
          <div className="bg-[#191D24] rounded-xl p-4 space-y-4">
            <h2 className="text-white text-lg font-semibold">
              IP & Device Restriction
            </h2>
            <div className="space-y-2">
              <Label className="text-sm text-white">
                Allow number of devices
              </Label>
              <input
                className="w-full bg-[#242B35] border border-[#2C323D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                type="text"
                value={allowDevices}
                onChange={(e) => setAllowDevices(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-white">
                Allow Multiple User Login at same IP
              </Label>
              <input
                className="w-full bg-[#242B35] border border-[#2C323D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                type="text"
                value={allowMultipleLogin}
                onChange={(e) => setAllowMultipleLogin(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button className="bg-purple-500 text-white hover:bg-purple-600 w-fit">
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
