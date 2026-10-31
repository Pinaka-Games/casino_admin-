import React, { useMemo } from 'react';
import { AgentPackage } from "@/types/agent-package.types";
import { Check, X } from "lucide-react";

interface PlanComparisonDashboardProps {
  packages: AgentPackage[];
}

function collectAllFeatureKeys(packages: AgentPackage[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  for (const pkg of packages) {
    if (pkg.features) {
      for (const key of Object.keys(pkg.features)) {
        if (key !== "ggrRates" && key !== "access" && !seen.has(key)) {
          seen.add(key);
          keys.push(key);
        }
      }
    }
  }

  return keys;
}

function getSubAgentDisplay(pkg: AgentPackage): string {
  const name = pkg.name?.toUpperCase();
  if (name === "BASIC") return "❌";
  if (name === "PREMIER") return `Limited (${pkg.subAgents ?? 0})`;
  if (name === "SIGNATURE") return "Unlimited";
  return pkg.subAgents ?? "—";
}

function FeatureValueCell({ value }: { value: boolean | string | undefined }) {
  if (value === true) {
    return <Check className="text-green-500 mx-auto w-5 h-5 font-bold" />;
  }
  if (value === false) {
    return <X className="text-red-500 mx-auto w-5 h-5 font-bold" />;
  }
  if (value === undefined) {
    return <X className="text-gray-500/30 mx-auto w-5 h-5 opacity-30" />;
  }
  return <span className="text-gray-300 text-sm font-semibold">{value}</span>;
}

// Convert camelCase to Title Space e.g. "promoCodes" -> "Promo Codes"
function formatFeatureLabel(key: string): string {
  const result = key.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function PlanComparisonDashboard({ packages }: PlanComparisonDashboardProps) {
  const sortedPackages = useMemo(() => {
    return [...packages].sort((a, b) => a.seq - b.seq);
  }, [packages]);

  const featureKeys = useMemo(() => {
    return collectAllFeatureKeys(sortedPackages);
  }, [sortedPackages]);

  if (!sortedPackages.length) return null;

  return (
    <div className="bg-[#15181E] rounded-xl border border-white/5 overflow-hidden my-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-[#1A1F2B]/80 px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-[13px] font-black text-white tracking-widest uppercase">
          Plan Comparison Matrix
        </h2>
        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
          Auto-Generated Overview
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-center">
          <thead className="bg-[#1A1F2B] border-b border-white/5">
            <tr>
              <th className="py-4 px-6 text-left text-[11px] font-black text-[#B93DEB] uppercase tracking-widest w-1/4 min-w-[200px]">
                FEATURE
              </th>
              {sortedPackages.map(pkg => (
                <th key={pkg.id} className="py-4 px-6 text-[12px] font-black text-white uppercase tracking-widest min-w-[120px]">
                  {pkg.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {featureKeys.map(key => (
              <tr key={key} className="hover:bg-white/[0.02] transition-colors group">
                <td className="py-4 px-6 text-left text-[13px] font-bold text-gray-400 group-hover:text-gray-300 transition-colors">
                  {formatFeatureLabel(key)}
                </td>
                {sortedPackages.map(pkg => (
                  <td key={pkg.id} className="py-4 px-6">
                    <FeatureValueCell value={pkg.features?.[key]} />
                  </td>
                ))}
              </tr>
            ))}
            
            {/* Sub-Agent Creation Special Row */}
            <tr className="hover:bg-white/[0.02] transition-colors group">
              <td className="py-4 px-6 text-left text-[13px] font-bold text-gray-400 group-hover:text-gray-300 transition-colors">
                Sub-Agent Creation
              </td>
              {sortedPackages.map(pkg => {
                const display = getSubAgentDisplay(pkg);
                return (
                  <td key={pkg.id} className="py-4 px-6 text-[13px] font-semibold text-gray-300">
                    {display === "❌" ? <X className="text-red-500 mx-auto w-5 h-5 font-bold" /> : display}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
