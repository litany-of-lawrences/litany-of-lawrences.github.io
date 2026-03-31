# GitHub Pages Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static Eleventy site with archival styling, Pagefind search, and backlink-aware sidebars, deployed to GitHub Pages on every push to `main`.

**Architecture:** Eleventy reads `articles/*.md` from the repo root, processes them through Nunjucks templates, and outputs to `site/_site/`. Three global data files compute the article manifest, backlinks index, and outgoing-links index at build time. Pagefind runs post-build to produce a client-side search index.

**Tech Stack:** Eleventy 3.x, Nunjucks, Pagefind, GitHub Actions (`peaceiris/actions-gh-pages`), Node.js built-in test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-03-24-github-pages-wiki-design.md`

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `linkify.py` | Modify | Change link targets from `filename.md` to `/slug/` |
| `.eleventyignore` | Create | Exclude `docs/`, `venv/`, `source-documents/`, `site/_site/` |
| `articles/articles.11tydata.js` | Create | Apply `article.njk` layout + permalink to all articles |
| `site/package.json` | Create | Node deps + `build`/`serve`/`test` scripts |
| `site/.eleventy.js` | Create | Eleventy config: input=`.`, output=`site/_site`, passthrough images |
| `site/_data/articles.js` | Create | Article manifest: `[{title, slug, dates, excerpt, category}]` |
| `site/_data/backlinks.js` | Create | Reverse-link index: `{ slug: [{title,slug}] }` |
| `site/_data/outgoinglinks.js` | Create | Outgoing-link index: `{ slug: [{title,slug}] }` |
| `site/_includes/base.njk` | Create | HTML shell, archival CSS, nav bar |
| `site/_includes/article.njk` | Create | Two-column article page (sidebar + prose) |
| `site/index.njk` | Create | Homepage: search box + random article card |
| `site/test/data.test.js` | Create | Unit tests for the three `_data/` files |
| `.github/workflows/deploy.yml` | Create | CI: build + pagefind + deploy to `gh-pages` |

---

## Task 1: Update linkify.py to write /slug/ hrefs

Articles currently have links like `(alexandre-james-henry-1848-1912.md)`. These must become `(/alexandre-james-henry-1848-1912/)` before the build so Eleventy renders working `href` values.

**Files:**
- Modify: `linkify.py`

- [ ] **Step 1: Write a test for the new link format**

```bash
# In repo root — quick one-liner to verify before and after
python3 -c "
import re
# Verify current format in a sample article
text = open('articles/alexandre-family.md').read()
md_links = re.findall(r'\]\(([^)]+\.md)\)', text)
slash_links = re.findall(r'\]\((/[^)]+/)\)', text)
print('Current .md links:', len(md_links))
print('Current /slug/ links:', len(slash_links))
"
```
Expected: some `.md` links, zero `/slug/` links.

- [ ] **Step 2: Update linkify.py**

In `linkify.py`, find the line (around line 90):
```python
link_target = target_path.name  # relative filename, e.g. "alexandre-james-henry-1848-1912.md"
```
Replace with:
```python
link_target = "/" + target_path.stem + "/"  # e.g. "/alexandre-james-henry-1848-1912/"
```

- [ ] **Step 3: Re-run linkify on all articles**

```bash
cd /home/james/development/litany-of-lawrences
python3 linkify.py
```
Expected output: `Done. N link(s) added across 27 articles.`

- [ ] **Step 4: Verify the new format**

```bash
python3 -c "
import re
text = open('articles/alexandre-family.md').read()
md_links = re.findall(r'\]\(([^)]+\.md)\)', text)
slash_links = re.findall(r'\]\((/[^)]+/)\)', text)
print('.md links remaining:', len(md_links))
print('/slug/ links:', len(slash_links))
assert len(md_links) == 0, 'Old .md links still present!'
print('OK')
"
```
Expected: `.md links remaining: 0`, some `/slug/` links.

- [ ] **Step 5: Commit**

```bash
git add linkify.py articles/
git commit -m "fix: update article links to /slug/ href format for Eleventy"
```

---

## Task 2: Eleventy Scaffolding

**Files:**
- Create: `.eleventyignore`
- Create: `articles/articles.11tydata.js`
- Create: `site/package.json`
- Create: `site/.eleventy.js`

- [ ] **Step 1: Create .eleventyignore at repo root**

```
docs/
venv/
source-documents/
site/_site/
site/node_modules/
site/test/
```

- [ ] **Step 2: Create articles/articles.11tydata.js**

```js
module.exports = {
  layout: "article.njk",
  permalink: "/{{ page.fileSlug }}/index.html"
};
```

- [ ] **Step 3: Create site/package.json**

```json
{
  "name": "litany-of-lawrences-site",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "cd .. && npx @11ty/eleventy --config=site/.eleventy.js && npx pagefind --site site/_site",
    "serve": "cd .. && npx @11ty/eleventy --config=site/.eleventy.js --serve",
    "test": "node --test test/data.test.js"
  },
  "devDependencies": {
    "@11ty/eleventy": "^3.0.0",
    "pagefind": "^1.0.0"
  }
}
```

- [ ] **Step 4: Create site/.eleventy.js**

```js
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("images");

  return {
    dir: {
      input: ".",
      output: "site/_site",
      includes: "site/_includes",
      data: "site/_data",
    },
    markdownTemplateEngine: "njk",
  };
};
```

- [ ] **Step 5: Install dependencies**

```bash
cd site
npm install
```

- [ ] **Step 6: Verify Eleventy starts without errors**

```bash
cd ..   # back to repo root
npx @11ty/eleventy --config=site/.eleventy.js --dryrun 2>&1 | tail -5
```
Expected: something like `Wrote 0 files` or a list of files — no error stack traces.

- [ ] **Step 7: Commit**

```bash
git add .eleventyignore articles/articles.11tydata.js site/package.json site/package-lock.json site/.eleventy.js
git commit -m "feat: add Eleventy scaffolding and project config"
```

---

## Task 3: Article Manifest Data File (articles.js)

`articles.js` powers the homepage random article card and article count.

**Files:**
- Create: `site/_data/articles.js`
- Create: `site/test/data.test.js` (initial skeleton + first tests)

- [ ] **Step 1: Write failing tests for articles.js**

Create `site/test/data.test.js`:

```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Helper: run the data module against the real articles/ directory
// (test file is at site/test/data.test.js, so _data/ is one level up)
function loadArticles() {
  const mod = require("../_data/articles.js");
  return typeof mod === "function" ? mod() : mod;
}

describe("articles.js", () => {
  it("returns an array with at least one article", () => {
    const articles = loadArticles();
    assert.ok(Array.isArray(articles));
    assert.ok(articles.length > 0);
  });

  it("each article has required fields", () => {
    const articles = loadArticles();
    for (const a of articles) {
      assert.ok(a.title, `missing title: ${JSON.stringify(a)}`);
      assert.ok(a.slug, `missing slug: ${JSON.stringify(a)}`);
      assert.ok(a.excerpt, `missing excerpt: ${JSON.stringify(a)}`);
    }
  });

  it("extracts date range from person articles", () => {
    const articles = loadArticles();
    const person = articles.find(a => a.title.includes("Alexandre, James Henry") && a.title.includes("1848"));
    assert.ok(person, "could not find Alexandre, James Henry article");
    assert.ok(person.dates, "dates field missing");
    assert.ok(person.dates.includes("1848"), `unexpected dates: ${person.dates}`);
  });

  it("assigns correct category to person articles", () => {
    const articles = loadArticles();
    const person = articles.find(a => a.title.match(/^[A-Z][a-z]+, /));
    assert.equal(person.category, "Person");
  });

  it("assigns Family category correctly", () => {
    const articles = loadArticles();
    const family = articles.find(a => a.title.includes("Family"));
    assert.ok(family, "no Family article found");
    assert.equal(family.category, "Family");
  });

  it("excerpt is between 20 and 200 characters", () => {
    const articles = loadArticles();
    for (const a of articles.filter(a => a.excerpt)) {
      assert.ok(a.excerpt.length >= 20, `excerpt too short: "${a.excerpt}"`);
      assert.ok(a.excerpt.length <= 200, `excerpt too long: "${a.excerpt}"`);
    }
  });
});
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
cd site
node --test test/data.test.js 2>&1 | head -10
```
Expected: `Error: Cannot find module` or similar.

- [ ] **Step 3: Create site/_data/articles.js**

```js
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
  if (/^[A-Za-z]+, /.test(title)) return "Person";
  if (title.includes("Family")) return "Family";
  return "Other";
}

function extractExcerpt(content, title) {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("**")) continue;
    if (trimmed.startsWith("![")){continue;}  // skip image tags
    if (trimmed.length < 20) continue;
    // Strip markdown links for clean excerpt text
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
    const excerpt = extractExcerpt(content, title);
    return { title, slug, dates, category, excerpt };
  }).sort((a, b) => a.title.localeCompare(b.title));
};
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd site
node --test test/data.test.js 2>&1
```
Expected: all tests pass (`✓`). If any fail, fix `articles.js` before continuing.

- [ ] **Step 5: Commit**

```bash
git add site/_data/articles.js site/test/data.test.js
git commit -m "feat: add articles.js data file with tests"
```

---

## Task 4: Backlinks and Outgoing Links Data Files

**Files:**
- Create: `site/_data/backlinks.js`
- Create: `site/_data/outgoinglinks.js`
- Modify: `site/test/data.test.js` (add tests)

- [ ] **Step 1: Add failing tests for backlinks and outgoinglinks**

Append to `site/test/data.test.js`:

```js
describe("backlinks.js", () => {
  function loadBacklinks() {
    const mod = require("../_data/backlinks.js");
    return typeof mod === "function" ? mod() : mod;
  }

  it("returns an object", () => {
    const bl = loadBacklinks();
    assert.ok(bl && typeof bl === "object" && !Array.isArray(bl));
  });

  it("alexandre-family links to alexandre-james-henry-1848-1912", () => {
    const bl = loadBacklinks();
    // alexandre-james-henry-1848-1912 is mentioned in alexandre-family
    const backlinksForJames = bl["alexandre-james-henry-1848-1912"];
    assert.ok(backlinksForJames, "no backlinks found for alexandre-james-henry-1848-1912");
    const slugs = backlinksForJames.map(b => b.slug);
    assert.ok(slugs.includes("alexandre-family"), `expected alexandre-family in backlinks, got: ${slugs}`);
  });

  it("each backlink entry has title and slug", () => {
    const bl = loadBacklinks();
    for (const [, sources] of Object.entries(bl)) {
      for (const s of sources) {
        assert.ok(s.title, "backlink entry missing title");
        assert.ok(s.slug, "backlink entry missing slug");
      }
    }
  });
});

describe("outgoinglinks.js", () => {
  function loadOutgoing() {
    const mod = require("../_data/outgoinglinks.js");
    return typeof mod === "function" ? mod() : mod;
  }

  it("returns an object", () => {
    const ol = loadOutgoing();
    assert.ok(ol && typeof ol === "object" && !Array.isArray(ol));
  });

  it("alexandre-family has outgoing links", () => {
    const ol = loadOutgoing();
    const links = ol["alexandre-family"];
    assert.ok(links && links.length > 0, "no outgoing links for alexandre-family");
  });

  it("each outgoing link entry has title and slug", () => {
    const ol = loadOutgoing();
    for (const [, targets] of Object.entries(ol)) {
      for (const t of targets) {
        assert.ok(t.title, "outgoing link entry missing title");
        assert.ok(t.slug, "outgoing link entry missing slug");
      }
    }
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd site
node --test test/data.test.js 2>&1 | grep -E "pass|fail|Error"
```
Expected: new tests fail with `Cannot find module`.

- [ ] **Step 3: Create site/_data/backlinks.js**

```js
const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.join(__dirname, "../../articles");

// Parse /slug/ links from markdown content
function parseLinks(content) {
  const slugs = [];
  const re = /\]\(\/([^/]+)\/\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}

function extractTitle(content) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : null;
}

module.exports = function () {
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith(".md"));

  // Build title lookup
  const titles = {};
  for (const filename of files) {
    const slug = filename.replace(/\.md$/, "");
    const content = fs.readFileSync(path.join(ARTICLES_DIR, filename), "utf8");
    titles[slug] = extractTitle(content) || slug;
  }

  // Build reverse map: targetSlug → [{title, slug}] of source articles
  const backlinks = {};
  for (const filename of files) {
    const sourceSlug = filename.replace(/\.md$/, "");
    const content = fs.readFileSync(path.join(ARTICLES_DIR, filename), "utf8");
    for (const targetSlug of parseLinks(content)) {
      if (!backlinks[targetSlug]) backlinks[targetSlug] = [];
      // Avoid duplicates
      if (!backlinks[targetSlug].some(b => b.slug === sourceSlug)) {
        backlinks[targetSlug].push({
          title: titles[sourceSlug] || sourceSlug,
          slug: sourceSlug,
        });
      }
    }
  }

  return backlinks;
};
```

- [ ] **Step 4: Create site/_data/outgoinglinks.js**

```js
const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.join(__dirname, "../../articles");

function parseLinks(content) {
  const slugs = [];
  const re = /\]\(\/([^/]+)\/\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    slugs.push(m[1]);
  }
  return [...new Set(slugs)]; // deduplicate
}

function extractTitle(content) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : null;
}

module.exports = function () {
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith(".md"));

  // Build title lookup
  const titles = {};
  for (const filename of files) {
    const slug = filename.replace(/\.md$/, "");
    const content = fs.readFileSync(path.join(ARTICLES_DIR, filename), "utf8");
    titles[slug] = extractTitle(content) || slug;
  }

  // Build forward map: sourceSlug → [{title, slug}] of target articles
  const outgoing = {};
  for (const filename of files) {
    const sourceSlug = filename.replace(/\.md$/, "");
    const content = fs.readFileSync(path.join(ARTICLES_DIR, filename), "utf8");
    const targetSlugs = parseLinks(content).filter(s => titles[s]); // only link to known articles
    if (targetSlugs.length > 0) {
      outgoing[sourceSlug] = targetSlugs.map(slug => ({
        title: titles[slug],
        slug,
      }));
    }
  }

  return outgoing;
};
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd site
node --test test/data.test.js 2>&1
```
Expected: all tests pass. If backlink tests fail, check that Task 1 (linkify.py update) has been run and articles use `/slug/` format.

- [ ] **Step 6: Commit**

```bash
git add site/_data/backlinks.js site/_data/outgoinglinks.js site/test/data.test.js
git commit -m "feat: add backlinks and outgoinglinks data files with tests"
```

---

## Task 5: Base Template and Archival CSS

**Files:**
- Create: `site/_includes/base.njk`

- [ ] **Step 1: Create site/_includes/base.njk**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% if title %}{{ title }} — {% endif %}Litany of Lawrences</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #f5f0e8;
      color: #2c1810;
      font-family: Georgia, 'Times New Roman', serif;
      min-height: 100vh;
    }

    /* Nav */
    .site-nav {
      background: #2c1810;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .site-nav a { text-decoration: none; }
    .site-title {
      color: #f0e6d3;
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .site-tagline { color: #c8a96e; font-size: 11px; font-style: italic; }

    /* Nav search (article pages) */
    .nav-search {
      display: flex;
      gap: 6px;
    }
    .nav-search input {
      padding: 4px 8px;
      font-family: Georgia, serif;
      font-size: 11px;
      background: #3d2418;
      border: 1px solid #5a3e28;
      color: #f0e6d3;
      outline: none;
      width: 180px;
    }
    .nav-search input::placeholder { color: #a08060; }

    /* Links */
    a { color: #8b6340; }
    a:hover { color: #2c1810; }

    /* Metadata inset panel */
    .meta-panel {
      background: #ede8dc;
      border-left: 3px solid #c8a96e;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 13px;
      line-height: 1.8;
    }

    /* Horizontal rule */
    hr {
      border: none;
      border-top: 1px solid #c8b89a;
      margin: 12px 0;
    }

    /* Pagefind overrides */
    :root {
      --pagefind-ui-scale: 0.9;
      --pagefind-ui-primary: #8b6340;
      --pagefind-ui-text: #2c1810;
      --pagefind-ui-background: #f5f0e8;
      --pagefind-ui-border: #c8b89a;
      --pagefind-ui-tag: #ede8dc;
      --pagefind-ui-font: Georgia, serif;
    }
  </style>
  {% block head %}{% endblock %}
</head>
<body>
  <nav class="site-nav">
    <a href="/" class="site-title">Litany of Lawrences</a>
    <span class="site-tagline">A Family Chronicle</span>
    {% block navsearch %}{% endblock %}
  </nav>

  {% block content %}{% endblock %}
</body>
</html>
```

- [ ] **Step 2: Verify base template is valid by running a dry build**

```bash
cd /home/james/development/litany-of-lawrences
npx @11ty/eleventy --config=site/.eleventy.js --dryrun 2>&1 | tail -10
```
Expected: no errors about `base.njk`.

- [ ] **Step 3: Commit**

```bash
git add site/_includes/base.njk
git commit -m "feat: add base template with archival CSS"
```

---

## Task 6: Homepage

**Files:**
- Create: `site/index.njk`

- [ ] **Step 1: Create site/index.njk**

```html
---
permalink: /index.html
---
{% extends "base.njk" %}

{% block head %}
<link href="/pagefind/pagefind-ui.css" rel="stylesheet">
<style>
  .home-hero {
    text-align: center;
    padding: 48px 24px 32px;
    border-bottom: 1px solid #c8b89a;
  }
  .search-label {
    font-size: 10px;
    color: #aaa;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .search-wrap {
    max-width: 480px;
    margin: 0 auto 10px;
  }
  .article-count {
    font-size: 11px;
    color: #aaa;
    font-style: italic;
    margin-top: 6px;
  }
  .random-section {
    max-width: 560px;
    margin: 32px auto;
    padding: 0 24px;
  }
  .random-label {
    font-size: 9px;
    color: #aaa;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-align: center;
    margin-bottom: 14px;
  }
  .random-card {
    background: #fff;
    border: 1px solid #d4c9b0;
    padding: 18px 22px;
  }
  .random-card-title { font-size: 16px; font-weight: bold; color: #2c1810; margin-bottom: 2px; }
  .random-card-dates { font-size: 11px; color: #888; font-style: italic; margin-bottom: 12px; }
  .random-card-excerpt { font-size: 13px; color: #555; line-height: 1.7; margin-bottom: 14px; }
  .random-card-actions { display: flex; gap: 16px; }
  .random-card-actions a {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    text-decoration: none;
    color: #8b6340;
  }
  .random-card-actions a:hover { color: #2c1810; }
</style>
{% endblock %}

{% block content %}
<div class="home-hero">
  <div class="search-label">Search the archive</div>
  <div class="search-wrap">
    <div id="search"></div>
  </div>
  <div class="article-count">{{ articles.length }} articles</div>
</div>

<div class="random-section">
  <div class="random-label">✦ &nbsp; Random article &nbsp; ✦</div>
  <div class="random-card">
    <div class="random-card-title" id="rand-title">—</div>
    <div class="random-card-dates" id="rand-dates"></div>
    <div class="random-card-excerpt" id="rand-excerpt"></div>
    <div class="random-card-actions">
      <a href="#" id="rand-link">Read article →</a>
      <a href="#" id="rand-shuffle" onclick="shuffle(); return false;">Shuffle ↺</a>
    </div>
  </div>
</div>

<script>
  const ARTICLES = {{ articles | dump | safe }};

  function shuffle() {
    const a = ARTICLES[Math.floor(Math.random() * ARTICLES.length)];
    document.getElementById("rand-title").textContent = a.title;
    document.getElementById("rand-dates").textContent = a.dates || "";
    document.getElementById("rand-excerpt").textContent = a.excerpt || "";
    document.getElementById("rand-link").href = "/" + a.slug + "/";
  }

  shuffle();
</script>

<script src="/pagefind/pagefind-ui.js"></script>
<script>
  new PagefindUI({ element: "#search", showSubResults: false });
</script>
{% endblock %}
```

- [ ] **Step 2: Build and spot-check the homepage**

```bash
cd /home/james/development/litany-of-lawrences
npx @11ty/eleventy --config=site/.eleventy.js 2>&1 | tail -5
```
Expected: `Wrote N files in Xs` with no errors.

```bash
grep -l "Litany of Lawrences" site/_site/index.html && echo "OK"
grep "articles.length" site/_site/index.html | head -1   # should show article count
```

- [ ] **Step 3: Commit**

```bash
git add site/index.njk
git commit -m "feat: add homepage with search and random article card"
```

---

## Task 7: Article Template

**Files:**
- Create: `site/_includes/article.njk`

- [ ] **Step 1: Create site/_includes/article.njk**

```html
{% extends "base.njk" %}

{% block navsearch %}
<div class="nav-search">
  <input id="nav-search-input" placeholder="Search…" aria-label="Search articles">
</div>
{% endblock %}

{% block head %}
<link href="/pagefind/pagefind-ui.css" rel="stylesheet">
<style>
  .article-layout {
    display: flex;
    min-height: calc(100vh - 44px);
  }

  /* Sidebar */
  .sidebar {
    width: 210px;
    flex-shrink: 0;
    background: #ede8dc;
    border-right: 1px solid #c8b89a;
    padding: 18px 14px;
    font-size: 12px;
  }
  .sidebar-back {
    font-size: 10px;
    color: #aaa;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 18px;
    display: block;
    text-decoration: none;
  }
  .sidebar-back:hover { color: #8b6340; }
  .sidebar-section-label {
    font-size: 9px;
    color: #aaa;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 8px;
    margin-top: 16px;
  }
  .sidebar-link {
    display: block;
    color: #8b6340;
    margin-bottom: 5px;
    text-decoration: none;
    line-height: 1.4;
  }
  .sidebar-link:hover { color: #2c1810; }

  /* Article content */
  .article-content {
    flex: 1;
    padding: 24px 36px;
    max-width: 720px;
  }
  .article-category {
    font-size: 9px;
    color: #aaa;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .article-title {
    font-size: 26px;
    font-weight: bold;
    color: #2c1810;
    line-height: 1.2;
    margin-bottom: 4px;
  }
  .article-dates {
    font-size: 12px;
    color: #888;
    font-style: italic;
  }
  .article-body {
    font-size: 13px;
    line-height: 1.85;
    color: #333;
    margin-top: 16px;
  }
  .article-body p { margin-bottom: 1em; }
  .article-body strong { color: #2c1810; }
</style>
{% endblock %}

{% block content %}
{% set slug = page.fileSlug %}
{% set pageBacklinks = backlinks[slug] %}
{% set pageOutgoing = outgoinglinks[slug] %}
{% set meta = articles | selectattr("slug", "equalto", slug) | first %}

<div class="article-layout">
  <aside class="sidebar">
    <a href="/" class="sidebar-back">← All articles</a>

    {% if pageOutgoing and pageOutgoing.length %}
    <div class="sidebar-section-label">Links in this article</div>
    {% for link in pageOutgoing %}
      <a href="/{{ link.slug }}/" class="sidebar-link">{{ link.title }}</a>
    {% endfor %}
    {% endif %}

    {% if pageBacklinks and pageBacklinks.length %}
    <div class="sidebar-section-label">Also appears in</div>
    {% for link in pageBacklinks %}
      <a href="/{{ link.slug }}/" class="sidebar-link">{{ link.title }}</a>
    {% endfor %}
    {% endif %}
  </aside>

  <div class="article-content">
    <div class="article-category">{{ meta.category if meta else "Article" }}</div>
    <h1 class="article-title">{{ title }}</h1>
    {% if meta and meta.dates %}
    <div class="article-dates">{{ meta.dates }}</div>
    {% endif %}
    <hr>

    <div class="meta-panel">
      {{ content | metaPanel | safe }}
    </div>

    <div class="article-body">
      {{ content | articleBody | safe }}
    </div>
  </div>
</div>

<div id="pagefind-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100">
  <div style="background:#f5f0e8;max-width:600px;margin:80px auto;padding:24px;border:1px solid #c8b89a;">
    <div id="nav-search-results"></div>
    <button onclick="document.getElementById('pagefind-overlay').style.display='none'"
      style="margin-top:12px;background:none;border:none;color:#8b6340;cursor:pointer;font-size:12px;">
      ✕ Close
    </button>
  </div>
</div>

<script src="/pagefind/pagefind-ui.js"></script>
<script>
  const overlay = document.getElementById("pagefind-overlay");
  const input = document.getElementById("nav-search-input");
  new PagefindUI({ element: "#nav-search-results", showSubResults: false });

  input.addEventListener("focus", () => { overlay.style.display = "block"; });
  input.addEventListener("input", (e) => {
    // Sync input value to Pagefind's internal input
    const pf = overlay.querySelector("input[type=text]");
    if (pf) { pf.value = e.target.value; pf.dispatchEvent(new Event("input")); }
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.style.display = "none";
  });
</script>
{% endblock %}
```

- [ ] **Step 2: Add Nunjucks filters for metaPanel and articleBody to .eleventy.js**

These filters split the rendered markdown into the metadata inset panel (leading `**Label:**` lines) and the remaining body.

In `site/.eleventy.js`, add before the `return` statement:

```js
  // Metadata panel: collect leading **Label:** lines (skipping blanks), stop at first prose line
  eleventyConfig.addFilter("metaPanel", function(html) {
    // Work on raw markdown from the template's `content` variable (already rendered to HTML)
    // We extract <strong>Label:</strong> lines from the top of the rendered HTML
    const lines = html.split("\n");
    const panelLines = [];
    let foundFirst = false;
    let hitProse = false;

    for (const line of lines) {
      const stripped = line.trim();
      if (!stripped) continue; // skip blanks
      // Match lines that are entirely a bold label: <strong>Label:</strong> ...
      if (/^<strong>[^<]+:<\/strong>/.test(stripped) && !hitProse) {
        panelLines.push(stripped);
        foundFirst = true;
      } else if (foundFirst) {
        hitProse = true; // first non-bold non-blank line ends the panel
      }
    }
    return panelLines.join("<br>\n");
  });

  // Article body: everything after the metadata panel block
  eleventyConfig.addFilter("articleBody", function(html) {
    const lines = html.split("\n");
    let panelDone = false;
    let foundFirst = false;
    const bodyLines = [];

    for (const line of lines) {
      const stripped = line.trim();
      if (!stripped) {
        if (panelDone) bodyLines.push(line);
        continue;
      }
      if (!foundFirst && /^<strong>[^<]+:<\/strong>/.test(stripped)) {
        foundFirst = true;
        continue; // skip panel lines
      }
      if (foundFirst && !panelDone && !/^<strong>[^<]+:<\/strong>/.test(stripped)) {
        panelDone = true;
      }
      if (panelDone) bodyLines.push(line);
    }
    return bodyLines.join("\n");
  });
```

- [ ] **Step 3: Build and check an article page**

```bash
cd /home/james/development/litany-of-lawrences
npx @11ty/eleventy --config=site/.eleventy.js 2>&1 | tail -5
```
Expected: `Wrote N files` with no errors.

```bash
# Check that an article page was generated
ls site/_site/alexandre-james-henry-1848-1912/
# Expected: index.html

# Check it has sidebar content
grep -i "Also appears in\|Links in this" site/_site/alexandre-james-henry-1848-1912/index.html | head -3
```

- [ ] **Step 4: Commit**

```bash
git add site/_includes/article.njk site/.eleventy.js
git commit -m "feat: add article template with sidebar and metadata panel"
```

---

## Task 8: GitHub Actions Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create .github/workflows/deploy.yml**

```bash
mkdir -p .github/workflows
```

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: site/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: site

      - name: Build site
        run: npx @11ty/eleventy --config=site/.eleventy.js

      - name: Index with Pagefind
        run: npx pagefind --site site/_site

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: site/_site
          cname: ""   # Set to your custom domain if you have one, e.g. "lawrences.family"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy workflow"
```

---

## Task 9: End-to-End Build Verification

- [ ] **Step 1: Run the full build locally (including Pagefind)**

```bash
cd /home/james/development/litany-of-lawrences/site
npm run build 2>&1
```
Expected: Eleventy writes 28+ files (27 articles + index), Pagefind indexes them, no errors.

- [ ] **Step 2: Spot-check output files**

```bash
# Homepage exists
ls site/_site/index.html

# All 27 articles have output directories
ls site/_site/ | wc -l   # should be 28+ (27 articles + root index)

# Images copied through
ls site/_site/images/ | head -3

# Pagefind index created
ls site/_site/pagefind/

# An article has sidebar sections
grep "Also appears in" site/_site/alexandre-family/index.html | head -1
```

- [ ] **Step 3: Run all tests**

```bash
cd site
node --test test/data.test.js
```
Expected: all tests pass.

- [ ] **Step 4: Final commit**

```bash
cd ..
git add .
git commit -m "chore: verify full build passes end-to-end"
```

---

## Setup Checklist (before first push to GitHub)

- [ ] Create a GitHub repository for this project (if not already exists)
- [ ] Push `main` branch: `git remote add origin <url> && git push -u origin main`
- [ ] In GitHub repo Settings → Pages → Source: set to `gh-pages` branch, root `/`
- [ ] (Optional) Add custom domain in Settings → Pages → Custom domain, and set `cname:` in `deploy.yml`
- [ ] Watch the Actions tab for the first deploy run
