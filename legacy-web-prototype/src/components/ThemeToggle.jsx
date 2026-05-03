import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-white/88 text-slate-800 shadow-panel backdrop-blur transition duration-200 ease-out hover:scale-[1.03] active:scale-95 dark:border-white/10 dark:bg-slate-950/78 dark:text-white"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun className="h-5 w-5 text-amber-300" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
