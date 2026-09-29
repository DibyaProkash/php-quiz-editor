// "Format code" (Shift+Alt+F) - a REAL PHP code formatter, not a fake indenter.
// Runs Prettier (https://prettier.io) with the community @prettier/plugin-php parser,
// entirely in the browser. Loaded lazily, only the first time a student actually
// presses Format, so a proctored exam session never pays for this download unless
// someone uses it.
//
// IMPORTANT: @prettier/plugin-php is documented to behave unreliably on PHP that's
// interleaved with raw HTML (see prettier/plugin-php issues #845 and #1010) - which is
// exactly what our quiz templates are: HTML tables with small <?php ... ?> blocks
// dropped in. Feeding it the WHOLE file caused a real, reported bug: a comment-only
// placeholder like `<?php // TODO: echo the sandwich cost ?>` would grow an extra copy
// of itself on every Format click.
//
// The templates also lean on PHP's alternate control-structure syntax, e.g.
// `<?php if ($submitted): ?> ...HTML... <?php endif; ?>`, where the `if` and its
// matching `endif` live in two *separate* <?php ?> tags with a wall of HTML between
// them. That means we can't simply isolate and format each <?php ?> tag on its own
// (an early attempt at that fix did exactly this, and it broke every template outright,
// since `endif;` by itself isn't valid PHP without its opening `if`).
//
// The fix that actually works: keep formatting the document as ONE whole file (so
// multi-tag control structures like if/endif are parsed correctly, exactly as before),
// but first swap out every comment-only <?php ?> tag for an inert placeholder token
// that Prettier can't see as PHP at all - it passes straight through untouched, like
// any other bit of HTML text - and swap the original comment back in afterward. That
// keeps the exact class of tag that triggered the duplication bug completely out of
// Prettier's hands, while every real statement still gets fully, properly formatted.
const PRETTIER_JS = 'https://cdn.jsdelivr.net/npm/prettier@3.9.9/standalone.js';
const PRETTIER_PHP_JS = 'https://cdn.jsdelivr.net/npm/@prettier/plugin-php@0.25.0/standalone.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}
let prettierReady = null;
function ensurePrettier() {
  if (!prettierReady) {
    prettierReady = (async () => {
      if (!window.prettier) await loadScript(PRETTIER_JS);
      if (!window.prettierPlugins || !window.prettierPlugins.php) await loadScript(PRETTIER_PHP_JS);
    })();
  }
  return prettierReady;
}

let formatMsgTimer = null;
function showFormatMsg(text, isError) {
  const el = $('formatMsg');
  clearTimeout(formatMsgTimer);
  el.textContent = text; el.className = isError ? 'e' : 'ok'; el.hidden = false;
  formatMsgTimer = setTimeout(() => { el.hidden = true; }, isError ? 6000 : 2200);
}

// Splits source into alternating {type:'html'|'php', ...} segments on <?php ... ?>
// boundaries. Short-echo `<?=` and bare `<?` tags are left inside the surrounding
// 'html' segment (untouched) - they're normally terse one-liners in these templates
// and aren't worth the risk of reformatting.
function splitPhpSegments(text) {
  const segments = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('<?php', i);
    const isPhp = start !== -1 && /^(\s|$)/.test(text.charAt(start + 5) || '');
    if (!isPhp) { segments.push({ type: 'html', text: text.slice(i) }); break; }
    if (start > i) segments.push({ type: 'html', text: text.slice(i, start) });
    const closeIdx = text.indexOf('?>', start + 5);
    const end = closeIdx === -1 ? text.length : closeIdx + 2;
    segments.push({ type: 'php', text: text.slice(start, end), hasClose: closeIdx !== -1, start });
    i = end;
  }
  return segments;
}

// True when a PHP segment's body is nothing but comments/whitespace - formatting it
// would have no real effect except risk mangling it, so it's left exactly as written.
function isCommentOnly(body) {
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/#[^\n]*/g, '').trim();
  return stripped === '';
}

// A token Prettier will never try to parse or reformat: it isn't valid PHP or HTML
// syntax on its own, so it round-trips through formatting completely unchanged,
// wherever Prettier decides to put whitespace around it.
const PLACEHOLDER_RE = /\u0000PHPGUARD(\d+)\u0000/g;
function makePlaceholder(n) { return '\u0000PHPGUARD' + n + '\u0000'; }

async function formatDocument(source) {
  // Guard every comment-only <?php ?> tag (the exact shape that triggered the
  // duplication bug) behind an inert placeholder before Prettier ever sees the file.
  const segments = splitPhpSegments(source);
  const guards = new Map();
  let guarded = '';
  let n = 0;
  for (const seg of segments) {
    if (seg.type === 'html') { guarded += seg.text; continue; }
    const rawInner = seg.hasClose ? seg.text.slice(5, seg.text.length - 2) : seg.text.slice(5);
    if (isCommentOnly(rawInner)) {
      const token = makePlaceholder(n++);
      guards.set(token, seg.text);
      guarded += token;
    } else {
      guarded += seg.text;
    }
  }
  // Format the WHOLE document in one pass, exactly as Prettier expects - this is what
  // lets multi-tag alternate-syntax control structures (if/endif split across two
  // separate <?php ?> tags with HTML in between) parse and format correctly.
  let out = await prettier.format(guarded, {
    parser: 'php', plugins: [prettierPlugins.php], tabWidth: 4, printWidth: 100, singleQuote: true, phpVersion: '8.4'
  });
  // Swap the guarded comment-only tags back in, byte-for-byte, wherever Prettier
  // ended up placing the placeholder token.
  out = out.replace(PLACEHOLDER_RE, (_, idx) => guards.get(makePlaceholder(Number(idx))));
  return out;
}

async function formatCurrentFile() {
  const btn = $('format');
  if (btn.disabled || !cur.endsWith('.php') || !metaOf(cur).editable) return;
  btn.disabled = true;
  try {
    await ensurePrettier();
    const before = cm.getValue();
    const after = await formatDocument(before);
    if (after !== before) {
      const last = cm.lastLine();
      cm.replaceRange(after, { line: 0, ch: 0 }, { line: last, ch: cm.getLine(last).length }, 'format');
      showFormatMsg('Code formatted.', false);
    } else {
      showFormatMsg('Already formatted - nothing to change.', false);
    }
  } catch (err) {
    const msg = String(err && err.message || err).split('\n')[0];
    showFormatMsg("Can't format: your PHP has a syntax problem (" + msg + '). Fix it and try again.', true);
  }
  btn.disabled = false;
}
$('format').onclick = formatCurrentFile;
