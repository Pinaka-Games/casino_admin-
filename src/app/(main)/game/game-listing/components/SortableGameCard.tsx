"use client";

import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Game, resolveRtp } from "@/api/games/games";

interface Props {
  game: Game;
  /** 1-based position of this card in the full ordered list (always unique) */
  index: number;
  providerId: string | number;
  /** Global edit mode — enables drag + inline position editing on every card */
  editing: boolean;
  onToggle: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void | Promise<void>;
  onToggleFeatured?: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void;
  onToggleNew?: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void;
  /** Move this game to a 1-based position (local-only until the page is saved). */
  onSetIndex: (gameId: string, newPosition: number) => void;
}

function resolveThumbnail(thumbnail: unknown, name: string): string {
  const placeholder = `https://placehold.co/300x200/1a2030/white?text=${encodeURIComponent(name)}`;
  if (!thumbnail) return placeholder;
  if (typeof thumbnail === "string") return thumbnail;
  const t = thumbnail as Record<string, any>;
  if (typeof t.url === "string") return t.url;
  if (typeof t.url === "object" && t.url !== null) {
    const urls = t.url as Record<string, string>;
    return (
      urls.s300x200 ||
      urls.s660x380 ||
      urls.s512x512 ||
      urls.s208x147 ||
      Object.values(urls).find((v) => typeof v === "string") ||
      placeholder
    );
  }
  return placeholder;
}

export default function SortableGameCard({
  game,
  index,
  providerId,
  editing,
  onToggle,
  onSetIndex,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: game.id, disabled: !editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const [imgLoaded, setImgLoaded] = useState(false);
  const [isEditingIndex, setIsEditingIndex] = useState(false);
  const [indexValue, setIndexValue] = useState(String(index));

  // RTP is the provider's own figure and is read-only here: nothing in this
  // console changes what a game pays, so there is nothing to edit. Null (no
  // published RTP) draws no badge rather than a 0% the provider never gave.
  const rtp = resolveRtp(game);

  // Optimistic enable state: flip instantly, persist, revert on failure.
  const [active, setActive] = useState(game.enabled);
  const [savingActive, setSavingActive] = useState(false);
  useEffect(() => setActive(game.enabled), [game.enabled]);

  const handleSwitch = async (value: boolean) => {
    setActive(value);
    setSavingActive(true);
    try {
      await onToggle(providerId, game.category, game.id, value);
    } catch {
      setActive(!value);
    } finally {
      setSavingActive(false);
    }
  };

  // Keep the input in sync when the list re-orders / re-paginates.
  useEffect(() => {
    setIndexValue(String(index));
  }, [index]);

  // Leaving global edit mode closes any open inline index editor.
  useEffect(() => {
    if (!editing) {
      setIsEditingIndex(false);
      setIndexValue(String(index));
    }
  }, [editing, index]);

  const commitIndex = () => {
    const next = parseInt(indexValue, 10);
    if (Number.isFinite(next) && next >= 1 && next !== index) {
      onSetIndex(game.id, next);
    } else {
      setIndexValue(String(index));
    }
    setIsEditingIndex(false);
  };

  const cancelIndexEdit = () => {
    setIndexValue(String(index));
    setIsEditingIndex(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group flex h-[200px] flex-col overflow-hidden rounded-xl border bg-[#1a2030] transition-all duration-300 hover:shadow-lg hover:shadow-[#B93DEB]/10 ${
        editing ? "border-[#B93DEB]/40" : "border-gray-800 hover:border-[#B93DEB]/50"
      }`}
    >
      {/* IMAGE */}
      <div className="relative h-28 w-full overflow-hidden bg-[#15181E]">
        {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-gray-700/40" />}
        <img
          src={resolveThumbnail(game.thumbnail, game.name)}
          alt={game.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(true)}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-110 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2030] to-transparent opacity-60" />

        {/* POSITION BADGE (top-center) — always visible */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
          #{index}
        </div>

        {/* RTP BADGE (top-left) — what the provider reports for this game. */}
        {rtp !== null ? (
          <div
            className="absolute top-2 left-2 z-10 rounded-md border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur-md"
            title="RTP reported by the provider"
          >
            {rtp}%
          </div>
        ) : null}

        {/* DRAG HANDLE (bottom-left of image) — only in edit mode */}
        {editing && (
          <button
            type="button"
            className="absolute bottom-2 left-2 z-10 cursor-grab touch-none rounded-lg border border-white/10 bg-black/40 p-1.5 text-white/60 backdrop-blur-md transition-all hover:text-white active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        )}
      </div>

      {/* CONTENT — name + toggle, then position + plays */}
      <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
        {/* Row 1: name + enable switch */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p
            className="truncate text-[12px] font-semibold leading-tight text-white min-w-0"
            title={game.name}
          >
            {game.name}
          </p>
          <Switch
            checked={active}
            disabled={savingActive}
            onCheckedChange={handleSwitch}
            className="shrink-0 scale-75 origin-right cursor-pointer disabled:cursor-not-allowed data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
          />
        </div>

        {/* Row 2: position (or editor) + plays */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {editing && isEditingIndex ? (
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[10px] font-bold text-gray-500">#</span>
              <input
                type="number"
                min={1}
                autoFocus
                value={indexValue}
                onChange={(e) => setIndexValue(e.target.value)}
                onBlur={commitIndex}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitIndex();
                  } else if (e.key === "Escape") {
                    cancelIndexEdit();
                  }
                }}
                className="h-7 w-12 rounded-md border border-gray-700 bg-[#15181E] px-1.5 text-center text-[12px] font-bold text-white outline-none focus:border-[#B93DEB] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                title="Type a position and press Enter"
              />
            </div>
          ) : editing ? (
            <button
              type="button"
              onClick={() => setIsEditingIndex(true)}
              className="flex shrink-0 items-center gap-1 rounded-md border border-gray-700 bg-[#15181E] px-2 py-0.5 text-sm font-bold text-white transition-colors hover:border-[#B93DEB] hover:text-[#B93DEB]"
              title="Type a position"
            >
              <span className="text-gray-500">#</span>
              {index}
            </button>
          ) : (
            <span className="shrink-0 text-sm font-bold text-white" title={`Position ${index}`}>
              <span className="text-gray-500">#</span>
              {index}
            </span>
          )}

          <div className="shrink-0 rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[9px] font-medium text-purple-400">
            {game.totalPlays || 0} Plays
          </div>
        </div>
      </div>
    </div>
  );
}
