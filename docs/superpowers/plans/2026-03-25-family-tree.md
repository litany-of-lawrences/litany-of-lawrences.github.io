# Family Tree Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/family-tree/` page that displays an interactive, person-centred D3 family tree navigable by clicking any node.

**Architecture:** A Node.js Eleventy data file (`familytree.js`) globs all person articles, parses their `**Parents:**` fields, and produces a `{nodes, links}` graph. A Nunjucks template injects that data into the page as JSON and loads D3 + a custom JS file that renders a three-row SVG view (parents → focus → children), re-rendering on node click.

**Tech Stack:** Eleventy 3.x, Nunjucks, D3 v7 (CDN), Node.js `node:test`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `site/_data/familytree.js` | Create | Parse articles, build `{nodes, links}` graph |
| `site/test/familytree.test.js` | Create | Unit tests for parsing helpers and full output |
| `site/family-tree.njk` | Create | Page template, injects JSON, loads D3 + JS |
| `site/js/family-tree.js` | Create | D3 rendering: layout, data joins, zoom, click |
| `site/_includes/base.njk` | Modify | Insert Family Tree nav link |
| `site/scss/main.scss` | Modify | Add `.site-nav-link` style |

---

## Task 1: Data file — `site/_data/familytree.js`

**Files:**
- Create: `site/_data/familytree.js`
- Create: `site/test/familytree.test.js`

**Context:**
- All existing data files live in `site/_data/` and use `const ARTICLES_DIR = path.join(__dirname, "../../articles")`.
- Tests live in `site/test/` and run via `npm test` from `site/` (which runs `node --test test/data.test.js` — update this to include `familytree.test.js` too).
- Person article titles use `Surname, Given Name (YYYY–YYYY)` format. Non-person articles (e.g. `alexandre-family.md`) have no dates in their titles.
- The `**Parents:**` field appears on the first non-blank line after the title in person articles.
- `Jr.` may appear with or without a trailing period in titles and parent fields.

- [ ] **Step 1: Write the test file**

Create `site/test/familytree.test.js`:

```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Load module and expose internal helpers via module.exports._test
function loadModule() {
  // Clear require cache so tests get a fresh module each run
  delete require.cache[require.resolve("../_data/familytree.js")];
  return require("../_data/familytree.js");
}

describe("familytree.js helpers", () => {
  let helpers;
  it("module loads and exposes _test helpers", () => {
    const mod = loadModule();
    assert.ok(typeof mod === "function");
    assert.ok(mod._test, "expected _test export on module");
    helpers = mod._test;
  });

  describe("reverseNameOrder", () => {
    it("reverses Surname, Given Name format", () => {
      const { reverseNameOrder } = require("../_data/familytree.js")._test;
      assert.equal(reverseNameOrder("Alexandre, James Henry"), "James Henry Alexandre");
    });

    it("moves trailing suffix after surname", () => {
      const { reverseNameOrder } = require("../_data/familytree.js")._test;
      assert.equal(reverseNameOrder("Alexandre, James Henry Jr"), "James Henry Alexandre Jr");
    });

    it("handles III suffix", () => {
      const { reverseNameOrder } = require("../_data/familytree.js")._test;
      assert.equal(reverseNameOrder("Alexandre, James Henry III"), "James Henry Alexandre III");
    });

    it("returns unchanged if no comma", () => {
      const { reverseNameOrder } = require("../_data/familytree.js")._test;
      assert.equal(reverseNameOrder("Marie Cipriant"), "Marie Cipriant");
    });
  });

  describe("shouldSkip", () => {
    it("skips 'Not yet identified'", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(shouldSkip("Not yet identified"));
    });

    it("skips case-insensitive variant", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(shouldSkip("not yet identified"));
    });

    it("skips 'Unknown'", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(shouldSkip("Unknown farmers of Saint Helier"));
    });

    it("skips single-word tokens", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(shouldSkip("Alexandre"));
    });

    it("does not skip a valid two-word name", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(!shouldSkip("Marie Cipriant"));
    });
  });

  describe("parseParentsField", () => {
    const { parseParentsField } = require("../_data/familytree.js")._test;

    it("parses a linked parent", () => {
      const result = parseParentsField(
        "[Frederick Francis Alexandre](/alexandre-frederick-francis-1809-1889/) (1809–1889) and Marie Cipriant (1811–1882)."
      );
      assert.equal(result.length, 2);
      assert.equal(result[0].id, "alexandre-frederick-francis-1809-1889");
      assert.equal(result[0].name, "Frederick Francis Alexandre");
    });

    it("parses an unlinked parent", () => {
      const result = parseParentsField("Marie Cipriant (1811–1882) and John Doe (1810–1870).");
      assert.equal(result.length, 2);
      assert.equal(result[0].name, "Marie Cipriant");
      assert.equal(result[0].dates, "1811–1882");
      assert.equal(result[0].hasArticle, false);
    });

    it("extracts generational suffix Jr from linked parent remainder", () => {
      const result = parseParentsField(
        "[James Henry Alexandre](/alexandre-james-henry-1848-1912/) Jr (1883–1956) and Anne Loomis (1890–1948)."
      );
      assert.equal(result[0].name, "James Henry Alexandre Jr");
    });

    it("skips 'Not yet identified' bare bracket token", () => {
      const result = parseParentsField("[Not yet identified] and Marie Cipriant (1811–1882).");
      assert.equal(result.length, 1);
      assert.equal(result[0].name, "Marie Cipriant");
    });

    it("truncates at semicolon", () => {
      const result = parseParentsField("Marie Cipriant (1811–1882); Spouse: ignored.");
      assert.equal(result.length, 1);
    });

    it("strips backslash before truncation", () => {
      const result = parseParentsField("Marie Cipriant (1811–1882).\\ Spouse: ignored.");
      assert.equal(result.length, 1);
    });

    it("handles Jr. with period (normalised before truncation)", () => {
      const result = parseParentsField(
        "Frederick Alexandre Jr. (1809–1889) and Marie Cipriant (1811–1882)."
      );
      assert.equal(result.length, 2, "Jr. period must not truncate the field early");
    });
  });
});

describe("familytree.js full output", () => {
  it("returns { nodes, links } shape", () => {
    const mod = require("../_data/familytree.js");
    const data = mod();
    assert.ok(Array.isArray(data.nodes), "nodes should be an array");
    assert.ok(Array.isArray(data.links), "links should be an array");
  });

  it("all nodes have required fields", () => {
    const { nodes } = require("../_data/familytree.js")();
    for (const n of nodes) {
      assert.ok(n.id, `node missing id: ${JSON.stringify(n)}`);
      assert.ok(n.name, `node missing name: ${JSON.stringify(n)}`);
      assert.ok(typeof n.hasArticle === "boolean", `node missing hasArticle: ${JSON.stringify(n)}`);
    }
  });

  it("article-backed nodes have hasArticle: true", () => {
    const { nodes } = require("../_data/familytree.js")();
    const james = nodes.find(n => n.id === "alexandre-james-henry-1848-1912");
    assert.ok(james, "alexandre-james-henry-1848-1912 node not found");
    assert.ok(james.hasArticle === true);
    assert.equal(james.name, "James Henry Alexandre");
  });

  it("node names are in natural order (Given Surname), not title order (Surname, Given)", () => {
    const { nodes } = require("../_data/familytree.js")();
    for (const n of nodes) {
      assert.ok(!n.name.includes(","), `name should not contain comma: "${n.name}"`);
    }
  });

  it("Jr article node has suffix after surname", () => {
    const { nodes } = require("../_data/familytree.js")();
    const jr = nodes.find(n => n.id === "alexandre-james-henry-jr-1883-1956");
    assert.ok(jr, "Jr node not found");
    assert.ok(jr.name.endsWith("Jr"), `expected name to end with Jr, got: "${jr.name}"`);
  });

  it("links have source and target fields", () => {
    const { links } = require("../_data/familytree.js")();
    for (const l of links) {
      assert.ok(l.source, `link missing source: ${JSON.stringify(l)}`);
      assert.ok(l.target, `link missing target: ${JSON.stringify(l)}`);
    }
  });

  it("james henry 1848 is a parent of at least one article", () => {
    const { links } = require("../_data/familytree.js")();
    const found = links.some(l => l.source === "alexandre-james-henry-1848-1912");
    assert.ok(found, "expected alexandre-james-henry-1848-1912 to appear as a parent");
  });

  it("no duplicate links", () => {
    const { links } = require("../_data/familytree.js")();
    const seen = new Set();
    for (const l of links) {
      const key = `${l.source}→${l.target}`;
      assert.ok(!seen.has(key), `duplicate link: ${key}`);
      seen.add(key);
    }
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
cd site && node --test test/familytree.test.js
```

Expected: errors like `Cannot find module '../_data/familytree.js'`

- [ ] **Step 3: Implement `site/_data/familytree.js`**

```js
const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.join(__dirname, "../../articles");
const DATES_RE = /\(\d{4}(?:[–\-]\d*)?\s*\)/;
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

function normalizeJr(str) {
  return str.replace(/\bJr\.\b/gi, "Jr");
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
      // hasArticle: true is a proposal only — the upsert rule in the main function
      // always sets hasArticle: false for nodes inserted during step 2
      parents.push({ id: slug, name, dates, hasArticle: true });
    } else {
      // Treat bare bracket expressions without a URL as plain text
      const plain = t.replace(/\[([^\]]+)\]/g, "$1");
      const nameText = stripDates(plain);
      if (shouldSkip(nameText)) continue;
      const dates = extractDates(plain);
      const id = slugify(nameText);
      parents.push({ id, name: nameText, dates, hasArticle: false });
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

  // Warn if a slug is used as parent in more than 3 articles (likely a mislinked slug)
  for (const [slug, count] of Object.entries(parentCounts)) {
    if (count > 3) {
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
```

- [ ] **Step 4: Run the tests — verify they pass**

```bash
cd site && node --test test/familytree.test.js
```

Expected: all tests pass (green)

- [ ] **Step 5: Update `package.json` test script to include the new test file**

In `site/package.json`, change the `test` script from:
```json
"test": "node --test test/data.test.js"
```
to:
```json
"test": "node --test test/data.test.js test/familytree.test.js"
```

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

```bash
cd site && npm test
```

Expected: all tests pass

---

## Task 2: Page template — `site/family-tree.njk`

**Files:**
- Create: `site/family-tree.njk`

**Context:**
- Templates extend `base.njk` from `site/_includes/base.njk`. See `site/index.njk` for a working example of the extension pattern.
- `{% block head %}` is for per-page `<head>` additions (scripts, meta). Defined in `base.njk` line 9.
- `{% block content %}` is the main page content. Defined in `base.njk` line 21.
- The `familytree` data key matches the filename `site/_data/familytree.js` — Eleventy auto-registers it.
- `familytree | dump | safe` serialises the JS object to JSON string.
- D3 must load **synchronously** (no `defer`) before `family-tree.js` so that `d3` is available when the deferred script runs.

- [ ] **Step 1: Create the template**

```njk
---
layout: base.njk
title: Family Tree
permalink: /family-tree/
---

{% block head %}
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="/js/family-tree.js" defer></script>
{% endblock %}

{% block content %}
<script type="application/json" id="familytree-data" data-pagefind-ignore>{{ familytree | dump | safe }}</script>
<svg id="family-tree" width="100%" data-pagefind-ignore>
  <g id="tree-root"></g>
</svg>
{% endblock %}
```

- [ ] **Step 2: Run the build and verify the page exists in `_site/`**

```bash
cd site && npm run build 2>&1 | tail -20
```

Expected: build completes without errors, no "template not found" messages

```bash
ls site/_site/family-tree/
```

Expected: `index.html` present

- [ ] **Step 3: Check the generated HTML has the expected elements**

```bash
grep -c "familytree-data" site/_site/family-tree/index.html
grep -c "family-tree" site/_site/family-tree/index.html
```

Expected: both return `1` or more

---

## Task 3: Nav link and SCSS — `base.njk` + `main.scss`

**Files:**
- Modify: `site/_includes/base.njk`
- Modify: `site/scss/main.scss`

**Context:**
- The nav in `base.njk` (lines 14–19) has a `.site-title` anchor followed by a blank line and then `{% block navsearch %}`. Insert the new `<a>` element between them.
- `main.scss` already has `.site-nav a { text-decoration: none }` which applies to `.site-nav-link` automatically. Do not add a redundant `text-decoration` property.
- The SCSS variables are defined at the top of `main.scss`: `$color-nav-text: #f0e6d3`, `$color-gold: #c8a96e`.

- [ ] **Step 1: Insert the nav link in `base.njk`**

In `site/_includes/base.njk`, insert the new `<a>` on its own line between the `.site-title` anchor and the `{% block navsearch %}` block:

Before:
```html
        <a href="/" class="site-title">A Litany of Lawrences</a>

    {% block navsearch %}{% endblock %}
```

After:
```html
        <a href="/" class="site-title">A Litany of Lawrences</a>
    <a href="/family-tree/" class="site-nav-link">Family Tree</a>

    {% block navsearch %}{% endblock %}
```

- [ ] **Step 2: Add the `.site-nav-link` style to `main.scss`**

Add after the `.site-tagline` block (around line 82), before `.nav-search`:

```scss
.site-nav-link {
  color: $color-nav-text;
  font-size: 14px;
  letter-spacing: 1px;
  text-transform: uppercase;
  &:hover { color: $color-gold; }
}
```

- [ ] **Step 3: Build and verify the nav link appears**

```bash
cd site && npm run build 2>&1 | tail -5
```

Expected: build completes without errors

```bash
grep "family-tree" site/_site/index.html
```

Expected: line containing `href="/family-tree/"` visible in the nav

---

## Task 4: Family tree JS — `site/js/family-tree.js`

**Files:**
- Create: `site/js/family-tree.js`

**Context:**
- This file is passthrough-copied to `_site/js/family-tree.js` by the existing `addPassthroughCopy({ "site/js": "js" })` in `.eleventy.js`. No config change needed.
- D3 v7 is loaded synchronously before this script (see Task 2 template). `d3` is available as a global.
- The SVG `#family-tree` contains `<g id="tree-root">` which is the sole render target.
- Node colour constants match the site palette: gold `#c8a96e`, border `#c8b89a`, parchment `#f5f0e8`, sidebar `#ede8dc`, brown `#2c1810`, muted `#aaa`.
- Testing this file is done manually in the browser — open `http://localhost:8080/family-tree/` after running `npm run serve`.

**Visual style reference:**

| Role | Radius | Fill | Stroke | Text colour |
|------|--------|------|--------|-------------|
| Focused | 44px | `#fff` | `#c8a96e` 2.5px | `#2c1810` |
| With article | 32px | `#ede8dc` | `#c8b89a` 1.5px | `#2c1810` |
| Without article | 26px | `#f5f0e8` | `#c8b89a` opacity 0.5 | `#aaa` |

- [ ] **Step 1: Create `site/js/family-tree.js`**

```js
(function () {
  const svgEl = document.getElementById("family-tree");
  if (!svgEl) return; // Guard: only run on the family-tree page

  // ── Module-level state ───────────────────────────────────────────────────
  let currentFocusId = null;

  const zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on("zoom", e => d3.select("#tree-root").attr("transform", e.transform));

  // ── Load data ────────────────────────────────────────────────────────────
  const dataEl = document.getElementById("familytree-data");
  const { nodes, links } = JSON.parse(dataEl.textContent);

  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Build adjacency maps
  const childrenOf = new Map();
  const parentsOf = new Map();
  for (const link of links) {
    if (!parentsOf.has(link.target)) parentsOf.set(link.target, []);
    parentsOf.get(link.target).push(nodeById.get(link.source));

    if (!childrenOf.has(link.source)) childrenOf.set(link.source, []);
    childrenOf.get(link.source).push(nodeById.get(link.target));
  }
  // Filter out undefined entries (links to nodes not in the map)
  for (const [k, v] of parentsOf) parentsOf.set(k, v.filter(Boolean));
  for (const [k, v] of childrenOf) childrenOf.set(k, v.filter(Boolean));

  // ── Size SVG ─────────────────────────────────────────────────────────────
  const navEl = document.querySelector(".site-nav");
  svgEl.setAttribute("height", window.innerHeight - (navEl ? navEl.offsetHeight : 0));

  d3.select(svgEl).call(zoom);

  // ── Initial focus ─────────────────────────────────────────────────────────
  const articleNodes = nodes.filter(n => n.hasArticle);
  if (!articleNodes.length) return;
  const initialNode = articleNodes[Math.floor(Math.random() * articleNodes.length)];
  renderFocus(initialNode, false);
  requestAnimationFrame(fitToView);

  // ── renderFocus ───────────────────────────────────────────────────────────
  function renderFocus(focusNode, animate) {
    if (animate === undefined) animate = true;
    if (focusNode.id === currentFocusId) return;
    currentFocusId = focusNode.id;

    const parents  = parentsOf.get(focusNode.id)  ?? [];
    const children = childrenOf.get(focusNode.id) ?? [];

    // Compute positions
    const w  = svgEl.clientWidth;
    const h  = svgEl.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    const ROW_GAP  = 160;
    const NODE_GAP = 120;

    function rowX(i, total) {
      return cx - ((total - 1) / 2) * NODE_GAP + i * NODE_GAP;
    }

    const positioned = [
      ...parents.map((n, i)  => ({ ...n, x: rowX(i, parents.length),  y: cy - ROW_GAP, role: "parent" })),
      { ...focusNode,            x: cx,                                 y: cy,           role: "focus"  },
      ...children.map((n, i) => ({ ...n, x: rowX(i, children.length), y: cy + ROW_GAP, role: "child"  })),
    ];

    // Build line data (lines drawn BEFORE nodes so they render beneath)
    const focusPos = positioned.find(n => n.id === focusNode.id);
    const lineData = [
      ...parents.map((p, i) => ({
        source: p.id, target: focusNode.id,
        x1: rowX(i, parents.length), y1: cy - ROW_GAP,
        x2: cx, y2: cy,
      })),
      ...children.map((c, i) => ({
        source: focusNode.id, target: c.id,
        x1: cx, y1: cy,
        x2: rowX(i, children.length), y2: cy + ROW_GAP,
      })),
    ];

    const root = d3.select("#tree-root");
    const dur  = animate ? 300 : 0;
    const ease = d3.easeQuadInOut;

    // ── Line join (before node join for correct z-order) ──
    const lineUpdate = root.selectAll("line")
      .data(lineData, d => d.source + d.target);

    lineUpdate.enter()
      .append("line")
      .attr("x1", cx).attr("y1", cy)
      .attr("x2", cx).attr("y2", cy)
      .attr("stroke", "#c8b89a")
      .attr("stroke-width", 1.5)
      .merge(lineUpdate)
      .transition().duration(dur).ease(ease)
      .attr("x1", d => d.x1).attr("y1", d => d.y1)
      .attr("x2", d => d.x2).attr("y2", d => d.y2);

    lineUpdate.exit().remove();

    // ── Node join ──
    const nodeUpdate = root.selectAll("g.node")
      .data(positioned, d => d.id);

    const nodeEnter = nodeUpdate.enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", `translate(${cx},${cy})`);

    nodeEnter.append("circle");
    nodeEnter.append("text").attr("class", "node-name").attr("text-anchor", "middle").attr("dy", "-0.3em");
    nodeEnter.append("text").attr("class", "node-dates").attr("text-anchor", "middle").attr("dy", "1.2em").attr("font-size", "11px");

    // "Read →" link — only for nodes with articles
    nodeEnter.filter(d => d.hasArticle)
      .append("a")
      .attr("href", d => `/${d.id}/`)
      .on("click", e => e.stopPropagation())
      .append("text")
      .attr("class", "node-link")
      .attr("text-anchor", "middle")
      .attr("dy", "2.4em")
      .attr("font-size", "10px")
      .attr("fill", "#8b6340")
      .attr("text-decoration", "underline")
      .text("Read →");

    // Click handler: re-centre on clickable nodes
    nodeEnter.filter(d => d.hasArticle)
      .style("cursor", "pointer")
      .on("click", function (event, d) {
        if (d.role !== "focus") renderFocus(d);
      });

    const nodeMerge = nodeEnter.merge(nodeUpdate);

    // Apply positions with transition
    nodeMerge.transition().duration(dur).ease(ease)
      .attr("transform", d => `translate(${d.x},${d.y})`);

    // Apply styles based on role (role can change between renders)
    nodeMerge.each(function (d) {
      const g = d3.select(this);
      if (d.role === "focus") {
        g.select("circle").attr("r", 44).attr("fill", "#fff").attr("stroke", "#c8a96e").attr("stroke-width", 2.5);
        g.select(".node-name").attr("fill", "#2c1810").attr("font-size", "13px");
        g.select(".node-dates").attr("fill", "#2c1810");
        g.style("cursor", "default");
      } else if (d.hasArticle) {
        g.select("circle").attr("r", 32).attr("fill", "#ede8dc").attr("stroke", "#c8b89a").attr("stroke-width", 1.5).attr("opacity", null);
        g.select(".node-name").attr("fill", "#2c1810").attr("font-size", "12px");
        g.select(".node-dates").attr("fill", "#2c1810");
        g.style("cursor", "pointer");
      } else {
        g.select("circle").attr("r", 26).attr("fill", "#f5f0e8").attr("stroke", "#c8b89a").attr("stroke-width", 1).attr("stroke-opacity", 0.5);
        g.select(".node-name").attr("fill", "#aaa").attr("font-size", "11px");
        g.select(".node-dates").attr("fill", "#aaa");
        g.style("cursor", "default").style("pointer-events", "none");
      }

      // Name text — split long names onto two dy lines via tspan if needed
      const nameEl = g.select(".node-name");
      nameEl.text(null);
      const words = (d.name || "").split(" ");
      if (words.length <= 2) {
        nameEl.text(d.name || "");
      } else {
        const mid = Math.ceil(words.length / 2);
        nameEl.append("tspan").attr("x", 0).attr("dy", "-0.9em").text(words.slice(0, mid).join(" "));
        nameEl.append("tspan").attr("x", 0).attr("dy", "1.2em").text(words.slice(mid).join(" "));
      }

      g.select(".node-dates").text(d.dates ? d.dates : "");
    });

    nodeUpdate.exit().remove();
  }

  // ── fitToView ─────────────────────────────────────────────────────────────
  function fitToView() {
    const bounds = d3.select("#tree-root").node().getBBox();
    if (!bounds.width && !bounds.height) return; // empty graph guard
    const pad = 60;
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    const scale = Math.min(
      w / (bounds.width  + pad * 2),
      h / (bounds.height + pad * 2),
      1
    );
    const tx = (w - (bounds.width  + pad * 2) * scale) / 2 - bounds.x * scale + pad * scale;
    const ty = (h - (bounds.height + pad * 2) * scale) / 2 - bounds.y * scale + pad * scale;
    const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
    d3.select("#family-tree").call(zoom.transform, t);
  }
}());
```

- [ ] **Step 2: Run the build**

```bash
cd site && npm run build 2>&1 | tail -10
```

Expected: build completes, `site/_site/js/family-tree.js` exists

```bash
ls site/_site/js/family-tree.js
```

- [ ] **Step 3: Start the dev server and verify the page in a browser**

```bash
cd site && npm run serve
```

Open `http://localhost:8080/family-tree/` in a browser.

**Manual checklist:**
- [ ] The page loads without console errors
- [ ] A tree is visible: one large centre node with parents above and/or children below
- [ ] Lines connect the nodes
- [ ] Clicking a parent or child node re-centres the view on that node
- [ ] "Read →" links appear on nodes with articles and navigate to the article
- [ ] Pan (drag) and zoom (scroll) work
- [ ] The "Family Tree" link appears in the site nav on all pages
- [ ] The nav link on the homepage and article pages links to `/family-tree/`

---

## Task 5: Final build and test verification

- [ ] **Step 1: Run the full test suite**

```bash
cd site && npm test
```

Expected: all tests pass (data.test.js + familytree.test.js)

- [ ] **Step 2: Run a production build**

```bash
cd site && npm run build 2>&1 | grep -E "error|warning|Error|Warning" | grep -v "familytree.*WARNING"
```

Expected: no error lines (familytree slug-warning lines are expected and fine)

- [ ] **Step 3: Verify the Pagefind index does not include tree content**

```bash
grep -r "James Henry" site/_site/pagefind/ 2>/dev/null | head -3
```

Expected: no results, or results only from article pages (not from the family tree SVG nodes — those are JS-rendered and not in the static HTML)
