"use client";

import { useEffect, useState } from "react";
import {
    AlertTriangle,
    ArrowRight,
    Code2,
    Loader2,
    Monitor,
    Shield,
    X,
} from "lucide-react";
import toast from "react-hot-toast";

import CopyButton from "@/components/CopyButton";
import {
    getActivityLog,
    type ActivityDetail,
    type ActivityRow,
} from "@/api/activity-log/activity-log";
import {
    CategoryBadge,
    DetailValue,
    StatusBadge,
    formatDateTime,
    panelClass,
} from "./shared";

const Card = ({
    title,
    icon,
    children,
}: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) => (
    <div className="rounded-lg bg-[#191D24] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            {icon}
            {title}
        </h3>
        {children}
    </div>
);

const Cell = ({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) => (
    <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-white/40">
            {label}
        </span>
        <div className="text-sm">{children}</div>
    </div>
);

/**
 * The full record of one action.
 *
 * Everything here is rendered from typed, labelled fields the API produced —
 * this component never inspects a payload to decide what a value means. That is
 * what keeps the modal readable for a manager while a new action type, with
 * fields nobody anticipated, still renders correctly the day it ships.
 *
 * The raw payload is behind a toggle rather than absent: a manager should never
 * meet JSON, and an engineer investigating an incident should never be told the
 * formatted view is all there is.
 */
export default function ActivityDetailModal({
    row,
    onClose,
}: {
    row: ActivityRow;
    onClose: () => void;
}) {
    const [detail, setDetail] = useState<ActivityDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showRaw, setShowRaw] = useState(false);

    // No `setLoading(true)` here. `loading` already starts true, and the parent
    // keys this component on the row id, so opening a different entry remounts
    // with fresh state rather than resetting it through a cascading render.
    useEffect(() => {
        let cancelled = false;

        getActivityLog(row.id)
            .then((data) => {
                if (!cancelled) setDetail(data);
            })
            .catch(() => {
                if (!cancelled) toast.error("Could not load this entry");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [row.id]);

    // Esc closes, matching every other dialog in the panel.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    // The list row is already loaded, so the header renders immediately and
    // only the body waits — the modal never opens empty.
    const head = detail ?? row;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={onClose}
        >
            <div
                className={`${panelClass} flex max-h-[90vh] w-full max-w-4xl flex-col`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── header ─────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
                    <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-white">
                                {head.actionLabel}
                            </h2>
                            <CategoryBadge category={head.category} />
                            <StatusBadge status={head.status} />
                            {head.sensitive && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                                    <Shield size={10} />
                                    Sensitive
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white/70">{head.summary}</p>
                        <p className="mt-1 text-xs text-white/40">
                            {formatDateTime(head.createdAt)}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── body ───────────────────────────────────────────────── */}
                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-16 text-white/50">
                            <Loader2 className="animate-spin" size={18} />
                            Loading details…
                        </div>
                    )}

                    {!loading && detail && (
                        <>
                            {detail.errorMessage && (
                                <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                                    <AlertTriangle
                                        size={16}
                                        className="mt-0.5 shrink-0 text-red-400"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-red-300">
                                            This action did not complete
                                        </p>
                                        <p className="mt-1 text-sm break-words text-white/70">
                                            {detail.errorMessage}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Who did it */}
                            <Card title="Performed By">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <Cell label="Admin">
                                        <span className="text-white">{detail.actorName}</span>
                                    </Cell>
                                    <Cell label="Email">
                                        <span className="text-white/80 break-all">
                                            {detail.actorEmail ?? "—"}
                                        </span>
                                    </Cell>
                                    <Cell label="Role">
                                        <span className="capitalize text-white/80">
                                            {detail.actorRole ?? "—"}
                                        </span>
                                    </Cell>
                                    <Cell label="Admin ID">
                                        <span className="flex items-center gap-1">
                                            <span className="font-mono text-xs text-white/60 break-all">
                                                {detail.actorId ?? "—"}
                                            </span>
                                            <CopyButton value={detail.actorId} />
                                        </span>
                                    </Cell>
                                </div>
                            </Card>

                            {/* Who it was done to */}
                            {(detail.targetLabel || detail.targetId) && (
                                <Card title="Affected">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <Cell label="Name">
                                            <span className="text-white">
                                                {detail.targetLabel ?? "—"}
                                            </span>
                                        </Cell>
                                        <Cell label="Email / Phone">
                                            <span className="text-white/80 break-all">
                                                {detail.targetSecondary ?? "—"}
                                            </span>
                                        </Cell>
                                        <Cell label="Type">
                                            <span className="capitalize text-white/80">
                                                {detail.targetType?.replace(/_/g, " ") ?? "—"}
                                            </span>
                                        </Cell>
                                        <Cell label="ID">
                                            <span className="flex items-center gap-1">
                                                <span className="font-mono text-xs text-white/60 break-all">
                                                    {detail.targetId ?? "—"}
                                                </span>
                                                <CopyButton value={detail.targetId} />
                                            </span>
                                        </Cell>
                                    </div>
                                </Card>
                            )}

                            {/* What changed — the question an audit trail exists to answer */}
                            {detail.changes.length > 0 && (
                                <Card title="What Changed">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[420px] text-sm">
                                            <thead>
                                                <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
                                                    <th className="pb-2 pr-4 font-medium">Field</th>
                                                    <th className="pb-2 pr-4 font-medium">Previous</th>
                                                    <th className="pb-2 font-medium">New</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.changes.map((change) => (
                                                    <tr
                                                        key={change.field}
                                                        className="border-t border-white/5"
                                                    >
                                                        <td className="py-2 pr-4 text-white/70">
                                                            {change.field}
                                                        </td>
                                                        <td className="py-2 pr-4">
                                                            <span className="text-white/50 line-through decoration-white/25">
                                                                {change.from}
                                                            </span>
                                                        </td>
                                                        <td className="py-2">
                                                            <span className="flex items-center gap-2 text-white">
                                                                <ArrowRight
                                                                    size={12}
                                                                    className="shrink-0 text-white/30"
                                                                />
                                                                {change.to}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}

                            {/* Action-specific fields, grouped and labelled by the API */}
                            {detail.details.map((section) => (
                                <Card key={section.title} title={section.title}>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        {section.fields.map((field) => (
                                            <Cell key={field.label} label={field.label}>
                                                <DetailValue field={field} />
                                            </Cell>
                                        ))}
                                    </div>
                                </Card>
                            ))}

                            {/* Where it came from */}
                            <Card
                                title="Origin"
                                icon={<Monitor size={14} className="text-white/40" />}
                            >
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <Cell label="IP Address">
                                        <span className="flex items-center gap-1">
                                            <span className="font-mono text-xs text-white/80">
                                                {detail.ipAddress ?? "—"}
                                            </span>
                                            <CopyButton value={detail.ipAddress} />
                                        </span>
                                    </Cell>
                                    <Cell label="Device">
                                        <span className="text-white/80">
                                            {detail.deviceLabel ?? "—"}
                                        </span>
                                    </Cell>
                                    <Cell label="Request">
                                        <span className="font-mono text-xs text-white/60 break-all">
                                            {detail.requestMethod
                                                ? `${detail.requestMethod} ${detail.requestPath ?? ""}`
                                                : "—"}
                                        </span>
                                    </Cell>
                                    <Cell label="Entry ID">
                                        <span className="flex items-center gap-1">
                                            <span className="font-mono text-xs text-white/60 break-all">
                                                {detail.id}
                                            </span>
                                            <CopyButton value={detail.id} />
                                        </span>
                                    </Cell>
                                </div>

                                {detail.userAgent && (
                                    <p className="mt-3 border-t border-white/5 pt-3 text-[11px] break-all text-white/35">
                                        {detail.userAgent}
                                    </p>
                                )}
                            </Card>

                            {/* The record itself, for whoever needs it */}
                            {detail.raw && (
                                <div>
                                    <button
                                        onClick={() => setShowRaw((v) => !v)}
                                        className="flex items-center gap-2 text-xs text-white/40 transition-colors hover:text-white/70"
                                    >
                                        <Code2 size={12} />
                                        {showRaw ? "Hide" : "Show"} raw captured data
                                    </button>

                                    {showRaw && (
                                        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-white/60">
                                            {JSON.stringify(detail.raw, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
