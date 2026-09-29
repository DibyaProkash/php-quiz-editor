// Runs the current question's `tests` (see questions.js) against the student's own
// code through the SAME reused PHP engine instance as Run (see getPhp() / engineBusy
// in php-runner.js) - never a second WebAssembly instance - and shows each one as a
// pass/fail card with the expected vs. actual "Final amount" and, on failure, the raw
// text the PHP interpreter produced (so students can see parse errors, warnings, etc.
// exactly as the interpreter reported them).

async function runOneTest(t) {
  const main = mainName;
  await phpReady;
  if (!PhpWeb) return { ok: false, actual: null, diag: 'The PHP engine could not be loaded.' };
  try {
    sinkText = ''; sinkErrs = ''; // reset before anything can throw, so a failed getPhp()/mkdir/writeFile
                                   // never leaves a PREVIOUS run's leftover output sitting in the sinks
    const engine = await getPhp();
    for (const d of allFolders()) { try { await engine.mkdir('/' + d); } catch (e) {} }
    for (const n of allNames()) await engine.writeFile('/' + n, n.endsWith('.php') ? fix(docs[n].getValue()) : docs[n].getValue());
    await engine.run(wrap(docs[main].getValue(), '', { m: 'post', d: t.input }));
  } catch (err) {
    sinkErrs += String(err && err.message || err);
    php = null; // rebuild the engine next time - something went wrong at the JS level
  }
  const text = sinkText, errs = sinkErrs;
  const flagged = !!errs || PHP_DIAG.test(text);
  if (flagged) return { ok: false, actual: null, diag: text + (errs ? '\n' + errs : '') };
  const m = /class="total"[\s\S]*?\$([\d,]+\.\d{2})/.exec(text);
  return m
    ? { ok: m[1] === t.expectFinal, actual: m[1], diag: '' }
    : { ok: false, actual: null, diag: 'Could not find a "Final amount" row in your page. Make sure the receipt table (with class="total" on that row) is still in index.php.' };
}

function renderTestResults(rows) {
  const passed = rows.filter(x => x.r.ok).length, total = rows.length, pct = total ? Math.round(100 * passed / total) : 0;
  $('testResults').innerHTML =
    '<div class="testSummary' + (passed === total ? '' : ' somefail') + '">' +
      '<span class="testSummaryIcon">' + (passed === total ? TEST_PASS : TEST_FAIL) + '</span>' +
      '<span class="testSummaryText">' + passed + ' / ' + total + ' passing</span>' +
      '<div class="testBar"><div class="testBarFill" style="width:' + pct + '%"></div></div>' +
    '</div>' +
    rows.map(({ t, r }, i) => '<div class="testCase ' + (r.ok ? 'pass' : 'fail') + '" style="animation-delay:' + (i * 55) + 'ms">' +
      '<div class="testHead"><span class="testIcon">' + (r.ok ? TEST_PASS : TEST_FAIL) + '</span>' +
      '<strong>Test ' + (i + 1) + '</strong><span class="testInput">' + esc(t.label) + '</span></div>' +
      '<div class="testRow"><span>Expected final amount</span><code>$' + esc(t.expectFinal) + '</code></div>' +
      '<div class="testRow"><span>Your final amount</span><code class="actual">' + (r.actual !== null ? '$' + esc(r.actual) : '(none)') + '</code></div>' +
      (r.diag ? '<details><summary>See what the PHP interpreter produced</summary><pre class="e">' + esc(r.diag) + '</pre></details>' : '') +
      '</div>'
    ).join('');
}

async function runTests() {
  const q = QUESTIONS[key], runBtn = $('run'), testBtn = $('runTests');
  if (engineBusy || !q.tests?.length) return;
  engineBusy = true; runBtn.disabled = true; testBtn.disabled = true; testBtn.innerHTML = TEST_SPIN + ' Running tests…';
  $('testResults').innerHTML = '<p class="testRunning">' + TEST_SPIN + ' Running ' + q.tests.length + ' test(s) against your code…</p>';
  const rows = [];
  for (const t of q.tests) rows.push({ t, r: await runOneTest(t) });
  renderTestResults(rows);
  engineBusy = false; runBtn.disabled = false; testBtn.disabled = false; testBtn.innerHTML = BEAKER + ' Run tests (' + q.tests.length + ')';
}
$('runTests').onclick = runTests;
