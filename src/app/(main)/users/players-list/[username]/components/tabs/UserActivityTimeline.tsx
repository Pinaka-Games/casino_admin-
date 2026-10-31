"use client";

/**
 * Everything this player has done, as a journey rather than a log.
 *
 * The tab above already answers "what did they play" and "what did they spend".
 * This answers the question those cannot: the ORDER of events — signed in on a
 * new device, opened a game, gave up on KYC, bought a bundle twenty minutes
 * later. Support and fraud reviews both start from that sequence, and until now
 * it could only be reconstructed by opening five tabs and comparing timestamps
 * by eye.
 *
 * Nothing here is a new log: the API derives the timeline from rows the
 * platform already keeps (sessions, game sessions, transactions, the KYC
 * profile), so it works retroactively for accounts that existed long before
 * this screen did.
 *
 * ── Shape ─────────────────────────────────────────────────────────────────
 *   toolbar   — kind pills, reset, search, time range
 *   journey   — the page's events left-to-right, oldest first, as a flow
 *   timeline  — the same events top-to-bottom with a rail, in the chosen order
 *
 * The journey strip and the timeline show the SAME page of events. The strip is
 * the shape of the visit; the timeline is the detail. Both are wired to the one
 * filter state, so a pill narrows both at once.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LogIn,
  LogOut,
  Gamepad2,
  Flag,
  BadgeCheck,
  Wallet,
  CreditCard,
  Gift,
  Trophy,
  Coins,
  ShoppingBag,
  RefreshCw,
  Flame,
  Medal,
  Star,
  Users,
  Undo2,
  Unlock,
  ArrowLeftRight,
  Banknote,
  MinusCircle,
  Ticket,
  Activity,
  ShieldX,
  Clock,
  Search,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  Layers,
  ShieldAlert,
  Eye,
  UserPlus,
  HeartHandshake,
  TicketPercent,
  LifeBuoy,
  Lock,
  ThumbsUp,
  Ban,
  CircleSlash,
  type LucideIcon,
} from "lucide-react";
import api from "@/api/config/axios.config";
import TableSkeleton from "@/components/TableSkeleton";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination/Pagination";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { checkedValues } from "@/components/filters/types";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import {
  ACTIVITY_DEFAULTS,
  ACTIVITY_FIELDS,
  buildActivityParams,
} from "./activityFilters";

/**
 * The kinds this build knows how to style. The API is free to add another — a
 * new source, a new milestone — so the event's kind is typed as "one of these,
 * or any other string", and every lookup below falls back rather than
 * rendering an undefined class or crashing on a missing icon.
 */
type KnownKind =
  | "login"
  | "logout"
  | "game_start"
  | "game_end"
  | "kyc"
  | "transaction"
  | "account"
  | "redeem"
  | "responsible_gaming"
  | "promo"
  | "support"
  | "risk";

type ActivityKind = KnownKind | (string & {});

type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  label: string;
  detail?: string | null;
  at: string;
  /**
   * The facts behind the row — device, IP, session id, amounts, provider,
   * references. Ordered label/value pairs the API composes per kind, rendered
   * as-is so a new field on any source needs no change here.
   */
  facts?: { label: string; value: string }[];
  /** Machine value behind the label — TransactionSource, revoke reason, KYC status. */
  sourceKey?: string;
  /** What the wallet did, per currency: the delta and the balances either side. */
  impact?: {
    currency: string;
    delta: string;
    before?: string | null;
    after?: string | null;
  }[];
};

/**
 * Matches the game-history table directly above it in the same tab, which also
 * pages at 10. Two lists stacked on one screen paging at different sizes reads
 * as a bug, and 25 rows of activity pushed the pager off the bottom of the tab
 * entirely.
 */
const PAGE_SIZE = 10;

/**
 * Anchor for the Game History toolbar's "View Activity Log" button, which sits
 * above this list in the same tab. Only an explicit click scrolls: arriving on
 * the tab from anywhere else leaves the page where it opened.
 */
export const USER_ACTIVITY_ANCHOR = "user-activity";

/** Anchor for the journey strip's "View all activities" link. */
const TIMELINE_ANCHOR = "user-activity-timeline";

const KIND_ICONS: Record<KnownKind, LucideIcon> = {
  login: LogIn,
  logout: LogOut,
  game_start: Gamepad2,
  game_end: Flag,
  kyc: BadgeCheck,
  transaction: Wallet,
  account: UserPlus,
  redeem: CreditCard,
  responsible_gaming: HeartHandshake,
  promo: TicketPercent,
  support: LifeBuoy,
  risk: ShieldAlert,
};

/**
 * Every payment, prize and bonus arrives as one `transaction` kind, so a single
 * wallet icon made a bundle purchase, a redeem, a daily streak and a tournament
 * win look identical in the list.
 *
 * Keyed on the API's own `sourceKey` (the TransactionSource) rather than on the
 * human label: the label is prose and gets reworded, the source is a contract.
 * A source this build has not seen falls through to the wallet, which is the
 * honest default for "some movement of money".
 */
const TRANSACTION_ICONS: Record<string, LucideIcon> = {
  BUNDLE_PURCHASE: ShoppingBag,
  BREEZE_PAYIN: Banknote,
  COINFLOW_PAYIN: Banknote,
  MANUAL_DEPOSIT: Banknote,
  REDEEM: CreditCard,
  SUBSCRIPTION_BUY: RefreshCw,
  SUBSCRIPTION_UPGRADE: RefreshCw,
  SUBSCRIPTION_RENEW: RefreshCw,
  DEPOSIT_BONUS: Gift,
  LEVEL_UP_BONUS: Star,
  DAILY_STREAK: Flame,
  ACHIEVEMENT_REWARD: Medal,
  RAKEBACK: Coins,
  BONUS_CONVERSION: ArrowLeftRight,
  ROLLOVER_UNLOCK: Unlock,
  REFERRAL_COMMISSION: Users,
  REFERRAL_REVERSAL: Undo2,
  TOURNAMENT_WIN: Trophy,
  RACE_ENTRY: Ticket,
  RACE_REWARD: Trophy,
  WALLET_ADD: Wallet,
  WALLET_DEDUCT: MinusCircle,
  TRANSFER: ArrowLeftRight,
};

/** Why a session ended, when the reason is worth its own mark. */
const LOGOUT_ICONS: Record<string, LucideIcon> = {
  EXPIRED: Clock,
  ADMIN_REVOKED: ShieldX,
  ACCOUNT_DISABLED: ShieldX,
  REPLAY_DETECTED: ShieldX,
  PASSWORD_RESET: ShieldX,
  DEVICE_LIMIT: ShieldX,
};

const KYC_ICONS: Record<string, LucideIcon> = {
  REJECTED: ShieldX,
  APPROVED: BadgeCheck,
};

const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  CREATED: UserPlus,
  LOCKED: Lock,
  VIP_TIER_CHANGED: Star,
};

/** A redeem's outcome, which is the whole point of the row. */
const REDEEM_ICONS: Record<string, LucideIcon> = {
  APPROVED: ThumbsUp,
  REJECTED: Ban,
  PROCESSED: Banknote,
  CANCELLED: CircleSlash,
};

/** Passed, challenged, blocked — three very different things. */
const RISK_ICONS: Record<string, LucideIcon> = {
  ALLOW: BadgeCheck,
  STEP_UP: ShieldAlert,
  BLOCK: Ban,
};

/** Anything the API invents after this build shipped still gets a mark. */
const FALLBACK_ICON = Activity;
const FALLBACK_TONE = "bg-gray-500/10 text-gray-300";
const FALLBACK_ACCENT = "#94A3B8";

const toneOf = (kind: string) =>
  KIND_TONES[kind as KnownKind] ?? FALLBACK_TONE;
const accentOf = (kind: string) =>
  KIND_ACCENT[kind as KnownKind] ?? FALLBACK_ACCENT;

const iconFor = (event: ActivityEvent): LucideIcon => {
  const key = event.sourceKey;
  if (key) {
    if (event.kind === "transaction" && TRANSACTION_ICONS[key])
      return TRANSACTION_ICONS[key];
    if (event.kind === "logout" && LOGOUT_ICONS[key]) return LOGOUT_ICONS[key];
    if (event.kind === "kyc" && KYC_ICONS[key]) return KYC_ICONS[key];
    if (event.kind === "account" && ACCOUNT_ICONS[key]) return ACCOUNT_ICONS[key];
    if (event.kind === "redeem" && REDEEM_ICONS[key]) return REDEEM_ICONS[key];
    if (event.kind === "risk" && RISK_ICONS[key]) return RISK_ICONS[key];
  }
  return KIND_ICONS[event.kind as KnownKind] ?? FALLBACK_ICON;
};

/**
 * One accent per kind, used for the node fill, the rail dot and the active
 * pill — so a colour means the same thing everywhere on the screen.
 */
const KIND_ACCENT: Record<KnownKind, string> = {
  login: "#22C55E",
  logout: "#F43F5E",
  game_start: "#B93DEB",
  game_end: "#38BDF8",
  kyc: "#14B8A6",
  transaction: "#F59E0B",
  account: "#8B5CF6",
  redeem: "#FB923C",
  responsible_gaming: "#2DD4BF",
  promo: "#EC4899",
  support: "#60A5FA",
  risk: "#EF4444",
};

const KIND_TONES: Record<KnownKind, string> = {
  login: "bg-[#22C55E]/10 text-[#4ADE80]",
  logout: "bg-[#F43F5E]/10 text-[#FB7185]",
  game_start: "bg-[#B93DEB]/10 text-[#C77BF0]",
  game_end: "bg-[#38BDF8]/10 text-[#7DD3FC]",
  kyc: "bg-[#14B8A6]/10 text-[#2DD4BF]",
  transaction: "bg-[#F59E0B]/10 text-[#F59E0B]",
  account: "bg-[#8B5CF6]/10 text-[#A78BFA]",
  redeem: "bg-[#FB923C]/10 text-[#FDBA74]",
  responsible_gaming: "bg-[#2DD4BF]/10 text-[#5EEAD4]",
  promo: "bg-[#EC4899]/10 text-[#F9A8D4]",
  support: "bg-[#60A5FA]/10 text-[#93C5FD]",
  risk: "bg-[#EF4444]/10 text-[#FCA5A5]",
};

const PILL_ACTIVE: Record<KnownKind, string> = {
  login: "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#4ADE80]",
  logout: "border-[#F43F5E]/40 bg-[#F43F5E]/10 text-[#FB7185]",
  game_start: "border-[#B93DEB]/40 bg-[#B93DEB]/10 text-[#C77BF0]",
  game_end: "border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#7DD3FC]",
  kyc: "border-[#14B8A6]/40 bg-[#14B8A6]/10 text-[#2DD4BF]",
  transaction: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B]",
  account: "border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-[#A78BFA]",
  redeem: "border-[#FB923C]/40 bg-[#FB923C]/10 text-[#FDBA74]",
  responsible_gaming: "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#5EEAD4]",
  promo: "border-[#EC4899]/40 bg-[#EC4899]/10 text-[#F9A8D4]",
  support: "border-[#60A5FA]/40 bg-[#60A5FA]/10 text-[#93C5FD]",
  risk: "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#FCA5A5]",
};

/**
 * The pills, in the order a visit tends to run. These are the six kinds the API
 * actually emits — deposits, withdrawals and bonuses all arrive as one
 * `transaction` kind, so they are one pill rather than three that would each
 * silently return the same rows.
 */
const KIND_PILLS: { value: KnownKind; label: string }[] = [
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "game_start", label: "Play Game" },
  { value: "game_end", label: "Game End" },
  { value: "transaction", label: "Payments" },
  { value: "redeem", label: "Redeems" },
  { value: "promo", label: "Promos" },
  { value: "kyc", label: "KYC" },
  { value: "responsible_gaming", label: "Safer Gambling" },
  { value: "risk", label: "Risk" },
  { value: "support", label: "Support" },
  { value: "account", label: "Account" },
];

const RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  // Two date inputs do not fit a trigger this size, so the one option that
  // needs them hands off to the sheet rather than being dropped.
  { value: "custom", label: "Custom Range…" },
];

/**
 * Money and identity decide cases; a routine sign-in is the noise around them.
 * The list weights the two differently rather than giving every row the same
 * voice.
 */
const HIGH_SIGNAL: ReadonlySet<string> = new Set<string>([
  "transaction",
  "kyc",
  "redeem",
  "responsible_gaming",
  "risk",
  "account",
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

const formatFull = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}, ${date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

/** "8 Sep, 19:42" — the form the reference uses, compact enough for a rail. */
const formatStamp = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  })}, ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

/**
 * `detail` arrives pre-composed, e.g.
 *   "Chrome on Windows · desktop — 106.219.170.13 · IN"
 *   "USD 25.00 · Breeze"
 *   "Sweet Bonanza"
 * Only the IP is pulled back out, to spot a device change between two adjacent
 * events. The rest is shown as the API wrote it — the reference puts one plain
 * description line under each label, and splitting a game name into chips would
 * dress a single fact up as several.
 */
const ipOf = (raw?: string | null) => {
  if (!raw) return null;
  const parts = raw
    .split(" — ")
    .flatMap((segment) => segment.split(" · "))
    .map((part) => part.trim());
  return parts.find((part) => IPV4.test(part) || part.includes(":")) ?? null;
};

const UserActivityTimeline = ({ userId }: { userId: string }) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailEvent, setDetailEvent] = useState<ActivityEvent | null>(null);

  const {
    values: filters,
    setValues: setFilters,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    hasAnyFilter,
  } = useEntityFilters({
    fields: ACTIVITY_FIELDS,
    defaults: ACTIVITY_DEFAULTS,
  });

  const activeKinds = checkedValues(filters.kinds);
  const ascending = filters.order === "asc";

  /**
   * The pills write the same `kinds` value the filter sheet used to own.
   * Nothing selected means everything, so "All" is simply the empty state
   * rather than a seventh value the API would have to understand.
   */
  const toggleKind = (kind: ActivityKind) => {
    setFilters((prev) => {
      const current = checkedValues(prev.kinds);
      const next = current.includes(kind)
        ? current.filter((entry) => entry !== kind)
        : [...current, kind];
      return { ...prev, kinds: next.join(",") };
    });
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters({ ...ACTIVITY_DEFAULTS });
  };

  // Changing a filter changes the result set, so page 4 of the old one means
  // nothing against the new one.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await api.get(`/users/${userId}/activity`, {
        params: {
          page,
          limit: PAGE_SIZE,
          ...buildActivityParams(filters),
        },
      });

      const payload = response.data ?? {};
      setEvents(Array.isArray(payload.data) ? payload.data : []);
      setTotalPages(payload.meta?.totalPages ?? 1);
      setTotal(payload.meta?.total ?? 0);
      setTruncated(Boolean(payload.meta?.truncated));
    } catch {
      // A failed timeline must not blank the tab around it — the game history
      // and the game grids above are fetched separately and stay valid.
      setEvents([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [userId, page, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * The journey reads forwards whichever way the timeline is sorted: an arrow
   * pointing from a later event to an earlier one is a lie about causation, and
   * causation is the only reason to draw the strip at all.
   */
  const journey = useMemo(
    () => (ascending ? events : [...events].reverse()),
    [events, ascending],
  );

  /**
   * IP changes are detected against the event immediately before this one IN
   * TIME, not in list order — so the flag means the same thing whichever way
   * the list is sorted. Both are page-local: ten events is the whole window the
   * server hands over, and the first event of a page never claims a change it
   * cannot see the other side of.
   */
  const changedIds = useMemo(() => {
    const chronological = ascending ? events : [...events].reverse();
    const flagged = new Set<string>();
    let previousIp: string | null = null;

    chronological.forEach((event) => {
      const ip = ipOf(event.detail);
      if (ip) {
        if (previousIp && ip !== previousIp) flagged.add(event.id);
        previousIp = ip;
      }
    });

    return flagged;
  }, [events, ascending]);

  const rangeLabel =
    filters.range === "custom" && (filters.from || filters.to)
      ? `${filters.from || "…"} → ${filters.to || "…"}`
      : (RANGE_OPTIONS.find((option) => option.value === filters.range)?.label ??
        "All Time");

  return (
    <div id={USER_ACTIVITY_ANCHOR} className="w-full scroll-mt-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">User Activity</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Every operation this player performed on the platform
            {!loading && total > 0 && (
              <>
                {" · "}
                <span className="text-gray-400">
                  {total.toLocaleString("en-US")}{" "}
                  {total === 1 ? "event" : "events"}
                </span>
              </>
            )}
          </p>
        </div>

        <Select
          value={filters.range || "all"}
          onValueChange={(value) => {
            if (value === "custom") {
              setFilters((prev) => ({ ...prev, range: "custom" }));
              setSheetOpen(true);
              return;
            }
            // Picking a preset must clear any custom dates, or the API would
            // receive a range AND a from/to that disagree with it.
            setFilters((prev) => ({ ...prev, range: value, from: "", to: "" }));
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-[170px] border-gray-700 bg-[#242B35] text-white">
            <span className="flex items-center gap-2 truncate">
              <Calendar size={14} className="shrink-0 text-[#B93DEB]" />
              <span className="truncate">{rangeLabel}</span>
            </span>
          </SelectTrigger>
          <SelectContent className="border-gray-700 bg-[#1A2027] text-white">
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Toolbar: kind pills + reset + search ───────────────────────── */}
      {/* One row, always. The pills used to wrap once there were more than a
          handful of kinds, which pushed the search box onto a line of its own —
          so they scroll sideways instead, and the search stays where the eye
          already looks for it. The scrollbar is hidden: the row is short enough
          that a visible one would cost more than it explains. */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-800/60 bg-[#191D24] px-3 py-3 sm:flex-row sm:items-center sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setFilters((prev) => ({ ...prev, kinds: "" }))}
          aria-pressed={activeKinds.length === 0}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            activeKinds.length === 0
              ? "border-[#B93DEB]/40 bg-[#B93DEB]/15 text-white"
              : "border-gray-800 bg-[#1A2027] text-gray-400 hover:border-gray-700 hover:text-gray-200"
          }`}
        >
          <Layers size={14} />
          All
        </button>

        {KIND_PILLS.map((pill) => {
          const on = activeKinds.includes(pill.value);
          const Icon = KIND_ICONS[pill.value];
          return (
            <button
              key={pill.value}
              type="button"
              onClick={() => toggleKind(pill.value)}
              aria-pressed={on}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                on
                  ? PILL_ACTIVE[pill.value]
                  : "border-gray-800 bg-[#1A2027] text-gray-400 hover:border-gray-700 hover:text-gray-200"
              }`}
            >
              <Icon size={14} />
              {pill.label}
            </button>
          );
        })}

        </div>

        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          {hasAnyFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="cursor-pointer px-1 text-xs font-medium text-[#C77BF0] underline-offset-2 hover:underline"
            >
              Reset
            </button>
          )}
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search activities..."
              className="h-9 w-full sm:w-[210px] border-gray-700 bg-[#1A2027] pl-8 text-xs text-white placeholder:text-gray-500"
            />
          </div>
        </div>
      </div>

      {/* ── User Journey ───────────────────────────────────────────────── */}
      {!loading && journey.length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-800/60 bg-[#191D24] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-white">User Journey</h4>
              <p className="mt-0.5 text-[11px] text-gray-500">
                This page of activity in the order it happened
              </p>
            </div>
            <a
              href={`#${TIMELINE_ANCHOR}`}
              className="flex items-center gap-1.5 text-xs font-medium text-[#C77BF0] hover:underline"
            >
              View all activities
              <ArrowRight size={13} />
            </a>
          </div>

          {/* Scrolls sideways rather than wrapping: a journey that wraps to a
              second line reads as two journeys. */}
          <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-track]:bg-transparent">
            <ol className="flex min-w-min items-start gap-2">
              {journey.map((event, index) => {
                const Icon = iconFor(event);
                return (
                  <li key={`journey:${event.id}`} className="flex items-start gap-2">
                    <div className="flex w-[104px] shrink-0 flex-col items-center text-center">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-full ${toneOf(
                          event.kind,
                        )}`}
                      >
                        <Icon size={18} />
                      </span>
                      <span
                        className="mt-2 line-clamp-2 text-[11px] font-medium leading-tight text-white"
                        title={event.label}
                      >
                        {event.label}
                      </span>
                      <span className="mt-1 text-[10px] text-gray-500">
                        {formatStamp(event.at)}
                      </span>
                    </div>
                    {index < journey.length - 1 && (
                      <ArrowRight
                        size={14}
                        className="mt-[18px] shrink-0 text-gray-700"
                        aria-hidden
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {/* ── Activity Timeline ──────────────────────────────────────────── */}
      <div
        id={TIMELINE_ANCHOR}
        className="scroll-mt-6 rounded-xl border border-gray-800/60 bg-[#191D24] px-5 py-4"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">Activity Timeline</h4>
          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                order: prev.order === "asc" ? "desc" : "asc",
              }))
            }
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-700 bg-[#242B35] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#2f3743]"
          >
            <ArrowUpDown size={13} className="text-[#B93DEB]" />
            {ascending ? "Oldest First" : "Newest First"}
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : events.length === 0 ? (
          <div className="py-12">
            <NoData
              title={
                hasAnyFilter
                  ? "No activity matches these filters"
                  : "No activity recorded"
              }
            />
          </div>
        ) : (
          <ol className="relative">
            {events.map((event, index) => {
              const Icon = iconFor(event);
              const accent = accentOf(event.kind);
              const strong = HIGH_SIGNAL.has(event.kind);
              const last = index === events.length - 1;

              return (
                <li
                  key={event.id}
                  className="group relative flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-gray-800/50 py-4 pl-6 pr-1 transition-colors last:border-0 hover:bg-white/[0.02] sm:flex-nowrap sm:gap-4 sm:pl-7 sm:pr-2"
                >
                  {/* The connector, drawn in two halves around the dot so the
                      thread runs unbroken from row to row and stops cleanly at
                      both ends of the list. Drawn on the <li> itself: the
                      previous version hung it off the timestamp column, whose
                      height is only its own text, so the line never reached the
                      next row and the rail read as disconnected dots. */}
                  {index > 0 && (
                    <span
                      aria-hidden
                      className="absolute left-[9px] top-0 h-[22px] w-px bg-gray-800"
                    />
                  )}
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-[9px] top-[22px] w-px bg-gray-800"
                    />
                  )}
                  <span
                    aria-hidden
                    className="absolute left-[5px] top-[17px] h-2.5 w-2.5 rounded-full ring-4 ring-[#191D24]"
                    style={{ background: accent }}
                  />

                  <span
                    className="order-first w-full shrink-0 whitespace-nowrap text-[11px] tabular-nums text-gray-400 sm:order-none sm:mt-2 sm:w-[92px]"
                    title={formatFull(event.at)}
                  >
                    {formatStamp(event.at)}
                  </span>

                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${toneOf(
                      event.kind,
                    )}`}
                  >
                    <Icon size={17} />
                  </span>

                  <div className="min-w-0 flex-1 basis-0 py-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={
                          strong
                            ? "text-sm font-semibold text-white"
                            : "text-sm font-medium text-gray-100"
                        }
                      >
                        {event.label}
                      </span>
                      {changedIds.has(event.id) && (
                        <span
                          className="flex items-center gap-1 rounded-md bg-[#F59E0B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#F59E0B]"
                          title="A different IP from the event immediately before this one on this page"
                        >
                          <ShieldAlert size={10} />
                          IP changed
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 truncate text-xs text-gray-500"
                      title={event.detail ?? ""}
                    >
                      {event.detail || "—"}
                    </p>
                  </div>

                  {/* The row shows the one line that fits; everything the API
                      knows about the event — session id, IP, provider, amounts,
                      references — is one click away rather than truncated into
                      a tooltip. Always rendered, never hover-only: a control an
                      admin cannot see is a control they will not find. */}
                  <button
                    type="button"
                    onClick={() => setDetailEvent(event)}
                    title="View tracking details"
                    aria-label={`View details for ${event.label}`}
                    className="mt-1.5 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-800 bg-[#1A2027] px-3 py-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:border-[#B93DEB]/40 hover:bg-[#B93DEB]/10 hover:text-[#C77BF0] group-hover:border-gray-700"
                  >
                    <Eye size={13} />
                    View
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Said out loud rather than hidden: past the API's merge window the page
          cannot be assembled accurately, and a silently wrong page is worse
          than a sentence explaining the limit. */}
      {truncated && !loading && (
        <p className="mt-3 text-center text-[11px] text-gray-500">
          Only the most recent activity can be paged through here. Use the
          Deposits, Devices or game history views for older records.
        </p>
      )}

      {!loading && totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Everything the API knows about one event, as a definition list in the
          order the server composed it. No parsing here: the row's one-line
          `detail` is a summary, these are the fields behind it. */}
      <Dialog
        open={Boolean(detailEvent)}
        onOpenChange={(open) => !open && setDetailEvent(null)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto border-gray-800 bg-[#191D24] text-white sm:max-w-lg">
          {detailEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneOf(
                      detailEvent.kind,
                    )}`}
                  >
                    {(() => {
                      const Icon = iconFor(detailEvent);
                      return <Icon size={18} />;
                    })()}
                  </span>
                  <span className="text-base font-semibold">
                    {detailEvent.label}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  {formatFull(detailEvent.at)}
                </DialogDescription>
              </DialogHeader>

              {detailEvent.detail && (
                <p className="rounded-lg border border-gray-800 bg-[#15181E] px-3 py-2 text-xs text-gray-300">
                  {detailEvent.detail}
                </p>
              )}

              {/* The wallet movement, drawn as its own block the way the
                  player's own receipt shows it — currency, what it changed by,
                  and the balance either side. A grouped claim reads as one
                  movement even though the wallet wrote several entries. */}
              {detailEvent.impact?.length ? (
                <div className="rounded-lg border border-gray-800 bg-[#15181E] p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#C77BF0]">
                    Wallet impact
                  </p>
                  <div className="space-y-2.5">
                    {detailEvent.impact.map((entry) => {
                      const negative = entry.delta.trim().startsWith("-");
                      return (
                        <div key={`${detailEvent.id}:${entry.currency}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-gray-200">
                              {entry.currency}
                            </span>
                            <span
                              className={`text-xs font-semibold tabular-nums ${
                                negative ? "text-[#FB7185]" : "text-[#4ADE80]"
                              }`}
                            >
                              {entry.delta}
                            </span>
                          </div>
                          {(entry.before || entry.after) && (
                            <div className="mt-0.5 flex items-center justify-between gap-3 text-[11px] text-gray-500">
                              <span>Before: {entry.before ?? "—"}</span>
                              <span>After: {entry.after ?? "—"}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {detailEvent.facts?.length ? (
                <dl className="divide-y divide-gray-800/60 rounded-lg border border-gray-800 bg-[#15181E]">
                  {detailEvent.facts.map((fact) => (
                    <div
                      key={`${detailEvent.id}:${fact.label}`}
                      className="flex items-start gap-3 px-3 py-2"
                    >
                      <dt className="w-[42%] shrink-0 text-[11px] uppercase tracking-wide text-gray-500">
                        {fact.label}
                      </dt>
                      <dd className="min-w-0 flex-1 break-words text-xs text-gray-200">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                // Rows written before the API composed facts, and any kind that
                // genuinely has nothing more to say than its own label.
                <p className="text-xs text-gray-500">
                  No further tracking detail is recorded for this event.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Only reachable from "Custom Range…" above. The pills, the search box
          and the presets cover everything else, so the sheet is no longer the
          front door — just the one control that needs more room than a
          dropdown trigger has. */}
      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Activity Filters"
        description="Narrow this player's timeline by kind of activity and time period"
        fields={ACTIVITY_FIELDS}
        values={filters}
        defaults={ACTIVITY_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default UserActivityTimeline;
