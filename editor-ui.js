const cm = CodeMirror.fromTextArea($('code'), {
  theme: 'material-darker', lineNumbers: true, matchBrackets: true, autoCloseBrackets: true,
  indentUnit: 4, indentWithTabs: false, undoDepth: 1000, historyEventDelay: 400,
  extraKeys: { 'Ctrl-Enter': () => runFresh(), 'Cmd-Enter': () => runFresh(), Tab: c => c.replaceSelection('    ') }
});

function renameRow(path, isFolder, depth) {
  const w = document.createElement('div'), i = document.createElement('input'), e = document.createElement('div');
  w.className = 'rnwrap'; w.style.paddingLeft = (10 + depth * 14) + 'px';
  i.className = 'rn'; i.value = path; i.maxLength = 60; i.spellcheck = false; i.setAttribute('aria-label', 'New name for ' + path);
  e.className = 'rnerr'; e.setAttribute('role', 'alert');
  i.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { const err = (isFolder ? renameFolder : renameFile)(path, i.value); if (err) e.textContent = err; else { renaming = null; renderTabs(); } }
    else if (ev.key === 'Escape') { renaming = null; renderTabs(); }
  });
  i.addEventListener('input', () => { e.textContent = ''; });
  i.addEventListener('blur', () => setTimeout(() => { if (renaming === path) { renaming = null; renderTabs(); } }, 200));
  w.append(i, e);
  return w;
}
function renderTabs() {
  const ex = $('explorer'), f0 = metaOf(cur), dirs = allFolders(), names = allNames();
  ex.innerHTML = '';
  function folderRow(d, depth) {
    if (renaming === d) return renameRow(d, true, depth);
    const row = document.createElement('div'), b = document.createElement('button'), isOpen = open.has(d);
    row.className = 'frow' + (selDir === d ? ' sel' : '');
    b.className = 'fitem'; b.style.paddingLeft = (14 + depth * 14) + 'px';
    b.innerHTML = '<img class="ficon" alt="" src="' + ICON_URI[isOpen ? 'folderOpen' : 'folder'] + '"><span>' + esc(baseOf(d)) + '</span>';
    b.setAttribute('aria-expanded', isOpen);
    b.onclick = () => { if (open.has(d)) open.delete(d); else open.add(d); selDir = d; renderTabs(); };
    row.appendChild(b);
    const acts = document.createElement('div'); acts.className = 'acts';
    acts.append(actBtn('', 'Rename ' + d, PEN, () => { renaming = d; renderTabs(); }),
      actBtn('del', 'Delete ' + d, TRASH, () => ask('Delete folder ' + d + '?', 'This deletes the folder and every file inside it. You can use Undo delete right afterwards.', 'Yes, delete', () => deletePath(d, true))));
    row.appendChild(acts);
    return row;
  }
  function fileRow(n, depth) {
    const f = metaOf(n);
    if (renaming === n) return renameRow(n, false, depth);
    const row = document.createElement('div'), b = document.createElement('button');
    row.className = 'frow' + (n === cur ? ' cur' : '');
    b.className = 'fitem' + (n === cur ? ' on' : ''); b.style.paddingLeft = (14 + depth * 14) + 'px';
    b.innerHTML = icon(n) + '<span>' + esc(baseOf(n)) + '</span>' + (f.editable ? '' : '<span class="ro">read-only</span>');
    b.onclick = () => showFile(n);
    row.appendChild(b);
    if (n === mainName) row.insertAdjacentHTML('beforeend', '<span class="runmark" title="This file runs when you press Run">' + PLAY + '</span>');
    const acts = document.createElement('div'); acts.className = 'acts';
    if (n.endsWith('.php') && n !== mainName) acts.appendChild(actBtn('', 'Run this file instead', PLAY, () => setMain(n)));
    if (f.custom) {
      acts.appendChild(actBtn('', 'Rename ' + n, PEN, () => { renaming = n; renderTabs(); }));
      acts.appendChild(actBtn('del', 'Delete ' + n, TRASH, () => ask('Delete ' + n + '?', 'This deletes ' + n + ' and everything written in it. You can use Undo delete right afterwards. Any include or require of this file will stop working.', 'Yes, delete', () => deletePath(n, false))));
    }
    row.appendChild(acts);
    return row;
  }
  (function renderDir(dir, depth) {
    dirs.filter(d => dirOf(d) === dir).forEach(d => { ex.appendChild(folderRow(d, depth)); if (open.has(d)) renderDir(d, depth + 1); });
    names.filter(n => dirOf(n) === dir).forEach(n => ex.appendChild(fileRow(n, depth)));
  })('', 0);
  const rn = ex.querySelector('.rn');
  if (rn) { rn.focus(); const dot = rn.value.lastIndexOf('.'); rn.setSelectionRange(rn.value.lastIndexOf('/') + 1, dot > 0 ? dot : rn.value.length); }
  $('filetabs').innerHTML = '<div class="ftab">' + icon(cur) + '<span>' + esc(cur) + '</span></div>' +
    (f0.editable ? '' : '<span class="note">You do not need to edit this file</span>');
  $('run').title = 'Runs ' + mainName + ' (Ctrl+Enter)';
}
function view(v) {
  $('vPrev').className = v === 'prev' ? 'on' : ''; $('vOut').className = v === 'out' ? 'on' : ''; $('vTests').className = v === 'tests' ? 'on' : '';
  $('frame').hidden = v !== 'prev'; $('out').hidden = v !== 'out'; $('testPanel').hidden = v !== 'tests';
}
function renderFuncs(list) {
  $('funcsPanel').innerHTML = list.map(f =>
    '<div class="funcItem"><code class="funcSig">' + esc(f.sig) + '</code><p>' + esc(f.desc) + '</p><pre class="funcExample">' + esc(f.example) + '</pre></div>'
  ).join('');
}

function loadQuestion() {
  clearUndo();
  const q = QUESTIONS[key];
  $('title').textContent = q.title; document.title = q.title;
  docs = {};
  q.files.forEach(f => {
    docs[f.name] = CodeMirror.Doc(load('f:' + key + ':' + f.name) ?? f.code, modeOf(f.name));
  });
  const list = k => { try { const v = JSON.parse(load(k + ':' + key) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch (e) { return []; } };
  custom = list('custom').filter(n => !q.files.some(f => f.name === n)); folders = list('folders');
  custom.forEach(n => { docs[n] = CodeMirror.Doc(load('f:' + key + ':' + n) ?? blankOf(n), modeOf(n)); });
  open = new Set(allFolders()); selDir = ''; renaming = null; trash = []; updTrash();
  const savedMain = load('main:' + key);
  mainName = savedMain && docs[savedMain] && savedMain.endsWith('.php') ? savedMain : defaultMain();
  $('newRow').hidden = true;
  showFile(q.files.find(f => f.editable).name);
  $('stdinbox').hidden = q.stdin === undefined;
  $('stdin').value = load('stdin:' + key) ?? (q.stdin || '');
  $('vPrev').hidden = !q.preview;
  shown = 0; $('hints').style.display = 'none'; $('hints').innerHTML = '';
  const hb = $('hint'); hb.hidden = !q.hints?.length; hb.disabled = false;
  hb.textContent = 'Show hint (0/' + (q.hints?.length || 0) + ')';
  $('out').innerHTML = '<span class="m">Press Run to see your result here.</span>';
  $('frame').srcdoc = '<p style="font:14px system-ui;color:#777;padding:16px">Press Run to see your page here.</p>';
  const tests = q.tests || [];
  $('vTests').hidden = !tests.length;
  $('runTests').textContent = 'Run tests (' + tests.length + ')'; $('runTests').disabled = false;
  $('testResults').innerHTML = '';
  const funcs = q.functions || [];
  $('funcsSection').hidden = !funcs.length;
  $('funcsPanel').hidden = true; $('funcsBtn').setAttribute('aria-expanded', 'false');
  $('funcsBtn').textContent = 'PHP function reference (' + funcs.length + ')';
  renderFuncs(funcs);
  view(q.preview ? 'prev' : 'out');
  req = { m: 'get', d: {} };
}

if (!params.get('q')) {
  const p = $('picker'); p.hidden = false;
  for (const k in QUESTIONS) p.add(new Option(QUESTIONS[k].title, k));
  p.value = key; p.onchange = () => { key = p.value; loadQuestion(); };
}

function updHist() { const h = cm.historySize(); $('undo').disabled = !h.undo; $('redo').disabled = !h.redo; }
$('undo').onclick = () => { cm.undo(); cm.focus(); };
$('redo').onclick = () => { cm.redo(); cm.focus(); };
cm.on('swapDoc', updHist);
cm.on('change', () => { updHist(); clearUndo(); if (cur) store('f:' + key + ':' + cur, cm.getValue()); });
$('stdin').addEventListener('input', e => { clearUndo(); store('stdin:' + key, e.target.value); });
$('vPrev').onclick = () => view('prev'); $('vOut').onclick = () => view('out'); $('vTests').onclick = () => view('tests');
$('funcsBtn').onclick = () => {
  const opening = $('funcsPanel').hidden;
  $('funcsPanel').hidden = !opening; $('funcsBtn').setAttribute('aria-expanded', String(opening));
};

let undoSnap = null, onYes = null, lastFocus = null;
const clearUndo = () => { undoSnap = null; $('undoReset').hidden = true; };
function ask(title, body, yesText, fn) {
  lastFocus = document.activeElement; onYes = fn;
  $('dlgT').textContent = title; $('dlgB').textContent = body; $('yes').textContent = yesText;
  $('veil').hidden = false; $('no').focus();
}
const closeDlg = () => { $('veil').hidden = true; onYes = null; if (lastFocus && lastFocus.isConnected) lastFocus.focus(); };

$('reset').onclick = () => ask('Reset all code?',
  'This replaces the starter files with the original code and deletes any files and folders you created. You can use Undo reset right afterwards if you change your mind.',
  'Yes, reset everything', doReset);
$('no').onclick = closeDlg;
$('yes').onclick = () => { const fn = onYes; $('veil').hidden = true; onYes = null; if (fn) fn(); };
$('veil').addEventListener('mousedown', e => { if (e.target === $('veil')) closeDlg(); });
document.addEventListener('keydown', e => {
  if ($('veil').hidden) return;
  if (e.key === 'Escape') closeDlg();
  if (e.key === 'Tab') { e.preventDefault(); ($('no').matches(':focus') ? $('yes') : $('no')).focus(); } // keep focus inside the dialog
});

function doReset() {
  const snap = { files: {}, custom: custom.slice(), folders: folders.slice(), main: mainName, stdin: $('stdin').value };
  allNames().forEach(n => { snap.files[n] = docs[n].getValue(); store('f:' + key + ':' + n); });
  ['stdin', 'custom', 'folders', 'main'].forEach(k => store(k + ':' + key));
  loadQuestion();
  undoSnap = snap; $('undoReset').hidden = false;
}
$('undoReset').onclick = () => {
  if (!undoSnap) return;
  const snap = undoSnap; clearUndo();
  custom = snap.custom.slice(); folders = snap.folders.slice(); saveCustom();
  allNames().forEach(n => {
    const v = snap.files[n];
    if (docs[n]) docs[n].setValue(v); else docs[n] = CodeMirror.Doc(v, modeOf(n));
    store('f:' + key + ':' + n, v);
  });
  open = new Set(allFolders());
  if (docs[snap.main]) setMain(snap.main, false);
  $('stdin').value = snap.stdin; store('stdin:' + key, snap.stdin);
  showFile(cur);
};
$('undoDelete').onclick = undoDelete;

// New file / new folder: the two buttons in the Files panel
function openNew(mode) {
  newMode = mode; const i = $('newName');
  $('newRow').hidden = false; $('newErr').textContent = '';
  i.placeholder = mode === 'file' ? 'helpers.php' : 'includes';
  i.value = selDir ? selDir + '/' : ''; i.focus(); i.setSelectionRange(i.value.length, i.value.length);
}
$('newFile').onclick = () => openNew('file');
$('newFolder').onclick = () => openNew('folder');
$('newName').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const err = (newMode === 'file' ? createFile : createFolder)($('newName').value); if (err) $('newErr').textContent = err; else $('newRow').hidden = true; }
  else if (e.key === 'Escape') $('newRow').hidden = true;
});
$('newName').addEventListener('input', () => { $('newErr').textContent = ''; });
$('newName').addEventListener('blur', () => setTimeout(() => { $('newRow').hidden = true; }, 200));

$('hint').onclick = () => {
  const h = QUESTIONS[key].hints;
  if (shown >= h.length) return;
  const p = document.createElement('p');
  p.textContent = 'Hint ' + (shown + 1) + ': ' + h[shown++];
  $('hints').appendChild(p); $('hints').style.display = 'block';
  $('hint').textContent = shown < h.length ? 'Show hint (' + shown + '/' + h.length + ')' : 'All hints shown';
  $('hint').disabled = shown >= h.length;
};
