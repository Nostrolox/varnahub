import { useRef, useState } from "react";
import { Activity } from "lucide-react";

const snapRatios = {
  full: 0,
  mid: 0.42,
  peek: 0.72,
};

function nearestSnap(offset, height) {
  return Object.entries(snapRatios).reduce(
    (nearest, [snap, ratio]) => {
      const snapOffset = height * ratio;
      const distance = Math.abs(offset - snapOffset);
      return distance < nearest.distance ? { snap, distance } : nearest;
    },
    { snap: "peek", distance: Number.POSITIVE_INFINITY },
  ).snap;
}

export default function DraggableBottomSheet({ children, loading, reportsCount, signalsCount }) {
  const sheetRef = useRef(null);
  const dragRef = useRef(null);
  const [snap, setSnap] = useState("peek");
  const [dragOffset, setDragOffset] = useState(null);

  const startDrag = (event) => {
    const height = sheetRef.current?.offsetHeight || 1;
    const startOffset = height * snapRatios[snap];
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset,
      currentOffset: startOffset,
      height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextOffset = Math.max(0, Math.min(drag.height * snapRatios.peek, drag.startOffset + event.clientY - drag.startY));
    drag.currentOffset = nextOffset;
    setDragOffset(nextOffset);
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const finalOffset = drag.currentOffset ?? dragOffset ?? drag.startOffset;
    setSnap(nearestSnap(finalOffset, drag.height));
    setDragOffset(null);
    dragRef.current = null;
  };

  const transformOffset = dragOffset ?? `calc(${snapRatios[snap] * 100}%)`;

  const translateValue = typeof transformOffset === "number" ? `${transformOffset}px` : transformOffset;

  return (
    <section
      ref={sheetRef}
      className="premium-sheet pointer-events-auto absolute inset-x-0 bottom-[5.7rem] max-h-[72dvh] rounded-t-[2rem] border border-white/45 bg-white/90 shadow-2xl shadow-slate-950/20 backdrop-blur-2xl transition-transform duration-[260ms] ease-out dark:border-white/10 dark:bg-slate-950/88 dark:shadow-black/40 sm:bottom-auto sm:left-5 sm:right-auto sm:top-[12rem] sm:h-auto sm:max-h-[calc(100dvh-14rem)] sm:w-[23rem] sm:rounded-[1.75rem]"
      style={{ "--sheet-y": translateValue }}
    >
      <div
        className="sheet-handle touch-none px-5 pb-2 pt-3 sm:hidden"
        onPointerCancel={endDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 dark:bg-white/20" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-normal text-slate-500 dark:text-slate-400">
              Live controls
            </div>
            <div className="mt-1 text-xl font-black text-slate-950 dark:text-white">{signalsCount} chance areas</div>
          </div>
          <div className="flex min-h-11 items-center gap-2 rounded-2xl bg-slate-100 px-3 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">
            <Activity className={`h-4 w-4 ${loading ? "animate-pulse text-amber-500" : "text-emerald-500"}`} />
            {reportsCount} reports
          </div>
        </div>
      </div>

      <div className="max-h-[calc(72dvh-5.5rem)] overflow-y-auto px-4 pb-5 sm:max-h-none sm:px-4 sm:pb-4">
        {children}
      </div>
    </section>
  );
}
