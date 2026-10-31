"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import TableSkeleton from "@/components/TableSkeleton";
import { agentGetPackageHistory, agentListPlans } from "@/api/package/agent-package.api";
import type {
  PackageTransaction,
  PackageTxnType,
  PackageTxnStatus,
  AgentPackage,
} from "@/types/agent-package.types";

const TYPE_COLORS: Record<PackageTxnType, string> = {
  BUY:     "text-green-400 bg-green-400/10",
  UPGRADE: "text-blue-400 bg-blue-400/10",
  RENEW:   "text-yellow-400 bg-yellow-400/10",
  CANCEL:  "text-red-400 bg-red-400/10",
};

const STATUS_COLORS: Record<PackageTxnStatus, string> = {
  SUCCESS: "text-green-400 bg-green-400/10",
  PENDING: "text-yellow-400 bg-yellow-400/10",
  FAILED:  "text-red-400 bg-red-400/10",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

/** Render a single feature entry from the features object */
function FeatureTag({ label, value }: { label: string; value: unknown }) {
  if (label === "ggrRates") return null;
  if (value === true)
    return <span className="text-[10px] px-2 py-0.5 rounded bg-green-400/10 text-green-400">✅ {label}</span>;
  if (value === false)
    return <span className="text-[10px] px-2 py-0.5 rounded bg-red-400/10 text-red-400">❌ {label}</span>;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-400/10 text-purple-300">
      {label}: {String(value)}
    </span>
  );
}

/** GGR rates mini-table */
function GgrRates({ rates }: { rates: Record<string, number> }) {
  const entries = Object.entries(rates);
  if (!entries.length) return null;
  return (
    <div className="mt-2">
      <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">GGR Commission Rates</p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([k, v]) => (
          <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-blue-400/10 text-blue-300">
            {k}: {v}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AgentPackageHistoryPage() {
  const [history, setHistory] = useState<PackageTransaction[]>([]);
  const [planMap, setPlanMap] = useState<Record<string, AgentPackage>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([agentGetPackageHistory(), agentListPlans().catch(() => [] as AgentPackage[])])
      .then(([txns, plans]) => {
        setHistory(txns);
        const map: Record<string, AgentPackage> = {};
        plans.forEach((p) => { map[p.id] = p; });
        setPlanMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="h-full w-full bg-[#15181E] p-3 sm:p-6 flex flex-col">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-3 sm:mb-4 px-3 sm:px-4 py-3 rounded-lg shrink-0">
        <h1 className="text-sm text-white leading-snug">Agent Management / Package History</h1>
      </div>

      {/* TABLE */}
      <div className="flex-1 bg-[#15181E] rounded-lg overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-auto agent-x-scroll scrollbar-hide">
          <table className="w-full border-collapse min-w-[860px] lg:min-w-0">
            <thead className="sticky top-0 bg-[#242B35] z-10">
              <tr className="border-b border-gray-800">
                {["#", "Type", "Status", "Plan", "Amount", "Date", "Features"].map((h) => (
                  <th key={h} className="px-3 sm:px-4 py-3 text-xs text-white font-normal text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <TableSkeleton rows={10} cols={7} />
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500 text-sm">
                    No package history found.
                  </td>
                </tr>
              ) : (
                history.map((txn, i) => {
                  const { date, time } = formatDate(txn.createdAt);
                  const plan = planMap[txn.toPlanId];
                  const features = plan?.features ?? {};
                  const ggrRates: Record<string, number> = features.ggrRates ?? {};
                  const featureEntries = Object.entries(features).filter(([k]) => k !== "ggrRates");
                  const isOpen = !!expanded[txn.id];

                  return (
                    <>
                      <tr
                        key={txn.id}
                        className={`border-b border-gray-800 ${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} hover:bg-[#1a2030]`}
                      >
                        <td className="px-4 py-3 text-xs text-gray-400">#{i + 1}</td>

                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TYPE_COLORS[txn.type]}`}>
                            {txn.type}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_COLORS[txn.status]}`}>
                            {txn.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-xs text-white font-medium">
                          {plan?.name ?? txn.meta?.toPlanName ?? txn.toPlanId ?? "—"}
                          {txn.fromPlanId && txn.meta?.fromPlanName && (
                            <span className="text-gray-500 ml-1 text-[10px]">← {txn.meta.fromPlanName}</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-xs text-white font-mono">
                          {txn.amount} <span className="text-gray-500"></span>
                        </td>

                        <td className="px-4 py-3 text-xs text-gray-300">
                          <span className="block">{date}</span>
                          <span className="text-gray-500">{time}</span>
                        </td>

                        <td className="px-4 py-3">
                          {plan ? (
                            <button
                              onClick={() => toggle(txn.id)}
                              className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded transition-colors"
                            >
                              {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {isOpen ? "Hide" : "View"}
                            </button>
                          ) : (
                            <span className="text-gray-600 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* EXPANDED FEATURES ROW */}
                      {isOpen && plan && (
                        <tr key={`${txn.id}-features`} className="bg-[#1a1f2b] border-b border-gray-800">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                                {plan.name}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                {plan.price}  / {plan.interval.toLowerCase()}
                              </span>
                              {plan.subAgents && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-400/10 text-purple-300">
                                  Sub-Agents: {plan.subAgents}
                                </span>
                              )}
                            </div>

                            {/* Feature tags */}
                            <div className="flex flex-wrap gap-2">
                              {featureEntries.map(([k, v]) => (
                                <FeatureTag key={k} label={k} value={v} />
                              ))}
                            </div>

                            {/* GGR rates */}
                            <GgrRates rates={ggrRates} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
