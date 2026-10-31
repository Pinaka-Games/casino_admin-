"use client";

/**
 * The marketing and analytics tags the player app loads, and the consoles they
 * report into.
 *
 * It lives on Integration Health rather than in System Configuration because
 * this is where the platform's third-party relationships already are — the
 * payment, game and messaging partners on the Health tab, and now the
 * measurement ones. An operator asking "what are we plugged into" has one page
 * to open.
 *
 * Every id here is PUBLIC. A GA4 measurement id, a Clarity project id, a Meta
 * pixel id and a GTM container id all ship inside the page source of every site
 * that uses them, which is why they can live in config and be served to the
 * browser. Nothing secret belongs on this screen: a Measurement Protocol secret
 * or a Conversions API token is a server credential and stays in the
 * environment.
 */

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Info, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { systemConfigApi } from "@/api/system-config/system-config.api";
import type { SystemConfigMarketing } from "@/types/system-config";
import {
    inputClass,
    panelClass,
    primaryButtonClass,
} from "./shared";

const EMPTY: SystemConfigMarketing = {
    ga_measurement_id: "",
    gtm_container_id: "",
    clarity_project_id: "",
    meta_pixel_id: "",
};

type FieldKey = keyof SystemConfigMarketing;

/**
 * Format checks that mirror the player app's own guards exactly.
 *
 * They must not drift: the app rejects a malformed id at its boundary and ships
 * the tag disabled, so a value this screen accepts but the app refuses would
 * look saved and do nothing. Each rule is the reason a wrong-looking id is
 * worth stopping here, where somebody can still fix it.
 */
const FIELDS: Array<{
    key: FieldKey;
    label: string;
    placeholder: string;
    hint: string;
    validate?: (value: string) => string | null;
}> = [
        {
            key: "ga_measurement_id",
            label: "GA4 measurement ID",
            placeholder: "G-XXXXXXXXXX",
            hint: "Google Analytics 4. Leave blank to switch GA off entirely.",
            validate: (value) =>
                /^G-[A-Z0-9]+$/i.test(value)
                    ? null
                    : "Expected a G- measurement id, e.g. G-XXXXXXXXXX.",
        },
        {
            key: "gtm_container_id",
            label: "Tag Manager container ID",
            placeholder: "GTM-XXXXXXX",
            hint:
                "The GTM- container id — not the GT- google tag id and not the G- measurement id. Tag Manager shows all three.",
            validate: (value) =>
                /^GTM-[A-Z0-9]+$/i.test(value)
                    ? null
                    : "Expected a GTM- container id. A GT- id will not load.",
        },
        {
            key: "clarity_project_id",
            label: "Clarity project ID",
            placeholder: "y7qolwb3pw",
            hint: "Microsoft Clarity. Found under Settings → Overview in the project.",
        },
        {
            key: "meta_pixel_id",
            label: "Meta pixel ID",
            placeholder: "123456789012345",
            hint: "Digits only. A pixel name or dataset id here reports nothing at all, silently.",
            validate: (value) =>
                /^\d{10,20}$/.test(value)
                    ? null
                    : "Expected 10-20 digits with no other characters.",
        },
    ];

/**
 * Every third party the platform talks to, and where it is administered.
 *
 * The provider list is the same one Integration Health monitors on the Health
 * tab (see integration-provider.constants.ts) so the two cannot drift: if we
 * call it, it is listed here.
 *
 * `href` is optional on purpose. A provider whose back office is a bespoke,
 * credential-gated URL issued per operator — the game aggregators, the
 * affiliate platform — is listed WITHOUT a link rather than with a guessed one,
 * because a link that 404s is worse than a line telling you to ask the account
 * manager.
 */
const CONSOLE_GROUPS: Array<{
    title: string;
    items: Array<{ name: string; href?: string; note: string }>;
}> = [
        {
            title: "Analytics & marketing",
            items: [
                {
                    name: "Google Analytics",
                    href: "https://analytics.google.com/",
                    note: "Reporting, and the GA4 property that owns the measurement id",
                },
                {
                    name: "Google Tag Manager",
                    href: "https://tagmanager.google.com/",
                    note: "Container, tags and triggers",
                },
                {
                    name: "Google Search Console",
                    href: "https://search.google.com/search-console",
                    note: "Indexing, sitemaps and site verification",
                },
                {
                    name: "Microsoft Clarity",
                    href: "https://clarity.microsoft.com/",
                    note: "Session recordings, heatmaps and integrations",
                },
                {
                    name: "Meta Business",
                    href: "https://business.facebook.com/latest/settings/domains/",
                    note: "Pixel, dataset and domain verification",
                },
            ],
        },
        {
            title: "Payments",
            items: [
                {
                    name: "Breeze",
                    href: "https://dashboard.breeze.cash/",
                    note: "Pay-in and payout dashboard",
                },
                {
                    name: "Coinflow",
                    href: "https://merchant.coinflow.cash/login",
                    note: "Merchant dashboard",
                },
            ],
        },
        {
            title: "Identity & risk",
            items: [
                {
                    name: "SumSub",
                    href: "https://cockpit.sumsub.com/checkus/login?redirect=%2Fhome",
                    note: "KYC applicants, levels and review queue. One app serves every environment, so dev and QA applicants appear here too",
                },
                {
                    // Region-pinned: SEON's console is per-region and the generic
                    // admin.seon.io host does not resolve to this tenant.
                    name: "SEON",
                    href: "https://admin.us-east-1-main.seon.io/scoring-engine",
                    note: "Scoring engine — the fraud and AML rules behind every ALLOW / STEP_UP / BLOCK decision",
                },
            ],
        },
        {
            title: "Messaging",
            items: [
                {
                    name: "SendGrid",
                    href: "https://app.sendgrid.com/",
                    note: "Email delivery, templates and bounce activity",
                },
                {
                    name: "Twilio",
                    href: "https://console.twilio.com/",
                    note: "SMS delivery and phone verification",
                },
            ],
        },
        {
            title: "Games & affiliates",
            items: [
                {
                    name: "AleaPlay",
                    href: "https://app.aleaplay.com/login",
                    note: "Game aggregator back office and integration documentation",
                },
                {
                    name: "SA Gaming",
                    href: "https://saapiservice.com/resources/",
                    note: "Product Portfolio → SA Game List, which is where RTP is published. Page is password-protected; there is no RTP API",
                },
                {
                    name: "Ninja",
                    note: "Affiliate postbacks. Delivery status is on the Ninja Postbacks screen",
                },
            ],
        },
    ];

export default function MarketingPanel() {
    const [value, setValue] = useState<SystemConfigMarketing>(EMPTY);
    const [saved, setSaved] = useState<SystemConfigMarketing>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await systemConfigApi.get();
                if (cancelled) return;
                const marketing = { ...EMPTY, ...(response.config?.marketing ?? {}) };
                setValue(marketing);
                setSaved(marketing);
            } catch {
                if (!cancelled) toast.error("Could not load marketing settings");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // An empty id is how a tag is switched off, so only a NON-empty value that
    // fails its format is an error. Blank is a valid, meaningful state.
    const errors = useMemo(() => {
        const found: Partial<Record<FieldKey, string>> = {};
        FIELDS.forEach((field) => {
            const current = value[field.key]?.trim() ?? "";
            if (!current || !field.validate) return;
            const message = field.validate(current);
            if (message) found[field.key] = message;
        });
        return found;
    }, [value]);

    const dirty = FIELDS.some(
        (field) => (value[field.key] ?? "") !== (saved[field.key] ?? ""),
    );
    const blocked = Object.keys(errors).length > 0;

    const save = async () => {
        if (blocked || !dirty) return;
        setSaving(true);
        try {
            const payload = FIELDS.reduce((acc, field) => {
                acc[field.key] = (value[field.key] ?? "").trim();
                return acc;
            }, {} as SystemConfigMarketing);

            await systemConfigApi.patchSection<SystemConfigMarketing>(
                "marketing",
                payload,
            );
            setValue(payload);
            setSaved(payload);
            toast.success("Marketing settings saved");
        } catch {
            toast.error("Could not save marketing settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className={`${panelClass} flex items-center justify-center p-12`}>
                <Loader2 className="h-6 w-6 animate-spin text-[#B93DEB]" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className={`${panelClass} p-5`}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-white">Tracking tags</h2>
                        <button
                            type="button"
                            onClick={() => setHelpOpen(true)}
                            title="What these do and how they reach the site"
                            aria-label="How tracking tags work"
                            className="flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-white/50 transition-colors hover:border-[#B93DEB]/40 hover:text-[#C77BF0]"
                        >
                            <Info size={12} />
                            How this works
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !dirty || blocked}
                        className={primaryButtonClass}
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save changes
                    </button>
                </div>
                <p className="mb-5 text-xs text-white/40">
                    Served to the player app on every load, so a changed id takes effect
                    on the next page view — no rebuild. Every id here is public and ships
                    in the page source; never put a secret or an API token on this screen.
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                    {FIELDS.map((field) => {
                        const error = errors[field.key];
                        return (
                            <div key={field.key}>
                                <label
                                    htmlFor={`marketing-${field.key}`}
                                    className="mb-1.5 block text-xs font-medium text-white/70"
                                >
                                    {field.label}
                                </label>
                                <input
                                    id={`marketing-${field.key}`}
                                    value={value[field.key] ?? ""}
                                    onChange={(event) =>
                                        setValue((prev) => ({
                                            ...prev,
                                            [field.key]: event.target.value,
                                        }))
                                    }
                                    placeholder={field.placeholder}
                                    spellCheck={false}
                                    autoComplete="off"
                                    className={`${inputClass} w-full ${error ? "border-red-500/60" : ""
                                        }`}
                                />
                                <p
                                    className={`mt-1.5 text-[11px] ${error ? "text-red-400" : "text-white/35"
                                        }`}
                                >
                                    {error ?? field.hint}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={`${panelClass} p-5`}>
                <h2 className="mb-1 text-sm font-semibold text-white">Partner consoles</h2>
                <p className="mb-4 text-xs text-white/40">
                    Every third party the platform calls, grouped by what it does — the
                    same list Integration Health monitors on the Health tab. Links open
                    in a new tab.
                </p>

                <div className="space-y-5">
                    {CONSOLE_GROUPS.map((group) => (
                        <div key={group.title}>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                                {group.title}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {group.items.map((item) => {
                                    const body = (
                                        <>
                                            <span className="min-w-0">
                                                <span className="block text-sm text-white">
                                                    {item.name}
                                                </span>
                                                <span className="mt-0.5 block text-[11px] leading-snug text-white/40">
                                                    {item.note}
                                                </span>
                                            </span>
                                            {item.href ? (
                                                <ExternalLink
                                                    size={14}
                                                    className="mt-0.5 shrink-0 text-white/30 transition-colors group-hover:text-[#C77BF0]"
                                                />
                                            ) : null}
                                        </>
                                    );

                                    // A provider with no console renders as a plain
                                    // card: an anchor with nowhere to go looks
                                    // clickable and is not.
                                    return item.href ? (
                                        <a
                                            key={item.name}
                                            href={item.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-[#1A2027] px-3.5 py-3 transition-colors hover:border-[#B93DEB]/40 hover:bg-[#B93DEB]/5"
                                        >
                                            {body}
                                        </a>
                                    ) : (
                                        <div
                                            key={item.name}
                                            className="flex items-start justify-between gap-3 rounded-lg border border-dashed border-white/10 bg-[#1A2027]/50 px-3.5 py-3"
                                        >
                                            {body}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                <DialogContent className="max-h-[80vh] overflow-y-auto border-white/10 bg-[#161A21] text-white sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base">How tracking tags work</DialogTitle>
                        <DialogDescription className="text-xs text-white/50">
                            What these four ids do, and what happens when you change one.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 text-xs leading-relaxed text-white/70">
                        <div>
                            <p className="mb-1 font-semibold text-white">Where they go</p>
                            <p>
                                The player app reads these from the API every time it loads
                                and installs the matching vendor tag in the browser. Saving
                                here takes effect on the next page view — no rebuild, no
                                deploy.
                            </p>
                        </div>

                        <div>
                            <p className="mb-1 font-semibold text-white">Blank means off</p>
                            <p>
                                An empty field disables that vendor completely. That is the
                                switch — there is no separate toggle. Clearing the Clarity
                                id stops session recording on the next load.
                            </p>
                        </div>

                        <div>
                            <p className="mb-1 font-semibold text-white">
                                GA4 and Tag Manager together
                            </p>
                            <p>
                                Set the GA4 id here <em>and</em> also configure a GA4 tag
                                inside the Tag Manager container, and every event is counted
                                twice. Pick one: measure directly here, or leave the GA4
                                field blank and let the container own it. Same for the Meta
                                pixel.
                            </p>
                        </div>

                        <div>
                            <p className="mb-1 font-semibold text-white">
                                Nothing secret goes here
                            </p>
                            <p>
                                All four ids are public — they ship in the page source of
                                every site that uses them, which is why they can be served
                                to the browser. A Measurement Protocol secret or a
                                Conversions API token is a server credential and belongs in
                                the environment, never on this screen.
                            </p>
                        </div>

                        <div>
                            <p className="mb-1 font-semibold text-white">If the API is down</p>
                            <p>
                                The player app falls back to the ids its image was built
                                with, so analytics keeps running through an outage. A value
                                saved here only wins once the app can read it.
                            </p>
                        </div>

                        <div>
                            <p className="mb-1 font-semibold text-white">
                                Domain verification
                            </p>
                            <p>
                                The Meta domain-verification tag is deliberately not on this
                                screen. It has to be rendered by the server — Meta&apos;s
                                checker rejects a tag added by JavaScript — so it lives in
                                the player app&apos;s layout and changing it needs a deploy.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
