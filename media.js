// Files in the project that aren't text: sample files a question provides (q.samples,
// e.g. test photos for an upload exercise) and files the student's own PHP saves into a
// project folder (a photo moved into uploads/ by move_uploaded_file(), a log written
// with file_put_contents()...).
//
// They live in their own list, not in `docs` (which only holds CodeMirror text
// documents), and show up in the file explorer next to the text files. Clicking one
// opens a viewer in place of the code editor: an image is shown, a text file previewed,
// and every file can be downloaded - which is how a student gets a sample photo onto
// their computer to upload it through the page's own form.
//
// Before every run each file is written into the PHP engine's filesystem, so the
// student's code can find it, the same as files on a real server's disk. After a Run or
// Debug, the project folders are scanned: a new or changed file is picked up as a saved
// file, and one the page deleted (unlink()) is dropped. Saved files are also kept in
// sessionStorage when they fit, so reloading the tab keeps them, like the code itself.
//
// Sample images are drawn on a canvas when the question opens rather than stored in the
// repository, then padded to an exact byte size so their file size is the same on every
// computer - which matters when the exercise has a size limit.

let media = new Map(); // path -> { bytes: Uint8Array, type, kind: "sample" | "saved" }
let mediaCur = ""; // the file shown in the viewer, or "" when the code editor is showing
let mediaDeleted = new Set(); // saved files the student deleted - removed from the engine next run
let mediaUrl = "";

const MEDIA_TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", pdf: "application/pdf", txt: "text/plain", csv: "text/csv", log: "text/plain",
  json: "application/json", html: "text/html", md: "text/markdown",
};
const mediaTypeOf = (n) => MEDIA_TYPES[n.split(".").pop().toLowerCase()] || "application/octet-stream";
const DOWNLOAD_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';

function mediaFmtSize(n) {
  return n < 1024 ? n + " bytes" : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB" : (n / 1048576).toFixed(2) + " MB";
}
function toB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---------- sample files ----------
// One small, recognisable picture per sample: a sky, the sea, and one subject.
function drawSampleScene(ctx, s) {
  const w = s.width, h = s.height, u = Math.min(w, h) / 100;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  const palettes = {
    sunset: ["#ff9a5a", "#ffd39a", "#2c5d7c"], forest: ["#9fd3e8", "#e4f4ea", "#1f4d3a"],
    lighthouse: ["#7ec3e6", "#d9f0fb", "#1d4f6b"], sky: ["#4f8fcf", "#bfe3f7", "#2b5f84"], sea: ["#123a5c", "#5a8fb5", "#0b2a44"],
  };
  const [top, mid, sea] = palettes[s.scene] || palettes.sky;
  sky.addColorStop(0, top);
  sky.addColorStop(0.62, mid);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const horizon = h * 0.64;
  ctx.fillStyle = s.scene === "sunset" ? "#fff2c4" : "#fffbe6"; // sun
  ctx.beginPath();
  ctx.arc(w * 0.72, horizon - 14 * u, 11 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = Math.max(1, u * 0.6);
  for (let y = horizon + 6 * u; y < h; y += 7 * u) {
    ctx.beginPath();
    ctx.moveTo(w * 0.1, y);
    ctx.lineTo(w * 0.9, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#24453a"; // island
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.quadraticCurveTo(w * 0.22, horizon - 18 * u, w * 0.45, horizon);
  ctx.fill();
  if (s.scene === "forest" || s.scene === "sunset") {
    ctx.fillStyle = "#183b2c";
    for (let i = 0; i < 5; i++) {
      const x = w * (0.05 + i * 0.075), th = (22 + (i % 3) * 7) * u;
      ctx.beginPath();
      ctx.moveTo(x, horizon - 4 * u - th);
      ctx.lineTo(x - 5 * u, horizon - 2 * u);
      ctx.lineTo(x + 5 * u, horizon - 2 * u);
      ctx.fill();
    }
  }
  if (s.scene === "lighthouse") {
    const x = w * 0.3, b = horizon - 6 * u, th = 40 * u;
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(x - 4 * u, b - th, 8 * u, th);
    ctx.fillStyle = "#c8452f";
    for (let y = b - th + 8 * u; y < b; y += 14 * u) ctx.fillRect(x - 4 * u, y, 8 * u, 5 * u);
    ctx.fillStyle = "#ffe27a";
    ctx.fillRect(x - 3 * u, b - th - 6 * u, 6 * u, 6 * u);
  }
  if (s.scene === "sea") {
    ctx.fillStyle = "#0a1f30"; // a whale's tail
    const x = w * 0.5, y = horizon + 12 * u;
    ctx.beginPath();
    ctx.moveTo(x, y + 10 * u);
    ctx.quadraticCurveTo(x - 4 * u, y, x - 14 * u, y - 6 * u);
    ctx.quadraticCurveTo(x, y - 2 * u, x + 14 * u, y - 6 * u);
    ctx.quadraticCurveTo(x + 4 * u, y, x, y + 10 * u);
    ctx.fill();
  }
  if (s.scene === "sky") {
    ctx.strokeStyle = "#1c2b38"; // an eagle, as a soaring "m"
    ctx.lineWidth = 2.2 * u;
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.3);
    ctx.quadraticCurveTo(w * 0.47, h * 0.24, w * 0.5, h * 0.31);
    ctx.quadraticCurveTo(w * 0.53, h * 0.24, w * 0.58, h * 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 " + Math.round(5 * u) + "px system-ui, sans-serif";
  ctx.fillText("Sample · " + w + " × " + h, 4 * u, h - 5 * u);
}
function samplePdf(title) {
  const text = "BT /F1 22 Tf 72 700 Td (" + title.replace(/[()\\]/g, "") + ") Tj ET";
  return (
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
    "4 0 obj<</Length " + text.length + ">>stream\n" + text + "\nendstream endobj\n" +
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
  );
}
// s: { name, width?, height?, scene?, size?, title? }. Padding goes after the end of the
// image/PDF data, where viewers and getimagesize() never look.
async function makeSample(s) {
  let bytes;
  if (/\.pdf$/i.test(s.name)) bytes = new TextEncoder().encode(samplePdf(s.title || baseOf(s.name)));
  else if (/\.(txt|csv|log|md|json)$/i.test(s.name)) bytes = new TextEncoder().encode(s.text || "");
  else {
    const c = document.createElement("canvas");
    c.width = s.width;
    c.height = s.height;
    drawSampleScene(c.getContext("2d"), s);
    const blob = await new Promise((r) => c.toBlob(r, mediaTypeOf(s.name), 0.85));
    bytes = new Uint8Array(await blob.arrayBuffer());
  }
  if (s.size && bytes.length < s.size) {
    const out = new Uint8Array(s.size);
    out.set(bytes);
    bytes = out;
  }
  return bytes;
}

// ---------- per-question list ----------
function saveMediaIndex() {
  const saved = [...media].filter(([, m]) => m.kind === "saved").map(([n]) => n);
  store("media:" + key, saved.length ? JSON.stringify(saved) : undefined);
}
function saveMediaFile(n) {
  const m = media.get(n);
  // Best effort: sessionStorage holds about 5 MB per site, so a big file may not fit -
  // it then lasts until the tab reloads instead.
  if (m && m.bytes.length <= 1.5 * 1048576) store("mf:" + key + ":" + n, toB64(m.bytes));
}
async function loadMedia() {
  const myKey = key;
  media = new Map();
  mediaDeleted = new Set();
  hideMedia();
  try {
    for (const n of JSON.parse(load("media:" + key) || "[]")) {
      const b = load("mf:" + key + ":" + n);
      if (b) media.set(n, { bytes: fromB64(b), type: mediaTypeOf(n), kind: "saved" });
    }
  } catch (e) {}
  const samples = QUESTIONS[key].samples || [];
  for (const s of samples) {
    let bytes;
    try {
      bytes = await makeSample(s);
    } catch (e) {
      continue;
    }
    if (key !== myKey) return; // the student switched questions while these were drawing
    media.set(s.name, { bytes, type: mediaTypeOf(s.name), kind: "sample" });
    ancestors(s.name).forEach((a) => open.add(a));
  }
  if (samples.length) renderTabs();
}
const mediaIn = (dir) => [...media.keys()].filter((n) => dirOf(n) === dir).sort((a, b) => a.localeCompare(b));

// ---------- the PHP engine's copy ----------
async function writeMedia(engine) {
  for (const n of mediaDeleted) {
    try {
      const a = await engine.analyzePath("/" + n);
      if (a && a.exists) await engine.unlink("/" + n);
    } catch (e) {}
  }
  mediaDeleted.clear();
  for (const [n, m] of media) {
    for (const d of ancestors(n)) await ensureDir(engine, "/" + d);
    await engine.writeFile("/" + n, m.bytes);
  }
}
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
// After a Run/Debug: pick up files the page saved in a project folder, and forget saved
// files the page deleted. Only project folders are scanned - never the engine's own.
async function collectSavedFiles(engine) {
  const text = new Set(allNames()),
    seen = new Set(),
    scanned = new Set();
  let changed = false;
  for (const d of allFolders()) {
    let entries;
    try {
      const a = await engine.analyzePath("/" + d);
      if (!a || !a.exists) continue;
      entries = await engine.readdir("/" + d);
    } catch (e) {
      continue;
    }
    scanned.add(d);
    for (const e of entries) {
      if (e === "." || e === "..") continue;
      const n = d + "/" + e;
      if (text.has(n)) continue;
      let a;
      try {
        a = await engine.analyzePath("/" + n);
      } catch (x) {
        continue;
      }
      if (!a || !a.exists || (a.object && a.object.isFolder)) continue;
      seen.add(n);
      const m = media.get(n);
      if (m && m.kind === "sample") continue;
      let bytes;
      try {
        bytes = new Uint8Array(await engine.readFile("/" + n));
      } catch (x) {
        continue;
      }
      if (bytes.length > 8 * 1048576) continue;
      if (!m || !sameBytes(m.bytes, bytes)) {
        media.set(n, { bytes, type: mediaTypeOf(n), kind: "saved" });
        saveMediaFile(n);
        ancestors(n).forEach((x) => open.add(x));
        changed = true;
      }
    }
  }
  for (const [n, m] of [...media]) {
    if (m.kind === "saved" && scanned.has(dirOf(n)) && !seen.has(n)) {
      media.delete(n);
      store("mf:" + key + ":" + n);
      changed = true;
    }
  }
  if (changed) {
    saveMediaIndex();
    renderTabs();
    if (mediaCur) media.has(mediaCur) ? showMedia(mediaCur) : showFile(cur);
  }
}

// ---------- explorer rows and the viewer ----------
function mediaRow(n, depth) {
  const m = media.get(n),
    row = document.createElement("div"),
    b = document.createElement("button");
  row.className = "frow" + (n === mediaCur ? " cur" : "");
  b.className = "fitem" + (n === mediaCur ? " on" : "");
  b.style.paddingLeft = 14 + depth * 14 + "px";
  b.innerHTML = icon(n) + "<span>" + esc(baseOf(n)) + "</span>";
  b.title = m.kind === "sample" ? "Sample file - click to view or download" : "Saved by your PHP code - click to view";
  b.onclick = () => showMedia(n);
  row.appendChild(b);
  const acts = document.createElement("div");
  acts.className = "acts";
  acts.appendChild(actBtn("", "Download " + n, DOWNLOAD_SVG, () => downloadMedia(n)));
  if (m.kind === "saved") acts.appendChild(actBtn("del", "Delete " + n, TRASH, () => ask("Delete " + n + "?", "This removes the file your page saved. Your code isn't changed.", "Yes, delete", () => deleteMedia(n))));
  row.appendChild(acts);
  return row;
}
function downloadMedia(n) {
  const m = media.get(n);
  if (!m) return;
  const url = URL.createObjectURL(new Blob([m.bytes], { type: m.type })),
    a = document.createElement("a");
  a.href = url;
  a.download = baseOf(n);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function deleteMedia(n) {
  media.delete(n);
  mediaDeleted.add(n);
  store("mf:" + key + ":" + n);
  saveMediaIndex();
  if (mediaCur === n) showFile(cur);
  else renderTabs();
}
function hideMedia() {
  mediaCur = "";
  const v = $("mediaView");
  if (v) v.hidden = true;
  if (typeof cm !== "undefined") cm.getWrapperElement().hidden = false;
  if (mediaUrl) {
    URL.revokeObjectURL(mediaUrl);
    mediaUrl = "";
  }
}
function showMedia(n) {
  const m = media.get(n);
  if (!m) return;
  hideMedia();
  mediaCur = n;
  cm.getWrapperElement().hidden = true;
  $("format").disabled = true;
  $("formatMsg").hidden = true;
  const v = $("mediaView");
  v.hidden = false;
  mediaUrl = URL.createObjectURL(new Blob([m.bytes], { type: m.type }));
  const where = m.kind === "sample" ? "Sample file for this exercise" : "Saved by your PHP code";
  let body;
  if (m.type.startsWith("image/")) body = '<div class="mediaImg"><img id="mediaImg" alt="' + esc(baseOf(n)) + '" src="' + mediaUrl + '"></div>';
  else if (m.type.startsWith("text/") || m.type === "application/json") {
    const t = new TextDecoder().decode(m.bytes.subarray(0, 20000));
    body = '<pre class="mediaText">' + esc(t) + (m.bytes.length > 20000 ? "\n…" : "") + "</pre>";
  } else body = '<p class="testNote">' + (m.type === "application/pdf" ? "A PDF document." : "A file the editor can't preview.") + " Download it to open it.</p>";
  v.innerHTML =
    '<div class="mediaHead"><div><strong>' + esc(n) + '</strong><div class="mediaMeta"><span id="mediaDims"></span>' + esc(mediaFmtSize(m.bytes.length)) + " · " + esc(m.type) + " · " + where + "</div></div>" +
    '<div class="mediaBtns"><button type="button" id="mediaDownload">' + DOWNLOAD_SVG + " Download</button>" +
    (m.kind === "saved" ? '<button type="button" id="mediaDelete">' + TRASH + " Delete</button>" : "") + "</div></div>" + body +
    (m.kind === "sample" ? '<p class="testNote">To try it in your page: Download it, then choose it in your page\'s upload form in Preview.</p>' : "");
  $("mediaDownload").onclick = () => downloadMedia(n);
  if ($("mediaDelete")) $("mediaDelete").onclick = () => ask("Delete " + n + "?", "This removes the file your page saved. Your code isn't changed.", "Yes, delete", () => deleteMedia(n));
  const img = $("mediaImg");
  if (img) img.onload = () => { $("mediaDims").textContent = img.naturalWidth + " × " + img.naturalHeight + " px · "; };
  renderTabs();
}
