"""
linkify.py

For each article in articles/, generates the name forms that might appear in
other articles, then scans all other articles for those forms and replaces them
with markdown links.

Name conversion: "Last, First Middle (dates)" → "First Middle Last (dates)"
Non-person articles (no comma): searched by exact title.
"""

import re
from pathlib import Path

ARTICLES_DIR = Path("articles")


def get_title(md_path: Path) -> str | None:
    for line in md_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return None


def get_search_variants(title: str) -> list[str]:
    """
    Return the text forms to search for in other articles, longest first
    (so more specific matches are applied before less specific ones).

    For "Last, First Middle (dates)" returns:
      - "Last, First Middle (dates)"      — exact title form
      - "First Middle Last (dates)"       — reversed with dates
      - "First Middle Last"               — reversed without dates (catches
                                            bare name mentions in body text)
    """
    if ", " not in title:
        return [title]

    comma_idx = title.index(", ")
    last = title[:comma_idx]
    rest = title[comma_idx + 2:]  # e.g. "James Henry (1848–1912)"

    # Split off the trailing date "(YYYY–YYYY)" or "(YYYY– )"
    date_match = re.search(r'\s*\(\d{4}[–\-]\d*\s*\)\s*$', rest)
    if date_match:
        name_part = rest[:date_match.start()].strip()  # e.g. "James Henry"
        dates = date_match.group().strip()             # e.g. "(1848–1912)"
        reversed_with_dates = f"{name_part} {last} {dates}"
        reversed_no_dates = f"{name_part} {last}"
    else:
        reversed_with_dates = f"{rest} {last}"
        reversed_no_dates = reversed_with_dates

    # Deduplicate, then sort longest-first so specific variants match before general ones
    seen = set()
    variants = []
    for v in [title, reversed_with_dates, reversed_no_dates]:
        if v not in seen:
            seen.add(v)
            variants.append(v)

    # Expand Jr/Jr. — add the alternate form for each variant that contains either
    extras = []
    for v in variants:
        if "Jr." in v:
            extras.append(v.replace("Jr.", "Jr"))
        elif re.search(r"\bJr\b", v):
            extras.append(re.sub(r"\bJr\b", "Jr.", v))
    for v in extras:
        if v not in seen:
            seen.add(v)
            variants.append(v)

    variants.sort(key=len, reverse=True)
    return variants


def replace_bare(text: str, search: str, link_target: str) -> tuple[str, int]:
    """
    Replace bare (not already linked) occurrences of `search` in `text`
    with a markdown link. Returns (new_text, replacement_count).

    If `search` has no trailing date, refuse to match when followed by a
    "(YYYY…)" date expression — that mention belongs to a differently-dated
    person and should be picked up by their dated variant instead.
    """
    escaped = re.escape(search)
    has_trailing_date = bool(re.search(r'\(\d{4}[–\-]\d*\s*\)\s*$', search))
    # Negative lookbehind: not preceded by '[' (already link text)
    # Negative lookahead: not followed by ']' (already link text)
    # Extra lookahead for bare names: reject if followed by " (YYYY" — that's
    # a dated mention that must be linked by the dated variant, not the bare one.
    tail = r'(?!\])' if has_trailing_date else r'(?!\])(?!\s*\(\d{4})'
    pattern = r'(?<!\[)' + escaped + tail
    replacement = f"[{search}]({link_target})"
    new_text, count = re.subn(pattern, replacement, text)
    return new_text, count


def main():
    md_files = sorted(ARTICLES_DIR.glob("*.md"))

    # Build lookup: path → (title, [search_variants])
    articles: list[tuple[Path, str, list[str]]] = []
    for path in md_files:
        title = get_title(path)
        if title:
            variants = get_search_variants(title)
            articles.append((path, title, variants))

    total_links = 0

    for target_path, target_title, variants in articles:
        # Scan every OTHER article for mentions of this article's name
        for other_path, _, other_variants in articles:
            if other_path == target_path:
                continue

            text = other_path.read_text(encoding="utf-8")
            changed = False
            link_target = "/" + target_path.stem + "/"  # e.g. "/alexandre-james-henry-1848-1912/"

            for variant in variants:
                # Don't link a name that also describes the article being scanned
                if variant in other_variants:
                    continue
                text, count = replace_bare(text, variant, link_target)
                if count:
                    total_links += count
                    changed = True

            if changed:
                other_path.write_text(text, encoding="utf-8")
                print(f"  Linked '{target_title}' in {other_path.name}")

    print(f"\nDone. {total_links} link(s) added across {len(md_files)} articles.")


if __name__ == "__main__":
    main()
