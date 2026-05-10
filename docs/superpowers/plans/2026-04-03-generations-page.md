# Generations Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new Generations page that displays the Lawrence family organized as centred, top-to-bottom tiers of person cards with interactive hover/click descent lines.

**Architecture:** New Eleventy page (`generations.njk`) injects existing `familytree` data as JSON. A standalone JS file (`js/generations.js`) computes generations via BFS, renders tiers as HTML, and handles hover/click interactivity with an SVG overlay for descent lines. Styles go in a new section of `scss/main.scss`.

**Tech Stack:** Eleventy/Nunjucks, vanilla JS, SVG for descent lines, SCSS

---

### Task 1: Page Template and Nav Link

**Files:**
- Create: `site/generations.njk`
- Modify: `site/_includes/base.njk:18-25`

- [ ] **Step 1: Create the page template**

```njk
---
title: Generations
permalink: /generations/
---
{% extends "base.njk" %}

{% block head %}
<script src="/js/generations.js" defer></script>
{% endblock %}

{% block content %}
<script type="application/json" id="generations-data" data-pagefind-ignore>{{ familytree | dump | safe }}</script>
<div class="generations-page" data-pagefind-ignore>
  <div class="generations-container" id="generations"></div>
</div>
{% endblock %}
```

- [ ] **Step 2: Add nav link in `base.njk`**

In `site/_includes/base.njk`, add `/generations/` to the page URL condition on line 18 and add a new nav link after the "Map" link:

Change the condition from:
```njk
{% if page.url === "/" or page.url === '/family-tree/' or page.url === '/map/' or page.url === '/timeline/' or page.url === '/index/' %}
```
to:
```njk
{% if page.url === "/" or page.url === '/family-tree/' or page.url === '/map/' or page.url === '/timeline/' or page.url === '/index/' or page.url === '/generations/' %}
```

Add the link after the Map link:
```njk
<a href="/generations/" class="underline site-nav-link">Generations</a>
```

- [ ] **Step 3: Verify the page builds**

Run: `cd site && npx @11ty/eleventy --dryrun 2>&1 | grep generations`
Expected: output showing `/generations/` being generated

- [ ] **Step 4: Commit**

```bash
git add site/generations.njk site/_includes/base.njk
git commit -m "feat: add generations page template and nav link"
```

---

### Task 2: Generation Assignment and Basic Rendering

**Files:**
- Create: `site/js/generations.js`

- [ ] **Step 1: Create `js/generations.js` with BFS generation assignment and tier rendering**

```js
(function () {
  var container = document.getElementById("generations");
  if (!container) return;

  var data = JSON.parse(document.getElementById("generations-data").textContent);
  var nodes = data.nodes;
  var links = data.links;

  if (!nodes.length) {
    container.innerHTML = '<p class="generations-empty">No family data yet.</p>';
    return;
  }

  // Build lookup maps
  var nodeById = {};
  for (var i = 0; i < nodes.length; i++) {
    nodeById[nodes[i].id] = nodes[i];
  }

  var childrenOf = {};
  var parentsOf = {};
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    if (!parentsOf[link.target]) parentsOf[link.target] = [];
    if (!childrenOf[link.source]) childrenOf[link.source] = [];
    if (nodeById[link.source]) parentsOf[link.target].push(link.source);
    if (nodeById[link.target]) childrenOf[link.source].push(link.target);
  }

  // BFS from root nodes to assign generation levels
  var genLevel = {};
  var queue = [];
  for (var i = 0; i < nodes.length; i++) {
    var id = nodes[i].id;
    if (!(parentsOf[id] && parentsOf[id].length)) {
      genLevel[id] = 0;
      queue.push(id);
    }
  }

  var maxIter = nodes.length * 2;
  var iter = 0;
  while (queue.length && iter++ < maxIter) {
    var id = queue.shift();
    var nextLevel = genLevel[id] + 1;
    var children = childrenOf[id] || [];
    for (var j = 0; j < children.length; j++) {
      var childId = children[j];
      if (genLevel[childId] === undefined || genLevel[childId] < nextLevel) {
        genLevel[childId] = nextLevel;
        queue.push(childId);
      }
    }
  }

  // Assign level 0 to any unvisited nodes
  for (var i = 0; i < nodes.length; i++) {
    if (genLevel[nodes[i].id] === undefined) genLevel[nodes[i].id] = 0;
  }

  // Group by generation level
  var byLevel = {};
  var levels = [];
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var level = genLevel[node.id];
    if (!byLevel[level]) {
      byLevel[level] = [];
      levels.push(level);
    }
    byLevel[level].push(node);
  }
  levels.sort(function (a, b) { return a - b; });

  // Sort nodes within each level alphabetically by name
  for (var i = 0; i < levels.length; i++) {
    byLevel[levels[i]].sort(function (a, b) {
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  // Render tiers
  var html = '';
  for (var i = 0; i < levels.length; i++) {
    var level = levels[i];
    var tierNodes = byLevel[level];

    html += '<div class="gen-tier">';
    html += '<div class="gen-tier-label">Generation ' + (level + 1) + '</div>';
    html += '<div class="gen-tier-cards">';

    for (var j = 0; j < tierNodes.length; j++) {
      var node = tierNodes[j];
      var cardClass = 'gen-card' + (node.hasArticle ? ' gen-card--has-article' : '');
      html += '<div class="' + cardClass + '" data-node-id="' + node.id + '">';
      if (node.hasArticle) {
        html += '<a class="gen-card-name" href="/' + node.id + '/">' + (node.name || '') + '</a>';
      } else {
        html += '<div class="gen-card-name">' + (node.name || '') + '</div>';
      }
      html += '<div class="gen-card-dates">' + (node.dates || '') + '</div>';
      html += '</div>';
    }

    html += '</div></div>';

    // Add connector between tiers (not after the last one)
    if (i < levels.length - 1) {
      html += '<div class="gen-tier-connector">';
      html += '<div class="gen-tier-line"></div>';
      html += '<div class="gen-tier-dot"></div>';
      html += '<div class="gen-tier-line"></div>';
      html += '</div>';
    }
  }

  container.innerHTML = html;
}());
```

- [ ] **Step 2: Build the site and verify the page renders**

Run: `cd site && npx @11ty/eleventy --serve`
Expected: Visit `http://localhost:8080/generations/` and see generation tiers with person cards

- [ ] **Step 3: Commit**

```bash
git add site/js/generations.js
git commit -m "feat: add generations JS with BFS layout and tier rendering"
```

---

### Task 3: Styles

**Files:**
- Modify: `site/scss/main.scss` (add new section after the timeline styles, around line 785)

- [ ] **Step 1: Add generations styles to `main.scss`**

Add this section after the timeline styles block (after the `// Name Index page` comment, or after the timeline section):

```scss
// =============================================================================
// Generations page
// =============================================================================

.generations-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px;
}

.generations-container {
  position: relative;
}

.generations-empty {
  text-align: center;
  font-style: italic;
  color: $color-muted;
  padding: 48px 0;
}

.gen-tier {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gen-tier-label {
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: $color-gold;
  margin-bottom: 10px;
}

.gen-tier-cards {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.gen-card {
  background: #fff;
  border: 1px solid $color-border;
  border-radius: 6px;
  padding: 10px 14px;
  min-width: 120px;
  max-width: 160px;
  text-align: center;
  transition: opacity 0.2s, background 0.2s;
}

.gen-card--has-article {
  border-color: $color-gold;

  .gen-card-name {
    color: $color-link;
    text-decoration: none;
    display: block;

    &:hover { color: $color-brown; }
  }
}

.gen-card-name {
  font-size: 13px;
  font-weight: bold;
  color: $color-brown;
  font-family: $font-serif;
  margin-bottom: 2px;
}

.gen-card-dates {
  font-size: 11px;
  color: $color-muted;
}

.gen-card.is-dimmed {
  opacity: 0.3;
}

.gen-card.is-highlighted {
  background: lighten($color-gold, 30%);
}

.gen-tier-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0 8px 0;
}

.gen-tier-line {
  width: 2px;
  height: 18px;
  background: $color-border;
}

.gen-tier-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: $color-gold;
}

// SVG overlay for descent lines
.gen-svg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;

  line {
    stroke: $color-gold;
    stroke-width: 1.5;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &.is-active line.is-visible {
    opacity: 1;
  }
}
```

- [ ] **Step 2: Verify styles render correctly**

Run: `cd site && npx @11ty/eleventy --serve`
Expected: Visit `http://localhost:8080/generations/` — tiers are centred, cards have white backgrounds with proper borders, gold labels, and dot-line connectors between tiers.

- [ ] **Step 3: Commit**

```bash
git add site/scss/main.scss
git commit -m "feat: add generations page styles"
```

---

### Task 4: Interactive Descent Lines

**Files:**
- Modify: `site/js/generations.js` (add interactivity after the rendering code)

- [ ] **Step 1: Add SVG overlay and hover/click interaction**

Append the following code inside `generations.js`, after the `container.innerHTML = html;` line (but still inside the IIFE):

```js
  // ── SVG overlay for descent lines ──────────────────────────────────────
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "gen-svg-overlay");
  container.appendChild(svg);

  function resizeSvg() {
    svg.setAttribute("width", container.offsetWidth);
    svg.setAttribute("height", container.offsetHeight);
  }
  resizeSvg();
  window.addEventListener("resize", resizeSvg);

  // Build a set of all line endpoints we might need
  // For each link, find the source card and target card elements
  var allCards = container.querySelectorAll(".gen-card");
  var cardElById = {};
  for (var i = 0; i < allCards.length; i++) {
    cardElById[allCards[i].getAttribute("data-node-id")] = allCards[i];
  }

  var activeNodeId = null;

  function clearHighlight() {
    activeNodeId = null;
    svg.classList.remove("is-active");
    // Remove all drawn lines
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    // Reset card classes
    for (var i = 0; i < allCards.length; i++) {
      allCards[i].classList.remove("is-dimmed", "is-highlighted");
    }
  }

  function showDescent(nodeId) {
    clearHighlight();
    activeNodeId = nodeId;
    svg.classList.add("is-active");
    resizeSvg();

    // Find connected node IDs (parents and children)
    var connectedIds = {};
    connectedIds[nodeId] = true;
    var parentIds = parentsOf[nodeId] || [];
    var childIds = childrenOf[nodeId] || [];
    for (var i = 0; i < parentIds.length; i++) connectedIds[parentIds[i]] = true;
    for (var i = 0; i < childIds.length; i++) connectedIds[childIds[i]] = true;

    // Dim non-connected cards, highlight connected ones
    for (var i = 0; i < allCards.length; i++) {
      var cardId = allCards[i].getAttribute("data-node-id");
      if (connectedIds[cardId]) {
        allCards[i].classList.add("is-highlighted");
      } else {
        allCards[i].classList.add("is-dimmed");
      }
    }

    // Draw lines from this card to parents and children
    var containerRect = container.getBoundingClientRect();
    var sourceEl = cardElById[nodeId];
    if (!sourceEl) return;

    // Lines to parents (from top of this card to bottom of parent card)
    for (var i = 0; i < parentIds.length; i++) {
      var parentEl = cardElById[parentIds[i]];
      if (!parentEl) continue;
      drawLine(parentEl, sourceEl, containerRect);
    }

    // Lines to children (from bottom of this card to top of child card)
    for (var i = 0; i < childIds.length; i++) {
      var childEl = cardElById[childIds[i]];
      if (!childEl) continue;
      drawLine(sourceEl, childEl, containerRect);
    }
  }

  function drawLine(fromEl, toEl, containerRect) {
    var fromRect = fromEl.getBoundingClientRect();
    var toRect = toEl.getBoundingClientRect();

    var x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
    var y1 = fromRect.bottom - containerRect.top;
    var x2 = toRect.left + toRect.width / 2 - containerRect.left;
    var y2 = toRect.top - containerRect.top;

    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("class", "is-visible");
    svg.appendChild(line);
  }

  // Attach hover and click listeners to cards
  for (var i = 0; i < allCards.length; i++) {
    (function (card) {
      card.addEventListener("mouseenter", function () {
        showDescent(card.getAttribute("data-node-id"));
      });
      card.addEventListener("mouseleave", function () {
        if (activeNodeId === card.getAttribute("data-node-id")) {
          clearHighlight();
        }
      });
    })(allCards[i]);
  }

  // Click elsewhere to clear
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".gen-card")) {
      clearHighlight();
    }
  });
```

- [ ] **Step 2: Verify interactivity works**

Run: `cd site && npx @11ty/eleventy --serve`
Expected: Visit `http://localhost:8080/generations/`. Hovering over a card draws gold lines to its parents above and children below. Non-connected cards dim. Moving the mouse away clears the highlight.

- [ ] **Step 3: Commit**

```bash
git add site/js/generations.js
git commit -m "feat: add hover/click descent line interactivity to generations page"
```
