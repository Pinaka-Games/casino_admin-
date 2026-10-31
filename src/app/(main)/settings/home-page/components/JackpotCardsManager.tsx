"use client";

import { useCallback, useEffect, useState } from "react";
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Crown, Loader2, Save, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import { jackpotAdminApi, type JackpotTierConfig } from "@/api/jackpot/jackpot.api";

/** Card accent per tier — mirrors the player-side artwork colours. */
const TIER_ACCENT: Record<string, string> = {
  grand: "#C77DFF",
  major: "#FF6B6B",
  minor: "#5BD9A1",
  mini: "#60A5FA",
};

const money = (v: number | string) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function SortableTierRow({
  tier,
  index,
  busy,
  onToggle,
}: {
  tier: JackpotTierConfig;
  index: number;
  busy: boolean;
  onToggle: (tier: JackpotTierConfig, value: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tier.tier,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const accent = TIER_ACCENT[tier.tier] ?? "#B93DEB";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row flex items-center gap-3 rounded-lg border bg-[#191D24] px-3 py-2.5 transition-colors ${
        tier.enabled ? "border-gray-800/60" : "border-gray-800/40 opacity-60"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-md p-1 text-gray-500 opacity-0 transition-opacity hover:text-white active:cursor-grabbing group-hover/row:opacity-100"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <span className="w-6 shrink-0 text-center text-xs font-bold text-gray-500">#{index + 1}</span>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          <Crown size={13} />
        </span>
        <p className="truncate text-sm font-medium text-white" title={tier.label}>
          {tier.label}
        </p>
        <span
          className="shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${accent}1A`, color: accent, borderColor: `${accent}33` }}
        >
          {tier.tier}
        </span>
      </div>

      <span className="shrink-0 text-xs font-semibold tabular-nums text-[#FFCB3F]">
        {money(tier.currentAmount)}
      </span>

      <Switch
        checked={tier.enabled}
        disabled={busy}
        onCheckedChange={(v) => onToggle(tier, v)}
        className="scale-75 origin-right data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
      />
    </div>
  );
}

export default function JackpotCardsManager() {
  const [tiers, setTiers] = useState<JackpotTierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await jackpotAdminApi.listTiers();
      setTiers([...list].sort((a, b) => a.rank - b.rank));
      setDirty(false);
    } catch {
      toast.error("Failed to load jackpot cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTiers((prev) => {
      const from = prev.findIndex((t) => t.tier === active.id);
      const to = prev.findIndex((t) => t.tier === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
    setDirty(true);
  };

  // A tier's enabled flag is its own field (it also gates contributions and the
  // draw), so it's persisted immediately rather than bundled with the order.
  const handleToggle = async (tier: JackpotTierConfig, value: boolean) => {
    setTiers((prev) => prev.map((t) => (t.tier === tier.tier ? { ...t, enabled: value } : t)));
    setBusyKey(tier.tier);
    try {
      await jackpotAdminApi.setTierEnabled(tier.tier, value);
    } catch {
      toast.error("Failed to update card");
      setTiers((prev) => prev.map((t) => (t.tier === tier.tier ? { ...t, enabled: !value } : t)));
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const res = await jackpotAdminApi.reorderTiers(
        tiers.map((t, i) => ({ tier: t.tier, rank: i + 1 })),
      );
      setTiers([...res].sort((a, b) => a.rank - b.rank));
      setDirty(false);
      toast.success("Card order saved");
    } catch {
      toast.error("Failed to save card order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full rounded-xl border border-gray-800/50 bg-[#191D24] p-3 md:p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#B93DEB]/10 text-[#B93DEB]">
            <Crown size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">Progressive Jackpot Cards</h2>
            <p className="text-[11px] text-gray-500">
              The four cards inside the Progressive Jackpots block. Drag to set their left-to-right
              order, toggle one off to hide it (a hidden tier also stops taking contributions).
            </p>
            <p className="mt-0.5 text-[10px] text-gray-600">
              The block itself is a row on the home page — move or hide it from{" "}
              <span className="text-gray-400">Home Page Layout → Progressive Jackpots</span>. Players
              tapping it land on <span className="text-gray-400">/jackpot</span>. Pot amounts, seed,
              share rate and draw settings live in{" "}
              <a
                href="/users/game-jackpots"
                className="inline-flex items-center gap-0.5 text-[#B93DEB] hover:underline"
              >
                Game Jackpots <ExternalLink size={9} />
              </a>
              .
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white disabled:opacity-40"
            title="Discard changes"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleSaveOrder}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#a32cd4] disabled:opacity-40"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save Order"}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Loading cards…
        </div>
      ) : tiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-800 py-12 text-center text-sm text-gray-400">
          No progressive tiers configured yet
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tiers.map((t) => t.tier)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {tiers.map((t, i) => (
                <SortableTierRow
                  key={t.tier}
                  tier={t}
                  index={i}
                  busy={busyKey === t.tier}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
