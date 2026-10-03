let PhpWeb = null;
const phpReady = import("https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs")
  .then((m) => {
    PhpWeb = m.PhpWeb;
  })
  .catch((err) => {
    window.__phpErr = String((err && err.message) || err);
  });

// PGlite (a real Postgres build compiled to WebAssembly) is only fetched the first time a
// question that actually needs SQL asks for it - it's an extra several-MB download on top
// of php-wasm itself, and most questions never touch a database. Once fetched, the class is
// cached here so every later SQL question (and every PHP engine rebuild within the session)
// reuses the same download instead of re-fetching it.
let pgliteLoading = null;
function loadPGlite() {
  if (!pgliteLoading) {
    pgliteLoading =
      import("https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/index.js").catch(
        (err) => {
          pgliteLoading = null;
          throw err;
        },
      );
  }
  return pgliteLoading;
}
