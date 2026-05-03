import { Clock3, Map, UserRound } from "lucide-react";

const tabs = [
  { id: "map", label: "Map", icon: Map },
  { id: "timer", label: "Timer", icon: Clock3 },
  { id: "profile", label: "Profile", icon: UserRound },
];

export default function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="pointer-events-auto mx-auto max-w-md rounded-[1.6rem] border border-white/45 bg-white/92 p-1.5 shadow-panel backdrop-blur-xl transition duration-200 ease-out dark:border-white/10 dark:bg-slate-950/88">
      <div className="grid grid-cols-3 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] px-3 text-sm font-black transition duration-200 ease-out active:scale-[0.98] ${
                active
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15 dark:bg-white dark:text-slate-950"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
