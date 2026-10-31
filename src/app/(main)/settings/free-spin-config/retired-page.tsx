"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Wrench } from "lucide-react";
import Image from "next/image";

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
import { create } from "@/assets/images/action";
import {
  summarizeGames,
  summarizeProviders,
  summarizeTemplateSpins,
} from "@/lib/free-spin-selection";

const PAGE_SIZE = 10;

export default function FreeSpinConfigPage() {
  const { configs, loading, fetchConfigs, createConfig, updateConfig, deleteConfig } =
    useFreeSpinConfigStore();

  const [currentPage, setCurrentPage] = useState(1);
  const [openModal, setOpenModal] = useState(false);
  const [editRow, setEditRow] = useState<FreeSpin | null>(null);
  const [removeRow, setRemoveRow] = useState<FreeSpin | null>(null);
  const [openRemoveModal, setOpenRemoveModal] = useState(false);

  useEffect(() => {
    fetchConfigs(false);
  }, []);

  const totalPages = Math.ceil(configs.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return configs.slice(start, start + PAGE_SIZE);
  }, [configs, currentPage]);

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
    <div className="h-screen flex flex-col bg-[#15181E] p-4 overflow-hidden">
      <div className="bg-[#191D24] mb-4 px-4 py-2 rounded-lg">
        <h1 className="text-base font-normal text-white">
          Settings / Free Spin Config
        </h1>
      </div>

      <div className="bg-[#191D24] rounded-lg p-4 mb-4 shrink-0">
        <div className="flex items-center justify-end gap-3">
          <ExportCSV
            data={configs}
            fileName="free_spin_config.csv"
            getRowDate={(row) => row.createdAt}
            headers={[
              "Name",
              "Total Spins",
              "Spins / Game",
              "Software",
              "Game",
              "Level",
              "Expiry",
              "Currency",
              "Winnings",
              "Status",
            ]}
            mapRow={(row) => [
              row.name,
              summarizeTemplateSpins(row).totalSpins,
              row.numberOfFreeSpins ?? 0,
              summarizeProviders(row),
              summarizeGames(row),
              row.betLevel ?? "-",
              row.grantExpiresInDays ? `${row.grantExpiresInDays}d` : "-",
              row.spinCurrency === "GC" ? "Wulf Coin (GC)" : "Wulf Cash (SC)",
              row.winningsTarget === "bonus_sc" ? "Bonus Wulf Cash" : "Wulf Cash",
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
        {loading ? (
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
                <th className="px-4 py-3 text-center text-xs text-white w-28">Status</th>
                <th className="px-4 py-3 text-center text-xs text-white w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20">
                    <NoData title="No free spin config found" />
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
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
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
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
