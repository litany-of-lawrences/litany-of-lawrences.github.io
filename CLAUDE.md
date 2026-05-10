# Litany of Lawrences

## Building the site

IMPORTANT: Never run `eleventy` directly. Always use the npm scripts from the `site/` directory:

- `npm run build` — build the site (outputs to `site/_site/`)
- `npm run serve` — build + live reload dev server
- `npm run test` — run tests

Running `npx eleventy` without the correct `--config` flag will output files to the wrong directory and pollute the repo root.

## Deployment

Deployment is automatic via GitHub Actions. Push to `main` and the workflow builds the site and deploys to the `gh-pages` branch, which serves at https://litany-of-lawrences.github.io/.

## Project structure

- `articles/` — markdown source files for all articles
- `site/` — Eleventy site (templates, JS, SCSS, data)
- `site/_site/` — build output (gitignored)
- `site/_includes/` — Nunjucks templates (base.njk, article.njk)
- `site/_data/` — data files (familytree.js, articles.js, locations.js, timeline.json)
- `site/js/` — client-side JavaScript
- `site/scss/` — SCSS stylesheets
- `images/` — article images
