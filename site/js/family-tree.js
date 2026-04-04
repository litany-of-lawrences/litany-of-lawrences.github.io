(function () {
  const svgEl = document.getElementById("family-tree");
  if (!svgEl) return;

  // ── Module-level state ───────────────────────────────────────────────────
  let currentFocusId = null;

  const zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on("zoom", e => d3.select("#tree-root").attr("transform", e.transform));

  // ── Load data ────────────────────────────────────────────────────────────
  const { nodes, links } = JSON.parse(document.getElementById("familytree-data").textContent);

  const nodeById = new Map(nodes.map(n => [n.id, n]));

  const childrenOf = new Map();
  const parentsOf  = new Map();
  for (const link of links) {
    if (!parentsOf.has(link.target))  parentsOf.set(link.target, []);
    if (!childrenOf.has(link.source)) childrenOf.set(link.source, []);
    const src = nodeById.get(link.source);
    const tgt = nodeById.get(link.target);
    if (src) parentsOf.get(link.target).push(src);
    if (tgt) childrenOf.get(link.source).push(tgt);
  }

  // ── Size SVG ─────────────────────────────────────────────────────────────
  const navEl = document.querySelector(".site-nav");
  svgEl.setAttribute("height", window.innerHeight - (navEl ? navEl.offsetHeight : 0));
  d3.select(svgEl).call(zoom);

  // ── Compute generation layout ─────────────────────────────────────────────
  const ROW_GAP  = 180;
  const NODE_GAP = 200;

  // BFS from root nodes (no parents) to assign generation levels
  const genLevel = new Map();
  const queue = [];

  for (const node of nodes) {
    if (!(parentsOf.get(node.id) ?? []).length) {
      genLevel.set(node.id, 0);
      queue.push(node.id);
    }
  }
  while (queue.length) {
    const id = queue.shift();
    const nextLevel = genLevel.get(id) + 1;
    for (const child of (childrenOf.get(id) ?? [])) {
      if (!genLevel.has(child.id) || genLevel.get(child.id) < nextLevel) {
        genLevel.set(child.id, nextLevel);
        queue.push(child.id);
      }
    }
  }
  for (const node of nodes) {
    if (!genLevel.has(node.id)) genLevel.set(node.id, 0);
  }

  // Group and sort within each level for a stable layout
  const byLevel = new Map();
  for (const node of nodes) {
    const l = genLevel.get(node.id);
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l).push(node);
  }
  for (const levelNodes of byLevel.values()) {
    levelNodes.sort((a, b) => a.id.localeCompare(b.id));
  }

  // Assign x, y positions
  const posMap = new Map();
  const positioned = [];
  for (const [l, levelNodes] of byLevel) {
    levelNodes.forEach((node, i) => {
      const x = (i - (levelNodes.length - 1) / 2) * NODE_GAP;
      const y = l * ROW_GAP;
      posMap.set(node.id, { x, y });
      positioned.push({ ...node, x, y });
    });
  }

  // ── Render lines (before nodes for z-order) ───────────────────────────────
  const root = d3.select("#tree-root");

  root.selectAll("line")
    .data(links, d => d.source + d.target)
    .enter()
    .append("line")
    .each(function(d) {
      const src = posMap.get(d.source);
      const tgt = posMap.get(d.target);
      if (!src || !tgt) return;
      d3.select(this)
        .attr("x1", src.x).attr("y1", src.y)
        .attr("x2", tgt.x).attr("y2", tgt.y)
        .attr("data-source", d.source)
        .attr("data-target", d.target)
        .attr("stroke", "#c8b89a")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0);
    });

  // ── Render nodes ──────────────────────────────────────────────────────────
  const nodeGs = root.selectAll("g.node")
    .data(positioned, d => d.id)
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`);

  nodeGs.append("circle");
  nodeGs.append("text").attr("class", "node-name").attr("text-anchor", "middle");
  nodeGs.append("text").attr("class", "node-dates").attr("text-anchor", "middle")
    .attr("font-size", "11px");

  nodeGs.filter(d => d.hasArticle)
    .append("a")
    .attr("href", d => `/${d.id}/`)
    .attr("target", "_blank")
    .on("click", e => e.stopPropagation())
    .append("text")
    .attr("class", "node-link")
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#8b6340")
    .attr("text-decoration", "underline")
    .text("Read \u2192");

  nodeGs.filter(d => d.hasArticle)
    .style("cursor", "pointer")
    .on("click", (event, d) => setFocus(d));

  nodeGs.each(function(d) { styleNode(d3.select(this), d, false); });

  // ── Entry animation: fade nodes in, staggered by generation ──────────────
  nodeGs.style("opacity", 0)
    .transition()
    .duration(500)
    .delay(d => genLevel.get(d.id) * 80 + 50)
    .style("opacity", 1);

  // ── Initial render ────────────────────────────────────────────────────────
  const articleNodes = positioned.filter(n => n.hasArticle);
  if (!articleNodes.length) return;
  const initial = articleNodes[Math.floor(Math.random() * articleNodes.length)];

  // ── Zoom buttons ──────────────────────────────────────────────────────────
  document.getElementById("tree-zoom-in").addEventListener("click", () => {
    d3.select(svgEl).transition().duration(200).call(zoom.scaleBy, 1.4);
  });
  document.getElementById("tree-zoom-out").addEventListener("click", () => {
    d3.select(svgEl).transition().duration(200).call(zoom.scaleBy, 1 / 1.4);
  });

  requestAnimationFrame(() => {
    fitToView();
    setFocus(initial, true);
  });

  // ── setFocus: highlight node + pan viewport to centre on it ──────────────
  function setFocus(node, animate) {
    if (animate === undefined) animate = true;
    currentFocusId = node.id;

    const connectedIds = new Set(
      links.flatMap(l => l.source === currentFocusId ? [l.target] : l.target === currentFocusId ? [l.source] : [])
    );

    root.selectAll("g.node").each(function(d) {
      styleNode(d3.select(this), d, d.id === currentFocusId);
      if (connectedIds.has(d.id)) {
        d3.select(this).select("circle").attr("stroke", "#a0784a").attr("stroke-width", 2);
      }
    });

    root.selectAll("line").transition().duration(250).attr("opacity", function() {
      const s = this.getAttribute("data-source");
      const t = this.getAttribute("data-target");
      return (s === currentFocusId || t === currentFocusId) ? 1 : 0;
    });

    const pos = posMap.get(node.id);
    if (!pos) return;
    const w = svgEl.clientWidth;
    const h = svgEl.clientHeight;
    const k = d3.zoomTransform(svgEl).k;
    const t = d3.zoomIdentity.translate(w / 2 - pos.x * k, h / 2 - pos.y * k).scale(k);

    const sel = d3.select("#family-tree");
    if (animate) sel.transition().duration(300).call(zoom.transform, t);
    else         sel.call(zoom.transform, t);
  }

  // ── Node styling ──────────────────────────────────────────────────────────
  function styleNode(g, d, isFocus) {
    // const r = isFocus ? 54 : d.hasArticle ? 46 : 40;
    const r = 80;
    const LINE_H = 15;

    if (isFocus) {
      g.select("circle").attr("r", r).attr("fill", "#ffffff").attr("stroke", "#c8a96e").attr("stroke-width", 2.5).attr("stroke-opacity", null);
      g.select(".node-name").attr("fill", "#2c1810").attr("font-size", "13px");
      g.select(".node-dates").attr("fill", "#2c1810");
    } else if (d.hasArticle) {
      g.select("circle").attr("r", r).attr("fill", "#ede8dc").attr("stroke", "#c8b89a").attr("stroke-width", 1.5).attr("stroke-opacity", null);
      g.select(".node-name").attr("fill", "#2c1810").attr("font-size", "12px");
      g.select(".node-dates").attr("fill", "#2c1810");
    } else {
      g.select("circle").attr("r", r).attr("fill", "#f5f0e8").attr("stroke", "#c8b89a").attr("stroke-width", 1).attr("stroke-opacity", 0.5);
      g.select(".node-name").attr("fill", "#aaa").attr("font-size", "11px");
      g.select(".node-dates").attr("fill", "#aaa");
      g.style("pointer-events", "none");
    }

    const nameEl = g.select(".node-name");
    nameEl.text(null);
    const words = (d.name || "").split(" ");
    const nameLines = words.length <= 2 ? 1 : 2;
    const hasLink = !!d.hasArticle;
    const totalLines = nameLines + 1 + (hasLink ? 1 : 0); // name lines + dates + optional link
    const startY = -((totalLines - 1) / 2) * LINE_H;

    if (nameLines === 1) {
      nameEl.attr("y", startY).attr("dy", null).text(d.name || "");
    } else {
      const mid = Math.ceil(words.length / 2);
      nameEl.attr("y", null).attr("dy", null);
      nameEl.append("tspan").attr("x", 0).attr("y", startY).text(words.slice(0, mid).join(" "));
      nameEl.append("tspan").attr("x", 0).attr("y", startY + LINE_H).text(words.slice(mid).join(" "));
    }

    g.select(".node-dates").attr("y", startY + nameLines * LINE_H).text(d.dates || "");
    if (hasLink) g.select(".node-link").attr("y", startY + (nameLines + 1) * LINE_H);
  }

  // ── fitToView ─────────────────────────────────────────────────────────────
  function fitToView() {
    const bounds = d3.select("#tree-root").node().getBBox();
    if (!bounds.width && !bounds.height) return;
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
    d3.select("#family-tree").call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }
}());
