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

const BRIDGE =
  '<script>document.addEventListener("submit",function(e){e.preventDefault();var f=e.target,d={};' +
  'new FormData(f).forEach(function(v,k){if(typeof v==="string")d[k]=v});' +
  'parent.postMessage({fp:1,m:(f.getAttribute("method")||"get").toLowerCase(),d:d},"*")},true);' +
  'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");' +
  'if(a&&a.getAttribute("href").charAt(0)!=="#")e.preventDefault()},true)<\/script>';

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

async function run() {
  const btn = $("run"),
    q = QUESTIONS[key];
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Running…";
  let text = "",
    errs = "";
  try {
    const main = mainName;
    await phpReady;
    if (!PhpWeb)
      throw new Error(
        "The PHP engine could not be loaded (" +
          (window.__phpErr || "unknown error") +
          "). Check your connection or that cdn.jsdelivr.net is allowed.",
      );
    const php = new PhpWeb();
    php.addEventListener("output", (e) => {
      text += [].concat(e.detail).join("");
    });
    php.addEventListener("error", (e) => {
      errs += [].concat(e.detail).join("");
    });
    for (const d of allFolders()) {
      try {
        await php.mkdir("/" + d);
      } catch (e) {}
    }
    for (const n of allNames())
      await php.writeFile(
        "/" + n,
        n.endsWith(".php") ? fix(docs[n].getValue()) : docs[n].getValue(),
      );
    await php.run(wrap(docs[main].getValue(), $("stdin").value, req));
  } catch (err) {
    errs += String((err && err.message) || err);
  }
  $("out").innerHTML =
    esc(text) +
      (errs
        ? '<span class="e">' + (text ? "\n" : "") + esc(errs) + "</span>"
        : "") || '<span class="m">(no output)</span>';
  if (q.preview) {
    $("frame").srcdoc = inline(text) + BRIDGE;
    view(errs ? "out" : "prev");
  }
  btn.disabled = false;
  btn.textContent = "Run (Ctrl+Enter)";
}
function runFresh() {
  req = { m: "get", d: {} };
  run();
}

window.addEventListener("message", (e) => {
  if (e.source !== $("frame").contentWindow || !e.data || !e.data.fp) return;
  req = { m: e.data.m, d: e.data.d };
  run();
});
$("run").onclick = runFresh;
loadQuestion();
