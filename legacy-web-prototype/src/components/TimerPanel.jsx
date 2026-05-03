import { Bell, Clock3, MessageSquareText, Plus, RotateCcw, Square, Timer, Play } from "lucide-react";
import { formatRemaining } from "../lib/time.js";

const presets = [30, 60, 90, 120];
const quickAdds = [15, 30];

export default function TimerPanel({ appConfig, carPlate, onCarPlateChange, onSendSms, parkingTimer }) {
  const active = Boolean(parkingTimer.timer);
  const percentage = Math.round(parkingTimer.progress * 100);
  const smsReady = Boolean(appConfig?.blueZoneSmsNumber && carPlate.trim());

  return (
    <section className="animate-slide-up rounded-[1.8rem] border border-white/45 bg-white/94 p-5 shadow-panel backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black uppercase text-slate-500 dark:text-slate-400">
            <Timer className="h-4 w-4" />
            Blue zone
          </div>
          <div className="mt-2 text-5xl font-black tabular-nums text-slate-950 dark:text-white">
            {active ? formatRemaining(parkingTimer.remainingMs) : "0:00"}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-200">
          <Bell className="h-4 w-4 text-amber-500" />
          {parkingTimer.notificationPermission === "granted" ? "Alerts on" : "Alerts ready"}
        </div>
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-400 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        {presets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => parkingTimer.startTimer(minutes)}
            className="h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-800 transition hover:border-cyan-400 hover:text-cyan-700 active:scale-[0.98] dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            {minutes}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 dark:text-slate-400">
          <MessageSquareText className="h-4 w-4 text-emerald-600" />
          SMS parking
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <label className="sr-only" htmlFor="car-plate">
            Car plate
          </label>
          <input
            id="car-plate"
            type="text"
            value={carPlate}
            onChange={(event) => onCarPlateChange(event.target.value.toUpperCase())}
            placeholder="ABC1234"
            inputMode="text"
            autoCapitalize="characters"
            className="h-14 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-base font-black uppercase text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          />
          <button
            type="button"
            onClick={onSendSms}
            disabled={!smsReady}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-white transition duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
          >
            <MessageSquareText className="h-4 w-4" />
            SMS
          </button>
        </div>
        <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          Draft: {(appConfig?.blueZoneCode || "ZONE").toUpperCase()} {carPlate || "ABC1234"}{" "}
          {appConfig?.blueZoneSmsNumber ? `to ${appConfig.blueZoneSmsNumber}` : "- number not configured"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={() => parkingTimer.startTimer(60)}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-950"
        >
          <Play className="h-4 w-4" />
          Start 60 min
        </button>
        <button
          type="button"
          onClick={parkingTimer.stopTimer}
          disabled={!active}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-red-300 hover:text-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          aria-label="Stop timer"
          title="Stop timer"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {quickAdds.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => parkingTimer.extendTimer(minutes)}
            disabled={!active}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-sm font-black text-emerald-800 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-emerald-400/15 dark:text-emerald-200"
          >
            <Plus className="h-4 w-4" />
            {minutes} min
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => parkingTimer.startTimer(60)}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-slate-500 transition hover:bg-slate-100 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-white/10"
      >
        <RotateCcw className="h-4 w-4" />
        Reset to 60 min
      </button>

      {active ? (
        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <Clock3 className="h-4 w-4" />
          Ends at {new Date(parkingTimer.timer.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      ) : null}
    </section>
  );
}
