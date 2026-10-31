"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import { PermissionGuard } from "@/components/guard/permission-guard";
import {
    DIRECTION_HINTS,
    getIncidents,
    getIntegrationOverview,
    PROVIDER_LABELS,
    type Incident,
    type ProviderHealthRow,
} from "@/api/integrations/integration-health.api";
import LaneDetailModal from "./components/LaneDetailModal";
import RecipientsPanel from "./components/RecipientsPanel";
import {
    buttonClass,
    DirectionBadge,
    formatDateTime,
    formatDuration,
    formatRelative,
    panelClass,
    RateCell,
    StatusBadge,
} from "./components/shared";
import MarketingPanel from "./components/MarketingPanel";

/**
 * The evaluator ticks once a minute, so anything faster only adds load without
 * showing anything new.
 */
const REFRESH_MS = 60_000;

type Tab = "health" | "incidents" | "recipients" | "marketing";

const TABS: Array<{ value: Tab; label: string }> = [
    { value: "health", label: "Health" },
    { value: "incidents", label: "Incidents" },
    { value: "recipients", label: "Alert recipients" },
    // The measurement partners sit with the payment, game and messaging ones
    // rather than in System Configuration: this page is already the answer to
    // "what third parties are we plugged into".
    { value: "marketing", label: "Marketing & analytics" },
];

function IntegrationHealthContent() {
    const [tab, setTab] = useState<Tab>("health");
    const [rows, setRows] = useState<ProviderHealthRow[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selected, setSelected] = useState<ProviderHealthRow | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    // Guards against a slow response from a previous poll overwriting a newer
    // one, and against setting state after the page has been left.
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const load = useCallback(async (showSpinner = false) => {
        if (showSpinner) setRefreshing(true);
        try {
            const [overview, incidentPage] = await Promise.all([
                getIntegrationOverview(),
                getIncidents({ limit: 50 }),
            ]);
            if (!mounted.current) return;
            setRows(overview);
            setIncidents(incidentPage.items ?? []);
            setLastRefresh(new Date());
        } catch {
            if (mounted.current) toast.error("Could not load integration health.");
        } finally {
            if (mounted.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        void load();
        const timer = setInterval(() => void load(), REFRESH_MS);
        return () => clearInterval(timer);
    }, [load]);

    const downLanes = useMemo(() => rows.filter((r) => r.status === "down"), [rows]);
    const openIncidents = useMemo(
        () => incidents.filter((i) => i.status === "open"),
        [incidents],
    );

    /**
     * Broken lanes first, then degraded, then by worst 24h rate. An operator
     * opening this page during an incident should not have to scroll or sort.
     */
    const sortedRows = useMemo(() => {
        const rank: Record<string, number> = { down: 0, warn: 1, ok: 2 };
        return [...rows].sort((a, b) => {
            const byStatus = rank[a.status] - rank[b.status];
            if (byStatus !== 0) return byStatus;
            const byRate = b.last24h.failureRate - a.last24h.failureRate;
            if (byRate !== 0) return byRate;
            return a.displayName.localeCompare(b.displayName);
        });
    }, [rows]);

    return (
        <div className="space-y-4 p-4 md:p-6">
            {/* ------------------------------------------------------- header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
                        <Activity size={20} className="text-[#B93DEB]" />
                        Integration Health
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        Every call to and from our payment, game, compliance and messaging
                        partners, with the failure rate that triggers an alert.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {lastRefresh && (
                        <span className="text-xs text-white/35">
                            Updated {formatRelative(lastRefresh.toISOString())}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => void load(true)}
                        disabled={refreshing}
                        className={buttonClass}
                    >
                        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ------------------------------------------------- outage banner */}
            {downLanes.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
                    <div className="min-w-0 text-sm">
                        <p className="font-medium text-red-300">
                            {downLanes.length} integration
                            {downLanes.length === 1 ? "" : "s"} currently failing
                        </p>
                        <p className="mt-1 text-white/70">
                            {downLanes
                                .map(
                                    (lane) =>
                                        `${lane.displayName} (${lane.direction === "inbound" ? "incoming" : "outgoing"
                                        }) at ${lane.last24h.failureRate.toFixed(1)}%`,
                                )
                                .join(" · ")}
                        </p>
                    </div>
                </div>
            )}

            {/* --------------------------------------------------------- tabs */}
            <div className="flex gap-1 border-b border-white/10">
                {TABS.map((entry) => (
                    <button
                        key={entry.value}
                        type="button"
                        onClick={() => setTab(entry.value)}
                        className={`relative px-4 py-2 text-sm transition-colors ${tab === entry.value
                            ? "text-white"
                            : "text-white/50 hover:text-white/80"
                            }`}
                    >
                        {entry.label}
                        {entry.value === "incidents" && openIncidents.length > 0 && (
                            <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
                                {openIncidents.length}
                            </span>
                        )}
                        {tab === entry.value && (
                            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#B93DEB]" />
                        )}
                    </button>
                ))}
            </div>

            {/* ---------------------------------------------------- marketing */}
            {tab === "marketing" && <MarketingPanel />}

            {/* ------------------------------------------------------- health */}
            {tab === "health" && (
                <div className={`${panelClass} overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[840px] text-left text-sm">
                            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Integration</th>
                                    <th className="px-4 py-3 font-medium">Direction</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Failures / Total 24h</th>
                                    <th className="px-4 py-3 font-medium">
                                        Current window
                                    </th>
                                    <th className="px-4 py-3 font-medium">Last failure</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    [...Array(6)].map((_, i) => (
                                        <tr key={i}>
                                            <td colSpan={6} className="px-4 py-4">
                                                <div className="h-4 w-full animate-pulse rounded bg-white/5" />
                                            </td>
                                        </tr>
                                    ))
                                ) : sortedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10">
                                            <NoData />
                                        </td>
                                    </tr>
                                ) : (
                                    sortedRows.map((lane) => (
                                        <tr
                                            key={`${lane.key}:${lane.direction}`}
                                            onClick={() => setSelected(lane)}
                                            className="cursor-pointer transition-colors hover:bg-white/5"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">
                                                    {lane.displayName}
                                                </div>
                                                {lane.webhookPath && (
                                                    <div className="mt-0.5 truncate font-mono text-[11px] text-white/35">
                                                        {lane.webhookPath}
                                                    </div>
                                                )}
                                                {!lane.monitoringEnabled && (
                                                    <span className="mt-1 inline-block rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                                                        Alerting paused
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <DirectionBadge direction={lane.direction} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={lane.status} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <RateCell
                                                    failed={lane.last24h.failed}
                                                    total={lane.last24h.total}
                                                    rate={lane.last24h.failureRate}
                                                    threshold={lane.thresholdPercent}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <RateCell
                                                    failed={lane.window.failed}
                                                    total={lane.window.total}
                                                    rate={lane.window.failureRate}
                                                    threshold={lane.thresholdPercent}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-white/50">
                                                {formatRelative(lane.lastFailureAt)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-white/10 px-4 py-3 text-[11px] text-white/35">
                        <span className="text-violet-300">Incoming</span>{" "}
                        {DIRECTION_HINTS.inbound}
                        <span className="mx-2 text-white/20">|</span>
                        <span className="text-sky-300">Outgoing</span>{" "}
                        {DIRECTION_HINTS.outbound}
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------- incidents */}
            {tab === "incidents" && (
                <div className={`${panelClass} overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left text-sm">
                            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Integration</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Started</th>
                                    <th className="px-4 py-3 font-medium">Duration</th>
                                    <th className="px-4 py-3 font-medium">Peak rate</th>
                                    <th className="px-4 py-3 font-medium">Alerts sent</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    [...Array(4)].map((_, i) => (
                                        <tr key={i}>
                                            <td colSpan={6} className="px-4 py-4">
                                                <div className="h-4 w-full animate-pulse rounded bg-white/5" />
                                            </td>
                                        </tr>
                                    ))
                                ) : incidents.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-white/50">
                                            No incidents recorded. Nothing has crossed its alert
                                            threshold.
                                        </td>
                                    </tr>
                                ) : (
                                    incidents.map((incident) => (
                                        <tr key={incident.id}>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">
                                                    {PROVIDER_LABELS[incident.providerKey] ??
                                                        incident.providerKey}
                                                </div>
                                                <div className="mt-1">
                                                    <DirectionBadge direction={incident.direction} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`rounded-full border px-2 py-0.5 text-xs ${incident.status === "open"
                                                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                                                        : "border-green-500/30 bg-green-500/10 text-green-400"
                                                        }`}
                                                >
                                                    {incident.status === "open" ? "Open" : "Resolved"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-white/60">
                                                {formatDateTime(incident.openedAt)}
                                            </td>
                                            <td className="px-4 py-3 text-white/60">
                                                {formatDuration(incident.openedAt, incident.resolvedAt)}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-white/80">
                                                {Number(incident.peakFailureRate).toFixed(2)}%
                                            </td>
                                            <td className="px-4 py-3 text-white/60">
                                                {incident.alertCount === 0 ? (
                                                    <span
                                                        className="text-amber-400"
                                                        title="The incident opened but no email was delivered — check the alert recipient list."
                                                    >
                                                        none
                                                    </span>
                                                ) : (
                                                    incident.alertCount
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --------------------------------------------------- recipients */}
            {tab === "recipients" && <RecipientsPanel />}

            {selected && (
                <LaneDetailModal
                    lane={selected}
                    onClose={() => setSelected(null)}
                    onSaved={() => {
                        setSelected(null);
                        void load(true);
                    }}
                />
            )}
        </div>
    );
}

export default function IntegrationHealthPage() {
    return (
        <PermissionGuard
            permission="settings:integration-health"
            fallback={
                <div className="flex flex-col items-center justify-center gap-2 p-16 text-center">
                    <Loader2 size={22} className="text-white/30" />
                    <p className="text-white/70">
                        You do not have permission to view integration health.
                    </p>
                </div>
            }
        >
            <IntegrationHealthContent />
        </PermissionGuard>
    );
}
