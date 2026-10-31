"use client";

import type { Direction, LaneStatus } from "@/api/integrations/integration-health.api";

/* ------------------------------------------------------------------ styles */
// Matched to the activity-log screen so the two read as one product.

export const panelClass = "rounded-xl border border-white/10 bg-[#161A21]";
export const inputClass =
    "bg-[#242B35] border border-[#2C323D] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#B93DEB]";
export const buttonClass =
    "flex items-center gap-2 rounded-lg border border-[#2C323D] bg-[#242B35] px-3 py-2 text-sm text-white/80 transition-colors hover:text-white disabled:opacity-40";
export const primaryButtonClass =
    "flex items-center gap-2 rounded-lg bg-[#B93DEB] px-3 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40";

/**
 * Three states, matching the evaluator's own thresholds exactly:
 * green below half the threshold, amber approaching it, red at or above.
 *
 * They must not drift apart. A badge that says "ok" while the backend has an
 * open incident is worse than no badge, because it argues against the alert
 * email somebody just received.
 */
export const STATUS_STYLES: Record<LaneStatus, string> = {
    ok: "bg-green-500/15 text-green-400 border-green-500/30",
    warn: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    down: "bg-red-500/15 text-red-400 border-red-500/30",
};

export const STATUS_LABELS: Record<LaneStatus, string> = {
    ok: "OK",
    warn: "Degraded",
    down: "Down",
};

export const DIRECTION_STYLES: Record<Direction, string> = {
    outbound: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    inbound: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

/* ----------------------------------------------------------------- badges */

export const StatusBadge = ({ status }: { status: LaneStatus }) => (
    <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {STATUS_LABELS[status]}
    </span>
);

export const DirectionBadge = ({ direction }: { direction: Direction }) => (
    <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${DIRECTION_STYLES[direction]}`}
    >
        {direction === "inbound" ? "Incoming" : "Outgoing"}
    </span>
);

/**
 * The failures/total pair with its percentage, coloured against this lane's own
 * threshold rather than a fixed scale — 5% is an emergency on an inbound lane
 * and unremarkable on an outbound one.
 */
export const RateCell = ({
    failed,
    total,
    rate,
    threshold,
}: {
    failed: number;
    total: number;
    rate: number;
    threshold: number;
}) => {
    const tone =
        total === 0
            ? "text-white/40"
            : rate >= threshold
                ? "text-red-400"
                : rate >= threshold / 2
                    ? "text-amber-400"
                    : "text-green-400";

    return (
        <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-white/80 tabular-nums">
                {failed.toLocaleString()} / {total.toLocaleString()}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${tone}`}>
                {total === 0 ? "—" : `${rate.toFixed(2)}%`}
            </span>
        </div>
    );
};

/* ---------------------------------------------------------------- helpers */

export const formatDateTime = (iso: string | null | undefined): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

export const formatRelative = (iso: string | null | undefined): string => {
    if (!iso) return "—";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "—";

    const seconds = Math.round((Date.now() - then) / 1000);
    if (seconds < 0) return "just now";
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return `${Math.round(hours / 24)}d ago`;
};

export const formatDuration = (fromIso: string, toIso: string | null): string => {
    const from = new Date(fromIso).getTime();
    const to = toIso ? new Date(toIso).getTime() : Date.now();
    const minutes = Math.max(1, Math.round((to - from) / 60000));

    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

/**
 * A bucket series drawn as bars, no charting dependency.
 *
 * Height is call volume, colour is whether that bucket failed — so a quiet
 * period reads as short grey bars rather than as health, which is the mistake
 * a plain rate line invites.
 */
export const Sparkline = ({
    points,
    threshold,
}: {
    points: Array<{ stamp: string; total: number; failureRate: number }>;
    threshold: number;
}) => {
    if (points.length === 0) {
        return <div className="h-16 text-sm text-white/40">No data in this period.</div>;
    }

    const peak = Math.max(...points.map((p) => p.total), 1);

    return (
        <div className="flex h-16 items-end gap-[2px]">
            {points.map((point) => {
                const heightPct = point.total === 0 ? 4 : Math.max(6, (point.total / peak) * 100);
                const tone =
                    point.total === 0
                        ? "bg-white/10"
                        : point.failureRate >= threshold
                            ? "bg-red-500/70"
                            : point.failureRate >= threshold / 2
                                ? "bg-amber-500/70"
                                : "bg-green-500/50";

                return (
                    <div
                        key={point.stamp}
                        className={`flex-1 rounded-sm ${tone}`}
                        style={{ height: `${heightPct}%` }}
                        title={`${point.stamp} — ${point.total} calls, ${point.failureRate.toFixed(2)}% failed`}
                    />
                );
            })}
        </div>
    );
};
