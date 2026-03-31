#!/usr/bin/env python3
"""Unit tests for geocode.py — no network calls."""
import unittest
import os
import tempfile
import sys

sys.path.insert(0, os.path.dirname(__file__))
import geocode


class TestExtractAddresses(unittest.TestCase):
    def test_extracts_simple_address(self):
        content = "He lived at 164 East 72nd Street for many years."
        result = geocode.extract_addresses(content)
        self.assertIn("164 East 72nd Street", result)

    def test_extracts_avenue(self):
        content = "The office was at 45 Fifth Avenue."
        result = geocode.extract_addresses(content)
        self.assertIn("45 Fifth Avenue", result)

    def test_extracts_multiple(self):
        content = "Born at 10 Park Avenue. Later moved to 55 Broadway."
        result = geocode.extract_addresses(content)
        self.assertEqual(len(result), 2)

    def test_extracts_hyphenated_street_name(self):
        content = "He worked at 28 West Thirty-eighth Street, Manhattan."
        result = geocode.extract_addresses(content)
        self.assertIn("28 West Thirty-eighth Street", result)

    def test_no_false_positive_without_number(self):
        content = "He walked down Broadway every day."
        result = geocode.extract_addresses(content)
        self.assertEqual(result, [])

    def test_west_direction(self):
        content = "She resided at 12 West 11th Street."
        result = geocode.extract_addresses(content)
        self.assertIn("12 West 11th Street", result)


class TestLoadSave(unittest.TestCase):
    def test_load_returns_empty_when_missing(self):
        original = geocode.LOCATIONS_FILE
        geocode.LOCATIONS_FILE = "/tmp/does_not_exist_xyz_lol.json"
        result = geocode.load_existing()
        geocode.LOCATIONS_FILE = original
        self.assertEqual(result, [])

    def test_save_and_load_roundtrip(self):
        data = [{"address": "1 Test Street", "lat": 40.0, "lng": -74.0, "articles": []}]
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            tmpfile = f.name
        try:
            original = geocode.LOCATIONS_FILE
            geocode.LOCATIONS_FILE = tmpfile
            geocode.save_locations(data)
            loaded = geocode.load_existing()
            geocode.LOCATIONS_FILE = original
            self.assertEqual(loaded, data)
        finally:
            os.unlink(tmpfile)

    def test_null_coordinates_roundtrip(self):
        """Entries with null lat/lng must survive a save/load cycle intact."""
        data = [{"address": "1 Ghost Street", "lat": None, "lng": None, "articles": []}]
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            tmpfile = f.name
        try:
            original = geocode.LOCATIONS_FILE
            geocode.LOCATIONS_FILE = tmpfile
            geocode.save_locations(data)
            loaded = geocode.load_existing()
            geocode.LOCATIONS_FILE = original
            self.assertIsNone(loaded[0]["lat"])
            self.assertIsNone(loaded[0]["lng"])
        finally:
            os.unlink(tmpfile)


class TestCollectAddresses(unittest.TestCase):
    def test_deduplicates_same_address_across_articles(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            original_dir = geocode.ARTICLES_DIR
            geocode.ARTICLES_DIR = tmpdir
            with open(os.path.join(tmpdir, "person-a.md"), "w") as f:
                f.write("# Person, A\nLived at 100 Main Street.\n")
            with open(os.path.join(tmpdir, "person-b.md"), "w") as f:
                f.write("# Person, B\nAlso lived at 100 Main Street.\n")
            result = geocode.collect_addresses_from_articles()
            geocode.ARTICLES_DIR = original_dir
        self.assertIn("100 Main Street", result)
        self.assertEqual(len(result["100 Main Street"]), 2)
        # Verify both articles are present with distinct slugs
        slugs = {e["slug"] for e in result["100 Main Street"]}
        self.assertEqual(slugs, {"person-a", "person-b"})

    def test_each_article_entry_has_title_and_slug(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            original_dir = geocode.ARTICLES_DIR
            geocode.ARTICLES_DIR = tmpdir
            with open(os.path.join(tmpdir, "someone-1900-1950.md"), "w") as f:
                f.write("# Someone, Test (1900\u20131950)\nLived at 99 Test Avenue.\n")
            result = geocode.collect_addresses_from_articles()
            geocode.ARTICLES_DIR = original_dir
        entry = result["99 Test Avenue"][0]
        self.assertEqual(entry["slug"], "someone-1900-1950")
        self.assertIn("Someone", entry["title"])


if __name__ == "__main__":
    unittest.main()
