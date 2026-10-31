"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

import { getFreeSpinProviders, FreeSpinProviderOption } from "@/api/games/games";
import type { FreeSpinSelection } from "@/types/free-spin";
import ConfirmModal from "./ConfirmModal";
import GamePickerModal from "./GamePickerModal";

interface Props {
  value: FreeSpinSelection[];
  onChange: (next: FreeSpinSelection[]) => void;
  disabled?: boolean;
  error?: string;
  /** Template-level spins, used for any game without its own number. */
  defaultSpins?: number;
}

/**
 * Provider + game selection for a free-spin template.
 *
 * ONE provider, MANY games — each game granted separately.
 *
 * AleaPlay puts free spins on exactly one game per bonus and rejects anything
 * else outright:
 *   error.free-spin.multiple-games.not-allowed
 *   "Multiple games are not allowed for free spin for the integrator with id 75."
 *
 * So a template covering N games issues N bonuses. The template's spin count
 * applies to every game unless a game overrides it, which means the cost per
 * player is the SUM — 20 spins over 5 games is 100 spins, not 20. That total is
 * shown here permanently; an admin must never have to work it out themselves.
 */
export default function FreeSpinSelectionPicker({
  value,
  onChange,
  disabled,
  error,
  defaultSpins,
}: Props) {
  const [providers, setProviders] = useState<FreeSpinProviderOption[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<FreeSpinProviderOption | null>(
    null,
  );

  const providerBoxRef = useRef<HTMLDivElement>(null);

  const catalogEmpty = providersLoaded && providers.length === 0;
  // A template carries exactly one provider; `value` stays an array so the
  // stored shape (and the API) is unchanged.
  const selection = value[0] ?? null;
  const totalGames = selection?.games.length ?? 0;

  // What the promotion actually costs one player: every game's own number,
  // falling back to the template default.
  const perGameDefault = Number(defaultSpins) > 0 ? Number(defaultSpins) : 0;
  const totalSpins =
    selection?.games.reduce(
      (sum, g) => sum + (Number(g.spins) > 0 ? Number(g.spins) : perGameDefault),
      0,
    ) ?? 0;

  useEffect(() => {
    let mounted = true;
    setProvidersLoading(true);
    getFreeSpinProviders()
      .then((rows) => mounted && setProviders(rows))
      .catch(() => mounted && setProviders([]))
      .finally(() => {
        if (!mounted) return;
        setProvidersLoading(false);
        setProvidersLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Close the provider menu on outside click / Escape.
  useEffect(() => {
    if (!providerMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (providerBoxRef.current && !providerBoxRef.current.contains(e.target as Node)) {
        setProviderMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setProviderMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [providerMenuOpen]);

  /**
   * Picking a provider replaces the current one. Games belong to a provider, so
   * the previous provider's games can't carry over — the confirm makes that
   * loss explicit rather than silently emptying the list.
   */
  const applyProvider = (provider: FreeSpinProviderOption) => {
    onChange([
      {
        softwareId: provider.softwareId,
        softwareName: provider.softwareName,
        games: [],
      },
    ]);
    setPendingProvider(null);
  };

  const selectProvider = (provider: FreeSpinProviderOption) => {
    setProviderMenuOpen(false);
    if (selection?.softwareId === provider.softwareId) return;

    // Switching providers throws away the games picked for the old one, so it
    // is confirmed rather than done silently.
    if (selection?.games.length) {
      setPendingProvider(provider);
      return;
    }

    applyProvider(provider);
  };

  const setGamesForProvider = (
    softwareId: number,
    games: FreeSpinSelection["games"],
  ) => {
    onChange(
      value.map((selection) =>
        selection.softwareId === softwareId ? { ...selection, games } : selection,
      ),
    );
  };

  return (
    <div className="space-y-3">
      {/* ---------- PROVIDER (one) ---------- */}
      <div ref={providerBoxRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setProviderMenuOpen((o) => !o)}
          className="flex h-10 w-full items-center justify-between rounded-lg bg-[#242B35] px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={selection ? "text-white" : "text-gray-400"}>
            {providersLoading
              ? "Loading providers…"
              : (selection?.softwareName ??
                (selection ? `Provider #${selection.softwareId}` : "Select software provider"))}
          </span>
          <ChevronDown size={16} className="text-gray-400" />
        </button>

        {providerMenuOpen && !disabled && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-gray-700 bg-[#1a2030] shadow-lg">
            {providers.map((provider) => (
              <button
                key={provider.softwareId}
                type="button"
                onClick={() => selectProvider(provider)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-[#242B35]"
              >
                {/* Radio, not a checkbox: exactly one provider can be chosen. */}
                <span
                  aria-hidden
                  className={`size-3.5 flex-none rounded-full border ${
                    selection?.softwareId === provider.softwareId
                      ? "border-purple-500 bg-purple-500 ring-2 ring-inset ring-[#1a2030]"
                      : "border-gray-500"
                  }`}
                />
                <span>
                  {provider.softwareName}{" "}
                  <span className="text-gray-500">({provider.gameCount} games)</span>
                </span>
              </button>
            ))}
            {!providers.length && !providersLoading && (
              <div className="py-4 text-center text-sm text-gray-400">
                No providers available.
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        One provider per template — AleaPlay grants free spins against a single provider.
        Need a second provider? Create a second template with its own spin count.
      </p>
      {catalogEmpty && (
        <p className="text-xs text-amber-400">
          No AleaPlay games found. Run the sync (POST /admin/aleaplay/sync) to populate
          the catalog, then reopen this dialog.
        </p>
      )}

      {/* ---------- GAMES ---------- */}
      {selection && (
        <ProviderGamesPicker
          key={selection.softwareId}
          selection={selection}
          disabled={disabled}
          onChange={(games) => setGamesForProvider(selection.softwareId, games)}
          onRemoveProvider={() => onChange([])}
          defaultSpins={defaultSpins}
        />
      )}

      {totalGames > 0 && (
        <p className="rounded-md bg-[#1F2630] px-3 py-2 text-xs text-gray-300">
          <span className="text-white">
            {totalSpins} spin{totalSpins === 1 ? "" : "s"} per player
          </span>{" "}
          — {totalGames} game{totalGames === 1 ? "" : "s"}, each granted separately.
          {totalGames > 1 ? (
            <>
              {" "}
              AleaPlay allows one game per bonus, so the player gets a separate set of
              spins in every game listed. Edit a game&apos;s number to give it more or
              fewer than the default.
            </>
          ) : null}
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <ConfirmModal
        open={pendingProvider !== null}
        destructive
        title="Switch provider?"
        confirmLabel="Switch and clear"
        message={
          <>
            <p>
              The {selection?.games.length ?? 0} game
              {(selection?.games.length ?? 0) === 1 ? "" : "s"} selected for{" "}
              <span className="text-white">
                {selection?.softwareName ?? "the current provider"}
              </span>{" "}
              will be cleared.
            </p>
            <p className="mt-2 text-gray-400">
              A template covers one provider, so games cannot carry across to{" "}
              {pendingProvider?.softwareName}.
            </p>
          </>
        }
        onConfirm={() => pendingProvider && applyProvider(pendingProvider)}
        onCancel={() => setPendingProvider(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface ProviderGamesPickerProps {
  selection: FreeSpinSelection;
  disabled?: boolean;
  onChange: (games: FreeSpinSelection["games"]) => void;
  onRemoveProvider: () => void;
  /** Shown as the placeholder on each game's spin box. */
  defaultSpins?: number;
}

/**
 * The provider's card: which games are on the template, what each one grants,
 * and the way in to change that.
 *
 * Browsing and ticking happens in {@link GamePickerModal} rather than a
 * dropdown nested in this form — a list inside a scrolling panel meant losing
 * sight of the selection as soon as it grew past a few games.
 */
function ProviderGamesPicker({
  selection,
  disabled,
  onChange,
  onRemoveProvider,
  defaultSpins,
}: ProviderGamesPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-700 bg-[#1F2630] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-white">
          {selection.softwareName ?? `Provider #${selection.softwareId}`}
        </span>
        <button
          type="button"
          onClick={onRemoveProvider}
          disabled={disabled}
          className="text-gray-400 hover:text-red-400 disabled:opacity-50"
          aria-label="Remove provider"
        >
          <X size={14} />
        </button>
      </div>

      {/* One row per selected game with its own spin count. Each game becomes a
          separate AleaPlay bonus, so the number here is what that game grants —
          blank means "use the template default". Capped height so a 200-game
          selection doesn't push the rest of the form off screen. */}
      {selection.games.length > 0 && (
        <div className="mb-2 max-h-48 space-y-1 overflow-y-auto pr-1">
          {selection.games.map((game) => (
            <div
              key={game.id}
              className="flex items-center gap-2 rounded bg-purple-600/15 px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-[11px] text-purple-100">
                {game.name ?? `#${game.id}`}
              </span>

              <input
                type="number"
                min={1}
                disabled={disabled}
                value={game.spins ?? ""}
                placeholder={defaultSpins ? String(defaultSpins) : "spins"}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  onChange(
                    selection.games.map((g) =>
                      g.id === game.id
                        ? { ...g, spins: e.target.value && next > 0 ? next : undefined }
                        : g,
                    ),
                  );
                }}
                className="h-6 w-16 rounded border border-gray-600 bg-[#242B35] px-2 text-center text-[11px] text-white [appearance:textfield] focus:border-purple-500 focus:outline-none disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label={`Spins for ${game.name ?? game.id}`}
              />

              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(selection.games.filter((g) => g.id !== game.id))}
                className="text-purple-300 hover:text-white disabled:opacity-50"
                aria-label={`Remove ${game.name ?? game.id}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setPickerOpen(true)}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-600 bg-[#242B35] px-3 text-xs text-white hover:border-purple-500 hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={14} />
        {selection.games.length
          ? `Edit games (${selection.games.length} selected)`
          : "Select games"}
      </button>

      <GamePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        softwareId={selection.softwareId}
        softwareName={selection.softwareName}
        selected={selection.games}
        defaultSpins={defaultSpins}
        onConfirm={onChange}
      />
    </div>
  );
}
