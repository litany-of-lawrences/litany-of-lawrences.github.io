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

    html += '<div class="gen-tier" id="gen-' + (level + 1) + '">';
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

  // ── Dot nav for jumping between generations ────────────────────────────
  var dotNav = document.createElement("nav");
  dotNav.className = "gen-dot-nav";
  dotNav.setAttribute("aria-label", "Jump to generation");
  for (var i = 0; i < levels.length; i++) {
    var btn = document.createElement("button");
    btn.className = "gen-dot-nav-item";
    btn.setAttribute("data-gen", levels[i] + 1);
    btn.setAttribute("title", "Generation " + (levels[i] + 1));
    btn.setAttribute("aria-label", "Generation " + (levels[i] + 1));
    btn.textContent = levels[i] + 1;
    dotNav.appendChild(btn);
  }
  document.querySelector(".generations-page").appendChild(dotNav);

  dotNav.addEventListener("click", function (e) {
    var btn = e.target.closest(".gen-dot-nav-item");
    if (!btn) return;
    var tier = document.getElementById("gen-" + btn.getAttribute("data-gen"));
    if (tier) tier.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Highlight active dot on scroll
  var tiers = container.querySelectorAll(".gen-tier");
  var dotButtons = dotNav.querySelectorAll(".gen-dot-nav-item");

  function updateActiveDot() {
    var scrollY = window.scrollY || window.pageYOffset;
    var activeIdx = 0;
    for (var i = 0; i < tiers.length; i++) {
      if (tiers[i].getBoundingClientRect().top <= 80) activeIdx = i;
    }
    for (var i = 0; i < dotButtons.length; i++) {
      dotButtons[i].classList.toggle("is-active", i === activeIdx);
    }
  }
  window.addEventListener("scroll", updateActiveDot);
  updateActiveDot();

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
}());
