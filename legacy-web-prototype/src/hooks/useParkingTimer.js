import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "varna-parking-timer";
const FIVE_MINUTES = 5 * 60 * 1000;
const TIMER_WARNING_ID = 50105;

function readStoredTimer() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed?.endAt || parsed.endAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function notifyFiveMinutes() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification("Varna Parking", {
    body: "5 minutes left on your blue zone timer.",
    tag: "varna-parking-timer-warning",
  });
}

async function getNativeNotifications() {
  try {
    const [{ Capacitor }, { LocalNotifications }] = await Promise.all([
      import("@capacitor/core"),
      import("@capacitor/local-notifications"),
    ]);

    if (!Capacitor.isNativePlatform()) return null;
    return LocalNotifications;
  } catch {
    return null;
  }
}

async function requestNotificationPermission() {
  const nativeNotifications = await getNativeNotifications();
  if (nativeNotifications) {
    const current = await nativeNotifications.checkPermissions();
    if (current.display === "granted") return "granted";
    const requested = await nativeNotifications.requestPermissions();
    return requested.display;
  }

  if ("Notification" in window && Notification.permission === "default") {
    return Notification.requestPermission();
  }

  return "Notification" in window ? Notification.permission : "unsupported";
}

async function scheduleNativeWarning(timer) {
  const nativeNotifications = await getNativeNotifications();
  if (!nativeNotifications || timer.durationMs <= FIVE_MINUTES) return;

  await nativeNotifications.cancel({ notifications: [{ id: TIMER_WARNING_ID }] });
  const permission = await nativeNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  await nativeNotifications.schedule({
    notifications: [
      {
        id: TIMER_WARNING_ID,
        title: "Varna Parking",
        body: "5 minutes left on your blue zone timer.",
        schedule: { at: new Date(timer.endAt - FIVE_MINUTES) },
      },
    ],
  });
}

async function cancelNativeWarning() {
  const nativeNotifications = await getNativeNotifications();
  if (!nativeNotifications) return;
  await nativeNotifications.cancel({ notifications: [{ id: TIMER_WARNING_ID }] });
}

export function useParkingTimer() {
  const [timer, setTimer] = useState(() => readStoredTimer());
  const [now, setNow] = useState(Date.now());
  const [notificationPermission, setNotificationPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const warningSentRef = useRef(Boolean(timer?.warningSent));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!timer) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (timer.endAt <= Date.now()) {
      setTimer(null);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
  }, [timer, now]);

  useEffect(() => {
    if (!timer) {
      cancelNativeWarning();
      return;
    }

    scheduleNativeWarning(timer);
  }, [timer]);

  useEffect(() => {
    if (!timer || warningSentRef.current) return undefined;

    const warningAt = timer.endAt - FIVE_MINUTES;
    const delay = Math.max(0, warningAt - Date.now());
    const timeout = window.setTimeout(() => {
      warningSentRef.current = true;
      setTimer((current) => (current ? { ...current, warningSent: true } : current));
      notifyFiveMinutes();
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [timer]);

  const startTimer = useCallback(async (minutes) => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    const durationMs = minutes * 60 * 1000;
    warningSentRef.current = durationMs <= FIVE_MINUTES;
    setTimer({
      startedAt: Date.now(),
      endAt: Date.now() + durationMs,
      durationMs,
      warningSent: durationMs <= FIVE_MINUTES,
    });
  }, []);

  const extendTimer = useCallback(async (minutes) => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    const addedMs = minutes * 60 * 1000;

    setTimer((current) => {
      const base = current && current.endAt > Date.now() ? current : null;
      const startedAt = base?.startedAt || Date.now();
      const durationMs = (base?.durationMs || 0) + addedMs;
      const endAt = (base?.endAt || Date.now()) + addedMs;
      warningSentRef.current = endAt - Date.now() <= FIVE_MINUTES;

      return {
        startedAt,
        endAt,
        durationMs,
        warningSent: warningSentRef.current,
      };
    });
  }, []);

  const stopTimer = useCallback(() => {
    warningSentRef.current = false;
    cancelNativeWarning();
    setTimer(null);
  }, []);

  const remainingMs = timer ? Math.max(0, timer.endAt - now) : 0;
  const progress = timer ? 1 - remainingMs / timer.durationMs : 0;

  return {
    timer,
    remainingMs,
    progress: Math.min(1, Math.max(0, progress)),
    startTimer,
    extendTimer,
    stopTimer,
    notificationPermission,
  };
}
