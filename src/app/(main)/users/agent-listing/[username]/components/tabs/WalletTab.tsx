import { EarningRecord, UserWithProfile } from "@/types/profile.type";
import ExportCSV from "@/components/ExportCSV";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import { useState, useEffect, useMemo } from "react";
import { chip, coin, diamond, notes } from "@/assets/images/banner";
import { coingold } from "@/assets/icons";
import { profileApi } from "@/api/users/users";
import toast from "react-hot-toast";
import { Calendar, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination/Pagination";

/**
 * Money for display — always two decimals, with thousands separators.
 *
 * Plain `toLocaleString()` was used here and printed a commission total of
 * 1.0284 as "1.028": three fraction digits, no rounding, and a decimal point
 * that reads as a thousands separator, so the card looked like 1,028 while the
 * Revenue tab showed the SAME field as "1.03". Every other money figure in the
 * portal is fixed to two decimals; this keeps the wallet cards in step.
 */
const money = (value: unknown): string =>
  Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const EARNING_FILTER_DEFAULTS: FilterValues = {
  search: "",
  result: "all",
  from: "",
  to: "",
  minCommission: "",
  maxCommission: "",
};

const EARNING_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "result",
    label: "Commission",
    options: [
      { label: "All Entries", value: "all" },
      { label: "Earned (positive)", value: "positive" },
      { label: "Clawed back (negative)", value: "negative" },
      { label: "Zero", value: "zero" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
  { type: "numberRange", minKey: "minCommission", maxKey: "maxCommission", label: "Commission" },
];

const EARNING_FILTER_CONFIG = {
  search: (r: EarningRecord) => [r.id, r.gameLogId, r.referee?.username, r.refereeId, r.status],
  selects: [
    {
      key: "result",
      match: (r: EarningRecord, v: string) => {
        const commission = Number(r.commissionAmount || 0);
        if (v === "positive") return commission > 0;
        if (v === "negative") return commission < 0;
        return commission === 0;
      },
    },
  ],
  dateRange: { fromKey: "from", toKey: "to", get: (r: EarningRecord) => r.createdAt },
  numberRanges: [
    {
      minKey: "minCommission",
      maxKey: "maxCommission",
      get: (r: EarningRecord) => Number(r.commissionAmount || 0),
    },
  ],
};

const WalletTab = ({ agent }: { agent: UserWithProfile }) => {
  // Flat flags first: the profile endpoint returns isBlocked/isFrozen/… merged
  // from whichever role entity applies (Agent OR SubAgent). Reading only
  // `agent.agent?.…` left every toggle stuck at OFF on sub-agent views —
  // a sub-agent has `subAgent`, not `agent` — so saved values never displayed.
  const [isBlocked, setIsBlocked] = useState(
    agent.isBlocked ?? agent.agent?.isBlocked ?? false,
  );
  const [isFrozen, setIsFrozen] = useState(
    agent.isFrozen ?? agent.agent?.isFrozen ?? false,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [transactions, setTransactions] = useState<EarningRecord[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    values: filters,
    setValues: setFilters,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset: resetFilters,
  } = useEntityFilters({
    fields: EARNING_FILTER_FIELDS,
    defaults: EARNING_FILTER_DEFAULTS,
  });


  const PAGE_SIZE = 10;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const res = await profileApi.getAgentReferralStatsById(agent.id);
        setStats(res.data);
      } catch (error) {
        console.error("Failed to fetch agent referral stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };
    if (agent.id) fetchStats();
  }, [agent.id]);

  // The `agent` prop comes from the parent page's one-time fetch and is never
  // refreshed, so after a save the prop still carries the OLD flags — and this
  // tab remounts from it every time the admin switches tabs, visually
  // reverting the toggles. Sync from the server on mount so the controls
  // always show what is actually persisted.
  useEffect(() => {
    const syncFlags = async () => {
      try {
        const res = await profileApi.getUserProfile(agent.id);
        const f = res.data;
        setIsBlocked(f.isBlocked ?? f.agent?.isBlocked ?? false);
        setIsFrozen(f.isFrozen ?? f.agent?.isFrozen ?? false);
      } catch (error) {
        // Keep the prop-derived initial values — stale beats blank.
        console.error("Failed to sync wallet flags:", error);
      }
    };
    if (agent.id) syncFlags();
  }, [agent.id]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoadingTransactions(true);
        const res = await profileApi.getAgentEarningHistoryById(agent.id);
        setTransactions(res.data || []);
      } catch (error) {
        console.error("Failed to fetch agent transactions:", error);
        setTransactions([]);
      } finally {
        setLoadingTransactions(false);
      }
    };

    if (agent.id) fetchTransactions();
  }, [agent.id]);

  const filteredTransactions = useMemo(
    () => applyClientFilters(transactions, filters, EARNING_FILTER_CONFIG),
    [transactions, filters],
  );

  // Every earning row is already loaded, so a column sort orders all of them.
  const { sort, toggle } = useTableSort<"date" | "wagered" | "commission" | "status">();
  const visibleTransactions = useSortedRows(filteredTransactions, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    // The Wagered cell leads with round turnover and falls back to the
    // commissionable share; the sort reads the same value.
    wagered: (row) => Number(row.betTotalAmount ?? row.wagerAmount ?? 0),
    commission: (row) => Number(row.commissionAmount || 0),
    status: (row) => row.status,
  });

  // A narrowed filter can leave fewer pages than the one being viewed.
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(visibleTransactions.length / PAGE_SIZE));

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleTransactions.slice(start, start + PAGE_SIZE);
  }, [visibleTransactions, currentPage]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Negative-balance debt allowance removed (QA #40): the flags were never
      // read by any wallet/commission logic — the configured limit did nothing
      // while clawbacks carried real negative amounts — so the controls only
      // misled admins. Balances now display floored at zero instead.
      await profileApi.updateUserProfile(agent.id, {
        isBlocked,
        isFrozen,
      });
      // Re-read from the server and sync the toggles to what was actually
      // persisted. The parent page's `agent` prop is fetched once and never
      // refreshed, so without this a save that silently failed (or was
      // rewritten server-side) still LOOKED applied until the next hard
      // reload — the "toggles not updating" report.
      const fresh = await profileApi.getUserProfile(agent.id);
      const f = fresh.data;
      setIsBlocked(f.isBlocked ?? f.agent?.isBlocked ?? false);
      setIsFrozen(f.isFrozen ?? f.agent?.isFrozen ?? false);
      // No allowNegative/negativeLimit re-sync: those controls were removed with
      // the negative-balance allowance above, and their state went with them.
      toast.success("Wallet permissions updated successfully");
    } catch (error) {
      console.error("Failed to update wallet settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  /*
    Total Earnings on the SAME basis as the two cards beside it.

    It used to show `totalEarnedAllTime`, a sum over the referral_earnings
    LEDGER, while Available and On Hold read the affiliate WALLET. The two
    systems do not reconcile, so an agent could show 5.79 "all time" next to
    72.52 being held — a lifetime total smaller than the money sitting against
    it, which is not a statement anyone can act on.

    Everything the agent has ever earned, in wallet terms, is what they have
    been paid plus what is still theirs:

        claimed (paid out)  +  available (claimable now)  +  on hold

    On Hold is clamped the same way the card below clamps it, so the parts add
    up to the headline exactly.
  */
  const claimedEarnings = Math.max(0, Number(stats?.totalClaimed ?? 0));
  const availableEarnings = Math.max(0, Number(stats?.availableBalance ?? 0));
  const onHoldEarnings = Math.max(
    Number(stats?.freezePending ?? 0),
    Number(stats?.frozenBalance ?? 0),
    0,
  );
  const lifetimeEarnings =
    claimedEarnings + availableEarnings + onHoldEarnings;

  /*
    On Hold is two unrelated buckets and the card said only "pending +
    requested", so an agent with 72.52 of safety hold and no payout request
    looked like they had a request stuck somewhere — and the Payout Request tab
    beside it, correctly empty, read as broken.

      frozenBalance  — frozen against an actual payout request
      pendingBalance — safety hold on fresh commission, no request involved
  */
  const requestedHold = Math.max(0, Number(stats?.frozenBalance ?? 0));
  const safetyHold = Math.max(0, onHoldEarnings - requestedHold);

  // Ledger view of the same agent, kept for the sub-label: when the two bases
  // disagree it is worth seeing, not worth hiding.
  const ownEarnings = Math.max(0, Number(stats?.totalEarnedAllTime ?? 0));
  const downlineEarnings = Math.max(0, Number(stats?.subAgentsEarnedAllTime ?? 0));
  const ledgerEarnings = ownEarnings + downlineEarnings;

  return (
    <div className="space-y-4 text-white animate-in fade-in duration-500 md:space-y-8">
      {/* TOP CONTROLS */}
      <div className="bg-[#191D24] p-4 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group md:p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#B93DEB]/5 rounded-full -mr-16 -mt-16 blur-3xl" />

        <div className="flex flex-wrap gap-4 items-center relative z-10 md:gap-6">
          <Toggle
            label="Block Agent"
            description="Prevent all login access"
            value={isBlocked}
            onChange={setIsBlocked}
          />

          <Toggle
            label="Freeze Commission"
            description="Prevent commission claims"
            value={isFrozen}
            onChange={setIsFrozen}
          />
        </div>
      </div>

      {/* BALANCE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
        {/* Ledger truth (SUM of effective commission), so this card reconciles
            with the Commission column below and with the Revenue / Downline
            tabs — the Revenue tab renders the SAME field.
            No cross-system fallback: `totalEarnings` is the affiliate wallet
            balance and `wallet.wulfCash` is the agent's own PLAYER wallet.
            Falling through to those put an unrelated number under the "Total
            Earnings" label whenever the ledger figure was missing. */}
        {/* Floored at zero (QA #40): a clawback carry can push the ledger sum
            negative (e.g. −16 after referee wins), but with the debt-allowance
            feature removed, agent/sub-agent balances present as zero instead of
            showing debt. The internal wallet still nets the carry against
            future earnings — display only. */}
        {/* Own referees PLUS the sub-agent downline, both ledger sums.
            `totalEarnedAllTime` alone counts only the agent's own referees, so
            an agent who earns mostly through sub-agents read 5.79 "all time"
            beside 72.52 on hold — a lifetime total smaller than the money
            currently held against it. The API states both figures on the same
            basis (see subAgentsEarnedAllTime) precisely so they can be added;
            the wallet buckets below are a different system and are not mixed
            in. */}
        <BalanceCard
          title="Total Earnings"
          image={notes}
          value={loadingStats ? "..." : money(lifetimeEarnings)}
          color="purple"
          subLabel={`All time · ${money(claimedEarnings)} paid + ${money(
            availableEarnings,
          )} available + ${money(onHoldEarnings)} held`}
        />
        <BalanceCard
          title="Available"
          image={notes}
          value={loadingStats ? "..." : money(stats?.availableBalance)}
          color="gold"
          subLabel="Claimable now"
        />
        {/* pendingBalance + frozenBalance — money held, not withdrawable.
            Clamped at the frozen floor, the SAME expression the agent portal's
            WalletOverview uses: a negative clawback carried in pendingBalance
            otherwise nets away genuinely frozen money (pending −83 + frozen 83
            displayed "0.00" here while the agent's own dashboard said 83.00). */}
        <BalanceCard
          title="On Hold"
          image={notes}
          value={
            loadingStats
              ? "..."
              : money(
                  Math.max(
                    Number(stats?.freezePending ?? 0),
                    Number(stats?.frozenBalance ?? 0),
                  ),
                )
          }
          color="purple"
          subLabel={
            requestedHold > 0
              ? `${money(safetyHold)} safety hold + ${money(requestedHold)} requested`
              : "Safety hold — no payout requested"
          }
        />
      </div>

      {/* The ledger says what was ACCRUED, the wallet what is HELD. They are
          separate systems and a gap between them is worth seeing rather than
          hiding — it usually means wallet credits with no earning rows behind
          them (admin adjustments, package bonuses), or accruals that never
          reached the wallet. */}
      {!loadingStats && Math.abs(ledgerEarnings - lifetimeEarnings) >= 0.01 && (
        <p className="max-w-4xl text-[11px] text-gray-500">
          Commission ledger for this agent totals{" "}
          <span className="text-gray-300">{money(ledgerEarnings)}</span>
          {downlineEarnings > 0 && (
            <>
              {" "}
              ({money(ownEarnings)} own + {money(downlineEarnings)} downline)
            </>
          )}
          , which does not match the wallet total above.
        </p>
      )}

      {/* SAVE BUTTON */}
      <div className="flex justify-start">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-[#B93DEB] hover:bg-[#A030D0] text-white font-black uppercase tracking-widest px-10 py-6 rounded-xl md:w-auto shadow-lg shadow-[#B93DEB]/20 active:scale-95 transition-all flex items-center gap-3"
        >
          {isSaving ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Save size={20} />
          )}
          {isSaving ? "Saving Changes..." : "Apply Wallet"}
        </Button>
      </div>

      <div className="bg-[#191D24] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="bg-white/5 px-3 py-4 border-b border-white/5 md:px-6">
          <FilterToolbar
            title="Transactions"
            countLabel={
              loadingTransactions
                ? undefined
                : `${visibleTransactions.length} ${visibleTransactions.length === 1 ? "entry" : "entries"}`
            }
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search entry, player or round"
            activeCount={activeCount}
            chips={chips}
            hasAnyFilter={hasAnyFilter}
            onOpenFilters={() => setSheetOpen(true)}
            onResetAll={resetFilters}
            actions={
              /* Exports what the filters and the column sort currently show,
                 not the raw fetch — otherwise the file disagrees with the
                 screen it was taken from. */
              <ExportCSV<EarningRecord>
                data={visibleTransactions}
                fileName={`agent_wallet_${agent.username ?? agent.id}.csv`}
                getRowDate={(row) => row.createdAt}
                headers={[
                  "Date",
                  "Entry ID",
                  "Ref Player",
                  "Wagered",
                  "Commission",
                  "Status",
                ]}
                mapRow={(row) => [
                  row.createdAt,
                  row.id,
                  row.referee?.username ?? row.refereeId,
                  Number(row.betTotalAmount ?? row.wagerAmount ?? 0).toFixed(2),
                  Number(row.commissionAmount ?? 0).toFixed(2),
                  row.status,
                ]}
              />
            }
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-[#15181E] border-b border-white/5">
              <tr>
                <SortableTh
                  label="Date"
                  sortKey="date"
                  sort={sort}
                  onToggle={toggle}
                  align="left"
                  className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500"
                />
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Ref Player
                </th>
                <SortableTh
                  label="Wagered"
                  sortKey="wagered"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-500"
                />
                <SortableTh
                  label="Commission"
                  sortKey="commission"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-500"
                />
                <SortableTh
                  label="Status"
                  sortKey="status"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-500"
                />
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {loadingTransactions ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <Loader2 className="mx-auto animate-spin text-[#B93DEB]" size={24} />
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-sm text-gray-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((row) => {
                  // Forfeited rows (accrued while the agent was inactive) are
                  // reporting-only and count as 0 — the same rule the backend
                  // totals use, so these rows sum to the Downline figures.
                  const commissionAmount = (row as any).forfeitReason
                    ? 0
                    : Number(row.commissionAmount || 0);

                  return (
                    <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-600" />
                          <span>{new Date(row.createdAt).toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-white">
                          {row.referee?.username || "N/A"}
                        </div>
                        <div className="text-[10px] font-mono text-gray-500">
                          ID: {row.refereeId?.slice(0, 8) || "N/A"}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-300">
                        {money(row.wagerAmount)}
                      </td>

                      <td
                        className={`px-6 py-4 text-right text-sm font-black ${
                          commissionAmount >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {commissionAmount > 0 ? "+" : ""}
                        {money(commissionAmount)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                            row.status === "UNCLAIMED"
                              ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
                              : "border-green-500/20 bg-green-500/10 text-green-400"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loadingTransactions && totalPages > 1 && (
          <div className="flex justify-center px-3 py-5 md:px-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Transaction Filters"
        description="Filter this agent's commission transactions"
        fields={EARNING_FILTER_FIELDS}
        values={filters}
        defaults={EARNING_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default WalletTab;

/* ================= SUB COMPONENTS ================= */

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center gap-4 group cursor-pointer"
      onClick={() => onChange(!value)}
    >
      <div className="space-y-0.5">
        <span className="text-sm font-black uppercase tracking-tight block group-hover:text-[#B93DEB] transition-colors">
          {label}
        </span>
        <span className="text-[10px] text-gray-500 font-bold uppercase">
          {description}
        </span>
      </div>

      <button
        className={`relative w-11 h-6 shrink-0 rounded-full transition-all duration-300 shadow-inner
          ${value ? "bg-red-500" : "bg-white/10"}
        `}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md
            ${value ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    </div>
  );
}

function BalanceCard({
  title,
  value,
  image,
  color,
  subLabel = "Available Balance",
}: {
  title: string;
  value: string;
  image: any;
  color: "purple" | "gold";
  subLabel?: string;
}) {
  return (
    <div className="bg-[#191D24] rounded-lg overflow-hidden border border-white/5 shadow-2xl group hover:border-white/10 transition-all">
      {/* Header */}
      <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b md:px-6 border-white/5 text-gray-400 font-black uppercase text-[10px] tracking-[0.2em] group-hover:text-white transition-colors">
        {title}
        <div
          className={`w-2 h-2 rounded-full ${color === "purple" ? "bg-[#B93DEB] shadow-[0_0_8px_#B93DEB]" : "bg-yellow-500 shadow-[0_0_8px_#EAB308]"}`}
        />
      </div>

      {/* Content */}
      <div className="p-5 flex items-center justify-center md:p-8">
        <div className="text-center">
          <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2">
            {subLabel}
          </span>
          <span className="text-3xl font-black tracking-tighter text-white md:text-4xl">
            {value}
          </span>
        </div>
      </div>
    </div>
  );
}

