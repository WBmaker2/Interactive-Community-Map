import { CATEGORIES, CATEGORY_BY_KEY, getCategoryLabel } from "./config.js";
import { buildCsv, downloadCsv, downloadJson, exportImage, exportPdf } from "./exporters.js";
import { createCommunityMap } from "./map-view.js";
import {
  createEntryId,
  exportAppJson,
  importAppJson,
  loadEntries,
  loadSession,
  saveEntries,
  saveSession,
} from "./storage.js";

export function initApp({ windowObj = window, documentObj = document, L = windowObj.L } = {}) {
  const refs = getRefs(documentObj);
  let entries = loadEntries(windowObj.localStorage);
  let session = loadSession(windowObj.localStorage);
  let selectedLatLng = null;
  let activeFilter = "all";
  let editingEntryId = "";
  let pendingImport = null;

  renderCategoryOptions(refs.categorySelect);
  renderLegend(refs.legendList);
  renderFilterButtons(refs.filterWrap, activeFilter, (filter) => {
    activeFilter = filter;
    mapView.renderMarkers(entries, activeFilter);
  });
  applySessionToInputs(session, refs);

  const mapView = createCommunityMap({
    L,
    onCreate: openCreateForm,
    onEdit: openEditFormById,
    onDelete: deleteEntryById,
  });

  refs.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedLatLng) return;

    const data = new windowObj.FormData(refs.form);
    const category = String(data.get("category") || "");
    const placeName = String(data.get("placeName") || "").trim();
    const note = String(data.get("note") || "").trim();

    if (!placeName || !CATEGORY_BY_KEY[category]) return;

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
            id: createEntryId(windowObj.crypto),
            placeName,
            category,
            note,
            lat: selectedLatLng.lat,
            lng: selectedLatLng.lng,
            createdAt: new Date().toISOString(),
          },
        ];

    if (!persistEntries(nextEntries)) return;
    entries = nextEntries;
    renderAll();
    closeForm();
  });

  refs.cancelBtn.addEventListener("click", closeForm);

  refs.myLocationBtn.addEventListener("click", () => {
    if (!windowObj.navigator.geolocation) {
      windowObj.alert("이 기기에서는 위치 정보를 사용할 수 없어요.");
      return;
    }

    windowObj.navigator.geolocation.getCurrentPosition(
      (position) => {
        const latlng = [position.coords.latitude, position.coords.longitude];
        mapView.setView(latlng, 17);
        mapView.drawUserLocation(latlng, position.coords.accuracy);
      },
      () => {
        windowObj.alert("위치 정보를 가져오지 못했어요. 위치 권한을 확인해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  refs.toggleDashboardBtn.addEventListener("click", () => {
    refs.dashboardPanel.classList.toggle("hidden");
    syncDashboardButtonState(refs);
  });

  refs.exportCsvBtn.addEventListener("click", () => {
    downloadCsv(entries, { session, windowObj, documentObj });
  });

  refs.exportImageBtn.addEventListener("click", () => {
    exportImage(refs.mainView, { windowObj, documentObj });
  });

  refs.exportPdfBtn.addEventListener("click", () => {
    exportPdf(refs.mainView, { windowObj, documentObj, session });
  });

  refs.exportJsonBtn.addEventListener("click", () => {
    downloadJson(exportAppJson(entries, session), { documentObj });
  });

  refs.importJsonBtn.addEventListener("click", () => {
    refs.importJsonInput.click();
  });

  refs.importJsonInput.addEventListener("change", async () => {
    const file = refs.importJsonInput.files?.[0];
    refs.importJsonInput.value = "";
    if (!file) return;

    try {
      pendingImport = importAppJson(await file.text(), {
        idFactory: () => createEntryId(windowObj.crypto),
      });
      showImportPreview(pendingImport);
    } catch {
      windowObj.alert("JSON 파일을 읽지 못했어요. 내보낸 지도 JSON인지 확인해 주세요.");
    }
  });

  refs.replaceImportBtn.addEventListener("click", () => {
    if (!pendingImport) return;

    if (!persistEntries(pendingImport.entries)) return;
    if (!persistSession(pendingImport.session)) return;
    entries = pendingImport.entries;
    session = pendingImport.session;
    applySessionToInputs(session, refs);
    hideImportPreview();
    renderAll();
  });

  refs.mergeImportBtn.addEventListener("click", () => {
    if (!pendingImport) return;

    const nextEntries = mergeImportedEntries(entries, pendingImport.entries, () =>
      createEntryId(windowObj.crypto)
    );
    const nextSession = mergeSession(session, pendingImport.session);
    if (!persistEntries(nextEntries)) return;
    if (!persistSession(nextSession)) return;
    entries = nextEntries;
    session = nextSession;
    applySessionToInputs(session, refs);
    hideImportPreview();
    renderAll();
  });

  refs.cancelImportBtn.addEventListener("click", hideImportPreview);

  refs.clearAllBtn.addEventListener("click", () => {
    const hasSession = session.className || session.groupName;
    if (!entries.length && !hasSession) {
      windowObj.alert("삭제할 기록이 없어요.");
      return;
    }

    const ok = windowObj.confirm("모든 장소 기록과 학급/모둠 정보를 삭제할까요?");
    if (!ok) return;

    if (!persistEntries([])) return;
    if (!persistSession({ className: "", groupName: "" })) return;
    entries = [];
    session = { className: "", groupName: "" };
    applySessionToInputs(session, refs);
    closeForm();
    renderAll();
  });

  [refs.classNameInput, refs.groupNameInput].forEach((input) => {
    input.addEventListener("input", () => {
      session = {
        className: refs.classNameInput.value.trim(),
        groupName: refs.groupNameInput.value.trim(),
      };
      persistSession(session);
    });
  });

  documentObj.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeForm();
      hideImportPreview();
    }
  });

  renderAll();
  syncDashboardButtonState(refs);

  function openCreateForm(latlng) {
    selectedLatLng = latlng;
    editingEntryId = "";
    refs.form.reset();
    refs.entryIdInput.value = "";
    refs.formTitle.textContent = "장소 기록하기";
    refs.submitBtn.textContent = "저장";
    refs.formPanel.classList.remove("hidden");
    refs.placeNameInput.focus();
  }

  function openEditFormById(id) {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) return;

    selectedLatLng = { lat: entry.lat, lng: entry.lng };
    editingEntryId = entry.id;
    refs.entryIdInput.value = entry.id;
    refs.formTitle.textContent = "장소 수정하기";
    refs.submitBtn.textContent = "수정 저장";
    refs.placeNameInput.value = entry.placeName;
    refs.categorySelect.value = entry.category;
    refs.noteInput.value = entry.note || "";
    refs.formPanel.classList.remove("hidden");
    refs.placeNameInput.focus();
  }

  function deleteEntryById(id) {
    const ok = windowObj.confirm("이 장소 기록을 삭제할까요?");
    if (!ok) return;

    const nextEntries = entries.filter((entry) => entry.id !== id);
    if (!persistEntries(nextEntries)) return;
    entries = nextEntries;
    closeForm();
    renderAll();
  }

  function closeForm() {
    refs.formPanel.classList.add("hidden");
    selectedLatLng = null;
    editingEntryId = "";
  }

  function showImportPreview(imported) {
    refs.importPreviewSummary.textContent = buildImportPreviewText(imported, entries.length);
    refs.importPreviewPanel.classList.remove("hidden");
    refs.mergeImportBtn.focus();
  }

  function hideImportPreview() {
    refs.importPreviewPanel.classList.add("hidden");
    pendingImport = null;
  }

  function persistEntries(nextEntries) {
    if (saveEntries(nextEntries, windowObj.localStorage)) return true;
    windowObj.alert("기록을 저장하지 못했어요. 브라우저 저장 공간이나 개인정보 보호 설정을 확인해 주세요.");
    return false;
  }

  function persistSession(nextSession) {
    if (saveSession(nextSession, windowObj.localStorage)) return true;
    windowObj.alert("학급/모둠 정보를 저장하지 못했어요.");
    return false;
  }

  function renderAll() {
    mapView.renderMarkers(entries, activeFilter);
    renderDashboard(entries, refs);
  }
}

export function renderCategoryOptions(categorySelect) {
  categorySelect.replaceChildren(
    ...CATEGORIES.map((category) => {
      const option = document.createElement("option");
      option.value = category.key;
      option.textContent = getCategoryLabel(category);
      return option;
    })
  );
}

export function renderLegend(legendList) {
  legendList.replaceChildren(
    ...CATEGORIES.map((category) => {
      const item = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = category.color;
      item.append(dot, ` ${getCategoryLabel(category)}`);
      return item;
    })
  );
}

export function renderFilterButtons(filterWrap, activeFilter, onChange) {
  const buttons = [{ key: "all", label: "전체" }].concat(
    CATEGORIES.map((category) => ({ key: category.key, label: getCategoryLabel(category) }))
  );

  filterWrap.replaceChildren(
    ...buttons.map((filter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn" + (filter.key === activeFilter ? " active" : "");
      button.textContent = filter.label;
      button.dataset.filter = filter.key;
      button.setAttribute("aria-pressed", String(filter.key === activeFilter));
      button.addEventListener("click", () => {
        [...filterWrap.querySelectorAll("button")].forEach((node) => {
          const isActive = node.dataset.filter === filter.key;
          node.classList.toggle("active", isActive);
          node.setAttribute("aria-pressed", String(isActive));
        });
        onChange(filter.key);
      });
      return button;
    })
  );
}

function getRefs(documentObj) {
  return {
    mainView: documentObj.querySelector("main"),
    formPanel: documentObj.getElementById("entryPanel"),
    form: documentObj.getElementById("entryForm"),
    cancelBtn: documentObj.getElementById("cancelBtn"),
    formTitle: documentObj.getElementById("formTitle"),
    submitBtn: documentObj.getElementById("submitBtn"),
    entryIdInput: documentObj.getElementById("entryId"),
    placeNameInput: documentObj.getElementById("placeName"),
    categorySelect: documentObj.getElementById("category"),
    noteInput: documentObj.getElementById("note"),
    filterWrap: documentObj.getElementById("filterWrap"),
    legendList: documentObj.getElementById("legendList"),
    myLocationBtn: documentObj.getElementById("myLocationBtn"),
    exportCsvBtn: documentObj.getElementById("exportCsvBtn"),
    exportImageBtn: documentObj.getElementById("exportImageBtn"),
    exportPdfBtn: documentObj.getElementById("exportPdfBtn"),
    exportJsonBtn: documentObj.getElementById("exportJsonBtn"),
    importJsonBtn: documentObj.getElementById("importJsonBtn"),
    importJsonInput: documentObj.getElementById("importJsonInput"),
    clearAllBtn: documentObj.getElementById("clearAllBtn"),
    toggleDashboardBtn: documentObj.getElementById("toggleDashboardBtn"),
    dashboardPanel: documentObj.getElementById("dashboardPanel"),
    totalCount: documentObj.getElementById("totalCount"),
    statsList: documentObj.getElementById("statsList"),
    classNameInput: documentObj.getElementById("className"),
    groupNameInput: documentObj.getElementById("groupName"),
    importPreviewPanel: documentObj.getElementById("importPreviewPanel"),
    importPreviewSummary: documentObj.getElementById("importPreviewSummary"),
    replaceImportBtn: documentObj.getElementById("replaceImportBtn"),
    mergeImportBtn: documentObj.getElementById("mergeImportBtn"),
    cancelImportBtn: documentObj.getElementById("cancelImportBtn"),
  };
}

function applySessionToInputs(session, refs) {
  refs.classNameInput.value = session.className;
  refs.groupNameInput.value = session.groupName;
}

function renderDashboard(entries, refs) {
  refs.totalCount.textContent = `전체 기록 ${entries.length}개`;
  refs.statsList.replaceChildren();

  const total = entries.length || 1;
  CATEGORIES.forEach((category) => {
    const count = entries.filter((entry) => entry.category === category.key).length;
    const ratio = Math.round((count / total) * 100);
    const row = document.createElement("div");
    const label = document.createElement("strong");
    const track = document.createElement("div");
    const fill = document.createElement("div");

    row.className = "stat-row";
    label.textContent = `${getCategoryLabel(category)}: ${count}개 (${ratio}%)`;
    track.className = "bar-track";
    fill.className = "bar-fill";
    fill.style.width = `${ratio}%`;
    fill.style.background = category.color;

    track.append(fill);
    row.append(label, track);
    refs.statsList.append(row);
  });
}

function syncDashboardButtonState(refs) {
  refs.toggleDashboardBtn.setAttribute(
    "aria-expanded",
    String(!refs.dashboardPanel.classList.contains("hidden"))
  );
}

export { buildCsv };

export function mergeImportedEntries(currentEntries, importedEntries, idFactory = createEntryId) {
  const usedIds = new Set(currentEntries.map((entry) => entry.id));
  const mergedImports = importedEntries.map((entry, index) => {
    if (entry.id && !usedIds.has(entry.id)) {
      usedIds.add(entry.id);
      return entry;
    }

    let nextId = idFactory();
    if (!nextId || usedIds.has(nextId)) {
      nextId = `imported-${Date.now().toString(36)}-${index}`;
    }
    usedIds.add(nextId);
    return { ...entry, id: nextId };
  });

  return [...currentEntries, ...mergedImports];
}

function mergeSession(currentSession, importedSession) {
  return {
    className: importedSession.className || currentSession.className,
    groupName: importedSession.groupName || currentSession.groupName,
  };
}

function buildImportPreviewText(imported, currentCount) {
  const className = imported.session.className || "없음";
  const groupName = imported.session.groupName || "없음";
  return `가져올 기록 ${imported.entries.length}개 · 학급 ${className} · 모둠 ${groupName}. 현재 기록 ${currentCount}개를 전체 교체하거나, 기존 기록 뒤에 추가할 수 있어요.`;
}
