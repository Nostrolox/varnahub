import { Activity, Database, RadioTower } from "lucide-react";
import { relativeAge } from "../lib/time.js";

const confidenceCopy = {
  high: {
    label: "High chance",
    className: "bg-emerald-100 text-emerald-800",
  },
  medium: {
    label: "Maybe",
    className: "bg-yellow-100 text-yellow-800",
  },
  low: {
    label: "Unlikely",
    className: "bg-red-100 text-red-800",
  },
};

export default function SpotPanel({ demoActive = false, embedded = false, generatedAt, loading, reports, signals }) {
  const strongestSignals = signals.slice(0, 4);
  const sectionClass = embedded
    ? "p-1"
    : "animate-slide-up rounded-[1.45rem] border border-white/45 bg-white/94 p-4 shadow-panel backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88";

  return (
    <section className={sectionClass}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black uppercase text-slate-500 dark:text-slate-400">
            <Activity className="h-4 w-4 text-emerald-600" />
            Chance areas
          </div>
          <div className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{signals.length}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200">
          {loading ? <RadioTower className="h-5 w-5 animate-pulse" /> : <Database className="h-5 w-5" />}
        </div>
      </div>
      <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
        {demoActive
          ? `Demo preview - refreshed ${generatedAt ? relativeAge(generatedAt) : "now"}`
          : `${reports.length} live reports - updated ${generatedAt ? relativeAge(generatedAt) : "now"}`}
      </div>

      <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
        {strongestSignals.length ? (
          strongestSignals.map((signal) => {
            const confidence = confidenceCopy[signal.confidence] || confidenceCopy.low;

            return (
              <div key={signal.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
                <div>
                  <div className="text-sm font-black text-slate-800 dark:text-white">Parking chance area</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {signal.reportCount} {demoActive ? "preview" : "recent"} {signal.reportCount === 1 ? "report" : "reports"} - score{" "}
                    {signal.score}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`rounded-full px-2 py-1 text-xs font-black uppercase ${confidence.className}`}>
                    {confidence.label}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">{relativeAge(signal.newestReportAt)}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-6 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
            No active probability signals in the last 10 minutes.
          </div>
        )}
      </div>
    </section>
  );
}
