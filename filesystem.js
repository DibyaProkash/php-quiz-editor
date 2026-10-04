const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// With no ?q= at all, default to this build's first EXAM_SET entry when one is set
// (questions.js), so a per-exam build opens straight into that exam's own first question
// instead of always falling back to 'mv1a', which that build might not even include.
// hasOwn, not QUESTIONS[q]: ?q=constructor or ?q=toString would otherwise "find" an
// inherited Object method and crash loadQuestion().
let key = Object.hasOwn(QUESTIONS, params.get("q") || "")
  ? params.get("q")
  : params.get("q")
    ? "blank"
    : EXAM_SET[0] || "mv1a";
let docs = {},
  custom = [],
  folders = [],
  open = new Set(),
  selDir = "",
  renaming = null,
  newMode = "file",
  mainName = "",
  trash = [],
  cur = "",
  shown = 0,
  req = { m: "get", d: {} };

const MODES = {
  php: "application/x-httpd-php",
  css: "css",
  js: "javascript",
  html: "htmlmixed",
  json: "application/json",
  txt: "text/plain",
  md: "text/plain",
};
const ALLOWED = ["php", "css", "js", "html", "txt", "json", "md"],
  MAX_CUSTOM = 15,
  MAX_FOLDERS = 8;
const modeOf = (n) => MODES[n.split(".").pop()] || "text/plain";

const store = (k, v) => {
  try {
    v === undefined
      ? sessionStorage.removeItem(k)
      : sessionStorage.setItem(k, v);
  } catch (e) {}
};
const load = (k) => {
  try {
    return sessionStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const esc = (s) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const providedNames = () => QUESTIONS[key].files.map((f) => f.name);
const allNames = () => providedNames().concat(custom);
const metaOf = (n) =>
  QUESTIONS[key].files.find((f) => f.name === n) || {
    name: n,
    editable: true,
    custom: true,
  };
const defaultMain = () =>
  (
    QUESTIONS[key].files.find((f) => f.name.endsWith(".php")) ||
    QUESTIONS[key].files[0]
  ).name;
const blankOf = (n) => (n.endsWith(".php") ? "<?php\n\n" : "");
const baseOf = (p) => p.split("/").pop();
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const ancestors = (p) => {
  const parts = p.split("/"),
    out = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
};
const norm = (t) =>
  t
    .trim()
    .replace(/^(\.?\/)+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
function allFolders() {
  const set = new Set();
  folders.forEach((f) => ancestors(f + "/x").forEach((a) => set.add(a)));
  custom.forEach((n) => ancestors(n).forEach((a) => set.add(a)));
  return [...set].sort();
}
const saveCustom = () => {
  store("custom:" + key, custom.length ? JSON.stringify(custom) : undefined);
  store("folders:" + key, folders.length ? JSON.stringify(folders) : undefined);
};
function setMain(path, render = true) {
  mainName = path;
  store("main:" + key, path === defaultMain() ? undefined : path);
  if (render) renderTabs();
}
function showFile(name) {
  cur = name;
  selDir = dirOf(name);
  cm.swapDoc(docs[name]);
  updHist();
  cm.setOption("readOnly", metaOf(name).editable ? false : "nocursor");
  $("format").disabled = !(metaOf(name).editable && name.endsWith(".php"));
  $("formatMsg").hidden = true;
  applyFileView(name);
  renderTabs();
}
// Returns an error message, or '' when the path is fine. `ignore` = the item being renamed.
function checkPath(path, isFolder, ignore) {
  if (!path) return "Type a name first.";
  const parts = path.split("/"),
    fileSeg = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,39}$/,
    dirSeg = /^[A-Za-z0-9_-]{1,40}$/;
  if (parts.length > 4) return "Folders can go up to 3 levels deep.";
  for (let i = 0; i < parts.length; i++) {
    const isFile = !isFolder && i === parts.length - 1;
    if (!(isFile ? fileSeg : dirSeg).test(parts[i]))
      return isFile
        ? "Use letters, numbers, - or _ only (no spaces)."
        : "Folder names use letters, numbers, - or _ only.";
  }
  if (!isFolder) {
    const b = baseOf(path);
    // Case-sensitive on purpose: the rest of the app checks e.g. endsWith(".php"), so a
    // "Helper.PHP" would otherwise be accepted here but never treated as PHP.
    if (!b.includes(".") || !ALLOWED.includes(b.split(".").pop()))
      return "The name must end in .php, .css, .js, .html, .txt, .json or .md (lowercase)";
  }
  const inIgnored = (n) =>
    ignore && (n === ignore || n.startsWith(ignore + "/"));
  const files = allNames().filter((n) => !inIgnored(n)),
    dirs = allFolders().filter((d) => !inIgnored(d)),
    low = path.toLowerCase();
  if (
    files.some((n) => n.toLowerCase() === low) ||
    dirs.some((d) => d.toLowerCase() === low)
  )
    return "That name is already used.";
  if (
    ancestors(path).some((a) =>
      files.some((n) => n.toLowerCase() === a.toLowerCase()),
    )
  )
    return "A file with that name is in the way.";
  if (!ignore && !isFolder && custom.length >= MAX_CUSTOM)
    return "You can create up to " + MAX_CUSTOM + " files.";
  if (!ignore && isFolder && allFolders().length >= MAX_FOLDERS)
    return "You can create up to " + MAX_FOLDERS + " folders.";
  return "";
}
function createFile(raw) {
  const path = norm(raw),
    err = checkPath(path, false);
  if (err) return err;
  custom.push(path);
  ancestors(path).forEach((a) => open.add(a));
  saveCustom();
  docs[path] = CodeMirror.Doc(blankOf(path), modeOf(path));
  store("f:" + key + ":" + path, blankOf(path));
  showFile(path);
  cm.focus();
  return "";
}
function createFolder(raw) {
  const path = norm(raw),
    err = checkPath(path, true);
  if (err) return err;
  folders.push(path);
  ancestors(path + "/x").forEach((a) => open.add(a));
  selDir = path;
  saveCustom();
  renderTabs();
  return "";
}
function moveOne(old, path) {
  custom[custom.indexOf(old)] = path;
  const ext = (n) => n.split(".").pop().toLowerCase(),
    v = docs[old].getValue();
  docs[path] =
    ext(old) === ext(path) ? docs[old] : CodeMirror.Doc(v, modeOf(path));
  delete docs[old];
  store("f:" + key + ":" + old);
  store("f:" + key + ":" + path, v);
  if (cur === old) cur = path;
  if (mainName === old) setMain(path, false);
}
function renameFile(old, raw) {
  const path = norm(raw);
  if (path === old) return "";
  const err = checkPath(path, false, old);
  if (err) return err;
  moveOne(old, path);
  ancestors(path).forEach((a) => open.add(a));
  saveCustom();
  showFile(cur);
  return "";
}
function renameFolder(old, raw) {
  const path = norm(raw);
  if (path === old) return "";
  if (path.startsWith(old + "/"))
    return "A folder cannot be moved into itself.";
  const err = checkPath(path, true, old);
  if (err) return err;
  const swap = (p) => path + p.slice(old.length),
    inside = (p) => p === old || p.startsWith(old + "/");
  custom
    .filter((n) => n.startsWith(old + "/"))
    .forEach((n) => moveOne(n, swap(n)));
  folders = folders.map((f) => (inside(f) ? swap(f) : f));
  open = new Set([...open].map((f) => (inside(f) ? swap(f) : f)));
  ancestors(path + "/x").forEach((a) => open.add(a));
  if (inside(selDir)) selDir = swap(selDir);
  saveCustom();
  showFile(cur);
  return "";
}
function deletePath(path, isFolder) {
  const inside = (p) => p === path || p.startsWith(path + "/");
  const gone = isFolder ? custom.filter(inside) : [path];
  const entry = {
    label: path,
    files: {},
    folders: isFolder ? allFolders().filter(inside) : [],
  };
  gone.forEach((n) => {
    entry.files[n] = docs[n].getValue();
    delete docs[n];
    store("f:" + key + ":" + n);
  });
  const wasCur = gone.includes(cur);
  custom = custom.filter((n) => !gone.includes(n));
  if (isFolder) folders = folders.filter((f) => !inside(f));
  if (isFolder && inside(selDir)) selDir = dirOf(path);
  trash.push(entry);
  if (trash.length > 5) trash.shift();
  if (gone.includes(mainName)) setMain(defaultMain(), false);
  saveCustom();
  clearUndo();
  updTrash();
  showFile(wasCur ? QUESTIONS[key].files.find((f) => f.editable).name : cur);
}
function updTrash() {
  const b = $("undoDelete");
  b.hidden = !trash.length;
  if (trash.length) b.title = "Restore " + trash[trash.length - 1].label;
}
function undoDelete() {
  const e = trash.pop();
  if (!e) return;
  e.folders.forEach((f) => {
    if (!folders.includes(f)) folders.push(f);
    ancestors(f + "/x").forEach((a) => open.add(a));
  });
  const taken = (m) =>
    allNames().some((x) => x.toLowerCase() === m.toLowerCase());
  let first = "";
  for (const n0 in e.files) {
    let n = n0,
      k = 1;
    while (taken(n)) {
      n = n0.replace(/(\.[^./]*)$/, "-restored" + (k > 1 ? k : "") + "$1");
      k++;
    }
    custom.push(n);
    ancestors(n).forEach((a) => open.add(a));
    docs[n] = CodeMirror.Doc(e.files[n0], modeOf(n));
    store("f:" + key + ":" + n, e.files[n0]);
    first = first || n;
  }
  saveCustom();
  updTrash();
  showFile(first || cur);
}
