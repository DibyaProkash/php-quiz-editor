// Theme picker (Dark / Light / System / High contrast / Solarized dark) and a zoom
// control, for students who need a different color scheme or larger text/UI to read
// and write code comfortably. Colors themselves are defined once in styles.css as CSS
// custom properties per [data-theme="..."] - this file only decides which one applies
// and keeps CodeMirror's own syntax-highlighting theme in sync with it.
//
// A tiny inline script at the top of index.html already set the initial data-theme
// attribute before the page paints (avoiding a flash of the wrong theme); this file
// does the rest: wires up the picker, keeps "System" live if the OS theme changes
// while the page is open, and switches CodeMirror's theme to match.
const THEME_OPTIONS = ['system', 'dark', 'light', 'high-contrast', 'solarized'];

function prefersDark() {
  try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return true; }
}
function effectiveTheme(pref) { return pref === 'system' ? (prefersDark() ? 'dark' : 'light') : pref; }
// CodeMirror ships its own light theme ('default', built into the core CSS already
// loaded - no extra file to fetch) and we already load 'material-darker' for every
// dark-background theme (dark, high-contrast and solarized are all dark-background).
const cmThemeFor = eff => eff === 'light' ? 'default' : 'material-darker';

let themePref = load('themePref') || 'system';
function applyTheme(pref) {
  themePref = pref;
  const eff = effectiveTheme(pref);
  document.documentElement.dataset.theme = eff;
  document.documentElement.dataset.themePref = pref;
  if (typeof cm !== 'undefined' && cm.setOption) cm.setOption('theme', cmThemeFor(eff));
  store('themePref', pref);
}

// Zoom: a continuous 60%-200% scale (in 10% steps) applied to the whole page via CSS
// `zoom`, adjustable the way a browser's own zoom works - buttons, Ctrl+= / Ctrl+- /
// Ctrl+0, and Ctrl+scroll-wheel - rather than a handful of fixed named sizes.
const ZOOM_MIN = 60, ZOOM_MAX = 200, ZOOM_STEP = 10;
let zoomPct = parseInt(load('zoomPct'), 10);
if (!Number.isFinite(zoomPct) || zoomPct < ZOOM_MIN || zoomPct > ZOOM_MAX) zoomPct = 100;
function setZoom(pct) {
  zoomPct = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(pct / ZOOM_STEP) * ZOOM_STEP));
  document.documentElement.style.setProperty('--ui-scale', String(zoomPct / 100));
  store('zoomPct', String(zoomPct));
  const lvl = $('zoomLevel');
  if (lvl) lvl.textContent = zoomPct + '%';
  const zo = $('zoomOut'), zi = $('zoomIn');
  if (zo) zo.disabled = zoomPct <= ZOOM_MIN;
  if (zi) zi.disabled = zoomPct >= ZOOM_MAX;
  if (typeof cm !== 'undefined' && cm.refresh) cm.refresh();
}
const zoomIn = () => setZoom(zoomPct + ZOOM_STEP);
const zoomOut = () => setZoom(zoomPct - ZOOM_STEP);
const zoomReset = () => setZoom(100);

const themePicker = $('themePicker');
if (themePicker) {
  themePicker.value = themePref;
  applyTheme(themePref); // re-apply (idempotent with the inline anti-flash script) so the CodeMirror theme gets set too
  themePicker.onchange = () => applyTheme(themePicker.value);
}
setZoom(zoomPct);
if ($('zoomIn')) $('zoomIn').onclick = zoomIn;
if ($('zoomOut')) $('zoomOut').onclick = zoomOut;
if ($('zoomLevel')) $('zoomLevel').onclick = zoomReset;

// Ctrl/Cmd + scroll-wheel zooms, exactly like a browser's own native zoom - and, like
// a browser, plain scrolling (no modifier) is left completely alone.
window.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  if (e.deltaY < 0) zoomIn(); else if (e.deltaY > 0) zoomOut();
}, { passive: false });

// Ctrl/Cmd + '+'/'-'/'0', the same shortcuts browsers and VS Code use. preventDefault
// stops the browser's OWN native page zoom from also kicking in and doubling up.
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut(); }
  else if (e.key === '0') { e.preventDefault(); zoomReset(); }
});

try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themePref === 'system') applyTheme('system'); });
} catch (e) { /* matchMedia change listener unsupported - System theme just won't live-update, no functional loss otherwise */ }
