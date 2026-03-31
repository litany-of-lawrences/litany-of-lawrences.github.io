#!/usr/bin/env python3
"""
Extract street addresses from articles and geocode them via Nominatim.
Results are saved to locations.json at the repo root.

Usage:
    python geocode.py

Re-runs are incremental: already-geocoded addresses are skipped.
Update NOMINATIM_USER_AGENT with your contact email before first run.
"""

import re
import json
import time
import glob
import os
import urllib.request
import urllib.parse

ARTICLES_DIR         = os.path.join(os.path.dirname(os.path.abspath(__file__)), "articles")
LOCATIONS_FILE       = os.path.join(os.path.dirname(os.path.abspath(__file__)), "locations.json")
NOMINATIM_USER_AGENT = "litany-of-lawrences/geocode.py (jpodles@gmail.com)"

ADDRESS_RE = re.compile(
    r'\b\d+\s+'
    r'(?:(?:North|South|East|West|N\.?|S\.?|E\.?|W\.?)\s+)?'
    r'(?:'
    r'(?:(?:[A-Z][a-z]+(?:-[A-Za-z]+)?|[0-9]+(?:st|nd|rd|th))\s+){1,3}'
    r'(?:Street|Avenue|Road|Boulevard|Place|Court|Lane|Drive|Terrace|Alley|Way|St|Ave|Rd|Blvd|Pl|Ct|Dr|Ln)'
    r'|Broadway'
    r')\b'
)


def extract_addresses(content):
    """Return list of address strings found in article content."""
    return ADDRESS_RE.findall(content)


def load_existing():
    """Load existing locations.json; return empty list if file absent or corrupt."""
    if not os.path.exists(LOCATIONS_FILE):
        return []
    try:
        with open(LOCATIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Warning: locations.json is corrupt ({e}). Starting fresh.")
        return []


def save_locations(locations):
    """Write locations list to locations.json (pretty-printed)."""
    with open(LOCATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(locations, f, indent=2, ensure_ascii=False)


def geocode_address(address):
    """
    Call Nominatim for a single address appended with 'New York City'.
    Returns (lat, lng) as floats, or (None, None) if not found.
    """
    query = urllib.parse.urlencode({
        "q": f"{address}, New York City",
        "format": "json",
        "limit": 1,
    })
    url = f"https://nominatim.openstreetmap.org/search?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": NOMINATIM_USER_AGENT})
    with urllib.request.urlopen(req, timeout=10) as resp:
        results = json.loads(resp.read().decode("utf-8"))
    if not results:
        return None, None
    return float(results[0]["lat"]), float(results[0]["lon"])


def collect_addresses_from_articles():
    """
    Read all articles/*.md and return a dict mapping each address string
    to a list of { title, slug } dicts for every article mentioning it.
    """
    address_map = {}
    for filepath in sorted(glob.glob(os.path.join(ARTICLES_DIR, "*.md"))):
        slug = os.path.basename(filepath).replace(".md", "")
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else slug
        for address in extract_addresses(content):
            address = address.strip()
            if address not in address_map:
                address_map[address] = []
            entry = {"title": title, "slug": slug}
            if entry not in address_map[address]:
                address_map[address].append(entry)
    return address_map


def main():
    if "example.com" in NOMINATIM_USER_AGENT:
        print("Error: update NOMINATIM_USER_AGENT with your real email before running.")
        print("Edit geocode.py and replace 'james@example.com' with your actual address.")
        return
    existing     = load_existing()
    already_done = {e["address"] for e in existing}
    address_map  = collect_addresses_from_articles()
    new_items    = {a: arts for a, arts in address_map.items() if a not in already_done}

    if not new_items:
        print("No new addresses to geocode.")
        return

    locations = list(existing)
    total = len(new_items)
    for i, (address, articles) in enumerate(new_items.items(), 1):
        print(f"[{i}/{total}] Geocoding: {address}")
        lat, lng = geocode_address(address)
        if lat is None:
            print(f"  \u2192 not found, storing null coordinates")
        else:
            print(f"  \u2192 {lat:.5f}, {lng:.5f}")
        locations.append({"address": address, "lat": lat, "lng": lng, "articles": articles})
        save_locations(locations)
        if i < total:
            time.sleep(1)

    print(f"\nDone. {total} new address(es) geocoded. Total: {len(locations)}.")


if __name__ == "__main__":
    main()
