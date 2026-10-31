"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Auto-scroll a horizontally scrolling container while a native HTML5 drag
 * hovers near either end.
 *
 * The browser scrolls the PAGE during a drag but not an `overflow-x` container,
 * so in a long strip the only reachable drop targets are the cards already on
 * screen. Dragging the last card to the front is then impossible: you reach the
 * left edge and the strip never moves. This nudges it each frame while the
 * pointer sits in the edge zone, so the drag can travel the whole list.
 *
 * Wire it to the SCROLLING element, not the cards:
 *
 *   const strip = useDragAutoScroll();
 *   <div ref={strip.ref} onDragOver={strip.onDragOver} onDrop={strip.stop}
 *        onDragLeave={strip.stop} className="overflow-x-auto">
 *
 * The cards keep their own drag handlers; `dragover` bubbles, so the container
 * sees every move without them having to cooperate.
 *
 * `reveal(id)` scrolls a card back into view after a drop has reordered the
 * strip — otherwise a card dragged to the front lands off-screen behind you.
 * Tag each card with `data-drag-id` for it to find them.
 */

/** How close to an edge (px) the pointer must be for the strip to move. */
const EDGE_ZONE_PX = 80;
/** Pixels scrolled per animation frame — roughly 900px/s at 60fps. */
const SPEED_PX_PER_FRAME = 15;

export function useDragAutoScroll<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T | null>(null);
    const directionRef = useRef(0);
    const frameRef = useRef<number | null>(null);

    const stop = useCallback(() => {
        directionRef.current = 0;
        if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => {
        // Without this the container is not a valid drop target and the drag
        // reads as "not allowed" over the gaps between cards.
        e.preventDefault();

        const el = ref.current;
        if (!el) return;
        const { left, right } = el.getBoundingClientRect();

        // Direction lives in a ref so sweeping from one edge to the other
        // reverses an already-running loop instead of being ignored.
        if (e.clientX < left + EDGE_ZONE_PX) directionRef.current = -1;
        else if (e.clientX > right - EDGE_ZONE_PX) directionRef.current = 1;
        else directionRef.current = 0;

        if (directionRef.current === 0 || frameRef.current !== null) return;

        // A function declaration, so the loop can schedule itself without the
        // binding being read before it exists.
        function step() {
            const node = ref.current;
            if (!node || directionRef.current === 0) {
                frameRef.current = null;
                return;
            }
            node.scrollLeft += directionRef.current * SPEED_PX_PER_FRAME;
            frameRef.current = requestAnimationFrame(step);
        }
        frameRef.current = requestAnimationFrame(step);
    }, []);

    /**
     * Bring the card tagged `data-drag-id={id}` back into view. Call it after a
     * drop: the strip is still scrolled where the drag ended, so a card moved to
     * the front would otherwise be off-screen to the left.
     */
    const reveal = useCallback((id: string) => {
        // The list re-renders after the drop, so wait a frame for the card to
        // land in its new slot before scrolling to it.
        requestAnimationFrame(() => {
            const el = ref.current?.querySelector<HTMLElement>(
                `[data-drag-id="${CSS.escape(id)}"]`,
            );
            // `block: nearest` keeps this from scrolling the modal vertically too.
            el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        });
    }, []);

    // A drag can end anywhere — outside the window, on Escape — and each of those
    // skips the container's own handlers, leaving the loop running.
    useEffect(() => {
        window.addEventListener("dragend", stop);
        window.addEventListener("drop", stop);
        return () => {
            window.removeEventListener("dragend", stop);
            window.removeEventListener("drop", stop);
            stop();
        };
    }, [stop]);

    return { ref, onDragOver, stop, reveal };
}
