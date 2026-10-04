// A "step debugger" for the main PHP file. php-wasm runs a script start-to-finish in
// one call - it can't be paused mid-execution and inspected the way a desktop debugger
// (Xdebug, breakpoints, "continue") can. So instead this RECORDS a full trace of the
// program the first time it runs - every executed statement's line number and the
// variables that exist at that point - and lets the student step back and forth
// through that recording afterwards, like scrubbing a video. It can't catch an
// infinite loop (there's a 5000-step safety cap - see __cap() below - but a script
// that never finishes still won't finish), and it only instruments the CURRENT main
// file, not files it includes/requires.
//
// How the instrumentation works: a small PHP script (INSTRUMENTER_PHP) tokenizes the
// student's code with token_get_all() and, after every statement-ending ';' token
// that ISN'T inside a for(...)'s own parentheses (paren depth is tracked so
// `for ($i=0; $i<10; $i++)` is left alone) and isn't a declaration directly inside a
// class body (brace depth is tracked too), splices in a call to __cap(), which
// records get_defined_vars() - called at that exact point in that exact scope, so it
// always captures the right variables. Because this only ever APPENDS a harmless new
// statement right after an existing one, it can't break the surrounding code's
// structure (if/else, loops, alternate `endif;` syntax, closures, etc. are untouched).

const INSTRUMENTER_PHP = `<?php
$__src = file_get_contents('/__dbgsrc.php');
$__tokens = token_get_all($__src);
$__out = '';
$__paren = 0;
$__inphp = false;
$__line = 1;
// One entry per open '{': true when it opened a class/interface/trait/enum body, where
// only declarations (properties, constants, abstract methods) may appear - a __cap()
// call there is a parse error, so nothing is spliced in until a method body opens.
// $__pending remembers whether the NEXT '{' belongs to a class-like or a function.
$__classBody = array();
$__pending = null;
$__prevId = null;
$__classLike = array(T_CLASS, T_INTERFACE, T_TRAIT);
if (defined('T_ENUM')) $__classLike[] = T_ENUM;
// A __cap() call isn't spliced in the instant a ';' is seen - it waits for the next
// real token, because in a brace-less 'if (...) a; else b;' or 'do a; while (...);'
// a statement wedged between the ';' and that 'else'/'while' is a parse error.
$__capAt = null;
$__capCode = '';
$__afterDo = false;
$__bareDo = 0;
foreach ($__tokens as $__t) {
  if (is_array($__t)) {
    $__id = $__t[0]; $__text = $__t[1]; $__line = $__t[2];
  } else {
    $__text = $__t; $__id = null;
  }
  if (!in_array($__id, array(T_WHITESPACE, T_COMMENT, T_DOC_COMMENT), true)) {
    if ($__afterDo) { if ($__text !== '{') $__bareDo++; $__afterDo = false; }
    if ($__capAt !== null) {
      if ($__id === T_WHILE && $__bareDo > 0) $__bareDo--;
      elseif ($__id !== T_ELSE && $__id !== T_ELSEIF) $__out = substr($__out, 0, $__capAt) . $__capCode . substr($__out, $__capAt);
      $__capAt = null;
    }
    if ($__id === T_DO) $__afterDo = true;
  }
  if ($__id === T_OPEN_TAG || $__id === T_OPEN_TAG_WITH_ECHO) $__inphp = true;
  if ($__id === T_CLOSE_TAG) $__inphp = false;
  $__out .= $__text;
  if ($__inphp) {
    $__inClass = count($__classBody) > 0 && end($__classBody);
    if ($__id !== null) {
      // Foo::class is a constant lookup, not a class declaration.
      if (in_array($__id, $__classLike, true) && $__prevId !== T_DOUBLE_COLON) $__pending = 'class';
      elseif ($__id === T_FUNCTION) $__pending = 'func';
      elseif ($__id === T_CURLY_OPEN || $__id === T_DOLLAR_OPEN_CURLY_BRACES) $__classBody[] = $__inClass;
      if (!in_array($__id, array(T_WHITESPACE, T_COMMENT, T_DOC_COMMENT), true)) $__prevId = $__id;
    } else {
      $__prevId = null;
      if ($__text === '(') { $__paren++; }
      elseif ($__text === ')') { if ($__paren > 0) $__paren--; }
      elseif ($__text === '{') {
        // A brace that is neither a class nor a function body (if/while/match, or a
        // trait-adaptation/property-hook block inside a class) keeps its parent's context.
        $__classBody[] = $__pending === 'class' ? true : ($__pending === 'func' ? false : $__inClass);
        $__pending = null;
      }
      elseif ($__text === '}') { array_pop($__classBody); }
      elseif ($__text === ';') {
        $__pending = null;
        if ($__paren === 0 && !$__inClass) { $__capAt = strlen($__out); $__capCode = '__cap(get_defined_vars(),' . $__line . ');'; }
      }
    }
  }
  $__line += substr_count($__text, "\\n");
}
if ($__capAt !== null) $__out = substr($__out, 0, $__capAt) . $__capCode . substr($__out, $__capAt);
// Always hand back code that ends OUTSIDE of an open PHP tag (closing it here if the
// student's own file never did) - so wrapDebug() can safely append its own trailing
// block of PHP code below without caring whether the student's code closed its own
// tag, left it open, or the file has several separate PHP sections with HTML between.
// (Deliberately not spelling out the actual open/close tag names in this comment -
// PHP's tokenizer ends a comment the moment it sees that closing sequence, even
// inside a line comment, so writing it literally here would truncate this script.)
if ($__inphp) $__out .= chr(63) . '>';
echo '<<<DBGSRC>>>' . base64_encode($__out);
`;

// Mirrors php-runner.js's wrap() prelude (readline/$_POST/$_GET setup), but adds the
// trace-capture machinery, and appends a small closing <?php ?> block of its own after
// the student's code that echoes the trace as JSON. (register_shutdown_function() would
// be the more typical way to guarantee this runs last, but this php-wasm build doesn't
// appear to invoke shutdown functions' output at all - verified empirically - so this
// runs the trace-dump as ordinary trailing code instead. That means it's skipped if the
// student's own code calls exit()/die(), same as anything else after that point would be.)
function wrapDebug(instrumentedCode, stdin, r) {
  const pre =
    '<?php $__in=json_decode(base64_decode("' +
    b64(JSON.stringify(stdinLines(stdin))) +
    '"),true);' +
    'function __rl($p=""){global $__in;echo $p;return count($__in)?array_shift($__in):false;}' +
    '$__r=json_decode(base64_decode("' +
    b64(JSON.stringify(r)) +
    '"),true);' +
    'if($__r["m"]==="post"){$_POST=$__r["d"];$_SERVER["REQUEST_METHOD"]="POST";}else{$_GET=$__r["d"];$_SERVER["REQUEST_METHOD"]="GET";}' +
    '$_REQUEST=$__r["d"];unset($__r);' +
    // __safe() makes any captured value JSON-encodable (objects/resources can't be
    // json_encode()'d directly), and is depth-limited so a self-referential or very
    // deep structure can't hang the encoder.
    'function __safe($v,$d=0){if($d>6)return "…";if(is_array($v)){$o=array();foreach($v as $k=>$vv)$o[$k]=__safe($vv,$d+1);return $o;}' +
    'if(is_object($v)){$o=array("__class"=>get_class($v));foreach(get_object_vars($v) as $k=>$vv)$o[$k]=__safe($vv,$d+1);return $o;}' +
    'if(is_resource($v))return "[resource]";return $v;}' +
    '$GLOBALS["__trace"]=array();' +
    // The cap at 5000 steps keeps a runaway loop in the student's code from growing
    // this array (and the deep-copies __safe() makes of it) without bound and
    // crashing the tab - it does not stop the loop itself from still running.
    'function __cap($vars,$line){if(count($GLOBALS["__trace"])>=5000)return;unset($vars["__trace"]);$GLOBALS["__trace"][]=array("line"=>$line,"vars"=>__safe($vars));}' +
    " ?>";
  const trailer =
    '<?php echo "\\n<<<DBGTRACE>>>".base64_encode(json_encode($GLOBALS["__trace"])); ?>';
  return pre + instrumentedCode + trailer;
}

// Tokenizing is itself a PHP run through the same shared engine - see getPhp() in
// php-runner.js - so it takes its turn behind the engineBusy lock like Run/Tests do.
async function instrumentSource(src, needsSql) {
  const engine = await getPhp(needsSql);
  await engine.writeFile("/__dbgsrc.php", src);
  sinkText = "";
  sinkErrs = "";
  await engine.run(INSTRUMENTER_PHP);
  const marker = "<<<DBGSRC>>>";
  const idx = sinkText.indexOf(marker);
  if (idx === -1)
    throw new Error(
      "Could not prepare the code for debugging." +
        (sinkErrs ? " " + sinkErrs : ""),
    );
  // atob() alone yields one JS char per BYTE - decode those bytes as UTF-8, or any
  // non-ASCII text in the file (é, –, 🎬...) comes back as mojibake like "CafÃ©".
  const bin = atob(sinkText.slice(idx + marker.length).trim());
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// var, not let/const: loadQuestion() (editor-ui.js) calls resetDebugState() - guarded
// by a typeof check for a real browser, where this script hasn't loaded yet the first
// time that happens, but in a build that concatenates every file into one script (the
// standalone single-file version, and this project's own test harness), a `let` here
// would sit in the temporal dead zone at that point even though the function itself
// is already hoisted and callable - `var` is hoisted AND initialized immediately, so
// it works the same way in both a real browser and a concatenated build.
var debugTrace = [],
  debugStep = 0,
  dbgHighlightLine = null;

// Variables the student never wrote themselves - our own instrumentation plumbing,
// and PHP's superglobals - so the Variables panel only ever shows what they wrote.
const DEBUG_HIDDEN_VARS = new Set([
  "__trace",
  "__in",
  "__r",
  "GLOBALS",
  "_GET",
  "_POST",
  "_REQUEST",
  "_SERVER",
  "_COOKIE",
  "_SESSION",
  "_FILES",
  "_ENV",
  "argv",
  "argc",
  "http_response_header",
  "this",
]);

function formatDebugVal(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  try {
    return JSON.stringify(v);
  } catch (e) {
    return String(v);
  }
}

function renderDebugVars(vars) {
  const names = Object.keys(vars || {})
    .filter((k) => !DEBUG_HIDDEN_VARS.has(k))
    .sort();
  $("dbgVars").innerHTML = names.length
    ? names
        .map(
          (k) =>
            '<div class="dbgVarRow"><code class="dbgVarName">$' +
            esc(k) +
            '</code><code class="dbgVarVal">' +
            esc(formatDebugVal(vars[k])) +
            "</code></div>",
        )
        .join("")
    : '<p class="testNote">No variables defined yet at this step.</p>';
}

function clearDebugHighlight() {
  // Loose check on purpose: in a build that concatenates every file into one script
  // (the standalone HTML version), this can run before debugger.js's own `var
  // dbgHighlightLine = null;` line has executed - var is hoisted but starts out as
  // plain `undefined` until that line runs, not yet `null` - so a strict `!== null`
  // check would wrongly treat that as "there's a real line number to clear".
  if (dbgHighlightLine != null && docs[mainName])
    docs[mainName].removeLineClass(dbgHighlightLine, "background", "dbgLine");
  dbgHighlightLine = null;
}
function highlightDebugLine(line) {
  clearDebugHighlight();
  const doc = docs[mainName];
  if (!doc) return;
  const l = Math.max(0, Math.min(line - 1, doc.lineCount() - 1));
  doc.addLineClass(l, "background", "dbgLine");
  dbgHighlightLine = l;
  if (cur === mainName) cm.scrollIntoView({ line: l, ch: 0 }, 80);
}

function renderDebugStep(i) {
  const n = debugTrace.length;
  debugStep = n ? Math.max(0, Math.min(i, n - 1)) : 0;
  $("dbgSlider").max = String(Math.max(0, n - 1));
  $("dbgSlider").value = String(debugStep);
  $("dbgSlider").disabled = n === 0;
  $("dbgFirst").disabled = $("dbgPrev").disabled = n === 0 || debugStep === 0;
  $("dbgNext").disabled = $("dbgLast").disabled = n === 0 || debugStep >= n - 1;
  if (n === 0) {
    $("dbgStepLabel").textContent = "";
    $("dbgLineInfo").textContent = "";
    $("dbgVars").innerHTML = "";
    clearDebugHighlight();
    return;
  }
  const entry = debugTrace[debugStep];
  $("dbgStepLabel").textContent = "Step " + (debugStep + 1) + " of " + n;
  $("dbgLineInfo").textContent = "Line " + entry.line;
  renderDebugVars(entry.vars);
  highlightDebugLine(entry.line);
}

// Resets the whole panel back to its "hasn't run yet" state - called when switching
// questions (a trace from a different question's code makes no sense to keep around)
// and once up front to set up the initial UI.
// setDebugState() may overwrite the empty-state text, so keep the original to restore.
var DEBUG_EMPTY_HTML = null;
function resetDebugState() {
  debugTrace = [];
  debugStep = 0;
  clearDebugHighlight();
  $("dbgFileName").textContent = mainName || "";
  $("dbgError").hidden = true;
  $("dbgError").innerHTML = "";
  $("dbgBody").hidden = true;
  // Loose == on purpose: undefined (not yet null) in a concatenated build - see clearDebugHighlight.
  if (DEBUG_EMPTY_HTML == null) DEBUG_EMPTY_HTML = $("dbgEmpty").innerHTML;
  $("dbgEmpty").innerHTML = DEBUG_EMPTY_HTML;
  $("dbgEmpty").hidden = false;
}

function setDebugState(trace, output, errs, flagged) {
  debugTrace = trace || [];
  $("dbgFileName").textContent = mainName;
  if (flagged) {
    $("dbgError").hidden = false;
    $("dbgError").innerHTML =
      '<span class="e">' +
      esc(output || "") +
      (errs ? "\n" + esc(errs) : "") +
      "</span>";
  } else {
    $("dbgError").hidden = true;
    $("dbgError").innerHTML = "";
  }
  const hasSteps = debugTrace.length > 0;
  $("dbgEmpty").hidden = hasSteps;
  $("dbgBody").hidden = !hasSteps;
  if (!hasSteps && !flagged) {
    $("dbgEmpty").textContent =
      "No statements were recorded - is there any executable PHP code in " +
      mainName +
      "?";
  }
  renderDebugStep(hasSteps ? trace.length - 1 : 0);
}

const DEBUG_BTN_LABEL = $("debug").innerHTML;

async function runDebug() {
  const btn = $("debug"),
    runBtn = $("run"),
    testBtn = $("runTests");
  if (engineBusy) return;
  engineBusy = true;
  btn.disabled = true;
  btn.textContent = "Debugging…";
  runBtn.disabled = true;
  testBtn.disabled = true;
  view("debug");
  try {
    const main = mainName,
      q = QUESTIONS[key];
    await phpReady;
    if (!PhpWeb)
      throw new Error(
        "The PHP engine could not be loaded (" +
          (window.__phpErr || "unknown error") +
          ").",
      );
    const instrumented = await instrumentSource(
      fix(docs[main].getValue()),
      q.sql,
    );
    sinkText = "";
    sinkErrs = "";
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
    await engine.run(wrapDebug(instrumented, $("stdin").value, req));
    const marker = "\n<<<DBGTRACE>>>";
    const idx = sinkText.indexOf(marker);
    let trace = [],
      output = sinkText;
    if (idx !== -1) {
      output = sinkText.slice(0, idx);
      try {
        trace = JSON.parse(atob(sinkText.slice(idx + marker.length).trim()));
      } catch (e) {
        trace = [];
      }
    }
    const flagged = !!sinkErrs || PHP_DIAG.test(output);
    // A debug run executes the real program too, so its actual output is shown in the
    // Output/Preview tabs exactly as a normal Run would - the debugger doesn't replace
    // those, it adds a way to see how that output came to be.
    $("out").innerHTML =
      (flagged
        ? '<span class="e">' +
          esc(output) +
          (sinkErrs ? "\n" + esc(sinkErrs) : "") +
          "</span>"
        : esc(output)) || '<span class="m">(no output)</span>';
    if (QUESTIONS[key].preview) {
      const previewScale =
        (typeof zoomPct !== "undefined" ? zoomPct : 100) / 100;
      // Same as run(): a fresh page gets a fresh console, and BRIDGE must go in first.
      if (typeof resetConsolePanel === "function") resetConsolePanel();
      $("navNote").hidden = true; // Debug always runs the main file, never a followed link
      $("frame").srcdoc = injectZoomStyle(
        injectBridge(inline(output)),
        previewScale,
      );
    }
    setDebugState(trace, output, sinkErrs, flagged);
  } catch (err) {
    php = null; // the instance may be in a broken state after a JS-level failure
    setDebugState([], String((err && err.message) || err), "", true);
  }
  engineBusy = false;
  btn.disabled = false;
  btn.innerHTML = DEBUG_BTN_LABEL;
  runBtn.disabled = false;
  testBtn.disabled = !QUESTIONS[key].tests?.length;
}

$("debug").onclick = runDebug;
$("vDebug").onclick = () => view("debug");
$("dbgFirst").onclick = () => renderDebugStep(0);
$("dbgPrev").onclick = () => renderDebugStep(debugStep - 1);
$("dbgNext").onclick = () => renderDebugStep(debugStep + 1);
$("dbgLast").onclick = () => renderDebugStep(debugTrace.length - 1);
$("dbgSlider").oninput = () =>
  renderDebugStep(parseInt($("dbgSlider").value, 10) || 0);

resetDebugState();
