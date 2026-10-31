"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UsDateInput from "@/components/UsDateInput";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  jackpotAdminApi,
  GameJackpotConfig,
  JackpotWin,
  UpsertJackpotPayload,
  JackpotTierConfig,
  UpdateJackpotTierPayload,
} from "@/api/jackpot/jackpot.api";
import GamePicker from "./GamePicker";

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** How the pot pays out — pot-based drop target OR time-based scheduled draw, never both. */
type DropMode = "target" | "schedule";

interface FormState {
  gameId: string;
  enabled: boolean;
  seedAmount: number;
  contributionRate: number;
  mustHitCap: string; // empty = no drop target (scheduled draw only)
  minBetToQualify: number;
  currency: string;
  /** 1 = win pays out free and clear; above 1 locks it behind a rollover. */
  wageringMultiplier: number;
  /** Fixed winner prize; empty = winner takes the full pot. */
  fixedWinAmount: string;
  /** Schedule mode: winner's % of the live pot; empty = full pot. */
  winnerPercent: string;
  drawAt: string; // datetime-local value, empty = no scheduled draw
  /** Participation-window start (datetime-local); empty = always open. */
  roundStartAt: string;
  /** Entry cutoff (datetime-local); empty = entry closes at the draw. */
  participationEndAt: string;
  dropMode: DropMode;
}

/** Rows per page in the Recent Jackpot Winners table. */
const WINS_PER_PAGE = 10;

const EMPTY_FORM: FormState = {
  gameId: "",
  enabled: true,
  seedAmount: 1000,
  contributionRate: 1, // percent (1% = 0.01 fraction)
  mustHitCap: "",
  minBetToQualify: 0,
  currency: "wulfCoin",
  wageringMultiplier: 1,
  fixedWinAmount: "",
  winnerPercent: "",
  drawAt: "",
  roundStartAt: "",
  participationEndAt: "",
  dropMode: "target",
};

/** ISO string -> value for <input type="datetime-local"> (local tz, no seconds). */
const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Current local time as a datetime-local value — used as `min` so only future draws are selectable. */
const nowLocalInput = (): string => toLocalInput(new Date().toISOString());

export default function GameJackpotsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<GameJackpotConfig[]>([]);
  const [wins, setWins] = useState<JackpotWin[]>([]);
  // Winner-table filters. Applied server-side so they reach every win, not just
  // the page on screen.
  const [winSearch, setWinSearch] = useState("");
  const [winFrom, setWinFrom] = useState("");
  const [winTo, setWinTo] = useState("");
  const [winsPage, setWinsPage] = useState(1);
  const [winsTotal, setWinsTotal] = useState(0);
  const [winsTotalPages, setWinsTotalPages] = useState(1);
  const [winsLoading, setWinsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GameJackpotConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<GameJackpotConfig | null>(null);

  // ---- Global progressive tiers (Grand/Major/Minor/Mini) ----
  const [tiers, setTiers] = useState<JackpotTierConfig[]>([]);
  const [tierEditing, setTierEditing] = useState<JackpotTierConfig | null>(null);
  const [tierSaving, setTierSaving] = useState(false);
  // Tier drop mode — pot-based target or time-based scheduled draw, never both.
  const [tierDropMode, setTierDropMode] = useState<DropMode>("target");

  const load = async () => {
    try {
      setLoading(true);
      const [cfgs, w, ts] = await Promise.all([
        jackpotAdminApi.list(),
        jackpotAdminApi.wins(1, WINS_PER_PAGE),
        jackpotAdminApi.listTiers(),
      ]);
      setConfigs(cfgs);
      setWins(w.items);
      setWinsPage(w.page);
      setWinsTotal(w.total);
      setWinsTotalPages(w.totalPages);
      setTiers(ts);
    } catch {
      toast.error("Failed to load jackpots");
    } finally {
      setLoading(false);
    }
  };

  // A filter change always lands back on page 1 — page 3 of the old result set
  // means nothing for the new one. Debounced so typing does not fire per keypress,
  // and skipped on mount because the initial load already fetched page 1.
  const winFiltersTouched = useRef(false);
  useEffect(() => {
    if (!winFiltersTouched.current) {
      winFiltersTouched.current = true;
      return;
    }

    const timer = setTimeout(() => {
      void loadWinsPage(1);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winSearch, winFrom, winTo]);

  /** Page the winners table on its own, without reloading the configs above it. */
  const loadWinsPage = async (page: number) => {
    try {
      setWinsLoading(true);
      const w = await jackpotAdminApi.wins(page, WINS_PER_PAGE, undefined, {
        search: winSearch.trim() || undefined,
        from: winFrom || undefined,
        to: winTo || undefined,
      });
      setWins(w.items);
      setWinsPage(w.page);
      setWinsTotal(w.total);
      setWinsTotalPages(w.totalPages);
    } catch {
      toast.error("Failed to load jackpot winners");
    } finally {
      setWinsLoading(false);
    }
  };

  const toggleTier = async (t: JackpotTierConfig) => {
    try {
      await jackpotAdminApi.setTierEnabled(t.tier, !t.enabled);
      setTiers((prev) =>
        prev.map((p) => (p.tier === t.tier ? { ...p, enabled: !t.enabled } : p))
      );
    } catch {
      toast.error("Failed to toggle tier");
    }
  };

  const saveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierEditing) return;
    const t = tierEditing;
    const payload: UpdateJackpotTierPayload = {
      tier: t.tier,
      enabled: t.enabled,
      label: t.label,
      seedAmount: num(t.seedAmount),
      currentAmount: num(t.currentAmount),
      // input holds a percentage; store back as a 0–1 fraction.
      shareRate: num(t.shareRate) / 100,
      shareType: t.shareType === "fixed" ? "fixed" : "percent",
      shareAmount: num(t.shareAmount),
      // Mutually exclusive drop modes: schedule mode zeroes the pot-based
      // target so only the timed draw can pay out; target mode clears drawAt.
      dropTarget: tierDropMode === "schedule" ? 0 : num(t.dropTarget),
      minBetToQualify: num(t.minBetToQualify),
      currency: t.currency,
      // Coin wins have no rollover to lock them, so never send a multiplier there.
      wageringMultiplier:
        t.currency === "wulfCoin" ? 1 : num(t.wageringMultiplier, 1),
      // Target mode pays a fixed amount (empty = full pot); schedule mode pays
      // a percentage of the live pot (empty = full pot). Each clears the other.
      fixedWinAmount:
        tierDropMode === "schedule" ||
        t.fixedWinAmount == null ||
        String(t.fixedWinAmount) === ""
          ? null
          : num(t.fixedWinAmount),
      winnerPercent:
        tierDropMode === "schedule" &&
        t.winnerPercent != null &&
        String(t.winnerPercent) !== ""
          ? num(t.winnerPercent)
          : null,
      drawAt:
        tierDropMode === "schedule" && t.drawAt && String(t.drawAt) !== ""
          ? new Date(String(t.drawAt)).toISOString()
          : null,
      roundStartAt:
        tierDropMode === "schedule" &&
        t.roundStartAt &&
        String(t.roundStartAt) !== ""
          ? new Date(String(t.roundStartAt)).toISOString()
          : null,
      participationEndAt:
        tierDropMode === "schedule" &&
        t.participationEndAt &&
        String(t.participationEndAt) !== ""
          ? new Date(String(t.participationEndAt)).toISOString()
          : null,
    };
    if (
      payload.winnerPercent != null &&
      (payload.winnerPercent <= 0 || payload.winnerPercent > 100)
    ) {
      toast.error("Winner percent must be between 0 and 100");
      return;
    }
    if (tierDropMode === "schedule" && !payload.drawAt) {
      toast.error("Pick the scheduled draw date & time");
      return;
    }
    if (
      payload.roundStartAt &&
      payload.drawAt &&
      new Date(payload.roundStartAt).getTime() >=
        new Date(payload.drawAt).getTime()
    ) {
      toast.error("Round start must be before the draw time");
      return;
    }
    if (
      payload.roundStartAt &&
      payload.participationEndAt &&
      new Date(payload.roundStartAt).getTime() >=
        new Date(payload.participationEndAt).getTime()
    ) {
      toast.error("Round start must be before entry closes");
      return;
    }
    if (
      payload.participationEndAt &&
      payload.drawAt &&
      new Date(payload.participationEndAt).getTime() >
        new Date(payload.drawAt).getTime()
    ) {
      toast.error("Entry must close no later than the draw time");
      return;
    }
    try {
      setTierSaving(true);
      await jackpotAdminApi.updateTier(payload);
      toast.success(`${t.label} updated`);
      setTierEditing(null);
      await load();
    } catch {
      toast.error("Failed to save tier");
    } finally {
      setTierSaving(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openParticipants = (id: string, title: string) => {
    router.push(
      `/users/game-jackpots/participants/${id}?title=${encodeURIComponent(title)}`
    );
  };

  // Already-configured games — hidden from the picker.
  const configuredGameIds = useMemo(
    () => configs.map((c) => c.gameId),
    [configs],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (c: GameJackpotConfig) => {
    setEditing(c);
    setForm({
      gameId: c.gameId,
      enabled: c.enabled,
      seedAmount: num(c.seedAmount, 1000),
      contributionRate: num(c.contributionRate, 0.01) * 100, // → percent
      mustHitCap: c.mustHitCap == null ? "" : String(num(c.mustHitCap)),
      minBetToQualify: num(c.minBetToQualify, 0),
      currency: c.currency || "wulfCoin",
      wageringMultiplier: num(c.wageringMultiplier, 1),
      fixedWinAmount:
        c.fixedWinAmount == null ? "" : String(num(c.fixedWinAmount)),
      winnerPercent:
        c.winnerPercent == null ? "" : String(num(c.winnerPercent)),
      drawAt: toLocalInput(c.drawAt),
      roundStartAt: toLocalInput(c.roundStartAt),
      participationEndAt: toLocalInput(c.participationEndAt),
      dropMode: c.drawAt ? "schedule" : "target",
    });
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.gameId) {
      toast.error("Select a game");
      return;
    }
    if (form.dropMode === "schedule") {
      if (form.drawAt === "") {
        toast.error("Pick the scheduled draw date & time");
        return;
      }
      // Scheduled draw must be in the future (guards manual typing past the `min`).
      if (new Date(form.drawAt).getTime() <= Date.now()) {
        toast.error("Scheduled draw must be a future date & time");
        return;
      }
      if (
        form.roundStartAt !== "" &&
        new Date(form.roundStartAt).getTime() >=
          new Date(form.drawAt).getTime()
      ) {
        toast.error("Round start must be before the draw time");
        return;
      }
      if (
        form.roundStartAt !== "" &&
        form.participationEndAt !== "" &&
        new Date(form.roundStartAt).getTime() >=
          new Date(form.participationEndAt).getTime()
      ) {
        toast.error("Round start must be before entry closes");
        return;
      }
      if (
        form.participationEndAt !== "" &&
        new Date(form.participationEndAt).getTime() >
          new Date(form.drawAt).getTime()
      ) {
        toast.error("Entry must close no later than the draw time");
        return;
      }
    }
    const payload: UpsertJackpotPayload = {
      gameId: form.gameId,
      enabled: form.enabled,
      seedAmount: form.seedAmount,
      // input holds a percentage; store back as a 0–1 fraction.
      contributionRate: form.contributionRate / 100,
      // Mutually exclusive drop modes: schedule mode clears the pot-based
      // target; target mode clears the scheduled draw.
      mustHitCap:
        form.dropMode === "schedule" || form.mustHitCap === ""
          ? null
          : Number(form.mustHitCap),
      minBetToQualify: form.minBetToQualify,
      currency: form.currency,
      // Coin wins have no rollover to lock them, so never send a multiplier there.
      wageringMultiplier:
        form.currency === "wulfCoin" ? 1 : form.wageringMultiplier,
      // Target mode pays a fixed amount (empty = full pot); schedule mode pays
      // a percentage of the live pot (empty = full pot). Each clears the other.
      fixedWinAmount:
        form.dropMode === "schedule" || form.fixedWinAmount === ""
          ? null
          : Number(form.fixedWinAmount),
      winnerPercent:
        form.dropMode === "schedule" && form.winnerPercent !== ""
          ? Number(form.winnerPercent)
          : null,
      drawAt:
        form.dropMode === "schedule" && form.drawAt !== ""
          ? new Date(form.drawAt).toISOString()
          : null,
      roundStartAt:
        form.dropMode === "schedule" && form.roundStartAt !== ""
          ? new Date(form.roundStartAt).toISOString()
          : null,
      participationEndAt:
        form.dropMode === "schedule" && form.participationEndAt !== ""
          ? new Date(form.participationEndAt).toISOString()
          : null,
    };
    if (
      payload.winnerPercent != null &&
      (payload.winnerPercent <= 0 || payload.winnerPercent > 100)
    ) {
      toast.error("Winner percent must be between 0 and 100");
      return;
    }
    try {
      setSaving(true);
      await jackpotAdminApi.upsert(payload);
      toast.success(editing ? "Jackpot updated" : "Jackpot created");
      setDialogOpen(false);
      await load();
    } catch {
      toast.error("Failed to save jackpot");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: GameJackpotConfig) => {
    try {
      await jackpotAdminApi.setEnabled(c.gameId, !c.enabled);
      setConfigs((prev) =>
        prev.map((p) => (p.gameId === c.gameId ? { ...p, enabled: !c.enabled } : p))
      );
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await jackpotAdminApi.remove(deleteTarget.gameId);
      setConfigs((prev) => prev.filter((p) => p.gameId !== deleteTarget.gameId));
      toast.success("Jackpot removed");
    } catch {
      toast.error("Failed to remove");
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <>
      <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
        <div className="bg-[#191D24] mb-4 px-4 py-3 rounded-lg flex items-center justify-between">
          <h1 className="text-base font-medium text-white">
            Settings / Game Jackpots
          </h1>
          <Button
            onClick={openCreate}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="mr-1 h-4 w-4" /> Add Jackpot
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg bg-[#15181E]">
          {/* ===== Global progressive tiers ===== */}
          <div className="mb-8">
            <h2 className="mb-2 px-1 text-sm font-medium text-white">
              Progressive Jackpot Tiers (Grand / Major / Minor / Mini)
            </h2>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-[#242B35] sticky top-0">
                <tr className="border-b border-gray-800 text-left text-white">
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Tier</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Current Pot</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Seed</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Share</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Drop Target</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Cur</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Wins</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Last Won</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Scheduled Draw</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.length ? (
                  tiers.map((t, idx) => (
                    <tr
                      key={t.tier}
                      className={`hover:bg-[#1a2030] text-gray-300 ${
                        idx % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-white">{t.label}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {num(t.currentAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{num(t.seedAmount).toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.shareType === "fixed"
                          ? `${num(t.shareAmount).toFixed(2)} / bet`
                          : `${(num(t.shareRate) * 100).toFixed(3)}%`}
                      </td>
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                        {num(t.dropTarget).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{t.currency === "wulfCash" ? "WC$" : "WC"}</td>
                      <td className="px-4 py-3">{t.winCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.lastWonAt ? new Date(t.lastWonAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.drawAt
                          ? `${
                              t.roundStartAt
                                ? `${new Date(t.roundStartAt).toLocaleString()} → `
                                : ""
                            }${
                              t.participationEndAt
                                ? `entry closes ${new Date(
                                    t.participationEndAt,
                                  ).toLocaleString()} → `
                                : ""
                            }${new Date(t.drawAt).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleTier(t)}
                          className={`text-xs font-medium ${
                            t.enabled ? "text-[#04AD37]" : "text-red-400"
                          }`}
                        >
                          {t.enabled ? "Enabled" : "Disabled"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setTierEditing({
                                ...t,
                                drawAt: toLocalInput(t.drawAt),
                                roundStartAt: toLocalInput(t.roundStartAt),
                                participationEndAt: toLocalInput(
                                  t.participationEndAt,
                                ),
                                // edit share as a percentage (0.005 → "0.5")
                                shareRate: String(num(t.shareRate) * 100),
                                shareType:
                                  t.shareType === "fixed" ? "fixed" : "percent",
                                shareAmount: String(num(t.shareAmount)),
                              });
                              setTierDropMode(t.drawAt ? "schedule" : "target");
                            }}
                            className="text-gray-300 hover:text-purple-400"
                            title="Edit settings"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => openParticipants(t.id, t.label)}
                            className="text-gray-300 hover:text-purple-400"
                            title="Current round participants"
                          >
                            <Users size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-gray-400">
                      No tiers seeded. Run the jackpot_tiers migration.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* ===== Per-game jackpots ===== */}
          <h2 className="mb-2 px-1 text-sm font-medium text-white">Per-Game Jackpots</h2>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead className="bg-[#242B35] sticky top-0">
              <tr className="border-b border-gray-800 text-left text-white">
                <th className="whitespace-nowrap px-4 py-3 font-normal">Game</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Provider</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Current Pot</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Seed</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Rate</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Drop Target</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Cur</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Wins</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Draw</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Status</th>
                <th className="whitespace-nowrap px-4 py-3 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.length ? (
                configs.map((c, idx) => (
                  <tr
                    key={c.gameId}
                    className={`hover:bg-[#1a2030] text-gray-300 ${
                      idx % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    }`}
                  >
                    <td className="px-4 py-3">{c.gameName}</td>
                    <td className="px-4 py-3">{c.provider}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {num(c.currentAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{num(c.seedAmount).toLocaleString()}</td>
                    <td className="px-4 py-3">{(num(c.contributionRate) * 100).toFixed(2)}%</td>
                    <td className="px-4 py-3">
                      {c.mustHitCap == null ? "—" : num(c.mustHitCap).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{c.currency === "wulfCash" ? "WC$" : "WC"}</td>
                    <td className="px-4 py-3">{c.winCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.drawAt
                        ? `${
                            c.roundStartAt
                              ? `${new Date(c.roundStartAt).toLocaleString()} → `
                              : ""
                          }${
                            c.participationEndAt
                              ? `entry closes ${new Date(
                                  c.participationEndAt,
                                ).toLocaleString()} → `
                              : ""
                          }${new Date(c.drawAt).toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggle(c)}
                        className={`text-xs font-medium ${
                          c.enabled ? "text-[#04AD37]" : "text-red-400"
                        }`}
                      >
                        {c.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(c)}
                          className="text-gray-300 hover:text-purple-400"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => openParticipants(c.id, c.gameName)}
                          className="text-gray-300 hover:text-purple-400"
                          title="Current round participants"
                        >
                          <Users size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="text-gray-300 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-gray-400">
                    No game jackpots configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Recent winners */}
          <div className="mt-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3 px-1">
              <h2 className="text-sm font-medium text-white">
                Recent Jackpot Winners
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={winSearch}
                  onChange={(e) => setWinSearch(e.target.value)}
                  placeholder="Search winner, game or provider"
                  className="h-9 w-full sm:w-60 rounded-md border border-gray-700 bg-[#242B35] px-3 text-xs text-white placeholder:text-gray-500 outline-none"
                />
                <UsDateInput
                  value={winFrom}
                  onChange={setWinFrom}
                  className="h-9 rounded-md border border-gray-700 bg-[#242B35] px-2 flex items-center text-xs text-white"
                />
                <span className="text-xs text-gray-500">to</span>
                <UsDateInput
                  value={winTo}
                  onChange={setWinTo}
                  className="h-9 rounded-md border border-gray-700 bg-[#242B35] px-2 flex items-center text-xs text-white"
                />
                {(winSearch || winFrom || winTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setWinSearch("");
                      setWinFrom("");
                      setWinTo("");
                    }}
                    className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] uppercase tracking-wider text-gray-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-[#242B35] sticky top-0">
                <tr className="border-b border-gray-800 text-left text-white">
                  <th className="whitespace-nowrap px-4 py-3 font-normal">When</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">User</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Game</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Provider</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Amount</th>
                  <th className="whitespace-nowrap px-4 py-3 font-normal">Cur</th>
                </tr>
              </thead>
              <tbody>
                {wins.length ? (
                  wins.map((w, idx) => (
                    <tr
                      key={w.id}
                      className={`text-gray-300 hover:bg-[#1a2030] ${
                        idx % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        {new Date(w.wonAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {w.username || w.userName || w.userId}
                      </td>
                      <td className="px-4 py-3">{w.gameName}</td>
                      <td className="px-4 py-3">
                        {w.provider || (w.tier ? "All games" : "—")}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {num(w.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {w.currency === "wulfCash" ? "WC$" : "WC"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      {winSearch || winFrom || winTo
                      ? "No jackpot wins match these filters."
                      : "No jackpot wins yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {winsTotalPages > 1 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-400">
                <span className="whitespace-nowrap">
                  Page {winsPage} of {winsTotalPages} · {winsTotal} wins
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={winsPage <= 1 || winsLoading}
                    onClick={() => loadWinsPage(winsPage - 1)}
                    className="h-7 bg-[#4A5568] hover:bg-[#5A6578] text-white px-3"
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    disabled={winsPage >= winsTotalPages || winsLoading}
                    onClick={() => loadWinsPage(winsPage + 1)}
                    className="h-7 bg-[#4A5568] hover:bg-[#5A6578] text-white px-3"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier edit dialog */}
      <Dialog open={!!tierEditing} onOpenChange={(o) => !o && setTierEditing(null)}>
        <DialogContent className="bg-[#15181E] text-white border-gray-700 max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              Edit Tier — {tierEditing?.label}
            </DialogTitle>
          </DialogHeader>

          {tierEditing && (
            <form onSubmit={saveTier} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300 text-sm">Label</Label>
                  <Input
                    className="bg-[#242B35] border-gray-700 text-white mt-1"
                    value={tierEditing.label}
                    onChange={(e) =>
                      setTierEditing((t) => t && { ...t, label: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Currency</Label>
                  <Select
                    value={tierEditing.currency}
                    onValueChange={(v) =>
                      setTierEditing((t) => t && { ...t, currency: v })
                    }
                  >
                    <SelectTrigger className="bg-[#242B35] border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                      <SelectItem value="wulfCoin">Wulf Coin</SelectItem>
                      <SelectItem value="wulfCash">Wulf Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Seed Amount (reset floor)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-[#242B35] border-gray-700 text-white mt-1"
                    value={String(tierEditing.seedAmount)}
                    onChange={(e) =>
                      setTierEditing((t) => t && { ...t, seedAmount: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Current Pot (override)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-[#242B35] border-gray-700 text-white mt-1"
                    value={String(tierEditing.currentAmount)}
                    onChange={(e) =>
                      setTierEditing((t) => t && { ...t, currentAmount: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Share Type</Label>
                  <Select
                    value={tierEditing.shareType === "fixed" ? "fixed" : "percent"}
                    onValueChange={(v) =>
                      setTierEditing(
                        (t) => t && { ...t, shareType: v as "percent" | "fixed" },
                      )
                    }
                  >
                    <SelectTrigger className="bg-[#242B35] border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                      <SelectItem value="percent">Percentage of bet</SelectItem>
                      <SelectItem value="fixed">Fixed amount per bet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {tierEditing.shareType === "fixed" ? (
                  <div>
                    <Label className="text-gray-300 text-sm">Share Amount (per bet)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="bg-[#242B35] border-gray-700 text-white mt-1"
                      value={String(tierEditing.shareAmount)}
                      onChange={(e) =>
                        setTierEditing((t) => t && { ...t, shareAmount: e.target.value })
                      }
                    />
                  </div>
                ) : (
                  <div>
                    <Label className="text-gray-300 text-sm">Share Rate (% of each bet)</Label>
                    <div className="relative mt-1">
                      <Input
                        type="number"
                        step="0.01"
                        className="bg-[#242B35] border-gray-700 text-white pr-7"
                        value={String(tierEditing.shareRate)}
                        onChange={(e) =>
                          setTierEditing((t) => t && { ...t, shareRate: e.target.value })
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        %
                      </span>
                    </div>
                  </div>
                )}
                {tierDropMode === "target" && (
                  <div>
                    <Label className="text-gray-300 text-sm">Drop Target</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="bg-[#242B35] border-gray-700 text-white mt-1"
                      value={String(tierEditing.dropTarget)}
                      onChange={(e) =>
                        setTierEditing((t) => t && { ...t, dropTarget: e.target.value })
                      }
                    />
                  </div>
                )}
                <div>
                  <Label className="text-gray-300 text-sm">Min Bet To Qualify</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-[#242B35] border-gray-700 text-white mt-1"
                    value={String(tierEditing.minBetToQualify)}
                    onChange={(e) =>
                      setTierEditing((t) => t && { ...t, minBetToQualify: e.target.value })
                    }
                  />
                </div>
                {tierDropMode === "target" && (
                  <div>
                    <Label className="text-gray-300 text-sm">
                      Winner Amount (fixed)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Full pot"
                      className="bg-[#242B35] border-gray-700 text-white mt-1"
                      value={String(tierEditing.fixedWinAmount ?? "")}
                      onChange={(e) =>
                        setTierEditing(
                          (t) => t && { ...t, fixedWinAmount: e.target.value },
                        )
                      }
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      If set, the winner receives exactly this amount no matter the
                      current pot. Empty = winner takes the full pot.
                    </p>
                  </div>
                )}
                {tierDropMode === "schedule" && (
                  <div>
                    <Label className="text-gray-300 text-sm">
                      Winner Percent (% of pot)
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        placeholder="Full pot"
                        className="bg-[#242B35] border-gray-700 text-white pr-7"
                        value={String(tierEditing.winnerPercent ?? "")}
                        onChange={(e) =>
                          setTierEditing(
                            (t) => t && { ...t, winnerPercent: e.target.value },
                          )
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        %
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Winner gets this share of the live pot at draw time (e.g.
                      pot 50 at 50% pays 25). Empty = winner takes the full pot.
                    </p>
                  </div>
                )}
                {/* Wulf Coin has no rollover, so a playthrough on it would lock
                    the prize with nothing able to release it. */}
                {tierEditing.currency !== "wulfCoin" && (
                  <div>
                    <Label className="text-gray-300 text-sm">
                      Wagering Multiplier
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      className="bg-[#242B35] border-gray-700 text-white mt-1"
                      value={String(tierEditing.wageringMultiplier ?? 1)}
                      onChange={(e) =>
                        setTierEditing(
                          (t) => t && { ...t, wageringMultiplier: e.target.value },
                        )
                      }
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      0 = winner keeps it outright. 1 or more locks the prize until
                      amount x multiplier is wagered.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-gray-300 text-sm">Drop Mode</Label>
                <Select
                  value={tierDropMode}
                  onValueChange={(v) => setTierDropMode(v as DropMode)}
                >
                  <SelectTrigger className="bg-[#242B35] border-gray-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                    <SelectItem value="target">Drop Target (pot-based)</SelectItem>
                    <SelectItem value="schedule">Scheduled Draw (time-based)</SelectItem>
                  </SelectContent>
                </Select>

                {tierDropMode === "schedule" ? (
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="text-gray-400 text-xs">Round Start</Label>
                      <Input
                        type="datetime-local"
                        className="bg-[#242B35] border-gray-700 text-white mt-1"
                        value={String(tierEditing.roundStartAt ?? "")}
                        onChange={(e) =>
                          setTierEditing(
                            (t) => t && { ...t, roundStartAt: e.target.value },
                          )
                        }
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Optional — participation opens. Bets before this time are
                        not charged and not entered. Empty = open from now.
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Entry Closes</Label>
                      <Input
                        type="datetime-local"
                        className="bg-[#242B35] border-gray-700 text-white mt-1"
                        value={String(tierEditing.participationEndAt ?? "")}
                        onChange={(e) =>
                          setTierEditing(
                            (t) =>
                              t && { ...t, participationEndAt: e.target.value },
                          )
                        }
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Optional — participation ends. Bets from this time on are
                        not charged and not entered, freezing the participant list
                        before the draw. Empty = open until the draw.
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Draw Time</Label>
                      <Input
                        type="datetime-local"
                        min={nowLocalInput()}
                        className="bg-[#242B35] border-gray-700 text-white mt-1"
                        value={String(tierEditing.drawAt ?? "")}
                        onChange={(e) =>
                          setTierEditing((t) => t && { ...t, drawAt: e.target.value })
                        }
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Round ends — the pot is force-drawn to a random participant,
                        then resets. The pot-based drop target is off in this mode.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    This tier drops only when the pot crosses the Drop Target.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="tier-enabled"
                  type="checkbox"
                  checked={tierEditing.enabled}
                  onChange={(e) =>
                    setTierEditing((t) => t && { ...t, enabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-purple-600"
                />
                <Label htmlFor="tier-enabled" className="text-gray-300 text-sm">
                  Enabled
                </Label>
              </div>

              <p className="text-xs text-gray-500">
                The pot drops once it reaches the Drop Target. A crypto-random player
                from that round&apos;s bettors wins the full pot, then it resets to Seed.
              </p>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  onClick={() => setTierEditing(null)}
                  className="bg-[#4A5568] hover:bg-[#5A6578] text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={tierSaving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {tierSaving ? "Saving..." : "Update"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#15181E] text-white border-gray-700 max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              {editing ? `Edit Jackpot — ${editing.gameName}` : "Add Game Jackpot"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            {!editing && (
              <div>
                <Label className="text-gray-300 text-sm">Game *</Label>
                <GamePicker
                  value={form.gameId}
                  exclude={configuredGameIds}
                  onChange={(id) => setForm((f) => ({ ...f, gameId: id }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-sm">Seed Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="bg-[#242B35] border-gray-700 text-white mt-1"
                  value={form.seedAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, seedAmount: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">
                  Contribution Rate (% of each bet)
                </Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-[#242B35] border-gray-700 text-white pr-7"
                    value={form.contributionRate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contributionRate: Number(e.target.value) }))
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    %
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Drop Mode</Label>
                <Select
                  value={form.dropMode}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, dropMode: v as DropMode }))
                  }
                >
                  <SelectTrigger className="bg-[#242B35] border-gray-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                    <SelectItem value="target">Drop Target (pot-based)</SelectItem>
                    <SelectItem value="schedule">Scheduled Draw (time-based)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.dropMode === "target" && (
                <div>
                  <Label className="text-gray-300 text-sm">Drop Target</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-[#242B35] border-gray-700 text-white mt-1"
                    value={form.mustHitCap}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mustHitCap: e.target.value }))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Pot drops once it reaches this. A crypto-random player from the
                    pool wins — bet size doesn&apos;t change the odds.
                  </p>
                </div>
              )}
              <div>
                <Label className="text-gray-300 text-sm">Min Bet To Qualify</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="bg-[#242B35] border-gray-700 text-white mt-1"
                  value={form.minBetToQualify}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minBetToQualify: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger className="bg-[#242B35] border-gray-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                    <SelectItem value="wulfCoin">Wulf Coin</SelectItem>
                    <SelectItem value="wulfCash">Wulf Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.dropMode === "target" && (
                <div>
                  <Label className="text-gray-300 text-sm">
                    Winner Amount (fixed)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Full pot"
                    className="bg-[#242B35] border-gray-700 text-white mt-1"
                    value={form.fixedWinAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fixedWinAmount: e.target.value }))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    If set, the winner receives exactly this amount no matter the
                    current pot. Empty = winner takes the full pot.
                  </p>
                </div>
              )}
              {form.dropMode === "schedule" && (
                <div>
                  <Label className="text-gray-300 text-sm">
                    Winner Percent (% of pot)
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="Full pot"
                      className="bg-[#242B35] border-gray-700 text-white pr-7"
                      value={form.winnerPercent}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, winnerPercent: e.target.value }))
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      %
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Winner gets this share of the live pot at draw time (e.g. pot
                    50 at 50% pays 25). Empty = winner takes the full pot.
                  </p>
                </div>
              )}
              {/* Wulf Coin has no rollover, so a playthrough on it would lock the
                  prize with nothing able to release it. */}
              {form.currency !== "wulfCoin" && (
                <div>
                  <Label className="text-gray-300 text-sm">
                    Wagering Multiplier
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    className="bg-[#242B35] border-gray-700 text-white mt-1"
                    value={form.wageringMultiplier}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        wageringMultiplier: Number(e.target.value),
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    0 = winner keeps it outright. 1 or more locks the prize until
                    amount x multiplier is wagered.
                  </p>
                </div>
              )}
            </div>

            {form.dropMode === "schedule" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-gray-300 text-sm">Round Start</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="datetime-local"
                      className="bg-[#242B35] border-gray-700 text-white"
                      value={form.roundStartAt}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, roundStartAt: e.target.value }))
                      }
                    />
                    {form.roundStartAt && (
                      <Button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, roundStartAt: "" }))}
                        className="bg-[#4A5568] hover:bg-[#5A6578] text-white"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Optional — participation opens. Bets before this time are not
                    charged and not entered. Empty = open from now.
                  </p>
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Entry Closes</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="datetime-local"
                      className="bg-[#242B35] border-gray-700 text-white"
                      value={form.participationEndAt}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          participationEndAt: e.target.value,
                        }))
                      }
                    />
                    {form.participationEndAt && (
                      <Button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, participationEndAt: "" }))
                        }
                        className="bg-[#4A5568] hover:bg-[#5A6578] text-white"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Optional — participation ends. Bets from this time on are not
                    charged and not entered, freezing the participant list before
                    the draw. Empty = open until the draw.
                  </p>
                </div>

                <div>
                  <Label className="text-gray-300 text-sm">Scheduled Draw</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="datetime-local"
                      min={nowLocalInput()}
                      className="bg-[#242B35] border-gray-700 text-white"
                      value={form.drawAt}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, drawAt: e.target.value }))
                      }
                    />
                    {form.drawAt && (
                      <Button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, drawAt: "" }))}
                        className="bg-[#4A5568] hover:bg-[#5A6578] text-white"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Round ends — the pot is auto-awarded to a random qualifying
                    player, then resets. The pot-based drop target is off in this
                    mode.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id="jp-enabled"
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="h-4 w-4 accent-purple-600"
              />
              <Label htmlFor="jp-enabled" className="text-gray-300 text-sm">
                Enabled
              </Label>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="bg-[#4A5568] hover:bg-[#5A6578] text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-[#15181E] text-white border-gray-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Jackpot</DialogTitle>
          </DialogHeader>
          <p className="text-gray-300 text-sm">
            Remove the jackpot config for{" "}
            <span className="font-semibold">{deleteTarget?.gameName}</span>? The
            current pot will be lost.
          </p>
          <DialogFooter className="gap-2">
            <Button
              onClick={() => setDeleteTarget(null)}
              className="bg-[#4A5568] hover:bg-[#5A6578] text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
