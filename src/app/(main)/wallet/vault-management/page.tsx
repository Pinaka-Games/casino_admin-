"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters, type ClientFilterConfig } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import Image from "next/image";
import toast from "react-hot-toast";
import { Plus, Settings, Trash2, X } from "lucide-react";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { coingreen, coingold } from "@/assets/icons";
import { vaultApi, VaultManagementResponse, VaultCurrency } from "@/api/vault/vault.api";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SettingsState = {
  penaltyPercentage: string;
  allowEarlyWithdrawal: boolean;
  durationRates: Record<string, string>;
  interestWageringMultiplier: string;
};

function parseDurationToDays(value: string): number {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized) return 0;
  if (normalized === "weekly") return 7;
  if (normalized === "monthly") return 30;
  if (normalized === "yearly") return 365;
  if (normalized === "1year") return 365;
  if (/^\d+$/.test(normalized)) return Number(normalized) * 365;

  const num = Number((normalized.match(/\d+/) || ["0"])[0]);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (normalized.includes("year")) return num * 365;
  if (normalized.includes("week") || normalized.includes("wk") || normalized === "w") return num * 7;
  if (normalized.includes("month")) return num * 30;
  return num;
}

function normalizeDurationKey(value: string): string {
  const days = parseDurationToDays(value);
  if (!days) return "";
  if (days % 365 === 0) return `${days / 365}year`;
  if (days % 30 === 0) return `${days / 30}month`;
  if (days % 7 === 0 && days < 30) return `${days / 7}week`;
  return `${days}days`;
}

function durationKeyToLabel(key: string): string {
  const days = parseDurationToDays(key);
  if (!days) return key;
  if (days === 7) return "Weekly";
  if (days % 365 === 0) {
    const years = days / 365;
    return `${years} ${years === 1 ? "Year" : "Years"}`;
  }
  if (days % 30 === 0 && days < 365) {
    const months = days / 30;
    return `${months} ${months === 1 ? "Month" : "Months"}`;
  }
  return `${days} Days`;
}

function getApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
  return typeof message === "string" && message.trim() ? message : null;
}

function formatAmount(value: number): string {
  return `${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function renderGreenChips(value: number, compact = false, icon: string = coingreen) {
  return (
    <span className={`inline-flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <Image src={icon} alt="chips" width={compact ? 14 : 16} height={compact ? 14 : 16} />
      <span className={compact ? "text-[15px] font-semibold text-white" : "text-[20px] font-bold text-white"}>
        {formatAmount(value)}
      </span>
    </span>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toISOString().slice(0, 10);
}


const VAULT_FILTER_DEFAULTS: FilterValues = {
  search: "",
  status: "all",
  withdrawalType: "all",
  from: "",
  to: "",
  minAmount: "",
  maxAmount: "",
};

const VAULT_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Active", value: "Active" },
      { label: "Completed", value: "Completed" },
      { label: "Withdrawn", value: "Withdrawn" },
    ],
    hint: "Applies to the All Transactions tab; the other tabs are already one status.",
  },
  {
    type: "select",
    key: "withdrawalType",
    label: "Withdrawal",
    options: [
      { label: "All Withdrawals", value: "all" },
      { label: "On Maturity", value: "On Maturity" },
      { label: "Early", value: "Early" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Started Between" },
  { type: "numberRange", minKey: "minAmount", maxKey: "maxAmount", label: "Amount" },
];

/**
 * One filter set drives all three tabs — they are views of the same deposits,
 * and only the All Transactions rows carry a transactionId, so the row type is
 * generic over what each tab actually has.
 */
const vaultFilterConfig = <
  T extends {
    id: string;
    user: string;
    email?: string | null;
    status?: string;
    withdrawalType?: string;
    startDate?: string;
    amount?: number;
    transactionId?: string;
  },
>(): ClientFilterConfig<T> => ({
  search: (row) => [row.id, row.user, row.email ?? undefined, row.transactionId],
  selects: [
    { key: "status", match: (row, v) => row.status === v },
    { key: "withdrawalType", match: (row, v) => row.withdrawalType === v },
  ],
  dateRange: { fromKey: "from", toKey: "to", get: (row) => row.startDate },
  numberRanges: [
    { minKey: "minAmount", maxKey: "maxAmount", get: (row) => Number(row.amount || 0) },
  ],
});
export default function VaultManagementPage() {
  const PAGE_SIZE = 10;
  const [data, setData] = useState<VaultManagementResponse | null>(null);
  const [currency, setCurrency] = useState<VaultCurrency>("wulfCash");

  const {
    values: filters,
    setValues: setFilters,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset: resetFilters,
  } = useEntityFilters({
    fields: VAULT_FILTER_FIELDS,
    defaults: VAULT_FILTER_DEFAULTS,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [allPage, setAllPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [settings, setSettings] = useState<SettingsState>({
    penaltyPercentage: "0.00",
    allowEarlyWithdrawal: true,
    durationRates: {},
    interestWageringMultiplier: "1",
  });
  const [newDurationCount, setNewDurationCount] = useState("");
  const [newDurationUnit, setNewDurationUnit] = useState("month");
  const [newDurationRate, setNewDurationRate] = useState("");

  // True while the settings modal is open. Background refreshes must not write
  // into the form then, or they overwrite what the admin is typing.
  const settingsOpenRef = useRef(false);
  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  /**
   * `background`: a refresh triggered by the `vault:admin-updated` socket event,
   * which fires on EVERY player transfer in/out and every settings save. It
   * refreshes the tables and cards only — no loading state (which also disabled
   * Save) and no touching the settings form while it is open. The form is
   * filled on first load, on currency change, after Save, and when the modal
   * opens.
   */
  const loadData = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    if (!background) setLoading(true);
    try {
      const response = await vaultApi.getManagementData(currency);
      setData(response.data);
      if (background && settingsOpenRef.current) return;
      const incomingDurationRates = response.data.settings.durationRates || {};
      const normalizedDurationRates = Object.entries(incomingDurationRates).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          // Show the stored value as-is. The API keeps 4 decimals, so
          // toFixed(2) displayed 0.004 as "0.00" while players saw 0.004%.
          acc[key] = String(Number(value ?? 0));
          return acc;
        },
        {},
      );

      setSettings({
        penaltyPercentage: String(Number(response.data.settings.penaltyPercentage ?? 0)),
        allowEarlyWithdrawal: Boolean(response.data.settings.allowEarlyWithdrawal),
        durationRates: normalizedDurationRates,
        interestWageringMultiplier: Number(
          response.data.settings.interestWageringMultiplier ?? 1
        ).toString(),
      });
    } catch (error) {
      if (!background) {
        toast.error(getApiErrorMessage(error) || "Failed to load vault management data");
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    // `vault:admin-updated` is the only thing that re-calls the management API
    // after load — there is no timer. The backend emits it on every player
    // transfer in/out, on every matured deposit the per-minute maturity cron
    // settles (plus a second one when that deposit auto-renews), and on every
    // settings save. Bursts are coalesced into one request, a hidden tab waits
    // until it is visible again, and the trigger is logged so a steady stream
    // of reloads can be traced to its cause.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingWhileHidden = false;

    const reload = () => {
      timer = null;
      if (document.visibilityState === "hidden") {
        pendingWhileHidden = true;
        return;
      }
      void loadData({ background: true });
    };

    const onVaultUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { action?: string; userId?: string; transactionId?: string | null }
        | undefined;
      console.debug(
        `[vault-management] refresh triggered by socket: action=${detail?.action ?? "unknown"}` +
          ` user=${detail?.userId ?? "-"} tx=${detail?.transactionId ?? "-"}`,
      );
      if (timer) clearTimeout(timer);
      timer = setTimeout(reload, 1500);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && pendingWhileHidden) {
        pendingWhileHidden = false;
        void loadData({ background: true });
      }
    };

    window.addEventListener("vault:admin-updated", onVaultUpdated);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("vault:admin-updated", onVaultUpdated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadData]);
  const onSaveSettings = async () => {
    setSaving(true);
    try {
      await vaultApi.updateSettings({
        currency,
        penaltyPercentage: Number(settings.penaltyPercentage),
        allowEarlyWithdrawal: settings.allowEarlyWithdrawal,
        interestWageringMultiplier: Number(settings.interestWageringMultiplier || 0),
        durationRates: Object.entries(settings.durationRates).reduce<Record<string, number>>(
          (acc, [key, value]) => {
            acc[key] = Number(value || 0);
            return acc;
          },
          {}
        ),
      });
      toast.success("Vault settings updated");
      await loadData();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to update vault settings");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const chipIcon = currency === "wulfCoin" ? coingold : coingreen;

  const kpi = useMemo(() => {
    const cards = data?.cards;
    return [
      {
        label: "Total Fixed Amount (Active)",
        value: renderGreenChips(cards?.totalFixedAmountActive || 0, false, chipIcon),
      },
      {
        label: "Total Withdrawn FD Amount",
        value: renderGreenChips(cards?.totalWithdrawnFDAmount || 0, false, chipIcon),
      },
      {
        label: "Total Interest Paid",
        value: renderGreenChips(cards?.totalInterestPaid || 0, false, chipIcon),
      },
      {
        label: "Total Active Deposits",
        value: String(cards?.totalActiveDeposits || 0),
      },
      {
        label: "Total Completed Deposits",
        value: String(cards?.totalCompletedDeposits || 0),
      },
      {
        label: "Total Early Withdrawals",
        value: String(cards?.totalEarlyWithdrawals || 0),
      },
    ];
  }, [data, chipIcon]);

  const activeDeposits = applyClientFilters(
    data?.tabs.activeDeposits ?? [],
    filters,
    vaultFilterConfig(),
  );
  const completedDeposits = applyClientFilters(
    data?.tabs.completedDeposits ?? [],
    filters,
    vaultFilterConfig(),
  );
  const allTransactions = applyClientFilters(
    data?.tabs.allTransactions ?? [],
    filters,
    vaultFilterConfig(),
  );
  const allTotalPages = Math.max(1, Math.ceil(allTransactions.length / PAGE_SIZE));
  const activeTotalPages = Math.max(1, Math.ceil(activeDeposits.length / PAGE_SIZE));
  const completedTotalPages = Math.max(1, Math.ceil(completedDeposits.length / PAGE_SIZE));
  const allPagedRows = allTransactions.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE);
  const activePagedRows = activeDeposits.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const completedPagedRows = completedDeposits.slice(
    (completedPage - 1) * PAGE_SIZE,
    completedPage * PAGE_SIZE
  );
  const durationRateEntries = useMemo(
    () =>
      Object.entries(settings.durationRates).sort(
        ([a], [b]) => parseDurationToDays(a) - parseDurationToDays(b)
      ),
    [settings.durationRates]
  );
  const defaultDurationRateForNew = settings.durationRates["1year"] || durationRateEntries[0]?.[1] || "5.00";

  const onAddDurationPeriod = () => {
    const count = parseInt(newDurationCount, 10);
    if (!Number.isFinite(count) || count <= 0) {
      toast.error("Enter a valid number for the period");
      return;
    }
    const suffix =
      newDurationUnit === "day"
        ? "days"
        : newDurationUnit === "week"
          ? "week"
          : newDurationUnit === "year"
            ? "year"
            : "month";
    const key = normalizeDurationKey(`${count}${suffix}`);
    if (!key) {
      toast.error("Invalid period");
      return;
    }

    if (settings.durationRates[key] !== undefined) {
      toast.error("Duration already exists");
      return;
    }

    setSettings((prev) => ({
      ...prev,
      durationRates: {
        ...prev.durationRates,
        [key]: Number(newDurationRate || 0).toFixed(2),
      },
    }));
    setNewDurationCount("");
    setNewDurationUnit("month");
    setNewDurationRate("");
  };

  const onRemoveDurationPeriod = (key: string) => {
    if (Object.keys(settings.durationRates).length <= 1) {
      toast.error("At least one duration is required");
      return;
    }

    setSettings((prev) => {
      const next = { ...prev.durationRates };
      delete next[key];
      return { ...prev, durationRates: next };
    });
  };

  useEffect(() => {
    setAllPage((prev) => Math.min(prev, allTotalPages));
  }, [allTotalPages]);

  useEffect(() => {
    setActivePage((prev) => Math.min(prev, activeTotalPages));
  }, [activeTotalPages]);

  useEffect(() => {
    setCompletedPage((prev) => Math.min(prev, completedTotalPages));
  }, [completedTotalPages]);

  return (
    <div className="min-h-screen bg-[#0F1419] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1380px] space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Vault Management</h1>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            {/* Currency toggle */}
            <div className="flex rounded-md bg-[#191D24] p-1">
              {([
                { key: "wulfCash" as VaultCurrency, label: "Wulf Cash", icon: coingreen },
                { key: "wulfCoin" as VaultCurrency, label: "Wulf Coin", icon: coingold },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setCurrency(opt.key);
                    setAllPage(1);
                    setActivePage(1);
                    setCompletedPage(1);
                  }}
                  disabled={loading}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                    currency === opt.key
                      ? "bg-[#7C3AED] text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Image src={opt.icon} width={16} height={16} alt={opt.label} />
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Start from the latest saved values, not whatever the form
                // held when it was last closed.
                void loadData();
                setSettingsOpen(true);
              }}
              disabled={loading}
              className="h-10 w-full border-gray-600 text-gray-200 hover:bg-[#242B35] sm:w-[170px]"
            >
              <Settings className="mr-2 h-4 w-4" />
              Vault Settings
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpi.map((item) => (
            <Card
              key={item.label}
              className="flex min-h-[112px] flex-col items-center justify-center border border-gray-800 bg-[#191D24] px-4 py-3 text-center"
            >
              <p className="text-sm text-gray-400">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent
            showCloseButton={false}
            className="w-[96vw] max-w-[1200px] border border-gray-700 bg-[#191D24] p-0 text-white"
          >
            <DialogTitle className="sr-only">Vault Settings</DialogTitle>
            {/* Sits fully outside the panel, clear of its top-right corner.
                It was `-right-1` with no `top`, so it straddled the border and
                its hover fill bled over the panel's rounded edge. */}
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -right-12 top-0 z-20 h-9 w-9 cursor-pointer rounded-lg border border-gray-700 bg-[#191D24] text-gray-300 shadow-lg transition-colors hover:bg-[#232B38] hover:text-white max-md:-right-1 max-md:-top-12"
                aria-label="Close vault settings"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>

            <div className="max-h-[85vh] overflow-y-auto scrollbar-hide">
              <div className="space-y-6 px-6 py-5">
                <div className="rounded-lg border border-gray-700 bg-[#151B23] p-4">
                  <p className="mb-4 text-sm text-gray-300">Duration-Wise Interest Rates (%)</p>
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-xs text-gray-400">Count</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 2"
                        value={newDurationCount}
                        onChange={(e) => setNewDurationCount(e.target.value)}
                        className="h-11 w-full border-gray-700 bg-[#0F1419] text-base text-white"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs text-gray-400">Unit</Label>
                      <Select value={newDurationUnit} onValueChange={setNewDurationUnit}>
                        <SelectTrigger className="!h-11 w-full border-gray-700 bg-[#0F1419] text-base text-white">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent className="border-gray-700 bg-[#0F1419] text-white">
                          <SelectItem value="day">Day(s)</SelectItem>
                          <SelectItem value="week">Week(s)</SelectItem>
                          <SelectItem value="month">Month(s)</SelectItem>
                          <SelectItem value="year">Year(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs text-gray-400">Interest %</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={`${defaultDurationRateForNew}%`}
                        value={newDurationRate}
                        onChange={(e) => setNewDurationRate(e.target.value)}
                        className="h-11 w-full border-gray-700 bg-[#0F1419] text-base text-white"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={onAddDurationPeriod}
                    className="mb-4 h-11 w-full bg-purple-600 text-white hover:bg-purple-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Period
                  </Button>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {durationRateEntries.map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={key} className="text-sm text-gray-300">
                            {durationKeyToLabel(key)} %
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveDurationPeriod(key)}
                            className="h-8 w-8 text-gray-400 hover:bg-[#232B38] hover:text-red-300"
                            aria-label={`Remove ${durationKeyToLabel(key)}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          id={key}
                          value={value}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              durationRates: {
                                ...prev.durationRates,
                                [key]: e.target.value,
                              },
                            }))
                          }
                          className="h-11 border-gray-700 bg-[#0F1419] text-base text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-700 bg-[#151B23] p-4">
                  <Label htmlFor="penaltyPercentage" className="text-sm text-gray-300">
                    Penalty Percentage (%)
                  </Label>
                  <Input
                    id="penaltyPercentage"
                    value={settings.penaltyPercentage}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, penaltyPercentage: e.target.value }))
                    }
                    className="mt-2 h-11 border-gray-700 bg-[#0F1419] text-base text-white"
                  />
                </div>

                <div className="rounded-lg border border-gray-700 bg-[#151B23] p-4">
                  <Label htmlFor="interestWageringMultiplier" className="text-sm text-gray-300">
                    Interest Wagering Multiplier (×)
                  </Label>
                  <Input
                    id="interestWageringMultiplier"
                    type="number"
                    min={0}
                    step="0.1"
                    value={settings.interestWageringMultiplier}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, interestWageringMultiplier: e.target.value }))
                    }
                    className="mt-2 h-11 border-gray-700 bg-[#0F1419] text-base text-white"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    On transfer-out, earned interest must be wagered interest × this value before it
                    becomes withdrawable. Principal returns instantly. 0 = no wagering on interest.
                  </p>
                </div>

                <div className="">
                  <div className="mt-3 flex items-center justify-between">
                    <Label
                      htmlFor="allowEarlyWithdrawal"
                      className="text-base font-semibold text-white"
                    >
                      Allow Early Withdraw
                    </Label>
                    <Switch
                      id="allowEarlyWithdrawal"
                      checked={settings.allowEarlyWithdrawal}
                      className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-700"
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({ ...prev, allowEarlyWithdrawal: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-gray-700 bg-[#191D24] px-6 py-4">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={async () => {
                      const ok = await onSaveSettings();
                      if (ok) setSettingsOpen(false);
                    }}
                    disabled={saving || loading}
                    className="h-11 bg-purple-600 px-6 text-white hover:bg-purple-700"
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <FilterToolbar
          title="Vault Deposits"
          countLabel={`${allTransactions.length} ${allTransactions.length === 1 ? "transaction" : "transactions"}`}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search user or transaction id"
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          onResetAll={resetFilters}
          actions={
            <ExportCSV
              data={allTransactions}
              fileName="vault_deposits.csv"
              getRowDate={(row) => row.startDate}
              headers={[
                "Transaction ID",
                "User",
                "Amount",
                "Earned Interest",
                "Penalty Applied",
                "Total Paid",
                "Withdrawal Type",
                "Start Date",
                "End Date",
                "Status",
              ]}
              mapRow={(row) => [
                row.transactionId || row.id,
                row.user,
                row.amount,
                row.earnedInterest,
                row.penaltyApplied,
                row.totalPaid,
                row.withdrawalType || "-",
                formatDate(row.startDate),
                formatDate(row.endDate),
                row.status,
              ]}
            />
          }
        />

        <Tabs defaultValue="all" className="space-y-4">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="h-auto border border-gray-700 bg-[#151B23] p-1">
              <TabsTrigger
                value="all"
                className="text-gray-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                All Transactions
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="text-gray-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                Active Fixed Deposits
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="text-gray-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                Completed / Withdrawn Deposits
              </TabsTrigger>
            </TabsList>
          </div>

            <TabsContent value="all" className="mt-0">
              <div className="overflow-x-auto rounded-lg border border-gray-800 bg-[#151B23]">
                <Table>
                  <TableHeader className="bg-[#121720]">
                    <TableRow>
                      <TableHead className="text-gray-400">Transaction ID</TableHead>
                      <TableHead className="text-gray-400">User</TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">Earned Interest</TableHead>
                      <TableHead className="text-gray-400">Penalty Applied</TableHead>
                      <TableHead className="text-gray-400">Total Paid</TableHead>
                      <TableHead className="text-gray-400">Withdrawal Type</TableHead>
                      <TableHead className="text-gray-400">Start Date</TableHead>
                      <TableHead className="text-gray-400">End Date</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-gray-400">
                          No vault transactions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allPagedRows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-[#1A2230]">
                          <TableCell className="font-mono text-gray-300">
                            {row.transactionId || row.id}
                          </TableCell>
                          <TableCell><PlayerCell userId={row.userId} email={row.email} user={row.user} /></TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.amount, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.earnedInterest, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.penaltyApplied, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.totalPaid, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{row.withdrawalType}</TableCell>
                          <TableCell className="text-gray-300">{formatDate(row.startDate)}</TableCell>
                          <TableCell className="text-gray-300">{formatDate(row.endDate)}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                row.status === "Active"
                                  ? "bg-blue-500/15 text-blue-300"
                                  : row.withdrawalType === "Early"
                                    ? "bg-amber-500/15 text-amber-300"
                                    : "bg-green-500/15 text-green-300"
                              }`}
                            >
                              {row.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4">
                <Pagination currentPage={allPage} totalPages={allTotalPages} onPageChange={setAllPage} />
              </div>
            </TabsContent>

            <TabsContent value="active" className="mt-0">
              <div className="overflow-x-auto rounded-lg border border-gray-800 bg-[#151B23]">
                <Table>
                  <TableHeader className="bg-[#121720]">
                    <TableRow>
                      <TableHead className="text-gray-400">User</TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">Plan (Duration)</TableHead>
                      <TableHead className="text-gray-400">Interest %</TableHead>
                      <TableHead className="text-gray-400">Earned Interest (Live)</TableHead>
                      <TableHead className="text-gray-400">Start Date</TableHead>
                      <TableHead className="text-gray-400">Maturity Date</TableHead>
                      <TableHead className="text-gray-400">Remaining Days</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeDeposits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-gray-400">
                          No active fixed deposits found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activePagedRows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-[#1A2230]">
                          <TableCell><PlayerCell userId={row.userId} email={row.email} user={row.user} /></TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.amount, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{row.duration}</TableCell>
                          <TableCell className="text-gray-300">{Number(row.interestRate).toFixed(2)}%</TableCell>
                          <TableCell className="text-gray-300">
                            {renderGreenChips(row.earnedInterestLive, true, chipIcon)}
                          </TableCell>
                          <TableCell className="text-gray-300">{formatDate(row.startDate)}</TableCell>
                          <TableCell className="text-gray-300">{formatDate(row.maturityDate)}</TableCell>
                          <TableCell className="text-gray-300">{row.remainingDays}</TableCell>
                          <TableCell>
                            <span className="inline-flex rounded-full bg-blue-500/15 px-2 py-1 text-xs font-semibold text-blue-300">
                              {row.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4">
                <Pagination currentPage={activePage} totalPages={activeTotalPages} onPageChange={setActivePage} />
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-0">
              <div className="overflow-x-auto rounded-lg border border-gray-800 bg-[#151B23]">
                <Table>
                  <TableHeader className="bg-[#121720]">
                    <TableRow>
                      <TableHead className="text-gray-400">User</TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">Earned Interest</TableHead>
                      <TableHead className="text-gray-400">Penalty Applied</TableHead>
                      <TableHead className="text-gray-400">Total Paid</TableHead>
                      <TableHead className="text-gray-400">Withdrawal Type</TableHead>
                      <TableHead className="text-gray-400">Start Date</TableHead>
                      <TableHead className="text-gray-400">End Date</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedDeposits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-gray-400">
                          No completed/withdrawn deposits found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      completedPagedRows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-[#1A2230]">
                          <TableCell><PlayerCell userId={row.userId} email={row.email} user={row.user} /></TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.amount, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.earnedInterest, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.penaltyApplied, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{renderGreenChips(row.totalPaid, true, chipIcon)}</TableCell>
                          <TableCell className="text-gray-300">{row.withdrawalType}</TableCell>
                          <TableCell className="text-gray-300">{formatDate(row.startDate)}</TableCell>
                          <TableCell className="text-gray-300">{formatDate(row.endDate)}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                row.withdrawalType === "Early"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-green-500/15 text-green-300"
                              }`}
                            >
                              {row.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4">
                <Pagination
                  currentPage={completedPage}
                  totalPages={completedTotalPages}
                  onPageChange={setCompletedPage}
                />
              </div>
            </TabsContent>
        </Tabs>
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Vault Filters"
        description="Filter vault deposits across all three tabs"
        fields={VAULT_FILTER_FIELDS}
        values={filters}
        defaults={VAULT_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
}

/**
 * The player on a vault row: email first — the identifier support actually
 * searches by — with a copy button, and a link to the player's page. The
 * display name sits underneath because a few accounts have no email, and the
 * label the API sends already falls back to it.
 */
function PlayerCell({
  userId,
  email,
  user,
}: {
  userId: string;
  email: string | null;
  user: string;
}) {
  const primary = email || user;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {userId ? (
          <Link
            href={`/users/players-list/${userId}`}
            className="truncate font-semibold text-white hover:text-[#C97DEA]"
            title={primary}
          >
            {primary}
          </Link>
        ) : (
          <span className="truncate font-semibold text-white" title={primary}>
            {primary}
          </span>
        )}
        <CopyButton value={primary} size={12} />
      </div>
      {email && user && user !== email && (
        <div className="truncate text-xs text-white/45" title={user}>
          {user}
        </div>
      )}
    </div>
  );
}
