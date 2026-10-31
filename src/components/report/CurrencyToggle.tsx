"use client";

import Image from "next/image";
import { coingold, coingreen } from "@/assets/icons";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReportCurrency } from "@/api/reports/reports";

export type { ReportCurrency };

/**
 * Segmented "tab" control that scopes a report to a single money bucket:
 *   • Wulf Cash  (SC) — sweeps coins, real money / actual revenue
 *   • Wulf Coins (GC) — gold coins, virtual play money
 *
 * It is purely a selector (no TabsContent) so a report keeps one table layout
 * and simply re-queries / re-filters its data when the currency changes. This
 * makes it obvious at a glance whether a table shows real cash or fake coins.
 *
 * There is deliberately no combined tab. Showing both buckets at once meant
 * every figure had to be labelled with the currency it belonged to, so screens
 * repeated "Wulf Cash" on each card and column; one bucket at a time is stated
 * once, here, and every number below it reads cleanly.
 */
export default function CurrencyToggle<T extends string = ReportCurrency>({
  value,
  onChange,
  className = "",
}: {
  value: T;
  onChange: (currency: T) => void;
  className?: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={className}
    >
      <TabsList className="h-auto gap-1 rounded-lg border border-[#242B35] bg-[#0F1216] p-1">
        <TabsTrigger
          value="wulfCash"
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-500 transition-all hover:text-gray-300 data-[state=active]:bg-[#03B739] data-[state=active]:font-bold data-[state=active]:text-white data-[state=active]:shadow-[0_0_0_1px_rgba(3,183,57,0.6),0_4px_12px_rgba(3,183,57,0.35)]"
        >
          <Image src={coingreen} alt="" width={16} height={16} />
          Wulf Cash
          <span className="hidden sm:inline text-[10px] opacity-80">(SC)</span>
        </TabsTrigger>
        <TabsTrigger
          value="wulfCoin"
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-500 transition-all hover:text-gray-300 data-[state=active]:bg-[#F59E0B] data-[state=active]:font-bold data-[state=active]:text-black data-[state=active]:shadow-[0_0_0_1px_rgba(245,158,11,0.6),0_4px_12px_rgba(245,158,11,0.35)]"
        >
          <Image src={coingold} alt="" width={16} height={16} />
          Wulf Coins
          <span className="hidden sm:inline text-[10px] opacity-80">(GC)</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
