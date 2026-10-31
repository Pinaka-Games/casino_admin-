"use client";

import { useState } from "react";
import { Crosshair, Loader2, Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidIpEntry } from "@/lib/ip-allowlist";

/**
 * The maintenance IP allowlist editor.
 *
 * One address at a time: type it, press Add (or Enter), and it becomes a chip.
 * No separator to get wrong, and every entry is validated at the moment it is
 * added rather than being silently dropped by the backend on save — an address
 * an operator believes is exempt but is not is the failure this whole feature
 * exists to avoid.
 *
 * The stored value stays `string[]`, so the box itself holds only the address
 * being typed and never has to be reconciled with the saved config.
 */

/** The public API root — the admin base with its `/admin` suffix removed. */
const PUBLIC_API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1/admin"
).replace(/\/admin\/?$/, "");

export default function IpAllowlistField({
  label,
  values,
  onChange,
  emptyHint = "Empty — nobody bypasses the curtain, including you.",
  filledHint = "These addresses keep full access to the site and the API while Maintenance Mode is on.",
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  /** Footer shown when the list is empty. */
  emptyHint?: string;
  /** Footer shown when the list has entries. */
  filledHint?: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  /**
   * Adds one address. Returns nothing — every rejection is reported in place,
   * because the alternative (dropping it quietly) is the bug this replaced.
   */
  const add = (raw: string) => {
    const entry = raw.trim();
    if (!entry) return;

    if (!isValidIpEntry(entry)) {
      setError(`"${entry}" is not a valid IP address or range.`);
      return;
    }
    // Case-insensitive: IPv6 hex is, so `FE80::1` and `fe80::1` are one address.
    if (values.some((value) => value.toLowerCase() === entry.toLowerCase())) {
      setError(`${entry} is already on the list.`);
      return;
    }

    onChange([...values, entry]);
    setDraft("");
    setError(null);
  };

  const remove = (entry: string) => {
    onChange(values.filter((value) => value !== entry));
    setError(null);
  };

  /**
   * Fills in the address this browser reaches the API from — which is the
   * address the allowlist is compared against, and not necessarily the one a
   * "what is my IP" site reports if the office routes egress differently.
   */
  const addMyAddress = async () => {
    setLookingUp(true);
    setError(null);
    try {
      const response = await fetch(`${PUBLIC_API_BASE}/system-config/public/maintenance-bypass`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = (await response.json()) as { ip?: string };
      const ip = typeof payload?.ip === "string" ? payload.ip.trim() : "";
      if (!ip) throw new Error("No address returned");

      add(ip);
    } catch {
      setError("Could not read your address — type it in by hand.");
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="space-y-2 md:col-span-2 xl:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-md text-white">{label}</Label>
        <button
          // Default button type is "submit"; inside the settings form that
          // would save the page.
          type="button"
          onClick={addMyAddress}
          disabled={lookingUp}
          className="flex items-center gap-1.5 rounded-lg border border-[#2C323D] bg-[#242B35] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-purple-500/50 disabled:opacity-60"
        >
          {lookingUp ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" />
          )}
          Add my address
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          value={draft}
          placeholder="203.0.113.4 or 203.0.113.0/24"
          spellCheck={false}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            // Enter adds the address instead of submitting the settings form —
            // typing an address and pressing Enter must not save the page.
            if (event.key === "Enter") {
              event.preventDefault();
              add(draft);
            }
          }}
          className="min-w-[200px] flex-1 bg-[#242B35] border-[#2C323D] font-mono text-white"
          aria-label={`${label} — address to add`}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-500/20 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:border-[#2C323D] disabled:bg-[#242B35] disabled:text-gray-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Add IP
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map((entry) => (
            <span
              key={entry}
              className="flex items-center gap-1.5 rounded-md border border-[#2C323D] bg-[#1B222C] px-2 py-1 font-mono text-xs text-gray-200"
            >
              {entry}
              <button
                type="button"
                onClick={() => remove(entry)}
                className="text-gray-500 transition-colors hover:text-red-400"
                aria-label={`Remove ${entry}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        {values.length === 0 ? emptyHint : filledHint}
      </p>
    </div>
  );
}
