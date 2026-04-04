(function () {
  var container = document.getElementById("timeline");
  if (!container) return;

  var entries = JSON.parse(document.getElementById("timeline-data").textContent);
  if (!entries.length) {
    container.innerHTML = '<p class="timeline-empty">No timeline data yet.</p>';
    return;
  }

  // Group entries by year
  var byYear = {};
  var years = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (!byYear[e.year]) {
      byYear[e.year] = [];
      years.push(e.year);
    }
    byYear[e.year].push(e);
  }

  var html = '<div class="timeline-line">';
  for (var y = 0; y < years.length; y++) {
    var year = years[y];
    var items = byYear[year];
    html += '<div class="timeline-year-group">';
    html += '<div class="timeline-year">' + year + '</div>';
    html += '<div class="timeline-entries">';
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var cls = "timeline-entry timeline-entry--" + item.type;
      html += '<div class="' + cls + '">';
      if (item.type === "birth" && item.slug) {
        html += '<a href="/' + item.slug + '/" target="_blank">' + item.text + '</a>';
      } else {
        html += '<span>' + item.text + '</span>';
      }
      html += '</div>';
    }
    html += '</div></div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Scroll to the first birth entry
  var firstBirth = container.querySelector(".timeline-entry--birth");
  if (firstBirth) {
    firstBirth.scrollIntoView({ block: "center" });
  }
}());
