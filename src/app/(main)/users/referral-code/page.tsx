"use client";
import React, { useMemo, useEffect, useState } from "react";
import { SortableTh, useTableSort } from "@/components/filters/tableSort";
import CopyButton from "@/components/CopyButton";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { Filter } from "lucide-react";
import type { FilterField, FilterValues } from "@/components/filters/types";
import {
  Loader2,
  Wrench,
  Settings,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReferralEditModal from "../components/ReferralEditModal";
import UserCommissionModal from "../components/UserCommissionModal";
import GlobalCommissionModal from "../components/GlobalCommissionModal";
import ReferralRemoveModal from "../components/ReferralRemoveModal";
import UserReferralSettingsModal from "../components/UserReferralSettingsModal";
import { ReferralDetails } from "../components/ReferralDetails";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";
import { useUserManagement } from "@/hooks/use-users";
import { toast } from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import { useReferralStore } from "@/store/referral-store";
import ListSearch from "@/components/TableSearch/ListSearch";
import { profileApi } from "@/api/users/users";

const PAGE_SIZE = 10;

type ReferralUser = {
  id: string;
  username?: string;
  entity?: string;
  referralCode?: string;
  isReferralActive?: boolean;
  createdAt: string;
  referralsCount?: number;
  profile?: {
    email?: string;
    displayName?: string;
  };
};


/**
 * `/users/all` already accepts these — the screen only exposed search, so an
 * operator could not narrow by signup date or account state.
 */
const REFERRAL_FILTER_DEFAULTS: FilterValues = {
  search: "",
  accountStatus: "all",
  verified: "all",
  premium: "all",
  startDate: "",
  endDate: "",
};

const REFERRAL_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "accountStatus",
    label: "Account Status",
    options: [
      { label: "All Accounts", value: "all" },
      { label: "Active", value: "true" },
      { label: "Inactive", value: "false" },
    ],
  },
  {
    type: "select",
    key: "verified",
    label: "Verified",
    options: [
      { label: "All", value: "all" },
      { label: "Verified", value: "true" },
      { label: "Unverified", value: "false" },
    ],
  },
  {
    type: "select",
    key: "premium",
    label: "Premium",
    options: [
      { label: "All", value: "all" },
      { label: "Premium", value: "true" },
      { label: "Standard", value: "false" },
    ],
  },
  { type: "dateRange", fromKey: "startDate", toKey: "endDate", label: "Registered Between" },
];

const toBool = (value: string) => (value === "all" ? undefined : value === "true");
export default function ReferralListing() {
  const {
    activeTab,
    setActiveTab,
    fetchStats,
    claims,
    totalClaims,
    claimsPage,
    setClaimsPage,
    fetchClaims,
    loadingClaims,
    openModal,
    setOpenModal,
    openSettingsModal,
    setOpenSettingsModal,
    openDetailsModal,
    setOpenDetailsModal,
    openRemoveModal,
    setOpenRemoveModal,
    selectedDetailUser,
    setSelectedDetailUser,
    editRow,
    setEditRow,
    removeRow,
    setRemoveRow,
  } = useReferralStore();

  // Core User Data via hook
  const {
    users,
    loading,
    fetchUsers,
    changePage,
    pagination,
    updateUser: updateUserAction,
  } = useUserManagement();

  const currentPage = pagination.page;
  const [searchTerm, setSearchTerm] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(REFERRAL_FILTER_DEFAULTS);

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "search" && value !== (REFERRAL_FILTER_DEFAULTS[key] ?? ""),
  ).length;

  // The list is paged by the API, so column sorting has to happen there too:
  // ordering only the rows on screen just shuffles one page of results.
  const { sort, toggle } = useTableSort<"referred" | "created">();

  // Everything the API understands, in one place so every fetch path agrees.
  const listFilters = {
    isActive: toBool(filters.accountStatus),
    isVerified: toBool(filters.verified),
    isPremium: toBool(filters.premium),
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    sortField: sort.key
      ? sort.key === "referred"
        ? ("referralsCount" as const)
        : ("createdAt" as const)
      : undefined,
    sortOrder: sort.key ? sort.dir : undefined,
  };
  const listParams = () => ({
    limit: PAGE_SIZE,
    isAgent: activeTab === "agents",
    search: searchTerm,
    ...listFilters,
  });
  const [openCommission, setOpenCommission] = useState(false);
  const [commissionUser, setCommissionUser] = useState<{ id: string; username: string } | null>(null);
  const [openGlobalCommission, setOpenGlobalCommission] = useState(false);
  const [openUserReferralSettings, setOpenUserReferralSettings] = useState(false);

  useEffect(() => {
    setActiveTab("users");
  }, [setActiveTab]);

  useEffect(() => {
    if (activeTab === "users" || activeTab === "agents") {
      fetchUsers({
        page: currentPage,
        limit: PAGE_SIZE,
        isAgent: activeTab === "agents",
        search: searchTerm,
        ...listFilters,
      });
    }
    fetchStats();
  }, [currentPage, activeTab, fetchStats, fetchUsers]);

  useEffect(() => {
    if (activeTab === "claims") {
      fetchClaims(claimsPage);
    }
  }, [activeTab, claimsPage, fetchClaims]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      changePage(1, {
        isAgent: activeTab === "agents",
        search: searchTerm,
        limit: PAGE_SIZE,
        ...listFilters,
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [activeTab, changePage, searchTerm, filters, sort]);

  // Transform users data to referral format
  const transformedRows = useMemo(() => {
    if (!users || users.length === 0) return [];

    return (users as ReferralUser[]).map((user) => ({
      id: user.id,
      username: `${user.profile?.email || user.entity || user.profile?.displayName || user.username || "N/A"} `,
      code: user.referralCode || "N/A",
      type: "Code",
      status: user.isReferralActive ? "Active" : "Inactive",
      isReferralActive: !!user.isReferralActive,
      createdAt: new Date(user.createdAt).toLocaleString(),
      email: user.entity || "N/A",
      referredCount: user.referralsCount || 0,
    }));
  }, [users]);

  // Export data
  const exportData = useMemo(
    () =>
      transformedRows.map((row) => ({
        id: row.id,
        username: row.username,
        code: row.code,
        type: row.type,
        status: row.status,
        totalReferred: row.referredCount,
        createdAt: row.createdAt,
      })),
    [transformedRows],
  );

  const handleUpdate = () => {
    setOpenModal(false);
    setEditRow(null);
    fetchUsers({ page: currentPage, ...listParams() });
  };

  const handleConfirmRemove = () => {
    setRemoveRow(null);
    setOpenRemoveModal(false);
    fetchUsers({ page: currentPage, ...listParams() });
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden relative">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-3 rounded-lg flex justify-between items-center">
        <h1 className="text-base font-normal text-white">
          User / Referral Code
        </h1>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex flex-wrap items-center gap-2 shrink-0 sm:gap-3">
        {/* Full width on its own row below `sm`; shares the row from there. */}
        <div className="w-full sm:flex-1 sm:w-auto">
        <ListSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by username / email id"
          showButton={false}
        />
        </div>

        <Button
          variant="outline"
          onClick={() => setSheetOpen(true)}
          className={`h-9 px-3 gap-2 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] ${
            activeFilterCount > 0 ? "border-purple-500/50 text-purple-300" : ""
          }`}
        >
          <Filter size={16} className="text-[#B93DEB]" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-md bg-purple-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
        {activeTab === "users" && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setOpenUserReferralSettings(true)}
              className="h-9 px-3 gap-2 bg-purple-600/10 text-purple-400 border-purple-500/30 hover:bg-purple-600/20"
            >
              <Settings size={18} />
              Settings
            </Button>

            <Button
              variant="outline"
              onClick={() => setOpenGlobalCommission(true)}
              className="h-9 px-3 gap-2 bg-purple-600/10 text-purple-400 border-purple-500/30 hover:bg-purple-600/20"
            >
              <Percent size={18} />
              Commission
            </Button>

            <ExportCSV
              data={exportData}
              fileName="referral_codes.csv"
              getRowDate={(row) => row.createdAt}
              fetchAll={async (range) => {
                // Pull the COMPLETE matching dataset (all pages), applying the
                // same transform used for the in-page rows. Popover range maps
                // to the server-side date filter.
                const startDate = range.from?.toISOString();
                const endDate = range.to?.toISOString();
                const EXPORT_LIMIT = 500;
                const all: ReferralUser[] = [];
                let page = 1;
                for (let i = 0; i < 100; i++) {
                  // Export lives on the "users" tab only, so pull from the
                  // users list with the same search + date filters.
                  const res = await profileApi.getAllUsers({
                    page,
                    limit: EXPORT_LIMIT,
                    search: searchTerm,
                    startDate,
                    endDate,
                    sortField: listFilters.sortField,
                    sortOrder: listFilters.sortOrder,
                  });
                  all.push(...res.data.data);
                  if (all.length >= res.data.meta.total || res.data.data.length === 0)
                    break;
                  page += 1;
                }
                return all.map((user) => ({
                  id: user.id,
                  username: `${user.profile?.email || user.entity || user.profile?.displayName || user.username || "N/A"} `,
                  code: user.referralCode || "N/A",
                  type: "Code",
                  status: user.isReferralActive ? "Active" : "Inactive",
                  totalReferred: user.referralsCount || 0,
                  createdAt: new Date(user.createdAt).toLocaleString(),
                }));
              }}
              headers={[
                "ID",
                "Username",
                "Referral Code",
                "Total Referred",
                "Type",
                "Status",
                "Created At",
              ]}
              mapRow={(row) => [
                row.id,
                row.username,
                row.code,
                row.totalReferred,
                row.type,
                row.status,
                row.createdAt,
              ]}
            />
          </div>
        )}
      </div>

      {/* TABLE CONTENT */}
      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide">
        {activeTab !== "claims" ? (
          <table className="w-full min-w-[880px] table-fixed">
            <thead className="bg-[#242B35] sticky top-0 z-10">
              <tr className="border-b border-gray-800">
                {/* ID was `w-20` — narrower than eight characters plus the
                    copy button, so it clipped. Wide enough now to read a
                    recognisable prefix. */}
                <th className="px-4 py-3 text-left text-white text-xs w-40">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Email / Phone
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Referral Code
                </th>
                <SortableTh
                  label="Total Referred"
                  sortKey="referred"
                  sort={sort}
                  onToggle={toggle}
                  className="px-4 py-3 text-left text-white text-xs"
                />
                <th className="px-4 py-3 text-left text-white text-xs">
                  Status
                </th>
                <SortableTh
                  label="Created At"
                  sortKey="created"
                  sort={sort}
                  onToggle={toggle}
                  className="px-4 py-3 text-left text-white text-xs"
                />
                <th className="px-4 py-3 text-center text-white text-xs">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-purple-400" />
                  </td>
                </tr>
              ) : transformedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16">
                    <NoData title="No referral data found" />
                  </td>
                </tr>
              ) : (
                transformedRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}
                  >
                    {/* The id and the contact are both truncated on screen, so
                        the button is the only way to get the whole value. */}
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-mono">{row.id.substring(0, 13)}…</span>
                        <CopyButton value={row.id} size={12} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{row.username}</span>
                        <CopyButton value={row.username} size={12} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs font-mono">
                      <span className="flex items-center gap-1.5">
                        {row.code}
                        <CopyButton value={row.code} size={12} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#B93DEB] text-xs font-semibold">
                      {row.referredCount || 0}
                    </td>

                    <td className="px-4 py-3 text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.isReferralActive}
                          onCheckedChange={async (checked) => {
                            try {
                              await updateUserAction(row.id, {
                                isReferralActive: checked,
                              });
                              toast.success(
                                `Referral code ${checked ? "activated" : "deactivated"} successfully`,
                              );
                              fetchUsers({
                                page: currentPage,
                                ...listParams(),
                              });
                            } catch (error) {
                              console.error("Failed to update status", error);
                            }
                          }}
                          className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-gray-600"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.createdAt}
                    </td>
                    <td className="px-4 py-3 text-center w-[90px] shrink-0">
                      <div className="flex items-center justify-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-red-400 hover:text-orange-400 transition-colors">
                            <Wrench size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-[#1a2030] text-white p-2 border-none"
                        >
                          <DropdownMenuItem
                            onClick={() => {
                              const fullUser = users.find(
                                (u: ReferralUser) => u.id === row.id,
                              );
                              setSelectedDetailUser(fullUser || row);
                              setOpenDetailsModal(true);
                            }}
                            className="cursor-pointer hover:bg-[#242B35]"
                          >
                            View Details
                          </DropdownMenuItem>
                          {/* <DropdownMenuItem
                            onClick={() => {
                              setCommissionUser({ id: row.id, username: row.username });
                              setOpenCommission(true);
                            }}
                            className="cursor-pointer hover:bg-[#242B35]"
                          >
                            Commission
                          </DropdownMenuItem> */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[880px] table-fixed">
            <thead className="bg-[#242B35] sticky top-0 z-10">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-white text-xs">Date</th>
                <th className="px-4 py-3 text-left text-white text-xs">User</th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-white text-xs">
                  Transaction ID
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingClaims ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-400">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-purple-400" />
                  </td>
                </tr>
              ) : claims.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16">
                    <NoData title="No claims history found" />
                  </td>
                </tr>
              ) : (
                claims.map((claim, index) => (
                  <tr
                    key={claim.id}
                    className={`hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}
                  >
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {new Date(claim.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs font-medium">
                      {claim.referrerUsername}
                    </td>
                    <td className="px-4 py-3 text-[#B93DEB] text-xs font-bold">
                      {Number(claim.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] ${
                          claim.status === "SUCCESS"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono truncate">
                      {claim.transactionId || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINATION */}
      <div className="mt-4">
        {activeTab !== "claims"
          ? transformedRows.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={(page) => {
                  changePage(page, listParams());
                }}
              />
            )
          : claims.length > 0 && (
              <Pagination
                currentPage={claimsPage}
                totalPages={Math.ceil(totalClaims / PAGE_SIZE)}
                onPageChange={setClaimsPage}
              />
            )}
      </div>

      {/* EDIT MODAL */}
      <ReferralEditModal
        open={openModal}
        initialData={editRow}
        onClose={() => {
          setOpenModal(false);
          setEditRow(null);
        }}
        onSubmit={handleUpdate}
      />

      {/* DETAILS MODAL */}
      <ReferralDetails
        open={openDetailsModal}
        onOpenChange={setOpenDetailsModal}
        user={selectedDetailUser}
      />

      {/* REMOVE MODAL */}
      <ReferralRemoveModal
        open={openRemoveModal}
        data={removeRow}
        onClose={() => {
          setOpenRemoveModal(false);
          setRemoveRow(null);
        }}
        onConfirm={handleConfirmRemove}
      />

      {/* USER REFERRAL SETTINGS MODAL */}
      <UserReferralSettingsModal
        open={openUserReferralSettings}
        onClose={() => setOpenUserReferralSettings(false)}
      />

      {/* GLOBAL COMMISSION MODAL */}
      <GlobalCommissionModal
        open={openGlobalCommission}
        onClose={() => setOpenGlobalCommission(false)}
      />

      {/* USER COMMISSION MODAL */}
      <UserCommissionModal
        open={openCommission}
        userId={commissionUser?.id || ""}
        username={commissionUser?.username || ""}
        onClose={() => {
          setOpenCommission(false);
          setCommissionUser(null);
        }}
      />
    <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Referral Filters"
        description="Filter accounts by state and signup date"
        fields={REFERRAL_FILTER_FIELDS}
        values={filters}
        defaults={REFERRAL_FILTER_DEFAULTS}
        onApply={setFilters}
      />

    </div>
  );
}
