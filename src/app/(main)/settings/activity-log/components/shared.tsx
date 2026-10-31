"use client";

import {
    CATEGORY_LABELS,
    type ActivityCategory,
    type ActivityStatus,
    type DetailField,
} from "@/api/activity-log/activity-log";

/* ------------------------------------------------------------------ styles */

export const panelClass = "rounded-xl border border-white/10 bg-[#161A21]";
export const inputClass =
    "bg-[#242B35] border border-[#2C323D] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#B93DEB]";
export const buttonClass =
    "flex items-center gap-2 rounded-lg border border-[#2C323D] bg-[#242B35] px-3 py-2 text-sm text-white/80 transition-colors hover:text-white disabled:opacity-40";

/**
 * One colour per category.
 *
 * The point is that money looks different from marketing at a glance — a
 * manager scanning a busy day should be able to find the withdrawals without
 * reading a single action name.
 */
export const CATEGORY_STYLES: Record<ActivityCategory, string> = {
    payout: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    deposit: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    user: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    agent: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    kyc: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    staff: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    settings: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    content: "bg-pink-500/15 text-pink-300 border-pink-500/30",
    reward: "bg-lime-500/15 text-lime-300 border-lime-500/30",
    game: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    auth: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    other: "bg-gray-500/15 text-gray-300 border-gray-500/30",
};

export const STATUS_STYLES: Record<ActivityStatus, string> = {
    success: "bg-green-500/15 text-green-400 border-green-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    reversed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export const STATUS_LABELS: Record<ActivityStatus, string> = {
    success: "Success",
    failed: "Failed",
    reversed: "Reversed",
};

const TONE_STYLES: Record<string, string> = {
    positive: "bg-green-500/15 text-green-400 border-green-500/30",
    negative: "bg-red-500/15 text-red-400 border-red-500/30",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    neutral: "bg-white/5 text-white/70 border-white/15",
};

/* ----------------------------------------------------------------- helpers */

export const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })}, ${d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })}`;
};

/**
 * "3 minutes ago" for anything inside a day, an absolute date beyond that.
 *
 * Relative time is how you read a live log — "just now" answers "is this the
 * change I just made" instantly — but it stops meaning anything past a day or
 * two, where an exact date is what an investigation needs.
 */
export const formatRelative = (value?: string | null) => {
    if (!value) return "—";
    const then = new Date(value).getTime();
    if (isNaN(then)) return "—";

    const seconds = Math.floor((Date.now() - then) / 1000);
    if (seconds < 45) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    return formatDateTime(value);
};

/**
 * `datetime-local` needs a value with no timezone suffix, and it means local
 * time — so the ISO string has to be shifted by the offset before slicing,
 * otherwise the field shows a time the admin did not pick.
 */
export const toLocalInputValue = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return shifted.toISOString().slice(0, 16);
};

export const fromLocalInputValue = (value: string) =>
    value ? new Date(value).toISOString() : undefined;

export const categoryLabel = (category: ActivityCategory) =>
    CATEGORY_LABELS[category] ?? category;

/* --------------------------------------------------------------- primitives */

export const CategoryBadge = ({ category }: { category: ActivityCategory }) => (
    <span
        className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other
            }`}
    >
        {categoryLabel(category)}
    </span>
);

export const StatusBadge = ({ status }: { status: ActivityStatus }) => (
    <span
        className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${STATUS_STYLES[status] ?? STATUS_STYLES.success
            }`}
    >
        {STATUS_LABELS[status] ?? status}
    </span>
);

/**
 * One labelled value in the detail modal.
 *
 * The `type` comes from the API, so this renders rather than infers: money is
 * right-weighted and emphasised, ids are monospaced and selectable, statuses
 * become coloured pills, and long text wraps in its own block instead of
 * squeezing into a cell.
 */
export const DetailValue = ({ field }: { field: DetailField }) => {
    if (field.value === null || field.value === "") {
        return <span className="text-white/25">—</span>;
    }

    switch (field.type) {
        case "money":
            return (
                <span className="font-semibold text-white tabular-nums">
                    {String(field.value)}
                </span>
            );

        case "number":
            return (
                <span className="text-white tabular-nums">{String(field.value)}</span>
            );

        case "id":
            return (
                <span className="font-mono text-xs text-white/70 break-all select-all">
                    {String(field.value)}
                </span>
            );

        case "date":
            return (
                <span className="text-white/80">{formatDateTime(String(field.value))}</span>
            );

        case "boolean":
            return (
                <span
                    className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${field.value ? TONE_STYLES.positive : TONE_STYLES.neutral
                        }`}
                >
                    {field.value ? "Yes" : "No"}
                </span>
            );

        case "status":
            return (
                <span
                    className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${TONE_STYLES[field.tone ?? "neutral"]
                        }`}
                >
                    {String(field.value)}
                </span>
            );

        case "longtext":
            return (
                <span className="text-white/80 whitespace-pre-wrap break-words">
                    {String(field.value)}
                </span>
            );

        case "list":
            return (
                <span className="flex flex-wrap gap-1">
                    {String(field.value)
                        .split(", ")
                        .filter(Boolean)
                        .map((item, i) => (
                            <span
                                key={`${item}-${i}`}
                                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/75"
                            >
                                {item}
                            </span>
                        ))}
                </span>
            );

        default:
            return <span className="text-white/80 break-words">{String(field.value)}</span>;
    }
};
