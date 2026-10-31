"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Upload, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import ImageUploader, { ImageUploaderRef } from "@/components/image-upload/ImageUploader";
import { updateGame, getThumbnailUrl, type Game } from "@/api/games/games";

/**
 * Edit the GAME record behind a tab entry: its display name, its thumbnail, and
 * whether it is available at all.
 *
 * This writes through to the game, not to the tab membership — the same game can
 * sit in several tabs and in the lobby, and a renamed game or a new thumbnail is
 * meant to change everywhere. Use the tab's own Shown/Hidden control to affect
 * one tab only.
 */
export default function GameEditModal({
  game,
  onClose,
  onSaved,
}: {
  game: Game | null;
  onClose: () => void;
  onSaved: (updated: Game) => void;
}) {
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!game) return;
    setName(game.name ?? "");
    setEnabled(game.enabled ?? true);
    setThumbUrl(getThumbnailUrl(game.thumbnail));
  }, [game]);

  if (!game) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give the game a name");
      return;
    }
    setSaving(true);
    try {
      // Thumbnails are a jsonb bag of per-size urls; a replacement is written to
      // the keys the player app and the admin grids actually read, so the new
      // image shows up on both without touching the provider's other sizes.
      const thumbnail =
        thumbUrl && thumbUrl !== getThumbnailUrl(game.thumbnail)
          ? {
            ...(typeof game.thumbnail === "object" && game.thumbnail ? game.thumbnail : {}),
            url: thumbUrl,
            s279x400: thumbUrl,
          }
          : undefined;

      const updated = await updateGame(game.id, {
        name: name.trim(),
        enabled,
        ...(thumbnail ? { thumbnail } : {}),
      });
      toast.success("Game updated");
      onSaved({ ...game, ...(updated as Game) });
    } catch {
      toast.error("Failed to update the game");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#242B35] bg-[#14161b] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Edit game</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[#9AA7BC] transition-colors hover:bg-[#1E2430] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-4">
          <div className="shrink-0">
            <div className="relative h-[160px] w-[124px] overflow-hidden rounded-xl bg-[#1A2027]">
              {thumbUrl ? (
                <Image src={thumbUrl} alt={game.name} fill sizes="124px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2">
                  <span className="text-center text-xs text-gray-500">No image</span>
                </div>
              )}
            </div>
            <button
              onClick={() => uploaderRef.current?.open()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2A3140] px-2 py-1.5 text-[11px] font-medium text-[#9AA7BC] transition-colors hover:border-[#8B5CF6] hover:text-white"
            >
              <Upload size={12} />
              Change thumbnail
            </button>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[#8292AA]">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#2A3140] bg-[#11141A] px-3 text-sm text-white outline-none transition-colors focus:border-[#8B5CF6]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#8292AA]">Provider</label>
              <p className="text-sm capitalize text-gray-400">{game.studio || game.provider}</p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`flex h-11 w-full items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
                enabled
                  ? "border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-white"
                  : "border-[#2A3140] bg-transparent text-[#9AA7BC]"
              }`}
              title="Availability across the whole site, not just this tab"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-green-400" : "bg-gray-500"}`} />
              {enabled ? "Available everywhere" : "Disabled everywhere"}
            </button>
            <p className="text-[11px] text-[#667085]">
              These changes apply to the game itself — every tab and the lobby. To hide it
              from just this tab, use its Shown / Hidden control.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-[#8292AA] transition-colors hover:bg-[#242B35] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#8B5CF6] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7c3aed] disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : "Save game"}
          </button>
        </div>

        {/* Portrait cards — the 3:4 crop matches the player carousel. */}
        <ImageUploader
          ref={uploaderRef}
          aspect={3 / 4}
          folder="games"
          onUploadComplete={(url) => setThumbUrl(url)}
        />
      </div>
    </div>
  );
}
