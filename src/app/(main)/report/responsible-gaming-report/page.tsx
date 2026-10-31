"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import ExportCSV from "@/components/ExportCSV/ExportCSV";
import { toReportDay } from "@/lib/utils";
import { PermissionGuard } from "@/components/guard/permission-guard";
import {
  getRestrictionReport,
  PERIOD_CODE_LABEL,
  RESTRICTION_TYPE_LABEL,
  type RestrictionReport,
} from "@/api/responsible-gaming/responsible-gaming.api";

/** Default range: the last 30 days, which is what a monthly pack asks for. */
function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  // The picked calendar day, not the UTC day its local midnight lands on.
  return { from: toReportDay(from)!, to: toReportDay(to)! };
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#191D24] p-4">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ?? "text-white"}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-white/40">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<[string, number]>;
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#191D24] p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-white/45">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(([label, count]) => (
            <li key={label} className="flex justify-between text-sm">
              <span className="text-white/70">{label}</span>
              <span className="font-semibold text-white">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The Responsible Gaming report — feature 16.
 *
 * Two kinds of number, kept visually apart because conflating them would be
 * misleading: the KPI row is a snapshot of **right now** (who is restricted
 * today), while everything below counts **events inside the selected range**
 * (who started a break last month). A single grid mixing the two would invite
 * somebody to subtract one from the other.
 */
function ResponsibleGamingReportView() {
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState<RestrictionReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getRestrictionReport(range));
    } catch {
      toast.error("Could not load the Responsible Gaming report.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  // Flattened for export, so the compliance pack is one sheet rather than a
  // screenshot of four panels.
  const exportRows = data
    ? [
        ["Range from", data.range.from],
        ["Range to", data.range.to],
        ["Active breaks (now)", data.current.activePauses],
        ["Self-excluded (now)", data.current.activeSelfExclusions],
        ["Reviews due (now)", data.current.reviewDue],
        ["Breaks started", data.started.PAUSE],
        ["Self-exclusions started", data.started.SELF_EXCLUSION],
        ["Restrictions expired", data.expired],
        ["Restrictions lifted", data.lifted],
        ["Limit increases scheduled", data.limitIncreasesScheduled],
        ["Reactivation requested", data.reactivation.requested],
        ["Reactivation approved", data.reactivation.approved],
        ["Reactivation rejected", data.reactivation.rejected],
        ["Reactivation still open", data.reactivation.open],
        ...Object.entries(data.byPeriod).map(([code, n]) => [
          `Started · ${PERIOD_CODE_LABEL[code] ?? code}`,
          n,
        ]),
        ...Object.entries(data.limitsSet).map(([key, n]) => [
          `Limits set · ${key.replace("_", " ")}`,
          n,
        ]),
      ].map(([metric, value]) => ({ metric: String(metric), value: String(value) }))
    : [];

  return (
    <div className="min-h-screen bg-[#15181E] p-6 text-white">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Responsible Gaming Report</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Restrictions, limits and reactivation outcomes.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-white/50">
            From
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="mt-1 block rounded-lg border border-white/10 bg-[#242B35] px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="text-xs text-white/50">
            To
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="mt-1 block rounded-lg border border-white/10 bg-[#242B35] px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#191D24] px-3 py-2 text-sm text-white/80 hover:bg-[#242B35]"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {data && (
            <ExportCSV
              data={exportRows}
              headers={["Metric", "Value"]}
              mapRow={(r: { metric: string; value: string }) => [r.metric, r.value]}
              fileName="responsible-gaming-report"
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : !data ? (
        <p className="py-20 text-center text-white/60">
          No report could be produced for that range.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs uppercase tracking-wide text-white/40">
            As of now
          </p>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Active breaks" value={data.current.activePauses} />
            <Kpi
              label="Self-excluded"
              value={data.current.activeSelfExclusions}
              accent="text-amber-300"
            />
            <Kpi label="Total restricted" value={data.current.activeTotal} />
            <Kpi
              label="Reviews due"
              value={data.current.reviewDue}
              accent="text-emerald-300"
              hint="Period served, awaiting a decision"
            />
          </div>

          <p className="mb-2 text-xs uppercase tracking-wide text-white/40">
            In the selected range
          </p>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Breaks started"
              value={data.started.PAUSE}
            />
            <Kpi
              label="Self-exclusions started"
              value={data.started.SELF_EXCLUSION}
              accent="text-amber-300"
            />
            <Kpi label="Expired on their own" value={data.expired} />
            <Kpi
              label="Lifted early"
              value={data.lifted}
              hint="By a decision, never automatically"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel
              title="Periods chosen"
              rows={Object.entries(data.byPeriod).map(([code, n]) => [
                PERIOD_CODE_LABEL[code] ?? code,
                n,
              ])}
              empty="No restrictions started in this range."
            />
            <Panel
              title="Limits set"
              rows={[
                ...Object.entries(data.limitsSet).map(
                  ([key, n]) => [key.replace("_", " · "), n] as [string, number]
                ),
                ["Increases scheduled", data.limitIncreasesScheduled],
              ]}
              empty="No limits set in this range."
            />
            <Panel
              title="Reactivation"
              rows={[
                ["Requested", data.reactivation.requested],
                ["Approved", data.reactivation.approved],
                ["Rejected", data.reactivation.rejected],
                ["Still open", data.reactivation.open],
              ]}
              empty="No reactivation requests in this range."
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function ResponsibleGamingReportPage() {
  return (
    <PermissionGuard permission="users:responsible-gaming">
      <ResponsibleGamingReportView />
    </PermissionGuard>
  );
}
