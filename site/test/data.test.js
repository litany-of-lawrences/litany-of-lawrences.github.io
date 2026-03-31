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
