import { Loader2, MapPinned, Plus } from "lucide-react";

export default function FloatingActionButton({ cooldownLabel, disabled, locating, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="pointer-events-auto flex min-h-16 min-w-[9.5rem] items-center justify-center gap-3 rounded-full bg-emerald-500 px-5 text-base font-black text-white shadow-2xl shadow-emerald-950/30 transition duration-200 ease-out hover:bg-emerald-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none dark:shadow-black/40"
      aria-label="Report a parking signal"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/18">
        {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
      </span>
      <span className="grid text-left leading-tight">
        <span>Free Spot</span>
        <span className="flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-normal text-emerald-50/90">
          <MapPinned className="h-3 w-3" />
          {cooldownLabel}
        </span>
      </span>
    </button>
  );
}
