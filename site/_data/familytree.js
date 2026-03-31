const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.join(__dirname, "../../articles");
const DATES_RE = /\(\d{4}(?:[–\-]\d*)?\s*\)/;
const PARENT_COUNT_WARNING_THRESHOLD = 3;
const SUFFIX_RE_END = /\s+(Jr\.?|IV|III|II|V)$/i;
const SUFFIX_RE_START = /^(Jr\.?|IV|III|II|V)\b/i;
const LINKED_RE = /\[([^\]]+)\]\(\/([^)/]+)\/\)/;

function stripDates(str) {
  return str.replace(/\s*\(\d{4}(?:[–\-]\d*)?\s*\)/g, "").trim();
}

function extractDates(str) {
  const m = str.match(/\((\d{4}(?:[–\-]\d*)?)\s*\)/);
  return m ? m[1].trim() : null;
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Only Jr. needs normalisation — other generational suffixes (II, III, IV, V)
// do not appear with trailing periods in the current dataset.
function normalizeJr(str) {
  return str.replace(/\bJr\./gi, "Jr");
}

function reverseNameOrder(titleAfterDatesStripped) {
  // Input: "Surname, Given Name [Jr]" — output: "Given Name Surname [Jr]"
  const commaIdx = titleAfterDatesStripped.indexOf(",");
  if (commaIdx === -1) return titleAfterDatesStripped.trim();
  const surname = titleAfterDatesStripped.slice(0, commaIdx).trim();
  let given = titleAfterDatesStripped.slice(commaIdx + 1).trim();
  // Extract trailing suffix (e.g. Jr, III) from the given part before reordering
  const suffixMatch = given.match(SUFFIX_RE_END);
  let suffix = "";
  if (suffixMatch) {
    suffix = " " + suffixMatch[1];
    given = given.slice(0, suffixMatch.index).trim();
  }
  return `${given} ${surname}${suffix}`;
}

function shouldSkip(name) {
  const clean = name.replace(/[.,;]/g, "").trim();
  if (/not yet identified/i.test(clean)) return true;
  if (/^unknown/i.test(clean)) return true;
  if (clean.split(/\s+/).filter(Boolean).length < 2) return true;
  return false;
}

function parseParentsField(rawValue) {
  // Step 1: strip backslashes (defensive cleanup for "\. Spouse:" continuations)
  let text = rawValue.replace(/\\/g, "");
  // Step 2: normalise Jr. → Jr so the period doesn't act as a sentence terminator
  text = normalizeJr(text);
  // Step 3: truncate at first period or semicolon
  const stop = text.search(/[.;]/);
  if (stop !== -1) text = text.slice(0, stop);
  // Step 4: split on " and " to get individual parent tokens
  const parents = [];
  for (const token of text.split(" and ")) {
    const t = token.trim();
    if (!t) continue;

    const linkedMatch = t.match(LINKED_RE);
    if (linkedMatch) {
      const linkText = linkedMatch[1];
      const slug = linkedMatch[2];
      const remainder = t.slice(linkedMatch.index + linkedMatch[0].length).trim();
      const nameBase = stripDates(linkText);
      if (shouldSkip(nameBase)) continue;
      // Extract generational suffix from start of remainder (e.g. "Jr (1883–1956)" → suffix "Jr")
      const suffixMatch = remainder.match(SUFFIX_RE_START);
      const name = suffixMatch ? `${nameBase} ${suffixMatch[1]}` : nameBase;
      const dates = extractDates(linkText) || extractDates(remainder);
      parents.push({ id: slug, name, dates });
    } else {
      // Treat bare bracket expressions without a URL as plain text
      const plain = t.replace(/\[([^\]]+)\]/g, "$1");
      const nameText = stripDates(plain);
      if (shouldSkip(nameText)) continue;
      const dates = extractDates(plain);
      const id = slugify(nameText);
      parents.push({ id, name: nameText, dates });
    }
  }
  return parents;
}

module.exports = function () {
  const nodeMap = new Map();
  const linkSet = new Set();
  const links = [];
  const parentCounts = {};

  // Step 1: add all person articles to the map (hasArticle: true)
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith(".md"))
    .sort();

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const content = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf8");
    const titleMatch = content.match(/^# (.+)$/m);
    if (!titleMatch) continue;
    const rawTitle = titleMatch[1].trim();
    // Filter: only include person articles (titles with a date pattern)
    if (!DATES_RE.test(rawTitle)) continue;

    const dates = extractDates(rawTitle);
    const normalized = normalizeJr(rawTitle);
    const withoutDates = stripDates(normalized);
    const name = reverseNameOrder(withoutDates);
    nodeMap.set(slug, { id: slug, name, dates, hasArticle: true });
  }

  // Step 2: parse Parents fields, upsert nodes, collect links
  for (const file of files) {
    const childSlug = file.replace(/\.md$/, "");
    if (!nodeMap.has(childSlug)) continue;

    const content = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf8");
    const parentsMatch = content.match(/\*\*Parents:\*\*\s*(.+)/);
    if (!parentsMatch) continue;

    const parents = parseParentsField(parentsMatch[1]);
    for (const parent of parents) {
      if (!nodeMap.has(parent.id)) {
        // Step 1 is authoritative for hasArticle — nodes first seen in step 2 have no article
        nodeMap.set(parent.id, {
          id: parent.id,
          name: parent.name,
          dates: parent.dates,
          hasArticle: false,
        });
      } else {
        // Fill in missing name/dates without overwriting existing values
        const existing = nodeMap.get(parent.id);
        if (!existing.name && parent.name) existing.name = parent.name;
        if (!existing.dates && parent.dates) existing.dates = parent.dates;
      }

      // Track parent slug usage for over-linking warnings
      parentCounts[parent.id] = (parentCounts[parent.id] || 0) + 1;

      const key = `${parent.id}\u2192${childSlug}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push({ source: parent.id, target: childSlug });
      }
    }
  }

  // Warn if a slug is used as parent in more than threshold articles (likely a mislinked slug)
  for (const [slug, count] of Object.entries(parentCounts)) {
    if (count > PARENT_COUNT_WARNING_THRESHOLD) {
      process.stderr.write(
        `[familytree] WARNING: "${slug}" appears as a parent in ${count} articles — possible mislinked slug\n`
      );
    }
  }

  return { nodes: Array.from(nodeMap.values()), links };
};

// Expose helpers for unit testing only
module.exports._test = {
  reverseNameOrder,
  parseParentsField,
  extractDates,
  stripDates,
  shouldSkip,
  normalizeJr,
};
