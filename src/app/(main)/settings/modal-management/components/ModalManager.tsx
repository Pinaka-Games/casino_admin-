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
  Loader2,
  Save,
  RotateCcw,
  Pencil,
  Clock,
  Users,
  MonitorPlay,
  FileText,
} from "lucide-react";
import LegalDocumentsDialog from "./LegalDocumentsDialog";

/**
 * The popup whose content admins manage here rather than in code. Matches
 * MODAL_KEYS.LEGAL_UPDATE on the API.
 */
const LEGAL_MODAL_KEY = "legal_update";
import { toast } from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import {
  getModals,
  reorderModals,
  updateModal,
  AUDIENCE_OPTIONS,
  type AdminModal,
} from "@/api/modals/modal.api";
import ModalConfigDialog from "./ModalConfigDialog";

const AUDIENCE_LABEL = Object.fromEntries(
  AUDIENCE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AdminModal["audience"], string>;

const AUDIENCE_ACCENT: Record<AdminModal["audience"], string> = {
  all: "text-[#B93DEB] bg-[#B93DEB]/10",
  authenticated: "text-emerald-400 bg-emerald-500/10",
  guest: "text-amber-400 bg-amber-500/10",
};

function SortableModalRow({
  modal,
  index,
  onToggle,
  onEdit,
  onManageDocuments,
}: {
  modal: AdminModal;
  index: number;
  onToggle: (modal: AdminModal, value: boolean) => void;
  onEdit: (modal: AdminModal) => void;
  /** Only the Legal Update row has content to manage behind it. */
  onManageDocuments: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: modal.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row flex items-center gap-3 rounded-lg border bg-[#191D24] px-3 py-2.5 transition-colors ${
        modal.enabled ? "border-gray-800/60" : "border-gray-800/40 opacity-60"
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

      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#B93DEB]/10 text-[#B93DEB]">
        <MonitorPlay size={13} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-sm font-medium text-white" title={modal.title}>
          {modal.title}
        </p>
        {modal.description && (
          <p className="truncate text-[11px] text-gray-500" title={modal.description}>
            {modal.description}
          </p>
        )}
      </div>

      {/* Delay */}
      <span
        className="hidden items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-300 bg-gray-700/40 sm:flex"
        title="Delay after the previous modal closes"
      >
        <Clock size={11} />
        {modal.delaySeconds}s
      </span>

      {/* Audience */}
      <span
        className={`hidden items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-white/5 sm:flex ${AUDIENCE_ACCENT[modal.audience]}`}
        title="Visible to"
      >
        <Users size={11} />
        {AUDIENCE_LABEL[modal.audience]}
      </span>

      {/* Active toggle */}
      <Switch
        checked={modal.enabled}
        onCheckedChange={(v) => onToggle(modal, v)}
        className="scale-75 origin-right data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
      />

      {/* The Legal Update popup is the one modal with content of its own: the
          documents it shows, and the publish that triggers it. */}
      {modal.key === LEGAL_MODAL_KEY && (
        <button
          type="button"
          onClick={onManageDocuments}
          className="flex items-center gap-1 rounded-md border border-[#B93DEB]/40 px-2 py-1 text-[11px] font-medium text-[#B93DEB] transition-colors hover:bg-[#B93DEB]/10"
          title="Edit and publish the legal documents"
        >
          <FileText size={12} />
          Documents
        </button>
      )}

      {/* Edit */}
      <button
        type="button"
        onClick={() => onEdit(modal)}
        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#B93DEB]/10 hover:text-[#B93DEB]"
        aria-label="Edit modal"
        title="Edit"
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}

export default function ModalManager() {
  const [modals, setModals] = useState<AdminModal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminModal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setModals(await getModals());
      setDirty(false);
    } catch {
      toast.error("Failed to load modals");
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
    setModals((prev) => {
      const from = prev.findIndex((m) => m.id === active.id);
      const to = prev.findIndex((m) => m.id === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
    setDirty(true);
  };

  // Active toggle is an immediate, optimistic write (rolled back on failure).
  const handleToggle = async (modal: AdminModal, value: boolean) => {
    setModals((prev) => prev.map((m) => (m.id === modal.id ? { ...m, enabled: value } : m)));
    try {
      await updateModal(modal.id, { enabled: value });
    } catch {
      toast.error("Failed to update modal");
      load();
    }
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      await reorderModals(modals.map((m) => m.id));
      setDirty(false);
      toast.success("Display order saved");
    } catch {
      toast.error("Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  const handleSaved = (updated: AdminModal) => {
    setModals((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  return (
    <div className="w-full rounded-xl border border-gray-800/50 bg-[#191D24] p-3 md:p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#B93DEB]/10 text-[#B93DEB]">
            <MonitorPlay size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">Modal Management</h2>
            <p className="text-[11px] text-gray-500">
              Manage the existing popups players see. Drag to set the display sequence; set a delay,
              audience, and active state per modal. Popups wait until the player is free (not in a
              game) before showing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white disabled:opacity-40"
            title="Discard order changes"
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
          Loading modals…
        </div>
      ) : modals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-800 py-12 text-center text-sm text-gray-400">
          No modals configured yet — use “Seed Defaults” to populate them.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={modals.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {modals.map((m, i) => (
                <SortableModalRow
                  key={m.id}
                  modal={m}
                  index={i}
                  onToggle={handleToggle}
                  onEdit={setEditing}
                  onManageDocuments={() => setLegalOpen(true)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <LegalDocumentsDialog open={legalOpen} onClose={() => setLegalOpen(false)} />

      <ModalConfigDialog
        modal={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
