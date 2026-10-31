"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";

import {
    DIRECTION_HINTS,
    getLaneFailures,
    getLaneSeries,
    sendLaneTestAlert,
    updateProviderLane,
    type ProviderHealthRow,
    type RecordedFailure,
    type SeriesPoint,
} from "@/api/integrations/integration-health.api";
import {
    buttonClass,
    DirectionBadge,
    formatDateTime,
    formatRelative,
    inputClass,
    panelClass,
    RateCell,
    Sparkline,
    StatusBadge,
} from "./shared";

interface Props {
    lane: ProviderHealthRow;
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Per-event-type counts, computed on the client from the failure samples.
 *
 * This is the question the vendor dashboard cannot answer: SumSub can say 54
 * deliveries failed, only we can say all 54 were `applicantReviewed` returning
 * 401. It is a sample rather than a full census — the label under the table
 * says so, because an operator reading these as totals would draw the wrong
 * conclusion about scale.
 */
function groupByEventType(failures: RecordedFailure[]) {
    const counts = new Map<string, number>();
    for (const failure of failures) {
        const key = failure.eventType || failure.operation || "unknown";
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export default function LaneDetailModal({ lane, onClose, onSaved }: Props) {
    const [series, setSeries] = useState<SeriesPoint[]>([]);
    const [failures, setFailures] = useState<RecordedFailure[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [threshold, setThreshold] = useState(lane.thresholdPercent);
    const [windowMinutes, setWindowMinutes] = useState(lane.windowMinutes);
    const [minSampleSize, setMinSampleSize] = useState(lane.minSampleSize);
    const [monitoringEnabled, setMonitoringEnabled] = useState(lane.monitoringEnabled);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const [seriesData, failureData] = await Promise.all([
                    getLaneSeries(lane.key, lane.direction, 60, "minute"),
                    getLaneFailures(lane.key, lane.direction),
                ]);
                if (!cancelled) {
                    setSeries(seriesData);
                    setFailures(failureData);
                }
            } catch {
                if (!cancelled) toast.error("Could not load detail for this integration.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [lane.key, lane.direction]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProviderLane(lane.key, lane.direction, {
                failureThresholdPercent: threshold,
                windowMinutes,
                minSampleSize,
                monitoringEnabled,
            });
            toast.success("Settings saved. They take effect on the next check.");
            onSaved();
        } catch (error: any) {
            toast.error(error?.response?.data?.message ?? "Could not save those settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleTestAlert = async () => {
        setTesting(true);
        try {
            const result = await sendLaneTestAlert(lane.key, lane.direction);
            if (result.sent) {
                toast.success(`Test alert sent to ${result.delivered ?? 0} recipient(s).`);
            } else {
                toast.error(result.reason ?? "Test alert was not sent.");
            }
        } catch {
            toast.error("Could not send the test alert.");
        } finally {
            setTesting(false);
        }
    };

    const eventTypes = groupByEventType(failures);

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
            <div
                className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-[#12161C] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ------------------------------------------------------ header */}
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#12161C] px-5 py-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-white">{lane.displayName}</h2>
                            <DirectionBadge direction={lane.direction} />
                            <StatusBadge status={lane.status} />
                        </div>
                        <p className="mt-1 max-w-lg text-xs text-white/50">
                            {DIRECTION_HINTS[lane.direction]}
                        </p>
                        {lane.webhookPath && (
                            <p className="mt-1 font-mono text-[11px] text-white/40">
                                {lane.webhookPath}
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={onClose} className="text-white/50 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    {/* ------------------------------------------------- headline */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`${panelClass} p-4`}>
                            <p className="text-xs text-white/50">Last 24 hours</p>
                            <div className="mt-1">
                                <RateCell
                                    failed={lane.last24h.failed}
                                    total={lane.last24h.total}
                                    rate={lane.last24h.failureRate}
                                    threshold={lane.thresholdPercent}
                                />
                            </div>
                        </div>
                        <div className={`${panelClass} p-4`}>
                            <p className="text-xs text-white/50">
                                Alerting window ({lane.windowMinutes} min)
                            </p>
                            <div className="mt-1">
                                <RateCell
                                    failed={lane.window.failed}
                                    total={lane.window.total}
                                    rate={lane.window.failureRate}
                                    threshold={lane.thresholdPercent}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ---------------------------------------------------- chart */}
                    <div className={`${panelClass} p-4`}>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-medium text-white">Last 60 minutes</p>
                            <p className="text-[11px] text-white/40">
                                Bar height = call volume, colour = failure rate
                            </p>
                        </div>
                        {loading ? (
                            <div className="flex h-16 items-center gap-2 text-sm text-white/40">
                                <Loader2 size={14} className="animate-spin" /> Loading…
                            </div>
                        ) : (
                            <Sparkline points={series} threshold={lane.thresholdPercent} />
                        )}
                    </div>

                    {/* ----------------------------------------------- event types */}
                    {eventTypes.length > 0 && (
                        <div className={`${panelClass} p-4`}>
                            <p className="mb-3 text-sm font-medium text-white">
                                What is failing
                            </p>
                            <div className="space-y-2">
                                {eventTypes.map(([label, count]) => (
                                    <div
                                        key={label}
                                        className="flex items-center justify-between gap-3 text-sm"
                                    >
                                        <span className="truncate font-mono text-xs text-white/70">
                                            {label}
                                        </span>
                                        <span className="shrink-0 text-white/50">{count}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-3 text-[11px] text-white/35">
                                From the most recent captured failures, not a full count.
                            </p>
                        </div>
                    )}

                    {/* -------------------------------------------------- failures */}
                    <div className={`${panelClass} overflow-hidden`}>
                        <div className="border-b border-white/10 px-4 py-3">
                            <p className="text-sm font-medium text-white">Recent errors</p>
                        </div>
                        {loading ? (
                            <div className="flex items-center gap-2 p-4 text-sm text-white/40">
                                <Loader2 size={14} className="animate-spin" /> Loading…
                            </div>
                        ) : failures.length === 0 ? (
                            <div className="p-4 text-sm text-white/40">
                                No failures captured recently.
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {failures.map((failure, index) => (
                                    <div key={`${failure.at}-${index}`} className="px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-red-400">
                                                {failure.statusCode ?? "ERR"}
                                            </span>
                                            <span className="font-mono text-white/70">
                                                {failure.operation}
                                            </span>
                                            {failure.eventType && (
                                                <span className="text-white/40">
                                                    {failure.eventType}
                                                </span>
                                            )}
                                            <span className="ml-auto text-white/35">
                                                {formatRelative(failure.at)}
                                            </span>
                                        </div>
                                        <p className="mt-1 break-words text-xs text-white/50">
                                            {failure.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* --------------------------------------------------- settings */}
                    <div className={`${panelClass} p-4`}>
                        <p className="mb-3 text-sm font-medium text-white">Alert settings</p>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-xs text-white/60">
                                    Alert above (%)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    className={`${inputClass} w-full`}
                                    value={threshold}
                                    onChange={(e) => setThreshold(Number(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-white/60">
                                    Window (minutes)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={60}
                                    className={`${inputClass} w-full`}
                                    value={windowMinutes}
                                    onChange={(e) => setWindowMinutes(Number(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-white/60">
                                    Minimum calls
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    className={`${inputClass} w-full`}
                                    value={minSampleSize}
                                    onChange={(e) => setMinSampleSize(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <p className="mt-2 text-[11px] text-white/40">
                            No alert fires below the minimum call count — one failure out of one is
                            100% and is not an outage.
                        </p>

                        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-white/70">
                            <input
                                type="checkbox"
                                checked={monitoringEnabled}
                                onChange={(e) => setMonitoringEnabled(e.target.checked)}
                                className="h-4 w-4 accent-[#B93DEB]"
                            />
                            Alerting enabled for this lane
                        </label>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => void handleSave()}
                                disabled={saving}
                                className="flex items-center gap-2 rounded-lg bg-[#B93DEB] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                Save settings
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleTestAlert()}
                                disabled={testing}
                                className={buttonClass}
                            >
                                {testing ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Send size={14} />
                                )}
                                Send test alert
                            </button>
                        </div>
                    </div>

                    <p className="pb-4 text-[11px] text-white/30">
                        Last failure: {formatDateTime(lane.lastFailureAt)}
                    </p>
                </div>
            </div>
        </div>
    );
}
