// "Error Lens"-style inline diagnostics, like the popular VS Code extension of the same
// name: after a Run, PHP's own parse/fatal/warning/notice/deprecated messages (the same
// text already shown in the Output tab - see PHP_DIAG in php-runner.js) are parsed for
// their file + line number and shown directly ON that line in the editor - a colored
// highlight across the line plus the error text appended at the end of it - instead of
// making a student cross-reference a line number back to their code by hand.
//
// Decorations live on the CodeMirror Doc objects themselves (docs[name]), not the single
// visible editor instance - so a line in a file that ISN'T the one currently open still
// gets marked correctly, and reappears exactly where it was if the student switches back
// to that file, the same way CodeMirror's own marks/line-classes always survive a
// swapDoc() in and out.
//
// php-wasm reports the DIRECTLY-RUN file (the one passed to engine.run(), i.e. the
// exercise's own main file) under the fixed virtual name "php-wasm run script" - never
// the student's real filename - while a require()'d file reports its own real path
// (e.g. "/helper.php"). mainFile (passed in by the caller) supplies the real name for
// that virtual one.
let lensDocs = new Set();
function clearErrorLens() {
  lensDocs.forEach(name => {
    const doc = docs[name];
    if (!doc) return;
    (doc.lensMarks || []).forEach(m => m.clear());
    // Each entry is the line HANDLE addLineClass returned, which follows its line through
    // edits (a plain line number would go stale), plus just our own class - so other
    // background classes, like the debugger's dbgLine highlight, are left alone.
    (doc.lensLines || []).forEach(l => { try { doc.removeLineClass(l.handle, 'background', l.cls); } catch (e) {} });
    doc.lensMarks = []; doc.lensLines = [];
  });
  lensDocs.clear();
}

// `\S+` alone can't match the virtual "php-wasm run script" name (it has spaces), so
// that exact phrase is matched as its own alternative ahead of the generic no-spaces case.
const LENS_FILE = 'php-wasm run script|\\S+';
// Fatal errors come in two shapes: compile-time ones ("Cannot redeclare ...") use the
// usual "in X on line N" form above; uncaught exceptions use "Uncaught ... in X:N".
const LENS_LINE_RE = new RegExp('(Parse error|Fatal error|Warning|Notice|Deprecated):\\s*(.*?)\\s+in\\s+(' + LENS_FILE + ')\\s+on\\s+line\\s+(\\d+)', 'g');
const LENS_FATAL_RE = new RegExp('Fatal error:\\s*(Uncaught .*?)\\s+in\\s+(' + LENS_FILE + '):(\\d+)', 'g');
const LENS_CLASS = { 'Parse error': 'lens-error', 'Fatal error': 'lens-error', Warning: 'lens-warning', Notice: 'lens-notice', Deprecated: 'lens-notice' };

// Maps a path PHP reported (e.g. "/helper.php", or the "php-wasm run script" stand-in
// for the main file) to the matching key in `docs` - an exact match first, then just the
// filename, the same fallback resolveNavTarget (php-runner.js) uses for Preview links.
function resolveLensFile(rawPath, mainFile) {
  if (rawPath === 'php-wasm run script') return mainFile;
  const path = rawPath.replace(/^\//, ''), names = allNames();
  if (names.includes(path)) return path;
  const base = path.split('/').pop();
  return names.find(n => n.split('/').pop() === base) || null;
}

function addLensDiag(fileKey, line0, severity, message, seen) {
  const doc = docs[fileKey];
  if (!doc || line0 < 0 || line0 > doc.lastLine()) return;
  const dedupeKey = fileKey + ':' + line0 + ':' + severity;
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  const cls = LENS_CLASS[severity] || 'lens-error';
  const handle = doc.addLineClass(line0, 'background', cls + '-line');
  const span = document.createElement('span');
  span.className = 'lens-msg ' + cls;
  span.textContent = '  // ' + severity + ': ' + message;
  const mark = doc.setBookmark({ line: line0, ch: doc.getLine(line0).length }, { widget: span, insertLeft: false });
  (doc.lensMarks || (doc.lensMarks = [])).push(mark);
  (doc.lensLines || (doc.lensLines = [])).push({ handle, cls: cls + '-line' });
  lensDocs.add(fileKey);
}

// `diagText` is the same combined stdout+diagnostics text already shown in the Output
// tab (see run() in php-runner.js); `mainFile` is that run's main file key (resolveNavTarget-
// style), needed only to resolve the "php-wasm run script" virtual name above.
function applyErrorLens(diagText, mainFile) {
  clearErrorLens();
  if (!diagText) return;
  const seen = new Set(); // an uncaught exception reports its own location twice (the initial "in X:N" and the trailing "thrown in X on line N") - keep just one marker
  let m;
  LENS_FATAL_RE.lastIndex = 0;
  while ((m = LENS_FATAL_RE.exec(diagText))) {
    const fileKey = resolveLensFile(m[2], mainFile);
    if (fileKey) addLensDiag(fileKey, parseInt(m[3], 10) - 1, 'Fatal error', m[1].trim(), seen);
  }
  LENS_LINE_RE.lastIndex = 0;
  while ((m = LENS_LINE_RE.exec(diagText))) {
    const fileKey = resolveLensFile(m[3], mainFile);
    if (fileKey) addLensDiag(fileKey, parseInt(m[4], 10) - 1, m[1], m[2].trim(), seen);
  }
}
