# Varna Hub

Varna Hub is a browser-first React application for discovering events and nearby food in Varna, Bulgaria. It uses mock data shaped for later ingestion from public event sources such as Moreto.net, local venue listings, OpenStreetMap, and delivery-style restaurant catalogs.

## Stack

- React + Vite
- Tailwind CSS plus custom responsive CSS
- Leaflet with OpenStreetMap tiles
- Mock JSON data in `src/data/varnaMockData.json`
- Local Visit Varna importer cache in `src/data/importedVisitVarnaEvents.json`
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
- Visit Varna imported events display with their original Bulgarian text, original source image URL when available, and official source URL
- Tonight fallback card with nearby food/drink recommendations when no events remain
- Near-event food suggestions based on coordinate distance
- Interactive OpenStreetMap view with simple visual clustering for nearby markers
- Mock email/password account creation and login with a mock JWT token
- Users can save favorite events and places, mark events as going, and leave 1-5 star reviews with comments
- Dedicated Favorites page with Events and Places tabs
- Profile page with username, saved items, mock token, and user reviews
- Basic Admin panel to add/edit/delete events and places manually when scraping or live APIs fail
- Admin-only Visit Varna import sync button for the latest bundled local import cache
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

## Import Visit Varna Events

The app includes a respectful local importer for the public Visit Varna events page. It fetches only when manually triggered and skips refreshes if the import cache was updated in the last 24 hours.

```powershell
npm run import-events
```

Use this before building or deploying to Vercel so the generated `src/data/importedVisitVarnaEvents.json` is bundled into the static site. To manually refresh sooner while developing:

```powershell
npm run import-events -- --force
```

The importer preserves Bulgarian titles/descriptions, stores `source: "Visit Varna"`, `sourceUrl`, original image URLs, and `lastUpdated`. If Visit Varna is unavailable or the page shape changes, the script keeps the existing cache and the Admin panel remains available for manual event entry.

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
  data/
    importedVisitVarnaEvents.json  Local Visit Varna import cache
    varnaMockData.json       Events, places, mock source metadata, demo user
    i18n/
      bg.json                Bulgarian UI strings
      en.json                English UI strings
```

## Connecting Real Data Later

The mock JSON already separates event sources and venue/place sources. A production backend can replace the static import with a small adapter layer that normalizes fields into the same shapes:

- `events[]`: `id`, `title`, `category`, `date`, `startTime`, `endTime`, `location`, `coordinates`, `shortDescription`, `fullDescription`, `images`, `organizer`, `ticket`, `schedule`, `badges`, `tags`, `rating`, `reviewsCount`, `popularityScore`
- `places[]`: `id`, `name`, `type`, `cuisine`, `priceRange`, `location`, `coordinates`, `description`, `openingHours`, `badges`, `tags`, `rating`, `reviewsCount`

Keep scraping or API ingestion server-side so the browser app receives clean JSON and avoids exposing crawler logic or credentials.
