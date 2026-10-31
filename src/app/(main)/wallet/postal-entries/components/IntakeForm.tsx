"use client";

import React, { useState } from "react";
import { Loader2, Mail, Paperclip, X } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PostalLookupResult,
  REJECTION_REASON_LABELS,
  postalRequestApi,
} from "@/api/postal-request/postal-request.api";

import { uploadSingle } from "@/api/upload/upload.api";

import {
  ACCENT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD,
  PANEL,
  TEXT_FAINT,
} from "../theme";

import AccountPanel from "./AccountPanel";

interface Props {
  /** Called after an envelope is recorded, so the queue refreshes. */
  onRecorded: () => void | Promise<void>;
}

/**
 * Opening an envelope.
 *
 * The clerk types the code first and gets the account back BEFORE anything is
 * written. That ordering is the point of the whole feature: they compare the
 * handwriting against real account data and only then commit, rather than
 * recording a card and finding out afterwards that it belongs to nobody.
 */
export default function IntakeForm({ onRecorded }: Props) {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<PostalLookupResult | null>(null);
  const [postmarkDate, setPostmarkDate] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setCode("");
    setLookup(null);
    setPostmarkDate("");
    setNotes("");
    setImageUrl(null);
  };

  const runLookup = async () => {
    if (!code.trim()) {
      toast.error("Enter the code written on the card");
      return;
    }
    setLooking(true);
    try {
      const res = await postalRequestApi.lookup(code.trim());
      setLookup(res.data);
      if (!res.data.found) {
        toast.error("That code does not match any code we issued");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Lookup failed");
    } finally {
      setLooking(false);
    }
  };

  const record = async () => {
    setSaving(true);
    try {
      const res = await postalRequestApi.create({
        code: code.trim(),
        postmarkDate: postmarkDate || undefined,
        imageUrl: imageUrl || undefined,
        notes: notes.trim() || undefined,
      });

      // A failing automatic check writes a REJECTED row rather than erroring —
      // the envelope did arrive. Say which check refused it, so the clerk is
      // not left wondering why the card never reached the queue.
      if (res.data.status === "REJECTED" && res.data.rejectionReason) {
        toast.error(
          `Recorded and auto-rejected: ${
            REJECTION_REASON_LABELS[res.data.rejectionReason] ??
            res.data.rejectionReason
          }`,
        );
      } else {
        toast.success("Entry recorded and queued for approval");
      }

      reset();
      await onRecorded();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not record this entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${PANEL} p-4`}>
      <div className="mb-4 flex items-center gap-2">
        <Mail className={`h-4 w-4 ${ACCENT}`} />
        <h2 className="font-medium text-white">Open an envelope</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/80">Mail-In Request Code</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                inputMode="numeric"
                placeholder="Digits from the card"
                className={FIELD}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setLookup(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runLookup();
                }}
              />
              <Button
                onClick={runLookup}
                disabled={looking}
                variant="outline"
                className={BTN_SECONDARY}
              >
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {/* Rules 3(l): dates are cross-referenced against the date written on
                the card and the postage, so the postmark date is worth keeping
                on file even though nothing is refused automatically on it. */}
            <Label className="text-white/80">Postmark date (optional)</Label>
            <Input
              type="date"
              value={postmarkDate}
              onChange={(e) => setPostmarkDate(e.target.value)}
              className={`${FIELD} [color-scheme:dark]`}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Scan of the card / envelope (optional)</Label>
            {/* Kept because a rejected card is a decision somebody may query
                weeks later, by which time the paper is long gone. */}
            {imageUrl ? (
              <div className="flex items-center gap-2 text-sm">
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1 underline ${ACCENT}`}
                >
                  <Paperclip className="h-4 w-4" /> View attachment
                </a>
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="text-white/45 hover:text-white"
                  aria-label="Remove attachment"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Input
                type="file"
                accept="image/*,application/pdf"
                disabled={uploading}
                className={`${FIELD} file:mr-3 file:rounded-md file:border-0 file:bg-purple-600 file:px-3 file:py-1 file:text-white`}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const res = await uploadSingle(file, "postal-entries");
                    setImageUrl(res.data.url);
                    toast.success("Attachment uploaded");
                  } catch {
                    toast.error("Could not upload that file");
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            )}
            {uploading && (
              <p className={`flex items-center gap-1 text-xs ${TEXT_FAINT}`}>
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Notes (optional)</Label>
            <Textarea
              value={notes}
              maxLength={1000}
              placeholder="Anything worth recording about this envelope"
              onChange={(e) => setNotes(e.target.value)}
              className={FIELD}
            />
          </div>

          <div className="flex gap-2">
            <Button
              className={BTN_PRIMARY}
              onClick={record}
              disabled={saving || uploading || !code.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record entry"}
            </Button>
            <Button
              variant="ghost"
              className="text-white/60 hover:bg-white/5 hover:text-white"
              onClick={reset}
              disabled={saving}
            >
              Clear
            </Button>
          </div>
        </div>

        <AccountPanel lookup={lookup} />
      </div>
    </div>
  );
}
