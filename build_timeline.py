"""
build_timeline.py

Reads every article in articles/ to extract birth years from titles of the form
"Last, First Middle (YYYY–YYYY)", then merges those births with historical events
from source-documents/events.json and writes a combined JSON file to
site/_data/timeline.json.

Each entry has: { "year": int, "type": "birth"|"event", "text": str, "slug": str|null }
"""

import json
import re
from pathlib import Path

ARTICLES_DIR = Path("articles")
EVENTS_PATH = Path("source-documents/events.json")
OUTPUT_PATH = Path("site/_data/timeline.json")


def get_title(md_path: Path) -> str | None:
    for line in md_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return None


def extract_birth(title: str) -> dict | None:
    """
    From a title like "Alexandre, James Henry (1848–1912)" extract:
      - display name in natural order ("James Henry Alexandre")
      - birth year (1848)
      - slug (filename stem)
    Returns None for non-person articles (no comma) or missing dates.
    """
    if ", " not in title:
        return None

    date_match = re.search(r'\((\d{4})[–\-]', title)
    if not date_match:
        return None

    birth_year = int(date_match.group(1))

    comma_idx = title.index(", ")
    last = title[:comma_idx]
    rest = title[comma_idx + 2:]

    # Strip date portion to get first/middle names
    name_part = re.sub(r'\s*\(\d{4}[–\-]\d*\s*\)\s*$', '', rest).strip()
    display_name = f"{name_part} {last}" if name_part else last

    return {"year": birth_year, "name": display_name}


def slugify(text: str) -> str:
    text = text.lower()
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")
    return text


def main():
    entries = []

    # ── Births from articles ──────────────────────────────────────────────────
    for md_path in sorted(ARTICLES_DIR.glob("*.md")):
        title = get_title(md_path)
        if not title:
            continue
        birth = extract_birth(title)
        if not birth:
            continue
        entries.append({
            "year": birth["year"],
            "type": "birth",
            "text": f"{birth['name']} born",
            "slug": md_path.stem,
        })

    birth_count = len(entries)

    # ── Historical events ─────────────────────────────────────────────────────
    events = json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
    for ev in events:
        # Skip entries where the event text is just a year
        if re.fullmatch(r'\d{4}', ev["event"].strip()):
            continue
        # dates may be just a year ("1793") or a full date ("March 4, 1793")
        year_match = re.search(r'\d{4}', ev["date"])
        if not year_match:
            continue
        entries.append({
            "year": int(year_match.group()),
            "type": "event",
            "text": ev["event"],
            "slug": None,
        })

    # Sort by year, births before events within the same year
    entries.sort(key=lambda e: (e["year"], 0 if e["type"] == "birth" else 1, e["text"]))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {OUTPUT_PATH}: {birth_count} births + {len(entries) - birth_count} events = {len(entries)} entries")


if __name__ == "__main__":
    main()
