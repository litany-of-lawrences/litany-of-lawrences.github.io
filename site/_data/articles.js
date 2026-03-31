const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.join(__dirname, "../../articles");

function extractTitle(content) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : null;
}

function extractDates(title) {
  const match = title.match(/\((\d{4}[–\-]\d*\s*)\)/);
  return match ? match[1].trim() : null;
}

function extractCategory(title) {
  if (/^[A-Za-z]+, [A-Za-z]/.test(title)) return "Person";
  if (title.includes("Family")) return "Family";
  return "Other";
}

function extractExcerpt(content) {
  // Start from "Early Life" section if present, otherwise scan from the top
  const earlyLife = content.match(/^\*\*Early\s+[Ll]ife[^*]*\*\*\s*$/m);
  const searchContent = earlyLife
    ? content.slice(earlyLife.index + earlyLife[0].length)
    : content;

  for (const line of searchContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;     // markdown headings
    if (trimmed.startsWith("**")) continue;    // bold headings / metadata labels
    if (trimmed.startsWith("![")) continue;    // images
    if (trimmed.length < 20) continue;
    const clean = trimmed.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    return clean.slice(0, 200);
  }
  return "";
}

module.exports = function () {
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith(".md"));
  return files.map(filename => {
    const slug = filename.replace(/\.md$/, "");
    const content = fs.readFileSync(path.join(ARTICLES_DIR, filename), "utf8");
    const title = extractTitle(content) || slug;
    const dates = extractDates(title);
    const category = extractCategory(title);
    const excerpt = extractExcerpt(content);
    return { title, slug, dates, category, excerpt };
  }).sort((a, b) => a.title.localeCompare(b.title));
};
