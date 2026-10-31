"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Searchable IANA timezone picker.
 *
 * Replaces a native <datalist>, which Chrome renders as a tall unstyled system
 * popup listing all ~420 zones from Africa/Abidjan down — it ignored the theme,
 * overflowed the page and did not filter as you typed. This is the same
 * search-input-plus-panel pattern the country/state pickers on this page
 * already use, so it looks and behaves like the rest of the form.
 */

const FALLBACK_ZONES = [
  "UTC",
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Madrid",
  "Asia/Kolkata",
  "Asia/Manila",
  "Australia/Sydney",
];

/**
 * `Intl.supportedValuesOf` populates the list but never validates it — it omits
 * both `UTC` and the `Asia/Kolkata` spelling browsers actually report, so as an
 * allowlist it would reject real values. The backend does the real validation.
 */
const ALL_ZONES: string[] = (() => {
  try {
    const supported =
      typeof Intl !== "undefined" &&
      typeof (Intl as { supportedValuesOf?: unknown }).supportedValuesOf === "function"
        ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
            "timeZone",
          )
        : [];
    return Array.from(new Set([...FALLBACK_ZONES, ...supported])).sort();
  } catch {
    return FALLBACK_ZONES;
  }
})();

/** Current wall clock in a zone — what makes an IANA string mean something. */
function zoneTime(zone: string): string | null {
  if (!zone) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
  } catch {
    return null;
  }
}

/** Offset label like "UTC+05:30", for scanning the list quickly. */
function zoneOffsetLabel(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click — otherwise the panel sticks open while the admin
  // works elsewhere on a page that is one long column of forms.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ZONES;
    // Match on the zone id with underscores treated as spaces, so "new york"
    // finds America/New_York.
    return ALL_ZONES.filter((z) => z.toLowerCase().replace(/_/g, " ").includes(q.replace(/_/g, " ")));
  }, [query]);

  const preview = zoneTime(value);
  const isKnown = value ? zoneTime(value) !== null : false;

  const commit = (zone: string) => {
    onChange(zone);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md border border-[#2C323D] bg-[#242B35] px-3 py-2 text-left text-sm text-white hover:border-[#3A414D]"
      >
        <span className={value ? "text-white" : "text-gray-500"}>
          {value || "Select a timezone"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-[#2C323D] bg-[#11141A] shadow-xl">
          <div className="relative border-b border-[#2C323D] p-2">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
                if (event.key === "Enter" && filtered.length > 0) {
                  event.preventDefault();
                  commit(filtered[0]);
                }
              }}
              placeholder="Search city or region — e.g. Chicago, Kolkata"
              className="h-9 border-[#2C323D] bg-[#11141A] pl-9 text-white placeholder:text-gray-500"
            />
          </div>

          <div className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400">
                No zone matches “{query}”.
              </div>
            ) : (
              filtered.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => commit(zone)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#242B35] ${
                    zone === value ? "bg-[#242B35] text-white" : "text-gray-200"
                  }`}
                >
                  <span className="truncate">{zone.replace(/_/g, " ")}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-gray-500">{zoneOffsetLabel(zone)}</span>
                    {zone === value ? <Check className="h-4 w-4 text-purple-400" /> : null}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* The current clock is the only way an admin can tell at a glance that
          they picked the zone they meant. */}
      <p className="mt-2 text-xs text-gray-400">
        {preview ? (
          <>
            Right now it is <span className="text-gray-200">{preview}</span> there.
          </>
        ) : value && !isKnown ? (
          <span className="text-amber-400">
            “{value}” is not a timezone this browser recognises. Pick one from the list.
          </span>
        ) : (
          "Business calendar for the redeem cap, and the fallback day boundary for players whose timezone has not been detected yet."
        )}
      </p>
    </div>
  );
}
