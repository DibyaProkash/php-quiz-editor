// Runs the current question's `tests` (see questions.js) against the student's own
// code through the SAME reused PHP engine instance as Run (see getPhp() / engineBusy
// in php-runner.js) - never a second WebAssembly instance - and shows each one as a
// pass/fail card with the expected vs. actual "Final amount" and, on failure, the raw
// text the PHP interpreter produced (so students can see parse errors, warnings, etc.
// exactly as the interpreter reported them).

async function runOneTest(t) {
  const main = mainName,
    q = QUESTIONS[key];
  let state = null;
  await phpReady;
  if (!PhpWeb)
    return {
      ok: false,
      actual: null,
      diag: "The PHP engine could not be loaded.",
    };
  try {
    sinkText = "";
    sinkErrs = ""; // reset before anything can throw, so a failed getPhp()/mkdir/writeFile
    // never leaves a PREVIOUS run's leftover output sitting in the sinks
    const engine = await getPhp(q.sql);
    // Project files plus sample/saved files, and nothing a previous test saved (media.js)
    await syncProjectFiles(engine);
    // A test starts from its own cookies/session/uploads (never the student's live
    // ones from the Storage tab) and changes nothing they can see afterwards.
    const wr = webRequest(
      { m: t.method || "post", d: t.input || {} },
      { cookies: t.cookies, session: t.session, files: t.files },
    );
    await prepareWebRequest(engine, wr);
    await engine.run(wrap(docs[main].getValue(), "", wr));
    state = await readWebState(engine);
    await cleanupWebRequest(engine, wr);
  } catch (err) {
    sinkErrs += String((err && err.message) || err);
    php = null; // rebuild the engine next time - something went wrong at the JS level
  }
  const text = sinkText,
    errs = sinkErrs;
  const flagged = !!errs || PHP_DIAG.test(text);
  if (flagged)
    return { ok: false, checks: [], actual: null, diag: text + (errs ? "\n" + errs : "") };
  const checks = testChecks(t, text, state);
  return { ok: checks.every((c) => c.ok), checks, actual: checks[0] ? checks[0].actual : null, diag: checks.some((c) => !c.ok && c.diag) ? checks.find((c) => !c.ok && c.diag).diag : "" };
}

// The text a page shows, the way a reader sees it: tags and <script>/<style> dropped,
// entities decoded, whitespace collapsed.
function pageText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach((n) => n.remove());
  // A space after each cell/block, so "<th>Checked</th><td>yes</td>" reads "Checked yes".
  doc.querySelectorAll("th,td,p,div,li,h1,h2,h3,h4,h5,h6,label,br,tr").forEach((n) => n.after(" "));
  return (doc.body ? doc.body.textContent : "").replace(/\s+/g, " ").trim();
}
// What a test can check (all optional; every one given must pass):
//   expectFinal    "12.50"   the $ amount in the class="total" row (the original kind)
//   expectResult   "8.2"     the full text of the class="total" row's value cell
//   expectContains "..."     text (or a list of texts) that must appear on the page
//   expectCookies  {n: "v"}  cookies the page set; null = must have been deleted / not set
//   expectSession  {k: v}    $_SESSION values when the page finished (null = key absent)
function testChecks(t, text, state) {
  const out = [];
  const totalRow = () => {
    const doc = new DOMParser().parseFromString(text, "text/html");
    const row = doc.querySelector(".total");
    if (!row) return null;
    const cells = row.querySelectorAll("td");
    const cell = cells.length ? cells[cells.length - 1] : row;
    return cell.textContent.replace(/\s+/g, " ").trim();
  };
  const noRow = 'Could not find the result row in your page. Make sure the table row with class="total" is still in index.php.';
  if (t.expectFinal !== undefined) {
    const m = /class="total"[\s\S]*?\$([\d,]+\.\d{2})/.exec(text);
    out.push(m
      ? { label: "final amount", want: "$" + t.expectFinal, actual: "$" + m[1], ok: m[1] === t.expectFinal }
      : { label: "final amount", want: "$" + t.expectFinal, actual: null, ok: false, diag: 'Could not find a "Final amount" row in your page. Make sure the receipt table (with class="total" on that row) is still in index.php.' });
  }
  if (t.expectResult !== undefined) {
    const got = totalRow();
    out.push({ label: "result", want: t.expectResult, actual: got, ok: got === t.expectResult, diag: got === null ? noRow : "" });
  }
  if (t.expectContains !== undefined) {
    const page = pageText(text);
    for (const want of [].concat(t.expectContains))
      out.push({ label: "page shows", want, actual: page.includes(want) ? want : "(not on the page)", ok: page.includes(want) });
  }
  if (t.expectCookies) {
    const set = {};
    for (const c of state ? state.cookies : []) set[c.name] = c.exp !== null && c.exp <= Date.now() ? null : c.value;
    for (const n in t.expectCookies) {
      const want = t.expectCookies[n],
        got = n in set ? set[n] : null;
      out.push({ label: "cookie " + n, want: want === null ? "(not set)" : want, actual: got === null ? (state ? "(not set)" : null) : got, ok: got === want });
    }
  }
  if (t.expectSession) {
    const s = state && state.session && typeof state.session === "object" ? state.session : {};
    for (const k in t.expectSession) {
      const want = t.expectSession[k],
        got = k in s ? s[k] : null;
      out.push({ label: "$_SESSION['" + k + "']", want: want === null ? "(not set)" : JSON.stringify(want), actual: got === null ? "(not set)" : JSON.stringify(got), ok: JSON.stringify(got) === JSON.stringify(want) });
    }
  }
  return out;
}

// One expected/actual pair per check. A run that failed before any check could happen
// (a PHP error) still lists what was expected, with "(none)" for what came back.
function testRowsHtml(t, r) {
  const checks = r.checks && r.checks.length ? r.checks : testChecks(t, "", null).map((c) => ({ ...c, actual: null }));
  return checks
    .map(
      (c) =>
        '<div class="testRow"><span>Expected ' + esc(c.label) + "</span><code>" + esc(String(c.want)) + "</code></div>" +
        '<div class="testRow"><span>Your ' + esc(c.label) + '</span><code class="actual' + (c.ok ? "" : " miss") + '">' +
        (c.actual !== null && c.actual !== undefined ? esc(String(c.actual)) : "(none)") + "</code></div>",
    )
    .join("");
}

function renderTestResults(rows) {
  const passed = rows.filter((x) => x.r.ok).length,
    total = rows.length,
    pct = total ? Math.round((100 * passed) / total) : 0;
  $("testResults").innerHTML =
    '<div class="testSummary' +
    (passed === total ? "" : " somefail") +
    '">' +
    '<span class="testSummaryIcon">' +
    (passed === total ? TEST_PASS : TEST_FAIL) +
    "</span>" +
    '<span class="testSummaryText">' +
    passed +
    " / " +
    total +
    " passing</span>" +
    '<div class="testBar"><div class="testBarFill" style="width:' +
    pct +
    '%"></div></div>' +
    "</div>" +
    rows
      .map(
        ({ t, r }, i) =>
          '<div class="testCase ' +
          (r.ok ? "pass" : "fail") +
          '" style="animation-delay:' +
          i * 55 +
          'ms">' +
          '<div class="testHead"><span class="testIcon">' +
          (r.ok ? TEST_PASS : TEST_FAIL) +
          "</span>" +
          "<strong>Test " +
          (i + 1) +
          '</strong><span class="testInput">' +
          esc(t.label) +
          "</span></div>" +
          testRowsHtml(t, r) +
          (r.diag
            ? '<details><summary>See what the PHP interpreter produced</summary><pre class="e">' +
              esc(r.diag) +
              "</pre></details>"
            : "") +
          "</div>",
      )
      .join("");
}

async function runTests() {
  const q = QUESTIONS[key],
    runBtn = $("run"),
    testBtn = $("runTests"),
    dbtn = $("debug");
  if (engineBusy || !q.tests?.length) return;
  engineBusy = true;
  setPickerBusy(true);
  runBtn.disabled = true;
  testBtn.disabled = true;
  dbtn.disabled = true;
  testBtn.innerHTML = TEST_SPIN + " Running tests…";
  $("testResults").innerHTML =
    '<p class="testRunning">' +
    TEST_SPIN +
    " Running " +
    q.tests.length +
    " test(s) against your code…</p>";
  const rows = [];
  for (const t of q.tests) rows.push({ t, r: await runOneTest(t) });
  renderTestResults(rows);
  engineBusy = false;
  setPickerBusy(false);
  runBtn.disabled = false;
  testBtn.disabled = false;
  dbtn.disabled = false;
  testBtn.innerHTML = BEAKER + " Run tests (" + q.tests.length + ")";
}
$("runTests").onclick = runTests;
