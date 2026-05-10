(function () {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const navEl = document.querySelector(".site-nav");
  mapEl.setAttribute("style", "height: " + (window.innerHeight - (navEl ? navEl.offsetHeight : 0)) + "px");

  const locations = JSON.parse(document.getElementById("map-data").textContent);
  const valid = locations.filter(d => d.lat !== null && d.lng !== null);

  if (valid.length === 0) {
    const empty = document.createElement("div");
    empty.className = "map-empty-state";
    empty.textContent = "No locations indexed yet \u2014 run geocode.py to populate the map.";
    mapEl.appendChild(empty);
    return;
  }

  const map = L.map("map", { zoomControl: false }).setView([40.7128, -74.0060], 12);
  L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer('https://maps.geoapify.com/v1/tile/osm-bright-grey/{z}/{x}/{y}.png?apiKey=415b6eccc85d49deb12a2bb1b56559e4', {
  attribution: 'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | <a href="https://openmaptiles.org/" target="_blank">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> contributors',
  maxZoom: 20, id: 'osm-bright'
}).addTo(map);



  const markerIcon = L.divIcon({
    className: "map-marker",
    iconSize: [24, 24],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  });

  const STREET_VIEW_KEY = "AIzaSyB-yH-T55jmILafFHK7f649JaQdODVkMlQ";

  // Lightbox
  const lightbox = document.createElement("div");
  lightbox.className = "map-lightbox";
  lightbox.innerHTML = '<img class="map-lightbox-img" alt=""><button class="map-lightbox-close" title="Close" aria-label="Close">&times;</button>';
  document.body.appendChild(lightbox);
  const lightboxImg = lightbox.querySelector("img");

  lightbox.addEventListener("click", function () {
    lightbox.classList.remove("is-active");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") lightbox.classList.remove("is-active");
  });

  function openLightbox(src, alt) {
    lightboxImg.src = src.replace("560x320", "1200x800");
    lightboxImg.alt = alt;
    lightbox.classList.add("is-active");
  }

  for (const loc of valid) {
    const links = loc.articles
      .map(a => `<a target="_blank" href="/${a.slug}/">${a.title} \u2192</a>`)
      .join("");
    const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=560x320&location=${loc.lat},${loc.lng}&key=${STREET_VIEW_KEY}`;
    const popupHtml = `<div class="map-popup"><div class="map-popup-img-wrap"><img class="map-popup-streetview" src="${svUrl}" alt="Street view of ${loc.address}"><div class="map-popup-btn-row"><button class="map-popup-expand" title="View full size" aria-label="View full size">&#x26F6;</button><button class="map-popup-close" title="Close" aria-label="Close">&times;</button></div></div><strong>${loc.address}</strong>${links}</div>`;
    const marker = L.marker([loc.lat, loc.lng], { icon: markerIcon })
      .addTo(map)
      .bindPopup(popupHtml, { closeButton: false });

    marker.on("popupopen", function () {
      var el = marker.getPopup().getElement();
      var expandBtn = el.querySelector(".map-popup-expand");
      var closeBtn = el.querySelector(".map-popup-close");
      if (expandBtn) {
        expandBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          openLightbox(svUrl, "Street view of " + loc.address);
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          map.closePopup();
        });
      }
    });
  }
}());
