import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { relativeAge } from "../lib/time.js";

const VARNA_CENTER = [43.2167, 27.9167];
const VARNA_BOUNDS = [
  [43.12, 27.78],
  [43.32, 28.08],
];

const heatmapGradient = {
  0.2: "#ef4444",
  0.55: "#eab308",
  1: "#22c55e",
};

const confidenceLabels = {
  high: "High chance area",
  medium: "Maybe area",
  low: "Unlikely area",
};

const signalFillOpacity = {
  high: 0.38,
  medium: 0.34,
  low: 0.3,
};

function fadeOutLayer(layer) {
  layer.setStyle?.({ fillOpacity: 0, opacity: 0 });
  window.setTimeout(() => layer.remove(), 260);
}

function MapView({
  blueZoneGeoJson,
  emptyCtaDisabled,
  emptyCtaStatus,
  heatPoints,
  onEmptyReport,
  showEmptyState,
  signals,
  userLocation,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const zoneRef = useRef(null);
  const heatmapRef = useRef(null);
  const circlesRef = useRef([]);
  const userLocationRef = useRef(null);
  const userAccuracyRef = useRef(null);
  const centeredOnUserRef = useRef(false);
  const emptyHintTimerRef = useRef(null);
  const [heatReady, setHeatReady] = useState(Boolean(L.heatLayer));
  const [heatError, setHeatError] = useState("");
  const [emptyHintVisible, setEmptyHintVisible] = useState(false);

  const newestSignal = useMemo(
    () =>
      signals.reduce((newest, signal) => {
        if (!newest) return signal;
        return new Date(signal.newestReportAt) > new Date(newest.newestReportAt) ? signal : newest;
      }, null),
    [signals],
  );

  const resetEmptyHintIdle = useCallback(() => {
    window.clearTimeout(emptyHintTimerRef.current);
    setEmptyHintVisible(false);

    if (!showEmptyState) return;

    emptyHintTimerRef.current = window.setTimeout(() => {
      setEmptyHintVisible(true);
    }, 2400);
  }, [showEmptyState]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return undefined;

    window.L = L;
    if (!L.heatLayer) {
      let cancelled = false;
      import("leaflet.heat")
        .then(() => {
          if (!cancelled) setHeatReady(true);
        })
        .catch(() => {
          if (!cancelled) setHeatError("Heatmap layer could not load.");
        });

      return () => {
        cancelled = true;
      };
    }

    setHeatReady(true);
    return undefined;
  }, []);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return undefined;

    const mapNode = mapNodeRef.current;
    const map = L.map(mapNodeRef.current, {
      zoom: 13,
      minZoom: 11,
      maxZoom: 18,
      center: VARNA_CENTER,
      maxBounds: VARNA_BOUNDS,
      maxBoundsViscosity: 0.55,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;
    const invalidateMapSize = () => {
      map.invalidateSize({ debounceMoveend: true });
    };
    const resizeObserver = new ResizeObserver(invalidateMapSize);
    resizeObserver.observe(mapNode);
    map.whenReady(() => {
      window.requestAnimationFrame(invalidateMapSize);
      window.setTimeout(invalidateMapSize, 250);
    });
    window.addEventListener("resize", invalidateMapSize);

    return () => {
      window.removeEventListener("resize", invalidateMapSize);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      zoneRef.current = null;
      heatmapRef.current = null;
      userLocationRef.current = null;
      userAccuracyRef.current = null;
      centeredOnUserRef.current = false;
      circlesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !blueZoneGeoJson) return;

    if (zoneRef.current) {
      zoneRef.current.remove();
    }

    zoneRef.current = L.geoJSON(blueZoneGeoJson, {
      style: {
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 0.18,
        opacity: 0.96,
        weight: 2.6,
      },
    }).addTo(mapRef.current);

    zoneRef.current.bindTooltip("Paid Parking Zone", {
      permanent: true,
      direction: "center",
      className: "paid-zone-label",
      opacity: 0.8,
    });
    zoneRef.current.bringToBack();
  }, [blueZoneGeoJson]);

  useEffect(() => {
    if (!heatReady || !mapRef.current || !L.heatLayer) return;

    const heatmapData = heatPoints.map((point) => [point.latitude, point.longitude, point.intensity]);

    if (!heatmapRef.current) {
      heatmapRef.current = L.heatLayer(heatmapData, {
        radius: 46,
        blur: 36,
        maxZoom: 17,
        minOpacity: 0.18,
        gradient: heatmapGradient,
      }).addTo(mapRef.current);
      return;
    }

    heatmapRef.current.setLatLngs(heatmapData);
  }, [heatPoints, heatReady]);

  useEffect(() => {
    if (!mapRef.current) return;

    const renderedLayers = signals.map((signal) => {
      const fillOpacity = signalFillOpacity[signal.confidence] || signalFillOpacity.low;
      const baseRadius = signal.radiusMeters;
      const haloRadius = Math.round(baseRadius * 1.18);
      const halo = L.circle([signal.latitude, signal.longitude], {
        radius: haloRadius,
        color: signal.color,
        fillColor: signal.color,
        fillOpacity: 0.12,
        opacity: 0,
        stroke: false,
        interactive: false,
        className: "availability-circle availability-circle-halo",
      });
      const circle = L.circle([signal.latitude, signal.longitude], {
        radius: baseRadius,
        color: signal.color,
        fillColor: signal.color,
        fillOpacity,
        opacity: 0,
        stroke: false,
        className: "availability-circle availability-circle-core",
      });
      const emphasize = () => {
        circle.setRadius(baseRadius * 1.05);
        circle.setStyle({ fillOpacity: Math.min(0.44, fillOpacity + 0.06) });
        halo.setRadius(baseRadius * 1.28);
        halo.setStyle({ fillOpacity: 0.18 });
      };
      const reset = () => {
        circle.setRadius(baseRadius);
        circle.setStyle({ fillOpacity });
        halo.setRadius(haloRadius);
        halo.setStyle({ fillOpacity: 0.12 });
      };

      circle.bindPopup(
        `<div class="spot-popup"><strong>${confidenceLabels[signal.confidence]}</strong><span>${signal.reportCount} recent ${
          signal.reportCount === 1 ? "report" : "reports"
        } - ${relativeAge(signal.newestReportAt)}</span><span>Approx. ${Math.round(
          signal.radiusMeters,
        )}m radius, not guaranteed</span></div>`,
      );
      circle.on("mouseover touchstart click", emphasize);
      circle.on("mouseout popupclose", reset);
      halo.addTo(mapRef.current);
      circle.addTo(mapRef.current);
      return { circle, halo };
    });
    circlesRef.current = renderedLayers;

    return () => {
      renderedLayers.forEach(({ circle, halo }) => {
        circle.off();
        halo.off();
        fadeOutLayer(circle);
        fadeOutLayer(halo);
      });
      if (circlesRef.current === renderedLayers) {
        circlesRef.current = [];
      }
    };
  }, [signals]);

  useEffect(() => {
    if (!mapRef.current || !newestSignal) return;
    const createdAt = new Date(newestSignal.newestReportAt).getTime();
    if (Date.now() - createdAt < 5000) {
      mapRef.current.panTo([newestSignal.latitude, newestSignal.longitude], { animate: true });
    }
  }, [newestSignal]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    const latLng = [userLocation.latitude, userLocation.longitude];
    if (!centeredOnUserRef.current) {
      mapRef.current.setView(latLng, Math.max(mapRef.current.getZoom(), 15), { animate: true });
      centeredOnUserRef.current = true;
    }

    if (userLocationRef.current) {
      userLocationRef.current.setLatLng(latLng);
    } else {
      userLocationRef.current = L.circleMarker(latLng, {
        radius: 7,
        color: "#ffffff",
        fillColor: "#2563eb",
        fillOpacity: 0.9,
        opacity: 0.95,
        weight: 2,
        className: "user-location-dot",
      }).addTo(mapRef.current);
    }

    if (userAccuracyRef.current) {
      userAccuracyRef.current.setLatLng(latLng);
      userAccuracyRef.current.setRadius(userLocation.accuracy);
      userLocationRef.current?.bringToFront();
      return;
    }

    userAccuracyRef.current = L.circle(latLng, {
      radius: userLocation.accuracy,
      color: "#2563eb",
      fillColor: "#2563eb",
      fillOpacity: 0.08,
      opacity: 0.32,
      weight: 1,
      interactive: false,
      className: "user-accuracy-circle",
    }).addTo(mapRef.current);
    userLocationRef.current.bringToFront();
  }, [userLocation]);

  useEffect(() => {
    resetEmptyHintIdle();
    return () => window.clearTimeout(emptyHintTimerRef.current);
  }, [resetEmptyHintIdle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    map.on("movestart dragstart zoomstart mousedown touchstart click", resetEmptyHintIdle);

    return () => {
      map.off("movestart dragstart zoomstart mousedown touchstart click", resetEmptyHintIdle);
    };
  }, [resetEmptyHintIdle]);

  useEffect(() => {
    const handleGlobalPointerDown = (event) => {
      if (event.target?.closest?.("[data-empty-hint-action]")) return;
      resetEmptyHintIdle();
    };

    window.addEventListener("pointerdown", handleGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", handleGlobalPointerDown);
  }, [resetEmptyHintIdle]);

  return (
    <section className="absolute left-0 top-0 z-0 h-[100vh] w-full bg-slate-900" aria-label="Varna parking heatmap">
      <div id="map" ref={mapNodeRef} className="absolute inset-0 z-0 h-[100vh] w-full" />
      {showEmptyState ? (
        <div className="pointer-events-none absolute inset-0 z-[510]">
          <div className="empty-heat-pulse absolute left-1/2 top-[44%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-xl dark:bg-emerald-300/10" />
          <div
            className={`absolute left-1/2 top-[42%] w-[min(17rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 scale-95 rounded-2xl border border-white/15 bg-black/50 px-3 py-3 text-center text-white shadow-panel backdrop-blur-[6px] transition duration-200 ease-out ${
              emptyHintVisible ? "opacity-100 scale-100" : "opacity-0"
            }`}
          >
            <div className="text-sm font-black">No recent parking signals</div>
            <button
              type="button"
              disabled={emptyCtaDisabled}
              onClick={() => {
                setEmptyHintVisible(false);
                onEmptyReport?.();
              }}
              data-empty-hint-action
              className={`mt-2 min-h-11 rounded-xl bg-white px-4 text-sm font-black text-slate-950 shadow-lg shadow-black/15 transition duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/35 disabled:text-white/70 ${
                emptyHintVisible ? "pointer-events-auto" : "pointer-events-none"
              }`}
            >
              {emptyCtaDisabled && emptyCtaStatus ? emptyCtaStatus : "Report a spot"}
            </button>
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-3 top-24 z-[500] mx-auto flex max-w-6xl justify-end sm:inset-x-5 sm:top-28">
        <div className="rounded-2xl border border-white/50 bg-white/92 px-3 py-2 text-xs font-black uppercase tracking-normal text-slate-600 shadow-panel backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200">
          OpenStreetMap
        </div>
      </div>
      {heatError ? (
        <div className="absolute inset-x-4 top-36 z-[500] rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-amber-800 shadow-panel sm:top-40">
          {heatError}
        </div>
      ) : null}
    </section>
  );
}

export default memo(MapView);
