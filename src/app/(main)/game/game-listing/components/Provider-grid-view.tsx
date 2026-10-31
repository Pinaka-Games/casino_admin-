"use client";

import { useState } from "react";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Gamepad2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AdminProvider } from "@/api/games/games";
import { ProviderGridSkeleton } from "./GameSkeletons";
import { getProviderLogo, getProviderLogoBySlug } from "../data/provider-logos";

interface Props {
  providers: AdminProvider[];
  loading: boolean;
  onToggle: (id: string, value: boolean) => void;
  onReorder: (ordered: AdminProvider[]) => void;
  onOpen: (studioName: string) => void;
}

function SortableProviderCard({
  provider,
  onToggle,
  onOpen,
}: {
  provider: AdminProvider;
  onToggle: (id: string, value: boolean) => void;
  onOpen: (studioName: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: provider.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  // Prefer a slug-named logo (assigned per provider), then the legacy name-based
  // art, then the DB logo URL, then a text fallback.
  const localLogo = getProviderLogoBySlug(provider.slug) ?? getProviderLogo(provider.name);
  const [imgError, setImgError] = useState(false);

  // Why a card shows no logo — surfaced as a hint so admins know what's missing.
  const noLogoReason = localLogo
    ? null
    : !provider.logo
      ? "No logo: this provider isn't in the curated logo set and has no stored logo URL."
      : imgError
        ? "Logo URL is broken / failed to load."
        : null;

  // Same card design as the player site's ProviderGrid: compact dark card,
  // centered logo, hover-lift to purple. Admin controls sit as subtle overlays.
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onOpen(provider.name)}
      className={`group relative flex h-[110px] cursor-pointer items-center justify-center rounded-xl border bg-[#14171D] transition-all duration-300 hover:-translate-y-1 hover:border-[#B93DEB] ${
        provider.enabled ? "border-[#242B35]" : "border-[#242B35] opacity-50 hover:opacity-100"
      }`}
    >
      {/* Drag handle (top-left, on hover) */}
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1.5 top-1.5 z-10 cursor-grab touch-none rounded p-1 text-gray-600 opacity-0 transition-opacity hover:text-gray-300 active:cursor-grabbing group-hover:opacity-100"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>

      {/* Enable switch (top-right) */}
      <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={provider.enabled}
          onCheckedChange={(value) => onToggle(provider.id, value)}
          className="scale-75 origin-right data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
        />
      </div>

      {/* Centered logo / name.

          Every logo is scaled into the SAME fixed box rather than capped with
          max-height/width. With caps, art smaller than the cap rendered at its
          own intrinsic size — so a 60px-wide wordmark looked tiny next to one
          that hit the ceiling. A fixed box plus object-contain scales each file
          up or down to fill it, so wide and tall marks read at one optical
          size without distortion. */}
      <div className="flex h-full w-full items-center justify-center px-3">
        <div className="flex h-12 w-[82%] items-center justify-center">
          {localLogo ? (
            <Image
              src={localLogo}
              alt={provider.name}
              width={160}
              height={56}
              className="h-full w-full object-contain opacity-80 transition-opacity group-hover:opacity-100"
            />
          ) : provider.logo && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={provider.logo}
              alt={provider.name}
              onError={() => setImgError(true)}
              className="h-full w-full object-contain opacity-80 transition-opacity group-hover:opacity-100"
            />
          ) : (
          // No logo — show the name plus a hint explaining why.
          <div className="flex flex-col items-center gap-1 text-center text-white" title={noLogoReason ?? undefined}>
            <div className="flex items-center gap-1.5">
              <Gamepad2 size={16} className="shrink-0 text-[#B93DEB]" />
              <span className="text-sm font-bold capitalize line-clamp-2">{provider.name}</span>
            </div>
            <span className="text-[8px] font-medium uppercase tracking-wider text-amber-400/70">
              {imgError ? "Logo broken" : "No logo"}
            </span>
            </div>
          )}
        </div>
      </div>

      {/* Game count (bottom-left badge) */}
      <span className="absolute bottom-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B93DEB] backdrop-blur-sm">
        {provider.gameCount} Games
      </span>
    </div>
  );
}

export default function ProviderGridView({
  providers,
  loading,
  onToggle,
  onReorder,
  onOpen,
}: Props) {
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = providers.findIndex((p) => p.id === active.id);
    const newIndex = providers.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(providers, oldIndex, newIndex));
  };

  // Search is a view-only filter; reordering is disabled while filtering so we
  // never persist a partial order.
  const filtered = search.trim()
    ? providers.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : providers;
  const isFiltering = search.trim().length > 0;

  if (loading) {
    return <ProviderGridSkeleton count={18} />;
  }

  const enabledCount = providers.filter((p) => p.enabled).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800/50 bg-[#15181E] px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white">Providers</h2>
          <span className="rounded bg-[#B93DEB]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B93DEB]">
            {providers.length} Total
          </span>
          <div className="h-1 w-1 rounded-full bg-gray-700" />
          <span className="text-[9px] font-medium text-green-400">{enabledCount} Enabled</span>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search providers..."
          className="h-9 w-full max-w-xs rounded-md border border-gray-800 bg-[#1a2030] px-3 text-sm text-white placeholder:text-gray-500 focus:border-[#B93DEB] focus:outline-none sm:w-64"
        />
      </div>

      {!isFiltering && (
        <p className="px-1 text-[11px] text-gray-500">
          Drag the <GripVertical size={11} className="inline -mt-0.5" /> handle to set the
          order providers appear for players. Toggle a provider off to hide all its games.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800/50 bg-[#15181E] py-16 text-gray-500">
          <Gamepad2 size={40} className="mb-3 opacity-20" />
          <p className="text-sm">No providers found.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={filtered.map((p) => p.id)}
            strategy={rectSortingStrategy}
            disabled={isFiltering}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
              {filtered.map((provider) => (
                <SortableProviderCard
                  key={provider.id}
                  provider={provider}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
