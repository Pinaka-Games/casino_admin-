"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, Search, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  searchRecipients,
  recipientKey,
  canReach,
  destinationFor,
  AUDIENCE_ORDER,
  type MessageAudience,
  type MessageChannel,
  type RecipientOption,
} from "@/api/messaging/messaging.api";
import { getApiErrorMessage } from "@/api/messaging/error-message";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pools the compose screen is targeting. */
  audiences: MessageAudience[];
  channel: MessageChannel;
  selected: RecipientOption[];
  onConfirm: (selected: RecipientOption[]) => void;
}

const AUDIENCE_BADGE: Record<MessageAudience, string> = {
  AGENT: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  SUBAGENT: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  EMPLOYEE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  PLAYER: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

const AUDIENCE_LABEL: Record<MessageAudience, string> = {
  PLAYER: "Players",
  AGENT: "Agents",
  SUBAGENT: "Sub-Agents",
  EMPLOYEE: "Employees",
};

const AUDIENCE_SHORT: Record<MessageAudience, string> = {
  PLAYER: "Player",
  AGENT: "Agent",
  SUBAGENT: "Sub",
  EMPLOYEE: "Staff",
};

/**
 * Full-screen recipient picker.
 *
 * The inline list it replaces had room for three rows inside the compose
 * column, which made picking anyone past the first search result an exercise in
 * scrolling a 160px box. Here the browse list and the running selection sit
 * side by side, so what you have already chosen stays visible while you keep
 * searching.
 *
 * Selection is staged locally and only handed back on Done — closing or
 * cancelling leaves the compose screen untouched.
 */
export default function RecipientPickerModal({
  open,
  onOpenChange,
  audiences,
  channel,
  selected,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState<RecipientOption[]>(selected);
  const [options, setOptions] = useState<RecipientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  // Narrows the browse list to one pool without changing what the send targets.
  const [poolFilter, setPoolFilter] = useState<MessageAudience | "ALL">("ALL");

  // MESSAGE reaches everyone in the audience; the contact channels need a
  // detail on file, so rows without one are shown but not selectable.
  const isContactChannel = channel !== "MESSAGE";
  const missingLabel =
    channel === "SMS" ? "no phone on file" : "no email on file";
  const audienceKey = audiences.join(",");

  // Reopening starts from whatever the compose screen currently holds, so a
  // cancelled session cannot leak into the next one.
  useEffect(() => {
    if (open) {
      setDraft(selected);
      setSearch("");
      setPoolFilter("ALL");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const pools =
          poolFilter === "ALL" ? audiences : ([poolFilter] as MessageAudience[]);
        const res = await searchRecipients({
          audiences: pools,
          channel,
          search,
          limit: 200,
        });
        if (cancelled) return;
        setOptions(res.data);
        setTotal(res.total);
      } catch (err) {
        if (!cancelled) {
          setOptions([]);
          toast.error(getApiErrorMessage(err, "Failed to load recipients"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const t = setTimeout(load, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, audienceKey, channel, poolFilter, search]);

  const draftKeys = useMemo(
    () => new Set(draft.map(recipientKey)),
    [draft],
  );

  /** Rows this channel can actually deliver to. */
  const selectable = useMemo(
    () =>
      isContactChannel ? options.filter((r) => canReach(r, channel)) : options,
    [isContactChannel, channel, options],
  );

  const toggle = (row: RecipientOption) => {
    setDraft((prev) =>
      prev.some((r) => recipientKey(r) === recipientKey(row))
        ? prev.filter((r) => recipientKey(r) !== recipientKey(row))
        : [...prev, row],
    );
  };

  const addMany = (rows: RecipientOption[]) => {
    if (rows.length === 0) return;
    setDraft((prev) => {
      const merged = new Map(prev.map((r) => [recipientKey(r), r]));
      rows.forEach((r) => merged.set(recipientKey(r), r));
      return Array.from(merged.values());
    });
  };

  const allShownSelected =
    selectable.length > 0 &&
    selectable.every((r) => draftKeys.has(recipientKey(r)));

  const toggleAllShown = () => {
    if (allShownSelected) {
      const shown = new Set(selectable.map(recipientKey));
      setDraft((prev) => prev.filter((r) => !shown.has(recipientKey(r))));
    } else {
      addMany(selectable);
    }
  };

  /** Draft grouped by pool in canonical order — the right-hand panel. */
  const draftSorted = useMemo(
    () =>
      [...draft].sort(
        (a, b) =>
          AUDIENCE_ORDER.indexOf(a.audience) -
            AUDIENCE_ORDER.indexOf(b.audience) ||
          a.username.localeCompare(b.username),
      ),
    [draft],
  );

  const draftByAudience = useMemo(() => {
    const map = new Map<MessageAudience, number>();
    draft.forEach((r) => map.set(r.audience, (map.get(r.audience) ?? 0) + 1));
    return map;
  }, [draft]);

  const unreachable = isContactChannel
    ? draft.filter((r) => !canReach(r, channel)).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#15181E] border-[#242B35] text-white sm:max-w-[min(1100px,calc(100vw-3rem))] w-full h-[min(86vh,760px)] p-0 gap-0 grid-rows-[auto_1fr_auto]"
      >
        <DialogHeader className="px-5 py-4 border-b border-[#242B35] space-y-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-white text-base font-normal">
              Choose recipients
            </DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {/* Browse on the left, running selection on the right. */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] overflow-hidden">
          {/* ── Browse ── */}
          <div className="flex flex-col overflow-hidden border-r border-[#242B35]">
            <div className="p-4 pb-2 space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  placeholder="Search by name or email"
                  className="w-full h-10 bg-[#242B35] border border-[#3b414d] rounded pl-9 pr-3 text-white text-sm outline-none"
                />
              </div>

              {/* Pool filter — only offered when the send spans more than one. */}
              {audiences.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {(["ALL", ...audiences] as const).map((pool) => {
                    const active = poolFilter === pool;
                    return (
                      <button
                        key={pool}
                        onClick={() => setPoolFilter(pool as MessageAudience | "ALL")}
                        className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                          active
                            ? "bg-[#B93DEB] text-white"
                            : "bg-[#242B35] text-gray-300 hover:text-white"
                        }`}
                      >
                        {pool === "ALL"
                          ? "All groups"
                          : AUDIENCE_LABEL[pool as MessageAudience]}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-gray-300 text-[13px] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={toggleAllShown}
                    className="accent-[#B93DEB] w-4 h-4"
                  />
                  Select all shown ({selectable.length})
                </label>
                {audiences.length > 1 && poolFilter === "ALL" && (
                  <div className="flex items-center gap-1">
                    {audiences.map((a) => (
                      <button
                        key={a}
                        onClick={() =>
                          addMany(selectable.filter((r) => r.audience === a))
                        }
                        title={`Add every ${AUDIENCE_LABEL[a].toLowerCase()} shown`}
                        className="text-[11px] px-2 py-1 rounded bg-[#242B35] text-gray-300 hover:text-white"
                      >
                        <Users className="w-3 h-3 inline mr-1" />
                        {AUDIENCE_SHORT[a]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {loading ? (
                <p className="text-gray-500 text-sm p-4">Loading recipients…</p>
              ) : options.length === 0 ? (
                <p className="text-gray-500 text-sm p-4">
                  No recipients match this search.
                </p>
              ) : (
                options.map((r) => {
                  const active = draftKeys.has(recipientKey(r));
                  const blocked = isContactChannel && !canReach(r, channel);
                  return (
                    <div
                      key={recipientKey(r)}
                      onClick={() => !blocked && toggle(r)}
                      title={blocked ? `Recipient has ${missingLabel}` : undefined}
                      // No selected-row tint: the ticked checkbox already says
                      // it, and a wall of purple rows made the list harder to
                      // read than plain ones.
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        blocked
                          ? "opacity-40 cursor-not-allowed"
                          : "cursor-pointer hover:bg-[#20262f]"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 shrink-0 flex items-center justify-center border rounded ${
                          active
                            ? "bg-[#B93DEB] border-[#B93DEB]"
                            : "border-[#4b5563]"
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm truncate">
                          {r.username}
                        </p>
                        <p className="text-gray-500 text-xs truncate">
                          {/* Shows the destination this send would actually
                              use, not whichever contact detail exists. */}
                          {destinationFor(r, channel) ??
                            r.email ??
                            r.phone ??
                            missingLabel}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${AUDIENCE_BADGE[r.audience]}`}
                      >
                        {AUDIENCE_SHORT[r.audience]}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <p className="px-4 py-2 text-gray-500 text-xs border-t border-[#242B35] shrink-0">
              Showing {options.length} of {total}. Search to reach the rest.
            </p>
          </div>

          {/* ── Running selection ── */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between shrink-0">
              <p className="text-white text-sm">
                Selected{" "}
                <span className="text-[#B93DEB]">{draft.length}</span>
              </p>
              {draft.length > 0 && (
                <button
                  onClick={() => setDraft([])}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Clear all
                </button>
              )}
            </div>

            {draftByAudience.size > 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
                {AUDIENCE_ORDER.filter((a) => draftByAudience.has(a)).map((a) => (
                  <span
                    key={a}
                    className={`text-[10px] px-2 py-0.5 rounded border ${AUDIENCE_BADGE[a]}`}
                  >
                    {draftByAudience.get(a)} {AUDIENCE_SHORT[a]}
                  </span>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {draft.length === 0 ? (
                <p className="text-gray-500 text-sm p-4">
                  Nothing selected yet. Pick people from the list on the left.
                </p>
              ) : (
                draftSorted.map((r) => (
                  <div
                    key={recipientKey(r)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#20262f]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm truncate">
                        {r.username}
                      </p>
                      <p className="text-gray-500 text-xs truncate">
                        {destinationFor(r, channel) ??
                          r.email ??
                          r.phone ??
                          missingLabel}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${AUDIENCE_BADGE[r.audience]}`}
                    >
                      {AUDIENCE_SHORT[r.audience]}
                    </span>
                    <button
                      onClick={() =>
                        setDraft((prev) =>
                          prev.filter(
                            (s) => recipientKey(s) !== recipientKey(r),
                          ),
                        )
                      }
                      className="text-gray-500 hover:text-white shrink-0"
                      aria-label={`Remove ${r.username}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {unreachable > 0 && (
              <p className="px-4 py-2 text-amber-400/90 text-xs border-t border-[#242B35] shrink-0">
                {unreachable} of these have {missingLabel} and will be
                skipped.
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#242B35] flex items-center justify-between gap-3">
          <p className="text-gray-500 text-xs">
            Search as many times as you need — the selection on the right is
            kept.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-10 px-6 bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50"
              disabled={draft.length === 0}
              onClick={() => {
                onConfirm(draft);
                onOpenChange(false);
              }}
            >
              Done{draft.length > 0 ? ` (${draft.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
