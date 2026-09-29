let PhpWeb = null;
const phpReady = import('https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs').then(m => { PhpWeb = m.PhpWeb; }).catch(err => { window.__phpErr = String(err && err.message || err); });
