const b64 = s => btoa(unescape(encodeURIComponent(s)));
function wrap(code, stdin, r) {
  // Prelude sits on line 1 so PHP error line numbers match the editor.
  const pre = '<?php $__in=explode("\\n",base64_decode("' + b64(stdin) + '"));' +
    'function __rl($p=""){global $__in;echo $p;return count($__in)?array_shift($__in):false;}' +
    '$__r=json_decode(base64_decode("' + b64(JSON.stringify(r)) + '"),true);' +
    'if($__r["m"]==="post"){$_POST=$__r["d"];$_SERVER["REQUEST_METHOD"]="POST";}else{$_GET=$__r["d"];$_SERVER["REQUEST_METHOD"]="GET";}' +
    '$_REQUEST=$__r["d"];unset($__r); ?>';
  return pre + fix(code);
}
const fix = code => code.replace(/\breadline\s*\(/g, '__rl(').replace(/\bfgets\s*\(\s*STDIN\s*\)/g, '__rl()');

const BRIDGE = '<script>document.addEventListener("submit",function(e){e.preventDefault();var f=e.target,d={};' +
  'new FormData(f).forEach(function(v,k){if(typeof v==="string")d[k]=v});' +
  'parent.postMessage({fp:1,m:(f.getAttribute("method")||"get").toLowerCase(),d:d},"*")},true);' +
  'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");' +
  'if(a&&a.getAttribute("href").charAt(0)!=="#")e.preventDefault()},true)<\/script>';

function inline(html) {
  allNames().forEach(name => {
    const f = { name };
    if (name.endsWith('.php')) return;
    const code = docs[name].getValue(), n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (f.name.endsWith('.css'))
      html = html.replace(new RegExp('<link[^>]*href=["\'](?:\\./)?' + n + '["\'][^>]*>', 'gi'), () => '<style>' + code + '</style>');
    if (f.name.endsWith('.js'))
      html = html.replace(new RegExp('<script[^>]*src=["\'](?:\\./)?' + n + '["\'][^>]*>\\s*<\\/script>', 'gi'),
        () => '<script>window.addEventListener("DOMContentLoaded",function(){' + code.replace(/<\/script/gi, '<\\/script') + '\n});<\/script>');
  });
  return html;
}

// php-wasm reports PHP-level parse errors, fatal errors, warnings and notices
// through the 'output' event, not 'error' - so they show up mixed into normal
// output text rather than on a separate channel. Detect them there instead.
const PHP_DIAG = /(?:^|\n)\s*(?:Parse error|Fatal error|Warning|Notice|Deprecated):/;

// One PHP engine instance is kept alive for the whole session and reused for
// every Run/Calculate click, instead of creating `new PhpWeb()` each time.
// Each `new PhpWeb()` compiles and instantiates a fresh WebAssembly module
// with its own multi-megabyte linear memory, and the old instance's memory
// is not reliably released by the browser between clicks - across a long
// exam session with many Run clicks this grows until the tab runs out of
// memory ("memory not getting allocated") and needs a refresh to recover.
// `refresh()` resets PHP's own state (functions, globals, included files)
// inside the SAME WebAssembly instance instead, so repeated runs stay flat
// in memory. Sink variables are module-level so the output/error listeners
// can be attached once and simply re-armed before each run.
let php = null, sinkText = '', sinkErrs = '';
async function getPhp() {
  if (php) { await php.refresh(); return php; }
  php = new PhpWeb();
  php.addEventListener('output', e => { sinkText += [].concat(e.detail).join(''); });
  php.addEventListener('error', e => { sinkErrs += [].concat(e.detail).join(''); });
  return php;
}

async function run() {
  const btn = $('run'), q = QUESTIONS[key];
  if (btn.disabled) return;
  btn.disabled = true; btn.textContent = 'Running…';
  sinkText = ''; sinkErrs = '';
  try {
    const main = mainName;
    await phpReady;
    if (!PhpWeb) throw new Error('The PHP engine could not be loaded (' + (window.__phpErr || 'unknown error') + '). Check your connection or that cdn.jsdelivr.net is allowed.');
    const engine = await getPhp();
    for (const d of allFolders()) { try { await engine.mkdir('/' + d); } catch (e) {} }
    for (const n of allNames()) await engine.writeFile('/' + n, n.endsWith('.php') ? fix(docs[n].getValue()) : docs[n].getValue());
    await engine.run(wrap(docs[main].getValue(), $('stdin').value, req));
  } catch (err) {
    sinkErrs += String(err && err.message || err);
    php = null; // the instance may be in a broken state after a JS-level failure; rebuild next run
  }
  const text = sinkText, errs = sinkErrs;
  const flagged = !!errs || PHP_DIAG.test(text);
  $('out').innerHTML = (flagged ? '<span class="e">' + esc(text) + (errs ? '\n' + esc(errs) : '') + '</span>' : esc(text)) ||
    '<span class="m">(no output)</span>';
  if (q.preview) {
    $('frame').srcdoc = inline(text) + BRIDGE;
    view(flagged ? 'out' : 'prev');
  }
  btn.disabled = false; btn.textContent = 'Run (Ctrl+Enter)';
}
function runFresh() { req = { m: 'get', d: {} }; run(); }

window.addEventListener('message', e => {
  if (e.source !== $('frame').contentWindow || !e.data || !e.data.fp) return;
  req = { m: e.data.m, d: e.data.d }; run();
});
$('run').onclick = runFresh;
loadQuestion();
