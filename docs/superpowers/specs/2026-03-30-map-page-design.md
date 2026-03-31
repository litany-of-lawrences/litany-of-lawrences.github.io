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

**Address regex** (full string):
```
\b\d+\s+(?:North|South|East|West|N\.?|S\.?|E\.?|W\.?)?\s*(?:[A-Z][a-z]+\s+){1,3}(?:Street|Avenue|Road|Boulevard|Place|Court|Lane|Drive|Terrace|Alley|Way|St|Ave|Rd|Blvd|Pl|Ct|Dr|Ln)\b
```

**Nominatim User-Agent:** Requests must include a descriptive `User-Agent` header per Nominatim's usage policy. Use:
```
User-Agent: litany-of-lawrences/geocode.py (james@example.com)
```
Replace the email with the operator's real address. Requests without a valid User-Agent will be blocked.

**Geocoding failure handling:** If Nominatim returns zero results for an address, write the entry with `"lat": null, "lng": null`. The map page skips null-coordinate entries silently. This allows manual correction by editing `locations.json` directly.

**Incremental behaviour:** On re-runs, the script reads the existing `locations.json` and skips any address already present (matched by `address` string). Only new addresses are geocoded, keeping re-runs fast.

### 1.2 `locations.json` (committed to repo)

Stored at the repo root. This file is intentionally committed — verify it is not excluded by any `.gitignore` pattern before first push.

```json
[
  {
    "address": "164 East 72nd Street",
    "lat": 40.7687,
    "lng": -73.9638,
    "articles": [
      { "title": "Lawrence, James (1850–1920)", "slug": "lawrence-james-1850-1920" }
    ]
  },
  {
    "address": "45 West 11th Street",
    "lat": null,
    "lng": null,
    "articles": [
      { "title": "Lawrence, Anne (1872–1940)", "slug": "lawrence-anne-1872-1940" }
    ]
  }
]
```

Each entry has:
- `address` — the extracted string
- `lat`, `lng` — geocoded coordinates, or `null` if geocoding failed
- `articles` — array of `{ title, slug }` for every article mentioning this address

---

## 2. Eleventy Integration

### 2.1 `site/_data/locations.js`

Reads `locations.json` from the repo root and returns the array. Because `_data/` is at `site/_data/`, the repo root is two levels up:

```js
const path = require("path");
const fs   = require("fs");

const LOCATIONS_FILE = path.join(__dirname, "../../locations.json");

module.exports = function() {
  try {
    return JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8"));
  } catch {
    return [];
  }
};
```

The `try/catch` is a deliberate departure from the other data files — it ensures a fresh checkout (before `geocode.py` has been run) never breaks the build. Other data files read from the `articles/` directory which is always present; `locations.json` may not exist yet.

### 2.2 `site/map.njk`

New page at `/map/`, extending `base.njk`. Follows the same pattern as `family-tree.njk`:

```njk
---
title: Map
permalink: /map/
---
{% extends "base.njk" %}

{% block head %}
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="/js/map.js" defer></script>
{% endblock %}

{% block content %}
<script type="application/json" id="map-data" data-pagefind-ignore>{{ locations | dump | safe }}</script>
<div id="map" data-pagefind-ignore></div>
{% endblock %}
```

Key points:
- Leaflet CSS and JS are both loaded in `{% block head %}`, with Leaflet JS appearing **before** `map.js` — same ordering pattern as D3 before `family-tree.js`
- `data-pagefind-ignore` on both the `<script>` and `<div>` prevents Pagefind from indexing raw JSON coordinates or map tiles

### 2.3 Navigation

A link to `/map/` is added inside the existing `{% if page.url === "/" %}` block in `base.njk`, alongside the Family Tree link. Both links share the same conditional:

```njk
{% if page.url === "/" %}
<a href="/family-tree/" class="underline site-nav-link">Family Tree</a>
<a href="/map/" class="underline site-nav-link">Map</a>
{% endif %}
```

---

## 3. Map Page UI (`site/js/map.js`)

### Initialisation

- Leaflet map centred on NYC (`[40.7128, -74.0060]`), zoom level 12
- OpenStreetMap tile layer: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Map `<div>` height: full viewport minus nav height, same calculation as family tree (set via `setAttribute` after reading `navEl.offsetHeight`)

### Pins

- Entries where `lat` or `lng` is `null` are silently skipped
- One marker per remaining entry
- Clicking a marker opens a Leaflet popup

### Popup content

```
164 East 72nd Street

Lawrence, James (1850–1920) →
Another Article (1870–1930) →
```

- Address as a `<strong>` heading
- Each article as an `<a href="/slug/">` link, one per line
- Popup styled to match site palette via `.map-popup` CSS class (parchment background `#f5f0e8`, brown text `#2c1810`)

### Empty state

If all entries have null coordinates, or the locations array is empty, `map.js` appends a plain `<div class="map-empty-state">` element over the map with the message:

> "No locations indexed yet — run geocode.py to populate the map."

No new CSS class needed beyond basic absolute positioning and site palette colours.

---

## 4. Files Affected

| File | Change |
|------|--------|
| `geocode.py` | New — address extraction + geocoding script |
| `locations.json` | New — committed geocoded data |
| `site/_data/locations.js` | New — Eleventy data file |
| `site/map.njk` | New — map page template |
| `site/js/map.js` | New — Leaflet map initialisation |
| `site/scss/main.scss` | Add `#map` height + `.map-popup` + `.map-empty-state` styles |
| `site/_includes/base.njk` | Extend home-page nav block to include `/map/` link |

---

## 5. Constraints & Notes

- **Nominatim usage policy:** 1 req/sec max; User-Agent must identify the application and include contact info. See section 1.1.
- **Historical addresses:** Some addresses may not geocode accurately (buildings demolished, streets renamed). The null lat/lng pattern plus committed JSON allows manual correction at any time.
- **No build-time geocoding:** `locations.js` only reads the JSON; it never calls Nominatim. Builds remain fast and offline.
- **Leaflet version:** Pinned to `1.9.4` in both the CDN URLs in `map.njk`.
- **`locations.json` must be committed:** Verify no `.gitignore` rule excludes it.
