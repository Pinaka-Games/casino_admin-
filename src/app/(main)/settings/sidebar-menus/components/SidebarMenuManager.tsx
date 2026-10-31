"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragOverlay,
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
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  RotateCcw,
  Link as LinkIcon,
  Zap,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import {
  getSidebarTree,
  reorderSidebar,
  deleteSidebarGroup,
  deleteSidebarItem,
  updateSidebarGroup,
  updateSidebarItem,
  type SidebarMenuGroup,
  type SidebarMenuItem,
} from "@/api/sidebar/sidebar";
import MenuFormModal from "./MenuFormModal";

const groupName = (g: SidebarMenuGroup) => g.title || g.titleKey || "(menu)";
const itemName = (it: SidebarMenuItem) => it.label || it.labelKey || "(item)";

function SortableItemRow({
  item,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: SidebarMenuItem;
  onEdit: (it: SidebarMenuItem) => void;
  onDelete: (it: SidebarMenuItem) => void;
  onToggle: (it: SidebarMenuItem, v: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/item flex items-center gap-2 rounded-lg border bg-[#1a2030] px-2.5 py-2 ${
        item.enabled ? "border-gray-800/60" : "border-gray-800/40 opacity-60"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-gray-500 opacity-0 transition-opacity hover:text-white active:cursor-grabbing group-hover/item:opacity-100"
        aria-label="Drag item"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {item.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.iconUrl} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />
        ) : null}
        <span className="truncate text-sm text-white" title={itemName(item)}>{itemName(item)}</span>
        {item.iconKey && !item.iconUrl && (
          <span className="shrink-0 rounded bg-gray-700/40 px-1.5 py-0.5 text-[9px] text-gray-400">{item.iconKey}</span>
        )}
        {item.action ? (
          <span className="shrink-0 flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-400" title={item.action}><Zap size={9} />action</span>
        ) : item.link ? (
          <span className="shrink-0 hidden sm:flex items-center gap-0.5 rounded bg-gray-700/30 px-1.5 py-0.5 text-[9px] text-gray-500" title={item.link}><LinkIcon size={9} />{item.link}</span>
        ) : null}
        {item.requireAuth && <span className="shrink-0 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-400">auth</span>}
        {item.collectionId && (
          <span className="shrink-0 rounded bg-[#B93DEB]/10 px-1.5 py-0.5 text-[9px] text-[#B93DEB] border border-[#B93DEB]/20" title="Managed from its category">category</span>
        )}
      </div>

      <Switch
        checked={item.enabled}
        onCheckedChange={(v) => onToggle(item, v)}
        className="scale-[0.65] origin-right data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
      />
      <button onClick={() => onEdit(item)} className="rounded border border-gray-700 p-1 text-gray-400 opacity-0 transition-opacity hover:border-[#B93DEB] hover:text-[#B93DEB] group-hover/item:opacity-100" title="Edit item"><Pencil size={12} /></button>
      <button onClick={() => onDelete(item)} className="rounded border border-gray-700 p-1 text-gray-400 opacity-0 transition-opacity hover:border-red-500 hover:text-red-400 group-hover/item:opacity-100" title="Remove from sidebar"><Trash2 size={12} /></button>
    </div>
  );
}

function SortableGroup({
  group,
  collapsed,
  onToggleCollapse,
  onEditGroup,
  onDeleteGroup,
  onToggleGroup,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onToggleItem,
}: {
  group: SidebarMenuGroup;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onEditGroup: (g: SidebarMenuGroup) => void;
  onDeleteGroup: (g: SidebarMenuGroup) => void;
  onToggleGroup: (g: SidebarMenuGroup, v: boolean) => void;
  onAddItem: (groupId: string) => void;
  onEditItem: (it: SidebarMenuItem) => void;
  onDeleteItem: (it: SidebarMenuItem) => void;
  onToggleItem: (it: SidebarMenuItem, v: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 40 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/grp rounded-xl border border-gray-800/60 bg-[#15181E] p-3">
      {/* Group header */}
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-gray-500 opacity-0 transition-opacity hover:text-white active:cursor-grabbing group-hover/grp:opacity-100"
          aria-label="Drag menu"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <button onClick={() => onToggleCollapse(group.id)} className="rounded p-0.5 text-gray-500 hover:text-white" title={collapsed ? "Expand" : "Collapse"}>
          <ChevronDown size={16} className={`transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {group.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.iconUrl} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />
          ) : null}
          <h3 className="truncate text-sm font-bold text-white" title={groupName(group)}>{groupName(group)}</h3>
          {group.iconKey && !group.iconUrl && <span className="shrink-0 rounded bg-gray-700/40 px-1.5 py-0.5 text-[9px] text-gray-400">{group.iconKey}</span>}
          <span className="shrink-0 text-[11px] text-gray-600">{group.items.length} items</span>
        </div>
        <Switch checked={group.enabled} onCheckedChange={(v) => onToggleGroup(group, v)} className="scale-[0.7] origin-right data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700" />
        <button onClick={() => onAddItem(group.id)} className="flex items-center gap-1 rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-300 hover:border-[#B93DEB] hover:text-[#B93DEB]" title="Add item"><Plus size={12} />Item</button>
        <button onClick={() => onEditGroup(group)} className="rounded border border-gray-700 p-1 text-gray-400 opacity-0 transition-opacity hover:border-[#B93DEB] hover:text-[#B93DEB] group-hover/grp:opacity-100" title="Edit name"><Pencil size={12} /></button>
        <button onClick={() => onDeleteGroup(group)} className="rounded border border-gray-700 p-1 text-gray-400 opacity-0 transition-opacity hover:border-red-500 hover:text-red-400 group-hover/grp:opacity-100" title="Delete menu"><Trash2 size={12} /></button>
      </div>

      {/* Items (droppable + sortable) */}
      {!collapsed && (
        <div className="min-h-[44px] rounded-lg bg-[#0f1420]/40 p-2">
          <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-1.5">
              {group.items.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-gray-600">Drop items here</p>
              ) : (
                group.items.map((it) => (
                  <SortableItemRow key={it.id} item={it} onEdit={onEditItem} onDelete={onDeleteItem} onToggle={onToggleItem} />
                ))
              )}
            </div>
          </SortableContext>
        </div>
      )}
    </div>
  );
}

export default function SidebarMenuManager() {
  const [groups, setGroups] = useState<SidebarMenuGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [modal, setModal] = useState<
    | { mode: "group"; group?: SidebarMenuGroup | null }
    | { mode: "item"; groupId?: string; item?: SidebarMenuItem | null }
    | null
  >(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await getSidebarTree());
      setDirty(false);
    } catch {
      toast.error("Failed to load sidebar menus");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isGroupId = (id: string) => groups.some((g) => g.id === id);
  const containerOf = (id: string): string | undefined => {
    if (isGroupId(id)) return id;
    return groups.find((g) => g.items.some((it) => it.id === id))?.id;
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  // Live-move an item to a new menu while hovering over it.
  const handleDragOver = (e: DragOverEvent) => {
    const activeId = String(e.active.id);
    if (isGroupId(activeId)) return; // group drags reorder on end only
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = containerOf(activeId);
    const to = containerOf(overId);
    if (!from || !to || from === to) return;

    setGroups((prev) => {
      const fromG = prev.find((g) => g.id === from);
      const toG = prev.find((g) => g.id === to);
      if (!fromG || !toG) return prev;
      const moved = fromG.items.find((it) => it.id === activeId);
      if (!moved) return prev;
      const overIdx = toG.items.findIndex((it) => it.id === overId);
      const insertAt = overId === to ? toG.items.length : overIdx < 0 ? toG.items.length : overIdx;
      return prev.map((g) => {
        if (g.id === from) return { ...g, items: g.items.filter((it) => it.id !== activeId) };
        if (g.id === to) {
          const next = [...g.items];
          next.splice(insertAt, 0, { ...moved, groupId: to });
          return { ...g, items: next };
        }
        return g;
      });
    });
    setDirty(true);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    setActiveId(null);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;

    if (isGroupId(activeId)) {
      // Reorder whole menus.
      const overGroupId = isGroupId(overId) ? overId : containerOf(overId);
      if (!overGroupId || overGroupId === activeId) return;
      setGroups((prev) => {
        const from = prev.findIndex((g) => g.id === activeId);
        const to = prev.findIndex((g) => g.id === overGroupId);
        if (from < 0 || to < 0) return prev;
        return arrayMove(prev, from, to);
      });
      setDirty(true);
      return;
    }

    // Item dropped within the same menu → reorder.
    const from = containerOf(activeId);
    const to = containerOf(overId);
    if (from && to && from === to && activeId !== overId) {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== from) return g;
          const oldIndex = g.items.findIndex((i) => i.id === activeId);
          const newIndex = g.items.findIndex((i) => i.id === overId);
          if (oldIndex < 0 || newIndex < 0) return g;
          return { ...g, items: arrayMove(g.items, oldIndex, newIndex) };
        }),
      );
      setDirty(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await reorderSidebar(groups.map((g) => ({ id: g.id, items: g.items.map((i) => i.id) })));
      toast.success("Menu order saved");
      await load(); // reflects auto-removal of any emptied menus
    } catch {
      toast.error("Failed to save menu order");
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = async (g: SidebarMenuGroup, v: boolean) => {
    setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, enabled: v } : x)));
    try { await updateSidebarGroup(g.id, { enabled: v }); }
    catch { toast.error("Failed to update menu"); setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, enabled: !v } : x))); }
  };

  const toggleItem = async (it: SidebarMenuItem, v: boolean) => {
    setGroups((prev) => prev.map((g) => ({ ...g, items: g.items.map((x) => (x.id === it.id ? { ...x, enabled: v } : x)) })));
    try { await updateSidebarItem(it.id, { enabled: v }); }
    catch { toast.error("Failed to update item"); load(); }
  };

  const removeGroup = async (g: SidebarMenuGroup) => {
    if (!window.confirm(`Delete menu "${groupName(g)}" and its ${g.items.length} item(s)?`)) return;
    try { await deleteSidebarGroup(g.id); toast.success("Menu deleted"); load(); }
    catch { toast.error("Failed to delete menu"); }
  };

  const removeItem = async (it: SidebarMenuItem) => {
    if (!window.confirm(`Remove "${itemName(it)}" from the sidebar?`)) return;
    try { await deleteSidebarItem(it.id); toast.success("Item removed"); load(); }
    catch { toast.error("Failed to remove item"); }
  };

  const overlayGroup = activeId ? groups.find((g) => g.id === activeId) : null;
  const overlayItem = activeId
    ? groups.flatMap((g) => g.items).find((it) => it.id === activeId)
    : null;

  return (
    <div className="w-full rounded-xl border border-gray-800/50 bg-[#191D24] p-3 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-white">Menu Management</h2>
          <p className="text-[11px] text-gray-500">
            Drag whole menus to reorder them, drag items within a menu, or drag an item across menus. Create new menus
            or items, then Save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModal({ mode: "group", group: null })} className="flex items-center gap-1.5 rounded-lg border border-[#B93DEB]/40 bg-[#B93DEB]/10 px-3 py-2 text-sm font-semibold text-[#B93DEB] hover:bg-[#B93DEB]/20"><Plus size={14} />New Menu</button>
          <button onClick={load} disabled={!dirty || saving} className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white disabled:opacity-40" title="Discard order changes"><RotateCcw size={14} />Reset</button>
          <button onClick={handleSave} disabled={!dirty || saving} className="flex items-center gap-1.5 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a32cd4] disabled:opacity-40"><Save size={14} />{saving ? "Saving…" : "Save Menu Order"}</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Loading menus…</div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-800 py-12 text-center text-sm text-gray-400">No menus configured</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {groups.map((g) => (
                <SortableGroup
                  key={g.id}
                  group={g}
                  collapsed={!!collapsed[g.id]}
                  onToggleCollapse={(id) => setCollapsed((p) => ({ ...p, [id]: !p[id] }))}
                  onEditGroup={(grp) => setModal({ mode: "group", group: grp })}
                  onDeleteGroup={removeGroup}
                  onToggleGroup={toggleGroup}
                  onAddItem={(groupId) => setModal({ mode: "item", groupId, item: null })}
                  onEditItem={(it) => setModal({ mode: "item", item: it })}
                  onDeleteItem={removeItem}
                  onToggleItem={toggleItem}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {overlayGroup ? (
              <div className="rounded-xl border-2 border-[#B93DEB] bg-[#15181E] px-3 py-2 text-sm font-bold text-white shadow-xl">{groupName(overlayGroup)}</div>
            ) : overlayItem ? (
              <div className="rounded-lg border-2 border-[#B93DEB] bg-[#1a2030] px-2.5 py-2 text-sm text-white shadow-xl">{itemName(overlayItem)}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {modal && (
        <MenuFormModal
          open
          mode={modal.mode}
          groupId={modal.mode === "item" ? modal.groupId : undefined}
          group={modal.mode === "group" ? modal.group : undefined}
          item={modal.mode === "item" ? modal.item : undefined}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
