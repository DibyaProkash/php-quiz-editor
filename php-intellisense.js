// Lightweight PHP autocomplete (CodeMirror's show-hint addon + a custom hint source).
// Not full semantic IntelliSense - there's no real PHP type-checker running here - but it
// suggests PHP keywords, common built-in functions, superglobals, and any $variable or
// function the student has already typed elsewhere in the file, the moment they start
// typing a word, the way VS Code's basic word/keyword suggestions behave.

const PHP_KEYWORDS = ['abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone',
  'const', 'continue', 'declare', 'default', 'do', 'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor',
  'endforeach', 'endif', 'endswitch', 'endwhile', 'enum', 'extends', 'final', 'finally', 'fn', 'for', 'foreach',
  'function', 'global', 'goto', 'if', 'implements', 'include', 'include_once', 'instanceof', 'insteadof',
  'interface', 'isset', 'list', 'match', 'namespace', 'new', 'or', 'print', 'private', 'protected', 'public',
  'readonly', 'require', 'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use',
  'var', 'while', 'xor', 'yield', 'true', 'false', 'null', 'self', 'parent'];

const PHP_SUPERGLOBALS = ['$_GET', '$_POST', '$_SERVER', '$_SESSION', '$_COOKIE', '$_FILES', '$_ENV', '$_REQUEST', '$GLOBALS'];

const PHP_BUILTINS = [
  'strlen', 'strtolower', 'strtoupper', 'trim', 'ltrim', 'rtrim', 'str_replace', 'str_pad', 'str_repeat', 'substr',
  'sprintf', 'printf', 'explode', 'implode', 'number_format', 'str_contains', 'str_starts_with', 'str_ends_with',
  'str_split', 'ucfirst', 'ucwords', 'wordwrap', 'nl2br', 'htmlspecialchars',
  'array_sum', 'array_map', 'array_filter', 'array_merge', 'array_keys', 'array_values', 'array_search', 'in_array',
  'array_key_exists', 'count', 'sort', 'rsort', 'usort', 'array_reverse', 'array_slice', 'array_push', 'array_pop',
  'array_shift', 'array_unshift', 'array_unique', 'array_combine', 'array_fill', 'array_flip',
  'round', 'floor', 'ceil', 'abs', 'max', 'min', 'rand', 'mt_rand', 'intdiv', 'pow', 'sqrt',
  'isset', 'empty', 'unset', 'is_array', 'is_string', 'is_numeric', 'is_int', 'is_float', 'is_bool', 'is_null',
  'is_callable', 'gettype', 'settype', 'intval', 'floatval', 'strval', 'boolval',
  'var_dump', 'print_r', 'var_export', 'date', 'time', 'strtotime', 'json_encode', 'json_decode',
  'preg_match', 'preg_replace', 'preg_split', 'function_exists', 'method_exists', 'class_exists',
  'define', 'defined', 'func_get_args', 'call_user_func'
];

function phpHint(cmInst) {
  const cursor = cmInst.getCursor(), line = cmInst.getLine(cursor.line);
  let start = cursor.ch;
  while (start && /[\w$]/.test(line.charAt(start - 1))) start--;
  const word = line.slice(start, cursor.ch);
  if (!word) return null;
  const isVar = word.charAt(0) === '$';
  const seen = new Set(), list = [];
  const add = (text, className) => { if (!seen.has(text)) { seen.add(text); list.push({ text, className }); } };
  const all = cmInst.getValue();
  if (isVar) {
    PHP_SUPERGLOBALS.forEach(v => add(v, 'cm-hint-var'));
    const re = /\$[A-Za-z_][A-Za-z0-9_]*/g; let m;
    while ((m = re.exec(all))) add(m[0], 'cm-hint-var');
  } else {
    PHP_KEYWORDS.forEach(k => add(k, 'cm-hint-kw'));
    PHP_BUILTINS.forEach(f => add(f + '(', 'cm-hint-fn'));
    const re = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g; let m;
    while ((m = re.exec(all))) add(m[1] + '(', 'cm-hint-fn');
  }
  const wlow = word.toLowerCase();
  const filtered = list.filter(it => it.text.toLowerCase().startsWith(wlow)).sort((a, b) => a.text.localeCompare(b.text));
  if (!filtered.length) return null;
  return { list: filtered, from: CodeMirror.Pos(cursor.line, start), to: CodeMirror.Pos(cursor.line, cursor.ch) };
}

// Auto-trigger on typing, like VS Code's default suggest-as-you-type - but only in
// editable .php files, and only for word/variable characters (not every keystroke).
cm.on('inputRead', (instance, change) => {
  if (!cur.endsWith('.php') || !metaOf(cur).editable) return;
  if (change.origin !== '+input' || change.text.length !== 1 || !/[\w$]/.test(change.text[0])) return;
  if (instance.state.completionActive) return;
  CodeMirror.showHint(instance, phpHint, { completeSingle: false });
});
