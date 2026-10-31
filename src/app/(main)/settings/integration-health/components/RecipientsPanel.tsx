"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BellOff, BellRing, Loader2, Mail, Plus, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import {
    addAlertRecipient,
    ALL_PROVIDER_KEYS,
    deleteAlertRecipient,
    getAlertRecipients,
    PROVIDER_LABELS,
    testAlertRecipient,
    updateAlertRecipient,
    type AlertRecipient,
    type Direction,
    type ProviderKey,
} from "@/api/integrations/integration-health.api";
import { buttonClass, formatDateTime, inputClass, panelClass, primaryButtonClass } from "./shared";

const DIRECTION_CHOICES: Array<{ value: Direction | "both"; label: string }> = [
    { value: "both", label: "Both directions" },
    { value: "outbound", label: "Outgoing only" },
    { value: "inbound", label: "Incoming only" },
];

export default function RecipientsPanel() {
    const [recipients, setRecipients] = useState<AlertRecipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);

    // New-recipient form
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [providerKeys, setProviderKeys] = useState<ProviderKey[]>([]);
    const [direction, setDirection] = useState<Direction | "both">("both");
    const [minTier, setMinTier] = useState(2);
    const [notifyOnRecovery, setNotifyOnRecovery] = useState(true);

    const load = async () => {
        try {
            setRecipients(await getAlertRecipients());
        } catch {
            toast.error("Could not load the alert recipient list.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const enabledCount = recipients.filter((r) => r.enabled).length;

    const resetForm = () => {
        setEmail("");
        setName("");
        setProviderKeys([]);
        setDirection("both");
        setMinTier(2);
        setNotifyOnRecovery(true);
    };

    const handleAdd = async () => {
        if (!email.trim()) {
            toast.error("Enter an email address.");
            return;
        }

        setAdding(true);
        try {
            await addAlertRecipient({
                email: email.trim(),
                name: name.trim() || undefined,
                providerKeys,
                directions: direction === "both" ? [] : [direction],
                minTier,
                notifyOnRecovery,
            });
            toast.success(`${email.trim()} will now receive integration alerts.`);
            resetForm();
            await load();
        } catch (error: any) {
            // The API distinguishes a duplicate from a malformed address; both
            // matter to the person typing, so surface its message rather than
            // a generic failure.
            toast.error(error?.response?.data?.message ?? "Could not add that address.");
        } finally {
            setAdding(false);
        }
    };

    const handleToggle = async (recipient: AlertRecipient) => {
        setBusyId(recipient.id);
        try {
            await updateAlertRecipient(recipient.id, { enabled: !recipient.enabled });
            toast.success(
                recipient.enabled
                    ? `${recipient.email} muted — no alerts until re-enabled.`
                    : `${recipient.email} re-enabled.`,
            );
            await load();
        } catch {
            toast.error("Could not update that address.");
        } finally {
            setBusyId(null);
        }
    };

    const handleTest = async (recipient: AlertRecipient) => {
        setBusyId(recipient.id);
        try {
            const result = await testAlertRecipient(recipient.id);
            if (result.delivered > 0) {
                toast.success(`Test alert sent to ${result.email}.`);
            } else {
                toast.error(`Delivery to ${result.email} failed. Check the address and mail logs.`);
            }
            await load();
        } catch {
            toast.error("Could not send the test alert.");
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (recipient: AlertRecipient) => {
        if (!window.confirm(`Remove ${recipient.email} from integration alerts?`)) return;

        setBusyId(recipient.id);
        try {
            const result = await deleteAlertRecipient(recipient.id);
            if (result.listNowEmpty) {
                // Deliberately louder than a normal success toast: an empty list
                // means every future incident goes unreported, and that is the
                // one failure this whole feature exists to prevent.
                toast.error(
                    "Removed — the alert list is now EMPTY. Nobody will be told about the next outage.",
                    { duration: 8000 },
                );
            } else {
                toast.success(`${result.removed} removed.`);
            }
            await load();
        } catch {
            toast.error("Could not remove that address.");
        } finally {
            setBusyId(null);
        }
    };

    const toggleProvider = (key: ProviderKey) => {
        setProviderKeys((current) =>
            current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
        );
    };

    const describeScope = (recipient: AlertRecipient): string => {
        const providers =
            recipient.providerKeys.length === 0
                ? "All providers"
                : recipient.providerKeys.map((k) => PROVIDER_LABELS[k] ?? k).join(", ");
        const lanes =
            recipient.directions.length === 0
                ? "both directions"
                : recipient.directions.map((d) => (d === "inbound" ? "incoming" : "outgoing")).join(", ");
        const tier = recipient.minTier === 1 ? ", critical only" : "";
        return `${providers} · ${lanes}${tier}`;
    };

    return (
        <div className="space-y-4">
            {!loading && enabledCount === 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
                    <div className="text-sm">
                        <p className="font-medium text-red-300">Nobody is receiving alerts</p>
                        <p className="mt-1 text-white/70">
                            The monitor is still measuring, but every incident it opens will go to
                            nobody. Add at least one address below.
                        </p>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------ add form */}
            <div className={`${panelClass} p-4`}>
                <div className="mb-4 flex items-center gap-2">
                    <Mail size={16} className="text-white/60" />
                    <h3 className="text-sm font-semibold text-white">Add an alert recipient</h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs text-white/60">Email address</label>
                        <input
                            className={`${inputClass} w-full`}
                            placeholder="ops@wulfcasino.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void handleAdd();
                            }}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-white/60">Label (optional)</label>
                        <input
                            className={`${inputClass} w-full`}
                            placeholder="Ops on-call"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <label className="mb-2 block text-xs text-white/60">
                        Providers — leave all unticked to receive alerts for every provider
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {ALL_PROVIDER_KEYS.map((key) => {
                            const active = providerKeys.includes(key);
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleProvider(key)}
                                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${active
                                        ? "border-[#B93DEB] bg-[#B93DEB]/20 text-white"
                                        : "border-[#2C323D] bg-[#242B35] text-white/60 hover:text-white"
                                        }`}
                                >
                                    {PROVIDER_LABELS[key]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-xs text-white/60">Direction</label>
                        <select
                            className={`${inputClass} w-full`}
                            value={direction}
                            onChange={(e) => setDirection(e.target.value as Direction | "both")}
                        >
                            {DIRECTION_CHOICES.map((choice) => (
                                <option key={choice.value} value={choice.value}>
                                    {choice.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-white/60">Severity</label>
                        <select
                            className={`${inputClass} w-full`}
                            value={minTier}
                            onChange={(e) => setMinTier(Number(e.target.value))}
                        >
                            <option value={2}>Everything</option>
                            <option value={1}>Money &amp; compliance only</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                            <input
                                type="checkbox"
                                checked={notifyOnRecovery}
                                onChange={(e) => setNotifyOnRecovery(e.target.checked)}
                                className="h-4 w-4 accent-[#B93DEB]"
                            />
                            Send &ldquo;back to normal&rdquo; emails
                        </label>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => void handleAdd()}
                    disabled={adding}
                    className={`${primaryButtonClass} mt-4`}
                >
                    {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    Add recipient
                </button>
            </div>

            {/* --------------------------------------------------------- list */}
            <div className={`${panelClass} overflow-hidden`}>
                <div className="border-b border-white/10 px-4 py-3">
                    <h3 className="text-sm font-semibold text-white">
                        Current recipients{" "}
                        <span className="font-normal text-white/50">
                            ({enabledCount} active of {recipients.length})
                        </span>
                    </h3>
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-white/50">
                        <Loader2 size={15} className="animate-spin" /> Loading…
                    </div>
                ) : recipients.length === 0 ? (
                    <div className="p-6 text-sm text-white/50">
                        No addresses configured yet.
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {recipients.map((recipient) => (
                            <div
                                key={recipient.id}
                                className="flex flex-wrap items-center gap-3 px-4 py-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`truncate text-sm ${recipient.enabled ? "text-white" : "text-white/40 line-through"
                                                }`}
                                        >
                                            {recipient.email}
                                        </span>
                                        {recipient.name && (
                                            <span className="text-xs text-white/40">
                                                {recipient.name}
                                            </span>
                                        )}
                                        {recipient.verifiedAt ? (
                                            <span
                                                className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400"
                                                title={`Test alert delivered ${formatDateTime(recipient.verifiedAt)}`}
                                            >
                                                Verified
                                            </span>
                                        ) : (
                                            <span
                                                className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/50"
                                                title="Not yet proven deliverable. Real alerts are still sent."
                                            >
                                                Untested
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 truncate text-xs text-white/50">
                                        {describeScope(recipient)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void handleTest(recipient)}
                                        disabled={busyId === recipient.id}
                                        className={buttonClass}
                                        title="Send a sample alert to this address"
                                    >
                                        <Send size={14} />
                                        Test
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleToggle(recipient)}
                                        disabled={busyId === recipient.id}
                                        className={buttonClass}
                                        title={recipient.enabled ? "Mute this address" : "Re-enable"}
                                    >
                                        {recipient.enabled ? (
                                            <BellRing size={14} />
                                        ) : (
                                            <BellOff size={14} />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(recipient)}
                                        disabled={busyId === recipient.id}
                                        className={`${buttonClass} hover:text-red-400`}
                                        title="Remove"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
