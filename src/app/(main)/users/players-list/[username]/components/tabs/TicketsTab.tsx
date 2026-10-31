"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import TableSkeleton from "@/components/TableSkeleton";
import { Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import {
  supportApi,
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_STYLES,
  type TicketCategory,
  type TicketRow,
} from "@/api/support/support.api";
import TicketDetailModal from "@/app/(main)/users/support-tickets/components/TicketDetailModal";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";

/** Categories staff can open for a player who called or emailed in. */
const STAFF_OPENABLE: TicketCategory[] = [
  "ACCOUNT_ACTIVATION",
  "RESPONSIBLE_GAMING",
  "DEVICE",
  "PAYMENT",
  "KYC",
  "OTHER",
];

const TICKET_FILTER_DEFAULTS: FilterValues = {
  search: "",
  status: "all",
  category: "all",
  priority: "all",
  from: "",
  to: "",
};

const TICKET_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Open", value: "OPEN" },
      { label: "In Progress", value: "IN_PROGRESS" },
      { label: "Resolved", value: "RESOLVED" },
      { label: "Rejected", value: "REJECTED" },
      { label: "Closed", value: "CLOSED" },
    ],
  },
  {
    type: "select",
    key: "category",
    label: "Category",
    options: [
      { label: "All Categories", value: "all" },
      ...STAFF_OPENABLE.map((c) => ({
        label: TICKET_CATEGORY_LABELS[c],
        value: c,
      })),
    ],
  },
  {
    type: "select",
    key: "priority",
    label: "Priority",
    options: [
      { label: "All Priorities", value: "all" },
      { label: "Urgent", value: "URGENT" },
      { label: "High", value: "HIGH" },
      { label: "Normal", value: "NORMAL" },
      { label: "Low", value: "LOW" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Opened Between" },
];

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

/**
 * This player's support history.
 *
 * Reads the same queue as the Support Tickets page rather than its own store,
 * so a decision taken on either screen is reflected on the other without a
 * sync step.
 */
export default function TicketsTab({ username }: { username: string }) {
  // The [username] route param is the user's UUID, as in every other tab.
  const userId = username;

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

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
    fields: TICKET_FILTER_FIELDS,
    defaults: TICKET_FILTER_DEFAULTS,
  });

  const filteredRows = useMemo(
    () =>
      applyClientFilters(rows, filters, {
        search: (t) => [t.reference, t.subject, t.status, t.category, t.resolutionNote],
        selects: [
          { key: "status", match: (t, v) => t.status === v },
          { key: "category", match: (t, v) => t.category === v },
          { key: "priority", match: (t, v) => t.priority === v },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (t) => t.createdAt },
      }),
    [rows, filters]
  );

  // "Opened" is the column support reorders — newest first by default, oldest
  // first when working through a backlog.
  const { sort, toggle } = useTableSort<"opened">();
  const visibleRows = useSortedRows(filteredRows, sort, {
    opened: (row) => new Date(row.createdAt).getTime(),
  });

  const [composing, setComposing] = useState(false);
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supportApi.forPlayer(userId, { limit: 50 });
      setRows(res.tickets);
    } catch {
      toast.error("Could not load this player's tickets.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!body.trim()) {
      toast.error("Describe the request first.");
      return;
    }
    setSaving(true);
    try {
      await supportApi.createOnBehalf({
        userId,
        category,
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
      toast.success("Ticket opened.");
      setComposing(false);
      setSubject("");
      setBody("");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not open that ticket.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">
          Every request this player has made.
        </p>
        <button
          onClick={() => setComposing((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-[#B93DEB] px-3 py-2 text-sm font-semibold text-white hover:bg-[#a32fd4]"
        >
          <Plus className="h-4 w-4" /> New ticket
        </button>
      </div>

      {composing && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#191D24] p-4">
          <p className="text-xs text-white/50">
            For a request that arrived by phone or email — it belongs in the
            queue so the reporting and the audit trail see it.
          </p>
          <div className="flex flex-wrap gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="rounded-lg border border-white/10 bg-[#242B35] px-3 py-2 text-sm text-white outline-none"
            >
              {STAFF_OPENABLE.map((c) => (
                <option key={c} value={c}>
                  {TICKET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#242B35] px-3 py-2 text-sm text-white outline-none focus:border-[#B93DEB]"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did the player ask for?"
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-[#242B35] p-2 text-sm text-white outline-none focus:border-[#B93DEB]"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setComposing(false)}
              className="rounded-lg bg-[#3A4150] px-4 py-2 text-sm font-semibold text-white hover:bg-[#454d5e]"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={saving || !body.trim()}
              className="rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a32fd4] disabled:opacity-50"
            >
              {saving ? "Opening…" : "Open ticket"}
            </button>
          </div>
        </div>
      )}

      <FilterToolbar
        title="Tickets"
        countLabel={
          loading
            ? undefined
            : `${visibleRows.length} ${visibleRows.length === 1 ? "ticket" : "tickets"}`
        }
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search reference or subject"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
        actions={
          <ExportCSV
            data={visibleRows}
            fileName="player_tickets.csv"
            headers={["Reference", "Category", "Subject", "Status", "Opened"]}
            getRowDate={(row) => row.createdAt}
            mapRow={(row) => [
              row.reference,
              TICKET_CATEGORY_LABELS[row.category],
              row.subject,
              TICKET_STATUS_STYLES[row.status].label,
              fmt(row.createdAt),
            ]}
          />
        }
        onResetAll={resetFilters}
      />

      <div className="overflow-x-auto rounded-lg bg-[#15181E]">
        <table className="w-full min-w-[720px]">
          <thead className="bg-[#242B35] text-left text-xs uppercase tracking-wide text-white/60">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <SortableTh
                label="Opened"
                sortKey="opened"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3"
              />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <TableSkeleton rows={5} cols={5} />
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6">
                  <NoData
                    title={
                      hasAnyFilter ? "No tickets match these filters" : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              visibleRows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="cursor-pointer border-b border-white/5 text-sm transition hover:bg-[#242B35]"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#C77DFF]">
                    {t.reference}
                  </td>
                  <td className="px-4 py-3 text-white/80">
                    {TICKET_CATEGORY_LABELS[t.category]}
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-white/80">
                    {t.subject}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TICKET_STATUS_STYLES[t.status].cls}`}
                    >
                      {TICKET_STATUS_STYLES[t.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {fmt(t.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openId && (
        <TicketDetailModal
          ticketId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      )}

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Ticket Filters"
        description="Filter this player's support history"
        fields={TICKET_FILTER_FIELDS}
        values={filters}
        defaults={TICKET_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
}
