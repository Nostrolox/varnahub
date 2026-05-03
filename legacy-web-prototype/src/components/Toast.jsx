import { X } from "lucide-react";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div className="pointer-events-auto fixed inset-x-3 top-[max(1rem,env(safe-area-inset-top))] z-[1100] mx-auto max-w-md rounded-2xl border border-white/45 bg-white/94 p-3 shadow-panel backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <div className="text-sm font-black text-slate-950 dark:text-white">{toast.title}</div>
          {toast.message ? <div className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{toast.message}</div> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
