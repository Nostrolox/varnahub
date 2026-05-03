import { Bell, Database, MapPinned, MessageSquareText, ShieldCheck, Smartphone } from "lucide-react";

export default function ProfilePanel({ appConfig, user }) {
  const cards = [
    {
      icon: MapPinned,
      label: "Map data",
      value: "Crowdsourced probability",
    },
    {
      icon: Bell,
      label: "Notifications",
      value: "Timer reminder ready",
    },
    {
      icon: MessageSquareText,
      label: "SMS parking",
      value: appConfig?.blueZoneSmsNumber ? `${appConfig.blueZoneCode} to ${appConfig.blueZoneSmsNumber}` : "Configure before release",
    },
    {
      icon: Database,
      label: "Storage",
      value: "MongoDB or local fallback",
    },
    {
      icon: Smartphone,
      label: "Android",
      value: "Capacitor shell prepared",
    },
  ];

  return (
    <section className="animate-slide-up rounded-[1.8rem] border border-white/45 bg-white/94 p-5 shadow-panel backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-normal text-slate-500 dark:text-slate-400">Profile</div>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{user?.label || "Anonymous"}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            Reports are rate-limited and converted into approximate chance areas.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
          <ShieldCheck className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <Icon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <div className="mt-3 text-xs font-black uppercase text-slate-500 dark:text-slate-400">{card.label}</div>
              <div className="mt-1 text-sm font-black text-slate-900 dark:text-white">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-sm font-semibold leading-6 text-white dark:bg-white dark:text-slate-950">
        Updates every {appConfig?.updateIntervalSeconds || 5}s. Signals expire after{" "}
        {Math.round((appConfig?.spotTtlSeconds || 600) / 60)} minutes.
      </div>
    </section>
  );
}
