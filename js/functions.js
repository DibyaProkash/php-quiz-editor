// Reusable helper functions for the PHP Quiz Editor.

export const $ = id => document.getElementById(id);

export const store = (k, v) => {
  try {
    v === undefined ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v);
  } catch (e) {}
};

export const load = k => {
  try {
    return sessionStorage.getItem(k);
  } catch (e) {
    return null;
  }
};

export const esc = s =>
  s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const MODES = {
  php: 'application/x-httpd-php',
  css: 'css',
  js: 'javascript',
  html: 'htmlmixed',
  json: 'application/json',
  txt: 'text/plain'
};

export const modeOf = n =>
  MODES[n.split('.').pop()] || 'text/plain';

export const baseOf = p => p.split('/').pop();

export const dirOf = p =>
  p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';

export const ancestors = p => {
  const parts = p.split('/');
  const out = [];
  for (let i = 1; i < parts.length; i++) {
    out.push(parts.slice(0, i).join('/'));
  }
  return out;
};

export const norm = t =>
  t.trim().replace(/^(\.?\/)+/, '').replace(/\/+/g, '/').replace(/\/$/, '');

export const b64 = s => btoa(unescape(encodeURIComponent(s)));

export const fix = code =>
  code
    .replace(/\breadline\s*\(/g, '__rl(')
    .replace(/\bfgets\s*\(\s*STDIN\s*\)/g, '__rl()');

export function wrap(code, stdin, r) {
  // Prelude sits on line 1 so PHP error line numbers match the editor.
  const pre = '<?php $__in=explode("\\n",base64_decode("' + b64(stdin) + '"));' +
    'function __rl($p=""){global $__in;echo $p;return count($__in)?array_shift($__in):false;}' +
    '$__r=json_decode(base64_decode("' + b64(JSON.stringify(r)) + '"),true);' +
    'if($__r["m"]==="post"){$_POST=$__r["d"];$_SERVER["REQUEST_METHOD"]="POST";}else{$_GET=$__r["d"];$_SERVER["REQUEST_METHOD"]="GET";}' +
    '$_REQUEST=$__r["d"];unset($__r); ?>';
  return pre + fix(code);
}

export const BRIDGE = '<script>document.addEventListener("submit",function(e){e.preventDefault();var f=e.target,d={};' +
  'new FormData(f).forEach(function(v,k){if(typeof v==="string")d[k]=v});' +
  'parent.postMessage({fp:1,m:(f.getAttribute("method")||"get").toLowerCase(),d:d},"*")},true);' +
  'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");' +
  'if(a&&a.getAttribute("href").charAt(0)!=="#")e.preventDefault()},true)<\/script>';

export function inline(html, names, docs) {
  names.forEach(name => {
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
