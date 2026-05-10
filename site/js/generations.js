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
