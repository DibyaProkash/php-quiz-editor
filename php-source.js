// A small scanner for PHP source text, used wherever the editor has to change or add to
// a student's code before it runs (fix() and wrap() in php-runner.js, webTrailer() in
// web-state.js, wrapDebug() in debugger.js). It splits a file into pieces of four kinds -
// HTML outside PHP tags, PHP code, string literals and comments - so a rewrite such as
// exit; -> __ee(); only ever touches real code: never the text of an echo'd string, a
// comment, or the page's HTML. It also says whether a file ends inside PHP mode, which
// a "?>" inside a string used to fool.
//
// It follows PHP's own rules closely enough for student code (<?php and <?= tags in any
// letter case, '...' and "..." strings with escapes and {$...} parts, `...`, heredoc and
// nowdoc, //, # and /* */ comments - but not #[...] attributes - and ?> ending a line
// comment); it doesn't need to be a full tokenizer, only to never mistake a string or
// comment for code.

function phpPieces(src) {
  const out = [],
    n = src.length;
  const push = (t, s) => {
    if (!s) return;
    const l = out[out.length - 1];
    if (l && l.t === t) l.s += s;
    else out.push({ t, s });
  };
  const openRe = /<\?php(?=\s|$)|<\?=/gi;
  let i = 0,
    inPhp = false;
  while (i < n) {
    openRe.lastIndex = i;
    const m = openRe.exec(src);
    if (!m) {
      push("html", src.slice(i));
      break;
    }
    push("html", src.slice(i, m.index));
    push("code", m[0]);
    i = m.index + m[0].length;
    inPhp = true;
    let start = i; // start of the current run of plain code
    const flush = (to) => {
      push("code", src.slice(start, to));
    };
    while (i < n) {
      const c = src[i],
        c2 = src.substr(i, 2);
      if (c2 === "?>") {
        flush(i);
        push("code", "?>");
        i += 2;
        inPhp = false;
        break;
      }
      let end = -1,
        type = "";
      if (c2 === "//" || (c === "#" && src[i + 1] !== "[")) {
        let j = i;
        while (j < n && src[j] !== "\n" && src.substr(j, 2) !== "?>") j++;
        end = j;
        type = "cmt";
      } else if (c2 === "/*") {
        const j = src.indexOf("*/", i + 2);
        end = j === -1 ? n : j + 2;
        type = "cmt";
      } else if (c === "'") {
        let j = i + 1;
        while (j < n && src[j] !== "'") j += src[j] === "\\" ? 2 : 1;
        end = Math.min(j + 1, n);
        type = "str";
      } else if (c === '"' || c === "`") {
        end = endOfQuoted(src, i + 1, c);
        type = "str";
      } else if (src.substr(i, 3) === "<<<") {
        const hm = /^<<<[ \t]*(["']?)([A-Za-z_]\w*)\1\r?\n/.exec(src.slice(i, i + 120));
        if (hm) {
          const bodyAt = i + hm[0].length,
            em = new RegExp("(^|\\n)[ \\t]*" + hm[2] + "(?![A-Za-z0-9_])").exec(src.slice(bodyAt));
          end = em ? bodyAt + em.index + em[0].length : n;
          type = "str";
        }
      }
      if (type) {
        flush(i);
        push(type, src.slice(i, end));
        i = start = end;
      } else i++;
    }
    if (inPhp) {
      flush(i);
      break;
    }
  }
  return { pieces: out, endsInPhp: inPhp };
}
// Index just past the closing quote of a "..." or `...` string that starts at j.
function endOfQuoted(src, j, q) {
  const n = src.length;
  while (j < n) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === q) return j + 1;
    if (c === "{" && src[j + 1] === "$") {
      // {$arr["key"]} - a complex expression that can hold quotes of its own
      let depth = 0;
      while (j < n) {
        const d = src[j];
        if (d === "'" || d === '"') {
          j++;
          while (j < n && src[j] !== d) j += src[j] === "\\" ? 2 : 1;
          j++;
          continue;
        }
        if (d === "{") depth++;
        else if (d === "}" && --depth === 0) {
          j++;
          break;
        }
        j++;
      }
      continue;
    }
    j++;
  }
  return n;
}

// Rewrites applied to the CODE pieces only. Each keeps the text on the same line, so
// error line numbers don't move. PHP function names and exit/die are case-insensitive,
// so the patterns are too; the lookbehinds skip $obj->exit(, Foo::die(, my_exit( and
// Some\Namespace\readline(, but a leading \ (\readline() still counts as the real one.
const FIX_RULES = [
  [/(?<![\w$\\])(?<!->)(?<!::)\\?readline\s*\(/gi, "__rl("],
  [/(?<![\w$\\])(?<!->)(?<!::)\\?fgets\s*\(\s*STDIN\s*\)/gi, "__rl()"],
  [/(?<![\w$\\])(?<!->)(?<!::)\\?move_uploaded_file\s*\(/gi, "__muf("],
  [/(?<![\w$\\])(?<!->)(?<!::)\\?is_uploaded_file\s*\(/gi, "__iuf("],
  [/(?<![\w$\\])(?<!->)(?<!::)\\?mime_content_type\s*\(/gi, "__mct("],
  [/(?<![\w$\\])(?<!->)(?<!::)\\?filter_input_array\s*\(/gi, "__fia("],
  [/(?<![\w$\\])(?<!->)(?<!::)\\?filter_input\s*\(/gi, "__fi("],
  [/(?<![\w$\\])(?<!->)(?<!::)\\?filter_has_var\s*\(/gi, "__fhv("],
  [/(?<![\w$\\])(?<!->)(?<!::)\b(?:exit|die)\b\s*(\(|;)/gi, (m, p) => (p === "(" ? "__ee(" : "__ee();")],
];
function fixSource(code) {
  return phpPieces(code)
    .pieces.map((p) => (p.t === "code" ? FIX_RULES.reduce((s, [re, to]) => s.replace(re, to), p.s) : p.s))
    .join("");
}

// Where the editor's own setup code can go in a main file that starts with
// declare(strict_types=...) and/or namespace ...; - both must come first in a file, so
// the setup goes straight after them (on the same line, so no line numbers move).
// Returns -1 for an ordinary file, whose setup simply goes in front.
function preludeSpliceAt(code) {
  const m = /^<\?php(?=\s)/i.exec(code);
  if (!m) return -1;
  let i = m[0].length,
    at = -1;
  const skip = () => {
    for (;;) {
      const w = /^(?:\s+|\/\/[^\n]*|#(?!\[)[^\n]*|\/\*[\s\S]*?\*\/)/.exec(code.slice(i));
      if (!w) return;
      i += w[0].length;
    }
  };
  skip();
  const d = /^declare\s*\(\s*strict_types\s*=\s*[01]\s*\)\s*;/i.exec(code.slice(i));
  if (d) {
    i += d[0].length;
    at = i;
    skip();
  }
  const ns = /^namespace\s+[A-Za-z_\\][\w\\]*\s*;/i.exec(code.slice(i));
  if (ns) at = i + ns[0].length;
  return at;
}
// Puts setup statements (no PHP tags of their own) in front of the code, or right after
// a leading declare/namespace.
function withPrelude(stmts, code) {
  const at = preludeSpliceAt(code);
  return at === -1 ? "<?php " + stmts + " ?>" + code : code.slice(0, at) + stmts + code.slice(at);
}
