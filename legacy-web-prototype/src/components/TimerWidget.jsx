import { Clock3 } from "lucide-react";
import { formatRemaining } from "../lib/time.js";

export default function TimerWidget({ parkingTimer, onOpen }) {
  if (!parkingTimer.timer) return null;

  const percentage = Math.round(parkingTimer.progress * 100);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-white/45 bg-white/92 p-3 text-left shadow-panel backdrop-blur-xl transition hover:scale-[1.01] active:scale-[0.98] dark:border-white/10 dark:bg-slate-950/86"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <Clock3 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Parking timer</div>
          <div className="text-2xl font-black tabular-nums text-slate-950 dark:text-white">
            {formatRemaining(parkingTimer.remainingMs)}
          </div>
        </div>
      </div>
      <div className="h-12 w-12 shrink-0 rounded-full border-[5px] border-emerald-500/25 p-1">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ opacity: Math.max(0.28, percentage / 100) }}
        />
      </div>
    </button>
  );
}
