import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CarFront, ChevronDown, LocateFixed, MapPinned, WifiOff } from "lucide-react";
import AvailabilityLegend from "./components/AvailabilityLegend.jsx";
import BottomNav from "./components/BottomNav.jsx";
import FloatingActionButton from "./components/FloatingActionButton.jsx";
import MapView from "./components/MapView.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";
import SpotPanel from "./components/SpotPanel.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import TimerPanel from "./components/TimerPanel.jsx";
import TimerWidget from "./components/TimerWidget.jsx";
import Toast from "./components/Toast.jsx";
import { useParkingTimer } from "./hooks/useParkingTimer.js";
import { api } from "./lib/api.js";
import { defaultVarnaLocation, requestPreciseLocation } from "./lib/location.js";
import { openParkingSms } from "./lib/sms.js";
import { formatRemaining } from "./lib/time.js";

const isDemo = false;
const DEFAULT_POLL_INTERVAL_MS = 5 * 1000;
const DEFAULT_DEMO_ANCHOR = {
  latitude: 43.2167,
  longitude: 27.9167,
};

function hasAvailability(data) {
  return Boolean((data.spots || []).length || (data.signals || []).length);
}

function persistentUserId() {
  const existing = localStorage.getItem("varna-parking-profile-id");
  if (existing) return existing;

  const id = crypto.randomUUID?.() || `vp-${Date.now().toString(36)}`;
  localStorage.setItem("varna-parking-profile-id", id);
  return id;
}

export default function App() {
  const [appConfig, setAppConfig] = useState(null);
  const [user, setUser] = useState(null);
  const [spots, setSpots] = useState([]);
  const [signals, setSignals] = useState([]);
  const [heatPoints, setHeatPoints] = useState([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loadingSpots, setLoadingSpots] = useState(true);
  const [locating, setLocating] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("map");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [theme, setTheme] = useState(() => localStorage.getItem("varna-parking-theme") || "dark");
  const [carPlate, setCarPlate] = useState(() => localStorage.getItem("varna-parking-plate") || "");
  const [showChanceAreas, setShowChanceAreas] = useState(true);
  const [demoActive, setDemoActive] = useState(false);
  const [userLocation, setUserLocation] = useState(() => defaultVarnaLocation());
  const [gpsReady, setGpsReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [locationBanner, setLocationBanner] = useState({
    visible: true,
    tone: "info",
    message: "We need your location to show nearby parking spots",
  });
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [profileUserId] = useState(() => persistentUserId());
  const [totalReports, setTotalReports] = useState(() => Number(localStorage.getItem("varna-parking-total-reports") || 0));
  const [lastReportAt, setLastReportAt] = useState(() => localStorage.getItem("varna-parking-last-report-at") || "");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem("varna-parking-notifications") !== "off",
  );
  const [demoModeEnabled, setDemoModeEnabled] = useState(
    () => localStorage.getItem("varna-parking-demo-mode") === "on",
  );
  const demoAnchorRef = useRef(null);
  const parkingTimer = useParkingTimer();

  const cooldownRemaining = Math.max(0, cooldownUntil - now);
  const canReport = !locating && cooldownRemaining === 0;
  const activeSpots = useMemo(
    () => spots.filter((spot) => new Date(spot.expiresAt).getTime() > now),
    [now, spots],
  );
  const pollIntervalMs = (appConfig?.updateIntervalSeconds || DEFAULT_POLL_INTERVAL_MS / 1000) * 1000;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", theme === "dark" ? "#020617" : "#f8fafc");
    localStorage.setItem("varna-parking-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("varna-parking-plate", carPlate);
  }, [carPlate]);

  useEffect(() => {
    localStorage.setItem("varna-parking-total-reports", String(totalReports));
  }, [totalReports]);

  useEffect(() => {
    if (lastReportAt) {
      localStorage.setItem("varna-parking-last-report-at", lastReportAt);
    }
  }, [lastReportAt]);

  useEffect(() => {
    localStorage.setItem("varna-parking-notifications", notificationsEnabled ? "on" : "off");
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("varna-parking-demo-mode", demoModeEnabled ? "on" : "off");
  }, [demoModeEnabled]);

  useEffect(() => {
    Promise.all([import("@capacitor/core"), import("@capacitor/status-bar"), import("@capacitor/splash-screen")])
      .then(async ([{ Capacitor }, { StatusBar, Style }, { SplashScreen }]) => {
        if (!Capacitor.isNativePlatform()) return;
        await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: theme === "dark" ? "#020617" : "#f8fafc" });
        await SplashScreen.hide();
      })
      .catch(() => {});
  }, [theme]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    let nativeListener;

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    Promise.all([import("@capacitor/core"), import("@capacitor/network")])
      .then(async ([{ Capacitor }, { Network }]) => {
        if (!Capacitor.isNativePlatform()) return;
        const status = await Network.getStatus();
        setOnline(status.connected);
        nativeListener = await Network.addListener("networkStatusChange", (statusUpdate) => {
          setOnline(statusUpdate.connected);
        });
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      nativeListener?.remove();
    };
  }, []);

  const showToast = useCallback((title, message = "") => {
    setToast({ title, message });
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const applyAvailability = useCallback((data, options = {}) => {
    setSpots(data.spots || []);
    setSignals(data.signals || []);
    setHeatPoints(data.heatPoints || []);
    setGeneratedAt(data.generatedAt || new Date().toISOString());
    setDemoActive(Boolean(options.demo || data.demo));
  }, []);

  const fallbackMapCenter = useMemo(
    () => ({
      latitude: appConfig?.mapCenter?.latitude || DEFAULT_DEMO_ANCHOR.latitude,
      longitude: appConfig?.mapCenter?.longitude || DEFAULT_DEMO_ANCHOR.longitude,
    }),
    [appConfig?.mapCenter?.latitude, appConfig?.mapCenter?.longitude],
  );

  const requestUserLocation = useCallback(async () => {
    setRequestingLocation(true);
    setLocationBanner({
      visible: true,
      tone: "info",
      message: "We need your location to show nearby parking spots",
    });

    try {
      const location = await requestPreciseLocation();

      if (!location || location.accuracy > 100) {
        const fallback = defaultVarnaLocation();
        setUserLocation(fallback);
        setGpsReady(false);
        demoAnchorRef.current = fallback;
        setLocationBanner({
          visible: true,
          tone: "warning",
          message: "Using Varna center - enable precise location for better accuracy",
        });
        return fallback;
      }

      setUserLocation(location);
      setGpsReady(true);
      demoAnchorRef.current = location;
      setLocationBanner((current) => ({ ...current, visible: false }));
      return location;
    } catch {
      const fallback = defaultVarnaLocation();
      setUserLocation(fallback);
      setGpsReady(false);
      demoAnchorRef.current = fallback;
      setLocationBanner({
        visible: true,
        tone: "warning",
        message: "Location is off - using Varna center",
      });
      return fallback;
    } finally {
      setRequestingLocation(false);
    }
  }, []);

  useEffect(() => {
    requestUserLocation();
  }, [requestUserLocation]);

  const resolveDemoAnchor = useCallback(async () => {
    if (gpsReady && userLocation) return userLocation;
    if (demoAnchorRef.current) return demoAnchorRef.current;

    demoAnchorRef.current = fallbackMapCenter;
    return fallbackMapCenter;
  }, [fallbackMapCenter, gpsReady, userLocation]);

  const loadDemoAvailability = useCallback(async () => {
    const anchor = await resolveDemoAnchor();
    const data = await api.createDemoSpots(anchor);
    applyAvailability(data, { demo: true });
  }, [applyAvailability, resolveDemoAnchor]);

  const refreshSpots = useCallback(async () => {
    try {
      setLoadingSpots(true);
      const data = await api.getSpots();
      if (hasAvailability(data)) {
        applyAvailability(data);
        return;
      }

      if (demoModeEnabled) {
        await loadDemoAvailability();
        return;
      }

      applyAvailability({
        ...data,
        generatedAt: data.generatedAt || new Date().toISOString(),
      });
    } catch (error) {
      showToast("Could not refresh spots", error.message);
    } finally {
      setLoadingSpots(false);
    }
  }, [applyAvailability, demoModeEnabled, loadDemoAvailability, showToast]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [configData, authData] = await Promise.all([api.getConfig(), api.signIn()]);
        if (!active) return;
        setAppConfig(configData);
        setUser(authData.user);
        await refreshSpots();
      } catch (error) {
        showToast("Startup failed", error.message);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [refreshSpots, showToast]);

  useEffect(() => {
    const interval = window.setInterval(refreshSpots, pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [pollIntervalMs, refreshSpots]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeSpots.length === 0 && gpsReady) {
      setShowOverlay(true);
      return;
    }

    setShowOverlay(false);
  }, [activeSpots.length, gpsReady]);

  useEffect(() => {
    if (!showOverlay) return undefined;

    const timeout = window.setTimeout(() => setShowOverlay(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [showOverlay]);

  const handleFreeSpot = useCallback(() => {
    if (!canReport) return;

    setShowOverlay(false);
    const location = gpsReady && !userLocation?.isFallback ? userLocation : null;
    if (!location || location.accuracy > 100) {
      setLocationBanner({
        visible: true,
        tone: "warning",
        message: "Enable precise location to report a spot",
      });
      requestUserLocation();
      return;
    }

    setLocating(true);
    api
      .createSpot({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      })
      .then((data) => {
        applyAvailability(data);
        setCooldownUntil(Date.now() + (appConfig?.cooldownSeconds || 120) * 1000);

        if (!data.ignoredDuplicate) {
          const reportedAt = new Date().toISOString();
          setTotalReports((count) => count + 1);
          setLastReportAt(reportedAt);
        }

        if (data.ignoredDuplicate) {
          showToast("Already counted", data.message || "A nearby signal from you is still active.");
        } else {
          showToast("Parking signal added", "It raises local probability and fades over 10 minutes.");
        }
      })
      .catch((error) => {
        if (error.status === 429) {
          setCooldownUntil(Date.now() + (error.retryAfterSeconds || 120) * 1000);
          showToast("Please wait", error.message);
          return;
        }
        showToast("Could not add signal", error.message);
      })
      .finally(() => setLocating(false));
  }, [appConfig?.cooldownSeconds, applyAvailability, canReport, gpsReady, requestUserLocation, showToast, userLocation]);

  const statusText = useMemo(() => {
    if (locating) return "Finding GPS";
    if (cooldownRemaining > 0) return `Ready in ${formatRemaining(cooldownRemaining)}`;
    return "Ready";
  }, [cooldownRemaining, locating]);

  const handleSendSms = useCallback(() => {
    try {
      const sms = openParkingSms({
        number: appConfig?.blueZoneSmsNumber,
        plate: carPlate,
        zoneCode: appConfig?.blueZoneCode,
      });
      showToast("SMS draft opened", sms.message);
    } catch (error) {
      showToast("SMS unavailable", error.message);
    }
  }, [appConfig?.blueZoneCode, appConfig?.blueZoneSmsNumber, carPlate, showToast]);

  return (
    <div className="relative isolate h-[100dvh] min-h-screen overflow-hidden bg-slate-100 text-slate-950 transition-colors duration-300 dark:bg-slate-950">
      <MapView
        blueZoneGeoJson={appConfig?.blueZoneGeoJson}
        emptyCtaDisabled={!canReport}
        emptyCtaStatus={statusText}
        heatPoints={heatPoints}
        onEmptyReport={handleFreeSpot}
        showEmptyState={demoActive || (!loadingSpots && !signals.length)}
        signals={signals}
        userLocation={userLocation}
      />

      <div className="pointer-events-none absolute inset-0 z-[1000]">
        <header className="pointer-events-none absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] sm:left-5 sm:right-5 sm:top-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-[1.35rem] border border-white/45 bg-white/92 p-2 pr-4 text-slate-950 shadow-panel backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/86 dark:text-white">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                <CarFront className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-black">Varna Parking</h1>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <MapPinned className="h-3.5 w-3.5 text-emerald-500" />
                  Varna
                </div>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-2xl border border-white/35 bg-white/88 px-3 py-2 text-xs font-black text-slate-600 shadow-panel backdrop-blur dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-200 sm:flex">
                {online ? <Activity className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                {online ? "Live" : "Offline"}
              </div>
              <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
            </div>
          </div>
        </header>

        {activeTab === "map" ? (
          <>
            {locationBanner.visible ? (
              <div className="pointer-events-auto absolute inset-x-3 top-[5.2rem] z-[1060] mx-auto max-w-md sm:top-[5.8rem]">
                <div
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-panel backdrop-blur-md transition duration-200 ${
                    locationBanner.tone === "warning"
                      ? "border-amber-300/35 bg-slate-950/72 text-white"
                      : "border-white/30 bg-slate-950/64 text-white"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12">
                    <LocateFixed className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 text-xs font-bold leading-5">{locationBanner.message}</div>
                  <button
                    type="button"
                    onClick={requestUserLocation}
                    disabled={requestingLocation}
                    className="min-h-10 shrink-0 rounded-xl bg-white px-3 text-xs font-black text-slate-950 transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/35 disabled:text-white/70"
                  >
                    {requestingLocation ? "Checking" : "Enable Location"}
                  </button>
                </div>
              </div>
            ) : null}

            <div
              className={`pointer-events-none absolute left-3 z-[1050] grid w-[min(17.5rem,calc(100vw-2rem))] max-h-[calc(100dvh-12.5rem)] gap-2 transition-[top] duration-200 sm:left-5 sm:max-h-[calc(100dvh-9rem)] ${
                locationBanner.visible ? "top-[9.2rem] sm:top-[9.7rem]" : "top-[6.4rem] sm:top-[7.1rem]"
              }`}
            >
              <div className="pointer-events-none">
                <AvailabilityLegend demoActive={demoActive} />
              </div>

              <button
                type="button"
                aria-controls="chance-areas-panel"
                aria-expanded={showChanceAreas}
                onClick={() => setShowChanceAreas((visible) => !visible)}
                className="pointer-events-auto flex min-h-12 items-center justify-between rounded-2xl border border-white/30 bg-white/82 px-3 text-sm font-black text-slate-800 shadow-panel backdrop-blur-md transition duration-200 ease-out active:scale-[0.98] dark:border-white/10 dark:bg-slate-950/72 dark:text-white"
              >
                Chance Areas
                <span className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  {demoActive ? "Demo" : signals.length}
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showChanceAreas ? "rotate-180" : ""}`} />
                </span>
              </button>

              {showChanceAreas ? (
                <div
                  id="chance-areas-panel"
                  className="pointer-events-auto max-h-[31dvh] overflow-y-auto rounded-[1.45rem] border border-white/30 bg-white/90 p-3 shadow-panel transition duration-200 ease-out dark:border-white/10 dark:bg-slate-950/82 sm:max-h-[42dvh]"
                >
                  <SpotPanel
                    demoActive={demoActive}
                    embedded
                    generatedAt={generatedAt}
                    loading={loadingSpots}
                    reports={activeSpots}
                    signals={signals}
                  />
                </div>
              ) : null}
            </div>

            {parkingTimer.timer ? (
              <div className="pointer-events-auto absolute inset-x-3 bottom-[11rem] sm:bottom-auto sm:left-auto sm:right-5 sm:top-[7.1rem] sm:w-80">
                <TimerWidget parkingTimer={parkingTimer} onOpen={() => setActiveTab("timer")} />
              </div>
            ) : null}

            <div className="absolute bottom-[6.4rem] right-4 sm:bottom-[2rem] sm:right-6">
              <FloatingActionButton
                cooldownLabel={statusText}
                disabled={!canReport}
                locating={locating}
                onClick={handleFreeSpot}
              />
            </div>
          </>
        ) : null}

        {activeTab === "timer" ? (
          <div className="pointer-events-auto absolute inset-x-3 bottom-[6.4rem] top-[6.4rem] overflow-y-auto sm:inset-x-auto sm:left-1/2 sm:w-[min(30rem,calc(100vw-2.5rem))] sm:-translate-x-1/2">
            <TimerPanel
              appConfig={appConfig}
              carPlate={carPlate}
              onCarPlateChange={setCarPlate}
              onSendSms={handleSendSms}
              parkingTimer={parkingTimer}
            />
          </div>
        ) : null}

        {activeTab === "profile" ? (
          <div className="pointer-events-auto absolute inset-x-3 bottom-[6.4rem] top-[6.4rem] overflow-y-auto sm:inset-x-auto sm:left-1/2 sm:w-[min(34rem,calc(100vw-2.5rem))] sm:-translate-x-1/2">
            <ProfilePanel appConfig={appConfig} user={user} />
          </div>
        ) : null}

        <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:right-auto sm:w-[26rem] sm:-translate-x-1/2">
          <BottomNav activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
