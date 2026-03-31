# Map Page Design

**Date:** 2026-03-30
**Status:** Approved

## Overview

Add a Map page to the Litany of Lawrences site that plots all street addresses mentioned in articles as pins on an OpenStreetMap map. Each pin shows a popup with the address and links to every article that mentions it.

## Goals

- Extract addresses from article markdown files automatically
- Geocode them once, cache results in a committed JSON file
- Render an interactive map using Leaflet.js + OpenStreetMap (no API key required)
- Keep builds fast and offline-capable — no runtime geocoding

---

## 1. Data Pipeline

### 1.1 Address Extraction (`geocode.py`)

A standalone Python script at the repo root, alongside existing `parse_docx.py` and `linkify.py`.

**What it does:**
1. Reads all `articles/*.md` files
2. Runs a regex over each article's text to find street addresses
3. Deduplicates across articles: same address string → one entry, multiple article references
4. Geocodes each unique address via the Nominatim API (free, OSM-backed), appending `"New York City"` as context for accuracy
5. Respects Nominatim's 1 req/sec rate limit
6. Writes results to `locations.json` at the repo root

**Incremental behaviour:** On re-runs, the script reads the existing `locations.json` and skips any address already present. Only new addresses are geocoded.

**Address regex** targets common NYC street address patterns:
- `\d+ (North|South|East|West)? <street name> (Street|Avenue|Road|Boulevard|Place|Court|Lane|Drive|Terrace|Alley|Way|St|Ave|Rd|Blvd|Pl|Ct|Dr|Ln)`

### 1.2 `locations.json` (committed to repo)

```json
[
  {
    "address": "164 East 72nd Street",
    "lat": 40.7687,
    "lng": -73.9638,
    "articles": [
      { "title": "Lawrence, James (1850–1920)", "slug": "lawrence-james-1850-1920" }
    ]
  }
]
```

Each entry has:
- `address` — the extracted string
- `lat`, `lng` — geocoded coordinates
- `articles` — array of `{ title, slug }` for every article mentioning this address

---

## 2. Eleventy Integration

### 2.1 `site/_data/locations.js`

Reads `locations.json` from the repo root and returns the array. Returns `[]` if the file does not exist, so the build never fails on a fresh checkout before `geocode.py` has been run.

### 2.2 `site/map.njk`

New page at `/map/`, extending `base.njk`. Follows the same pattern as `family-tree.njk`:

- Embeds locations data as `<script type="application/json" id="map-data">{{ locations | dump | safe }}</script>`
- Loads Leaflet CSS + JS from CDN in `{% block head %}`
- Defers `site/js/map.js`
- Renders a full-height `<div id="map">` for Leaflet to populate

### 2.3 Navigation

A link to `/map/` is added to the home page nav only (same rule as the Family Tree link), using the existing `page.url === "/"` conditional in `base.njk`.

---

## 3. Map Page UI (`site/js/map.js`)

### Initialisation

- Leaflet map centred on NYC (`[40.7128, -74.0060]`), zoom level 12
- OpenStreetMap tile layer (no API key)
- Map height: full viewport minus nav height, same as family tree

### Pins

- One marker per entry in the locations JSON
- Clicking a marker opens a Leaflet popup

### Popup content

```
164 East 72nd Street

Lawrence, James (1850–1920) →
Another Article (1870–1930) →
```

- Address as a heading
- Each article as a link (`/slug/`) opening in the same tab
- Popup styled to match the site palette (parchment background, brown text) via CSS

### Empty state

If the locations array is empty, the map still renders centred on NYC with a small overlay message: "No locations indexed yet — run geocode.py to populate the map."

---

## 4. Files Affected

| File | Change |
|------|--------|
| `geocode.py` | New — address extraction + geocoding script |
| `locations.json` | New — committed geocoded data |
| `site/_data/locations.js` | New — Eleventy data file |
| `site/map.njk` | New — map page template |
| `site/js/map.js` | New — Leaflet map initialisation |
| `site/scss/main.scss` | Add map container height + popup styles |
| `site/_includes/base.njk` | Add `/map/` nav link (home page only) |

---

## 5. Constraints & Notes

- **Nominatim usage policy:** 1 req/sec max, user-agent must identify the application. The script must set a descriptive `User-Agent` header.
- **Historical addresses:** Some addresses may not geocode accurately (buildings demolished, streets renamed). The incremental JSON approach allows manual corrections — edit `locations.json` directly to fix bad coordinates.
- **No build-time geocoding:** `locations.js` only reads the JSON; it never calls Nominatim. Builds remain fast and offline.
- **Leaflet version:** Load from CDN (same pattern as D3 for the family tree), pinned to a specific version to avoid surprise breaking changes.
