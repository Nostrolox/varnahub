import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import importedVisitVarnaEvents from "./data/importedVisitVarnaEvents.json";
import mockData from "./data/varnaMockData.json";
import bg from "./data/i18n/bg.json";
import en from "./data/i18n/en.json";

const VARNA_CENTER = { lat: 43.2047, lng: 27.9105 };
const I18N = { bg, en };
const EVENT_CATEGORIES = ["all", "concerts", "festivals", "nightlife", "culture", "food", "meetups"];
const PLACE_CATEGORIES = ["all", "restaurants", "bars", "cafes", "street food"];
const DATE_FILTERS = ["all", "today", "tonight", "week", "weekend"];
const SORTS = ["popularity", "date", "rating"];
const QUICK_FILTERS = ["today", "tonight", "weekend", "free", "paid", "concerts", "festivals", "nightlife", "culture", "food", "near"];
const BADGES = ["verified", "free", "paid", "ticketRequired", "familyFriendly", "outdoor", "foodNearby", "popular"];

const eventMarker = L.divIcon({ className: "hub-pin hub-pin-event", html: "<span></span>", iconAnchor: [13, 13], iconSize: [26, 26] });
const placeMarker = L.divIcon({ className: "hub-pin hub-pin-place", html: "<span></span>", iconAnchor: [13, 13], iconSize: [26, 26] });

function clusterMarker(count) {
  return L.divIcon({ className: "hub-cluster", html: `<span>${count}</span>`, iconAnchor: [18, 18], iconSize: [36, 36] });
}

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function getPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function parseDate(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

function makeKey(type, id) {
  return `${type}:${id}`;
}

function safeImage(src) {
  return src || "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1400&q=80";
}

function safeArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function textValue(value, language = "en") {
  return typeof value === "object" && value ? value[language] || value.en || value.bg || "" : value || "";
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");
}

function distanceKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const aLat = Number(a.coordinates?.lat ?? a.lat);
  const aLng = Number(a.coordinates?.lng ?? a.lng);
  const bLat = Number(b.coordinates?.lat ?? b.lat);
  const bLng = Number(b.coordinates?.lng ?? b.lng);
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function averageRating(item, extraReviews = []) {
  const totalReviews = [...(item.reviews || []), ...extraReviews];
  if (!totalReviews.length) return Number(item.rating || 0);
  return totalReviews.reduce((total, review) => total + Number(review.rating || 0), 0) / totalReviews.length;
}

function isFreeEvent(event) {
  return (event.badges || []).includes("free") || /free|безплат/i.test(String(event.ticket?.price || ""));
}

function isSmartTonight(event, todayValue, nowMinutes) {
  return event.date === todayValue && minutesFromTime(event.startTime || event.time) >= nowMinutes;
}

function isWeekend(event, today, weekEnd) {
  const eventDate = parseDate(event.date);
  return eventDate && eventDate >= today && eventDate <= weekEnd && [0, 6].includes(eventDate.getDay());
}

function getReviews(type, id, userReviews) {
  return userReviews.filter((review) => review.targetType === type && review.targetId === id);
}

function popularityScore(event, accounts, userReviews) {
  const saves = accounts.filter((account) => (account.favorites || []).includes(makeKey("event", event.id))).length;
  const going = accounts.filter((account) => (account.going || []).includes(event.id)).length;
  const reviews = getReviews("event", event.id, userReviews);
  return Number(event.popularityScore || event.basePopularity || event.popularity || 0) + saves * 8 + going * 5 + reviews.length * 3 + averageRating(event, reviews) * 2;
}

function defaultEventBadges(event) {
  const badges = new Set(event.badges || []);
  if (/moreto|visit varna/i.test(event.source || "")) badges.add("verified");
  if (isFreeEvent({ ...event, badges: [...badges] })) badges.add("free");
  if (!badges.has("free")) badges.add("paid");
  if (event.ticket?.link) badges.add("ticketRequired");
  if (Number(event.basePopularity || event.popularityScore || 0) >= 75) badges.add("popular");
  if (["nightlife", "festivals", "meetups", "food"].includes(event.category)) badges.add("outdoor");
  badges.add("foodNearby");
  return [...badges];
}

function normalizeEvent(event, today) {
  const date = event.date || dateKey(addDays(today, Number(event.dayOffset || 0)));
  const startTime = event.startTime || event.time || "19:00";
  const images = event.images || event.gallery || [event.image];
  const normalized = {
    ...event,
    id: event.id,
    title: event.title,
    category: event.category || "culture",
    date,
    startTime,
    time: startTime,
    endTime: event.endTime || "21:00",
    location: event.location,
    coordinates: event.coordinates || { lat: Number(event.lat || VARNA_CENTER.lat), lng: Number(event.lng || VARNA_CENTER.lng) },
    lat: Number(event.coordinates?.lat ?? event.lat ?? VARNA_CENTER.lat),
    lng: Number(event.coordinates?.lng ?? event.lng ?? VARNA_CENTER.lng),
    shortDescription: event.shortDescription || event.description,
    fullDescription: event.fullDescription || event.richDescription || event.description,
    images,
    image: safeImage(event.image || images?.[0]),
    organizer: event.organizer || { name: "", link: "", contact: "" },
    ticket: event.ticket || { price: "Free", link: "" },
    schedule: event.schedule || [],
    tags: event.tags || [event.category, event.venue, event.organizer?.name].filter(Boolean),
    rating: event.rating || averageRating(event),
    reviewsCount: event.reviewsCount || (event.reviews || []).length,
    popularityScore: event.popularityScore || event.basePopularity || event.popularity || 50
  };
  return { ...normalized, badges: defaultEventBadges(normalized) };
}

function normalizePlace(place) {
  return {
    ...place,
    type: place.type || place.category || "restaurants",
    category: place.category || place.type || "restaurants",
    coordinates: place.coordinates || { lat: Number(place.lat || VARNA_CENTER.lat), lng: Number(place.lng || VARNA_CENTER.lng) },
    lat: Number(place.coordinates?.lat ?? place.lat ?? VARNA_CENTER.lat),
    lng: Number(place.coordinates?.lng ?? place.lng ?? VARNA_CENTER.lng),
    openingHours: place.openingHours || "10:00-23:00",
    badges: place.badges || ["verified"],
    tags: place.tags || [place.category, textValue(place.cuisine), place.priceRange].filter(Boolean),
    reviewsCount: place.reviewsCount || (place.reviews || []).length
  };
}

function dedupeEvents(events, language) {
  const seen = new Map();
  const duplicateTargets = new Set(events.map((event) => event.duplicateOf).filter(Boolean));
  for (const event of events) {
    const naturalKey = naturalEventKey(event, language);
    const key = duplicateTargets.has(event.id) ? event.id : event.duplicateOf || naturalKey;
    const current = seen.get(key);
    if (!current || event.source === "Admin manual" || Number(event.popularityScore || 0) > Number(current.popularityScore || 0)) seen.set(key, event);
  }
  return [...seen.values()];
}

function naturalEventKey(event, language = "bg") {
  return `${slug(textValue(event.title, language))}:${event.date || ""}:${slug(textValue(event.location, language))}`;
}

function dedupeById(items) {
  const seen = new Map();
  for (const item of items) seen.set(item.id, item);
  return [...seen.values()];
}

function createEmptyAdminEvent(todayValue) {
  return {
    id: "",
    titleBg: "",
    titleEn: "",
    date: todayValue,
    startTime: "19:00",
    endTime: "21:00",
    locationBg: "",
    locationEn: "",
    category: "culture",
    shortDescriptionBg: "",
    shortDescriptionEn: "",
    fullDescriptionBg: "",
    fullDescriptionEn: "",
    organizerName: "",
    organizerContact: "",
    organizerLink: "",
    ticketPrice: "Free",
    ticketLink: "",
    sourceUrl: "",
    image: "",
    lat: String(VARNA_CENTER.lat),
    lng: String(VARNA_CENTER.lng),
    badges: "verified,free",
    tags: "varna,local"
  };
}

function createEmptyAdminPlace() {
  return {
    id: "",
    name: "",
    type: "restaurants",
    cuisineBg: "",
    cuisineEn: "",
    priceRange: "$$",
    locationBg: "",
    locationEn: "",
    descriptionBg: "",
    descriptionEn: "",
    openingHours: "10:00-23:00",
    image: "",
    lat: String(VARNA_CENTER.lat),
    lng: String(VARNA_CENTER.lng),
    badges: "verified",
    tags: "varna,food"
  };
}

function getInitialView() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return path === "admin" ? "admin" : "home";
}

function ensureAccountRoles(accounts) {
  const byId = new Map(accounts.map((account) => [account.id, { role: "user", favorites: [], going: [], reviews: [], ...account }]));
  for (const account of mockData.users || []) {
    if (!byId.has(account.id)) byId.set(account.id, { role: "user", favorites: [], going: [], reviews: [], ...account });
  }
  return [...byId.values()];
}

export default function App() {
  const [language, setLanguage] = useLocalStorage("varnaHub:language", "bg");
  const dictionary = I18N[language] || I18N.bg;
  const t = (path) => getPath(dictionary, path) || getPath(I18N.en, path) || path;
  const l = (value) => textValue(value, language);
  const locale = language === "bg" ? "bg-BG" : "en";
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayValue = dateKey(today);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const weekEnd = addDays(today, 6);

  const [activeView, setActiveView] = useState(getInitialView);
  const [selected, setSelected] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [eventCategory, setEventCategory] = useState("all");
  const [eventSort, setEventSort] = useState("popularity");
  const [placeCategory, setPlaceCategory] = useState("all");
  const [placeSort, setPlaceSort] = useState("rating");
  const [quickFilters, setQuickFilters] = useState([]);
  const [favoritesTab, setFavoritesTab] = useState("events");
  const [adminTab, setAdminTab] = useState("events");
  const [toast, setToast] = useState("");
  const [accounts, setAccounts] = useLocalStorage("varnaHub:accounts:v3", ensureAccountRoles(mockData.users || []));
  const [session, setSession] = useLocalStorage("varnaHub:session", null);
  const [localEvents, setLocalEvents] = useLocalStorage("varnaHub:adminEvents:v2", []);
  const [localPlaces, setLocalPlaces] = useLocalStorage("varnaHub:adminPlaces", []);
  const [deletedEventIds, setDeletedEventIds] = useLocalStorage("varnaHub:deletedEvents", []);
  const [deletedPlaceIds, setDeletedPlaceIds] = useLocalStorage("varnaHub:deletedPlaces", []);
  const [cache, setCache] = useLocalStorage("varnaHub:offlineCache:v2", { events: [], places: [], timestamp: null });
  const [authMode, setAuthMode] = useState("login");
  const [authDraft, setAuthDraft] = useState({ email: "", password: "", username: "" });
  const [reviewDraft, setReviewDraft] = useState({ rating: "5", comment: "" });
  const [adminEventDraft, setAdminEventDraft] = useState(() => createEmptyAdminEvent(todayValue));
  const [adminPlaceDraft, setAdminPlaceDraft] = useState(() => createEmptyAdminPlace());

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setAccounts((current) => {
      const next = ensureAccountRoles(current);
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [setAccounts]);

  const user = accounts.find((account) => account.id === session?.userId) || null;
  // TODO: This is frontend-only mock access control. Production admin security should use Supabase, Firebase, Auth0, or a backend with server-side role checks.
  const isAdmin = user?.role === "admin";
  const userFavorites = user?.favorites || [];
  const userGoing = user?.going || [];
  const userReviews = useMemo(() => accounts.flatMap((account) => (account.reviews || []).map((review) => ({ ...review, username: account.username }))), [accounts]);

  useEffect(() => {
    if (activeView === "admin" && !user) {
      setSelected(null);
      setActiveView("profile");
      if (window.location.pathname === "/admin") window.history.replaceState({}, "", "/");
    }
  }, [activeView, user]);

  const seedEvents = useMemo(
    () => [...(mockData.events || []), ...(importedVisitVarnaEvents || [])].map((event) => normalizeEvent(event, today)),
    [today]
  );
  const seedPlaces = useMemo(() => (mockData.places || []).map(normalizePlace), []);
  const events = useMemo(
    () => dedupeEvents([...seedEvents, ...localEvents.map((event) => normalizeEvent(event, today))].filter((event) => !deletedEventIds.includes(event.id)), language),
    [deletedEventIds, language, localEvents, seedEvents, today]
  );
  const places = useMemo(
    () => dedupeById([...seedPlaces, ...localPlaces.map(normalizePlace)].filter((place) => !deletedPlaceIds.includes(place.id))),
    [deletedPlaceIds, localPlaces, seedPlaces]
  );

  useEffect(() => {
    setCache({ events, places, timestamp: new Date().toISOString() });
  }, [events, places, setCache]);

  const effectiveEvents = events.length ? events : cache.events || [];
  const effectivePlaces = places.length ? places : cache.places || [];
  const selectedItem = selected?.type === "event" ? effectiveEvents.find((event) => event.id === selected.id) : effectivePlaces.find((place) => place.id === selected?.id);
  const selectedReviews = selectedItem ? getReviews(selected.type, selectedItem.id, userReviews) : [];

  const eventSearch = (event) =>
    `${l(event.title)} ${l(event.location)} ${event.venue || ""} ${event.organizer?.name || ""} ${l(event.shortDescription)} ${l(event.fullDescription)} ${event.tags?.join(" ") || ""} ${t(`categories.${event.category}`)}`.toLowerCase();

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return effectiveEvents
      .filter((event) => {
        const eventDate = parseDate(event.date);
        const matchesQuery = !normalizedQuery || eventSearch(event).includes(normalizedQuery);
        const matchesCategory = eventCategory === "all" || event.category === eventCategory;
        const matchesDate =
          dateFilter === "all" ||
          (dateFilter === "today" && event.date === todayValue) ||
          (dateFilter === "tonight" && isSmartTonight(event, todayValue, nowMinutes)) ||
          (dateFilter === "week" && eventDate && eventDate >= today && eventDate <= weekEnd) ||
          (dateFilter === "weekend" && isWeekend(event, today, weekEnd));
        return matchesQuery && matchesCategory && matchesDate && matchesQuickFilters(event, quickFilters, today, weekEnd, todayValue, nowMinutes);
      })
      .sort((a, b) => {
        if (eventSort === "date") return `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);
        if (eventSort === "rating") return averageRating(b, getReviews("event", b.id, userReviews)) - averageRating(a, getReviews("event", a.id, userReviews));
        return popularityScore(b, accounts, userReviews) - popularityScore(a, accounts, userReviews);
      });
  }, [accounts, dateFilter, effectiveEvents, eventCategory, eventSort, language, nowMinutes, query, quickFilters, today, todayValue, userReviews, weekEnd]);

  const visiblePlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return effectivePlaces
      .filter((place) => {
        const searchable = `${place.name} ${l(place.location)} ${l(place.cuisine)} ${l(place.description)} ${place.tags?.join(" ") || ""} ${t(`categories.${place.category}`)}`.toLowerCase();
        return (!normalizedQuery || searchable.includes(normalizedQuery)) && (placeCategory === "all" || place.category === placeCategory);
      })
      .sort((a, b) =>
        placeSort === "price"
          ? String(a.priceRange || "").length - String(b.priceRange || "").length
          : averageRating(b, getReviews("place", b.id, userReviews)) - averageRating(a, getReviews("place", a.id, userReviews))
      );
  }, [effectivePlaces, language, placeCategory, placeSort, query, userReviews]);

  const trendingEvents = [...effectiveEvents].sort((a, b) => popularityScore(b, accounts, userReviews) - popularityScore(a, accounts, userReviews)).slice(0, 3);
  const tonightEvents = effectiveEvents.filter((event) => isSmartTonight(event, todayValue, nowMinutes)).slice(0, 4);
  const topPlaces = [...effectivePlaces].sort((a, b) => averageRating(b, getReviews("place", b.id, userReviews)) - averageRating(a, getReviews("place", a.id, userReviews))).slice(0, 3);

  function formatDate(value, full = false) {
    const date = parseDate(value);
    if (!date) return t("misc.dateTba");
    return new Intl.DateTimeFormat(locale, full ? { weekday: "long", month: "long", day: "numeric", year: "numeric" } : { weekday: "short", month: "short", day: "numeric" }).format(date);
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2500);
  }

  function setView(view) {
    setSelected(null);
    setActiveView(view);
    setIsMenuOpen(false);
    const nextPath = view === "admin" ? "/admin" : "/";
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }

  function updateUser(patch) {
    if (!user) return;
    setAccounts((current) => current.map((account) => (account.id === user.id ? { ...account, ...patch } : account)));
  }

  function requireUser(messageKey) {
    if (user) return true;
    showToast(t(messageKey));
    setView("profile");
    return false;
  }

  function requireAdmin() {
    if (isAdmin) return true;
    showToast(t("messages.accessDenied"));
    if (!user) setView("profile");
    return false;
  }

  function toggleFavorite(type, id) {
    if (!requireUser("messages.signInToSave")) return;
    const key = makeKey(type, id);
    updateUser({ favorites: userFavorites.includes(key) ? userFavorites.filter((item) => item !== key) : [...userFavorites, key] });
    showToast(t("messages.favoriteUpdated"));
  }

  function toggleGoing(id) {
    if (!requireUser("messages.signInToGoing")) return;
    updateUser({ going: userGoing.includes(id) ? userGoing.filter((item) => item !== id) : [...userGoing, id] });
    showToast(t("messages.goingUpdated"));
  }

  async function shareEvent(event) {
    const url = `${window.location.origin}${window.location.pathname}#event-${event.id}`;
    const text = `${l(event.title)} - ${formatDate(event.date)} ${event.startTime}`;
    try {
      if (navigator.share) await navigator.share({ title: l(event.title), text, url });
      else if (navigator.clipboard) await navigator.clipboard.writeText(url);
      showToast(t("messages.shareCopied"));
    } catch {
      showToast(t("messages.shareCopied"));
    }
  }

  function directionsUrl(item) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${VARNA_CENTER.lat}%2C${VARNA_CENTER.lng}%3B${item.lat}%2C${item.lng}`;
  }

  function handleAuthSubmit(event) {
    event.preventDefault();
    const email = authDraft.email.trim().toLowerCase();
    const password = authDraft.password;
    const username = authDraft.username.trim() || email.split("@")[0] || "varna-user";
    if (!email || !password) return showToast(t("messages.emailPasswordRequired"));
    if (authMode === "register") {
      if (accounts.some((account) => account.email === email)) return showToast(t("messages.accountExists"));
      const account = { id: `user-${Date.now()}`, email, password, username, role: "user", token: `mock-jwt-${Date.now()}`, favorites: [], going: [], reviews: [] };
      setAccounts((current) => [...current, account]);
      setSession({ userId: account.id, token: account.token });
      setAuthDraft({ email: "", password: "", username: "" });
      return showToast(t("messages.accountCreated"));
    }
    const account = accounts.find((item) => item.email === email && item.password === password);
    if (!account) return showToast(t("messages.invalidCredentials"));
    setSession({ userId: account.id, token: account.token || `mock-jwt-${account.id}` });
    setAuthDraft({ email: "", password: "", username: "" });
    showToast(t("messages.signedIn"));
  }

  function submitReview(event) {
    event.preventDefault();
    if (!selectedItem || !selected?.type || !requireUser("messages.signInToReview")) return;
    if (!reviewDraft.comment.trim()) return showToast(t("messages.reviewRequired"));
    const review = { id: `review-${Date.now()}`, targetType: selected.type, targetId: selectedItem.id, rating: Number(reviewDraft.rating), comment: reviewDraft.comment.trim(), date: dateKey(new Date()) };
    updateUser({ reviews: [...(user.reviews || []), review] });
    setReviewDraft({ rating: "5", comment: "" });
    showToast(t("messages.reviewAdded"));
  }

  function openItem(type, id) {
    setSelected({ type, id });
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleQuickFilter(filter) {
    setQuickFilters((current) => (current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]));
  }

  function saveAdminEvent(event) {
    event.preventDefault();
    if (!requireAdmin()) return;
    if (!adminEventDraft.titleBg.trim() || !adminEventDraft.date || !adminEventDraft.locationBg.trim()) return showToast(t("messages.missingEventFields"));
    const record = normalizeEvent(
      {
        id: adminEventDraft.id || `event-admin-${Date.now()}`,
        source: "Admin manual",
        title: { bg: adminEventDraft.titleBg.trim(), en: adminEventDraft.titleEn.trim() || adminEventDraft.titleBg.trim() },
        date: adminEventDraft.date,
        startTime: adminEventDraft.startTime,
        endTime: adminEventDraft.endTime,
        location: { bg: adminEventDraft.locationBg.trim(), en: adminEventDraft.locationEn.trim() || adminEventDraft.locationBg.trim() },
        category: adminEventDraft.category,
        shortDescription: { bg: adminEventDraft.shortDescriptionBg, en: adminEventDraft.shortDescriptionEn || adminEventDraft.shortDescriptionBg },
        fullDescription: { bg: safeArray(adminEventDraft.fullDescriptionBg || adminEventDraft.shortDescriptionBg), en: safeArray(adminEventDraft.fullDescriptionEn || adminEventDraft.shortDescriptionEn || adminEventDraft.shortDescriptionBg) },
        organizer: { name: adminEventDraft.organizerName, contact: adminEventDraft.organizerContact, link: adminEventDraft.organizerLink },
        ticket: { price: adminEventDraft.ticketPrice, link: adminEventDraft.ticketLink },
        sourceUrl: adminEventDraft.sourceUrl,
        images: [safeImage(adminEventDraft.image)],
        image: safeImage(adminEventDraft.image),
        coordinates: { lat: Number(adminEventDraft.lat) || VARNA_CENTER.lat, lng: Number(adminEventDraft.lng) || VARNA_CENTER.lng },
        schedule: [{ time: adminEventDraft.startTime, bg: adminEventDraft.titleBg, en: adminEventDraft.titleEn || adminEventDraft.titleBg }],
        badges: commaList(adminEventDraft.badges),
        tags: commaList(adminEventDraft.tags),
        reviews: []
      },
      today
    );
    setLocalEvents((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    setDeletedEventIds((current) => current.filter((id) => id !== record.id));
    setAdminEventDraft(createEmptyAdminEvent(todayValue));
    showToast(adminEventDraft.id ? t("messages.eventUpdated") : t("messages.eventSaved"));
  }

  function saveAdminPlace(event) {
    event.preventDefault();
    if (!requireAdmin()) return;
    if (!adminPlaceDraft.name.trim() || !adminPlaceDraft.locationBg.trim()) return showToast(t("messages.missingPlaceFields"));
    const record = normalizePlace({
      id: adminPlaceDraft.id || `place-admin-${Date.now()}`,
      name: adminPlaceDraft.name.trim(),
      type: adminPlaceDraft.type,
      category: adminPlaceDraft.type,
      cuisine: { bg: adminPlaceDraft.cuisineBg, en: adminPlaceDraft.cuisineEn || adminPlaceDraft.cuisineBg },
      priceRange: adminPlaceDraft.priceRange,
      location: { bg: adminPlaceDraft.locationBg, en: adminPlaceDraft.locationEn || adminPlaceDraft.locationBg },
      description: { bg: adminPlaceDraft.descriptionBg, en: adminPlaceDraft.descriptionEn || adminPlaceDraft.descriptionBg },
      openingHours: adminPlaceDraft.openingHours,
      image: safeImage(adminPlaceDraft.image),
      coordinates: { lat: Number(adminPlaceDraft.lat) || VARNA_CENTER.lat, lng: Number(adminPlaceDraft.lng) || VARNA_CENTER.lng },
      badges: commaList(adminPlaceDraft.badges),
      tags: commaList(adminPlaceDraft.tags),
      reviews: [],
      rating: 0
    });
    setLocalPlaces((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    setDeletedPlaceIds((current) => current.filter((id) => id !== record.id));
    setAdminPlaceDraft(createEmptyAdminPlace());
    showToast(adminPlaceDraft.id ? t("messages.placeUpdated") : t("messages.placeSaved"));
  }

  function editAdminEvent(event) {
    if (!requireAdmin()) return;
    setAdminEventDraft({
      id: event.id,
      titleBg: event.title?.bg || l(event.title),
      titleEn: event.title?.en || l(event.title),
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      locationBg: event.location?.bg || l(event.location),
      locationEn: event.location?.en || l(event.location),
      category: event.category,
      shortDescriptionBg: event.shortDescription?.bg || l(event.shortDescription),
      shortDescriptionEn: event.shortDescription?.en || l(event.shortDescription),
      fullDescriptionBg: safeArray(event.fullDescription?.bg || event.fullDescription).join("\n"),
      fullDescriptionEn: safeArray(event.fullDescription?.en || event.fullDescription).join("\n"),
      organizerName: event.organizer?.name || "",
      organizerContact: event.organizer?.contact || "",
      organizerLink: event.organizer?.link || "",
      ticketPrice: event.ticket?.price || "",
      ticketLink: event.ticket?.link || "",
      sourceUrl: event.sourceUrl || "",
      image: event.image || "",
      lat: String(event.lat),
      lng: String(event.lng),
      badges: (event.badges || []).join(","),
      tags: (event.tags || []).join(",")
    });
    setAdminTab("events");
  }

  function editAdminPlace(place) {
    if (!requireAdmin()) return;
    setAdminPlaceDraft({
      id: place.id,
      name: place.name,
      type: place.category,
      cuisineBg: place.cuisine?.bg || l(place.cuisine),
      cuisineEn: place.cuisine?.en || l(place.cuisine),
      priceRange: place.priceRange,
      locationBg: place.location?.bg || l(place.location),
      locationEn: place.location?.en || l(place.location),
      descriptionBg: place.description?.bg || l(place.description),
      descriptionEn: place.description?.en || l(place.description),
      openingHours: place.openingHours || "",
      image: place.image || "",
      lat: String(place.lat),
      lng: String(place.lng),
      badges: (place.badges || []).join(","),
      tags: (place.tags || []).join(",")
    });
    setAdminTab("places");
  }

  function deleteAdminEvent(id) {
    if (!requireAdmin()) return;
    setDeletedEventIds((current) => [...new Set([...current, id])]);
    setLocalEvents((current) => current.filter((item) => item.id !== id));
    showToast(t("messages.eventDeleted"));
  }

  function deleteAdminPlace(id) {
    if (!requireAdmin()) return;
    setDeletedPlaceIds((current) => [...new Set([...current, id])]);
    setLocalPlaces((current) => current.filter((item) => item.id !== id));
    showToast(t("messages.placeDeleted"));
  }

  function importVisitVarnaEvents() {
    if (!requireAdmin()) return;
    const records = (importedVisitVarnaEvents || []).map((event) => normalizeEvent(event, today));
    if (!records.length) return showToast(t("messages.importNoEvents"));

    const existingKeys = new Set(localEvents.map((event) => naturalEventKey(normalizeEvent(event, today), "bg")));
    const newRecords = records.filter((record) => {
      const key = naturalEventKey(record, "bg");
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    setLocalEvents((current) => [...newRecords, ...current]);
    setDeletedEventIds((current) => current.filter((id) => !records.some((record) => record.id === id)));
    showToast(newRecords.length ? t("messages.importedEvents").replace("{count}", newRecords.length) : t("messages.importNoNewEvents"));
  }

  const props = {
    accounts,
    activeView,
    adminEventDraft,
    adminPlaceDraft,
    adminTab,
    dateFilter,
    directionsUrl,
    eventCategory,
    eventSort,
    events: effectiveEvents,
    favoritesTab,
    formatDate,
    isMenuOpen,
    isAdmin,
    importVisitVarnaEvents,
    importedEventsCount: (importedVisitVarnaEvents || []).length,
    language,
    l,
    locale,
    openItem,
    places: effectivePlaces,
    placeCategory,
    placeSort,
    query,
    quickFilters,
    selectedItem,
    selectedReviews,
    selectedType: selected?.type,
    session,
    setActiveView: setView,
    setAdminEventDraft,
    setAdminPlaceDraft,
    setAdminTab,
    setAuthDraft,
    setAuthMode,
    setDateFilter,
    setEventCategory,
    setEventSort,
    setFavoritesTab,
    setIsMenuOpen,
    setLanguage,
    setPlaceCategory,
    setPlaceSort,
    setQuery,
    shareEvent,
    t,
    toggleFavorite,
    toggleGoing,
    toggleQuickFilter,
    topPlaces,
    trendingEvents,
    tonightEvents,
    user,
    userFavorites,
    userGoing,
    userReviews,
    visibleEvents,
    visiblePlaces
  };

  return (
    <main className="app-shell">
      <div className="app-container">
        <Header {...props} />
        {isLoading ? (
          <div className="loading-panel">{t("messages.loading")}</div>
        ) : selectedItem ? (
          <DetailsView
            {...props}
            isFavorite={userFavorites.includes(makeKey(selected.type, selectedItem.id))}
            onBack={() => setSelected(null)}
            reviewDraft={reviewDraft}
            setReviewDraft={setReviewDraft}
            submitReview={submitReview}
          />
        ) : (
          <>
            {activeView === "home" && <HomeView {...props} />}
            {activeView === "events" && <EventsView {...props} />}
            {activeView === "places" && <PlacesView {...props} />}
            {activeView === "favorites" && <FavoritesView {...props} />}
            {activeView === "map" && <MapView {...props} />}
            {activeView === "profile" && (
              <ProfileView
                {...props}
                authDraft={authDraft}
                authMode={authMode}
                handleAuthSubmit={handleAuthSubmit}
                logout={() => {
                  setSession(null);
                  showToast(t("messages.signedOut"));
                }}
              />
            )}
            {activeView === "admin" && !user && (
              <ProfileView
                {...props}
                authDraft={authDraft}
                authMode={authMode}
                handleAuthSubmit={handleAuthSubmit}
                logout={() => {
                  setSession(null);
                  showToast(t("messages.signedOut"));
                }}
              />
            )}
            {activeView === "admin" && user && !isAdmin && <AccessDenied t={t} />}
            {activeView === "admin" && isAdmin && (
              <AdminView
                {...props}
                deleteAdminEvent={deleteAdminEvent}
                deleteAdminPlace={deleteAdminPlace}
                editAdminEvent={editAdminEvent}
                editAdminPlace={editAdminPlace}
                saveAdminEvent={saveAdminEvent}
                saveAdminPlace={saveAdminPlace}
              />
            )}
          </>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function matchesQuickFilters(event, filters, today, weekEnd, todayValue, nowMinutes) {
  if (!filters.length) return true;
  return filters.every((filter) => {
    if (filter === "today") return event.date === todayValue;
    if (filter === "tonight") return isSmartTonight(event, todayValue, nowMinutes);
    if (filter === "weekend") return isWeekend(event, today, weekEnd);
    if (filter === "free") return isFreeEvent(event);
    if (filter === "paid") return !isFreeEvent(event);
    if (["concerts", "festivals", "nightlife", "culture"].includes(filter)) return event.category === filter;
    if (filter === "food") return event.category === "food" || (event.tags || []).join(" ").toLowerCase().includes("food") || (event.badges || []).includes("foodNearby");
    if (filter === "near") return distanceKm({ coordinates: VARNA_CENTER }, event) <= 3;
    return true;
  });
}

function commaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Header({ activeView, isAdmin, isMenuOpen, language, setActiveView, setIsMenuOpen, setLanguage, t, user, userFavorites, formatDate }) {
  const navItems = [
    ["home", t("nav.home")],
    ["events", t("nav.events")],
    ["places", t("nav.places")],
    ["favorites", t("nav.favorites")],
    ["map", t("nav.map")],
    ["profile", user ? t("nav.profile") : t("nav.account")]
  ];
  if (isAdmin) navItems.push(["admin", t("nav.admin")]);
  return (
    <header className="site-header wide">
      <button className="brand" onClick={() => setActiveView("home")} type="button">
        <span className="brand-mark">VH</span>
        <span>
          <span className="brand-title">{t("app.name")}</span>
          <span className="brand-subtitle">{userFavorites.length} {t("app.savedPicks")}</span>
        </span>
      </button>
      <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} type="button">☰</button>
      <nav className={isMenuOpen ? "top-nav open" : "top-nav"} aria-label="Primary">
        {navItems.map(([id, label]) => (
          <button className={activeView === id ? "active" : ""} key={id} onClick={() => setActiveView(id)} type="button">{label}</button>
        ))}
      </nav>
      <div className="header-tools">
        <button className={language === "bg" ? "active" : ""} onClick={() => setLanguage("bg")} type="button">BG</button>
        <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} type="button">EN</button>
      </div>
      <div className="today-chip"><span>{t("app.today")}</span><strong>{formatDate(dateKey(new Date()))}</strong></div>
    </header>
  );
}

function HomeView(props) {
  const { l, openItem, setActiveView, t, tonightEvents, topPlaces, trendingEvents, visibleEvents, formatDate } = props;
  const hasSearchContext = props.query.trim() || props.quickFilters.length;
  return (
    <section className="view-stack">
      <div className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">{t("app.tagline")}</p>
          <h1>{t("app.name")}</h1>
          <p>{t("app.intro")}</p>
        </div>
        <div className="hero-stat-grid">
          <Stat label={t("home.statsTrending")} value={trendingEvents.length} />
          <Stat label={t("home.statsTonight")} value={tonightEvents.length} />
          <Stat label={t("home.statsTopEats")} value={topPlaces.length} />
        </div>
      </div>
      <SearchFilters {...props} />
      {hasSearchContext && (
        <>
          <SectionTitle kicker={t("quickFilters.title")} title={t("nav.events")} />
          {visibleEvents.length ? <div className="card-grid two">{visibleEvents.slice(0, 4).map((event) => <EventCard {...props} event={event} key={event.id} />)}</div> : <EmptyState title={t("messages.noEvents")} text={t("messages.tryDifferent")} />}
        </>
      )}
      <SectionTitle kicker={t("home.popularNow")} title={t("home.trending")} />
      <div className="card-grid three">{trendingEvents.map((event) => <EventCard {...props} compact event={event} key={event.id} />)}</div>
      <SectionTitle kicker={t("home.dateKicker")} title={t("home.tonight")} />
      <div className="rail-list">
        {tonightEvents.length ? tonightEvents.map((event) => <EventRow event={event} formatDate={formatDate} key={event.id} l={l} onOpen={() => openItem("event", event.id)} t={t} />) : <TonightFallback places={topPlaces} setActiveView={setActiveView} t={t} />}
      </div>
      <SectionTitle kicker={t("home.foodKicker")} title={t("home.topPlaces")} />
      <div className="card-grid three">{topPlaces.map((place) => <PlaceCard {...props} compact key={place.id} place={place} />)}</div>
    </section>
  );
}

function SearchFilters({ dateFilter, eventCategory, eventSort, quickFilters, query, setDateFilter, setEventCategory, setEventSort, setQuery, t, toggleQuickFilter }) {
  return (
    <section className="search-filter-panel">
      <SectionTitle kicker={t("quickFilters.title")} title={t("filters.search")} />
      <div className="filters-panel enhanced">
        <SearchField label={t("filters.search")} onChange={setQuery} placeholder={t("filters.searchEventsPlaceholder")} value={query} />
        <SelectField label={t("filters.date")} labels={optionLabels(t)} onChange={setDateFilter} options={DATE_FILTERS} value={dateFilter} />
        <SelectField label={t("filters.category")} labels={categoryLabels(t)} onChange={setEventCategory} options={EVENT_CATEGORIES} value={eventCategory} />
        <SelectField label={t("filters.sort")} labels={optionLabels(t)} onChange={setEventSort} options={SORTS} value={eventSort} />
      </div>
      <div className="quick-filter-row">
        {QUICK_FILTERS.map((filter) => (
          <button className={quickFilters.includes(filter) ? "active" : ""} key={filter} onClick={() => toggleQuickFilter(filter)} type="button">{t(`quickFilters.${filter}`)}</button>
        ))}
      </div>
    </section>
  );
}

function EventsView(props) {
  const { t, visibleEvents } = props;
  return (
    <section className="view-stack">
      <SectionTitle kicker={t("misc.duplicateFiltered")} title={t("nav.events")} />
      <SearchFilters {...props} />
      {visibleEvents.length ? <div className="card-grid two">{visibleEvents.map((event) => <EventCard {...props} event={event} key={event.id} />)}</div> : <EmptyState title={t("messages.noEvents")} text={t("messages.tryDifferent")} />}
    </section>
  );
}

function PlacesView(props) {
  const { placeCategory, placeSort, query, setPlaceCategory, setPlaceSort, setQuery, t, visiblePlaces } = props;
  return (
    <section className="view-stack">
      <SectionTitle kicker={t("home.foodKicker")} title={t("nav.places")} />
      <div className="filters-panel places">
        <SearchField label={t("filters.search")} onChange={setQuery} placeholder={t("filters.searchPlacesPlaceholder")} value={query} />
        <SelectField label={t("filters.category")} labels={categoryLabels(t)} onChange={setPlaceCategory} options={PLACE_CATEGORIES} value={placeCategory} />
        <SelectField label={t("filters.sort")} labels={optionLabels(t)} onChange={setPlaceSort} options={["rating", "price"]} value={placeSort} />
      </div>
      {visiblePlaces.length ? <div className="card-grid two">{visiblePlaces.map((place) => <PlaceCard {...props} key={place.id} place={place} />)}</div> : <EmptyState title={t("messages.noPlaces")} text={t("messages.tryDifferent")} />}
    </section>
  );
}

function TonightFallback({ places, setActiveView, t }) {
  return (
    <div className="fallback-card">
      <h3>{t("messages.noTonight")}</h3>
      <p>{t("messages.tonightFallback")}</p>
      <div className="fallback-places">{places.slice(0, 3).map((place) => <span key={place.id}>{place.name}</span>)}</div>
      <button className="primary-action" onClick={() => setActiveView("places")} type="button">{t("nav.places")}</button>
    </div>
  );
}

function FavoritesView(props) {
  const { events, favoritesTab, places, setFavoritesTab, t, userFavorites } = props;
  const savedEvents = events.filter((event) => userFavorites.includes(makeKey("event", event.id)));
  const savedPlaces = places.filter((place) => userFavorites.includes(makeKey("place", place.id)));
  return (
    <section className="view-stack">
      <SectionTitle kicker={t("app.savedPicks")} title={t("favorites.title")} />
      <div className="segmented compact-tabs">
        <button className={favoritesTab === "events" ? "active" : ""} onClick={() => setFavoritesTab("events")} type="button">{t("favorites.events")}</button>
        <button className={favoritesTab === "places" ? "active" : ""} onClick={() => setFavoritesTab("places")} type="button">{t("favorites.places")}</button>
      </div>
      {favoritesTab === "events" && (savedEvents.length ? <div className="card-grid two">{savedEvents.map((event) => <EventCard {...props} event={event} key={event.id} />)}</div> : <EmptyState title={t("favorites.emptyEvents")} text={t("messages.signInToSave")} />)}
      {favoritesTab === "places" && (savedPlaces.length ? <div className="card-grid two">{savedPlaces.map((place) => <PlaceCard {...props} key={place.id} place={place} />)}</div> : <EmptyState title={t("favorites.emptyPlaces")} text={t("messages.signInToSave")} />)}
    </section>
  );
}

function DetailsView(props) {
  const { accounts, formatDate, isFavorite, l, onBack, openItem, places, reviewDraft, selectedItem: item, selectedReviews, selectedType, setReviewDraft, shareEvent, submitReview, t, toggleFavorite, toggleGoing, user, userGoing, userReviews } = props;
  const isEvent = selectedType === "event";
  const reviews = [...(item.reviews || []), ...selectedReviews];
  const rating = averageRating(item, selectedReviews);
  const nearPlaces = isEvent ? places.map((place) => ({ ...place, distance: distanceKm(item, place) })).sort((a, b) => a.distance - b.distance).slice(0, 3) : [];
  const gallery = item.images?.length ? item.images : [item.image];
  const osmUrl = `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lng}#map=17/${item.lat}/${item.lng}`;

  return (
    <section className="view-stack">
      <button className="ghost-button self-start" onClick={onBack} type="button">{t("actions.back")}</button>
      <article className="detail-panel">
        <div className="detail-media">
          <img alt="" src={safeImage(item.image)} />
          <div className="detail-overlay">
            <BadgeList badges={isEvent ? item.badges : item.badges || []} t={t} />
            <h1>{isEvent ? l(item.title) : item.name}</h1>
            <p>{l(item.location) || t("misc.locationTba")}</p>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-main">
            <SectionTitle kicker={isEvent ? item.source : t(`categories.${item.category}`)} title={t("details.fullDescription")} />
            <RichText paragraphs={isEvent ? safeArray(item.fullDescription?.[props.language] || item.fullDescription?.en || item.fullDescription) : [l(item.description)]} />
            <div className="info-grid">
              {isEvent ? (
                <>
                  <InfoTile label={t("details.date")} value={formatDate(item.date, true)} />
                  <InfoTile label={t("details.time")} value={`${item.startTime || t("misc.timeTba")} - ${item.endTime || t("details.ends")}`} />
                  <InfoTile label={t("details.popularity")} value={`${Math.round(popularityScore(item, accounts, userReviews))}`} />
                </>
              ) : (
                <>
                  <InfoTile label={t("details.cuisine")} value={l(item.cuisine)} />
                  <InfoTile label={t("details.price")} value={item.priceRange || "$"} />
                  <InfoTile label={t("details.location")} value={l(item.location)} />
                </>
              )}
            </div>
            <div className="actions-row">
              <a className="primary-action" href={osmUrl} rel="noreferrer" target="_blank">{t("actions.openOsm")}</a>
              <button className={isFavorite ? "secondary-action active" : "secondary-action"} onClick={() => toggleFavorite(selectedType, item.id)} type="button">{isFavorite ? t("actions.saved") : t("actions.save")}</button>
              {isEvent && <button className={userGoing.includes(item.id) ? "secondary-action active" : "secondary-action"} onClick={() => toggleGoing(item.id)} type="button">{userGoing.includes(item.id) ? t("actions.going") : t("actions.markGoing")}</button>}
              {isEvent && <button className="secondary-action" onClick={() => shareEvent(item)} type="button">{t("actions.share")}</button>}
            </div>
            {isEvent && <EventExtraSections event={item} gallery={gallery} l={l} t={t} />}
            {nearPlaces.length > 0 && (
              <>
                <SectionTitle kicker={t("details.nearby")} title={t("details.nearby")} />
                <div className="near-list">
                  {nearPlaces.map((place) => (
                    <button className="near-item" key={place.id} onClick={() => openItem("place", place.id)} type="button">
                      <span><strong>{place.name}</strong><small>{l(place.cuisine)} - {place.priceRange}</small></span>
                      <b>{place.distance.toFixed(1)} {t("misc.km")}</b>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="detail-side">
            <div className="rating-box"><span>{rating ? rating.toFixed(1) : t("details.newRating")}</span><p>{reviews.length} {t("details.reviews")}</p></div>
            <div className="mini-map">
              <MapContainer center={[item.lat, item.lng]} className="hub-map" scrollWheelZoom={false} zoom={15}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker icon={isEvent ? eventMarker : placeMarker} position={[item.lat, item.lng]} />
              </MapContainer>
            </div>
          </aside>
        </div>
      </article>
      <ReviewsPanel currentUser={user} reviewDraft={reviewDraft} reviews={reviews} setReviewDraft={setReviewDraft} submitReview={submitReview} t={t} />
    </section>
  );
}

function EventExtraSections({ event, gallery, l, t }) {
  return (
    <>
      <SectionTitle kicker={t("details.gallery")} title={t("details.gallery")} />
      <div className="gallery-grid">{gallery.map((image) => <img alt="" key={image} src={safeImage(image)} />)}</div>
      <div className="detail-extra-grid">
        <InfoPanel title={t("details.organizer")}>
          <p><strong>{event.organizer?.name || "-"}</strong></p>
          {event.organizer?.contact && <p>{t("details.contact")}: {event.organizer.contact}</p>}
          {event.organizer?.link && <a href={event.organizer.link} rel="noreferrer" target="_blank">{t("details.website")}</a>}
        </InfoPanel>
        <InfoPanel title={t("details.ticket")}>
          <p>{t("details.ticketPrice")}: <strong>{event.ticket?.price || "-"}</strong></p>
          {event.ticket?.link && <a href={event.ticket.link} rel="noreferrer" target="_blank">{t("details.ticketLink")}</a>}
        </InfoPanel>
        <InfoPanel title={t("details.schedule")}>
          <div className="schedule-list">{(event.schedule || []).map((item) => <p key={`${item.time}-${l(item)}`}><strong>{item.time}</strong> {l(item)}</p>)}</div>
        </InfoPanel>
        {event.sourceUrl && (
          <InfoPanel title={t("details.source")}>
            <p><strong>{event.source || "Visit Varna"}</strong></p>
            <a href={event.sourceUrl} rel="noreferrer" target="_blank">{t("details.officialPage")}</a>
          </InfoPanel>
        )}
      </div>
    </>
  );
}

function MapView({ events, l, openItem, places, t, formatDate }) {
  const markers = [
    ...events.map((event) => ({ type: "event", id: event.id, lat: event.lat, lng: event.lng, title: l(event.title), subtitle: `${formatDate(event.date)} ${event.startTime || ""}` })),
    ...places.map((place) => ({ type: "place", id: place.id, lat: place.lat, lng: place.lng, title: place.name, subtitle: l(place.cuisine) }))
  ];
  const groups = groupMarkers(markers);
  return (
    <section className="view-stack">
      <SectionTitle kicker={t("misc.cluster")} title={t("nav.map")} />
      <div className="map-shell">
        <MapContainer center={[VARNA_CENTER.lat, VARNA_CENTER.lng]} className="hub-map" zoom={13}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {groups.map((group) => (
            <Marker icon={group.items.length > 1 ? clusterMarker(group.items.length) : group.items[0].type === "event" ? eventMarker : placeMarker} key={group.key} position={[group.lat, group.lng]}>
              <Popup>
                {group.items.map((item) => (
                  <div className="popup-row" key={`${item.type}:${item.id}`}>
                    <strong>{item.title}</strong><br />{item.subtitle}<br />
                    <button className="popup-button" onClick={() => openItem(item.type, item.id)} type="button">{item.type === "event" ? t("actions.viewEvent") : t("actions.viewPlace")}</button>
                  </div>
                ))}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}

function groupMarkers(markers) {
  const map = new Map();
  for (const marker of markers) {
    const key = `${Number(marker.lat).toFixed(2)}:${Number(marker.lng).toFixed(2)}`;
    const group = map.get(key) || { key, lat: marker.lat, lng: marker.lng, items: [] };
    group.items.push(marker);
    group.lat = group.items.reduce((sum, item) => sum + Number(item.lat), 0) / group.items.length;
    group.lng = group.items.reduce((sum, item) => sum + Number(item.lng), 0) / group.items.length;
    map.set(key, group);
  }
  return [...map.values()];
}

function ProfileView({ authDraft, authMode, events, handleAuthSubmit, l, logout, places, setAuthDraft, setAuthMode, session, t, user, userFavorites, userReviews, openItem }) {
  if (!user) {
    return (
      <section className="view-stack">
        <SectionTitle kicker={t("auth.mockAuth")} title={t("nav.account")} />
        <form className="form-panel auth-panel" onSubmit={handleAuthSubmit}>
          <div className="segmented">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")} type="button">{t("actions.login")}</button>
            <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")} type="button">{t("actions.register")}</button>
          </div>
          {authMode === "register" && <LabelInput label={t("auth.username")} onChange={(value) => setAuthDraft((draft) => ({ ...draft, username: value }))} value={authDraft.username} />}
          <LabelInput label={t("auth.email")} onChange={(value) => setAuthDraft((draft) => ({ ...draft, email: value }))} type="email" value={authDraft.email} />
          <LabelInput label={t("auth.password")} onChange={(value) => setAuthDraft((draft) => ({ ...draft, password: value }))} type="password" value={authDraft.password} />
          <p className="muted">{t("auth.demoHint")}</p>
          <button className="primary-action" type="submit">{authMode === "register" ? t("actions.createAccount") : t("actions.login")}</button>
        </form>
      </section>
    );
  }
  const savedEvents = events.filter((event) => userFavorites.includes(makeKey("event", event.id)));
  const savedPlaces = places.filter((place) => userFavorites.includes(makeKey("place", place.id)));
  const myReviews = userReviews.filter((review) => review.username === user.username);
  return (
    <section className="view-stack">
      <SectionTitle kicker={t("auth.profile")} title={user.username} />
      <div className="account-grid">
        <div className="form-panel">
          <InfoTile label={t("auth.email")} value={user.email} />
          <InfoTile label={t("auth.token")} value={session?.token || "-"} />
          <InfoTile label={t("auth.savedEvents")} value={savedEvents.length} />
          <InfoTile label={t("auth.savedPlaces")} value={savedPlaces.length} />
          <button className="secondary-action" onClick={logout} type="button">{t("actions.logout")}</button>
        </div>
        <div className="saved-panel">
          <h2>{t("auth.myReviews")}</h2>
          {myReviews.length ? myReviews.map((review) => <button className="saved-item" key={review.id} onClick={() => openItem(review.targetType, review.targetId)} type="button">{review.rating}/5 - {review.comment}</button>) : <p className="muted">{t("reviews.empty")}</p>}
          <h2>{t("auth.savedEvents")}</h2>
          {savedEvents.map((event) => <button className="saved-item" key={event.id} onClick={() => openItem("event", event.id)} type="button">{l(event.title)}</button>)}
          <h2>{t("auth.savedPlaces")}</h2>
          {savedPlaces.map((place) => <button className="saved-item" key={place.id} onClick={() => openItem("place", place.id)} type="button">{place.name}</button>)}
        </div>
      </div>
    </section>
  );
}

function AdminView(props) {
  const { adminEventDraft, adminPlaceDraft, adminTab, deleteAdminEvent, deleteAdminPlace, editAdminEvent, editAdminPlace, events, importVisitVarnaEvents, importedEventsCount, l, places, saveAdminEvent, saveAdminPlace, setAdminEventDraft, setAdminPlaceDraft, setAdminTab, t } = props;
  return (
    <section className="view-stack">
      <SectionTitle kicker={t("admin.kicker")} title={t("admin.title")} />
      <div className="segmented compact-tabs">
        <button className={adminTab === "events" ? "active" : ""} onClick={() => setAdminTab("events")} type="button">{t("actions.newEvent")}</button>
        <button className={adminTab === "places" ? "active" : ""} onClick={() => setAdminTab("places")} type="button">{t("actions.newPlace")}</button>
      </div>
      {adminTab === "events" ? (
        <>
          <div className="form-panel admin-import-panel">
            <div>
              <h2>{t("admin.importTitle")}</h2>
              <p>{t("admin.importHelp").replace("{count}", importedEventsCount || 0)}</p>
            </div>
            <button className="primary-action" onClick={importVisitVarnaEvents} type="button">{t("actions.importEvents")}</button>
          </div>
          <AdminEventForm draft={adminEventDraft} save={saveAdminEvent} setDraft={setAdminEventDraft} t={t} />
          <AdminList deleteItem={deleteAdminEvent} editItem={editAdminEvent} items={events} label={(event) => `${l(event.title)} - ${l(event.location)}`} t={t} />
        </>
      ) : (
        <>
          <AdminPlaceForm draft={adminPlaceDraft} save={saveAdminPlace} setDraft={setAdminPlaceDraft} t={t} />
          <AdminList deleteItem={deleteAdminPlace} editItem={editAdminPlace} items={places} label={(place) => `${place.name} - ${textValue(place.location, "en")}`} t={t} />
        </>
      )}
    </section>
  );
}

function AccessDenied({ t }) {
  return (
    <section className="view-stack">
      <div className="empty-state">
        <h2>{t("messages.accessDenied")}</h2>
        <p>{t("nav.home")}</p>
      </div>
    </section>
  );
}

function AdminEventForm({ draft, save, setDraft, t }) {
  return (
    <form className="form-panel admin-form" onSubmit={save}>
      <LabelInput label={`${t("admin.titleField")} BG`} onChange={(value) => setDraft((d) => ({ ...d, titleBg: value }))} value={draft.titleBg} />
      <LabelInput label={`${t("admin.titleField")} EN`} onChange={(value) => setDraft((d) => ({ ...d, titleEn: value }))} value={draft.titleEn} />
      <LabelInput label={t("admin.dateField")} onChange={(value) => setDraft((d) => ({ ...d, date: value }))} type="date" value={draft.date} />
      <LabelInput label={t("admin.startField")} onChange={(value) => setDraft((d) => ({ ...d, startTime: value }))} type="time" value={draft.startTime} />
      <LabelInput label={t("admin.endField")} onChange={(value) => setDraft((d) => ({ ...d, endTime: value }))} type="time" value={draft.endTime} />
      <LabelInput label={`${t("admin.locationField")} BG`} onChange={(value) => setDraft((d) => ({ ...d, locationBg: value }))} value={draft.locationBg} />
      <LabelInput label={`${t("admin.locationField")} EN`} onChange={(value) => setDraft((d) => ({ ...d, locationEn: value }))} value={draft.locationEn} />
      <label><span>{t("admin.categoryField")}</span><select value={draft.category} onChange={(event) => setDraft((d) => ({ ...d, category: event.target.value }))}>{EVENT_CATEGORIES.filter((item) => item !== "all").map((category) => <option key={category} value={category}>{t(`categories.${category}`)}</option>)}</select></label>
      <LabelInput label={`${t("admin.descriptionField")} BG`} onChange={(value) => setDraft((d) => ({ ...d, shortDescriptionBg: value, fullDescriptionBg: value }))} value={draft.shortDescriptionBg} />
      <LabelInput label={`${t("admin.descriptionField")} EN`} onChange={(value) => setDraft((d) => ({ ...d, shortDescriptionEn: value, fullDescriptionEn: value }))} value={draft.shortDescriptionEn} />
      <LabelInput label={t("admin.organizerField")} onChange={(value) => setDraft((d) => ({ ...d, organizerName: value }))} value={draft.organizerName} />
      <LabelInput label={t("details.contact")} onChange={(value) => setDraft((d) => ({ ...d, organizerContact: value }))} value={draft.organizerContact} />
      <LabelInput label={t("details.website")} onChange={(value) => setDraft((d) => ({ ...d, organizerLink: value }))} value={draft.organizerLink} />
      <LabelInput label={t("admin.ticketPriceField")} onChange={(value) => setDraft((d) => ({ ...d, ticketPrice: value }))} value={draft.ticketPrice} />
      <LabelInput label={t("details.ticketLink")} onChange={(value) => setDraft((d) => ({ ...d, ticketLink: value }))} value={draft.ticketLink} />
      <LabelInput label={t("admin.sourceUrlField")} onChange={(value) => setDraft((d) => ({ ...d, sourceUrl: value }))} value={draft.sourceUrl} />
      <LabelInput label={t("admin.imageField")} onChange={(value) => setDraft((d) => ({ ...d, image: value }))} value={draft.image} />
      <LabelInput label={t("admin.latField")} onChange={(value) => setDraft((d) => ({ ...d, lat: value }))} value={draft.lat} />
      <LabelInput label={t("admin.lngField")} onChange={(value) => setDraft((d) => ({ ...d, lng: value }))} value={draft.lng} />
      <LabelInput label={t("admin.badgesField")} onChange={(value) => setDraft((d) => ({ ...d, badges: value }))} value={draft.badges} />
      <LabelInput label={t("admin.tagsField")} onChange={(value) => setDraft((d) => ({ ...d, tags: value }))} value={draft.tags} />
      <button className="primary-action" type="submit">{draft.id ? t("actions.edit") : t("actions.saveEvent")}</button>
    </form>
  );
}

function AdminPlaceForm({ draft, save, setDraft, t }) {
  return (
    <form className="form-panel admin-form" onSubmit={save}>
      <LabelInput label={t("admin.titleField")} onChange={(value) => setDraft((d) => ({ ...d, name: value }))} value={draft.name} />
      <label><span>{t("admin.categoryField")}</span><select value={draft.type} onChange={(event) => setDraft((d) => ({ ...d, type: event.target.value }))}>{PLACE_CATEGORIES.filter((item) => item !== "all").map((category) => <option key={category} value={category}>{t(`categories.${category}`)}</option>)}</select></label>
      <LabelInput label={`${t("details.cuisine")} BG`} onChange={(value) => setDraft((d) => ({ ...d, cuisineBg: value }))} value={draft.cuisineBg} />
      <LabelInput label={`${t("details.cuisine")} EN`} onChange={(value) => setDraft((d) => ({ ...d, cuisineEn: value }))} value={draft.cuisineEn} />
      <LabelInput label={t("details.price")} onChange={(value) => setDraft((d) => ({ ...d, priceRange: value }))} value={draft.priceRange} />
      <LabelInput label={`${t("admin.locationField")} BG`} onChange={(value) => setDraft((d) => ({ ...d, locationBg: value }))} value={draft.locationBg} />
      <LabelInput label={`${t("admin.locationField")} EN`} onChange={(value) => setDraft((d) => ({ ...d, locationEn: value }))} value={draft.locationEn} />
      <LabelInput label={`${t("admin.descriptionField")} BG`} onChange={(value) => setDraft((d) => ({ ...d, descriptionBg: value }))} value={draft.descriptionBg} />
      <LabelInput label={`${t("admin.descriptionField")} EN`} onChange={(value) => setDraft((d) => ({ ...d, descriptionEn: value }))} value={draft.descriptionEn} />
      <LabelInput label={t("admin.openingHoursField")} onChange={(value) => setDraft((d) => ({ ...d, openingHours: value }))} value={draft.openingHours} />
      <LabelInput label={t("admin.imageField")} onChange={(value) => setDraft((d) => ({ ...d, image: value }))} value={draft.image} />
      <LabelInput label={t("admin.latField")} onChange={(value) => setDraft((d) => ({ ...d, lat: value }))} value={draft.lat} />
      <LabelInput label={t("admin.lngField")} onChange={(value) => setDraft((d) => ({ ...d, lng: value }))} value={draft.lng} />
      <LabelInput label={t("admin.badgesField")} onChange={(value) => setDraft((d) => ({ ...d, badges: value }))} value={draft.badges} />
      <LabelInput label={t("admin.tagsField")} onChange={(value) => setDraft((d) => ({ ...d, tags: value }))} value={draft.tags} />
      <button className="primary-action" type="submit">{draft.id ? t("actions.edit") : t("actions.savePlace")}</button>
    </form>
  );
}

function AdminList({ deleteItem, editItem, items, label, t }) {
  return (
    <div className="saved-panel">
      <h2>{t("admin.existing")}</h2>
      {items.map((item) => (
        <div className="admin-list-row" key={item.id}>
          <button className="saved-item" onClick={() => editItem(item)} type="button">{label(item)}</button>
          <button className="danger-action" onClick={() => deleteItem(item.id)} type="button">{t("actions.delete")}</button>
        </div>
      ))}
    </div>
  );
}

function EventCard(props) {
  const { accounts = [], compact, event, formatDate, l, openItem, shareEvent, t, toggleFavorite, toggleGoing, userFavorites = [], userGoing = [], userReviews = [] } = props;
  const rating = averageRating(event, getReviews("event", event.id, userReviews));
  const saved = userFavorites.includes(makeKey("event", event.id));
  const going = userGoing.includes(event.id);
  return (
    <article className={compact ? "event-card compact" : "event-card"}>
      <button className="card-open" onClick={() => openItem("event", event.id)} type="button">
        <img alt="" src={safeImage(event.image)} />
        <span className="card-badge">{t(`categories.${event.category}`)}</span>
        <div className="card-body">
          <div><h2>{l(event.title) || t("misc.untitledEvent")}</h2><p>{l(event.location) || t("misc.locationTba")}</p></div>
          <BadgeList badges={event.badges || []} limit={compact ? 3 : 5} t={t} />
          <div className="meta-row"><span>{formatDate(event.date)}</span><span>{event.startTime || t("misc.timeTba")}</span><span>{rating ? `${rating.toFixed(1)}/5` : t("details.newRating")}</span><span>{Math.round(popularityScore(event, accounts, userReviews))}</span></div>
        </div>
      </button>
      <div className="card-actions event-actions">
        <button onClick={() => openItem("event", event.id)} type="button">{t("actions.viewDetails")}</button>
        <button className={saved ? "active" : ""} onClick={() => toggleFavorite("event", event.id)} type="button">{saved ? t("actions.saved") : t("actions.save")}</button>
        <button className={going ? "active" : ""} onClick={() => toggleGoing(event.id)} type="button">{going ? t("actions.going") : t("actions.markGoing")}</button>
        <button onClick={() => shareEvent(event)} type="button">{t("actions.share")}</button>
      </div>
    </article>
  );
}

function PlaceCard(props) {
  const { compact, directionsUrl, l, openItem, place, t, toggleFavorite, userFavorites = [], userReviews = [] } = props;
  const rating = averageRating(place, getReviews("place", place.id, userReviews));
  const saved = userFavorites.includes(makeKey("place", place.id));
  return (
    <article className={compact ? "place-card compact" : "place-card"}>
      <button className="card-open" onClick={() => openItem("place", place.id)} type="button">
        <img alt="" src={safeImage(place.image)} />
        <div className="card-body">
          <div className="place-title-row"><div><h2>{place.name || t("misc.unnamedPlace")}</h2><p>{l(place.cuisine)}</p></div><strong>{place.priceRange || "$"}</strong></div>
          <p className="description-line">{l(place.description) || t("misc.noDescription")}</p>
          <BadgeList badges={place.badges || []} limit={3} t={t} />
          <div className="meta-row"><span>{t(`categories.${place.category}`)}</span><span>{rating ? `${rating.toFixed(1)}/5` : t("details.newRating")}</span><span>{place.openingHours}</span></div>
        </div>
      </button>
      <div className="card-actions place-actions">
        <button className={saved ? "active" : ""} onClick={() => toggleFavorite("place", place.id)} type="button">{saved ? t("actions.saved") : t("actions.save")}</button>
        <a href={directionsUrl(place)} rel="noreferrer" target="_blank">{t("actions.directions")}</a>
        <button onClick={() => openItem("place", place.id)} type="button">{t("actions.reviews")}</button>
      </div>
    </article>
  );
}

function EventRow({ event, formatDate, l, onOpen, t }) {
  return (
    <button className="event-row" onClick={onOpen} type="button">
      <span><strong>{event.startTime || t("misc.timeTba")}</strong><small>{formatDate(event.date)}</small></span>
      <span><b>{l(event.title)}</b><small>{l(event.location)}</small></span>
      <span className="row-pill">{t(`categories.${event.category}`)}</span>
    </button>
  );
}

function BadgeList({ badges, limit = 8, t }) {
  return <div className="badge-list">{(badges || []).slice(0, limit).map((badge) => <span key={badge}>{t(`badges.${badge}`)}</span>)}</div>;
}

function ReviewsPanel({ currentUser, reviewDraft, reviews, setReviewDraft, submitReview, t }) {
  return (
    <section className="reviews-panel">
      <SectionTitle kicker={t("reviews.kicker")} title={t("reviews.title")} />
      <div className="reviews-layout">
        <form className="review-form" onSubmit={submitReview}>
          <label><span>{t("reviews.rating")}</span><select onChange={(event) => setReviewDraft((draft) => ({ ...draft, rating: event.target.value }))} value={reviewDraft.rating}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select></label>
          <label><span>{t("reviews.comment")}</span><textarea onChange={(event) => setReviewDraft((draft) => ({ ...draft, comment: event.target.value }))} placeholder={currentUser ? t("reviews.placeholderSignedIn") : t("reviews.placeholderSignedOut")} value={reviewDraft.comment} /></label>
          <button className="primary-action" type="submit">{t("actions.addReview")}</button>
        </form>
        <div className="review-list">
          {reviews.length ? reviews.map((review, index) => <article className="review-card" key={`${review.username}-${review.date}-${index}`}><div><strong>{review.username || t("reviews.guest")}</strong><span>{review.rating}/5</span></div><p>{review.comment}</p><time>{review.date}</time></article>) : <EmptyState title={t("reviews.empty")} text={t("reviews.placeholderSignedOut")} />}
        </div>
      </div>
    </section>
  );
}

function RichText({ paragraphs = [] }) {
  return <div className="rich-text">{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>;
}

function InfoPanel({ children, title }) {
  return <div className="info-panel"><h3>{title}</h3>{children}</div>;
}

function SectionTitle({ kicker, title }) {
  return <div className="section-title"><p>{kicker}</p><h2>{title}</h2></div>;
}

function Stat({ label, value }) {
  return <div className="stat-tile"><strong>{value}</strong><span>{label}</span></div>;
}

function InfoTile({ label, value }) {
  return <div className="info-tile"><span>{label}</span><strong>{value}</strong></div>;
}

function SearchField({ label, onChange, placeholder, value }) {
  return <label className="search-field"><span>{label}</span><input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" value={value} /></label>;
}

function SelectField({ label, labels, onChange, options, value }) {
  return <label className="select-field"><span>{label}</span><select onChange={(event) => onChange(event.target.value)} value={value}>{options.map((option) => <option key={option} value={option}>{labels[option] || option}</option>)}</select></label>;
}

function LabelInput({ label, onChange, type = "text", value }) {
  return <label><span>{label}</span><input onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label>;
}

function EmptyState({ text, title }) {
  return <div className="empty-state"><h2>{title}</h2><p>{text}</p></div>;
}

function categoryLabels(t) {
  return Object.fromEntries([...EVENT_CATEGORIES, ...PLACE_CATEGORIES].map((category) => [category, t(`categories.${category}`)]));
}

function optionLabels(t) {
  return {
    all: t("filters.all"),
    today: t("filters.today"),
    tonight: t("filters.tonight"),
    week: t("filters.week"),
    weekend: t("filters.weekend"),
    popularity: t("filters.popularity"),
    date: t("filters.dateSort"),
    rating: t("filters.rating"),
    price: t("filters.price")
  };
}
