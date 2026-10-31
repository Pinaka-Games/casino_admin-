"use client";

import React, { useEffect, useMemo, useState } from "react";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import type { FilterField, FilterValues } from "@/components/filters/types";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BronzeTier } from "@/assets/images/banner";
import ExportCSV from "@/components/ExportCSV";


import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import TierModal, { TierFormData } from "../components/tiermanagement-model";
import RewardsClassicTierModal from "../components/managereward-model";
import { create } from "@/assets/images/action";
import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";
import { VIP_FORCE_SEED_WARNING } from "../components/vip-seed-warning";
import toast from "react-hot-toast";
import { vipTierApi } from "@/api/vip-tier/vip-tier-api";
import { VipTier } from "@/types/vip.tier.types";
import { formatDate } from "@/lib/utils";

/* ============================
   TYPES
============================ */
const BENEFIT_ROWS: Array<{ key: keyof VipTier["benefits"]; label: string }> = [
  { key: "hourlyCashback", label: "Hourly Cashback" },
  { key: "dailyCashback", label: "Daily Cashback" },
  { key: "instantRebate", label: "Instant Rebate" },
  { key: "communityChat", label: "Community Chat Access" },
  { key: "vipSpin", label: "VIP Spin Access" },
  { key: "weeklyBonus", label: "Weekly Cashback" },
  { key: "monthlyBonus", label: "Monthly Cashback" },
];

/* ============================
   PAGE
============================ */
const TIER_FILTER_DEFAULTS: FilterValues = {
  tier: "All",
  status: "all",
  from: "",
  to: "",
};

const TIER_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "tier",
    label: "Tier group",
    options: [
      { value: "All", label: "All Tier" },
      ...["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master"].map(
        (group) => ({ value: group, label: `${group} Tier` })
      ),
    ],
  },
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { value: "all", label: "All" },
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Created Between" },
];

export default function VipTierManagementPage() {
  const [rows, setRows] = useState<VipTier[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  // Set after the first successful fetch, so the seed button cannot flash up
  // before we know whether tiers exist.
  const [tiersLoaded, setTiersLoaded] = useState(false);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<VipTier | null>(null);

  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [rewardTierId, setRewardTierId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<VipTier | null>(null);
  const [selTier, setSelTier] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  // Name and description are the only text on a tier row worth matching.
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Whole days, both ends included — a tier created at 14:00 must still match
    // a range that ends on its own date.
    const from = createdFrom ? new Date(`${createdFrom}T00:00:00`).getTime() : null;
    const to = createdTo ? new Date(`${createdTo}T23:59:59.999`).getTime() : null;

    return rows.filter((row) => {
      if (term && !String(row.name ?? "").toLowerCase().includes(term)) return false;
      if (statusFilter !== "all" && (statusFilter === "active") !== Boolean(row.isActive)) {
        return false;
      }
      if (from || to) {
        const created = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
        if (Number.isNaN(created)) return false;
        if (from && created < from) return false;
        if (to && created > to) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, createdFrom, createdTo]);

  /* ============================
     EXPORT CONFIG
  ============================ */
  const exportHeaders = [
    "Name",
    "XP Required",
    ...BENEFIT_ROWS.map((benefit) => benefit.label),
    "Is Active",
    "Created At",
  ];

  const mapTierRow = (row: VipTier) => [
    row.name ?? "-",
    row.xp_required,
    ...BENEFIT_ROWS.map((benefit) =>
      row.benefits?.[benefit.key] ? "Enabled" : "Disabled"
    ),
    row.isActive ? "Active" : "Inactive",
    row.createdAt ? new Date(row.createdAt).toLocaleString() : "-",
  ];

  /* ============================
     HANDLERS
  ============================ */
  const handleCreate = () => {
    setEditData({
      id: undefined,
      name: null,
      // Every tier is a single level-3 row — the level the tier-up bonus,
      // claim card and free-spin grant all key off. A tier created at level 1
      // would pay nothing and be pruned by the next seed run.
      level: 3,
      xp_required: 0,
      badge: "",
      isActive: true,

      benefits: {
        hourlyCashback: false,
        dailyCashback: false,
        reloadDepositeBonus: false,
        communityChat: false,
        vipSpin: false,
        levelUpBonus: false,
        weeklyBonus: false,
        monthlyBonus: false,
        instantRebate: false
      },

      depositSettings: {
        minimumDeposit: 0,
        minimumWager: 0,
      },

      withdrawalSettings: {
        withdrawalCountLimit: 0,
        minimumWithdrawalBank: 0,
        maximumWithdrawalBank: 0,
        minimumWithdrawalEWallet: 0,
        maximumWithdrawalEWallet: 0,
        minimumWithdrawalCrypto: 0,
        maximumWithdrawalCrypto: 0,
        withdrawalPerDay: 0,
        withdrawalPerWeek: 0,
        withdrawalPerMonth: 0,
      },

      createdAt: undefined,
      updatedAt: undefined,
    });

    setModalOpen(true);
  };

  const handleEdit = (row: VipTier) => {
    setEditData(row);

    setModalOpen(true);
  };
  const handleSubmit = async (formData: VipTier) => {
    // No id = the modal was opened via handleCreate. Updating with an
    // undefined id hit PATCH /vip/undefined and the backend's ParseUUIDPipe
    // rejected it ("Validation failed (uuid is expected)") — the tier was
    // never created.
    const isCreate = !formData.id;
    try {
      if (isCreate) {
        // POST /vip/tiers only accepts the create DTO's fields.
        await vipTierApi.create({
          name: formData.name,
          level: formData.level,
          xp_required: formData.xp_required,
          badge: formData.badge,
          isActive: formData.isActive,
          benefits: formData.benefits,
        });
        toast.success("VIP tier created successfully");
      } else {
        await vipTierApi.update(formData.id, formData);
        toast.success("VIP tier updated successfully");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          (isCreate ? "Failed to create VIP tier" : "Failed to update VIP tier")
      );
    } finally {
      setModalOpen(false);
      fetchVipTiers()
    }

  };

  const handleManageReward = (row: VipTier) => {
    setRewardTierId(row.id ?? null);
    setRewardModalOpen(true);
  };

  const handleRemoveClick = (row: VipTier) => {
    setDeleteRow(row);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteRow?.id) return;

    try {
      const { data } = await vipTierApi.remove(deleteRow.id);
      // The backend moves anyone sitting on this tier down to the next one it
      // finds, so surface that count — it is the part an admin cannot see.
      toast.success(data?.message ?? "VIP tier deleted");
      await fetchVipTiers();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to delete VIP tier"
      );
    } finally {
      setDeleteOpen(false);
      setDeleteRow(null);
    }
  };

  useEffect(() => {
    fetchVipTiers()
  }, [selTier])
  const fetchVipTiers = async (): Promise<VipTier[] | undefined> => {
    try {
      setIsFetching(true);
      const { data } = await vipTierApi.getAll(selTier);
      if (data) setRows(data)
      setTiersLoaded(true);
      return data;
    } catch (error: any) {
      toast.error(error?.message || "Something went wrong");
      return undefined;
    } finally {
      setIsFetching(false);
    }
  };

  // Seeding is only for an empty tier table. `rows` is the server list for the
  // selected tier group, so a group filter showing nothing does not mean the
  // table is empty — only offer the seed on the unfiltered list.
  const showSeedButton =
    isSeeding ||
    (tiersLoaded &&
      !isFetching &&
      rows.length === 0 &&
      (!selTier || selTier === "All"));

  const handleSeedDefaults = async (force = true): Promise<void> => {
    try {
      setIsSeeding(true);
      const { data } = await vipTierApi.seedDefaults(force);
      toast.success(
        data?.message ||
          `Seed completed. Created: ${data?.created ?? 0}, Updated: ${
            (data?.seededDefaultsOnExisting ?? 0) + (data?.backfilled ?? 0)
          }`,
      );
      await fetchVipTiers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to seed VIP tiers");
    } finally {
      setIsSeeding(false);
    }
  };

  const inactiveTier = async (
    id: string | undefined,
    status: boolean
  ): Promise<void> => {
    if (!id) return;

    try {
      const { data } = await vipTierApi.updateStatus({ id, status });

      toast.success(data?.message ?? "Status updated");
      await fetchVipTiers();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update status");
    }
  };
  /* ============================
     RENDER
  ============================ */
  return (
    <div className="h-full bg-[#0b0f1a] text-white px-3 py-4 md:px-6 md:py-6">
      <div className="h-full grid grid-rows-[auto_auto_1fr] gap-4">
        {/* HEADER — stacked on a phone; the title and the button could not
            share one row. */}
        <div className="flex flex-col items-stretch bg-[#15181E] p-2 rounded-lg gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <h1 className="text-lg font-semibold">VIP / Tier Management</h1>
          {/* Tier Rewards is reached from here rather than the sidebar — the
              tiers and the rewards attached to them are one flow. */}
          <Link href="/vip-tier/tier-rewards" className="shrink-0">
            <Button
              variant="outline"
              className="h-9 w-full border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white md:w-auto"
            >
              Tier Rewards Management
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* FILTER */}
        <div className="bg-[#191D24] p-2 rounded-lg">
          <FilterToolbar
            className="mb-0"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search tier name"
            activeCount={
              (selTier && selTier !== "All" ? 1 : 0) +
              (statusFilter !== "all" ? 1 : 0) +
              (createdFrom || createdTo ? 1 : 0)
            }
            onOpenFilters={() => setSheetOpen(true)}
            actions={
              <>
                {showSeedButton && (
                  <Button
                    variant="outline"
                    className="shrink-0 cursor-pointer border-gray-700 text-gray-300"
                    onClick={() => setSeedConfirmOpen(true)}
                    disabled={isSeeding || isFetching}
                  >
                    {isSeeding ? "Seeding..." : "Run Seed (Force)"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 cursor-pointer border-gray-700 text-gray-300"
                  onClick={handleCreate}
                >
                  <Image src={create} alt="Create" width={20} height={20} />
                </Button>

                <ExportCSV
                  data={filteredRows}
                  fileName="vip_tiers.csv"
                  headers={exportHeaders}
                  mapRow={mapTierRow}
                />
              </>
            }
          />
        </div>

        <EntityFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Tier Filters"
          description="Narrow which tiers this list shows."
          fields={TIER_FILTER_FIELDS}
          values={{
            tier: selTier ?? "All",
            status: statusFilter,
            from: createdFrom,
            to: createdTo,
          }}
          defaults={TIER_FILTER_DEFAULTS}
          onApply={(values) => {
            setSelTier(values.tier ?? "All");
            setStatusFilter(values.status ?? "all");
            setCreatedFrom(values.from ?? "");
            setCreatedTo(values.to ?? "");
          }}
        />

        {/* TABLE */}
        <div className="bg-[#111726] rounded-lg border border-gray-800 overflow-hidden">
          <div className="h-full scrollbar-hide overflow-x-auto overflow-y-auto">
            <div className="min-w-[1280px]">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[150px]" />
                  <col className="w-[150px]" />
                  <col className="w-[480px]" />
                  <col className="w-[110px]" />
                  <col className="w-[150px]" />
                  <col className="w-[120px]" />
                  <col className="w-[180px]" />
                </colgroup>
                <thead className="bg-[#1a2030] text-gray-300 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    {/* Level is not shown: each tier is a single row now, so the
                        number carried no information beyond "3" on every line. */}
                    <th className="px-4 py-3 text-left">Xp Required</th>
                    <th className="px-4 py-3 text-left">Settings</th>
                    {/* <th className="px-4 py-3 text-left">Locked Icon</th> */}
                    <th className="px-4 py-3 text-left">Action</th>
                    {/* <th className="px-4 py-3 text-left">Background Image</th> */}
                    {/* <th className="px-4 py-3 text-left">Cashback Percentage</th> */}
                    {/* <th className="px-4 py-3 text-left">Tier Group Name</th> */}
                    <th className="px-4 py-3 text-left">Badge</th>
                    <th className="px-4 py-3 text-left">Is Active</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-gray-800 hover:bg-[#151b2d]"
                    >
                      <td className="px-4 py-4 font-medium">{row.name}</td>
                      <td className="px-4 py-4">{row.xp_required}</td>
                      {/* SETTINGS (UNCHANGED) */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-4 w-[430px]">
                          {/* <SettingsCard title="Deposit Settings" currency="USD">
                            <Row label="Minimum Deposit" value={row.depositSettings.minimumDeposit} />
                            <Row label="Minimum Wager" value={row.depositSettings.minimumWager} />
                          </SettingsCard> */}

                          {/* <SettingsCard
                            title="Withdrawal Settings"
                            currency="USD"
                          >
                            <Row label="Withdrawal Count Limit" value={row.withdrawalSettings.withdrawalCountLimit} />
                            <Row label="Minimum Withdrawal Bank" value={row.withdrawalSettings.minimumWithdrawalBank} />
                            <Row label="Minimum Withdrawal EWallet" value={row.withdrawalSettings.minimumWithdrawalEWallet} />
                            <Row label="Maximum Withdrawal EWallet" value={row.withdrawalSettings.minimumWithdrawalEWallet} />
                            <Row label="Minimum Withdrawal Crypto" value={row.withdrawalSettings.minimumWithdrawalCrypto} />
                            <Row label="Maximum Withdrawal Crypto" value={row.withdrawalSettings.maximumWithdrawalCrypto} />
                            <Row label="Withdrawal Per Day" value={row.withdrawalSettings.withdrawalPerDay} />
                            <Row label="Withdrawal Per Week" value={row.withdrawalSettings.withdrawalPerWeek} />
                            <Row label="Withdrawal Per Month" value={row.withdrawalSettings.withdrawalPerMonth} />
                          </SettingsCard> */}

                          <SettingsCard title="VIP Benefits" currency="">
                            {BENEFIT_ROWS.map((benefit) => (
                              <BenefitRow
                                key={benefit.key}
                                label={benefit.label}
                                value={row.benefits[benefit.key]}
                              />
                            ))}
                          </SettingsCard>
                        </div>
                      </td>

                      {/* <td className="px-4 py-4">
                        <Image src={BronzeTier} alt="icon" width={36} height={36} />
                      </td>

                      <td className="px-4 py-4">
                        <Image src={BronzeTier} alt="locked" width={36} height={36} />
                      </td> */}

                      <td className="px-4 py-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-orange-500">
                              <Wrench size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#1a2030] text-white">
                            <DropdownMenuItem onClick={() => handleEdit(row)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={() => handleRemoveClick(row)}
                            >
                              Remove
                            </DropdownMenuItem>
                            {/* <DropdownMenuItem onClick={() => handleManageReward(row)}>
                              Manage Reward
                            </DropdownMenuItem> */}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>

                      <td className="px-4 py-4">
                        <Image
                          src={row.badge}
                          alt="bg"
                          width={90}
                          height={40}
                          className="rounded"
                        />
                      </td>

                      {/* <td className="px-4 py-4">{row.cashback}</td> */}
                      {/* <td className="px-4 py-4 font-medium">{row.tierGroup}</td> */}

                      <td className="px-4 py-4">
                        <Switch
                          checked={row.isActive}
                          onCheckedChange={(checked) =>
                            inactiveTier(row.id, checked)
                          }
                          className="data-[state=checked]:bg-purple-500 
                                     data-[state=unchecked]:bg-gray-600"
                        />
                      </td>

                      <td className="px-4 py-4 text-gray-300">
                        {formatDate(row?.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {!isFetching && rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-300">
                        <div className="flex flex-col items-center gap-3">
                          <p>No VIP tiers found.</p>
                          {showSeedButton && (
                            <p className="text-xs text-gray-500">
                              Use the top "Run Seed (Force)" button to seed default tiers.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <TierModal
        open={modalOpen}
        initialData={editData}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        inactiveTier={inactiveTier}
      />

      <RewardsClassicTierModal
        open={rewardModalOpen}
        onClose={() => setRewardModalOpen(false)}
        onSubmit={(data) => {
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        fileName={
          deleteRow ? `${deleteRow.name} (tier)` : undefined
        }
        // handleConfirmDelete reports the API's own result, including how many
        // players were moved off the tier.
        showResultToast={false}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteRow(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmSeedDialog
        {...VIP_FORCE_SEED_WARNING}
        open={seedConfirmOpen}
        onCancel={() => setSeedConfirmOpen(false)}
        onConfirm={() => {
          setSeedConfirmOpen(false);
          handleSeedDefaults(true);
        }}
      />
    </div>
  );
}

/* ============================
   SMALL COMPONENTS
============================ */
function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between text-sm text-gray-400">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function BenefitRow({
  label,
  value,
}: {
  label: string;
  value: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span
        className={`font-medium ${value ? "text-green-400" : "text-red-400"
          }`}
      >
        {value ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}


function SettingsCard({
  title,
  currency,
  children,
}: {
  title: string;
  currency: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1a2030] rounded-2xl p-4">
      <div className="flex justify-between mb-3">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-gray-300">{currency}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

