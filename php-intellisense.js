// Lightweight PHP autocomplete (CodeMirror's show-hint addon + a custom hint source).
// Not full semantic IntelliSense - there's no real PHP type-checker running here - but it
// suggests PHP keywords, common built-in functions (each with a one-line signature/
// description, VS-Code-style), superglobals, and any $variable or function the student
// has already typed elsewhere in the file, the moment they start typing a word.

const PHP_KEYWORDS = ['abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone',
  'const', 'continue', 'declare', 'default', 'do', 'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor',
  'endforeach', 'endif', 'endswitch', 'endwhile', 'enum', 'extends', 'final', 'finally', 'fn', 'for', 'foreach',
  'function', 'global', 'goto', 'if', 'implements', 'include', 'include_once', 'instanceof', 'insteadof',
  'interface', 'isset', 'list', 'match', 'namespace', 'new', 'or', 'print', 'private', 'protected', 'public',
  'readonly', 'require', 'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use',
  'var', 'while', 'xor', 'yield', 'true', 'false', 'null', 'self', 'parent'];

const PHP_SUPERGLOBAL_DOCS = {
  $_GET: 'Values submitted via a GET request (URL query string).',
  $_POST: 'Values submitted via a POST request (form fields).',
  $_SERVER: 'Server and execution environment info, e.g. $_SERVER["REQUEST_METHOD"].',
  $_SESSION: 'Values kept between requests for the same visitor.',
  $_COOKIE: 'Cookies sent by the browser.',
  $_FILES: 'Uploaded file info from a multipart form.',
  $_ENV: 'Environment variables.',
  $_REQUEST: 'GET, POST and COOKIE values combined.',
  $GLOBALS: 'Every global-scope variable, by name.'
};

// name -> [paramList, one-line description]
const PHP_BUILTIN_DOCS = {
  strlen: ['string $s', 'Number of bytes in a string.'],
  strtolower: ['string $s', 'Lowercases a string.'],
  strtoupper: ['string $s', 'Uppercases a string.'],
  trim: ['string $s', 'Strips whitespace from both ends.'],
  ltrim: ['string $s', 'Strips whitespace from the start.'],
  rtrim: ['string $s', 'Strips whitespace from the end.'],
  str_replace: ['$search, $replace, $subject', 'Replaces all occurrences of $search with $replace.'],
  str_pad: ['string $s, int $len', 'Pads a string to a given length.'],
  str_repeat: ['string $s, int $times', 'Repeats a string.'],
  substr: ['string $s, int $start, ?int $len', 'Extracts part of a string.'],
  sprintf: ['string $format, ...$args', 'Builds a formatted string.'],
  printf: ['string $format, ...$args', 'Prints a formatted string.'],
  explode: ['string $sep, string $s', 'Splits a string into an array.'],
  implode: ['string $sep, array $pieces', 'Joins an array into a string.'],
  number_format: ['float $n, int $decimals = 0', 'Formats a number with grouped thousands and fixed decimals.'],
  str_contains: ['string $s, string $needle', 'True if $needle appears in $s.'],
  str_starts_with: ['string $s, string $needle', 'True if $s starts with $needle.'],
  str_ends_with: ['string $s, string $needle', 'True if $s ends with $needle.'],
  str_split: ['string $s, int $len = 1', 'Splits a string into chunks.'],
  ucfirst: ['string $s', 'Uppercases the first character.'],
  ucwords: ['string $s', 'Uppercases the first character of each word.'],
  wordwrap: ['string $s, int $width', 'Wraps a string to a given line length.'],
  nl2br: ['string $s', 'Inserts <br> before newlines.'],
  htmlspecialchars: ['string $s', 'Escapes HTML special characters.'],
  array_sum: ['array $a', 'Adds up every value in an array.'],
  array_map: ['callable $fn, array $a', 'Applies a function to every value.'],
  array_filter: ['array $a, ?callable $fn', 'Keeps only values that pass a test.'],
  array_merge: ['array ...$arrays', 'Combines arrays into one.'],
  array_keys: ['array $a', 'Every key of an array.'],
  array_values: ['array $a', 'Every value of an array, re-indexed.'],
  array_search: ['$needle, array $a', 'Finds the key of a value.'],
  in_array: ['$needle, array $a', 'True if a value exists in the array.'],
  array_key_exists: ['$key, array $a', 'True if a key exists in the array.'],
  count: ['array $a', 'Number of elements in an array.'],
  sort: ['array &$a', 'Sorts an array in place, values ascending.'],
  rsort: ['array &$a', 'Sorts an array in place, values descending.'],
  usort: ['array &$a, callable $fn', 'Sorts with a custom comparison function.'],
  array_reverse: ['array $a', 'Reverses the order of elements.'],
  array_slice: ['array $a, int $offset, ?int $len', 'Extracts a portion of an array.'],
  array_push: ['array &$a, ...$values', 'Appends one or more values.'],
  array_pop: ['array &$a', 'Removes and returns the last value.'],
  array_shift: ['array &$a', 'Removes and returns the first value.'],
  array_unshift: ['array &$a, ...$values', 'Prepends one or more values.'],
  array_unique: ['array $a', 'Removes duplicate values.'],
  array_combine: ['array $keys, array $values', 'Builds an array from a keys array and a values array.'],
  array_fill: ['int $start, int $count, $value', 'Builds an array filled with a value.'],
  array_flip: ['array $a', 'Swaps keys and values.'],
  round: ['float $n, int $precision = 0', 'Rounds a number to the given precision.'],
  floor: ['float $n', 'Rounds down to the nearest integer.'],
  ceil: ['float $n', 'Rounds up to the nearest integer.'],
  abs: ['int|float $n', 'Absolute value.'],
  max: ['...$values', 'The largest value.'],
  min: ['...$values', 'The smallest value.'],
  rand: ['int $min, int $max', 'A random integer in range.'],
  mt_rand: ['int $min, int $max', 'A random integer (faster generator).'],
  intdiv: ['int $a, int $b', 'Integer division.'],
  pow: ['$base, $exp', 'Raises a number to a power.'],
  sqrt: ['float $n', 'Square root.'],
  isset: ['$var', 'True if a variable/key exists and is not null.'],
  empty: ['$var', 'True if a variable is falsy or unset.'],
  unset: ['$var', 'Destroys a variable.'],
  is_array: ['$v', 'True if the value is an array.'],
  is_string: ['$v', 'True if the value is a string.'],
  is_numeric: ['$v', 'True if the value looks like a number.'],
  is_int: ['$v', 'True if the value is an integer.'],
  is_float: ['$v', 'True if the value is a float.'],
  is_bool: ['$v', 'True if the value is a boolean.'],
  is_null: ['$v', 'True if the value is null.'],
  is_callable: ['$v', 'True if the value can be called as a function.'],
  gettype: ['$v', 'The type of a value, as a string.'],
  settype: ['&$var, string $type', 'Converts a variable to a given type.'],
  intval: ['$v', 'Converts a value to int.'],
  floatval: ['$v', 'Converts a value to float.'],
  strval: ['$v', 'Converts a value to string.'],
  boolval: ['$v', 'Converts a value to bool.'],
  var_dump: ['...$vars', 'Dumps type and value info - for debugging.'],
  print_r: ['$var', 'Human-readable structure of a value - for debugging.'],
  var_export: ['$var', 'Outputs a value as valid PHP code.'],
  date: ['string $format', 'Formats the current (or given) time.'],
  time: ['', 'The current Unix timestamp.'],
  strtotime: ['string $s', 'Parses an English date/time description into a timestamp.'],
  json_encode: ['$value', 'Converts a value to a JSON string.'],
  json_decode: ['string $json, bool $assoc = false', 'Parses a JSON string.'],
  preg_match: ['string $pattern, string $s', 'Tests a string against a regular expression.'],
  preg_replace: ['$pattern, $replacement, $s', 'Regex search-and-replace.'],
  preg_split: ['string $pattern, string $s', 'Splits a string by a regular expression.'],
  function_exists: ['string $name', 'True if a function is defined.'],
  method_exists: ['$obj, string $name', 'True if an object/class has a method.'],
  class_exists: ['string $name', 'True if a class is defined.'],
  define: ['string $name, $value', 'Defines a constant.'],
  defined: ['string $name', 'True if a constant is defined.'],
  func_get_args: ['', "All of the current function's arguments as an array."],
  call_user_func: ['callable $fn, ...$args', 'Calls a function by name/callable.']
};
const PHP_BUILTINS = Object.keys(PHP_BUILTIN_DOCS);

function renderHint(el, self, data) {
  el.className += ' cm-hint-row';
  const name = document.createElement('span'); name.className = 'cm-hint-name'; name.textContent = data.displayText || data.text;
  el.appendChild(name);
  if (data.doc) { const doc = document.createElement('span'); doc.className = 'cm-hint-doc'; doc.textContent = data.doc; el.appendChild(doc); }
}

function phpHint(cmInst) {
  const cursor = cmInst.getCursor(), line = cmInst.getLine(cursor.line);
  let start = cursor.ch;
  while (start && /[\w$]/.test(line.charAt(start - 1))) start--;
  const word = line.slice(start, cursor.ch);
  if (!word) return null;
  const isVar = word.charAt(0) === '$';
  const seen = new Set(), list = [];
  const add = (text, className, doc, displayText) => {
    if (seen.has(text)) return;
    seen.add(text);
    list.push({ text, className, doc, displayText });
  };
  const all = cmInst.getValue();
  // Absolute offset of the word being typed, so a variable that only "exists" because
  // it's the very fragment on the cursor isn't suggested back at itself.
  const wordFromIdx = cmInst.indexFromPos(CodeMirror.Pos(cursor.line, start));
  const wordToIdx = cmInst.indexFromPos(cursor);
  if (isVar) {
    Object.keys(PHP_SUPERGLOBAL_DOCS).forEach(v => add(v, 'cm-hint-var', PHP_SUPERGLOBAL_DOCS[v]));
    const re = /\$[A-Za-z_][A-Za-z0-9_]*/g; let m;
    while ((m = re.exec(all))) {
      if (m.index >= wordFromIdx && m.index + m[0].length <= wordToIdx) continue; // the fragment itself
      add(m[0], 'cm-hint-var', 'Variable used elsewhere in this file.');
    }
  } else {
    PHP_KEYWORDS.forEach(k => add(k, 'cm-hint-kw', 'PHP keyword'));
    PHP_BUILTINS.forEach(f => {
      const [params, desc] = PHP_BUILTIN_DOCS[f];
      add(f + '(', 'cm-hint-fn', desc, f + '(' + params + ')');
    });
    const re = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g; let m;
    while ((m = re.exec(all))) add(m[1] + '(', 'cm-hint-fn', 'Function defined in this file.', m[1] + '(' + m[2].trim() + ')');
  }
  const wlow = word.toLowerCase();
  const filtered = list.filter(it => it.text.toLowerCase().startsWith(wlow)).sort((a, b) => a.text.localeCompare(b.text));
  if (!filtered.length) return null;
  filtered.forEach(it => { it.render = renderHint; });
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
