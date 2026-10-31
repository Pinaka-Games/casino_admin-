"use client";

import Image from "next/image";
import { X } from "lucide-react";

import { coingold, coingreen, fortuneicon } from "@/assets/icons";
import CopyButton from "@/components/CopyButton";

/**
 * One gameplay round, as every admin list already has it.
 *
 * Deliberately not tied to one endpoint's row shape: the dashboard's recent
 * plays and a player's game history come from different services with
 * different field names, and both open this. Each caller maps its row into
 * this once — see `RecentTransactions` and the player `ActivityTab`.
 */
export interface RoundDetail {
  gameName?: string | null;
  gameImage?: string | null;
  /** The provider's own game id — what support quotes back to them. */
  gameId?: string | null;
  gameType?: string | null;
  provider?: string | null;
  /** Studio / table host, where the provider reports one. */
  hostName?: string | null;
  roundId?: string | null;
  transactionId?: string | null;
  transactionType?: string | null;
  status?: string | null;
  playedAt?: string | null;
  betAmount: number;
  winAmount: number;
  /** Net result of the round. Pass it settled rather than re-deriving here. */
  profit: number;
  /** Multiplier the provider reported; 0 / omitted when it sent none. */
  payoutMultiplier?: number;
  /** true = Wulf Cash (real), false = Wulf Coin (virtual). */
  isCashPlay: boolean;
  /** A round that paid out without ever costing a stake. */
  isFreeSpin?: boolean;
  /** The game awarded the round (feature/retrigger), not one of our promotions. */
  isFeatureRound?: boolean;
  promoType?: string | null;
  /** Wallet balance in the round's currency; null when none was logged. */
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  player?: string | null;
  playerEmail?: string | null;
}

/** Status pill colours — the four GameplayStatus values the API can return. */
const statusClass = (status?: string | null) => {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "bg-green-500/15 text-green-400";
  if (s === "pending") return "bg-amber-500/15 text-amber-300";
  if (s === "cancelled") return "bg-gray-500/15 text-gray-300";
  if (s === "failed") return "bg-red-500/15 text-red-400";
  return "bg-gray-500/15 text-gray-300";
};

const fmtDate = (val?: string | null) => {
  if (!val) return "-";
  const d = new Date(val);
  return isNaN(d.getTime())
    ? "-"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(d);
};

/** One label / value line. Long ids get a monospace face and a copy button. */
function Field({
  label,
  value,
  mono,
  copy,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  copy?: string | null;
  className?: string;
}) {
  const empty =
    value === null || value === undefined || value === "" || value === "-";
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className={`truncate text-[13px] ${
            empty ? "text-white/30" : "text-white/90"
          } ${mono ? "font-mono text-[11px]" : "font-medium"} ${className ?? ""}`}
          title={typeof value === "string" ? value : undefined}
        >
          {empty ? "—" : value}
        </span>
        {copy ? <CopyButton value={copy} size={12} /> : null}
      </div>
    </div>
  );
}

/**
 * What one round actually was.
 *
 * The tables show the handful of figures an admin scans for; support needs the
 * identifiers behind them — provider, that provider's game id, the round and
 * transaction ids — plus how the round settled. Every field here already
 * arrives with the list, so opening this costs no extra request.
 */
export default function RoundDetailModal({
  round,
  onClose,
}: {
  round: RoundDetail | null;
  onClose: () => void;
}) {
  if (!round) return null;

  const bet = Number(round.betAmount) || 0;
  const win = Number(round.winAmount) || 0;
  const profit = Number(round.profit) || 0;
  // Derived from the round's own money, so it always agrees with the row that
  // was clicked. The provider's figure is shown beside it only when it differs.
  const multiplier = bet > 0 ? win / bet : 0;
  const providerMultiplier = Number(round.payoutMultiplier) || 0;
  const showProviderMultiplier =
    providerMultiplier > 0 && Math.abs(providerMultiplier - multiplier) > 0.005;
  const isWin = profit > 0;

  // A round is played in ONE currency: bet, win and profit all share it.
  const currencyIcon = round.isCashPlay ? coingreen : coingold;
  const currencyLabel = round.isCashPlay ? "Wulf Cash" : "Wulf Coin";

  const Amount = ({ value, color }: { value: string; color?: string }) => (
    <span className="flex items-center gap-1.5">
      <span className="tabular-nums font-bold" style={color ? { color } : undefined}>
        {value}
      </span>
      <Image src={currencyIcon} alt={currencyLabel} width={13} height={13} />
    </span>
  );

  const hasBalances =
    round.balanceBefore != null || round.balanceAfter != null;
  const fmtBalance = (value?: number | null) =>
    value == null || !Number.isFinite(value)
      ? "-"
      : value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1a1d27] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: the game, who played it, when */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/5 bg-[#161B23]">
              {round.gameImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={round.gameImage}
                  alt={round.gameName ?? "game"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      fortuneicon.src ?? (fortuneicon as any);
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Image src={fortuneicon} alt="game" width={22} height={22} className="opacity-80" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-white">
                  {round.gameName || "Unknown game"}
                </h2>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
                    round.status,
                  )}`}
                >
                  {round.status || "unknown"}
                </span>
                {round.isFreeSpin && (
                  <span
                    title={
                      round.promoType
                        ? `Promotional free spin (${round.promoType})`
                        : "Promotional free spin"
                    }
                    className="rounded bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300"
                  >
                    Free Spin
                  </span>
                )}
                {!round.isFreeSpin && round.isFeatureRound && (
                  <span
                    title="The game awarded this round — free-spins feature, retrigger or bonus round. Not a promotional grant."
                    className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300"
                  >
                    Bonus Round
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-white/50">
                {round.player ? `${round.player} · ` : ""}
                {fmtDate(round.playedAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-white/40 transition-colors hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* Money: what the round cost, paid and multiplied by */}
          <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
            <div className="bg-[#13151e]">
              <Field
                label="Bet Amount"
                value={
                  <Amount
                    value={bet.toFixed(2)}
                    color={round.isCashPlay ? "#03B739" : "#DBA727"}
                  />
                }
              />
            </div>
            <div className="bg-[#13151e]">
              <Field label="Win Amount" value={<Amount value={win.toFixed(2)} />} />
            </div>
            <div className="bg-[#13151e]">
              <Field
                label="Profit"
                value={
                  <Amount
                    value={`${isWin ? "+" : ""}${profit.toFixed(2)}`}
                    color={isWin ? "#03B739" : "#EF4444"}
                  />
                }
              />
            </div>
            <div className="bg-[#13151e]">
              <Field
                label="Multiplier"
                value={`${multiplier.toFixed(2)}x${
                  showProviderMultiplier
                    ? ` (provider ${providerMultiplier.toFixed(2)}x)`
                    : ""
                }`}
                className="tabular-nums"
              />
            </div>
          </div>

          {/* Game identity */}
          <div className="grid grid-cols-2 gap-px bg-white/5">
            <div className="bg-[#1a1d27]">
              <Field label="Provider" value={round.provider} copy={round.provider} />
            </div>
            <div className="bg-[#1a1d27]">
              <Field label="Game ID" value={round.gameId ?? "-"} mono copy={round.gameId} />
            </div>
            <div className="bg-[#1a1d27]">
              <Field label="Game Name" value={round.gameName} />
            </div>
            <div className="bg-[#1a1d27]">
              <Field label="Game Type" value={round.gameType} />
            </div>
          </div>

          {/* Transaction identity */}
          <div className="grid grid-cols-1 gap-px bg-white/5 sm:grid-cols-2">
            <div className="bg-[#13151e]">
              <Field label="Round ID" value={round.roundId ?? "-"} mono copy={round.roundId} />
            </div>
            <div className="bg-[#13151e]">
              <Field
                label="Transaction ID"
                value={round.transactionId ?? "-"}
                mono
                copy={round.transactionId}
              />
            </div>
            <div className="bg-[#13151e]">
              <Field label="Transaction Type" value={round.transactionType ?? "-"} />
            </div>
            <div className="bg-[#13151e]">
              <Field label="Currency" value={currencyLabel} />
            </div>
          </div>

          {/* Wallet movement — only where the round logged a snapshot */}
          {hasBalances && (
            <div className="grid grid-cols-2 gap-px bg-white/5">
              <div className="bg-[#1a1d27]">
                <Field
                  label="Balance Before"
                  value={fmtBalance(round.balanceBefore)}
                  className="tabular-nums"
                />
              </div>
              <div className="bg-[#1a1d27]">
                <Field
                  label="Balance After"
                  value={fmtBalance(round.balanceAfter)}
                  className="tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Who played it, where the list does not already say */}
          {(round.player || round.playerEmail || round.hostName) && (
            <div className="grid grid-cols-1 gap-px bg-white/5 sm:grid-cols-2">
              {round.player && (
                <div className="bg-[#13151e]">
                  <Field label="Player" value={round.player} copy={round.player} />
                </div>
              )}
              {round.playerEmail && (
                <div className="bg-[#13151e]">
                  <Field label="Email" value={round.playerEmail} copy={round.playerEmail} />
                </div>
              )}
              {round.hostName && (
                <div className="bg-[#13151e]">
                  <Field label="Studio / Host" value={round.hostName} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
