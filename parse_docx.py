"""
parse_docx.py

Converts each article in source-documents/*.docx into a separate markdown file
saved to articles/. Article titles are detected by bold + 18pt font. Bold runs
and rStyle="Strong" runs are preserved as **bold** inline markdown.

Set MAX_ARTICLES to None to process all articles.
"""

import re
from pathlib import Path
from docx import Document
from lxml import etree

SOURCE_DIR = Path("source-documents")
OUTPUT_DIR = Path("articles")
IMAGES_DIR = Path("images")
MAX_ARTICLES = None # Set to None to process all

TITLE_FONT_SIZE = 228600  # 18pt in EMUs

IMAGE_NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
R_EMBED = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"


def slugify(text: str) -> str:
    text = text.lower()
    text = text.replace("–", "-").replace("—", "-")  # en/em dash → hyphen
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")
    return text


def run_has_strong_style(run) -> bool:
    xml = etree.tostring(run._element).decode()
    return 'rStyle' in xml and 'Strong' in xml


def is_article_title(para) -> bool:
    """
    Paragraph containing a run at 18pt font size. Bold is NOT required: in
    some source documents titles inherit bold from a paragraph style, so
    run.bold reports None even though the title renders bold in Word.
    18pt alone is an unambiguous title signal — body text is ~11pt.
    """
    for run in para.runs:
        if run.font.size == TITLE_FONT_SIZE and run.text.strip():
            return True
    return False


def para_to_markdown_lines(para) -> list[str]:
    """
    Convert a paragraph to one or more markdown lines.

    Only LEADING bold runs (before the first non-bold run on each line) are
    wrapped in **. This preserves structural labels like "**Parents:**" and
    standalone subheadings like "**Early Life**", while leaving name references
    in the middle of paragraphs as plain text so linkify can match them.
    """
    if not para.text.strip():
        return []

    # Matches "**Label:**X" where X is non-whitespace — inserts a space so
    # bold labels don't butt up against their values (e.g. "**Built:**1876").
    LABEL_NO_SPACE_RE = re.compile(r'(\*\*[^*\n]+?:\*\*)(\S)')

    def finalize(parts: list[str]) -> str:
        line = "".join(parts).strip()
        return LABEL_NO_SPACE_RE.sub(r'\1 \2', line)

    lines = []
    current: list[str] = []
    seen_non_bold = False  # reset each time we start a new line

    for run in para.runs:
        is_bold = run.bold or run_has_strong_style(run)
        segments = run.text.split("\n")

        for i, segment in enumerate(segments):
            if i > 0:
                # Flush line and reset bold-tracking for the new line
                line = finalize(current)
                if line:
                    lines.append(line)
                current = []
                seen_non_bold = False

            if segment:
                apply_bold = is_bold and not seen_non_bold
                if not is_bold:
                    seen_non_bold = True
                if apply_bold:
                    # Move leading/trailing whitespace OUTSIDE the ** markers,
                    # otherwise "**Architect: **" won't render as bold.
                    stripped = segment.strip()
                    if stripped:
                        lead = segment[:len(segment) - len(segment.lstrip())]
                        trail = segment[len(segment.rstrip()):]
                        current.append(f"{lead}**{stripped}**{trail}")
                    else:
                        current.append(segment)
                else:
                    current.append(segment)

    last = finalize(current)
    if last:
        lines.append(last)

    return lines


def extract_images(para, doc, article_slug: str, image_counter: list[int]) -> list[str]:
    """
    Extract any inline images from a paragraph, save to IMAGES_DIR, and return
    a list of markdown image tags referencing the web path /images/<filename>.
    """
    tags = []
    for blip in para._element.findall(".//a:blip", IMAGE_NS):
        rid = blip.get(R_EMBED)
        if not rid:
            continue
        part = doc.part.related_parts[rid]
        ext = part.partname.rsplit(".", 1)[-1].lower()
        filename = f"{article_slug}-{image_counter[0]}.{ext}"
        image_counter[0] += 1
        (IMAGES_DIR / filename).write_bytes(part.blob)
        tags.append(f"![{article_slug}](/images/{filename})")
    return tags


def extract_articles(doc_path: Path) -> list[tuple[str, list[str]]]:
    """
    Returns a list of (title, markdown_lines) tuples.
    """
    doc = Document(doc_path)
    articles = []
    current_title = None
    current_slug = None
    current_lines = []
    current_image_counter = [1]
    count = 0

    for para in doc.paragraphs:
        if is_article_title(para):
            title = para.text.strip()
            if not title:
                continue

            # Save previous article
            if current_title:
                articles.append((current_title, current_lines))
                count += 1
                if MAX_ARTICLES is not None and count >= MAX_ARTICLES:
                    current_title = None
                    break

            current_title = title
            current_slug = slugify(title)
            current_lines = [f"# {title}", ""]
            current_image_counter = [1]
        elif current_title:
            # Images
            image_tags = extract_images(para, doc, current_slug, current_image_counter)
            for tag in image_tags:
                current_lines.append(tag)
                current_lines.append("")

            # Text
            lines = para_to_markdown_lines(para)
            if lines:
                current_lines.extend(lines)
                current_lines.append("")

    # Save last article if within limit
    if current_title and (MAX_ARTICLES is None or len(articles) < MAX_ARTICLES):
        articles.append((current_title, current_lines))

    return articles


MAX_SLUG_LENGTH = 200

def write_article(title: str, lines: list[str], output_dir: Path) -> Path | None:
    if not title or not title.strip():
        print(f"  Skipped: article has no title")
        return None
    if len(title) > 120:
        print(f"  Warning: suspiciously long title ({len(title)} chars) — may be a mis-formatted paragraph: {title[:80]!r}…")
    slug = slugify(title)
    if not slug:
        print(f"  Skipped: title {title!r} slugifies to empty string")
        return None
    if len(slug) > MAX_SLUG_LENGTH:
        slug = slug[:MAX_SLUG_LENGTH].rstrip('-')
    path = output_dir / f"{slug}.md"
    content = "\n".join(lines).rstrip() + "\n"
    path.write_text(content, encoding="utf-8")
    return path


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    IMAGES_DIR.mkdir(exist_ok=True)
    
    for f in OUTPUT_DIR.glob("*.md"):
        f.unlink()
    for f in IMAGES_DIR.iterdir():
        if f.is_file():
            f.unlink()

    docx_files = sorted(SOURCE_DIR.glob("*.docx"))

    if not docx_files:
        print(f"No .docx files found in {SOURCE_DIR}/")
        return

    for docx_path in docx_files:
        print(f"Processing {docx_path.name}...")
        articles = extract_articles(docx_path)
        for title, lines in articles:
            out_path = write_article(title, lines, OUTPUT_DIR)
            if out_path:
                print(f"  Wrote: {out_path}")

    print("Done.")


if __name__ == "__main__":
    main()
