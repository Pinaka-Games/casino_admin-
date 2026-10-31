"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Layers, Loader2, PanelLeft } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getAdminCollections,
  deleteCollection,
  type GameCollection,
} from "@/api/games/collections";
import CollectionModal from "../../../game/game-listing/components/CollectionModal";

/**
 * The "Categories" tab — the single place to create, edit and delete categories.
 * (The Home Page Layout tab only shows them for reordering/visibility.)
 */
export default function CategoriesManager() {
  const [categories, setCategories] = useState<GameCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GameCollection | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await getAdminCollections());
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: GameCollection) => { setEditing(c); setModalOpen(true); };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteCollection(id);
      toast.success("Category deleted");
      setConfirmDeleteId(null);
      await load();
    } catch {
      toast.error("Failed to delete category");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full rounded-xl border border-gray-800/50 bg-[#191D24] p-3 md:p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#B93DEB]/10 text-[#B93DEB]">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">Categories</h2>
            <p className="text-[11px] text-gray-500">
              Create, edit &amp; delete categories here. Order &amp; visibility are set in the Home Page Layout tab.
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#a32cd4]"
        >
          <Plus size={16} />
          Create Category
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Loading categories…
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-800 py-12 text-center text-sm text-gray-400">
          No categories added yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((c) => {
            const count = c.gameCount ?? c.gameIds?.length ?? 0;
            return (
              <div
                key={c.id}
                className="group/cat flex flex-wrap items-start gap-2 rounded-lg border border-gray-800/60 bg-[#15181E] px-3 py-2.5 transition-colors hover:border-gray-700 sm:flex-nowrap sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-2 gap-y-1 sm:basis-auto sm:flex-nowrap">
                  <h3 className="truncate text-sm font-semibold text-white" title={c.name}>{c.name}</h3>
                  {/* What Spanish players see — blank here means the name has no
                      translation yet and would show in English on the /es site. */}
                  {c.translations?.es && (
                    <span
                      className="shrink-0 truncate text-[11px] text-gray-500"
                      title={`Spanish: ${c.translations.es}`}
                    >
                      · ES: {c.translations.es}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-gray-500">{count} game{count === 1 ? "" : "s"}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    c.enabled ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-600/20"
                  }`}>
                    {c.enabled ? "On home" : "Hidden"}
                  </span>
                  {c.showInSidebar && (
                    <span className="shrink-0 flex items-center gap-0.5 rounded bg-[#B93DEB]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B93DEB] border border-[#B93DEB]/20">
                      <PanelLeft size={9} />In sidebar
                    </span>
                  )}
                </div>

                {confirmDeleteId === c.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-gray-400">Delete?</span>
                    <button onClick={() => handleDelete(c.id)} disabled={busyId === c.id} className="rounded-md border border-red-600/40 bg-red-600/10 px-2 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-600/20">{busyId === c.id ? "…" : "Yes"}</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:text-white">No</button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => openEdit(c)} className="flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-[#B93DEB] hover:text-[#B93DEB]">
                      <Pencil size={11} />Edit
                    </button>
                    <button onClick={() => setConfirmDeleteId(c.id)} className="flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-red-500 hover:text-red-400">
                      <Trash2 size={11} />Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CollectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        collection={editing}
        onSaved={load}
      />
    </div>
  );
}
