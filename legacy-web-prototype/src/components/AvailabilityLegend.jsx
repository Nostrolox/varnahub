const items = [
  { label: "High chance", color: "bg-emerald-500" },
  { label: "Maybe", color: "bg-yellow-400" },
  { label: "Unlikely", color: "bg-red-500" },
  { label: "Paid zone", color: "bg-blue-500" },
];

export default function AvailabilityLegend({ demoActive = false }) {
  return (
    <section className="animate-fade-in rounded-2xl border border-white/30 bg-white/82 px-3 py-2 shadow-panel backdrop-blur-md dark:border-white/10 dark:bg-slate-950/72">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Availability</div>
        {demoActive ? (
          <div className="rounded-full bg-cyan-500/12 px-2 py-0.5 text-[0.65rem] font-black uppercase text-cyan-700 dark:text-cyan-200">
            Demo
          </div>
        ) : null}
      </div>
      <div className="mt-2 grid gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}
