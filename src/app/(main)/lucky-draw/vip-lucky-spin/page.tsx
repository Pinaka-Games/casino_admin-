"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Users, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";
import FreeSpinUpsertModal from "./components/FreeSpinUpsertModal";
import FreeSpinRemoveModal from "./components/FreeSpinRemoveModal";
import { FreeSpin, CreateFreeSpinDto } from "@/types/free-spin";
import { useFreeSpinConfigStore } from "@/store/free-spin-config-store";
import {
  WiredAs,
  useFreeSpinWiringsStore,
} from "@/store/free-spin-wirings-store";
import ListSearch from "@/components/TableSearch/ListSearch";
import { create } from "@/assets/images/action";
import {
  resolveSelections,
  summarizeGames,
  summarizeProviders,
  summarizeTemplateSpins,
} from "@/lib/free-spin-selection";

const PAGE_SIZE = 10;

const WIRED_BADGE: Record<WiredAs, { label: string; className: string }> = {
  welcome:      { label: "Welcome",      className: "bg-blue-500/20 text-blue-300" },
  streak:       { label: "Streak",       className: "bg-purple-500/20 text-purple-300" },
  vip:          { label: "VIP",          className: "bg-yellow-500/20 text-yellow-300" },
  subscription: { label: "Subscription", className: "bg-green-500/20 text-green-300" },
  bundle:       { label: "Bundle",       className: "bg-pink-500/20 text-pink-300" },
};

export default function FreeSpinConfigPage() {
  const router = useRouter();
  const { configs, loading, fetchConfigs, createConfig, updateConfig, deleteConfig } =
    useFreeSpinConfigStore();
  const wiredMap = useFreeSpinWiringsStore((state) => state.wiredMap);
  const loadWirings = useFreeSpinWiringsStore((state) => state.loadWirings);

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editRow, setEditRow] = useState<FreeSpin | null>(null);
  const [removeRow, setRemoveRow] = useState<FreeSpin | null>(null);
  const [openRemoveModal, setOpenRemoveModal] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load templates and their wiring badges together so the table paints once.
  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      await Promise.all([fetchConfigs(false), loadWirings()]);
      if (mounted) setInitialLoading(false);
    };
    void loadInitialData();
    return () => {
      mounted = false;
    };
  }, [fetchConfigs, loadWirings]);

  // Search covers the game names inside `selections` too, so a template can be
  // found by any game it grants — not just by the one mirrored onto gameName.
  const filteredConfigs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return configs;

    return configs.filter((row) => {
      const values = [
        row.name,
        row.description,
        row.softwareName,
        row.gameName,
        String(row.numberOfFreeSpins ?? ""),
        row.winningsTarget === "bonus_sc" ? "bonus wulf cash" : "wulf cash",
        // Searchable by the wallet the spins play in, which is the column an
        // admin actually scans this table for.
        row.spinCurrency === "GC" ? "gc wulf coin" : "sc wulf cash",
        ...resolveSelections(row).flatMap((s) => [
          s.softwareName ?? "",
          ...s.games.map((g) => g.name ?? String(g.id)),
        ]),
      ];
      return values.some((v) => String(v ?? "").toLowerCase().includes(term));
    });
  }, [configs, search]);

  const totalPages = Math.ceil(filteredConfigs.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredConfigs.slice(start, start + PAGE_SIZE);
  }, [filteredConfigs, currentPage]);

  // Narrowing the list can strand the viewer on a page that no longer exists.
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleUpsert = async (data: CreateFreeSpinDto) => {
    if (editRow) {
      await updateConfig(editRow.id, data);
    } else {
      await createConfig(data);
    }
    setOpenModal(false);
    setEditRow(null);
  };

  const handleDelete = async () => {
    if (!removeRow) return;
    await deleteConfig(removeRow.id);
    setOpenRemoveModal(false);
    setRemoveRow(null);
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-4 overflow-hidden">
      <div className="bg-[#191D24] mb-3 px-3 py-2 rounded-lg flex flex-col items-stretch gap-2 md:mb-4 md:flex-row md:items-center md:justify-between md:gap-4 md:px-4">
        <h1 className="text-base font-normal text-white">
          VIP / Spin Configuration
        </h1>
        {/* Entered from Free Spin Allocation — this page is no longer in the
            sidebar, so it has to offer the way back. */}
        <Link href="/lucky-draw/newbie-lucky-spin" className="shrink-0">
          <Button
            variant="outline"
            className="h-9 w-full border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white md:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Free Spin Allocation
          </Button>
        </Link>
      </div>

      <div className="bg-[#191D24] rounded-lg p-3 mb-3 shrink-0 md:mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <ListSearch
              value={search}
              onChange={setSearch}
              showButton={false}
              placeholder="Search by name, provider, game..."
            />
          </div>

          {/* Templates and the players holding them are two halves of the same
              job, so each page links straight to the other. */}
          <button
            onClick={() => router.push("/lucky-draw/newbie-lucky-spin")}
            className="flex items-center gap-2 h-9 px-4 bg-[#242B35] hover:bg-[#2b3340] border border-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
          >
            <Users size={14} />
            Go to Allocation
          </button>

          {/* Export what the search is showing, not the unfiltered list. */}
          <ExportCSV
            data={filteredConfigs}
            fileName="free_spin_config.csv"
            getRowDate={(row) => row.createdAt}
            headers={[
              "Name",
              "Total Spins",
              "Spins / Game",
              "Software",
              "Game",
              "Level",
              // "Campaign Reference",
              "Grant Expiry Days",
              "Spin Currency",
              "Winnings Target",
              "Extra Playthrough",
              "Status",
            ]}
            mapRow={(row) => [
              row.name,
              summarizeTemplateSpins(row).totalSpins,
              row.numberOfFreeSpins ?? 0,
              row.softwareName ?? row.softwareId ?? "",
              row.gameName ?? row.gameId ?? "",
              row.betLevel ?? "",
              // row.casinoCampaignId ?? "",
              row.grantExpiresInDays ?? "",
              row.spinCurrency === "GC" ? "Wulf Coin (GC)" : "Wulf Cash (SC)",
              row.winningsTarget === "bonus_sc" ? "Bonus Wulf Cash" : "Wulf Cash",
              row.winningsWageringMultiplier ?? 0,
              row.isActive ? "Active" : "Inactive",
            ]}
          />

          <Button
            className="h-9 w-9 p-0 flex items-center justify-center bg-[#242B35] text-white border border-gray-600"
            onClick={() => {
              setEditRow(null);
              setOpenModal(true);
            }}
          >
            <Image src={create} alt="Create" width={20} height={20} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide">
        {loading || initialLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
          </div>
        ) : (
          <table className="w-full items-center overflow-x-auto justify-center text-center table-fixed">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-center text-xs text-white w-40">Name</th>
                <th className="px-4 py-3 text-center text-xs text-white w-20">Spins</th>
                <th className="px-4 py-3 text-center text-xs text-white w-28">Software</th>
                <th className="px-4 py-3 text-center text-xs text-white w-28">Game</th>
                <th className="px-4 py-3 text-center text-xs text-white w-20">Level</th>
                {/* <th className="px-4 py-3 text-center text-xs text-white w-32">Campaign</th> */}
                <th className="px-4 py-3 text-center text-xs text-white w-24">Expiry</th>
                <th className="px-4 py-3 text-center text-xs text-white w-24">Currency</th>
                <th className="px-4 py-3 text-center text-xs text-white w-28">Winnings</th>
                <th className="px-4 py-3 text-center text-xs text-white w-28">Wired As</th>
                <th className="px-4 py-3 text-center text-xs text-white w-28">Status</th>
                <th className="px-4 py-3 text-center text-xs text-white w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-20">
                    <NoData
                      title={
                        search
                          ? `No template matches "${search}"`
                          : "No free spin config found"
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const wired = wiredMap[row.id] ?? [];
                  return (
                  <tr key={row.id} className="hover:bg-[#1a2030] bg-[#191D24]">
                    <td className="px-4 py-3 text-gray-300 text-xs">{row.name}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {/* Total per player — each game is a separate grant. */}
                      {summarizeTemplateSpins(row).totalSpins}
                      <span className="block text-[10px] text-gray-500">
                        {row.numberOfFreeSpins ?? 0}/game
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{summarizeProviders(row)}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{summarizeGames(row)}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{row.betLevel ?? "-"}</td>
                    {/* <td className="px-4 py-3 text-gray-300 text-xs">{row.casinoCampaignId || "-"}</td> */}
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.grantExpiresInDays ? `${row.grantExpiresInDays}d` : "-"}
                    </td>
                    {/* Which wallet the rounds play in. A GC template is only
                        playable in a Wulf Coin session and an SC one only in
                        Wulf Cash, so this is the first thing to check when a
                        player reports missing free spins. */}
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          row.spinCurrency === "GC"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-green-500/20 text-green-300"
                        }`}
                      >
                        {row.spinCurrency === "GC" ? "GC" : "SC"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs uppercase">
                      {row.winningsTarget === "bonus_sc" ? "Bonus Wulf Cash" : "Wulf Cash"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {wired.length === 0 ? (
                        <span className="text-gray-500 text-[10px]">—</span>
                      ) : (
                        <div className="flex flex-wrap justify-center gap-1">
                          {wired.map((w) => {
                            const tooltip =
                              w === "welcome"
                                ? "Wired in System Configuration → Bonus Defaults as the Welcome Free Spin"
                                : w === "streak"
                                  ? "Wired in Daily Streak settings as the Free Spin Day Multiplier template"
                                  : w === "vip"
                                    ? "Wired on at least one VIP tier (granted once, on rank-up)"
                                    : "Wired on at least one subscription plan (granted on buy/upgrade + weekly cron)";
                            return (
                              <span
                                key={w}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${WIRED_BADGE[w].className}`}
                                title={tooltip}
                              >
                                {WIRED_BADGE[w].label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={row.isActive}
                        onCheckedChange={(checked) =>
                          updateConfig(row.id, { isActive: checked })
                        }
                        className="data-[state=checked]:bg-purple-600"
                        aria-label={
                          row.isActive
                            ? "Deactivate free spin config"
                            : "Activate free spin config"
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-orange-400 hover:text-orange-300">
                            <Wrench size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-[#1a2030] text-white border border-white p-2"
                        >
                          <DropdownMenuItem
                            onClick={() => {
                              setEditRow(row);
                              setOpenModal(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400"
                            onClick={() => {
                              setRemoveRow(row);
                              setOpenRemoveModal(true);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 mt-3 md:mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <FreeSpinUpsertModal
        open={openModal}
        initialData={editRow}
        onClose={() => {
          setOpenModal(false);
          setEditRow(null);
        }}
        onSubmit={handleUpsert}
      />

      <FreeSpinRemoveModal
        open={openRemoveModal}
        data={removeRow}
        onClose={() => {
          setOpenRemoveModal(false);
          setRemoveRow(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
