"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

/* =========================
   TYPES
========================= */
export interface RewardRow {
  id: number;
  rewardName: string;
  total: number;
  players: number;
  agent: number;
  shareholder: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RewardRow[]) => void;
  initialData?: RewardRow[];
}

/* =========================
   COMPONENT
========================= */
export default function RewardsClassicTierModal({
  open,
  onClose,
  onSubmit,
  initialData = [],
}: Props) {
  const [activeTab, setActiveTab] = useState("cash");
  const [rows, setRows] = useState<RewardRow[]>([]);

  /* =========================
     INIT DATA (6–7 ROWS)
  ========================= */
  useEffect(() => {
    if (open) {
      if (initialData.length) {
        setRows(initialData);
      } else {
        setRows(
          Array.from({ length: 7 }).map((_, index) => ({
            id: Date.now() + index,
            rewardName: `Bronze ${index + 1}`,
            total: 0.2,
            players: 0.05,
            agent: 0.15,
            shareholder: 0,
          }))
        );
      }
    }
  }, [open, initialData]);

  if (!open) return null;

  /* =========================
     HANDLERS
  ========================= */
  const updateRow = (
    id: number,
    field: keyof RewardRow,
    value: number | string
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleSave = () => {
    onSubmit(rows);
    onClose();
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <div className="w-full h-full bg-[#0f172a] border border-gray-800 flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-[#0f172a] z-10">
          <h2 className="text-lg font-semibold text-white">
            Rewards – Classic Tier
          </h2>
          <button onClick={onClose}>
            <X className="text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* TABS */}
        <div className="flex-1 scrollbar-hide overflow-y-auto">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="px-5 pt-4"
          >
            <TabsList className="bg-[#1e293b]">
              <TabsTrigger value="cash">Cash</TabsTrigger>
              <TabsTrigger value="weekly">
                Weekly Rescue Bonus Percentage
              </TabsTrigger>
              <TabsTrigger value="monthly">
                Monthly Rescue Bonus Percentage
              </TabsTrigger>
              <TabsTrigger value="additional">
                Additional Rewards
              </TabsTrigger>
            </TabsList>

            {/* TABLE */}
            <TabsContent value={activeTab} className="mt-4">
              <div className="overflow-x-auto ">
                <table className="w-full text-sm text-gray-300">
                  <thead className="bg-[#1e293b]">
                    <tr>
                      <th className="px-3 py-2 text-left">Reward Name</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Players</th>
                      <th className="px-3 py-2">Agent</th>
                      <th className="px-3 py-2">Shareholder</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-800"
                      >
                        <td className="px-3 py-2">
                          <Input
                            value={row.rewardName}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "rewardName",
                                e.target.value
                              )
                            }
                          />
                        </td>

                        {(
                          ["total", "players", "agent", "shareholder"] as const
                        ).map((field) => (
                          <td
                            key={field}
                            className="px-3 py-2 text-center"
                          >
                            <div className="flex items-center gap-1 justify-center">
                              <Input
                                type="number"
                                step="0.01"
                                value={row[field]}
                                onChange={(e) =>
                                  updateRow(
                                    row.id,
                                    field,
                                    Number(e.target.value)
                                  )
                                }
                                className="w-20 text-center"
                              />
                              <span>%</span>
                            </div>
                          </td>
                        ))}

                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeRow(row.id)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}
