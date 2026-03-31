const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Load module and expose internal helpers via module.exports._test
function loadModule() {
  // Clear require cache so tests get a fresh module each run
  delete require.cache[require.resolve("../_data/familytree.js")];
  return require("../_data/familytree.js");
}

describe("familytree.js helpers", () => {
  let helpers;
  it("module loads and exposes _test helpers", () => {
    const mod = loadModule();
    assert.ok(typeof mod === "function");
    assert.ok(mod._test, "expected _test export on module");
    helpers = mod._test;
  });

  describe("reverseNameOrder", () => {
    it("reverses Surname, Given Name format", () => {
      const { reverseNameOrder } = require("../_data/familytree.js")._test;
      assert.equal(reverseNameOrder("Alexandre, James Henry"), "James Henry Alexandre");
    });

    it("moves trailing suffix after surname", () => {
      const { reverseNameOrder } = require("../_data/familytree.js")._test;
      assert.equal(reverseNameOrder("Alexandre, James Henry Jr"), "James Henry Alexandre Jr");
    });

    it("handles III suffix", () => {
      const { reverseNameOrder } = require("../_data/familytree.js")._test;
      assert.equal(reverseNameOrder("Alexandre, James Henry III"), "James Henry Alexandre III");
    });

    it("returns unchanged if no comma", () => {
      const { reverseNameOrder } = require("../_data/familytree.js")._test;
      assert.equal(reverseNameOrder("Marie Cipriant"), "Marie Cipriant");
    });
  });

  describe("shouldSkip", () => {
    it("skips 'Not yet identified'", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(shouldSkip("Not yet identified"));
    });

    it("skips case-insensitive variant", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(shouldSkip("not yet identified"));
    });

    it("skips 'Unknown'", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(shouldSkip("Unknown farmers of Saint Helier"));
    });

    it("skips single-word tokens", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(shouldSkip("Alexandre"));
    });

    it("does not skip a valid two-word name", () => {
      const { shouldSkip } = require("../_data/familytree.js")._test;
      assert.ok(!shouldSkip("Marie Cipriant"));
    });
  });

  describe("parseParentsField", () => {
    const { parseParentsField } = require("../_data/familytree.js")._test;

    it("parses a linked parent", () => {
      const result = parseParentsField(
        "[Frederick Francis Alexandre](/alexandre-frederick-francis-1809-1889/) (1809–1889) and Marie Cipriant (1811–1882)."
      );
      assert.equal(result.length, 2);
      assert.equal(result[0].id, "alexandre-frederick-francis-1809-1889");
      assert.equal(result[0].name, "Frederick Francis Alexandre");
    });

    it("parses an unlinked parent", () => {
      const result = parseParentsField("Marie Cipriant (1811–1882) and John Doe (1810–1870).");
      assert.equal(result.length, 2);
      assert.equal(result[0].name, "Marie Cipriant");
      assert.equal(result[0].dates, "1811–1882");
    });

    it("extracts generational suffix Jr from linked parent remainder", () => {
      const result = parseParentsField(
        "[James Henry Alexandre](/alexandre-james-henry-1848-1912/) Jr (1883–1956) and Anne Loomis (1890–1948)."
      );
      assert.equal(result[0].name, "James Henry Alexandre Jr");
    });

    it("skips 'Not yet identified' bare bracket token", () => {
      const result = parseParentsField("[Not yet identified] and Marie Cipriant (1811–1882).");
      assert.equal(result.length, 1);
      assert.equal(result[0].name, "Marie Cipriant");
    });

    it("truncates at semicolon", () => {
      const result = parseParentsField("Marie Cipriant (1811–1882); Spouse: ignored.");
      assert.equal(result.length, 1);
    });

    it("strips backslash before truncation", () => {
      const result = parseParentsField("Marie Cipriant (1811–1882).\\ Spouse: ignored.");
      assert.equal(result.length, 1);
    });

    it("handles Jr. with period (normalised before truncation)", () => {
      const result = parseParentsField(
        "Frederick Alexandre Jr. (1809–1889) and Marie Cipriant (1811–1882)."
      );
      assert.equal(result.length, 2, "Jr. period must not truncate the field early");
    });
  });
});

describe("familytree.js full output", () => {
  it("returns { nodes, links } shape", () => {
    const mod = require("../_data/familytree.js");
    const data = mod();
    assert.ok(Array.isArray(data.nodes), "nodes should be an array");
    assert.ok(Array.isArray(data.links), "links should be an array");
  });

  it("all nodes have required fields", () => {
    const { nodes } = require("../_data/familytree.js")();
    for (const n of nodes) {
      assert.ok(n.id, `node missing id: ${JSON.stringify(n)}`);
      assert.ok(n.name, `node missing name: ${JSON.stringify(n)}`);
      assert.ok(typeof n.hasArticle === "boolean", `node missing hasArticle: ${JSON.stringify(n)}`);
    }
  });

  it("article-backed nodes have hasArticle: true", () => {
    const { nodes } = require("../_data/familytree.js")();
    const james = nodes.find(n => n.id === "alexandre-james-henry-1848-1912");
    assert.ok(james, "alexandre-james-henry-1848-1912 node not found");
    assert.ok(james.hasArticle === true);
    assert.equal(james.name, "James Henry Alexandre");
  });

  it("node names are in natural order (Given Surname), not title order (Surname, Given)", () => {
    const { nodes } = require("../_data/familytree.js")();
    for (const n of nodes) {
      assert.ok(!n.name.includes(","), `name should not contain comma: "${n.name}"`);
    }
  });

  it("Jr article node has suffix after surname", () => {
    const { nodes } = require("../_data/familytree.js")();
    const jr = nodes.find(n => n.id === "alexandre-james-henry-jr-1883-1956");
    assert.ok(jr, "Jr node not found");
    assert.ok(jr.name.endsWith("Jr"), `expected name to end with Jr, got: "${jr.name}"`);
  });

  it("unlinked parent nodes have hasArticle: false", () => {
    const { nodes } = require("../_data/familytree.js")();
    const ghost = nodes.find(n => !n.hasArticle);
    assert.ok(ghost, "expected at least one ghost node (unlinked parent with no article)");
    assert.strictEqual(ghost.hasArticle, false);
  });

  it("links have source and target fields", () => {
    const { links } = require("../_data/familytree.js")();
    for (const l of links) {
      assert.ok(l.source, `link missing source: ${JSON.stringify(l)}`);
      assert.ok(l.target, `link missing target: ${JSON.stringify(l)}`);
    }
  });

  it("james henry 1848 is a parent of at least one article", () => {
    const { links } = require("../_data/familytree.js")();
    const found = links.some(l => l.source === "alexandre-james-henry-1848-1912");
    assert.ok(found, "expected alexandre-james-henry-1848-1912 to appear as a parent");
  });

  it("no duplicate links", () => {
    const { links } = require("../_data/familytree.js")();
    const seen = new Set();
    for (const l of links) {
      const key = `${l.source}→${l.target}`;
      assert.ok(!seen.has(key), `duplicate link: ${key}`);
      seen.add(key);
    }
  });
});
