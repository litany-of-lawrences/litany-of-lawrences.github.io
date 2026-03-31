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
