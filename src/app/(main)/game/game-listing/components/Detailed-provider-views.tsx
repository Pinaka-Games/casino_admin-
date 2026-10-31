"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Search, Pencil, Check, X } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    arrayMove
} from "@dnd-kit/sortable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ExportCSV from "@/components/ExportCSV";
import Pagination from "@/components/Pagination";
import CreateEditGameModal, { GameFormData } from "./CreateEditGameModal";
import { toast } from "react-hot-toast";
import { Game, getAllAdminGames } from "@/api/games/games";

import SortableGameCard from "./SortableGameCard";
import { GameGridSkeleton } from "./GameSkeletons";

interface PageMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface Props {
    providerId: string | number;
    providerName: string;
    categoryOptions: string[];
    games: Game[];
    meta: PageMeta;
    loading: boolean;
    initialCategory?: string;
    /** Preloads the search box — used by the header search's deep link to a game. */
    initialSearch?: string;
    onBack: () => void;
    /** Triggers a server fetch for the given params */
    onFetch: (params: { category: string; search: string; page: number }) => void;
    onToggle: (
        providerId: string | number,
        categoryId: string | number,
        itemId: string | number,
        value: boolean
    ) => void;
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
    /**
     * Move ONE game to an absolute 1-based position within the section, resolved
     * server-side. This is how ordering works while the grid is filtered: the
     * client can only see the search matches, so it names a game and a
     * destination rather than submitting a whole new order.
     */
    onMove: (gameId: string, position: number, category?: string) => Promise<void>;
    /** Persist a whole page of reordered games in one bulk write (provider-wide). */
    onBulkReorder: (updates: { id: string; displayOrder: number }[]) => Promise<void>;
    /** Persist a single category section's order (per-category positions). */
    onSaveCategoryOrder: (
        category: string,
        updates: { gameId: string; position: number }[],
    ) => Promise<void>;
}

export default function DetailedProviderView({
    providerId,
    providerName,
    categoryOptions,
    games,
    meta,
    loading,
    initialCategory,
    initialSearch,
    onBack,
    onFetch,
    onToggle,
    onToggleFeatured,
    onToggleNew,
    onMove,
    onBulkReorder,
    onSaveCategoryOrder,
}: Props) {
    const [openGameModal, setOpenGameModal] = useState(false);
    const [editGame, setEditGame] = useState<GameFormData | null>(null);
    const [searchInput, setSearchInput] = useState(initialSearch ?? "");
    const [search, setSearch] = useState(initialSearch ?? "");
    const [currentPage, setCurrentPage] = useState(1);

    // The detailed view is scoped to the section the admin opened ("View All" on a
    // category); "all" (provider-level View All) keeps the provider-wide order.
    const [category] = useState<string>(
        initialCategory && initialCategory.trim() ? initialCategory : "all",
    );
    const isCategoryScoped = category.toLowerCase() !== "all";

    // Edit mode: reorder locally, persist all changes in one bulk save.
    const [isEditMode, setIsEditMode] = useState(false);
    const [localGames, setLocalGames] = useState<Game[]>(games);
    const [saving, setSaving] = useState(false);
    /** gameId → absolute destination, queued while the grid is filtered. */
    const [pendingMoves, setPendingMoves] = useState<Map<string, number>>(new Map());
    /** The same numbers, shown on the cards before they are saved. */
    const [movedPositions, setMovedPositions] = useState<Map<string, number>>(new Map());

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Debounce the search box so typing doesn't spam the server.
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Reset to page 1 whenever the search or category changes.
    useEffect(() => {
        setCurrentPage(1);
    }, [search, category]);

    // Drive server fetches from the controlled params. The list is scoped to the
    // selected category so each section's order is edited independently (or "all"
    // for the legacy provider-wide order).
    useEffect(() => {
        onFetch({ category, search, page: currentPage });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, currentPage, providerId, category]);

    const isSearching = search.trim().length > 0;

    // Keep the working copy in sync with fresh server data, but never clobber an
    // in-progress edit. A filtered edit is the exception: it moves games by
    // absolute position and never touches this copy, so it stays fresh — which is
    // what makes clearing the search mid-edit hand back a list that can be dragged.
    useEffect(() => {
        if (!isEditMode || isSearching) setLocalGames(games);
    }, [games, isEditMode, isSearching]);

    const pageOffset = (meta.page - 1) * meta.limit;
    // The local copy only exists to preview a drag, which filtering rules out.
    const displayGames = isEditMode && !isSearching ? localGames : games;

    /**
     * The number on a card.
     *
     * Normally that is the row number — the list is the section in order, so they
     * agree. Under a search they don't: the sixth game becomes the first result,
     * and labelling it "#1" claims a position it does not have. So while filtering
     * we show the position the section actually holds it at, or the destination
     * just typed for it, falling back to the row number if neither is known.
     */
    const badgeIndex = (game: Game, rowIndex: number): number => {
        const rowNumber = pageOffset + rowIndex + 1;
        if (!isSearching) return rowNumber;
        const moved = movedPositions.get(game.id);
        if (moved) return moved;
        return game.sectionPosition && game.sectionPosition > 0
            ? game.sectionPosition
            : rowNumber;
    };

    const enterEditMode = () => {
        setLocalGames(games);
        setPendingMoves(new Map());
        setMovedPositions(new Map());
        setIsEditMode(true);
    };

    const cancelEdit = () => {
        setLocalGames(games);
        setPendingMoves(new Map());
        setMovedPositions(new Map());
        setIsEditMode(false);
    };

    // Drag drops a game onto another — locally swap it into that slot. Nothing is
    // persisted until Save. Filtered, the cards in between are hidden, so there is
    // no meaningful slot to drop into: the number field is the way to move a game
    // then (see handleSetIndex).
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || isSearching) return;

        setLocalGames((prev) => {
            const from = prev.findIndex((g) => g.id === active.id);
            const to = prev.findIndex((g) => g.id === over.id);
            if (from === -1 || to === -1) return prev;
            return arrayMove(prev, from, to);
        });
    };

    // Type a position number to move a game there.
    //
    // Unfiltered, the grid IS the order, so this is a local splice previewed
    // until Save. Filtered, it cannot be: the rows in between are hidden, so
    // splicing them would be meaningless and saving would renumber only the
    // matches. There the number is an ABSOLUTE destination in the whole section,
    // queued and applied one game at a time on Save.
    const handleSetIndex = (gameId: string, position: number) => {
        if (isSearching) {
            setPendingMoves((prev) => {
                const next = new Map(prev);
                next.set(gameId, position);
                return next;
            });
            // Preview the typed number on the card straight away.
            setMovedPositions((prev) => {
                const next = new Map(prev);
                next.set(gameId, position);
                return next;
            });
            return;
        }
        setLocalGames((prev) => {
            const from = prev.findIndex((g) => g.id === gameId);
            if (from === -1) return prev;
            const to = Math.max(0, Math.min(prev.length - 1, position - pageOffset - 1));
            if (to === from) return prev;
            return arrayMove(prev, from, to);
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isSearching) {
                // Filtered: apply the queued absolute moves one at a time. Each
                // renumbers the whole section server-side, so they are applied in
                // sequence rather than in parallel.
                if (pendingMoves.size === 0) {
                    setIsEditMode(false);
                    return;
                }
                for (const [gameId, position] of pendingMoves) {
                    await onMove(gameId, position, isCategoryScoped ? category : undefined);
                }
                toast.success(
                    pendingMoves.size === 1
                        ? "Game moved"
                        : `${pendingMoves.size} games moved`,
                );
                setPendingMoves(new Map());
                setMovedPositions(new Map());
                setIsEditMode(false);
                onFetch({ category, search, page: currentPage });
                return;
            }
            if (isCategoryScoped) {
                // Save THIS category's order only — positions are per (game, category).
                const updates = localGames.map((g, i) => ({ gameId: g.id, position: pageOffset + i + 1 }));
                await onSaveCategoryOrder(category, updates);
            } else {
                // Legacy provider-wide order.
                const updates = localGames.map((g, i) => ({ id: g.id, displayOrder: pageOffset + i + 1 }));
                await onBulkReorder(updates);
            }
            toast.success("Game order saved");
            setIsEditMode(false);
            onFetch({ category, search, page: currentPage });
        } catch {
            toast.error("Failed to save game order");
        } finally {
            setSaving(false);
        }
    };

    const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
    const end = Math.min(meta.page * meta.limit, meta.total);

    return (
        <div className="flex flex-col h-full bg-[#15181E] text-white min-w-0">
            {/* ================= HEADER / NAVIGATION ================= */}
            <div className="shrink-0 flex items-center justify-between py-2 mb-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="text-gray-400 hover:text-purple-500 -ml-2"
                    >
                        <ArrowLeft size={18} className="mr-2 text-[#B93DEB]" />
                        Back to Providers
                    </Button>
                    <div className="h-4 w-[1px] bg-gray-800" />
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-bold tracking-tight capitalize">{providerName}</h1>
                        {/* Which section the admin is currently ordering. */}
                        <span className="px-2 py-0.5 bg-[#B93DEB] text-white text-[11px] font-bold rounded capitalize">
                            {isCategoryScoped ? category : "All Categories"}
                        </span>
                        <span className="px-2 py-0.5 bg-[#B93DEB]/20 text-[#B93DEB] text-[10px] font-bold rounded uppercase tracking-wider">
                            {meta.total} Games
                        </span>
                        <div className="h-1 w-1 rounded-full bg-gray-700" />
                        <span className="text-[10px] font-medium text-gray-500">
                            {categoryOptions.length} Categories
                        </span>
                    </div>
                </div>
            </div>

            {/* ================= ACTION BAR ================= */}
            <div className="bg-[#191D24] px-4 py-2 rounded-t-xl border border-gray-800/50 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#B93DEB] transition-colors" size={16} />
                        {/* Deliberately usable in edit mode: finding one game by
                            name and typing its new position is the fastest way to
                            move it, and the move is absolute so it does not depend
                            on what the search happens to be showing. */}
                        <Input
                            placeholder="Search games..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="bg-[#1a2030] border-gray-800 pl-10 focus-visible:ring-[#B93DEB] h-10 text-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                    {isEditMode ? (
                        <>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-[#B93DEB] hover:bg-[#a32cd4] text-white"
                            >
                                <Check className="w-4 h-4 mr-1.5" />
                                {saving ? "Saving…" : "Save order"}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="border-gray-700 bg-[#1a2030] text-gray-300 hover:text-white"
                            >
                                <X className="w-4 h-4 mr-1.5" />
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <Button
                            size="sm"
                            onClick={enterEditMode}
                            disabled={loading || games.length === 0}
                            title={
                                isSearching
                                    ? "Type a new position on any card to move it in the section"
                                    : "Rearrange the games in this section"
                            }
                            className="bg-[#B93DEB] hover:bg-[#a32cd4] text-white"
                        >
                            <Pencil className="w-4 h-4 mr-1.5" />
                            Edit order
                        </Button>
                    )}
                    <ExportCSV
                        data={games}
                        fileName={`games_${providerName}.csv`}
                        headers={["Name", "Provider", "Category", "Status"]}
                        mapRow={(g: Game) => [
                            g.name,
                            providerName,
                            g.category,
                            g.enabled ? "Active" : "Inactive",
                        ]}
                        fetchAll={async () => {
                            // Server-paginated: pull every matching game (not just the
                            // current page) reusing the same category/search scope the
                            // parent's onFetch applies. Games carry no date, so the
                            // range is not used here.
                            const all = await getAllAdminGames(
                                {
                                    category: isCategoryScoped ? category : undefined,
                                    search: search.trim() || undefined,
                                },
                                60000,
                            );
                            if (String(providerId) === "all") return all;
                            return all.filter(
                                (g) =>
                                    g.provider === String(providerId) ||
                                    g.studio === String(providerId),
                            );
                        }}
                    />
                </div>
            </div>

            {/* ================= SORTABLE VERTICAL GRID ================= */}
            <div className="flex-1 overflow-y-auto px-6 py-8 bg-[#15181E]/40 border-x border-gray-800/50 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                {loading ? (
                    <GameGridSkeleton count={18} />
                ) : displayGames.length > 0 ? (
                    <>
                        <p className="mb-4 text-[11px] text-gray-500">
                            {isEditMode ? (
                                isSearching ? (
                                    <>
                                        <span className="text-[#B93DEB] font-medium">Editing order</span> — type a position
                                        on any card to move it there in the{" "}
                                        {isCategoryScoped ? (
                                            <span className="text-gray-300 capitalize">{category}</span>
                                        ) : (
                                            <>provider&apos;s</>
                                        )}{" "}
                                        full list. Dragging needs the unfiltered list, since the cards in between are
                                        hidden. Press <span className="text-gray-300">Save order</span> to apply.
                                    </>
                                ) : (
                                    <>
                                        <span className="text-[#B93DEB] font-medium">Editing order</span> — drag the{" "}
                                        <span className="text-gray-300">⠿</span> handle onto another game or type a position on
                                        any card. Changes preview live and only persist when you press{" "}
                                        <span className="text-gray-300">Save order</span>.
                                    </>
                                )
                            ) : (
                                <>
                                    The <span className="text-gray-300">#position</span> on each card is the order players
                                    see {isCategoryScoped ? (
                                        <>in the <span className="text-gray-300 capitalize">{category}</span> section</>
                                    ) : (
                                        <>for this provider</>
                                    )}.{" "}
                                    {isSearching ? (
                                        <>
                                            Each card keeps its real position while you search. Press{" "}
                                            <span className="text-gray-300">Edit order</span> to type a new one.
                                        </>
                                    ) : (
                                        <>
                                            Press <span className="text-gray-300">Edit order</span> to rearrange them.
                                            {isCategoryScoped && " Each section is ordered independently."}
                                        </>
                                    )}
                                </>
                            )}
                        </p>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={displayGames.map((g) => g.id)} strategy={rectSortingStrategy}>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                    {displayGames.map((g, i) => (
                                        <SortableGameCard
                                            key={g.id}
                                            game={g}
                                            index={badgeIndex(g, i)}
                                            providerId={providerId}
                                            editing={isEditMode}
                                            onToggle={onToggle}
                                            onToggleFeatured={onToggleFeatured}
                                            onToggleNew={onToggleNew}
                                            onSetIndex={handleSetIndex}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                        <Search size={48} className="mb-4 opacity-10" />
                        <p className="text-sm">No games found matching your search.</p>
                    </div>
                )}
            </div>

            {/* ================= FOOTER / PAGINATION ================= */}
            {/* Same stacking as the All Games footer: on a phone the count and
                the pager cannot share a row without one of them being clipped. */}
            <div className="shrink-0 bg-[#15181E] px-3 py-3 border border-gray-800/50 rounded-b-xl flex flex-col items-center gap-2 sm:flex-row sm:justify-between sm:px-6 sm:py-4">
                <div className="text-[11px] text-gray-500 font-medium whitespace-nowrap">
                    <span className="hidden sm:inline">Showing </span>
                    <span className="text-gray-300">{start}</span>
                    <span className="hidden sm:inline"> to </span>
                    <span className="sm:hidden">–</span>
                    <span className="text-gray-300">{end}</span> of <span className="text-gray-300">{meta.total}</span>
                    <span className="hidden sm:inline"> games</span>
                </div>
                {meta.totalPages > 1 && (
                    // A drag-based edit is scoped to the page being previewed, so
                    // paging away would lose it. A filtered edit keeps its moves
                    // against game ids, so paging through results is safe.
                    isEditMode && !isSearching ? (
                        <span className="text-[11px] text-amber-400/80">
                            Save or cancel to change pages
                        </span>
                    ) : (
                        <Pagination
                            currentPage={meta.page}
                            totalPages={meta.totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )
                )}
            </div>

            {/* ================= CREATE / EDIT MODAL ================= */}
            <CreateEditGameModal
                open={openGameModal}
                onClose={() => setOpenGameModal(false)}
                onSubmit={() => {
                    setOpenGameModal(true);
                    onFetch({ category, search, page: currentPage });
                }}
                initialData={editGame}
            />
        </div>
    );
}
