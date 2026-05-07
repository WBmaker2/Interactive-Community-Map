import { CATEGORY_BY_KEY, getCategoryLabel } from "./config.js";

export function neutralizeCsvCell(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
}

export function buildCsv(entries, options = {}) {
  const categories = options.categories ?? CATEGORY_BY_KEY;
  const session = options.session ?? {};
  const header = ["학급", "모둠", "장소 이름", "카테고리", "특징", "위도", "경도", "기록일"];
  const rows = entries.map((entry) => {
    const category = categories[entry.category];

    return [
      session.className ?? "",
      session.groupName ?? "",
      entry.placeName,
      category ? getCategoryLabel(category) : entry.category,
      entry.note ?? "",
      entry.lat,
      entry.lng,
      formatDate(entry.createdAt),
    ];
  });

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function downloadCsv(entries, options = {}) {
  if (!entries.length) {
    options.windowObj?.alert?.("내보낼 데이터가 없어요.");
    return false;
  }

  return downloadTextFile({
    content: `\uFEFF${buildCsv(entries, options)}`,
    filename: `community-map-${todayStamp()}.csv`,
    type: "text/csv;charset=utf-8;",
    documentObj: options.documentObj,
  });
}

export function downloadJson(json, options = {}) {
  return downloadTextFile({
    content: json,
    filename: `community-map-${todayStamp()}.json`,
    type: "application/json;charset=utf-8;",
    documentObj: options.documentObj,
  });
}

export async function exportImage(mainView, options = {}) {
  const windowObj = options.windowObj ?? window;
  const documentObj = options.documentObj ?? document;

  if (!windowObj.html2canvas) {
    windowObj.alert("이미지 캡처 라이브러리를 불러오지 못했어요.");
    return false;
  }

  try {
    const canvas = await windowObj.html2canvas(mainView, {
      useCORS: true,
      allowTaint: false,
      scale: Math.min(windowObj.devicePixelRatio || 1, 2),
      logging: false,
      backgroundColor: "#ffffff",
    });

    await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Missing canvas blob"));
          return;
        }

        downloadBlob(blob, `community-map-${todayStamp()}.png`, documentObj);
        resolve();
      }, "image/png");
    });
    return true;
  } catch {
    windowObj.alert("지도를 이미지로 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    return false;
  }
}

export async function exportPdf(mainView, options = {}) {
  const windowObj = options.windowObj ?? window;
  const documentObj = options.documentObj ?? document;
  const session = options.session ?? {};

  if (!windowObj.html2canvas) {
    windowObj.alert("PDF 생성을 위한 캡처 라이브러리를 불러오지 못했어요.");
    return false;
  }
  if (!windowObj.jspdf?.jsPDF) {
    windowObj.alert("PDF 라이브러리를 불러오지 못했어요.");
    return false;
  }

  try {
    const capturedAt = new Date();
    const mapCanvas = await windowObj.html2canvas(mainView, {
      useCORS: true,
      allowTaint: false,
      scale: Math.min(windowObj.devicePixelRatio || 1, 2),
      logging: false,
      backgroundColor: "#ffffff",
    });

    const headerHeight = Math.round(mapCanvas.width * 0.24);
    const composedCanvas = documentObj.createElement("canvas");
    composedCanvas.width = mapCanvas.width;
    composedCanvas.height = mapCanvas.height + headerHeight;

    const ctx = composedCanvas.getContext("2d");
    if (!ctx) {
      windowObj.alert("PDF 생성에 실패했어요.");
      return false;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);

    const sidePadding = Math.round(composedCanvas.width * 0.03);
    ctx.fillStyle = "#103024";
    ctx.font = `700 ${Math.round(composedCanvas.width * 0.05)}px "Noto Sans KR", sans-serif`;
    ctx.fillText("우리 동네 탐험대", sidePadding, Math.round(headerHeight * 0.32));

    ctx.font = `600 ${Math.round(composedCanvas.width * 0.032)}px "Noto Sans KR", sans-serif`;
    ctx.fillText(buildSessionLine(session), sidePadding, Math.round(headerHeight * 0.58));

    ctx.fillStyle = "#45695a";
    ctx.font = `500 ${Math.round(composedCanvas.width * 0.024)}px "Noto Sans KR", sans-serif`;
    ctx.fillText(
      `캡처 시각: ${formatDateTime(capturedAt)}`,
      sidePadding,
      Math.round(headerHeight * 0.82)
    );

    ctx.drawImage(mapCanvas, 0, headerHeight);

    const { jsPDF } = windowObj.jspdf;
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
    return true;
  } catch {
    windowObj.alert("지도를 PDF로 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    return false;
  }
}

export function downloadTextFile({ content, filename, type, documentObj = document }) {
  const blob = new Blob([content], { type });
  downloadBlob(blob, filename, documentObj);
  return true;
}

export function revokeObjectUrlLater(url) {
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function todayStamp(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function escapeCsvCell(value) {
  return `"${neutralizeCsvCell(value).replaceAll('"', '""')}"`;
}

function downloadBlob(blob, filename, documentObj) {
  const url = URL.createObjectURL(blob);
  const link = documentObj.createElement("a");
  link.href = url;
  link.download = filename;
  documentObj.body.appendChild(link);
  link.click();
  link.remove();
  revokeObjectUrlLater(url);
}

function buildSessionLine(session) {
  const parts = [session.className, session.groupName].filter(Boolean);
  return parts.length ? parts.join(" · ") : "안전하고 살기 좋은 고장 만들기";
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
