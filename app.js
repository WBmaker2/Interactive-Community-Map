const STORAGE_KEY = "community_map_entries_v1";

const categories = {
  pride: { label: "🍏 살기 좋은 곳", color: "#2f9d44" },
  safety: { label: "⚠️ 주의할 곳", color: "#d6463a" },
  help: { label: "🏥 도움받는 곳", color: "#1e79c2" },
};

const map = L.map("map", {
  zoomControl: false,
}).setView([37.5665, 126.978], 15);

L.control
  .zoom({
    position: "bottomright",
  })
  .addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const formPanel = document.getElementById("entryPanel");
const form = document.getElementById("entryForm");
const cancelBtn = document.getElementById("cancelBtn");
const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const entryIdInput = document.getElementById("entryId");
const filterWrap = document.getElementById("filterWrap");
const mainView = document.querySelector("main");
const myLocationBtn = document.getElementById("myLocationBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportImageBtn = document.getElementById("exportImageBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const toggleDashboardBtn = document.getElementById("toggleDashboardBtn");
const dashboardPanel = document.getElementById("dashboardPanel");
const totalCount = document.getElementById("totalCount");
const statsList = document.getElementById("statsList");

let entries = loadEntries();
let selectedLatLng = null;
let activeFilter = "all";
let editingEntryId = "";
let userMarker = null;
let userCircle = null;
const markerLayer = L.layerGroup().addTo(map);

buildFilterButtons();
renderMarkers();
renderDashboard();
syncDashboardButtonState();

map.on("click", (e) => {
  openCreateForm(e.latlng);
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedLatLng) return;

  const data = new FormData(form);
  const category = data.get("category");
  const placeName = String(data.get("placeName") || "").trim();
  const note = String(data.get("note") || "").trim();
  if (!placeName || !categories[category]) return;

  const nextEntries = editingEntryId
    ? entries.map((entry) =>
        entry.id === editingEntryId
          ? {
              ...entry,
              placeName,
              category,
              note,
            }
          : entry
      )
    : [
        ...entries,
        {
          id: crypto.randomUUID(),
          placeName,
          category,
          note,
          lat: selectedLatLng.lat,
          lng: selectedLatLng.lng,
          createdAt: new Date().toISOString(),
        },
      ];

  if (!saveEntries(nextEntries)) return;
  entries = nextEntries;
  renderMarkers();
  renderDashboard();
  closeForm();
});

cancelBtn.addEventListener("click", () => {
  closeForm();
});

myLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("이 기기에서는 위치 정보를 사용할 수 없어요.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latlng = [position.coords.latitude, position.coords.longitude];
      map.setView(latlng, 17);
      drawUserLocation(latlng, position.coords.accuracy);
    },
    () => {
      alert("위치 정보를 가져오지 못했어요. 위치 권한을 확인해 주세요.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

toggleDashboardBtn.addEventListener("click", () => {
  dashboardPanel.classList.toggle("hidden");
  syncDashboardButtonState();
});

exportCsvBtn.addEventListener("click", () => {
  if (!entries.length) {
    alert("내보낼 데이터가 없어요.");
    return;
  }

  const header = ["장소 이름", "카테고리", "특징", "위도", "경도", "기록일"];
  const rows = entries.map((entry) => [
    entry.placeName,
    categories[entry.category]?.label || entry.category,
    entry.note || "",
    entry.lat,
    entry.lng,
    formatDate(entry.createdAt),
  ]);

  const csvBody = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `community-map-${todayStamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  revokeObjectUrlLater(url);
});

exportImageBtn.addEventListener("click", async () => {
  if (!window.html2canvas) {
    alert("이미지 캡처 라이브러리를 불러오지 못했어요.");
    return;
  }

  try {
    const canvas = await window.html2canvas(mainView, {
      useCORS: true,
      allowTaint: false,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      logging: false,
      backgroundColor: "#ffffff",
    });
    canvas.toBlob((blob) => {
      if (!blob) {
        alert("이미지 파일 생성에 실패했어요.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `community-map-${todayStamp()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      revokeObjectUrlLater(url);
    }, "image/png");
  } catch {
    alert("지도를 이미지로 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
});

exportPdfBtn.addEventListener("click", async () => {
  if (!window.html2canvas) {
    alert("PDF 생성을 위한 캡처 라이브러리를 불러오지 못했어요.");
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF 라이브러리를 불러오지 못했어요.");
    return;
  }

  try {
    const capturedAt = new Date();
    const mapCanvas = await window.html2canvas(mainView, {
      useCORS: true,
      allowTaint: false,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      logging: false,
      backgroundColor: "#ffffff",
    });

    const headerHeight = Math.round(mapCanvas.width * 0.22);
    const composedCanvas = document.createElement("canvas");
    composedCanvas.width = mapCanvas.width;
    composedCanvas.height = mapCanvas.height + headerHeight;

    const ctx = composedCanvas.getContext("2d");
    if (!ctx) {
      alert("PDF 생성에 실패했어요.");
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);

    const sidePadding = Math.round(composedCanvas.width * 0.03);
    ctx.fillStyle = "#103024";
    ctx.font = `700 ${Math.round(composedCanvas.width * 0.05)}px "Noto Sans KR", sans-serif`;
    ctx.fillText("우리 동네 탐험대", sidePadding, Math.round(headerHeight * 0.38));

    ctx.font = `600 ${Math.round(composedCanvas.width * 0.037)}px "Noto Sans KR", sans-serif`;
    ctx.fillText("안전하고 살기 좋은 고장 만들기", sidePadding, Math.round(headerHeight * 0.68));

    ctx.fillStyle = "#45695a";
    ctx.font = `500 ${Math.round(composedCanvas.width * 0.024)}px "Noto Sans KR", sans-serif`;
    ctx.fillText(
      `캡처 시각: ${formatDateTime(capturedAt)}`,
      sidePadding,
      Math.round(headerHeight * 0.88)
    );

    ctx.drawImage(mapCanvas, 0, headerHeight);

    const { jsPDF } = window.jspdf;
    const orientation = composedCanvas.width >= composedCanvas.height ? "l" : "p";
    const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;
    const imageRatio = composedCanvas.width / composedCanvas.height;
    let drawWidth = maxWidth;
    let drawHeight = drawWidth / imageRatio;

    if (drawHeight > maxHeight) {
      drawHeight = maxHeight;
      drawWidth = drawHeight * imageRatio;
    }

    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    const imageData = composedCanvas.toDataURL("image/png");

    pdf.addImage(imageData, "PNG", x, y, drawWidth, drawHeight, undefined, "FAST");
    pdf.save(`community-map-${todayStamp()}.pdf`);
  } catch {
    alert("지도를 PDF로 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
});

map.on("popupopen", (event) => {
  const node = event.popup.getElement();
  if (!node) return;
  const editBtn = node.querySelector("[data-action='edit']");
  const deleteBtn = node.querySelector("[data-action='delete']");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const target = entries.find((entry) => entry.id === editBtn.dataset.id);
      if (!target) return;
      map.closePopup();
      openEditForm(target);
    });
  }
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const targetId = deleteBtn.dataset.id;
      if (!targetId) return;
      const ok = window.confirm("이 장소 기록을 삭제할까요?");
      if (!ok) return;
      const nextEntries = entries.filter((entry) => entry.id !== targetId);
      if (!saveEntries(nextEntries)) return;
      entries = nextEntries;
      renderMarkers();
      renderDashboard();
      closeForm();
    });
  }
});

function buildFilterButtons() {
  const config = [{ key: "all", label: "전체" }].concat(
    Object.entries(categories).map(([key, value]) => ({ key, label: value.label }))
  );

  config.forEach(({ key, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn" + (key === activeFilter ? " active" : "");
    btn.textContent = label;
    btn.dataset.filter = key;
    btn.setAttribute("aria-pressed", String(key === activeFilter));
    btn.addEventListener("click", () => {
      activeFilter = key;
      [...filterWrap.querySelectorAll("button")].forEach((node) => {
        node.classList.toggle("active", node.dataset.filter === key);
        node.setAttribute("aria-pressed", String(node.dataset.filter === key));
      });
      renderMarkers();
    });
    filterWrap.appendChild(btn);
  });
}

function renderMarkers() {
  markerLayer.clearLayers();

  const visibleEntries =
    activeFilter === "all"
      ? entries
      : entries.filter((entry) => entry.category === activeFilter);

  visibleEntries.forEach((entry) => {
    const category = categories[entry.category];
    if (!category) return;

    const icon = L.divIcon({
      className: "",
      html: `<div class="custom-pin" style="background:${category.color}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const marker = L.marker([entry.lat, entry.lng], { icon }).addTo(markerLayer);
    marker.bindPopup(`
      <strong>${escapeHtml(entry.placeName)}</strong><br>
      <span>${category.label}</span><br>
      <small>${escapeHtml(entry.note || "설명 없음")}</small>
      <div class="popup-actions">
        <button type="button" class="popup-btn" data-action="edit" data-id="${entry.id}">수정</button>
        <button type="button" class="popup-btn delete" data-action="delete" data-id="${entry.id}">삭제</button>
      </div>
    `);
  });
}

function renderDashboard() {
  totalCount.textContent = `전체 기록 ${entries.length}개`;
  statsList.innerHTML = "";

  const total = entries.length || 1;
  Object.entries(categories).forEach(([key, category]) => {
    const count = entries.filter((entry) => entry.category === key).length;
    const ratio = Math.round((count / total) * 100);
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `
      <strong>${category.label}: ${count}개 (${ratio}%)</strong>
      <div class="bar-track">
        <div class="bar-fill" style="width:${ratio}%; background:${category.color};"></div>
      </div>
    `;
    statsList.appendChild(row);
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

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    alert("기록을 저장하지 못했어요. 브라우저 저장 공간이나 개인정보 보호 설정을 확인해 주세요.");
    return false;
  }
}

function revokeObjectUrlLater(url) {
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function syncDashboardButtonState() {
  toggleDashboardBtn.setAttribute(
    "aria-expanded",
    String(!dashboardPanel.classList.contains("hidden"))
  );
}

function openCreateForm(latlng) {
  selectedLatLng = latlng;
  editingEntryId = "";
  form.reset();
  entryIdInput.value = "";
  formTitle.textContent = "장소 기록하기";
  submitBtn.textContent = "저장";
  formPanel.classList.remove("hidden");
  document.getElementById("placeName").focus();
}

function openEditForm(entry) {
  selectedLatLng = { lat: entry.lat, lng: entry.lng };
  editingEntryId = entry.id;
  entryIdInput.value = entry.id;
  formTitle.textContent = "장소 수정하기";
  submitBtn.textContent = "수정 저장";
  document.getElementById("placeName").value = entry.placeName;
  document.getElementById("category").value = entry.category;
  document.getElementById("note").value = entry.note || "";
  formPanel.classList.remove("hidden");
  document.getElementById("placeName").focus();
}

function closeForm() {
  formPanel.classList.add("hidden");
  selectedLatLng = null;
  editingEntryId = "";
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function todayStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
