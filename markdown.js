// Markdown preview ("md code runner"): README.md (and any .md file) is read-only, but
// instead of just showing raw Markdown source in the code editor, students see it
// rendered - headings, lists, tables, code blocks - the same way it would look on
// GitHub. A small "View source" toggle lets them peek at the raw Markdown underneath
// if they want to, without ever being able to edit it.
//
// Rendering is done with two small, well-known libraries loaded lazily from a CDN,
// only the first time a student actually opens a .md file (same lazy-load pattern as
// the PHP formatter): marked (https://marked.js.org) turns Markdown into HTML, and
// DOMPurify (https://github.com/cure53/DOMPurify) sanitizes that HTML before it's
// ever inserted into the page - important since Markdown can contain raw HTML, and a
// student-created .md file is still untrusted input.
const MARKED_JS = "https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js";
const DOMPURIFY_JS =
  "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js";

function loadMdScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load " + src));
    document.head.appendChild(s);
  });
}
let markdownLibsReady = null;
function ensureMarkdownLibs() {
  if (!markdownLibsReady) {
    markdownLibsReady = (async () => {
      if (!window.marked) await loadMdScript(MARKED_JS);
      if (!window.DOMPurify) await loadMdScript(DOMPURIFY_JS);
    })();
  }
  return markdownLibsReady;
}

let mdMode = "preview"; // 'preview' | 'source' - only meaningful while a .md file is open
const isMdFile = (name) => /\.md$/i.test(name);

async function renderMdPreview(src) {
  const el = $("mdPreview");
  el.innerHTML = '<p class="mdLoading">Loading preview…</p>';
  try {
    await ensureMarkdownLibs();
    // Only render the doc that's still current by the time the library finishes
    // loading - the student may have already clicked to a different file.
    if (cm.getValue() !== src) return;
    const raw = marked.parse(src, { breaks: true });
    el.innerHTML = DOMPurify.sanitize(raw, { ADD_ATTR: ["target"] });
  } catch (e) {
    // Never leave the panel blank - fall back to plain preformatted text.
    const pre = document.createElement("pre");
    pre.className = "mdFallback";
    pre.textContent = src;
    el.innerHTML = "";
    el.appendChild(pre);
  }
}

// Switches the editor pane between the rendered Markdown view and the raw
// CodeMirror source view for the file that's currently open.
function setMdMode(mode) {
  mdMode = mode;
  const showingSource = mode === "source";
  cm.getWrapperElement().style.display = showingSource ? "" : "none";
  $("mdPreview").hidden = showingSource;
  $("mdToggle").textContent = showingSource ? "Back to preview" : "View source";
  $("mdToggle").setAttribute("aria-pressed", String(showingSource));
  if (showingSource) {
    cm.refresh();
  }
}

// Called from filesystem.js's showFile() every time the open file changes - decides
// whether to show the ordinary code editor or the Markdown preview UI.
function applyFileView(name) {
  const md = isMdFile(name);
  $("mdBar").hidden = !md;
  if (md) {
    // The "Read-only" note only applies to a provided file like README.md - a student
    // can also create their own .md notes file, which stays fully editable, including
    // from the "View source" side of this same toggle.
    $("mdNote").textContent = metaOf(name).editable ? "Editable" : "Read-only";
    setMdMode("preview");
    renderMdPreview(cm.getValue());
  } else {
    cm.getWrapperElement().style.display = "";
    $("mdPreview").hidden = true;
    cm.refresh();
  }
}

$("mdToggle").onclick = () => {
  if (!isMdFile(cur)) return;
  setMdMode(mdMode === "preview" ? "source" : "preview");
  if (mdMode === "preview") renderMdPreview(cm.getValue());
  else cm.focus();
};
