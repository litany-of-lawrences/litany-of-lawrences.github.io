// =============================================================================
// Homepage: random article shuffle
// =============================================================================

const articlesDataEl = document.getElementById("articles-data");
if (articlesDataEl) {
  const ARTICLES = JSON.parse(articlesDataEl.textContent);

  const CARDS_COUNT = 5;

  function pickRandom(n) {
    const pool = ARTICLES.slice();
    const picked = [];
    while (picked.length < n && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(i, 1)[0]);
    }
    return picked;
  }

  function shuffle() {
    const container = document.getElementById("rand-cards");
    container.innerHTML = pickRandom(CARDS_COUNT).map(a => `
      <div class="random-card">
        <div class="random-card-title"><a href="/${a.slug}/">${a.title}</a></div>
        ${a.dates ? `<div class="random-card-dates">${a.dates}</div>` : ""}
        ${a.excerpt ? `<div class="random-card-excerpt">${a.excerpt}</div>` : ""}
        <div class="random-card-actions">
          <a href="/${a.slug}/">Read article →</a>
        </div>
      </div>
    `).join("");
  }

  document.getElementById("rand-shuffle").addEventListener("click", (e) => {
    e.preventDefault();
    shuffle();
  });

  shuffle();

  new PagefindUI({ element: "#search", showSubResults: false, baseUrl: "/" });
  addReadLinks(document.getElementById("search"));

  const randomSection = document.querySelector(".random-section");
  new MutationObserver(() => {
    const pfInput = document.querySelector("#search input[type=text]");
    if (!pfInput) return;
    pfInput.addEventListener("input", () => {
      randomSection.style.display = pfInput.value.trim() ? "none" : "";
    });
  }).observe(document.getElementById("search"), { childList: true, subtree: true });
}

// =============================================================================
// Pagefind: inject "Read article →" link into each result card
// =============================================================================

function addReadLinks(container) {
  new MutationObserver(() => {
    container.querySelectorAll(".pagefind-ui__result").forEach(result => {
      if (result.querySelector(".result-read-link")) return; // already added
      const titleLink = result.querySelector(".pagefind-ui__result-link");
      if (!titleLink) return;
      const actions = document.createElement("div");
      actions.className = "random-card-actions result-read-link";
      const a = document.createElement("a");
      a.href = titleLink.href;
      a.textContent = "Read article →";
      actions.appendChild(a);
      result.appendChild(actions);
    });
  }).observe(container, { childList: true, subtree: true });
}

// =============================================================================
// Article pages: route page scroll to article content
// =============================================================================

const articleContent = document.querySelector(".article-content");
if (articleContent) {
  document.addEventListener("wheel", (e) => {
    articleContent.scrollTop += e.deltaY;
  }, { passive: true });
}

// =============================================================================
// Article pages: nav search overlay
// =============================================================================

const navSearchInput = document.getElementById("nav-search-input");
if (navSearchInput) {
  const overlay = document.getElementById("pagefind-overlay");

  new PagefindUI({ element: "#nav-search-results", showSubResults: false, baseUrl: "/" });
  addReadLinks(document.getElementById("nav-search-results"));

  navSearchInput.addEventListener("focus", () => {
    overlay.style.display = "block";
  });

  navSearchInput.addEventListener("input", (e) => {
    const pf = overlay.querySelector("input[type=text]");
    if (pf) {
      pf.value = e.target.value;
      pf.dispatchEvent(new Event("input"));
    }
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.style.display = "none";
  });

  document.querySelector(".search-overlay-close").addEventListener("click", () => {
    overlay.style.display = "none";
  });
}
