"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, ExternalLink, FileText, History, Loader2, Send } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getLegalDocuments,
  getLegalVersions,
  publishLegalUpdate,
  type LegalDocument,
  type LegalVersion,
} from "@/api/legal/legal.api";

/**
 * Where the player site lives, so "open the page" goes to the real document
 * rather than resolving the route against the admin origin (which 404s).
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

/** The player routes are language-prefixed (/en/privacy-policy). */
const SITE_LANG = "en";

const documentUrl = (route: string | null) =>
  route ? `${SITE_URL}/${SITE_LANG}${route.startsWith("/") ? route : `/${route}`}` : null;

/**
 * Publish a legal update.
 *
 * The wording is NOT edited here — it lives in the player app and ships with a
 * release. This screen is the operator saying "those documents changed in what
 * just went live": tick them, say what changed, publish. That stamps a new
 * version for each, notifies every player, and blocks them until they have
 * read and accepted the documents they owe.
 */
export default function LegalDocumentsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [changeSummary, setChangeSummary] = useState("");
  const [requiresAcceptance, setRequiresAcceptance] = useState(true);
  const [notifyPlayers, setNotifyPlayers] = useState(true);

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<LegalVersion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLegalDocuments();
      setDocs(res.data ?? []);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error(message || "Could not load legal documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
    // A fresh publish each time it opens — a stale tick from last time would be
    // the easy way to pull every player out of the lobby by accident.
    setSelected(new Set());
    setChangeSummary("");
    setRequiresAcceptance(true);
    setNotifyPlayers(true);
    setConfirming(false);
    setHistoryFor(null);
  }, [open, load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirming(false);
  };

  const showHistory = async (documentId: string) => {
    if (historyFor === documentId) {
      setHistoryFor(null);
      return;
    }
    try {
      const res = await getLegalVersions(documentId);
      setVersions(res.data ?? []);
      setHistoryFor(documentId);
    } catch {
      toast.error("Could not load the history");
    }
  };

  const handlePublish = async () => {
    if (!selected.size) return;
    setPublishing(true);
    try {
      await publishLegalUpdate({
        documentIds: [...selected],
        changeSummary: changeSummary.trim() || undefined,
        requiresAcceptance,
        notifyPlayers,
      });
      toast.success(
        requiresAcceptance
          ? "Published. Players will be asked to read and accept."
          : "Published.",
      );
      setSelected(new Set());
      setChangeSummary("");
      setConfirming(false);
      await load();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error(message || "Could not publish the update");
    } finally {
      setPublishing(false);
    }
  };

  const selectedTitles = docs
    .filter((d) => selected.has(d.id))
    .map((d) => d.title);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* Capped and laid out as a column: the list grows with the number of
          documents, and without this the dialog ran past the top and bottom of
          the viewport, taking the title and the publish buttons with it.
          The width is set on the `sm:` variant because DialogContent ships
          `sm:max-w-lg` — a base-level max-width loses to it above 640px, which
          is why this stayed narrow and clipped the document titles. */}
      <DialogContent className="flex! max-h-[92vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden border-gray-800 bg-[#15181E] text-white sm:max-w-[min(1180px,95vw)]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} className="text-[#B93DEB]" />
            Publish Legal Update
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            The document text lives in the site and ships with a release. Tick the
            documents that changed and publish — every player is notified and must
            read and accept before they can keep playing.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-gray-400">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Loading…
          </div>
        ) : (
          <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className={`rounded-lg border px-3 py-2.5 transition-colors ${
                  selected.has(doc.id)
                    ? "border-[#B93DEB] bg-[#B93DEB]/10"
                    : "border-gray-800 bg-[#191D24]"
                } ${doc.isActive ? "" : "opacity-50"}`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selected.has(doc.id)}
                    onCheckedChange={() => toggle(doc.id)}
                    disabled={!doc.isActive}
                    className="border-gray-600 data-[state=checked]:border-[#B93DEB] data-[state=checked]:bg-[#B93DEB]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {doc.title}
                      {!doc.isActive && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-500">
                          inactive
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {doc.liveVersion
                        ? `v${doc.liveVersion.version} · published ${
                            doc.liveVersion.publishedAt
                              ? new Date(doc.liveVersion.publishedAt).toLocaleDateString()
                              : ""
                          } · ${doc.acceptedCount} accepted`
                        : "Never published — publishing makes this v1"}
                    </p>
                  </div>

                  {documentUrl(doc.route) && (
                    <a
                      href={documentUrl(doc.route) as string}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                      title="Open the page on the site"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => showHistory(doc.id)}
                    className="rounded p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                    title="Version history"
                  >
                    <History size={13} />
                  </button>
                </div>

                {historyFor === doc.id && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded border border-gray-800">
                    {versions.length === 0 ? (
                      <p className="px-3 py-2 text-[11px] text-gray-500">
                        No versions yet.
                      </p>
                    ) : (
                      versions.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-2 border-b border-gray-800/60 px-3 py-1.5 last:border-b-0"
                        >
                          <span className="text-[11px] font-bold text-white">
                            v{v.version}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11px] text-gray-400">
                            {v.changeSummary || "No summary"}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {v.publishedAt
                              ? new Date(v.publishedAt).toLocaleDateString()
                              : "—"}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {v.acceptedCount ?? 0} accepted
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}

            </div>

            <div className="mt-1">
              <Label className="text-xs text-gray-300">
                What changed (shown to players above the document)
              </Label>
              <Input
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Updated the prize redemption window to 90 days"
                maxLength={500}
                className="mt-1 h-10 border-gray-800 bg-[#191D24] text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <Switch
                  checked={requiresAcceptance}
                  onCheckedChange={(v) => {
                    setRequiresAcceptance(v);
                    setConfirming(false);
                  }}
                  className="scale-75 data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
                />
                Require players to re-accept
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <Switch
                  checked={notifyPlayers}
                  onCheckedChange={setNotifyPlayers}
                  disabled={!requiresAcceptance}
                  className="scale-75 data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
                />
                Send a notification
              </label>
            </div>
          </div>
        )}

        {confirming && selected.size > 0 && (
          <div className="flex shrink-0 items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="text-[12px] text-amber-100">
              Publishing <b>{selectedTitles.join(", ")}</b>.
              {requiresAcceptance ? (
                <>
                  {" "}
                  Every player will have to read and accept before they can keep
                  playing. This cannot be undone — reversing it means publishing
                  again.
                </>
              ) : (
                " Players will not be asked to re-accept."
              )}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2">
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
            Close
          </Button>
          {confirming ? (
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {publishing && <Loader2 className="mr-1.5 animate-spin" size={14} />}
              Yes, publish
            </Button>
          ) : (
            <Button
              onClick={() => setConfirming(true)}
              disabled={!selected.size || publishing}
              className="bg-[#B93DEB] text-white hover:bg-[#a32cd6]"
            >
              <Send size={14} className="mr-1.5" />
              Publish update
              {selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
