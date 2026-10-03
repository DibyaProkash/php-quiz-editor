// A lightweight stand-in for the browser's own DevTools console, scoped to the Preview
// iframe. The iframe is sandboxed (no allow-same-origin), so nothing outside it can reach
// into its window directly - instead, the BRIDGE script injected into the previewed page
// itself (php-runner.js) wraps console.log/info/warn/error and window.onerror/
// unhandledrejection, and reports each one back here over postMessage (fp:2 messages,
// handled in php-runner.js's existing message listener). This panel just renders what
// arrives; php-runner.js's run() clears it at the start of every Run, since each Run loads
// a brand new page into the iframe.

const CONSOLE_ICON = {
  log: "",
  info: "ℹ️ ",
  warn: "⚠️ ",
  error: "⛔ ",
};

// var, not let/const: in the concatenated single-script builds (the jsdom test harness and
// the standalone HTML), loadQuestion() (editor-ui.js) can run before this file's own
// top-level code has executed yet - its guarded call here needs consoleEntries to already
// exist (as undefined, which var hoists it to), not sit in a `let` temporal dead zone. See
// the identical reasoning for debugTrace/debugStep in debugger.js.
var consoleEntries = [];

function resetConsolePanel() {
  consoleEntries = [];
  renderConsolePanel();
}

function handleConsoleMessage(data) {
  consoleEntries.push({
    level: data.level || "log",
    text: String(data.text ?? ""),
  });
  renderConsolePanel();
}

function renderConsolePanel() {
  const list = $("consoleList"),
    badge = $("consoleBadge");
  $("consoleEmpty").hidden = consoleEntries.length > 0;
  list.innerHTML = consoleEntries
    .map(
      (en) =>
        '<div class="consoleEntry consoleEntry-' +
        en.level +
        '">' +
        '<span class="consoleIcon">' +
        CONSOLE_ICON[en.level] +
        "</span>" +
        '<span class="consoleText">' +
        esc(en.text) +
        "</span>" +
        "</div>",
    )
    .join("");
  const errCount = consoleEntries.filter((en) => en.level === "error").length;
  badge.hidden = errCount === 0;
  if (errCount) badge.textContent = String(errCount);
}

resetConsolePanel();
