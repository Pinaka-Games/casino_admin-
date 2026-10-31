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
import {
  GripVertical,
  LayoutGrid,
  Layers,
  Tag,
  Grid3X3,
  Loader2,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import { getLobbyLayout, saveLobbyLayout, type LobbyTab } from "@/api/games/lobby-layout";

/** Per-type presentation (badge label + icon + accent). */
const TYPE_META: Record<
  LobbyTab["type"],
  { label: string; icon: typeof Tag; accent: string }
> = {
  builtin: { label: "Built-in", icon: LayoutGrid, accent: "text-gray-400 bg-gray-700/40" },
  category: { label: "Category", icon: Tag, accent: "text-emerald-400 bg-emerald-500/10" },
  collection: { label: "Collection", icon: Layers, accent: "text-[#B93DEB] bg-[#B93DEB]/10" },
  utility: { label: "Utility", icon: Grid3X3, accent: "text-sky-400 bg-sky-500/10" },
};

function SortableTabRow({
  tab,
  index,
  onToggle,
}: {
  tab: LobbyTab;
  index: number;
  onToggle: (tab: LobbyTab, value: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const meta = TYPE_META[tab.type];
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row flex items-center gap-3 rounded-lg border bg-[#191D24] px-3 py-2.5 transition-colors ${
        tab.enabled ? "border-gray-800/60" : "border-gray-800/40 opacity-60"
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
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${meta.accent}`}>
          <Icon size={13} />
        </span>
        <p className="truncate text-sm font-medium text-white" title={tab.title}>{tab.title}</p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-white/5 ${meta.accent}`}>
          {meta.label}
        </span>
      </div>

      <Switch
        checked={tab.enabled}
        onCheckedChange={(v) => onToggle(tab, v)}
        className="scale-75 origin-right data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
      />
    </div>
  );
}

export default function LobbyTabsManager() {
  const [tabs, setTabs] = useState<LobbyTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTabs(await getLobbyLayout());
      setDirty(false);
    } catch {
      toast.error("Failed to load lobby tabs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTabs((prev) => {
      const from = prev.findIndex((t) => t.key === active.id);
      const to = prev.findIndex((t) => t.key === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
    setDirty(true);
  };

  // All lobby-tab visibility lives in the lobby layout, so a toggle is just a
  // pending edit persisted on Save (no separate per-item write).
  const handleToggle = (tab: LobbyTab, value: boolean) => {
    setTabs((prev) => prev.map((t) => (t.key === tab.key ? { ...t, enabled: value } : t)));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveLobbyLayout(tabs.map((t) => ({ key: t.key, enabled: t.enabled })));
      setTabs(res);
      setDirty(false);
      toast.success("Lobby tabs saved");
    } catch {
      toast.error("Failed to save lobby tabs");
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
            <Grid3X3 size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">Lobby Tabs</h2>
            <p className="text-[11px] text-gray-500">
              Drag to reorder the category tabs players see above the game grid. Toggle a tab off to hide it. New
              categories &amp; collections appear here automatically.
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
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#a32cd4] disabled:opacity-40"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save Tabs"}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Loading tabs…
        </div>
      ) : tabs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-800 py-12 text-center text-sm text-gray-400">
          No lobby tabs yet
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map((t) => t.key)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {tabs.map((t, i) => (
                <SortableTabRow key={t.key} tab={t} index={i} onToggle={handleToggle} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
