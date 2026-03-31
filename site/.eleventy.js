const sass = require("sass");
const fs = require("fs");
const path = require("path");

module.exports = function (eleventyConfig) {

  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy({ "site/js": "js" });

  // Compile SCSS → site/_site/css/main.css before each build
  eleventyConfig.on("eleventy.before", () => {
    const result = sass.compile(path.join(__dirname, "scss/main.scss"));
    const outDir = path.join(__dirname, "_site/css");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "main.css"), result.css);
  });

  // Watch SCSS and JS for changes in dev mode
  eleventyConfig.addWatchTarget("site/scss/");
  eleventyConfig.addWatchTarget("site/js/");
  eleventyConfig.addWatchTarget("js");

  // Look up a single article by slug from the articles collection
  eleventyConfig.addFilter("getArticleBySlug", function(articles, slug) {
    return (articles || []).find(a => a.slug === slug) || null;
  });

  // Helper: does a stripped line look like a metadata label line?
  // Matches: <p><strong>Label:</strong> ... OR <strong>Label:</strong> ...
  function isMetaLine(stripped) {
    return /^(?:<p>)?<strong>[^<]+:<\/strong>/.test(stripped);
  }

  // Find the first meaningful content line (non-blank, non-heading, non-image)
  function firstContentLine(lines) {
    return lines.find(l => {
      const s = l.trim();
      return s && !/^<h[1-6]/.test(s) && !/^<p><img/.test(s);
    });
  }

  // Metadata panel: collect leading bold-label lines, stop at first prose line.
  // Only runs if the article actually *starts* with metadata.
  eleventyConfig.addFilter("metaPanel", function(html) {
    const lines = html.split("\n");
    const first = firstContentLine(lines);
    if (!first || !isMetaLine(first.trim())) return "";

    const panelLines = [];
    for (const line of lines) {
      const stripped = line.trim();
      if (!stripped) continue;
      if (/^<h[1-6]/.test(stripped)) continue;
      if (/^<p><img/.test(stripped)) continue; // skip images in preamble
      if (isMetaLine(stripped)) {
        panelLines.push(stripped.replace(/^<p>/, ""));
      } else {
        break; // first non-meta line ends the panel
      }
    }
    return panelLines.join("<br>\n");
  });

  // Pagefind excerpt: start from the "Early Life" section if present
  eleventyConfig.addFilter("pagefindExcerpt", function(html) {
    const re = /<strong>early\s+life[^<]*<\/strong>/i;
    const match = re.exec(html);
    if (!match) return html;
    // Find the start of the line containing the heading and return everything after it
    const lineStart = html.lastIndexOf("\n", match.index);
    const lineEnd = html.indexOf("\n", match.index);
    return html.slice(lineEnd === -1 ? match.index + match[0].length : lineEnd).trimStart();
  });

  // Article body: everything after the metadata panel block
  eleventyConfig.addFilter("articleBody", function(html) {
    const lines = html.split("\n");

    // Only treat as a panel article if the first meaningful line IS metadata.
    // This prevents body-text bold-labels (e.g. "**Philanthropy:**") from
    // being mistaken for metadata in non-person articles.
    const first = firstContentLine(lines);
    const hasPanel = !!(first && isMetaLine(first.trim()));
    if (!hasPanel) {
      return lines.filter(l => !/^<h[1-6]/.test(l.trim())).join("\n");
    }

    let panelDone = false;
    let foundFirst = false;
    const bodyLines = [];

    for (const line of lines) {
      const stripped = line.trim();
      if (!stripped) {
        if (panelDone) bodyLines.push(line);
        continue;
      }
      if (/^<h[1-6]/.test(stripped)) continue; // skip heading lines (h1 title already shown)
      if (!foundFirst && isMetaLine(stripped)) {
        foundFirst = true;
        continue; // skip panel lines
      }
      if (foundFirst && !panelDone && !isMetaLine(stripped)) {
        panelDone = true;
      }
      if (panelDone) bodyLines.push(line);
    }
    return bodyLines.join("\n");
  });

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
