import { CATEGORY_BY_KEY, DEFAULT_CENTER, DEFAULT_ZOOM, getCategoryLabel } from "./config.js";

export function createCommunityMap(options) {
  const L = options.L;
  const map = L.map(options.elementId ?? "map", {
    zoomControl: false,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  const markerLayer = L.layerGroup().addTo(map);
  let userMarker = null;
  let userCircle = null;

  L.control
    .zoom({
      position: "bottomright",
    })
    .addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    crossOrigin: true,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  map.on("click", (event) => {
    options.onCreate?.(event.latlng);
  });

  map.on("popupopen", (event) => {
    const node = event.popup.getElement();
    if (!node) return;

    const editBtn = node.querySelector("[data-action='edit']");
    const deleteBtn = node.querySelector("[data-action='delete']");

    editBtn?.addEventListener("click", () => {
      const id = editBtn.dataset.id;
      if (!id) return;
      map.closePopup();
      options.onEdit?.(id);
    });

    deleteBtn?.addEventListener("click", () => {
      const id = deleteBtn.dataset.id;
      if (!id) return;
      options.onDelete?.(id);
    });
  });

  function renderMarkers(entries, activeFilter = "all") {
    markerLayer.clearLayers();

    entries
      .filter((entry) => activeFilter === "all" || entry.category === activeFilter)
      .forEach((entry) => {
        const category = CATEGORY_BY_KEY[entry.category];
        if (!category) return;

        const icon = L.divIcon({
          className: "",
          html: `<div class="custom-pin custom-pin-${escapeHtml(entry.category)}" style="background:${escapeHtml(
            category.color
          )}"><span>${escapeHtml(category.symbol)}</span></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([entry.lat, entry.lng], { icon }).addTo(markerLayer);
        marker.bindPopup(`
          <strong>${escapeHtml(entry.placeName)}</strong><br>
          <span>${escapeHtml(getCategoryLabel(category))}</span><br>
          <small>${escapeHtml(entry.note || "설명 없음")}</small>
          <div class="popup-actions">
            <button type="button" class="popup-btn" data-action="edit" data-id="${escapeHtml(
              entry.id
            )}">수정</button>
            <button type="button" class="popup-btn delete" data-action="delete" data-id="${escapeHtml(
              entry.id
            )}">삭제</button>
          </div>
        `);
      });
  }

  function drawUserLocation(latlng, accuracy) {
    if (userMarker) map.removeLayer(userMarker);
    if (userCircle) map.removeLayer(userCircle);

    userMarker = L.circleMarker(latlng, {
      radius: 8,
      fillColor: "#2346db",
      color: "#fff",
      weight: 2,
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup("현재 위치")
      .openPopup();

    userCircle = L.circle(latlng, {
      radius: Math.min(accuracy, 150),
      color: "#2346db",
      fillColor: "#7f95f2",
      fillOpacity: 0.2,
      weight: 1,
    }).addTo(map);
  }

  return {
    closePopup: () => map.closePopup(),
    drawUserLocation,
    renderMarkers,
    setView: (...args) => map.setView(...args),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
