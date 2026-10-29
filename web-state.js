// Cookies, sessions and file uploads for the editor's PHP runs.
//
// Every Run is a single, isolated PHP request inside php-wasm, so nothing a real web
// server and browser would carry from one request to the next survives by itself: a
// setcookie() header goes nowhere, $_SESSION is never written back (this build of the
// engine never runs request shutdown - no shutdown functions, no automatic session
// save - verified empirically), and a form's <input type="file"> was simply dropped.
// This file plays the browser's and the server's part instead:
//
//  - Cookies: a small cookie jar per question (kept in sessionStorage, so it lasts for
//    the browser tab, like real session cookies). Its live values become $_COOKIE at
//    the start of each request, and every "Set-Cookie" header the page sends (read
//    back from headers_list() at the end) updates the jar - including expiring a
//    cookie by setting it in the past, exactly as setcookie() is used to delete one.
//  - Sessions: $_SESSION is stored per question too. The prelude writes it into the
//    session file PHP's own session_start() reads, under a fixed session id, and the
//    end-of-request hook reads it back - so session_start(), $_SESSION,
//    session_write_close() and session_destroy() all behave as they do on a server.
//  - Uploads: the preview's form bridge sends each chosen file's bytes, which are
//    written to a temp file and described in $_FILES exactly the way PHP does it
//    (name, full_path, type, tmp_name, error, size - including error 4 for "no file
//    chosen" and error 1 for a file over upload_max_filesize). Like a browser, it only
//    sends file contents for a POST form with enctype="multipart/form-data"; without
//    that, PHP just gets the file's name as plain text, which is the classic mistake.
//    move_uploaded_file(), is_uploaded_file() and mime_content_type() are routed to
//    small stand-ins (see fix() in php-runner.js), because the real ones can't work
//    here: PHP only accepts files that arrived through its own HTTP upload parser,
//    and this build has no fileinfo extension.
//
// The end-of-request hook runs as ordinary code appended after the student's file, so
// it is skipped by a fatal error or an uncaught exception - the same run's cookie and
// session changes are then lost, which only ever happens to a page that's already
// failing. exit/die are rewritten to call the hook first, so the common
// "header('Location: ...'); exit;" pattern still saves its cookies and session.

const WEB_STATE_FILE = "/tmp/__editor_state.json";
const UPLOAD_MAX_BYTES = 2 * 1024 * 1024; // PHP's default upload_max_filesize (2M)

// One line, no newlines: it sits on line 1 with the rest of wrap()'s prelude, so PHP's
// error line numbers keep matching the editor.
const WEB_PRELUDE =
  '$_COOKIE=is_array($__r["c"]??null)?$__r["c"]:[];' +
  '$GLOBALS["__up"]=[];' +
  'if($__r["m"]==="post"){$_FILES=is_array($__r["f"]??null)?$__r["f"]:[];' +
  'array_walk_recursive($_FILES,function($v,$k){if($k==="tmp_name"&&$v!=="")$GLOBALS["__up"][]=$v;});}' +
  'ini_set("session.save_path","/tmp");ini_set("session.serialize_handler","php_serialize");' +
  'ini_set("session.use_cookies","0");ini_set("session.cache_limiter","");' +
  'session_id("editor");@unlink("/tmp/sess_editor");@unlink("' + WEB_STATE_FILE + '");' +
  // The session is seeded from its exact serialized text when there is one (so objects
  // come back as objects), or from a test's plain array.
  'if(isset($__r["sr"])&&is_string($__r["sr"])&&$__r["sr"]!=="")file_put_contents("/tmp/sess_editor",$__r["sr"]);' +
  'elseif(!empty($__r["s"])&&is_array($__r["s"]))file_put_contents("/tmp/sess_editor",serialize($__r["s"]));' +
  // A warning from a stand-in reports the student's own line (the caller's), not line 1
  // where these functions live - and goes to their set_error_handler() if they have one.
  'function __warn($m){$b=debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS,2);$c=$b[1]??$b[0];$f=$c["file"]??"";$l=$c["line"]??0;' +
  '$h=set_error_handler(null);restore_error_handler();if($h){$h(E_WARNING,$m,$f,$l);return;}' +
  'if(error_reporting()&E_WARNING)echo PHP_EOL,"Warning: ",$m," in ",$f," on line ",$l,PHP_EOL;}' +
  'function __iuf($f){return is_string($f)&&in_array($f,$GLOBALS["__up"],true)&&is_file($f);}' +
  'function __muf($f,$t){if(!__iuf($f))return false;' +
  'if(!@rename($f,$t)){__warn("move_uploaded_file(): Unable to move \\"".$f."\\" to \\"".$t."\\"");return false;}' +
  '$GLOBALS["__up"]=array_values(array_diff($GLOBALS["__up"],[$f]));return true;}' +
  'function __mct($f){if(!is_file($f)){__warn("mime_content_type(".$f."): Failed to open stream: No such file or directory");return false;}' +
  '$i=@getimagesize($f);if($i&&!empty($i["mime"]))return $i["mime"];' +
  '$h=(string)file_get_contents($f,false,null,0,512);if($h==="")return "application/x-empty";' +
  'if(strncmp($h,"%PDF",4)===0)return "application/pdf";' +
  'return preg_match("/[\\\\x00-\\\\x08\\\\x0e-\\\\x1f]/",$h)?"application/octet-stream":"text/plain";}' +
  // filter_input() & co read the real request, which this engine never has - so the
  // stand-ins read the same $_GET / $_POST / $_COOKIE the page already sees.
  'function __fsrc($t){return $t===INPUT_POST?$_POST:($t===INPUT_GET?$_GET:($t===INPUT_COOKIE?$_COOKIE:($t===INPUT_SERVER?$_SERVER:($t===INPUT_ENV?$_ENV:[]))));}' +
  'function __fhv($t,$n){return array_key_exists($n,__fsrc($t));}' +
  'function __fi($t,$n,$f=FILTER_DEFAULT,$o=0){$s=__fsrc($t);$fl=is_array($o)?($o["flags"]??0):$o;' +
  'if(!array_key_exists($n,$s))return($fl&FILTER_NULL_ON_FAILURE)?false:null;return filter_var($s[$n],$f,$o);}' +
  'function __fia($t,$d=FILTER_DEFAULT,$e=true){$s=__fsrc($t);return is_array($d)?filter_var_array($s,$d,$e):filter_var_array($s,$d);}' +
  // The end-of-request hook: Set-Cookie headers, plus the session both as plain data (for
  // the Storage tab and tests) and as its exact serialized text (to restore it next time).
  // After session_write_close()/session_regenerate_id() it reads the session's own file.
  'function __editor_end(){static $done=false;if($done)return;$done=true;$s=null;$raw=null;' +
  'if(session_status()===PHP_SESSION_ACTIVE){$s=$_SESSION;$raw=serialize($_SESSION);}' +
  'else{$sf="/tmp/sess_".(session_id()?:"editor");if(is_file($sf)){$raw=(string)file_get_contents($sf);$s=@unserialize($raw);if($s===false){$s=null;$raw=null;}}}' +
  '@file_put_contents("' + WEB_STATE_FILE + '",json_encode(["h"=>headers_list(),"s"=>$s,"r"=>$raw],JSON_PARTIAL_OUTPUT_ON_ERROR|JSON_INVALID_UTF8_SUBSTITUTE));}' +
  'function __ee($s=0){__editor_end();exit($s);}';

// Appended right after the student's code (no newline added, so nothing shifts). If the
// file ends while still in PHP mode, "?>" closes it first - which also supplies a missing
// final semicolon, exactly as PHP itself treats "?>". Whether it does is decided by
// php-source.js, so a "?>" inside a string or comment can't fool it.
function webTrailer(code) {
  return (phpPieces(code).endsInPhp ? "?>" : "") + "<?php __editor_end(); ?>";
}

// ---------- per-question cookie jar and session store ----------
function webJar() {
  try {
    const j = JSON.parse(load("jar:" + key) || "{}");
    return j && typeof j === "object" ? j : {};
  } catch (e) {
    return {};
  }
}
function saveJar(j) {
  store("jar:" + key, Object.keys(j).length ? JSON.stringify(j) : undefined);
}
function liveCookies() {
  const j = webJar(),
    now = Date.now(),
    out = {};
  let changed = false;
  for (const n in j) {
    if (j[n].exp !== null && j[n].exp <= now) {
      delete j[n];
      changed = true;
    } else out[n] = j[n].v;
  }
  if (changed) saveJar(j);
  return out;
}
function webSession() {
  try {
    const v = load("sess:" + key);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}
// The session is kept twice: as plain data for the Storage tab, and as PHP's own
// serialized text (raw), which is what the next request restores - so an object stored
// in $_SESSION comes back as that object, not as an array.
function saveSession(s, raw) {
  const empty = s === null || (typeof s === "object" && !Object.keys(s).length);
  store("sess:" + key, empty ? undefined : JSON.stringify(s));
  store("sessraw:" + key, empty || !raw ? undefined : raw);
}

// "Set-Cookie: name=value; expires=...; Max-Age=0; path=/" -> { name, value, exp }.
// exp is a timestamp in ms, null for a session cookie (no expiry), and in the past for
// a deletion. PHP url-encodes the value (spaces become "+"), and decodes $_COOKIE the
// same way, so the jar keeps the decoded text.
function parseSetCookies(headers) {
  const out = [];
  for (const h of headers || []) {
    const m = /^Set-Cookie:\s*([^=;]+)=([^;]*)(.*)$/i.exec(h);
    if (!m) continue;
    let value;
    try {
      value = decodeURIComponent(m[2].replace(/\+/g, " "));
    } catch (e) {
      value = m[2];
    }
    let exp = null;
    const ma = /;\s*Max-Age=(-?\d+)/i.exec(m[3]);
    const ex = /;\s*expires=([^;]+)/i.exec(m[3]);
    if (ma) exp = Date.now() + Number(ma[1]) * 1000;
    else if (ex) {
      const t = Date.parse(ex[1].replace(/-/g, " "));
      if (!isNaN(t)) exp = t;
    }
    if (m[2] === "deleted") exp = 0;
    out.push({ name: m[1].trim(), value, exp });
  }
  return out;
}

// ---------- uploads ----------
let uploadSeq = 0;
// items: [{k, name, type, size, buf}] or [{k, empty:1}] from the preview's form bridge.
function buildFiles(items) {
  const f = {},
    up = [];
  for (const it of items || []) {
    let e;
    if (it.empty) e = { name: "", full_path: "", type: "", tmp_name: "", error: 4, size: 0 };
    else if (it.size > UPLOAD_MAX_BYTES)
      e = { name: it.name, full_path: it.name, type: "", tmp_name: "", error: 1, size: 0 };
    else {
      const tmp = "/tmp/php" + (++uploadSeq).toString(36) + Math.random().toString(36).slice(2, 8);
      up.push({ tmp, data: new Uint8Array(it.buf || new ArrayBuffer(0)) });
      e = { name: it.name, full_path: it.name, type: it.type || "application/octet-stream", tmp_name: tmp, error: 0, size: it.size };
    }
    if (it.k.endsWith("[]")) {
      const b = it.k.slice(0, -2);
      f[b] = f[b] || { name: [], full_path: [], type: [], tmp_name: [], error: [], size: [] };
      for (const p in e) f[b][p].push(e[p]);
    } else f[it.k] = e;
  }
  return { f, up };
}

// A test's simulated upload: { name, type?, size?, width?, height?, error? }. With a
// width/height it becomes a real (tiny) PNG of that size, padded to `size` bytes, so
// getimagesize() and filesize() both report what the test describes. Without them it's
// filler bytes ("%PDF-" first for a .pdf, so mime_content_type() sees a PDF).
const MIME_BY_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", txt: "text/plain" };
function fakeUploadBytes(spec) {
  const size = Math.max(spec.size ?? 1024, 0);
  let head;
  if (spec.width && spec.height) {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    const dv = new DataView(b.buffer);
    dv.setUint32(16, spec.width);
    dv.setUint32(20, spec.height);
    b.set([8, 2, 0, 0, 0], 24); // 8-bit RGB; the CRC bytes stay 0 - getimagesize() never checks them
    head = b;
  } else if (/\.pdf$/i.test(spec.name || "")) head = new TextEncoder().encode("%PDF-1.4\n");
  else head = new TextEncoder().encode("x");
  const out = new Uint8Array(Math.max(size, head.length));
  out.set(head);
  return out;
}
function testFiles(spec) {
  const items = [];
  for (const k in spec || {}) {
    const s = spec[k];
    if (!s || s.error === 4) {
      items.push({ k, empty: 1 });
      continue;
    }
    const ext = (s.name || "").split(".").pop().toLowerCase();
    items.push({ k, name: s.name, type: s.type ?? MIME_BY_EXT[ext] ?? "application/octet-stream", size: s.size ?? 1024, buf: fakeUploadBytes(s).buffer, forceError: s.error });
  }
  const built = buildFiles(items);
  // A test can ask for any upload error directly (1 too big for the server, 2 too big for
  // the form, 3 partial, 6/7 server problems), whatever the size: no file, like PHP.
  const count = {};
  items.forEach((it) => {
    const k = it.k.endsWith("[]") ? it.k.slice(0, -2) : it.k,
      idx = count[k] = (count[k] ?? -1) + 1,
      e = it.forceError;
    if (!e || e === 4 || !built.f[k]) return;
    const fix = { type: "", tmp_name: "", error: e, size: 0 };
    if (it.k.endsWith("[]")) for (const p in fix) built.f[k][p][idx] = fix[p];
    else Object.assign(built.f[k], fix);
  });
  return built;
}

// ---------- the request, before and after a run ----------
// The request object wrap() serializes into the prelude. `live` = this is a real Run/
// Debug in the preview (use and update the jar/session store); otherwise `seed` gives a
// test's own starting cookies/session/uploads and nothing is persisted.
function webRequest(r, seed) {
  const base = { m: r.m, d: r.d };
  if (typeof r.q === "string") base.q = r.q; // the form's own query string (name[] arrays)
  if (r.gq) base.gq = r.gq; // a POST form's action?query, for $_GET
  if (seed) {
    const t = testFiles(seed.files);
    return { ...base, c: seed.cookies || {}, s: seed.session || null, f: t.f, up: t.up };
  }
  const b = buildFiles(r.files);
  return { ...base, c: liveCookies(), s: webSession(), sr: load("sessraw:" + key) || "", f: b.f, up: b.up };
}
// Every file call that fails inside php-wasm (reading a missing file, creating a folder
// that exists) also leaks an uncaught "ErrnoError" into the page, even when the promise
// is caught - so nothing here makes a call that can fail. /tmp always exists, the state
// file's existence is checked first, and the prelude deletes the previous one itself.
async function ensureDir(engine, path) {
  try {
    const a = await engine.analyzePath(path);
    if (!a || !a.exists) await engine.mkdir(path);
  } catch (e) {}
}
async function prepareWebRequest(engine, wr) {
  for (const u of wr.up || []) await engine.writeFile(u.tmp, u.data);
}
// Upload temp files that the page didn't move are deleted after each request, as PHP does.
async function cleanupWebRequest(engine, wr) {
  for (const u of wr.up || []) {
    try {
      const a = await engine.analyzePath(u.tmp);
      if (a && a.exists) await engine.unlink(u.tmp);
    } catch (e) {}
  }
}
async function readWebState(engine) {
  let st = null;
  try {
    const a = await engine.analyzePath(WEB_STATE_FILE);
    if (a && a.exists) st = JSON.parse(await engine.readFile(WEB_STATE_FILE, { encoding: "utf8" }));
  } catch (e) {}
  if (!st) return null;
  return { cookies: parseSetCookies(st.h), session: st.s ?? null, raw: st.r ?? null };
}
// After a live Run/Debug: fold the page's Set-Cookie headers into the jar and keep its
// session. null state (the script died before the end) leaves both as they were.
function persistWebState(st) {
  if (st) {
    const j = webJar();
    for (const c of st.cookies) {
      if (c.exp !== null && c.exp <= Date.now()) delete j[c.name];
      else j[c.name] = { v: c.value, exp: c.exp };
    }
    saveJar(j);
    saveSession(st.session, st.raw);
  }
  renderStoragePanel();
}

// ---------- Storage tab ----------
function renderStoragePanel() {
  const panel = $("storagePanel");
  if (!panel) return;
  const j = webJar(),
    names = Object.keys(j),
    s = webSession();
  const fmtExp = (e) => (e === null ? "When the tab closes" : new Date(e).toLocaleString());
  $("storageCookies").innerHTML = names.length
    ? '<table class="storageTable"><thead><tr><th>Name</th><th>Value</th><th>Expires</th></tr></thead><tbody>' +
      names
        .map((n) => "<tr><td><code>" + esc(n) + "</code></td><td><code>" + esc(String(j[n].v)) + "</code></td><td>" + esc(fmtExp(j[n].exp)) + "</td></tr>")
        .join("") +
      "</tbody></table>"
    : '<p class="testNote">No cookies set yet.</p>';
  $("storageSession").innerHTML =
    s && Object.keys(s).length
      ? '<pre class="storagePre">' + esc(JSON.stringify(s, null, 2)) + "</pre>"
      : '<p class="testNote">No session data yet.</p>';
}
function clearCookies() {
  saveJar({});
  renderStoragePanel();
}
function clearSessionStore() {
  saveSession(null, null);
  renderStoragePanel();
}
