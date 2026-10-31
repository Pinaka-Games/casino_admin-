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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  Radio,
  Hand,
  Tv,
  Database,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { Switch } from "@/components/ui/switch";
import ConfirmSeedDialog from "@/components/ConfirmSeedDialog";
import {
  getLiveCasinoTabs,
  deleteLiveCasinoTab,
  saveLiveCasinoTabs,
  seedLiveCasinoDefaults,
  type LiveCasinoTab,
} from "@/api/games/live-casino";
import LiveCasinoTabModal from "./LiveCasinoTabModal";
import { LIVE_CASINO_TAB_ICONS, DEFAULT_TAB_ICON } from "./tabIcons";

/** Human label for a tab's source, shown as a badge on its row. */
const sourceLabel = (tab: LiveCasinoTab): string => {
  if (tab.sourceType === "manual") return "Hand-picked";
  switch (tab.autoRule) {
    case "popular":
      return "Rule · Most played";
    case "new":
      return "Rule · Newest";
    case "subcategory":
      return `Rule · ${tab.autoFilter || "—"}`;
    default:
      return "Rule · All live games";
  }
};

function SortableTabRow({
  tab,
  index,
  busy,
  locked,
  onToggle,
  onSetDefault,
  onEdit,
  onDelete,
}: {
  tab: LiveCasinoTab;
  index: number;
  busy: boolean;
  /** An unsaved arrangement is pending — actions that reload would discard it. */
  locked: boolean;
  onToggle: (tab: LiveCasinoTab, value: boolean) => void;
  onSetDefault: (tab: LiveCasinoTab) => void;
  onEdit: (tab: LiveCasinoTab) => void;
  onDelete: (tab: LiveCasinoTab) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const Icon = LIVE_CASINO_TAB_ICONS[tab.iconKey ?? ""] ?? DEFAULT_TAB_ICON;
  const total = tab.gameCount ?? 0;
  const shown = tab.activeGameCount ?? total;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row flex flex-wrap items-center gap-3 rounded-lg border bg-[#15181E] px-3 py-2.5 transition-colors ${
        tab.isActive ? "border-gray-800/60 hover:border-gray-700" : "border-gray-800/40 opacity-60"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-md p-1 text-gray-500 opacity-100 transition-opacity hover:text-white active:cursor-grabbing sm:opacity-0 sm:group-hover/row:opacity-100"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <span className="w-6 shrink-0 text-center text-xs font-bold text-gray-500">
        #{index + 1}
      </span>

      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#B93DEB]/10 text-[#B93DEB]">
        <Icon size={15} />
      </span>

      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-2 gap-y-1 sm:basis-auto">
        <h3 className="truncate text-sm font-semibold text-white" title={tab.name}>
          {tab.name}
        </h3>
        {/* What Spanish players see — blank here means the label has no
            translation yet and would show in English on the /es site. */}
        {tab.translations?.es && (
          <span
            className="shrink-0 truncate text-[11px] text-gray-500"
            title={`Spanish: ${tab.translations.es}`}
          >
            · ES: {tab.translations.es}
          </span>
        )}
        <span className="shrink-0 rounded border border-gray-700/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-gray-500">
          {tab.slug}
        </span>
        <span
          className={`shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
            tab.sourceType === "manual"
              ? "border-[#B93DEB]/20 bg-[#B93DEB]/10 text-[#B93DEB]"
              : "border-sky-500/20 bg-sky-500/10 text-sky-400"
          }`}
        >
          {tab.sourceType === "manual" ? <Hand size={9} /> : <Radio size={9} />}
          {sourceLabel(tab)}
        </span>
        {total === 0 ? (
          // An empty tab renders as a dead chip on the player site, so it is
          // called out rather than reported as "0 games" in passing.
          <span className="shrink-0 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
            No games yet
          </span>
        ) : (
          <span className="shrink-0 text-[11px] text-gray-500">
            {total} game{total === 1 ? "" : "s"}
            {shown !== total ? ` · ${shown} shown` : ""}
          </span>
        )}
        {tab.isDefault && (
          <span className="shrink-0 flex items-center gap-0.5 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
            <Star size={9} />
            Opens first
          </span>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!tab.isDefault && (
          <button
            onClick={() => onSetDefault(tab)}
            disabled={busy}
            title="Make this the tab the section opens on"
            className="flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-400 disabled:opacity-40"
          >
            <Star size={11} />
            Set default
          </button>
        )}
        <button
          onClick={() => onEdit(tab)}
          disabled={locked}
          title={locked ? "Save or reset your changes first" : "Edit this tab and its games"}
          className="flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-[#B93DEB] hover:text-[#B93DEB] disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:text-gray-300"
        >
          <Pencil size={11} />
          Edit
        </button>
        <button
          onClick={() => onDelete(tab)}
          disabled={locked}
          title={locked ? "Save or reset your changes first" : "Delete this tab"}
          className="flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-red-500 hover:text-red-400 disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:text-gray-300"
        >
          <Trash2 size={11} />
          Delete
        </button>
        <Switch
          checked={tab.isActive}
          disabled={busy}
          onCheckedChange={(v) => onToggle(tab, v)}
          title={tab.isActive ? "Shown to players" : "Hidden from players"}
          className="scale-75 origin-right data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
        />
      </div>
    </div>
  );
}

/**
 * Admin → Live Casino Categories.
 *
 * The tabs of the home-page Social Live Casino section. Arranging the strip —
 * dragging, showing/hiding, choosing which tab opens first — is a single editing
 * session: every change applies to the list on screen straight away and is
 * written on Save, so a run of adjustments costs one request instead of one per
 * click, and Reset walks all of it back.
 */
export default function LiveCasinoTabsManager() {
  const [tabs, setTabs] = useState<LiveCasinoTab[]>([]);
  /** The last saved state, so Reset can restore it without a round trip. */
  const [savedTabs, setSavedTabs] = useState<LiveCasinoTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LiveCasinoTab | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LiveCasinoTab | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await getLiveCasinoTabs();
      setTabs(fresh);
      setSavedTabs(fresh);
      setDirty(false);
    } catch {
      toast.error("Failed to load live casino tabs");
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
      const from = prev.findIndex((t) => t.id === active.id);
      const to = prev.findIndex((t) => t.id === over.id);
      if (from === -1 || to === -1) return prev;
      // Renumber from the new order so the row badges (#1, #2 …) match what
      // will be saved, not the positions the rows arrived with.
      return arrayMove(prev, from, to).map((t, i) => ({ ...t, position: i }));
    });
    setDirty(true);
  };

  const handleToggle = (tab: LiveCasinoTab, value: boolean) => {
    setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, isActive: value } : t)));
    setDirty(true);
  };

  // Exactly one tab opens the section, so this reads as a radio: picking one
  // clears the rest. Hidden tabs cannot hold it — players would never get there.
  const handleSetDefault = (tab: LiveCasinoTab) => {
    setTabs((prev) =>
      prev.map((t) => ({
        ...t,
        isDefault: t.id === tab.id,
        isActive: t.id === tab.id ? true : t.isActive,
      })),
    );
    setDirty(true);
  };

  const handleReset = () => {
    setTabs(savedTabs);
    setDirty(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLiveCasinoTabs(
        tabs.map((t, i) => ({
          id: t.id,
          position: i,
          isActive: t.isActive,
          isDefault: t.isDefault,
        })),
      );
      toast.success("Live casino tabs saved");
      // Re-read rather than trusting the local copy: hiding the tab that opened
      // the section makes the backend promote another, and the badges should
      // show where it actually landed.
      await load();
    } catch {
      toast.error("Failed to save the tabs");
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setSeedConfirmOpen(false);
    setSeeding(true);
    try {
      const res = await seedLiveCasinoDefaults();
      toast.success(
        res.created === 0 && res.gamesLinked === 0
          ? "Nothing to fill — every tab already has its games"
          : `Seeded ${res.created} tab${res.created === 1 ? "" : "s"} and linked ${res.gamesLinked} game${res.gamesLinked === 1 ? "" : "s"}`,
      );
      await load();
    } catch {
      toast.error("Failed to seed defaults");
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (tab: LiveCasinoTab) => {
    setBusyId(tab.id);
    try {
      await deleteLiveCasinoTab(tab.id);
      toast.success(`"${tab.name}" deleted`);
      setConfirmDelete(null);
      await load();
    } catch {
      toast.error("Failed to delete the tab");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full rounded-xl border border-gray-800/50 bg-[#191D24] p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#B93DEB]/10 text-[#B93DEB]">
            <Tv size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">
              Live Casino Categories
            </h2>
            <p className="text-[11px] text-gray-500">
              The tabs of the home page&apos;s Social Live Casino section. Drag to reorder,
              toggle to show or hide, and star the one that opens first — then press Save.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Seed only helps an empty section; once tabs exist it is hidden. */}
          {(seeding || (!loading && tabs.length === 0)) && (
          <button
            onClick={() => setSeedConfirmOpen(true)}
            disabled={seeding || dirty}
            title={
              dirty
                ? "Save or reset your changes first"
                : "Create any missing default tab and fill the ones with no games. Never changes a tab that already has games."
            }
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#2A2F3A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B93DEB]/20 hover:text-[#B93DEB] disabled:opacity-50"
          >
            {seeding ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
            {seeding ? "Seeding…" : "Seed Defaults"}
          </button>
          )}
          <ConfirmSeedDialog
            open={seedConfirmOpen}
            title="Seed default live casino tabs?"
            description="This fills in the default Social Live Casino tabs on the home page."
            effects={[
              "Missing default tabs are created",
              "Manual tabs with no games are filled with games",
              "Tabs that already have games keep their games, name, icon, position and visibility",
              "If no visible tab is set to open first, the first visible tab becomes the default",
            ]}
            note="Nothing is deleted."
            onCancel={() => setSeedConfirmOpen(false)}
            onConfirm={handleSeed}
          />
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#2A2F3A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B93DEB]/20 hover:text-[#B93DEB]"
          >
            <Plus size={16} />
            Create Tab
          </button>
          <button
            onClick={handleReset}
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
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save Tabs"}
          </button>
        </div>
      </div>

      {dirty && (
        <p className="mb-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400">
          Unsaved changes — players still see the previous arrangement until you press Save.
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Loading tabs…
        </div>
      ) : tabs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-800 py-12 text-center text-sm text-gray-400">
          No live casino tabs yet — press <span className="text-gray-300">Seed Defaults</span> to
          create the standard six with their games, or build your own.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {tabs.map((tab, i) => (
                <SortableTabRow
                  key={tab.id}
                  tab={tab}
                  index={i}
                  busy={busyId === tab.id}
                  locked={dirty}
                  onToggle={handleToggle}
                  onSetDefault={handleSetDefault}
                  onEdit={(t) => {
                    setEditing(t);
                    setModalOpen(true);
                  }}
                  onDelete={setConfirmDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#191D24] p-5">
            <h3 className="text-base font-semibold text-white">
              Delete &ldquo;{confirmDelete.name}&rdquo;?
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              The tab disappears from the player site immediately. The games themselves are
              not deleted — only their place in this tab.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={busyId === confirmDelete.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {busyId === confirmDelete.id ? "Deleting…" : "Delete tab"}
              </button>
            </div>
          </div>
        </div>
      )}

      <LiveCasinoTabModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        tab={editing}
        onSaved={load}
      />
    </div>
  );
}
