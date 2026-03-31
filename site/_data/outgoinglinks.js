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
