# Generations Page Design

A new page showing the Lawrence family organized generation-by-generation as centred tiers of person cards with interactive descent lines.

## Layout

- Standard scrollable page with `max-width: 720px` centred container (matching timeline)
- Generations stack top-to-bottom, each tier centred horizontally
- Gold dot-and-line connectors between tiers (generic, not parent-specific)
- Cards wrap on narrower screens

## Page Template (`generations.njk`)

- New Eleventy page at `/generations/`
- Extends `base.njk`, loads `js/generations.js` via `{% block head %}`
- Injects `familytree` data (nodes + links) as JSON in a `<script type="application/json">` tag, same pattern as the family tree page
- Added to the nav links in `base.njk`

## Data & Generation Assignment (`js/generations.js`)

- Parses the injected `familytree` JSON (nodes + links)
- Builds parent/child lookup maps from links
- Assigns generation levels via BFS from root nodes (nodes with no parents), same algorithm as `family-tree.js`
- Groups nodes by generation level, sorts within each level alphabetically by name

## Rendering

Each generation tier consists of:

1. A "Generation N" label (small uppercase, gold, centred)
2. A flex row of person cards, centred, wrapping
3. A dot-and-line connector to the next tier (gold line with gold dot midpoint)

### Person Cards

- Name and dates only
- Cards with articles: gold border (`#c8a96e`), name styled as link color (`#8b6340`), clickable — links to the person's article page
- Cards without articles: muted border (`#c8b89a`), standard brown text, not clickable
- White background, rounded corners, compact padding

## Interactivity

### Hover/Click Descent Lines

- An SVG overlay element is positioned over the tiers container (behind cards via z-index)
- When a user hovers over or clicks a card:
  - SVG lines are drawn from that card to its children in the tier below and parents in the tier above
  - Lines use the gold color (`#c8a96e`), 1.5px stroke
  - Connected cards receive a subtle highlight (gold background tint)
  - Non-connected cards dim slightly (reduced opacity)
- On mouse leave or clicking elsewhere:
  - Lines fade out
  - All cards return to normal styling
- Line positions are calculated dynamically using `getBoundingClientRect()` relative to the container, so they adapt to wrapping and screen width

## Styling (added to `scss/main.scss`)

New section for generations styles, using existing site variables:

- `$color-parchment`, `$color-brown`, `$color-gold`, `$color-link`, `$color-border`, `$color-muted`
- `$font-serif` for all text
- Consistent card styling with other components (similar padding/border-radius to existing cards)

## Navigation

- Add "Generations" link to the nav in `base.njk`, alongside Family Tree, Timeline, Map, Index
- URL: `/generations/`

## Files Changed

- `generations.njk` — new page template
- `js/generations.js` — new JavaScript file for rendering and interactivity
- `scss/main.scss` — new generations styles section
- `_includes/base.njk` — add nav link
