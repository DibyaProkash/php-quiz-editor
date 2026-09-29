// "Format code" (Shift+Alt+F) - a REAL PHP code formatter, not a fake indenter.
// Runs Prettier (https://prettier.io) with the community @prettier/plugin-php parser,
// entirely in the browser. Both are loaded lazily, only the first time a student
// actually presses Format, so a proctored exam session never pays for this download
// unless someone uses it.
const PRETTIER_JS = 'https://cdn.jsdelivr.net/npm/prettier@3.9.9/standalone.js';
const PRETTIER_PHP_JS = 'https://cdn.jsdelivr.net/npm/@prettier/plugin-php@0.25.0/standalone.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}
let prettierReady = null;
function ensurePrettier() {
  if (!prettierReady) {
    prettierReady = (async () => {
      if (!window.prettier) await loadScript(PRETTIER_JS);
      if (!window.prettierPlugins || !window.prettierPlugins.php) await loadScript(PRETTIER_PHP_JS);
    })();
  }
  return prettierReady;
}

let formatMsgTimer = null;
function showFormatMsg(text, isError) {
  const el = $('formatMsg');
  clearTimeout(formatMsgTimer);
  el.textContent = text; el.className = isError ? 'e' : 'ok'; el.hidden = false;
  formatMsgTimer = setTimeout(() => { el.hidden = true; }, isError ? 6000 : 2200);
}

async function formatCurrentFile() {
  const btn = $('format');
  if (btn.disabled || !cur.endsWith('.php') || !metaOf(cur).editable) return;
  btn.disabled = true;
  try {
    await ensurePrettier();
    const before = cm.getValue();
    const after = await prettier.format(before, {
      parser: 'php', plugins: [prettierPlugins.php], tabWidth: 4, printWidth: 100, singleQuote: true, phpVersion: '8.4'
    });
    if (after !== before) {
      const last = cm.lastLine();
      cm.replaceRange(after, { line: 0, ch: 0 }, { line: last, ch: cm.getLine(last).length }, 'format');
      showFormatMsg('Code formatted.', false);
    } else {
      showFormatMsg('Already formatted - nothing to change.', false);
    }
  } catch (err) {
    const msg = String(err && err.message || err).split('\n')[0];
    showFormatMsg("Can't format: your PHP has a syntax problem (" + msg + '). Fix it and try again.', true);
  }
  btn.disabled = false;
}
$('format').onclick = formatCurrentFile;
