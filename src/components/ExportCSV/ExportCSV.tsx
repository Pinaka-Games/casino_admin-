"use client";

import { useState } from "react";
import { Loader2, Check, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import DatePicker from "@/components/DatePicker";

/**
 * Thrown by a `fetchAll` that refuses to export a partial dataset. Its message
 * is shown to the user as-is (every other failure reads "Export failed").
 */
export class ExportLimitError extends Error {}

export interface ExportDateRange {
  from?: Date;
  to?: Date;
}

export type ExportPreset = "all" | "7d" | "30d" | "custom";

interface ExportCSVProps<T> {
  data: T[];
  headers: string[];
  fileName: string;
  mapRow: (row: T) => (string | number)[];
  locked?: boolean;
  /**
   * Why the button is disabled, shown on hover. `locked` covers two unrelated
   * cases — a plan that does not include exports, and simply having nothing to
   * export yet — and the tooltip used to assert the former for both, telling an
   * admin to upgrade when all they had to do was open a category. Plan-gated
   * screens pass the upgrade wording; everyone else gets the neutral default.
   */
  lockedTitle?: string;
  /**
   * Extract a row's date so the popover can filter the in-memory `data`
   * client-side. Provide this when the page already holds the full dataset.
   */
  getRowDate?: (row: T) => string | number | Date | null | undefined;
  /**
   * Fetch the COMPLETE dataset for the chosen range from the server.
   * Provide this on server-paginated pages so export is not limited to the
   * current page. Takes precedence over `getRowDate` client filtering.
   */
  fetchAll?: (range: ExportDateRange) => Promise<T[]>;
  /** Preset selected when the popover first opens. Defaults to "all". */
  defaultPreset?: ExportPreset;
}

/* ------------------------------------------------------------------ */
/* date helpers                                                        */
/* ------------------------------------------------------------------ */
const DAY_MS = 86_400_000;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const daysAgo = (n: number) => startOfDay(new Date(Date.now() - n * DAY_MS));

function resolveRange(
  preset: ExportPreset,
  from?: Date,
  to?: Date
): ExportDateRange {
  switch (preset) {
    case "7d": // last 7 days, today inclusive
      return { from: daysAgo(6), to: endOfDay(new Date()) };
    case "30d":
      return { from: daysAgo(29), to: endOfDay(new Date()) };
    case "custom":
      return {
        from: from ? startOfDay(from) : undefined,
        to: to ? endOfDay(to) : undefined,
      };
    case "all":
    default:
      return {};
  }
}

function inRange(
  value: string | number | Date | null | undefined,
  range: ExportDateRange
): boolean {
  if (!range.from && !range.to) return true;
  if (value == null) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  if (range.from && t < range.from.getTime()) return false;
  if (range.to && t > range.to.getTime()) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* xlsx builder — styled sheet: auto-fit widths, wrapped text,          */
/* bold header row, frozen header, column filters                       */
/* ------------------------------------------------------------------ */
function toXlsxName(fileName: string): string {
  return fileName.replace(/\.(csv|xlsx)$/i, "") + ".xlsx";
}

async function downloadXlsx<T>(
  rows: T[],
  headers: string[],
  mapRow: (row: T) => (string | number)[],
  fileName: string
) {
  // Lazy-load exceljs so it stays out of the initial page bundle.
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Export", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.addRow(headers);
  const body = rows.map((r) => mapRow(r));
  body.forEach((r) => ws.addRow(r));

  // Auto-fit each column to its widest value (clamped), wrap long text.
  const MIN_W = 12;
  const MAX_W = 60;
  ws.columns.forEach((col, i) => {
    let widest = headers[i] ? String(headers[i]).length : MIN_W;
    body.forEach((r) => {
      const v = r[i];
      const len = v == null ? 0 : String(v).length;
      if (len > widest) widest = len;
    });
    col.width = Math.min(MAX_W, Math.max(MIN_W, widest + 2));
    col.alignment = { wrapText: true, vertical: "top" };
  });

  // Header row: bold white text on the app's dark header fill.
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF242B35" },
    };
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF3B414D" } } };
  });

  // Excel column filter dropdowns on the header.
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, headers.length) },
  };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = toXlsxName(fileName);
  link.click();
  URL.revokeObjectURL(url);
}

const PRESETS: { key: ExportPreset; label: string }[] = [
  { key: "all", label: "All data" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom range" },
];

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */
export default function ExportCSV<T>({
  data,
  headers,
  fileName,
  mapRow,
  locked = false,
  lockedTitle = "Nothing to export yet",
  getRowDate,
  fetchAll,
  defaultPreset = "all",
}: ExportCSVProps<T>) {
  const canFilter = Boolean(fetchAll || getRowDate);

  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<ExportPreset>(defaultPreset);
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  const runExport = async (range: ExportDateRange) => {
    let rows: T[];
    try {
      setLoading(true);
      if (fetchAll) {
        // Server-paginated page: pull the whole matching dataset.
        rows = await fetchAll(range);
      } else if (getRowDate && (range.from || range.to)) {
        rows = data.filter((r) => inRange(getRowDate(r), range));
      } else {
        rows = data;
      }
    } catch (err) {
      toast.error(
        err instanceof ExportLimitError ? err.message : "Export failed. Please try again.",
      );
      return;
    } finally {
      setLoading(false);
    }

    if (!rows.length) {
      toast.error("No records found for the selected range.");
      return;
    }

    try {
      await downloadXlsx(rows, headers, mapRow, fileName);
    } catch {
      toast.error("Export failed. Please try again.");
      return;
    }
    toast.success(`Exported ${rows.length} record${rows.length > 1 ? "s" : ""}`);
    setOpen(false);
  };

  /* --- simple mode: no filter capability, behave like before --- */
  if (!canFilter) {
    return (
      <Button
        variant="outline"
        size="icon"
        disabled={locked}
        onClick={() => {
          if (locked || !data.length) return;
          void runExport({});
        }}
        className={`h-9 w-9 bg-[#1a2030] text-gray-300 hover:text-white border-gray-700 ${
          locked ? "opacity-40 cursor-not-allowed" : ""
        }`}
        title={locked ? lockedTitle : "Export to Excel"}
      >
        <FileSpreadsheet className="h-[18px] w-[18px]" />
      </Button>
    );
  }

  /* --- filter mode: popover with presets + custom range --- */
  const customInvalid =
    preset === "custom" && from && to && from.getTime() > to.getTime();

  return (
    <Popover open={open} onOpenChange={locked ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={locked}
          className={`h-9 w-9 bg-[#1a2030] text-gray-300 hover:text-white border-gray-700 ${
            locked ? "opacity-40 cursor-not-allowed" : ""
          }`}
          title={locked ? lockedTitle : "Export to Excel"}
        >
          <FileSpreadsheet className="h-[18px] w-[18px]" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-64 p-3 rounded-lg border border-[#2b323b] bg-[#191D24] shadow-xl z-20000"
      >
        <p className="text-xs font-medium text-gray-300 mb-2">Export range</p>

        <div className="space-y-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                preset === p.key
                  ? "bg-purple-600/20 text-white"
                  : "text-gray-400 hover:bg-[#242B35] hover:text-gray-200"
              }`}
            >
              {p.label}
              {preset === p.key && <Check size={14} className="text-purple-400" />}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-[11px] text-gray-500">From</span>
              <DatePicker
                date={from}
                onChange={setFrom}
                maxDate={to}
                className="w-full"
              />
            </div>
            <div>
              <span className="text-[11px] text-gray-500">To</span>
              <DatePicker
                date={to}
                onChange={setTo}
                minDate={from}
                className="w-full"
              />
            </div>
            {customInvalid && (
              <p className="text-[11px] text-red-400">
                From date must be before To date.
              </p>
            )}
          </div>
        )}

        <Button
          onClick={() => void runExport(resolveRange(preset, from, to))}
          disabled={
            loading ||
            Boolean(customInvalid) ||
            (preset === "custom" && !from && !to)
          }
          className="mt-3 w-full h-9 bg-purple-600 hover:bg-purple-700 text-white text-xs"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="mr-1.5 animate-spin" />
              Exporting…
            </>
          ) : (
            "Export Excel"
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
