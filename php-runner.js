const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
function wrap(code, stdin, r) {
  // Prelude sits on line 1 so PHP error line numbers match the editor.
  const pre =
    '<?php $__in=explode("\\n",base64_decode("' +
    b64(stdin) +
    '"));' +
    'function __rl($p=""){global $__in;echo $p;return count($__in)?array_shift($__in):false;}' +
    '$__r=json_decode(base64_decode("' +
    b64(JSON.stringify(r)) +
    '"),true);' +
    'if($__r["m"]==="post"){$_POST=$__r["d"];$_SERVER["REQUEST_METHOD"]="POST";}else{$_GET=$__r["d"];$_SERVER["REQUEST_METHOD"]="GET";}' +
    '$_REQUEST=$__r["d"];unset($__r); ?>';
  return pre + fix(code);
}
const fix = (code) =>
  code
    .replace(/\breadline\s*\(/g, "__rl(")
    .replace(/\bfgets\s*\(\s*STDIN\s*\)/g, "__rl()");

// fp:1 = a form was submitted (existing behavior). fp:2 = a console message or uncaught
// error/rejection, for the Console tab (console.js). fp:3 = a link was clicked; the parent
// resolves its href against the student's own project files (resolveNavTarget below) and,
// if it matches one, loads that file into Preview instead of leaving the click blocked.
const BRIDGE =
  '<script>document.addEventListener("submit",function(e){e.preventDefault();var f=e.target,d={};' +
  'new FormData(f).forEach(function(v,k){if(typeof v==="string")d[k]=v});' +
  'parent.postMessage({fp:1,m:(f.getAttribute("method")||"get").toLowerCase(),d:d},"*")},true);' +
  'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");' +
  'if(!a)return;var href=a.getAttribute("href");if(!href||href.charAt(0)==="#")return;' +
  'e.preventDefault();parent.postMessage({fp:3,href:href},"*")},true);' +
  "(function(){function send(level,parts){var text=parts.map(function(a){" +
  'if(typeof a==="string")return a;try{return JSON.stringify(a)}catch(e){return String(a)}}).join(" ");' +
  'parent.postMessage({fp:2,level:level,text:text},"*")}' +
  ';["log","info","warn","error"].forEach(function(level){var orig=console[level];' +
  "console[level]=function(){send(level,[].slice.call(arguments));if(orig)orig.apply(console,arguments)}});" +
  'window.onerror=function(msg,url,line){send("error",[String(msg)+" (line "+line+")"]);return false};' +
  'window.addEventListener("unhandledrejection",function(e){' +
  'send("error",["Unhandled promise rejection: "+(e.reason&&e.reason.message||e.reason)])})})()' +
  "<\/script>";

// Resolves a clicked link's href against the student's own project files, so Preview can
// navigate between the student's own pages the way a real multi-page site would, without
// ever leaving this sandboxed iframe or making any real network request. An exact relative
// path match (e.g. "includes/page2.php") is preferred; otherwise it falls back to matching
// just the filename (e.g. a plain "page2.php" from any folder), since most student projects
// only have one folder anyway. Only .php/.html files are navigable targets - a link to a
// .css/.js/image/etc., or to something outside the project entirely, is left alone (reported
// in the Console tab instead of silently doing nothing).
function resolveNavTarget(href) {
  let path = href.split("#")[0],
    query = "";
  const qIdx = path.indexOf("?");
  if (qIdx !== -1) {
    query = path.slice(qIdx + 1);
    path = path.slice(0, qIdx);
  }
  path = path.replace(/^\.\//, "").replace(/^\//, "");
  if (!path) return null;
  const names = allNames(),
    navable = (n) => n.endsWith(".php") || n.endsWith(".html");
  let match = names.includes(path) && navable(path) ? path : null;
  if (!match) {
    const base = path.split("/").pop();
    match =
      names.find((n) => navable(n) && n.split("/").pop() === base) || null;
  }
  if (!match) return null;
  const params = {};
  if (query)
    query.split("&").forEach((pair) => {
      if (!pair) return;
      const [k, v] = pair.split("=");
      if (k)
        params[decodeURIComponent(k)] = decodeURIComponent(
          (v || "").replace(/\+/g, " "),
        );
    });
  return { file: match, params };
}

// Inserts BRIDGE as the very first script to run, without landing in front of a
// <!DOCTYPE> declaration - anything (even this script tag) placed before the doctype can
// knock the whole page into quirks mode in some browsers, silently changing box-model/
// layout behavior for the page being previewed. So this goes right after <head> (or
// <html>, if there's no <head>) instead of being prepended to the raw string; only a
// bare fragment with neither tag (common for a simple echo-only PHP page) gets it
// prepended directly, since there's no doctype there to protect.
function injectBridge(html) {
  if (/<head[^>]*>/i.test(html))
    return html.replace(/<head[^>]*>/i, (m) => m + BRIDGE);
  if (/<html[^>]*>/i.test(html))
    return html.replace(/<html[^>]*>/i, (m) => m + BRIDGE);
  return BRIDGE + html;
}

// The Preview iframe (#frame) is its own separate document, so the page-wide zoom
// control (theme.js) - which scales the rest of the UI via CSS `zoom` on <body> - has
// no effect on what's rendered inside it; an ancestor's `zoom` does not cross into an
// iframe's own document. Without this, zooming in for readability would leave the
// live PHP page preview stuck at 100%, the one part of the screen that didn't grow.
// zoomPct is theme.js's global (loaded before this file) - default to 100% if it's
// somehow unavailable, so a preview is never silently skipped.
function injectZoomStyle(html, scale) {
  if (scale === 1) return html;
  const tag = "<style>html{zoom:" + scale + "}</style>";
  if (/<head[^>]*>/i.test(html))
    return html.replace(/<head[^>]*>/i, (m) => m + tag);
  if (/<html[^>]*>/i.test(html))
    return html.replace(/<html[^>]*>/i, (m) => m + tag);
  return tag + html; // a fragment with no <html>/<head> tag - a stray <style> still applies
}

function inline(html) {
  allNames().forEach((name) => {
    const f = { name };
    if (name.endsWith(".php")) return;
    const code = docs[name].getValue(),
      n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (f.name.endsWith(".css"))
      html = html.replace(
        new RegExp("<link[^>]*href=[\"'](?:\\./)?" + n + "[\"'][^>]*>", "gi"),
        () => "<style>" + code + "</style>",
      );
    if (f.name.endsWith(".js"))
      html = html.replace(
        new RegExp(
          "<script[^>]*src=[\"'](?:\\./)?" + n + "[\"'][^>]*>\\s*<\\/script>",
          "gi",
        ),
        () =>
          '<script>window.addEventListener("DOMContentLoaded",function(){' +
          code.replace(/<\/script/gi, "<\\/script") +
          "\n});<\/script>",
      );
  });
  return html;
}

// php-wasm reports PHP-level parse errors, fatal errors, warnings and notices
// through the 'output' event, not 'error' - so they show up mixed into normal
// output text rather than on a separate channel. Detect them there instead.
const PHP_DIAG =
  /(?:^|\n)\s*(?:Parse error|Fatal error|Warning|Notice|Deprecated):/;

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
// A question with `sql: true` runs real PHP PDO code against a real, in-browser Postgres
// engine (PGlite) rather than any kind of simulation - `new PDO('pgsql:')` inside the
// student's code genuinely creates, inserts into, and queries tables. That engine has to be
// handed to PhpWeb at construction time (it can't be bolted onto an already-built engine), so
// the first time a SQL question is opened, the current engine is thrown away and rebuilt with
// it attached; every engine rebuild after that (including for non-SQL questions) keeps
// carrying it, since leaving it unused costs nothing and re-fetching it would be wasted work.
// Each `new PDO('pgsql:')` connection is a fresh, empty, in-memory database - exactly like
// every other piece of PHP state, it doesn't survive past the one Run/Debug/Tests click that
// created it, so a SQL question is written to create and seed its own tables each run.
let php = null,
  sinkText = "",
  sinkErrs = "",
  phpHasSql = false;
async function getPhp(needsSql) {
  if (php && (phpHasSql || !needsSql)) {
    await php.refresh();
    return php;
  }
  const args = {};
  if (needsSql) args.PGlite = (await loadPGlite()).PGlite;
  php = new PhpWeb(args);
  phpHasSql = !!needsSql;
  php.addEventListener("output", (e) => {
    sinkText += [].concat(e.detail).join("");
  });
  php.addEventListener("error", (e) => {
    sinkErrs += [].concat(e.detail).join("");
  });
  return php;
}

// The Run button and the Tests panel (tests.js) share the one PHP engine instance above,
// so only one of them may drive it at a time. This flag - and disabling both buttons -
// keeps a Run click and a Run Tests click from interleaving and corrupting each other's output.
let engineBusy = false;

// previewTarget names the file Preview should load next, overriding the exercise's real
// main file for that one click - set when a nav link inside Preview is followed (see
// resolveNavTarget/the message listener below). runFresh() (the Run button) always clears
// it back to '', so Run reliably returns to the exercise's actual entry point even after
// clicking around a multi-page preview; Tests and the Debugger (tests.js/debugger.js)
// never look at it at all, and always run the real main file.
let previewTarget = "";

async function run() {
  const btn = $("run"),
    tbtn = $("runTests"),
    dbtn = $("debug"),
    q = QUESTIONS[key];
  if (engineBusy) return;
  engineBusy = true;
  btn.disabled = true;
  btn.textContent = "Running…";
  tbtn.disabled = true;
  dbtn.disabled = true;
  sinkText = "";
  sinkErrs = "";
  try {
    const main = previewTarget || mainName;
    await phpReady;
    if (!PhpWeb)
      throw new Error(
        "The PHP engine could not be loaded (" +
          (window.__phpErr || "unknown error") +
          "). Check your connection or that cdn.jsdelivr.net is allowed.",
      );
    const engine = await getPhp(q.sql);
    for (const d of allFolders()) {
      try {
        await engine.mkdir("/" + d);
      } catch (e) {}
    }
    for (const n of allNames())
      await engine.writeFile(
        "/" + n,
        n.endsWith(".php") ? fix(docs[n].getValue()) : docs[n].getValue(),
      );
    await engine.run(wrap(docs[main].getValue(), $("stdin").value, req));
  } catch (err) {
    sinkErrs += String((err && err.message) || err);
    php = null; // the instance may be in a broken state after a JS-level failure; rebuild next run
  }
  const text = sinkText,
    errs = sinkErrs;
  const flagged = !!errs || PHP_DIAG.test(text);
  $("out").innerHTML =
    (flagged
      ? '<span class="e">' +
        esc(text) +
        (errs ? "\n" + esc(errs) : "") +
        "</span>"
      : esc(text)) || '<span class="m">(no output)</span>';
  if (q.preview) {
    // Switch to the Preview tab BEFORE writing the new page into the iframe, not
    // after. Setting srcdoc while the iframe is still hidden (display:none, from
    // switching away to Output/Tests/Debugger) and then revealing it in the same
    // tick can race with the iframe's own navigation - the page loads, but the
    // browser doesn't always paint it, leaving Preview looking blank until
    // something else forces a repaint (like switching tabs away and back, which is
    // exactly what was being seen). Showing the iframe first, then loading the page
    // into an already-visible frame, avoids that race entirely.
    view(flagged ? "out" : "prev");
    if (typeof resetConsolePanel === "function") resetConsolePanel(); // each srcdoc load starts a fresh page/console
    const nn = $("navNote");
    if (previewTarget) {
      nn.hidden = false;
      nn.textContent = "→ " + previewTarget;
    } else {
      nn.hidden = true;
    }
    const previewScale = (typeof zoomPct !== "undefined" ? zoomPct : 100) / 100;
    // BRIDGE goes in FIRST (injectBridge), not appended after the student's own markup/
    // scripts - it has to wrap console.* and attach window.onerror/unhandledrejection
    // before any of the student's own <script> content runs, or an error/log from that
    // early code (very common - it's often the first thing on the page) would run
    // against the ORIGINAL console/no error handler and never reach the Console tab.
    $("frame").srcdoc = injectZoomStyle(
      injectBridge(inline(text)),
      previewScale,
    );
  }
  engineBusy = false;
  btn.disabled = false;
  btn.textContent = "Run (Ctrl+Enter)";
  tbtn.disabled = !QUESTIONS[key].tests?.length;
  dbtn.disabled = false;
}
function runFresh() {
  req = { m: "get", d: {} };
  previewTarget = "";
  run();
}

window.addEventListener("message", (e) => {
  if (e.source !== $("frame").contentWindow || !e.data) return;
  if (e.data.fp === 1) {
    req = { m: e.data.m, d: e.data.d };
    run();
    return;
  }
  if (e.data.fp === 2) {
    if (typeof handleConsoleMessage === "function")
      handleConsoleMessage(e.data);
    return;
  }
  if (e.data.fp === 3) {
    const target = resolveNavTarget(e.data.href);
    if (target) {
      previewTarget = target.file;
      req = { m: "get", d: target.params };
      run();
    } else if (typeof handleConsoleMessage === "function")
      handleConsoleMessage({
        level: "warn",
        text:
          'Clicked link "' +
          e.data.href +
          '" does not match a .php/.html file in this project, so nothing happened.',
      });
    return;
  }
});
$("run").onclick = runFresh;
loadQuestion();
