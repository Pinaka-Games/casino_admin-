"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Info,
  Loader2,
  Save,
  Undo2,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { systemConfigApi } from "@/api/system-config/system-config.api";
import type {
  PaymentAudience,
  PaymentChannelConfig,
  PaymentDirection,
  PaymentGatewayKey,
  PaymentMethodCatalog,
  SystemConfigPaymentMethods,
} from "@/types/system-config";

/**
 * Payment Manager — which gateways and which rails inside them are offered, per
 * audience (players / agents) and per direction (pay-in / payout).
 *
 * The gateway/rail LIST is not hardcoded here: it comes from
 * /system-config/payment-methods/catalog, which is generated from the same
 * catalog the API enforces with. Adding a rail on the API therefore surfaces it
 * on this screen with no change in this file.
 *
 * Edits are held as a local draft and committed with Save. Toggling used to
 * write immediately, which meant a five-switch change cost five round trips and
 * five realtime broadcasts, and a half-finished configuration was briefly live
 * — players could hit a state where every rail happened to be off mid-edit.
 * One explicit Save sends the whole section once, so the change lands atomically.
 */

const PARENT_ROUTE = "/settings/payment-processor-management";

/**
 * Brand purple for "on", grey for "off" — the same pair every other toggle in
 * the admin uses (game listing, home page managers, modal management). The bare
 * `Switch` falls back to the theme `--primary`, which in this dark theme is a
 * near-black that reads as OFF at a glance.
 *
 * The thumb is forced white so it stays visible on the purple track.
 */
const TOGGLE_CLASS =
  "cursor-pointer data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700 [&_[data-slot=switch-thumb]]:bg-white";

const HELP_TEXT =
  "Enable or disable each gateway and the individual methods inside it. " +
  "Changes are held until you press Save, then go live at once — open checkouts " +
  "and payout pickers update without a refresh. The choice is enforced when the " +
  "checkout or payout is created, not just hidden in the UI.";

const getApiMessage = (error: unknown, fallback: string) => {
  const err = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return err?.response?.data?.message || err?.message || fallback;
};

const DIRECTION_BLURB: Record<PaymentDirection, string> = {
  payin: "How money comes in — deposits, coin bundles, subscriptions and agent packages.",
  payout: "How money goes out — redeems and affiliate payouts.",
};

/** A gateway with every rail switched off can't be used, so it counts as off. */
const isChannelUsable = (channel: PaymentChannelConfig | undefined) =>
  Boolean(channel?.enabled) &&
  Object.values(channel?.methods ?? {}).some(Boolean);

export default function PaymentManagerPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<PaymentMethodCatalog | null>(null);
  /** Last state the server confirmed — the baseline for dirty checks + Discard. */
  const [serverConfig, setServerConfig] =
    useState<SystemConfigPaymentMethods | null>(null);
  /** What the admin is editing. Diverges from `serverConfig` until Save. */
  const [draft, setDraft] = useState<SystemConfigPaymentMethods | null>(null);
  const [audience, setAudience] = useState<PaymentAudience>("player");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  // The config is a handful of booleans, so serialising it is cheaper than a
  // hand-written deep compare — and memoising means it runs on edit, not on
  // every render.
  const draftSnapshot = useMemo(() => JSON.stringify(draft), [draft]);
  const serverSnapshot = useMemo(() => JSON.stringify(serverConfig), [serverConfig]);
  const isDirty = Boolean(draft) && draftSnapshot !== serverSnapshot;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [catalogData, configResponse] = await Promise.all([
          systemConfigApi.getPaymentMethodCatalog(),
          systemConfigApi.get(),
        ]);
        if (cancelled) return;
        setCatalog(catalogData);
        setServerConfig(configResponse.config.payment_methods);
        setDraft(configResponse.config.payment_methods);
      } catch (error) {
        if (!cancelled) {
          toast.error(getApiMessage(error, "Failed to load payment settings"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Manual save makes it possible to lose work by closing the tab; nothing
  // could be lost while every toggle wrote itself.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    if (!draft) return;

    setIsSaving(true);
    try {
      // One request for the whole section, however many switches moved. The API
      // broadcasts payment_methods_updated once on write, so every open player
      // and agent picker sees the finished configuration — never a partial one.
      const response = await systemConfigApi.patchSection(
        "payment_methods",
        draft,
      );
      setServerConfig(response.config.payment_methods);
      setDraft(response.config.payment_methods);
      setHasSaved(true);
      toast.success("Payment settings saved");
    } catch (error) {
      toast.error(getApiMessage(error, "Failed to save payment settings"));
    } finally {
      setIsSaving(false);
    }
  }, [draft]);

  /** Throw the draft away and go back to what the server last confirmed. */
  const handleDiscard = useCallback(() => {
    setDraft(serverConfig);
  }, [serverConfig]);

  const handleBack = useCallback(() => {
    if (
      isDirty &&
      !window.confirm("You have unsaved changes. Leave without saving?")
    ) {
      return;
    }
    router.push(PARENT_ROUTE);
  }, [isDirty, router]);

  // Both handlers update via the functional form, so neither depends on the
  // current draft and both keep a stable identity across edits.
  const updateChannel = useCallback(
    (
      gateway: PaymentGatewayKey,
      direction: PaymentDirection,
      patch: Partial<PaymentChannelConfig>,
    ) => {
      setDraft((current) => {
        if (!current) return current;
        const channel = current[audience][gateway][direction];
        return {
          ...current,
          [audience]: {
            ...current[audience],
            [gateway]: {
              ...current[audience][gateway],
              [direction]: { ...channel, ...patch },
            },
          },
        };
      });
    },
    [audience],
  );

  const toggleRail = useCallback(
    (
      gateway: PaymentGatewayKey,
      direction: PaymentDirection,
      railKey: string,
      enabled: boolean,
    ) => {
      setDraft((current) => {
        if (!current) return current;
        const channel = current[audience][gateway][direction];
        return {
          ...current,
          [audience]: {
            ...current[audience],
            [gateway]: {
              ...current[audience][gateway],
              [direction]: {
                ...channel,
                methods: { ...channel.methods, [railKey]: enabled },
              },
            },
          },
        };
      });
    },
    [audience],
  );

  const audienceConfig = draft?.[audience];

  return (
    <div className="min-h-screen p-4 text-white">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Payment Manager</h1>
            {/* The full explanation lives behind this icon rather than as a
                permanent paragraph — it is read once and then only gets in the
                way of the switches. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="About the Payment Manager"
                  className="text-gray-500 transition hover:text-white"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm leading-relaxed">
                {HELP_TEXT}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-3">
            <span
              aria-live="polite"
              className="flex items-center gap-1.5 text-sm text-gray-400"
            >
              {isDirty ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Unsaved changes
                </>
              ) : hasSaved ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  Saved
                </>
              ) : null}
            </span>

            {/* Only offered when there is something to throw away. */}
            {isDirty && (
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={isSaving}
                className="border-[#2C323D] bg-[#242B35] text-white hover:bg-[#2C323D]"
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Discard
              </Button>
            )}

            <Button
              onClick={() => void handleSave()}
              disabled={!isDirty || isSaving || loading}
              className="bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Saving…" : "Save"}
            </Button>

            {/* This page has no sidebar entry of its own — it is reached from the
                Payment Processor Management header — so it needs its own way back. */}
            <Button
              variant="outline"
              onClick={handleBack}
              className="border-[#2C323D] bg-[#242B35] text-white hover:bg-[#2C323D]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        {/* Players and agents are configured independently — an affiliate payout
            and a player redeem are different businesses. Switching tabs keeps the
            draft, so one Save commits edits made on both. */}
        <div className="mt-5 inline-flex rounded-lg border border-[#2C323D] bg-[#191D24] p-1">
          {(catalog?.audiences ?? []).map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setAudience(entry.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                audience === entry.key
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {loading || !catalog || !audienceConfig ? (
          <div className="mt-6 flex items-center justify-center rounded-xl border border-[#2C323D] bg-[#191D24] py-20">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {catalog.directions.map((direction) => {
              const anyGatewayUsable = catalog.gateways.some((gateway) =>
                isChannelUsable(
                  audienceConfig[gateway.key]?.[direction.key],
                ),
              );

              return (
                <section key={direction.key}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold">{direction.label}</h2>
                    <p className="text-sm text-gray-400">
                      {DIRECTION_BLURB[direction.key]}
                    </p>
                  </div>

                  {/* The one failure worth shouting about: nothing left to pay
                      with. Everything else degrades to "fewer options". */}
                  {!anyGatewayUsable && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        No gateway is available for{" "}
                        {direction.key === "payin" ? "payments" : "payouts"}.{" "}
                        {audience === "player" ? "Players" : "Agents"} will not
                        be able to{" "}
                        {direction.key === "payin"
                          ? "buy or deposit"
                          : "withdraw"}
                        {isDirty ? " once you save" : ""}.
                      </span>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {catalog.gateways.map((gateway) => {
                      const channelDefinition = gateway.directions.find(
                        (entry) => entry.key === direction.key,
                      );
                      const channel =
                        audienceConfig[gateway.key]?.[direction.key];
                      if (!channelDefinition || !channel) return null;

                      const enabledRailCount = channelDefinition.rails.filter(
                        (rail) => channel.methods[rail.key],
                      ).length;
                      const noRailsLeft =
                        channel.enabled && enabledRailCount === 0;

                      return (
                        <div
                          key={gateway.key}
                          className="rounded-xl border border-[#2C323D] bg-[#191D24] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">
                                {channelDefinition.label}
                              </h3>
                              <p className="mt-0.5 text-xs text-gray-400">
                                {enabledRailCount} of{" "}
                                {channelDefinition.rails.length} methods enabled
                              </p>
                            </div>
                            <Switch
                              checked={channel.enabled}
                              onCheckedChange={(checked) =>
                                updateChannel(gateway.key, direction.key, {
                                  enabled: checked,
                                })
                              }
                              className={TOGGLE_CLASS}
                              aria-label={`${channelDefinition.label} enabled`}
                            />
                          </div>

                          {noRailsLeft && (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>
                                Every method is off, so this gateway is hidden
                                anyway. Enable a method or switch the gateway
                                off to make that explicit.
                              </span>
                            </div>
                          )}

                          <div
                            className={`mt-4 space-y-1 ${
                              channel.enabled
                                ? ""
                                : "pointer-events-none opacity-40"
                            }`}
                          >
                            {channelDefinition.rails.map((rail) => (
                              <div
                                key={rail.key}
                                className="flex items-start justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[#242B35]"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm">{rail.label}</p>
                                  {rail.note && (
                                    <p className="mt-0.5 text-xs text-gray-500">
                                      {rail.note}
                                    </p>
                                  )}
                                </div>
                                <Switch
                                  checked={Boolean(channel.methods[rail.key])}
                                  disabled={!channel.enabled}
                                  onCheckedChange={(checked) =>
                                    toggleRail(
                                      gateway.key,
                                      direction.key,
                                      rail.key,
                                      checked,
                                    )
                                  }
                                  className={TOGGLE_CLASS}
                                  aria-label={`${channelDefinition.label} — ${rail.label}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* A method has to be live at the provider too — this screen cannot
                switch on something the merchant account cannot process. */}
            <p className="pb-6 text-xs text-gray-500">
              A method also has to be enabled on the provider account itself
              (Coinflow / Breeze dashboard). Switching one on here offers it;
              it only reaches the customer if the provider supports it for this
              merchant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
