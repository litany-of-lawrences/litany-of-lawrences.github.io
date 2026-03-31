const path = require("path");
const fs   = require("fs");

// locations.json lives at the repo root — two levels above site/_data/
const LOCATIONS_FILE = path.join(__dirname, "../../locations.json");

module.exports = function () {
  try {
    return JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8"));
  } catch (err) {
    // File may not exist on a fresh checkout before geocode.py has been run
    if (err.code !== "ENOENT") {
      console.warn("[locations.js] Could not parse locations.json:", err.message);
    }
    return [];
  }
};
