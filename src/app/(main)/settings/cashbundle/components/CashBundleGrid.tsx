"use client";

import { useEffect, useState } from "react";
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
import { Clock, AlertTriangle, GripVertical, Sparkles, Disc3, User, UserPlus } from "lucide-react";
import { CashBundle } from "@/types/cashbundletypes";
import { coingreen, deleteicon, edit } from "@/assets/icons";
import { CASH_BUNDLE_FALLBACK_IMAGE } from "@/config/cashbundle-image-presets";
import { formatDiscountDuration, getSaleWindowStatus } from "@/lib/discount-window";
import { Switch } from "@/components/ui/switch";

interface Props {
  data: CashBundle[];
  onEdit: (item: CashBundle) => void;
  onDelete: (item: CashBundle) => void;
  /** Receives the full list in its new sequence. */
  onReorder: (ordered: CashBundle[]) => void;
  onToggleActive: (item: CashBundle, isActive: boolean) => void;
}

interface CardProps {
  item: CashBundle;
  /** 1-based position shown on the card. */
  position: number;
  now: number;
  onEdit: (item: CashBundle) => void;
  onDelete: (item: CashBundle) => void;
  onToggleActive: (item: CashBundle, isActive: boolean) => void;
}

function SortableBundleCard({ item, position, now, onEdit, onDelete, onToggleActive }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  // Mirror the sale maths used on the user side so the admin sees the same
  // "% OFF" tag the players get.
  const price = Number(item.price) || 0;
  const dValue = Number(item.discountValue) || 0;
  const hasDiscount = !!item.discountEnabled && !!item.discountType && dValue > 0;
  const rawOff = item.discountType === "percentage" ? (price * dValue) / 100 : dValue;
  const discount = Math.min(rawOff, price);
  const percentOff = price > 0 ? Math.round((discount / price) * 100) : 0;
  const badge = item.discountType === "flat" ? `$${discount.toFixed(2)} OFF` : `${percentOff}% OFF`;
  const showTag = hasDiscount && discount > 0;
  // Sale window for launch-active users: startedAt + duration. Ticks live.
  const sale = getSaleWindowStatus(item, now);
  // New users never inherit the campaign clock, so they get a length, not a date.
  const newUserWindow = formatDiscountDuration(
    item.discountDurationValue,
    item.discountDurationUnit,
  );
  const isActive = item.isActive !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex h-full flex-col bg-[#11161C] rounded-2xl overflow-hidden ${
        isActive ? "" : "ring-1 ring-inset ring-white/10"
      }`}
    >
      {/* Inactive bundles are hidden from the store. Dim the body so the state
          is obvious from across the grid — the switch alone is small. */}
      {!isActive && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-[#11161C]/55" />
      )}
      {!isActive && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
          Inactive
        </span>
      )}
      {/* ───────── DISCOUNT TAG (yellow) — sits over the image area, clear of
          the header's edit button ───────── */}
      {showTag && (
        <div
          className="pointer-events-none absolute right-0 top-12 z-20 flex flex-col items-center justify-center rounded-l-lg px-2.5 py-1.5 text-[#3A2405] leading-none shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          style={{ background: "linear-gradient(135deg,#FBC409 0%,#FAEC4A 48%,#FAC308 100%)" }}
        >
          <span className="font-extrabold text-lg">{badge.replace(/\s*OFF$/i, "").replace(/\.00$/, "")}</span>
          <span className="font-bold text-[9px] tracking-wide mt-0.5">OFF</span>
        </div>
      )}

      {/* ───────── DRAG HANDLE ─────────
          Sits on the card's left edge, vertically centred, rather than in the
          header strip — the header is tight enough that the Wulf Cash figure
          was being truncated to make room for it.

          A handle rather than a draggable card: the card also carries edit and
          delete buttons, and dragging from anywhere would make those a
          coin-flip between "click" and "drag". */}
      <button
        type="button"
        aria-label={`Drag to reorder ${item.name}`}
        className="absolute left-1 top-1/2 z-20 -translate-y-1/2 cursor-grab touch-none rounded-md p-1 text-white/25 transition-colors hover:bg-white/5 hover:text-white active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>

      {/* ───────── HEADER STRIP ───────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-sm text-white min-w-0">
          {/* Position, so the sequence is readable without counting cards. */}
          <span className="shrink-0 text-xs font-bold text-white/40" title={`Position ${position}`}>
            #{position}
          </span>

          <Image src={coingreen} alt="cash" width={18} height={18} className="shrink-0" />
          {/* Wulf Cash granted, set independently of price — issued in full on
              sale (a discount cuts the cash collected, not what is issued).
              Bonus is shown only when set. */}
          <span className="truncate">
            {Number(item.wulfCashAmount ?? item.price).toFixed(2)} Wulf Cash
            {item.free > 0 && ` + ${item.free.toFixed(2)} Bonus`}
          </span>
        </div>

        <div className="relative z-20 flex shrink-0 items-center gap-3">
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => onToggleActive(item, checked)}
            aria-label={isActive ? "Deactivate bundle" : "Activate bundle"}
            title={isActive ? "Active — visible in store" : "Inactive — hidden from store"}
            className="data-[state=checked]:bg-[#AD46FF] data-[state=unchecked]:bg-white/20"
          />
          <button
            onClick={() => onEdit(item)}
            className="shrink-0 text-white hover:opacity-80"
          >
            <Image src={edit} alt="edit" width={14} height={14} />
          </button>
        </div>
      </div>

      {/* ───────── COIN IMAGE ───────── */}
      <div className="flex justify-center py-6">
        <Image
          src={item.image || CASH_BUNDLE_FALLBACK_IMAGE}
          alt="coins"
          width={100}
          height={100}
          priority
          unoptimized
        />
      </div>

      {/* ───────── COIN COUNT ───────── */}
      <h2 className="text-white text-3xl font-semibold text-center">
        {item.coins.toLocaleString()}
      </h2>
      <p className="text-gray-400 text-center text-sm mt-1">Wulf Coins</p>

      {/* ───────── CAPABILITY TAGS ─────────
          What this bundle carries beyond its price, mirroring what players
          actually see: the Welcome Offer takes over the login pop-up with its
          own design, and a wired free-spin template shows a spins badge on the
          store card. Both were invisible here, so an admin had to open the edit
          modal to find out which bundle was which.

          A wrapping flex row, and the whole block is skipped when neither
          applies — so a plain bundle's card keeps exactly the height it has
          now. */}
      {(item.isWelcomeOffer || !!item.freeSpinConfigId) && (
        <div className="mt-3 flex flex-wrap justify-center gap-2 px-4">
          {item.isWelcomeOffer && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B93DEB]/40 bg-[#B93DEB]/15 px-3 py-1 text-xs font-semibold text-[#DDA6F5]">
              <Sparkles size={13} />
              Welcome Offer
            </span>
          )}
          {!!item.freeSpinConfigId && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#04AD37]/40 bg-[#04AD37]/15 px-3 py-1 text-xs font-semibold text-[#5BE38A]">
              <Disc3 size={13} />
              Free spins
            </span>
          )}
        </div>
      )}

      {/* ───────── SALE WINDOW (time-boxed sales only) ─────────
          A timed sale runs on TWO clocks, so the card shows both — the single
          "Ends in …" pill used to read as a site-wide end date, which it never was:

            • Existing users (here at launch) count from the campaign start. When
              that runs out the bundle DISAPPEARS from their store — it does not
              drop back to full price. "Restart sale" is what brings it back.
            • New users start their own full window at signup, so for them the
              sale keeps running long after it ended for everyone else. There is
              no end date to show them, only the length. */}
      {sale.timeBoxed && sale.end && (
        <div className="mt-3 mx-4 rounded-lg border border-white/10 bg-white/3">
          {/* One quiet panel — colour lands only on the value, which is the part
              that changes.

              An ordinary bundle gets ONE row, because it has one clock: the sale
              ends for everybody at once and late signups never see it. Only the
              welcome offer gets the second row, since it re-anchors to each
              player's signup and so keeps running for new registrations. */}
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 ${
              sale.perUser && newUserWindow ? "border-b border-white/5" : ""
            }`}
          >
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-400">
              <User size={12} className="shrink-0" />
              {sale.perUser ? "Existing" : "Everyone"}
            </span>
            {sale.expired ? (
              <span
                className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-red-400 text-right whitespace-nowrap"
                title={
                  sale.perUser
                    ? "Over for players who were already registered when this welcome offer started — it is hidden from their store. New signups still get their own window."
                    : "The sale window is over: this bundle is hidden from every player, including anyone who registers now. Restart the sale to bring it back."
                }
              >
                <AlertTriangle size={11} className="shrink-0" />
                Hidden — expired
              </span>
            ) : (
              <span
                className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#FBC409] text-right whitespace-nowrap"
                title={
                  sale.perUser
                    ? "Time left for players who were already registered when this welcome offer started."
                    : "Time left on the sale. When it hits zero the bundle is hidden from every player — new signups included."
                }
              >
                <Clock size={11} className="shrink-0" />
                {sale.timeLeft} left
              </span>
            )}
          </div>
          {sale.perUser && newUserWindow && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5">
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-400">
                <UserPlus size={12} className="shrink-0" />
                New
              </span>
              <span
                className="text-[11px] font-semibold text-blue-400 text-right whitespace-nowrap"
                title={`Welcome offer: anyone who registers later starts their own ${newUserWindow} window from their signup date, so this keeps running for new players until you switch the discount off.`}
              >
                {newUserWindow} from signup
              </span>
            </div>
          )}
        </div>
      )}

      {/* ───────── FOOTER ─────────
          mt-auto pins it to the card's bottom edge: cards in a row stretch to the
          tallest one, and a sale panel on some cards but not others used to leave
          the Prize row floating at a different height on every card. */}
      <div className="relative justify-center items-center text-center mt-auto pt-6 px-5 pb-5">
        <div className="flex justify-between text-center items-center gap-2">
          <p className="text-gray-400 text-sm shrink-0">Prize</p>
          <p className="text-white text-2xl font-semibold whitespace-nowrap">
            {item.price} <span className="text-sm font-normal"></span>
          </p>
          <button onClick={() => onDelete(item)} className="shrink-0">
            <Image src={deleteicon} alt="delete" width={14} height={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CashBundleGrid({ data, onEdit, onDelete, onReorder, onToggleActive }: Props) {
  // Live clock so the per-card sale countdown ticks in real time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // `distance: 5` means a click is a click: the pointer must actually travel
  // before a drag starts, so the edit/delete buttons still work normally.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = data.findIndex((b) => b.id === active.id);
    const newIndex = data.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(data, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={data.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.map((item, index) => (
            <SortableBundleCard
              key={item.id}
              item={item}
              position={index + 1}
              now={now}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
