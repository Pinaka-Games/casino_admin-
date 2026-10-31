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
import { GripVertical, LayoutList, Layers, Gamepad2, Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import { getHomeLayout, saveHomeLayout, type HomeSection } from "@/api/games/home-layout";
import { updateCollection } from "@/api/games/collections";
import { updateAdminCategory } from "@/api/games/games";

/** Badge + icon styling per section type (see HomeSection["type"]). */
const TYPE_STYLES = {
  builtin: {
    label: "Auto section",
    icon: LayoutList,
    chip: "bg-gray-600/10 text-gray-400 border-gray-600/20",
    badge: "bg-gray-700/40 text-gray-400",
  },
  collection: {
    label: "Category",
    icon: Layers,
    chip: "bg-[#B93DEB]/10 text-[#B93DEB] border-[#B93DEB]/20",
    badge: "bg-[#B93DEB]/10 text-[#B93DEB]",
  },
  category: {
    label: "Game type",
    icon: Gamepad2,
    chip: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    badge: "bg-sky-500/10 text-sky-400",
  },
} as const;

function SortableLayoutRow({
  section,
  index,
  busy,
  onToggle,
}: {
  section: HomeSection;
  index: number;
  busy: boolean;
  onToggle: (section: HomeSection, value: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const typeStyle = TYPE_STYLES[section.type] ?? TYPE_STYLES.builtin;
  const Icon = typeStyle.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row flex items-center gap-3 rounded-lg border bg-[#191D24] px-3 py-2.5 transition-colors ${
        section.enabled ? "border-gray-800/60" : "border-gray-800/40 opacity-60"
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
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${typeStyle.badge}`}>
          <Icon size={13} />
        </span>
        <p className="truncate text-sm font-medium text-white" title={section.title}>{section.title}</p>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${typeStyle.chip}`}>
          {typeStyle.label}
        </span>
      </div>

      <Switch
        checked={section.enabled}
        disabled={busy}
        onCheckedChange={(v) => onToggle(section, v)}
        className="scale-75 origin-right data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
      />
    </div>
  );
}

export default function HomeCategoriesManager() {
  const [sections, setSections] = useState<HomeSection[]>([]);
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
      setSections(await getHomeLayout());
      setDirty(false);
    } catch {
      toast.error("Failed to load home layout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const from = prev.findIndex((s) => s.key === active.id);
      const to = prev.findIndex((s) => s.key === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
    setDirty(true);
  };

  // Builtin visibility is saved with the layout; a collection's/category's
  // visibility is its own field, persisted immediately so that record stays the
  // single source of truth (it also drives the lobby, sidebar and its own page).
  const handleToggle = async (section: HomeSection, value: boolean) => {
    setSections((prev) => prev.map((s) => (s.key === section.key ? { ...s, enabled: value } : s)));

    if (section.type === "builtin" || !section.refId) {
      setDirty(true);
      return;
    }

    setBusyKey(section.key);
    try {
      if (section.type === "collection") {
        await updateCollection(section.refId, { enabled: value });
      } else {
        await updateAdminCategory(section.refId, { isActive: value });
      }
    } catch {
      toast.error(`Failed to update ${section.type === "collection" ? "category" : "game type"}`);
      setSections((prev) => prev.map((s) => (s.key === section.key ? { ...s, enabled: !value } : s)));
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      const res = await saveHomeLayout(sections.map((s) => ({ key: s.key, enabled: s.enabled })));
      setSections(res);
      setDirty(false);
      toast.success("Home layout saved");
    } catch {
      toast.error("Failed to save home layout");
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
            <LayoutList size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">Home Page Layout</h2>
            <p className="text-[11px] text-gray-500">
              Every block on the player home page, top to bottom. Drag to reorder, toggle a row off to hide it.
            </p>
            <p className="mt-0.5 text-[10px] text-gray-600">
              <span className="text-gray-400">Auto section</span> = built-in row ·{" "}
              <span className="text-[#B93DEB]">Category</span> = curated (Categories tab) ·{" "}
              <span className="text-sky-400">Game type</span> = games grouped by genre (Games → Categories)
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
            onClick={handleSaveLayout}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#a32cd4] disabled:opacity-40"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save Layout"}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Loading layout…
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-800 py-12 text-center text-sm text-gray-400">
          No categories added yet
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.key)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {sections.map((s, i) => (
                <SortableLayoutRow key={s.key} section={s} index={i} busy={busyKey === s.key} onToggle={handleToggle} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
