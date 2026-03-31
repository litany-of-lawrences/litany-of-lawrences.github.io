# Family Tree Page — Design Spec

## Goal

Add a `/family-tree/` page to the Litany of Lawrences site that displays an interactive, person-centred family tree. The tree is navigable: clicking any person re-centres the view on them, showing their parents above and children below.

## Architecture

### Data: `site/_data/familytree.js`

Parses the `**Parents:**` field from every article markdown file in `articles/`. Produces a graph structure:

```json
{
  "nodes": [
    { "id": "alexandre-james-henry-1848-1912", "name": "James Henry Alexandre", "dates": "1848–1912", "hasArticle": true },
    { "id": "marie-civilise-cipriant",         "name": "Marie Civilise Cipriant", "dates": "1811–1882", "hasArticle": false }
  ],
  "links": [
    { "source": "alexandre-frederick-francis-1809-1889", "target": "alexandre-james-henry-1848-1912" }
  ]
}
```

Names are stored in natural `Given Name Surname` order. Article-backed nodes derive their names from titles (which use `Surname, Given Name` format) with the comma reversed. Unlinked parent nodes use the token text as-is (already in natural order).

**Parsing the `**Parents:**` field:**

The raw field value is everything after `**Parents:**` on that line, e.g.:
```
[Frederick Francis Alexandre](/alexandre-frederick-francis-1809-1889/) (1894–1968) and Marie Civilise Cipriant (1811–1882).
```

Pre-processing before tokenisation:
1. Strip all backslash characters (`\`). Some fields contain continuations such as `(1859–1910).\ Spouse: …`; removing the `\` up-front is a safe defensive step that does not affect any other parsing.
2. Replace all occurrences of `Jr.` (case-insensitive) with `Jr` — this prevents the generational suffix period from being treated as a sentence-ending period in the truncation step below.
3. Truncate at the first period or semicolon.
4. Split on ` and ` to get individual parent tokens.

**Skip check (applied to every token, in both linked and unlinked paths):**
First, treat bare bracket expressions without a URL (e.g. `[Not yet identified]` with no following `(...)`) as plain text — they are not partial link matches. Then, after stripping markdown link syntax, dates, and punctuation, if the remaining text matches `/not yet identified/i` or `/^unknown/i` or has fewer than 2 words, discard the token. No node is created.

**Linked parent** — token matches `/\[([^\]]+)\]\(\/([^)/]+)\/\)/`:
- `id`: captured group 2 (slug between slashes), e.g. `alexandre-frederick-francis-1809-1889`
- The **remainder** is everything in the token after the link's closing `)`, trimmed
- `name`: group 1 with dates stripped, then append any generational suffix found at the start of the remainder (e.g. `Jr`, `II`, `III`, `IV`, `V` — matched by `/^(Jr\.?|IV|III|II|V)\b/i`; alternatives are ordered so that `IV` is tried before `V`, preventing `V` from matching the `V` in `IV`; the `\b` word boundary prevents any alternative from matching a prefix of a longer token). Example: link text `James Henry Alexandre` + remainder `III (1915–1963)` → name `James Henry Alexandre III`
- `dates`: extract `\(\d{4}(?:[–\-]\d*)?\s*\)` from group 1 first; if absent, from the remainder. Link text takes precedence if both present.
- `hasArticle`: this value is ignored during step 2 insertion — step 2 always inserts new nodes with `hasArticle: false`; only nodes already in the map from step 1 carry `true`

**Unlinked parent** — plain text (no link match; skip check already applied above):
- `id`: slugify — lowercase, spaces→hyphens, strip non-`[a-z0-9-]`, collapse multiple hyphens
- `name`: text with dates stripped
- `dates`: extract via `\(\d{4}(?:[–\-]\d*)?\s*\)`
- `hasArticle`: `false` initially

The dates regex `\(\d{4}(?:[–\-]\d*)?\s*\)` matches `(1848–1912)`, `(1944–)` (open end), and `(1944)` (birth year only).

If two unlinked people produce the same slug (name collision), they are merged into one node. Acceptable for current dataset; resolved when articles are added for those people.

**Known data gaps (acknowledged, not fixed in v1):**
- Some articles link a parent using a slug that resolves to a distant ancestor rather than the immediate parent (e.g. several Alexandre articles link `/alexandre-james-henry-1848-1912/` for different generations of "James Henry"). The upsert rule attaches the edge to whichever node holds that slug, producing incorrect edges. Log a build-time warning when the same slug appears as a parent in more than 3 articles, so the gap is visible.
- Some unlinked parent names produce a different slug than the corresponding article's filename (e.g. unlinked `DeWitt Loomis Alexandre Jr.` → `dewitt-loomis-alexandre-jr`, not `alexandre-dewitt-loomis-ii-1949`). These appear as ghost nodes with `hasArticle: false`. They resolve naturally when that person's article gets a proper link in the Parents field.

**Building the final node list:**

Steps 1–4 run in order; step 2 depends on the map populated in step 1.

1. Glob `articles/*.md`. For each file, extract the filename slug and the `# Title` line. **Only include files whose title contains a date pattern** (i.e. matches `\(\d{4}(?:[–\-]\d*)?\s*\)`) — this excludes non-person narrative pages (e.g. `alexandre-family.md`, `alexandre-line.md`) which have no dates and no `**Parents:**` field. For included files: strip the dates from the title text; apply `Jr.`→`Jr` normalisation; reverse `Surname, Given Name` format to natural order by splitting on the first `,`, trimming both parts, then moving any trailing suffix token from the end of the `given` part to after the `surname` — suffix matched by `/\s+(Jr\.?|IV|III|II|V)$/i` applied to the `given` string (same alternatives as the linked-parent suffix regex, applied at the end rather than the start) — e.g. `"James Henry Jr"` + `"Alexandre"` → `"James Henry Alexandre Jr"`. Add `{ id: slug, name: normalisedName, dates: extractedFromTitle, hasArticle: true }` to a `Map<id, node>`. Dates regex: `\(\d{4}(?:[–\-]\d*)?\s*\)` on the title string.
2. For every article, parse its `**Parents:**` field. For each parent token, upsert into the map: if the ID already exists, leave `hasArticle` as-is and fill in missing `name`/`dates`; if not, insert the new node with `hasArticle: false` — step 1 is the authoritative source for article existence, so any node first encountered in step 2 (not yet in the map) has no confirmed article regardless of whether it came from a linked or unlinked token.
3. Convert the map to a `nodes` array. `hasArticle` is correct: step 1 sets `true` for all article-backed nodes; unlinked-only parents remain `false`.
4. Collect `links` as `{ source: parentId, target: childId }`. Deduplicate by `source+target`.

### Page: `site/family-tree.njk`

- URL: `/family-tree/` — add `permalink: /family-tree/` in frontmatter (explicit; don't rely on Eleventy's default inference)
- Extends `base.njk`, full-width, no sidebar
- Injects `familytree` data as `<script type="application/json" id="familytree-data" data-pagefind-ignore>`
- `{% block head %}` loads D3 first (synchronous), then `family-tree.js` (deferred):
  ```html
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script src="/js/family-tree.js" defer></script>
  ```
- SVG fills viewport below the nav. Nav height is measured at runtime (see JS below) rather than hardcoded:
  ```html
  <svg id="family-tree" width="100%" data-pagefind-ignore>
    <g id="tree-root"></g>
  </svg>
  ```
- `<g id="tree-root">` is the D3 render target

### JavaScript: `site/js/family-tree.js`

Only executes when `#family-tree` is present.

**Module-level declarations:**

```js
const svgEl = document.getElementById("family-tree");
if (!svgEl) throw new Error("family-tree SVG not found");

let currentFocusId = null;
const zoom = d3.zoom()
  .scaleExtent([0.2, 3])
  .on("zoom", e => d3.select("#tree-root").attr("transform", e.transform));
```

**On load (runs once):**

1. Parse graph data from `#familytree-data`
2. Build `childrenOf: Map<id, Node[]>` and `parentsOf: Map<id, Node[]>` from `links`
3. Size the SVG: `svgEl.setAttribute("height", window.innerHeight - document.querySelector(".site-nav").offsetHeight)`
4. Apply `zoom` to the SVG: `d3.select(svgEl).call(zoom)`
5. Pick a random node where `hasArticle: true` as initial focus
6. Call `renderFocus(node, false)`, then inside `requestAnimationFrame(() => fitToView())`

**`renderFocus(focusNode, animate = true)`:**

If `focusNode.id === currentFocusId`, return immediately.

1. `currentFocusId = focusNode.id`
2. `parents = parentsOf.get(focusNode.id) ?? []`, `children = childrenOf.get(focusNode.id) ?? []`
3. Compute positions. `cx` and `cy` = half the SVG's current width/height. Row spacing = 160px, node spacing = 120px (centre-to-centre; with the largest radius being 44px, two adjacent circles have 32px clearance between edges):
   - Parents row: `y = cy - 160`, leftmost `x = cx - ((parents.length - 1) / 2) * 120`
   - Focus: `[cx, cy]`
   - Children row: `y = cy + 160`, leftmost `x = cx - ((children.length - 1) / 2) * 120`
   - Empty rows render no nodes and no lines
4. Assemble `allNodes = [...parents, focusNode, ...children]` each with `x`, `y`, `role` (`"parent"`, `"focus"`, `"child"`)
5. Build `lineData` — the edges between currently visible nodes:
   ```js
   const lineData = [
     ...parents.map(p => ({ source: p.id, target: focusNode.id, x1: p.x, y1: p.y, x2: focusNode.x, y2: focusNode.y })),
     ...children.map(c => ({ source: focusNode.id, target: c.id, x1: focusNode.x, y1: focusNode.y, x2: c.x, y2: c.y }))
   ];
   ```
6. `<line>` data join — done **before** the node join so lines render beneath circles in SVG paint order:
   ```js
   d3.select("#tree-root").selectAll("line").data(lineData, d => d.source + d.target)
   ```
   - **Enter**: append `<line>`. Set `x1`, `y1`, `x2`, `y2`. Apply style: `stroke: #c8b89a`, `stroke-width: 1.5`.
   - **Update + Enter**: transition (if `animate`: 300ms, `d3.easeQuadInOut`) or set `x1`/`y1`/`x2`/`y2` immediately
   - **Exit**: remove immediately
7. Node data join — key function is `d => d.id`:
   ```js
   d3.select("#tree-root").selectAll("g.node").data(allNodes, d => d.id)
   ```
   - **Enter**: append `<g class="node">`. Add `<circle>`, `<text class="node-name">`, `<text class="node-dates">`. If `hasArticle: true`, add `<a href="/${d.id}/">` containing `<text class="node-link">Read →</text>`. Attach click/interaction handlers (see below). Set initial position at `[cx, cy]` so enter transition animates outward.
   - **Update + Enter**: transition (if `animate`: 300ms, `d3.easeQuadInOut`) or set positions immediately
   - **Exit**: remove immediately
8. After the data joins, re-apply node styles based on current `role` (role can change when the same node appears as parent in one render and child in another).

**Click handlers:**
- `<g class="node">` where `hasArticle: true` and `role !== "focus"`: call `renderFocus(d)`
- `<a>` inside a node: `event.stopPropagation()` — navigates without triggering re-centre
- `hasArticle: false` nodes: no click handler; `cursor: default`; `pointer-events: none` on the group

**`fitToView()`:**
```js
function fitToView() {
  const bounds = d3.select("#tree-root").node().getBBox();
  if (!bounds.width && !bounds.height) return; // empty graph guard
  const pad = 60;
  const w = svgEl.clientWidth, h = svgEl.clientHeight;
  const scale = Math.min(w / (bounds.width + pad * 2), h / (bounds.height + pad * 2), 1);
  const tx = (w - (bounds.width + pad * 2) * scale) / 2 - bounds.x * scale + pad * scale;
  const ty = (h - (bounds.height + pad * 2) * scale) / 2 - bounds.y * scale + pad * scale;
  const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
  d3.select("#family-tree").call(zoom.transform, t); // updates zoom's internal state
}
```
Called once (inside `requestAnimationFrame` after initial render). Using `zoom.transform` — not setting the attribute directly — ensures subsequent pan/zoom events do not snap back.

### Node Visual Styles

| Role | Radius | Fill | Stroke | Text colour | Cursor |
|---|---|---|---|---|---|
| Focused | 44px | `#fff` | `#c8a96e` 2.5px | `#2c1810` | default |
| With article | 32px | `#ede8dc` | `#c8b89a` 1.5px | `#2c1810` | pointer |
| Without article | 26px | `#f5f0e8` | `#c8b89a` 50% opacity | `#aaa` | default |

Text layout (all centred on circle `cx`, `text-anchor="middle"`):
- Name: `dy = -0.3em` relative to circle centre
- Dates: `dy = 1.2em` below name baseline
- "Read →": `dy = 1.2em` below dates (only if `hasArticle: true`)

### Navigation

Add a "Family Tree" link to the site nav in `site/_includes/base.njk`. Insert the following element between the `.site-title` anchor and the `{% block navsearch %}` block:

```html
<a href="/family-tree/" class="site-nav-link">Family Tree</a>
```

Add `.site-nav-link` to `main.scss`. The existing `.site-nav a { text-decoration: none }` rule will also apply, which is the desired behaviour:
```scss
.site-nav-link {
  color: $color-nav-text;
  font-size: 14px;
  letter-spacing: 1px;
  text-transform: uppercase;
  &:hover { color: $color-gold; }
}
```

The existing `.site-nav a { text-decoration: none }` rule covers the new link. The nav already uses flexbox. The new link is inserted between the site title and the search block and will be laid out in the existing flow. No structural nav CSS changes are needed.

### Build

`site/js/family-tree.js` is covered by the existing `addPassthroughCopy({ "site/js": "js" })`. No `.eleventy.js` changes needed.

## What This Does Not Include

- Spouse/marriage relationships (v1 uses Parents field only)
- Sibling display (discoverable by navigating to a shared parent)
- Search or filter within the tree
- Server-side graph layout
- SVG resize on window resize (height is measured once at load time)

## Files Changed or Created

| File | Action |
|---|---|
| `site/_data/familytree.js` | Create |
| `site/family-tree.njk` | Create |
| `site/js/family-tree.js` | Create |
| `site/_includes/base.njk` | Modify — add nav link |
| `site/scss/main.scss` | Modify — add `.site-nav-link` style |
