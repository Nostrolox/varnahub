# Varna Hub

Varna Hub is a browser-first React application for discovering events and nearby food in Varna, Bulgaria. It uses mock data shaped for later ingestion from public event sources such as Moreto.net, local venue listings, OpenStreetMap, and delivery-style restaurant catalogs.

## Stack

- React + Vite
- Tailwind CSS plus custom responsive CSS
- Leaflet with OpenStreetMap tiles
- Mock JSON data in `src/data/varnaMockData.json`
- Server-side event import from Visit Varna, Varna Events, and Varna Culture, with a bundled cache in `src/data/importedVisitVarnaEvents.json`
- Server-side place import from Glovo, Takeaway, and Tripadvisor, with a bundled cache in `src/data/importedPlaces.json`
- Simple i18n JSON files in `src/data/i18n/`
- Browser `localStorage` for mock JWT sessions, accounts, favorites, going status, reviews, admin events, and offline cache

## Features

- Bulgarian default UI with BG/EN language toggle
- Visible homepage and events search area with dynamic search by event name, venue/place name, category, location, and keywords
- Quick filters for Today, Tonight, Weekend, Free, Paid, Concerts, Festivals, Nightlife, Culture, Food & drink, and Near me
- Homepage sections for Trending Events, Tonight in Varna, and Top Places to Eat
- Events with localized title, category, date, start/end time, exact location, coordinates, short/full description, images, organizer, ticket info, schedule, badges, tags, ratings, review counts, and popularity score
- Smart Tonight filter showing events happening today after the current local time
- Filters for date, category, popularity/date/rating sort, and shared search
- Event cards include View Details, Save, Going, and Share actions
- Places include Save, OpenStreetMap Directions, and Reviews actions
- Food and drink recommendations with type, cuisine, rating, review count, price range, opening hours, badges, tags, description, and coordinates
- Event/place detail pages with reviews, average rating, save actions, gallery, OpenStreetMap links, and map pin
- Imported events from Visit Varna, Varna Events, and Varna Culture display with their original Bulgarian text, original source image URL when available, and official source URL
- Tonight fallback card with nearby food/drink recommendations when no events remain
- Near-event food suggestions based on coordinate distance
- Interactive OpenStreetMap view with simple visual clustering for nearby markers
- Mock email/password account creation and login with a mock JWT token
- Users can save favorite events and places, mark events as going, and leave 1-5 star reviews with comments
- Dedicated Favorites page with Events and Places tabs
- Profile page with username, saved items, mock token, and user reviews
- Basic Admin panel to add/edit/delete events and places manually when scraping or live APIs fail
- Admin-only Import Events button that refreshes all official sources through the server-side import API
- Admin-only Import Places button that refreshes food and drink listings through the server-side import API
- Duplicate event filtering across multiple sources
- Offline-friendly cache for the last loaded events and places
- Defensive fallbacks for missing dates, images, locations, and descriptions

## Run Locally

```powershell
npm install
npm run dev
```

Open the local Vite URL:

```text
http://127.0.0.1:5173/
```

On Windows PowerShell, if script execution blocks `npm`, use:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

## Build

```powershell
npm run build
```

The production output is written to `dist/`.

## Import Official Varna Events

The app includes a respectful server-side importer for official Varna event sources:

- `https://visit.varna.bg`
- `https://varna.events`
- `https://varnaculture.bg`

The browser does not scrape these sites directly. It calls `/api/import-events`, which runs the parsers server-side to avoid CORS issues. The frontend stores imported events in `localStorage` and refreshes them automatically when the cache is older than 12 hours.

```powershell
npm run import-events
```

Use this local script before building or deploying to Vercel if you want to refresh the bundled fallback cache. To manually refresh sooner while developing:

```powershell
npm run import-events -- --force
```

The importer preserves Bulgarian titles/descriptions, stores `sourceName`, `sourceUrl`, original image URLs, and `importedAt`. If one source fails or a page shape changes, the import continues with the other sources, keeps cached events visible, logs warnings, and the Admin panel remains available for manual event entry.

## Import Food And Drink Places

Varna Hub also includes a server-side place importer for Glovo, Takeaway, and Tripadvisor. It imports only basic public listing fields such as name, cuisine/category, rating counts where visible, source URL, image URL, opening status, and tags. It does not import full menus or copyrighted review text.

```powershell
npm run import-places
```

The frontend calls `/api/import-places`, stores the response in `localStorage`, and refreshes automatically after 24 hours. If a source blocks scraping or returns an error, the API reports the warning, cached places stay visible, and the original mock places remain the fallback.

## Mock Login

```text
Email: demo@varnahub.local
Password: varna123
```

## Mock Admin Login

The Admin panel is hidden from normal users and only appears for accounts with `role: "admin"`.

```text
Email: admin@varnahub.local
Password: change-me
```

This is frontend-only mock access control. A production release should enforce roles on the server with Supabase, Firebase, Auth0, or a custom backend.

## Project Structure

```text
src/
  App.jsx                    Main Varna Hub application
  main.jsx                   React entry point and Leaflet CSS import
  styles.css                 App styling and responsive layout
  services/
    eventImportService.js    Frontend cache + server API client
    placeImportService.ts    Frontend place cache + server API client
  data/
    importedVisitVarnaEvents.json  Bundled official event import cache
    importedPlaces.json      Bundled food/place import cache
    varnaMockData.json       Events, places, mock source metadata, demo user
    i18n/
      bg.json                Bulgarian UI strings
      en.json                English UI strings
server/
  eventImportParsers.mjs     Server-side source parsers
  placeImportParsers.mjs     Server-side place source parsers
api/
  import-events.js           Vercel serverless import endpoint
  import-places.js           Vercel serverless place import endpoint
```

## Connecting Real Data Later

The mock JSON already separates event sources and venue/place sources. A production backend can replace the static import with a small adapter layer that normalizes fields into the same shapes:

- `events[]`: `id`, `title`, `category`, `date`, `startTime`, `endTime`, `location`, `coordinates`, `shortDescription`, `fullDescription`, `images`, `organizer`, `ticket`, `schedule`, `badges`, `tags`, `rating`, `reviewsCount`, `popularityScore`
- `places[]`: `id`, `name`, `type`, `cuisine`, `priceRange`, `location`, `coordinates`, `description`, `openingHours`, `badges`, `tags`, `rating`, `reviewsCount`

Keep scraping or API ingestion server-side so the browser app receives clean JSON and avoids exposing crawler logic or credentials.
