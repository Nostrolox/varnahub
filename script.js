// Varna Parking
// Static app using Leaflet, OpenStreetMap, localStorage, and dynamic JSON data.

const DATA_URL = "parkingData.json";
const VARNA_CENTER = [43.2141, 27.9147];

// localStorage keys for the demo account system.
const storageKeys = {
  users: "varnaParkingUsers",
  currentUser: "varnaParkingCurrentUser"
};

// Shared app state. Keeping it in one object makes the beginner flow easier to follow.
const appState = {
  parkingData: {
    zones: [],
    free_parking: [],
    no_parking: []
  },
  map: null,
  layers: {},
  markerIndex: new Map(),
  activeLayers: {
    free: true,
    paid: true,
    noParking: true
  },
  currentUser: null,
  dataLoaded: false
};

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupAccount();
  setupPayment();
  setupLayerToggles();
  initMap();

  // Load JSON after the basic UI exists, so loading and error messages can be shown.
  await loadParkingData();
  renderAll();
});

async function loadParkingData() {
  setDataStatus("loading", "Loading parking data...");

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    validateParkingData(data);

    appState.parkingData = data;
    appState.dataLoaded = true;

    if (!data.zones.length) {
      setDataStatus("error", "No parking data found");
      setMapNote("No parking data found");
      return;
    }

    setDataStatus("success", "Parking data loaded");
    setMapNote("Mock parking data for learning. Check local signs before parking.");
  } catch (error) {
    console.error("Parking data failed to load:", error);
    appState.dataLoaded = false;
    setDataStatus("error", "Parking data unavailable");
    setMapNote("Parking data unavailable");
  }
}

function validateParkingData(data) {
  if (!data || !Array.isArray(data.zones)) {
    throw new Error("parkingData.json must include a zones array.");
  }

  if (!Array.isArray(data.free_parking)) {
    throw new Error("parkingData.json must include a free_parking array.");
  }

  if (!Array.isArray(data.no_parking)) {
    throw new Error("parkingData.json must include a no_parking array.");
  }
}

function hasAnyParkingData(data) {
  return data.zones.length || data.free_parking.length || data.no_parking.length;
}

function initMap() {
  const mapElement = document.getElementById("map");

  // If Leaflet CDN fails, keep the app usable and explain the problem.
  if (!window.L) {
    mapElement.innerHTML =
      '<div class="map-error">Map unavailable. Leaflet could not load.</div>';
    setMapNote("Map unavailable. Check your internet connection.");
    return;
  }

  try {
    appState.map = L.map("map", {
      zoomControl: true
    }).setView(VARNA_CENTER, 13);

    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    // Tile loading errors can happen offline or behind a firewall.
    tileLayer.on("tileerror", () => {
      setMapNote("Map tiles could not load. Parking data may still be visible.");
    });

    tileLayer.addTo(appState.map);

    appState.layers.free = L.layerGroup().addTo(appState.map);
    appState.layers.paid = L.layerGroup().addTo(appState.map);
    appState.layers.noParking = L.layerGroup().addTo(appState.map);
    appState.layers.favorites = L.layerGroup().addTo(appState.map);

    // Popup buttons are created by Leaflet, so one document listener catches them.
    document.addEventListener("click", handleMapActionClick);
  } catch (error) {
    console.error("Map failed to initialize:", error);
    mapElement.innerHTML = '<div class="map-error">Map unavailable.</div>';
    setMapNote("Map unavailable.");
  }
}

function drawParkingLayers() {
  if (!appState.map || !appState.dataLoaded) return;

  Object.values(appState.layers).forEach((layer) => layer.clearLayers());
  appState.markerIndex.clear();

  // Paid zones are drawn as blue polygons using the coordinates from JSON.
  appState.parkingData.zones.forEach((zone) => {
    if (!Array.isArray(zone.coordinates) || zone.coordinates.length < 3) return;

    const polygon = L.polygon(zone.coordinates, {
      color: "#2474d8",
      fillColor: "#2474d8",
      fillOpacity: 0.18,
      weight: 3
    }).bindPopup(createZonePopup(zone));

    polygon.addTo(appState.layers.paid);
  });

  // Free parking areas are green markers.
  appState.parkingData.free_parking.forEach((place) => {
    const marker = L.marker([place.lat, place.lng], {
      icon: createMarkerIcon("marker-free")
    }).bindPopup(createFreePopup(place));

    marker.addTo(appState.layers.free);
    appState.markerIndex.set(place.id, marker);
  });

  // No-parking points are red markers.
  appState.parkingData.no_parking.forEach((place) => {
    const marker = L.marker([place.lat, place.lng], {
      icon: createMarkerIcon("marker-no")
    }).bindPopup(createNoParkingPopup(place));

    marker.addTo(appState.layers.noParking);
    appState.markerIndex.set(place.id, marker);
  });

  drawFavoriteMarkers();
}

function drawFavoriteMarkers() {
  if (!appState.map || !appState.layers.favorites) return;

  appState.layers.favorites.clearLayers();
  const user = getCurrentUser();
  if (!user) return;

  user.favorites.forEach((favorite) => {
    L.marker([favorite.lat, favorite.lng], {
      icon: createMarkerIcon("marker-fav")
    })
      .bindPopup(
        `<strong class="popup-title">${escapeHtml(favorite.name)}</strong><span>Saved favorite</span>`
      )
      .addTo(appState.layers.favorites);
  });
}

function createMarkerIcon(className) {
  return L.divIcon({
    className: "",
    html: `<span class="marker-pin ${className}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12]
  });
}

function createZonePopup(zone) {
  return `
    <strong class="popup-title">${escapeHtml(zone.name)}</strong>
    <span>${formatZonePrice(zone)}. Active ${escapeHtml(zone.active_hours)}.</span>
  `;
}

function createFreePopup(place) {
  return `
    <strong class="popup-title">${escapeHtml(place.name)}</strong>
    <span>${Number(place.spots) || 0} mock spots</span>
    <button class="popup-button save-favorite" type="button" data-place-id="${escapeHtml(place.id)}" data-place-type="free">
      Save favorite
    </button>
  `;
}

function createNoParkingPopup(place) {
  return `
    <strong class="popup-title">No parking</strong>
    <span>${escapeHtml(place.reason || "Restricted zone")}</span>
    <button class="popup-button save-favorite" type="button" data-place-id="${escapeHtml(place.id)}" data-place-type="noParking">
      Save favorite
    </button>
  `;
}

function setupNavigation() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(button.dataset.view).classList.add("active");

      if (button.dataset.view === "mapView" && appState.map) {
        setTimeout(() => appState.map.invalidateSize(), 80);
      }
    });
  });
}

function setupLayerToggles() {
  document.querySelectorAll(".layer-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const layerName = button.dataset.layer;
      appState.activeLayers[layerName] = !appState.activeLayers[layerName];
      button.classList.toggle("active", appState.activeLayers[layerName]);

      if (!appState.map || !appState.layers[layerName]) return;

      const leafletLayer = appState.layers[layerName];
      if (appState.activeLayers[layerName]) {
        leafletLayer.addTo(appState.map);
      } else {
        appState.map.removeLayer(leafletLayer);
      }

      renderLocationList();
    });
  });
}

function setupPayment() {
  const form = document.getElementById("paymentForm");
  const zoneSelect = document.getElementById("paymentZone");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSmsInstructions(true);
  });

  zoneSelect.addEventListener("change", () => renderSmsInstructions(false));

  ["paymentDuration", "paymentPlate"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => renderSmsInstructions(false));
  });
}

function renderPaymentOptions() {
  const zoneSelect = document.getElementById("paymentZone");
  zoneSelect.innerHTML = "";

  if (!appState.dataLoaded) {
    zoneSelect.disabled = true;
    zoneSelect.innerHTML = '<option value="">Parking data unavailable</option>';
    return;
  }

  if (!appState.parkingData.zones.length) {
    zoneSelect.disabled = true;
    zoneSelect.innerHTML = '<option value="">No parking data found</option>';
    return;
  }

  zoneSelect.disabled = false;

  appState.parkingData.zones.forEach((zone) => {
    const option = document.createElement("option");
    option.value = zone.id;
    option.textContent = `${zone.name} (${formatZonePrice(zone)})`;
    zoneSelect.appendChild(option);
  });

  const user = getCurrentUser();
  const plateInput = document.getElementById("paymentPlate");
  if (user && user.plates.length && !plateInput.value) {
    plateInput.value = user.plates[0];
  }
}

function renderSmsInstructions(showValidation) {
  const zone = getSelectedZone();
  const duration = Number(document.getElementById("paymentDuration").value);
  const plate = normalizePlate(document.getElementById("paymentPlate").value);
  const output = document.getElementById("smsInstructions");
  const zoneSummary = document.getElementById("zoneSummary");

  if (!appState.dataLoaded) {
    zoneSummary.textContent = "Parking data unavailable";
    output.textContent = "Parking data unavailable";
    return;
  }

  if (!appState.parkingData.zones.length) {
    zoneSummary.textContent = "No parking data found";
    output.textContent = "No parking data found";
    return;
  }

  if (!zone) {
    zoneSummary.textContent = "Select a parking zone.";
    output.textContent = "Select a parking zone.";
    return;
  }

  zoneSummary.innerHTML = `
    SMS number: <strong>${escapeHtml(zone.sms_number)}</strong><br />
    Format: <strong>${escapeHtml(zone.sms_format)}</strong><br />
    Active hours: <strong>${escapeHtml(zone.active_hours)}</strong>
  `;

  // The payment form validates the plate before producing the final SMS text.
  if (!plate) {
    output.innerHTML = showValidation
      ? '<span class="error-text">Plate number is required.</span>'
      : "Enter a plate number to generate the final SMS text.";
    return;
  }

  const smsText = buildSmsText(zone, plate);
  const total = duration * Number(zone.price_per_hour || 0);

  output.innerHTML = `
    Send SMS to <strong>${escapeHtml(zone.sms_number)}</strong><br />
    Final SMS text: <strong>${escapeHtml(smsText)}</strong><br />
    Duration: <strong>${duration} hour${duration === 1 ? "" : "s"}</strong><br />
    Estimated cost: <strong>${total} ${escapeHtml(zone.currency)}</strong><br />
    This is a local demo and does not make a real payment.
  `;
}

function buildSmsText(zone, plate) {
  return zone.sms_format.replace("{PLATE}", plate);
}

function getSelectedZone() {
  const selectedId = document.getElementById("paymentZone").value;
  return appState.parkingData.zones.find((zone) => zone.id === selectedId);
}

function setupAccount() {
  appState.currentUser = localStorage.getItem(storageKeys.currentUser);

  document.getElementById("loginButton").addEventListener("click", () => loginUser());
  document.getElementById("registerButton").addEventListener("click", () => registerUser());
  document.getElementById("logoutButton").addEventListener("click", () => logoutUser());
  document.getElementById("plateForm").addEventListener("submit", addPlate);
  document.getElementById("favoriteForm").addEventListener("submit", saveCurrentMapCenter);
}

function registerUser() {
  const username = document.getElementById("authUsername").value.trim();
  const password = document.getElementById("authPassword").value;
  const users = readUsers();

  if (!username || !password) {
    setAuthMessage("Enter a username and password.", "error");
    return;
  }

  if (users[username]) {
    setAuthMessage("That username already exists.", "error");
    return;
  }

  // Plain localStorage accounts are only suitable for demos and learning.
  users[username] = {
    password,
    plates: [],
    favorites: []
  };

  writeUsers(users);
  appState.currentUser = username;
  localStorage.setItem(storageKeys.currentUser, username);
  setAuthMessage("Account created.", "success");
  renderAll();
}

function loginUser() {
  const username = document.getElementById("authUsername").value.trim();
  const password = document.getElementById("authPassword").value;
  const users = readUsers();

  if (!users[username] || users[username].password !== password) {
    setAuthMessage("Username or password is not correct.", "error");
    return;
  }

  appState.currentUser = username;
  localStorage.setItem(storageKeys.currentUser, username);
  setAuthMessage("Logged in.", "success");
  renderAll();
}

function logoutUser() {
  appState.currentUser = null;
  localStorage.removeItem(storageKeys.currentUser);
  document.getElementById("authPassword").value = "";
  renderAll();
}

function addPlate(event) {
  event.preventDefault();

  const user = getCurrentUser();
  if (!user) return;

  const plateInput = document.getElementById("newPlate");
  const plate = normalizePlate(plateInput.value);
  if (!plate) return;

  if (!user.plates.includes(plate)) {
    user.plates.push(plate);
    updateCurrentUser(user);
  }

  plateInput.value = "";
  renderAll();
}

function saveCurrentMapCenter(event) {
  event.preventDefault();

  const user = getCurrentUser();
  if (!user || !appState.map) return;

  const favoriteInput = document.getElementById("favoriteName");
  const name = favoriteInput.value.trim() || "Saved map position";
  const center = appState.map.getCenter();

  user.favorites.push({
    id: createId(),
    name,
    lat: Number(center.lat.toFixed(6)),
    lng: Number(center.lng.toFixed(6))
  });

  favoriteInput.value = "";
  updateCurrentUser(user);
  renderAll();
}

function handleMapActionClick(event) {
  const button = event.target.closest(".save-favorite");
  if (!button) return;

  const user = getCurrentUser();
  if (!user) {
    alert("Log in or register first to save favorites.");
    return;
  }

  const place = findPlace(button.dataset.placeId, button.dataset.placeType);
  if (!place) return;

  user.favorites.push({
    id: createId(),
    name: getPlaceName(place, button.dataset.placeType),
    lat: Number(place.lat),
    lng: Number(place.lng)
  });

  updateCurrentUser(user);
  renderAll();
}

function renderAll() {
  renderAccount();
  renderPaymentOptions();
  renderSmsInstructions(false);
  renderLocationList();
  drawParkingLayers();
  drawFavoriteMarkers();
}

function renderAccount() {
  const user = getCurrentUser();
  const authCard = document.getElementById("authCard");
  const accountCard = document.getElementById("accountCard");
  const userStatus = document.getElementById("userStatus");

  if (!user) {
    authCard.classList.remove("hidden");
    accountCard.classList.add("hidden");
    userStatus.textContent = "Guest";
    return;
  }

  authCard.classList.add("hidden");
  accountCard.classList.remove("hidden");
  userStatus.textContent = appState.currentUser;
  document.getElementById("accountName").textContent = appState.currentUser;

  renderSimpleList("plateList", user.plates, (plate) => plate, removePlate);
  renderSimpleList(
    "favoriteList",
    user.favorites,
    (favorite) => `${favorite.name} (${favorite.lat}, ${favorite.lng})`,
    removeFavorite
  );
}

function renderSimpleList(listId, items, getLabel, removeItem) {
  const list = document.getElementById(listId);
  list.innerHTML = "";

  if (!items.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "Nothing saved yet.";
    list.appendChild(emptyItem);
    return;
  }

  items.forEach((item, index) => {
    const listItem = document.createElement("li");
    const label = document.createElement("span");
    const button = document.createElement("button");

    label.textContent = getLabel(item);
    button.type = "button";
    button.textContent = "Remove";
    button.addEventListener("click", () => removeItem(index));

    listItem.append(label, button);
    list.appendChild(listItem);
  });
}

function renderLocationList() {
  const list = document.getElementById("locationList");
  list.innerHTML = "";

  if (!appState.dataLoaded) {
    list.innerHTML = '<div class="empty-state">Parking data unavailable</div>';
    return;
  }

  if (!hasAnyParkingData(appState.parkingData)) {
    list.innerHTML = '<div class="empty-state">No parking data found</div>';
    return;
  }

  const cards = [];

  if (appState.activeLayers.paid) {
    appState.parkingData.zones.forEach((zone) => {
      cards.push({
        id: zone.id,
        type: "paid",
        title: zone.name,
        meta: `${formatZonePrice(zone)}. SMS ${zone.sms_format} to ${zone.sms_number}.`,
        action: () => focusZone(zone)
      });
    });
  }

  if (appState.activeLayers.free) {
    appState.parkingData.free_parking.forEach((place) => {
      cards.push({
        id: place.id,
        type: "free",
        title: place.name,
        meta: `${Number(place.spots) || 0} mock spots.`,
        action: () => focusMarker(place.id)
      });
    });
  }

  if (appState.activeLayers.noParking) {
    appState.parkingData.no_parking.forEach((place) => {
      cards.push({
        id: place.id,
        type: "noParking",
        title: "No parking",
        meta: place.reason || "Restricted zone",
        action: () => focusMarker(place.id)
      });
    });
  }

  if (!cards.length) {
    list.innerHTML = '<div class="empty-state">Turn on a layer to see places.</div>';
    return;
  }

  cards.forEach((card) => {
    const item = document.createElement("article");
    item.className = "location-card";
    item.innerHTML = `
      <strong>${escapeHtml(card.title)}</strong>
      <span class="location-meta">${escapeHtml(card.meta)}</span>
      <div class="mini-actions">
        <button type="button">Show</button>
        <button type="button">Favorite</button>
      </div>
    `;

    const buttons = item.querySelectorAll("button");
    buttons[0].addEventListener("click", card.action);
    buttons[1].addEventListener("click", () => saveCardFavorite(card));
    list.appendChild(item);
  });
}

function saveCardFavorite(card) {
  const user = getCurrentUser();
  if (!user) {
    alert("Log in or register first to save favorites.");
    return;
  }

  if (card.type === "paid") {
    const zone = appState.parkingData.zones.find((item) => item.id === card.id);
    const center = getPolygonCenter(zone.coordinates);
    user.favorites.push({
      id: createId(),
      name: zone.name,
      lat: center[0],
      lng: center[1]
    });
  } else {
    const place = findPlace(card.id, card.type);
    user.favorites.push({
      id: createId(),
      name: getPlaceName(place, card.type),
      lat: Number(place.lat),
      lng: Number(place.lng)
    });
  }

  updateCurrentUser(user);
  renderAll();
}

function focusMarker(placeId) {
  if (!appState.map) return;

  const marker = appState.markerIndex.get(placeId);
  if (!marker) return;

  appState.map.setView(marker.getLatLng(), 16);
  marker.openPopup();
}

function focusZone(zone) {
  if (!appState.map || !Array.isArray(zone.coordinates)) return;

  const bounds = L.latLngBounds(zone.coordinates);
  appState.map.fitBounds(bounds, { padding: [24, 24] });
}

function removePlate(index) {
  const user = getCurrentUser();
  user.plates.splice(index, 1);
  updateCurrentUser(user);
  renderAll();
}

function removeFavorite(index) {
  const user = getCurrentUser();
  user.favorites.splice(index, 1);
  updateCurrentUser(user);
  renderAll();
}

function findPlace(id, type) {
  if (type === "free") {
    return appState.parkingData.free_parking.find((place) => place.id === id);
  }

  return appState.parkingData.no_parking.find((place) => place.id === id);
}

function getPlaceName(place, type) {
  if (!place) return "Saved location";
  return type === "free" ? place.name : `No parking: ${place.reason || "Restricted zone"}`;
}

function getPolygonCenter(polygon) {
  const total = polygon.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0]
  );

  return [
    Number((total[0] / polygon.length).toFixed(6)),
    Number((total[1] / polygon.length).toFixed(6))
  ];
}

function formatZonePrice(zone) {
  return `${Number(zone.price_per_hour) || 0} ${zone.currency} per hour`;
}

function setDataStatus(type, message) {
  const status = document.getElementById("dataStatus");
  status.className = `status-banner ${type}`;
  status.innerHTML =
    type === "loading"
      ? `<span class="spinner" aria-hidden="true"></span>${escapeHtml(message)}`
      : escapeHtml(message);
}

function setMapNote(message) {
  const note = document.querySelector(".map-note");
  if (note) note.textContent = message;
}

function getCurrentUser() {
  const users = readUsers();
  if (!appState.currentUser || !users[appState.currentUser]) {
    return null;
  }

  return users[appState.currentUser];
}

function updateCurrentUser(user) {
  const users = readUsers();
  users[appState.currentUser] = user;
  writeUsers(users);
}

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.users)) || {};
  } catch (error) {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(storageKeys.users, JSON.stringify(users));
}

function setAuthMessage(message, type) {
  const output = document.getElementById("authMessage");
  output.textContent = message;
  output.className = `form-message ${type}`;
}

function normalizePlate(value) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
