"use client";

import { useEffect, useState } from "react";
import { Info, Loader2, Lock, X } from "lucide-react";
import toast from "react-hot-toast";

import {
    getNinjaSettings,
    updateNinjaSettings,
    type NinjaSettings,
} from "@/api/ninja/ninja-postbacks.api";

/**
 * The settings an operator owns, with the reasoning next to each control.
 *
 * Every field here used to be an environment variable, which meant changing a
 * retry count was a deploy. What is deliberately NOT here is the postback URL:
 * it can carry a vendor key, so it stays in server configuration where an admin
 * session can neither read it back nor repoint our outbound traffic. The panel
 * shows only which URLs exist and which host is in play.
 */

interface Props {
    onClose: () => void;
    onSaved: () => void;
    configuredUrls: { production: boolean; test: boolean };
    host: string | null;
}

/** Numeric bounds, mirrored from the API. Saving out of range is rejected. */
const LIMITS = {
    timeoutMs: { min: 1000, max: 60000 },
    maxAttempts: { min: 1, max: 50 },
    retryBaseSeconds: { min: 5, max: 3600 },
    retryMaxSeconds: { min: 60, max: 86400 },
    breakerFailureThreshold: { min: 1, max: 1000 },
    breakerCooldownSeconds: { min: 10, max: 86400 },
} as const;

const panelClass = "rounded-xl border border-white/10 bg-[#161A21]";
const inputClass =
    "w-32 rounded-lg border border-white/10 bg-[#0F1319] px-3 py-2 text-sm text-white outline-none focus:border-[#B93DEB]";
const buttonClass =
    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0F1319] px-3 py-2 text-sm text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50";
const primaryButtonClass =
    "inline-flex items-center gap-2 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a32fd2] disabled:opacity-50";

const Row = ({
    label,
    help,
    children,
}: {
    label: string;
    help: string;
    children: React.ReactNode;
}) => (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 py-4 last:border-b-0">
        <div className="max-w-xl">
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">{help}</p>
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

const Toggle = ({
    value,
    onChange,
}: {
    value: boolean;
    onChange: (next: boolean) => void;
}) => (
    <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition ${value ? "bg-[#B93DEB]" : "bg-white/15"}`}
        aria-pressed={value}
    >
        <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-[22px]" : "left-0.5"}`}
        />
    </button>
);

export default function SettingsModal({
    onClose,
    onSaved,
    configuredUrls,
    host,
}: Props) {
    const [form, setForm] = useState<NinjaSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let alive = true;
        void (async () => {
            try {
                const settings = await getNinjaSettings();
                if (alive) setForm(settings);
            } catch {
                toast.error("Could not load Ninja settings.");
                onClose();
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [onClose]);

    const set = <K extends keyof NinjaSettings>(key: K, value: NinjaSettings[K]) =>
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

    const num = (key: keyof typeof LIMITS) => ({
        type: "number" as const,
        className: inputClass,
        min: LIMITS[key].min,
        max: LIMITS[key].max,
        value: form ? (form[key] as number) : 0,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            set(key, Number(e.target.value) as never),
    });

    const onSave = async () => {
        if (!form) return;

        // The API rejects out-of-range values; catching it here means the
        // operator is told which field, not handed a validation array.
        for (const [key, limit] of Object.entries(LIMITS)) {
            const value = form[key as keyof NinjaSettings] as number;
            if (value < limit.min || value > limit.max) {
                toast.error(`${key} must be between ${limit.min} and ${limit.max}.`);
                return;
            }
        }

        if (form.retryMaxSeconds < form.retryBaseSeconds) {
            toast.error("Max retry delay cannot be shorter than the base delay.");
            return;
        }

        if (form.enabled && !form.useTestUrl && !configuredUrls.production) {
            toast.error(
                "No production postback URL is configured on the server. Ask DevOps to set NINJA_POSTBACK_URL first.",
            );
            return;
        }

        if (form.enabled && form.useTestUrl && !configuredUrls.test) {
            toast.error(
                "No test postback URL is configured on the server. Ask DevOps to set NINJA_POSTBACK_TEST_URL first.",
            );
            return;
        }

        setSaving(true);
        try {
            await updateNinjaSettings({
                enabled: form.enabled,
                useTestUrl: form.useTestUrl,
                timeoutMs: form.timeoutMs,
                maxAttempts: form.maxAttempts,
                retryBaseSeconds: form.retryBaseSeconds,
                retryMaxSeconds: form.retryMaxSeconds,
                retryCronEnabled: form.retryCronEnabled,
                breakerFailureThreshold: form.breakerFailureThreshold,
                breakerCooldownSeconds: form.breakerCooldownSeconds,
                countManualDepositsTowardFirst: form.countManualDepositsTowardFirst,
            });
            toast.success("Ninja settings saved.");
            onSaved();
        } catch {
            toast.error("Could not save Ninja settings.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 md:p-8">
            <div className={`${panelClass} w-full max-w-3xl`}>
                {/* ---------------------------------------------------- header */}
                <div className="flex items-start justify-between border-b border-white/10 p-5">
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            Ninja Postback Settings
                        </h2>
                        <p className="mt-1 text-sm text-white/45">
                            Changes take effect within 30 seconds on every API instance. No
                            deploy needed.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {loading || !form ? (
                    <div className="flex items-center justify-center gap-2 p-16 text-white/50">
                        <Loader2 size={18} className="animate-spin" /> Loading…
                    </div>
                ) : (
                    <>
                        <div className="max-h-[65vh] overflow-y-auto px-5">
                            {/* ------------------------------------- how it works */}
                            <div className="mt-5 flex gap-3 rounded-lg border border-[#B93DEB]/25 bg-[#B93DEB]/5 p-4">
                                <Info size={16} className="mt-0.5 shrink-0 text-[#B93DEB]" />
                                <div className="space-y-2 text-xs leading-relaxed text-white/60">
                                    <p>
                                        <span className="text-white/85">How this works.</span> A
                                        player arriving on a Ninja campaign link carries a{" "}
                                        <code className="text-white/80">subid</code>. We store it
                                        against their account, then send Ninja two conversions:{" "}
                                        <span className="text-white/85">registration</span> when the
                                        account is created, and{" "}
                                        <span className="text-white/85">FTD</span> when their first
                                        deposit settles. Each is sent once per player, ever.
                                    </p>
                                    <p>
                                        Every conversion is written to our database{" "}
                                        <span className="text-white/85">before</span> anything is
                                        sent. Turning delivery off, a Ninja outage, or a tripped
                                        break never loses a conversion — it only delays it. Whatever
                                        is queued goes out when delivery resumes.
                                    </p>
                                </div>
                            </div>

                            {/* -------------------------------------- URLs notice */}
                            <div className="mt-4 flex gap-3 rounded-lg border border-white/10 bg-[#0F1319] p-4">
                                <Lock size={16} className="mt-0.5 shrink-0 text-white/40" />
                                <div className="space-y-1 text-xs leading-relaxed text-white/55">
                                    <p>
                                        <span className="text-white/85">
                                            The postback URLs are not editable here.
                                        </span>{" "}
                                        They can contain a vendor key, so they live in server
                                        configuration and are set by DevOps —{" "}
                                        <code className="text-white/70">NINJA_POSTBACK_URL</code> and{" "}
                                        <code className="text-white/70">NINJA_POSTBACK_TEST_URL</code>.
                                        This is what stops an admin account from redirecting player
                                        conversions somewhere else.
                                    </p>
                                    <p>
                                        Production URL:{" "}
                                        <span className={configuredUrls.production ? "text-emerald-300" : "text-red-300"}>
                                            {configuredUrls.production ? "configured" : "not set"}
                                        </span>
                                        {" · "}Test URL:{" "}
                                        <span className={configuredUrls.test ? "text-emerald-300" : "text-red-300"}>
                                            {configuredUrls.test ? "configured" : "not set"}
                                        </span>
                                        {host ? ` · currently sending to ${host}` : ""}
                                    </p>
                                </div>
                            </div>

                            {/* ----------------------------------------- delivery */}
                            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/40">
                                Delivery
                            </h3>
                            <Row
                                label="Send conversions to Ninja"
                                help="Master switch. OFF still records every conversion — it only stops sending. Leave it off until Ninja has given us a URL and the test conversions have been verified; turning it on then delivers everything that queued up in the meantime."
                            >
                                <Toggle
                                    value={form.enabled}
                                    onChange={(v) => set("enabled", v)}
                                />
                            </Row>
                            <Row
                                label="Use the test URL"
                                help="Sends to Ninja's sandbox instead of production. Keep this on for dev and QA so test sign-ups never appear in Ninja's real reporting. Turn it off only on production, after Ninja confirms they received the test conversions."
                            >
                                <Toggle
                                    value={form.useTestUrl}
                                    onChange={(v) => set("useTestUrl", v)}
                                />
                            </Row>
                            <Row
                                label="Request timeout (ms)"
                                help="How long we wait for Ninja to answer one postback. The call is off the player's request path, so this never slows a sign-up or a deposit — a longer value just holds a queued conversion longer. 10000 is a sensible default."
                            >
                                <input {...num("timeoutMs")} />
                            </Row>

                            {/* -------------------------------------------- retry */}
                            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/40">
                                Retries
                            </h3>
                            <Row
                                label="Run the retry sweep"
                                help="A background job that runs every minute and re-sends anything that has not reached Ninja yet. Turn this off only when deliberately draining or debugging — with it off, a conversion that fails its first attempt stays queued until someone retries it by hand."
                            >
                                <Toggle
                                    value={form.retryCronEnabled}
                                    onChange={(v) => set("retryCronEnabled", v)}
                                />
                            </Row>
                            <Row
                                label="Maximum attempts"
                                help="After this many failed attempts a conversion is parked as Failed and stops retrying, so a permanently broken one does not retry forever. It is never deleted — you can still retry it by hand from the table once Ninja is reachable."
                            >
                                <input {...num("maxAttempts")} />
                            </Row>
                            <Row
                                label="First retry delay (seconds)"
                                help="How long we wait before the second attempt. Each further attempt waits twice as long as the last (60s, 120s, 240s…), so a brief vendor blip is retried quickly and a long outage backs off on its own."
                            >
                                <input {...num("retryBaseSeconds")} />
                            </Row>
                            <Row
                                label="Maximum retry delay (seconds)"
                                help="The ceiling that doubling stops at. 3600 means a conversion is retried at least once an hour for as long as it has attempts left."
                            >
                                <input {...num("retryMaxSeconds")} />
                            </Row>

                            {/* -------------------------------------------- break */}
                            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/40">
                                Break (circuit breaker)
                            </h3>
                            <Row
                                label="Failures before the break trips"
                                help="Consecutive failures that stop us calling Ninja at all. Without it, a dead tracker costs one hanging request per registration and per deposit. Conversions keep recording while the break is open — only sending pauses."
                            >
                                <input {...num("breakerFailureThreshold")} />
                            </Row>
                            <Row
                                label="Break cooldown (seconds)"
                                help="How long the break stays open before we try one probe request. If it succeeds the break closes and the queue drains; if it fails the break re-opens for another cooldown."
                            >
                                <input {...num("breakerCooldownSeconds")} />
                            </Row>

                            {/* ------------------------------------ FTD behaviour */}
                            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/40">
                                First-deposit rule
                            </h3>
                            <Row
                                label="Count manual deposits as a deposit"
                                help="Manual (admin-credited) balance never sends an FTD itself — no real money moved. This only decides whether a staff credit makes a player's later real purchase stop counting as their first. Leave it off: the affiliate brought a player who then spent real money, and our bookkeeping in between is not their problem."
                            >
                                <Toggle
                                    value={form.countManualDepositsTowardFirst}
                                    onChange={(v) => set("countManualDepositsTowardFirst", v)}
                                />
                            </Row>

                            {form.updatedAt && (
                                <p className="py-4 text-xs text-white/35">
                                    Last changed {new Date(form.updatedAt).toLocaleString()}
                                    {form.updatedByEmployeeId
                                        ? ` by ${form.updatedByEmployeeId}`
                                        : ""}
                                    .
                                </p>
                            )}
                        </div>

                        {/* ------------------------------------------------ footer */}
                        <div className="flex items-center justify-end gap-3 border-t border-white/10 p-5">
                            <button type="button" onClick={onClose} className={buttonClass}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void onSave()}
                                disabled={saving}
                                className={primaryButtonClass}
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                Save settings
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
