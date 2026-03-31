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

  const map = L.map("map").setView([40.7128, -74.0060], 12);

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

  for (const loc of valid) {
    const links = loc.articles
      .map(a => `<a href="/${a.slug}/">${a.title} \u2192</a>`)
      .join("");
    const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=280x160&location=${loc.lat},${loc.lng}&key=${STREET_VIEW_KEY}`;
    const popupHtml = `<div class="map-popup"><img class="map-popup-streetview" src="${svUrl}" alt="Street view of ${loc.address}"><strong>${loc.address}</strong>${links}</div>`;
    L.marker([loc.lat, loc.lng], { icon: markerIcon })
      .addTo(map)
      .bindPopup(popupHtml);
  }
}());
