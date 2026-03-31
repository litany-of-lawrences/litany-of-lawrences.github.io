const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// locations.json lives at the repo root — two levels above site/test/
const LOCATIONS_FILE = path.join(__dirname, "../../locations.json");

function loadLocations() {
  // Clear require cache so each test reads fresh from disk
  delete require.cache[require.resolve("../_data/locations.js")];
  const mod = require("../_data/locations.js");
  return typeof mod === "function" ? mod() : mod;
}

function withTempLocations(data, fn) {
  const backup = LOCATIONS_FILE + ".testbak";
  const existed = fs.existsSync(LOCATIONS_FILE);
  if (existed) fs.renameSync(LOCATIONS_FILE, backup);
  if (data !== null) fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(data));
  try {
    fn();
  } finally {
    if (fs.existsSync(LOCATIONS_FILE)) fs.unlinkSync(LOCATIONS_FILE);
    if (existed) fs.renameSync(backup, LOCATIONS_FILE);
  }
}

describe("locations.js", () => {
  it("returns empty array when locations.json does not exist", () => {
    withTempLocations(null, () => {
      const result = loadLocations();
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });

  it("returns parsed array when locations.json exists", () => {
    const data = [
      { address: "164 East 72nd Street", lat: 40.7687, lng: -73.9638, articles: [] }
    ];
    withTempLocations(data, () => {
      const result = loadLocations();
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1);
      assert.equal(result[0].address, "164 East 72nd Street");
    });
  });

  it("returns empty array when locations.json contains invalid JSON", () => {
    const existed = fs.existsSync(LOCATIONS_FILE);
    const backup = LOCATIONS_FILE + ".testbak";
    if (existed) fs.renameSync(LOCATIONS_FILE, backup);
    fs.writeFileSync(LOCATIONS_FILE, "{ not valid json }");
    try {
      const result = loadLocations();
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    } finally {
      if (fs.existsSync(LOCATIONS_FILE)) fs.unlinkSync(LOCATIONS_FILE);
      if (existed) fs.renameSync(backup, LOCATIONS_FILE);
    }
  });

  it("each entry has address, lat, lng, and articles fields", () => {
    const data = [
      { address: "10 Park Avenue", lat: 40.745, lng: -73.984, articles: [{ title: "Test", slug: "test" }] }
    ];
    withTempLocations(data, () => {
      const result = loadLocations();
      for (const entry of result) {
        assert.ok("address" in entry, "missing address");
        assert.ok("lat" in entry,     "missing lat");
        assert.ok("lng" in entry,     "missing lng");
        assert.ok(Array.isArray(entry.articles), "articles must be an array");
      }
    });
  });
});
