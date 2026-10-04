/* ------------------------------------------------------------------
   QUESTIONS  (link students to  index.html?q=mv1a )
   files     : the run file is the first .php file (index.php).
               editable:false makes a file read-only (CSS/JS you provide).
               Other files are inlined into the preview automatically when
               the page uses <link href="style.css"> or <script src="script.js">.
   preview   : true  = show rendered page. false = plain text output only.
   stdin     : text for the Input box (readline()/fgets(STDIN)). Omit to hide the box.
   hints     : optional array, revealed one at a time.
   tests     : optional array of { label, input: {fieldName: value, ...}, expectFinal, method }.
               Each test sends `input` as $_POST (or, with method:'get', as $_GET) to the
               student's own current code through the real PHP engine and compares the
               rendered ".total" row against expectFinal. `method` defaults to 'post' -
               only set it to 'get' for a question whose form itself uses method="get".
               Adds a "Tests" tab where students can run these themselves. Omit to hide it.
   functions : optional array of { sig, desc, example } shown in a collapsible
               "PHP function reference" panel. Omit to hide that panel.
   sql       : optional, default false. Set true to give this question a real PDO
               connection to a real (WASM) Postgres database, via `new PDO('pgsql:')` -
               genuine SQL, not a simulation. The database is in-memory and brand new on
               every Run/Debug/Tests click, so a SQL question's own code should create and
               seed whatever tables it needs each time, rather than assuming yesterday's
               data (or even the previous click's data) is still there. (No current question
               uses this, but the engine support is still here in case a future one does.)
------------------------------------------------------------------- */

// Built-in PHP functions worth knowing for the OOP-based Movie Night questions below.
// Real functions, real PHP - the editor runs actual PHP 8.4.
const CAFE_FUNCS_BASE = [
  { sig: 'number_format(float $num, int $decimals = 0): string', desc: 'Formats a number with grouped thousands and a fixed number of decimal places - use it whenever you display a dollar amount.', example: 'number_format(27.3, 2)\n// "27.30"\nnumber_format(1250.5, 2)\n// "1,250.50"' },
  { sig: 'round(float $num, int $precision = 0): float', desc: 'Rounds a number to the given number of decimal places.', example: 'round(4.567, 2)\n// 4.57\nround(10)\n// 10.0' },
  { sig: 'isset(mixed $var): bool', desc: 'Checks whether a variable (or array key) exists and is not null - handy for reading an optional $_POST value safely.', example: "isset($_POST['sandwiches']) ? (int) $_POST['sandwiches'] : 0\nisset($_POST['missingKey'])\n// false" },
  { sig: 'count(Countable|array $value): int', desc: 'Counts how many elements are in an array.', example: "count(['a', 'b', 'c'])\n// 3\ncount([])\n// 0" }
];

// Shared CSS for the Movie Night question sets below - one small helper instead of six
// almost-identical copy-pasted stylesheets. Each call just picks different accent colors.
function movieCss(bg, cardBorder, badgeBg, badgeFg, accent, thColor, rowBorder) {
  return `body{font-family:system-ui,sans-serif;background:${bg};margin:0;padding:24px;color:#1b1b1b}
.card{max-width:480px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid ${cardBorder}}
.badge{display:inline-block;margin:0 0 8px;padding:3px 10px;border-radius:999px;background:${badgeBg};color:${badgeFg};font-size:12px;font-weight:600}
h1{margin:0 0 16px;font-size:21px}
label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px}
input[type=text],input[type=number],input[type=email],select{padding:6px;min-width:130px}
button{margin-top:6px;padding:8px 16px;background:${accent};color:#fff;border:0;border-radius:4px;cursor:pointer}
.receipt{width:100%;margin-top:20px;border-collapse:collapse}
.receipt th{text-align:left;font-weight:400;color:${thColor}}
.receipt td{text-align:right}
.receipt th,.receipt td{padding:6px 0;border-bottom:1px solid ${rowBorder}}
.receipt tr.subtotal th,.receipt tr.subtotal td{border-top:2px solid ${rowBorder};font-weight:600;color:#1b1b1b}
.receipt tr.total th,.receipt tr.total td{font-weight:700;font-size:17px;border-bottom:0}
.errorBox{margin-top:16px;padding:12px 14px;background:#fdecea;border:1px solid #f5c2c0;border-radius:6px;color:#8a1f1a}
.errorBox ul{margin:4px 0 0;padding-left:18px}
.results{margin-top:16px}
.movieItem{padding:8px 0;border-bottom:1px solid ${rowBorder}}
.movieItem:last-child{border-bottom:0}
`;
}
const MOVIE_SCRIPT = `document.querySelectorAll('input[type=number],input[type=text]').forEach(function (el) {
  el.addEventListener('focus', function () { el.select(); });
});
`;

// Function references for the Movie Night question sets.
const MOVIE_OOP_FUNCS = CAFE_FUNCS_BASE;
const MOVIE_STRING_FUNCS = [
  { sig: 'trim(string $str): string', desc: 'Removes whitespace (spaces, tabs, newlines) from the start and end of a string.', example: "trim('  Paris  ')\n// 'Paris'\ntrim('no extra spaces')\n// 'no extra spaces' (unchanged)" },
  { sig: 'strtolower(string $str): string / strtoupper(string $str): string', desc: 'Converts a string to all-lowercase or all-uppercase.', example: "strtolower('PARIS')\n// 'paris'\nstrtoupper('paris')\n// 'PARIS'" },
  { sig: 'ucwords(string $str): string', desc: 'Capitalizes the first letter of every word in a string.', example: "ucwords('the great escape')\n// 'The Great Escape'" },
  { sig: 'str_contains(string $haystack, string $needle): bool', desc: 'Checks whether $haystack contains $needle anywhere inside it. Case-sensitive, so lowercase both sides first for a case-insensitive search.', example: "str_contains('midnight in paris', 'paris')\n// true\nstr_contains('midnight in paris', 'rome')\n// false" },
  { sig: 'count(Countable|array $value): int', desc: 'Counts how many elements are in an array.', example: "count(['a', 'b', 'c'])\n// 3\ncount([])\n// 0" },
  { sig: 'implode(string $separator, array $array): string', desc: 'Joins every element of an array into one string, with $separator between each.', example: "implode(', ', ['Paris', 'Rome'])\n// 'Paris, Rome'\nimplode(', ', [])\n// '' (empty)" }
];
const MOVIE_GET_FUNCS = [
  { sig: 'trim(string $str): string', desc: 'Removes whitespace from the start and end of a string - useful on any raw text a visitor typed into a form field.', example: "trim('  hello  ')\n// 'hello'" },
  { sig: 'isset(mixed $var): bool', desc: 'Checks whether a variable (or array key) exists and is not null - use it before reading an optional $_GET value.', example: "isset($_GET['genre']) ? $_GET['genre'] : 'All'\nisset($_GET['missingKey'])\n// false" },
  { sig: 'in_array(mixed $needle, array $haystack): bool', desc: 'Checks whether a value exists anywhere in an array - perfect for validating a submitted value against a fixed list of allowed options.', example: "in_array('Comedy', ['All', 'Sci-Fi', 'Drama'])\n// false\nin_array('Drama', ['All', 'Sci-Fi', 'Drama'])\n// true" },
  { sig: 'stripos(string $haystack, string $needle): int|false', desc: 'Finds the position of $needle inside $haystack, case-insensitively, or false if it is not there. Commonly used just to check "does this contain that?" with !== false.', example: "stripos('Galactic Drift', 'drift') !== false\n// true\nstripos('Galactic Drift', 'ocean') !== false\n// false" },
  { sig: 'htmlspecialchars(string $string): string', desc: 'Escapes HTML special characters (<, >, &, quotes) before a value is echoed back into a page - this is what keeps a value a browser sent you from being able to inject a script (an XSS attack).', example: "htmlspecialchars('<b>hi</b>')\n// '&lt;b&gt;hi&lt;/b&gt;'" },
  { sig: 'array_sum(array $array): int|float', desc: 'Adds up every value in an array.', example: "array_sum([9.00, 11.00])\n// 20\narray_sum([])\n// 0" }
];
const MOVIE_REGEX_NUM_FUNCS = [
  { sig: 'trim(string $str): string', desc: 'Removes whitespace from the start and end of a string - useful on any raw text a visitor typed into a form field, before you validate or normalize it further.', example: "trim('  save10  ')\n// 'save10'" },
  { sig: 'preg_match(string $pattern, string $subject): int|false', desc: 'Checks whether $subject matches a regular expression $pattern, returning 1 for a match or 0 for no match.', example: "preg_match('/^[A-Z0-9]{4,10}$/', 'SAVE10')\n// 1\npreg_match('/^[A-Z0-9]{4,10}$/', 'sv!')\n// 0" },
  { sig: 'strtoupper(string $str): string', desc: 'Converts a string to all-uppercase - handy for normalizing a promo code before checking it.', example: "strtoupper('save10')\n// 'SAVE10'" },
  { sig: 'array_key_exists(string|int $key, array $array): bool', desc: 'Checks whether a key exists in an array (even if its value is null) - the right way to check a code against a list of valid codes.', example: "array_key_exists('SAVE10', ['SAVE10' => 10])\n// true\narray_key_exists('NOPE', ['SAVE10' => 10])\n// false" },
  { sig: 'round(float $num, int $precision = 0): float', desc: 'Rounds a number to the given number of decimal places.', example: 'round(5.004999, 2)\n// 5.0\nround(2.5)\n// 3.0' }
];
const MOVIE_VALIDATION_FUNCS = [
  { sig: 'strlen(string $str): int', desc: 'Returns the number of characters in a string - use it to check a text field is a reasonable length.', example: "strlen('Sam')\n// 3\nstrlen('')\n// 0" },
  { sig: 'is_numeric(mixed $value): bool', desc: 'Checks whether a value looks like a number (it may still be a string, like "7" from a form) - check this before treating it as a number.', example: "is_numeric('7')\n// true\nis_numeric('seven')\n// false" },
  { sig: 'isset(mixed $var): bool', desc: 'Checks whether a variable (or array key) exists and is not null - the standard way to check whether a checkbox was ticked.', example: "isset($_POST['terms']) && $_POST['terms'] === 'yes'\nisset($_POST['missingCheckbox'])\n// false" },
  { sig: 'implode(string $separator, array $array): string', desc: 'Joins an array of error messages into one string. An empty array joins to an empty (falsy) string, which is a quick way to check "were there any errors at all?"', example: "implode(' ', [])\n// '' (falsy)\nimplode(' ', ['Name is required.', 'Quantity is invalid.'])\n// 'Name is required. Quantity is invalid.' (truthy)" },
  { sig: 'htmlspecialchars(string $string): string', desc: 'Escapes a value before echoing it back into the page, so a name or message a visitor typed in can never be interpreted as HTML/script.', example: "htmlspecialchars($name)\nhtmlspecialchars('<b>hi</b>')\n// '&lt;b&gt;hi&lt;/b&gt;'" }
];

const QUESTIONS = {
  mv1a: {
    title: 'Movie Night Set 1, Part 1 of 3 – Classes and Objects (3 pts)',
    preview: true,
    functions: MOVIE_OOP_FUNCS,
    tests: [
      { label: '2 tickets (no group discount)', input: { tickets: '2' }, expectFinal: '24.00' },
      { label: '4 tickets (group discount kicks in)', input: { tickets: '4' }, expectFinal: '40.80' },
      { label: 'No tickets (0)', input: { tickets: '0' }, expectFinal: '0.00' }
    ],
    hints: [
      'A constructor\'s job is to take the values it was given and store them as properties on the object, so they\'re still there every time a method runs later. Inside __construct, $this refers to the object being built.',
      'calculateTotal needs a subtotal before anything else - one ticket\'s price, multiplied by how many tickets were bought.',
      'The 15% group discount only applies once a threshold is reached (4+ tickets) - you\'ve already written this exact two-branch shape of logic in the Café questions.',
      'A method hands its result back to whoever called it. What calculateTotal returns is the subtotal AFTER the discount has been taken off, not before.'
    ],
    files: [
      { name: 'README.md', editable: false, code: `# Movie Night Set 1, Part 1 of 3 – Classes and Objects (3 points)

## Goal
You've already built the Café order calculator with plain variables (Part 1), functions (Part 2), and arrays (Part 3). This quiz moves to **classes and objects** - the same idea of "group related logic together," taken one step further: now the *data* (a movie's title, genre, and price) and the *logic that works on that data* (calculating a total) live together inside one \`Movie\` object.

## What to build
In \`index.php\`, the \`Movie\` class already declares its three properties (\`$title\`, \`$genre\`, \`$ticketPrice\`). Finish it:

1. **\`__construct\`** - a class's constructor runs automatically every time you write \`new Movie(...)\`. Its job is to take each of the three parameters it was given and store it as the matching property on the object being built, so \`$movie->title\`, \`$movie->genre\`, and \`$movie->ticketPrice\` all have real values afterward.
2. **\`calculateTotal(int $tickets): float\`** - a *method* (a function that belongs to the class). It should:
   - Work out the subtotal for the given number of tickets, at this movie's own ticket price.
   - Apply a **15% group discount** to that subtotal, but only when \`$tickets\` is **4 or more** - the same two-branch shape of logic as the Café discount questions.
   - \`return\` the final amount: the subtotal with that discount taken off.

The rest of the page already creates the object (\`$movie = new Movie('Galactic Drift', 'Sci-Fi', 12.00);\`) and calls \`$movie->calculateTotal($tickets)\` for you.

## Why this matters
Every property and method you write here is just the variables/conditionals you already know, organized around \`new Movie(...)\` and \`$movie->calculateTotal(...)\` instead of loose variables and a free-floating function - this is the core idea behind OOP (object-oriented programming): bundle data and the behavior that works on it into one object.

## Testing your code
Open the **Tests** tab and click **Run tests**.

## Files in this project
| File | Can I edit it? |
|---|---|
| \`index.php\` | ✅ Yes - this is the only file you need to change |
| \`style.css\` | 🔒 Read-only - provided styling |
| \`script.js\` | 🔒 Read-only - a small helper script |
| \`README.md\` | 🔒 Read-only - this file |
` },
      { name: 'index.php', editable: true, code: `<?php
// Movie Night Set 1, Part 1 of 3 - Classes and Objects
// Do not add any top-level functions - the logic belongs inside the Movie class.

class Movie {
    public string $title;
    public string $genre;
    public float $ticketPrice;

    public function __construct(string $title, string $genre, float $ticketPrice) {
        // TODO: store each of the three constructor parameters as a property on $this


    }

    // Returns the final price for a given number of tickets, including the
    // 15% group discount that applies once 4 or more tickets are bought.
    public function calculateTotal(int $tickets): float {
        // TODO: $subtotal - this movie's ticket price times how many tickets were bought


        // TODO: $discount - 15% of $subtotal once $tickets is 4 or more, otherwise no discount


        // TODO: return the final amount - the subtotal with the discount taken off

    }
}

$movie = new Movie('Galactic Drift', 'Sci-Fi', 12.00);

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';
$tickets = 0;
$final = 0;

if ($submitted) {
    $tickets = (int) ($_POST['tickets'] ?? 0);
    $final = $movie->calculateTotal($tickets);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Movie Night Box Office</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Movie Night · Set 1 · Part 1 of 3</p>
    <h1>🎬 <?php echo htmlspecialchars($movie->title); ?></h1>
    <p><?php echo htmlspecialchars($movie->genre); ?> · $<?php echo number_format($movie->ticketPrice, 2); ?> / ticket · 15% off for 4+ tickets</p>
    <form method="post">
      <label>Tickets <input type="number" name="tickets" min="0" value="0"></label>
      <button type="submit">Buy tickets</button>
    </form>

    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Tickets</th><td><?php echo $tickets; ?></td></tr>
      <tr class="total"><th>Final amount</th><td>$<?php echo number_format($final, 2); ?></td></tr>
    </table>
    <?php endif; ?>
  </main>
</body>
</html>
` },
      { name: 'style.css', editable: false, code: movieCss('#1b1033', '#352a57', '#ffd369', '#4a2f00', '#6f4fd1', '#8d7fb0', '#3a2f5c') },
      { name: 'script.js', editable: false, code: MOVIE_SCRIPT }
    ]
  },
  mv1b: {
    title: 'Movie Night Set 1, Part 2 of 3 – Built-in Functions (3 pts)',
    preview: true,
    functions: MOVIE_STRING_FUNCS,
    tests: [
      { label: 'Search "paris"', input: { keyword: 'paris' }, expectFinal: '20.00' },
      { label: 'Search "the" (3+ matches → combo deal)', input: { keyword: 'the' }, expectFinal: '24.00' },
      { label: 'Blank search', input: { keyword: '' }, expectFinal: '0.00' }
    ],
    hints: [
      'Clean up $keyword the same way you\'ll clean up every title in the list - strip the extra spaces, and make it lowercase so the search isn\'t case-sensitive.',
      'For each raw title, build two versions: one trimmed-and-lowercased copy for comparing, and a nicely-capitalized copy (capitalize every word) for displaying on screen.',
      'A title only belongs in $matches when two things are both true: the keyword isn\'t blank, AND the cleaned title actually contains that keyword somewhere inside it.',
      'It\'s $10 per matching movie for the subtotal. Once the match count hits the combo-deal threshold (3+), a 20% discount comes off that subtotal - otherwise there\'s no discount at all.'
    ],
    files: [
      { name: 'README.md', editable: false, code: `# Movie Night Set 1, Part 2 of 3 – Built-in Functions (3 points)

## Goal
\`$rawTitles\` below is realistic, messy data - extra spaces, inconsistent capitalization - exactly the kind of thing Chapter 5's built-in string functions exist to clean up. Build a "Combo Deal Finder": search the messy list, display a clean version of each match, and price the deal.

## What to build
Fill in the \`// TODO\` sections in \`index.php\`:

1. Lowercase the submitted \`$keyword\` (it's already trimmed for you) with \`strtolower\`.
2. Inside the loop over \`$rawTitles\`, for each \`$raw\`:
   - \`$clean\` - a trimmed, lowercased version (for comparing).
   - \`$display\` - a nicely capitalized version for showing on screen (\`ucwords\` on the cleaned-up lowercase string).
   - If \`$keyword\` isn't blank **and** \`$clean\` contains \`$keyword\` (\`str_contains\`), add \`$display\` to \`$matches\`.
3. \`$matchCount = count($matches);\`
4. Pricing: **$10.00 per matching movie**, with a **20% "combo deal" discount** once **3 or more** movies match (reuse the if/else discount pattern from the Café questions).

## Testing your code
Open the **Tests** tab and click **Run tests**.

## Files in this project
| File | Can I edit it? |
|---|---|
| \`index.php\` | ✅ Yes - this is the only file you need to change |
| \`style.css\` | 🔒 Read-only - provided styling |
| \`script.js\` | 🔒 Read-only - a small helper script |
| \`README.md\` | 🔒 Read-only - this file |
` },
      { name: 'index.php', editable: true, code: `<?php
// Movie Night Set 1, Part 2 of 3 - Built-in Functions
// $rawTitles is intentionally messy - extra spaces, inconsistent capitalization -
// exactly the kind of real-world data Chapter 5's string functions clean up.

$rawTitles = [
    '  the great escape  ',
    'Midnight In Paris',
    '  THE LAST VOYAGE',
    'ocean drive  ',
    'The Theory of Everything',
    'paris by night  '
];

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';
$matches = [];
$matchCount = 0;
$final = 0;

if ($submitted) {
    $keyword = trim($_POST['keyword'] ?? '');
    // TODO: make $keyword lowercase, so the search doesn't care about case


    foreach ($rawTitles as $raw) {
        // TODO: $clean - a version of $raw that's trimmed and lowercased,
        //       ready for comparing against $keyword


        // TODO: $display - a nicely capitalized version of $clean,
        //       ready for showing on screen


        // TODO: a title counts as a match only when BOTH are true:
        //       $keyword isn't blank, AND $clean contains $keyword somewhere in it.
        //       When it matches, add $display (not $clean) to $matches.

    }

    // TODO: $matchCount - how many movies ended up in $matches


    // $10.00 per matching movie, with a 20% "combo deal" once 3 or more match.
    // TODO: $subtotal - the price before any discount


    // TODO: $discount - 20% of the subtotal once $matchCount reaches the combo
    //       threshold, otherwise no discount at all


    // TODO: $final - the subtotal with the discount taken off

}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Combo Deal Finder</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Movie Night · Set 1 · Part 2 of 3</p>
    <h1>🎬 Combo Deal Finder</h1>
    <form method="post">
      <label>Search <input type="text" name="keyword" placeholder="e.g. the, paris"></label>
      <button type="submit">Search</button>
    </form>

    <?php if ($submitted): ?>
    <div class="results">
      <?php foreach ($matches as $title): ?>
        <p class="movieItem"><?php echo htmlspecialchars($title); ?></p>
      <?php endforeach; ?>
      <?php if (!$matches): ?><p class="movieItem">No matches.</p><?php endif; ?>
    </div>
    <table class="receipt">
      <tr><th>Movies matched</th><td><?php echo $matchCount; ?></td></tr>
      <tr class="total"><th>Final amount</th><td>$<?php echo number_format($final, 2); ?></td></tr>
    </table>
    <?php endif; ?>
  </main>
</body>
</html>
` },
      { name: 'style.css', editable: false, code: movieCss('#1b1033', '#352a57', '#ffd369', '#4a2f00', '#6f4fd1', '#8d7fb0', '#3a2f5c') },
      { name: 'script.js', editable: false, code: MOVIE_SCRIPT }
    ]
  },
  mv1c: {
    title: 'Movie Night Set 1, Part 3 of 3 – Getting Data from the Browser (4 pts)',
    preview: true,
    functions: MOVIE_GET_FUNCS,
    tests: [
      { label: 'No filters (defaults)', input: {}, method: 'get', expectFinal: '45.90' },
      { label: 'Genre = Animation', input: { genre: 'Animation' }, method: 'get', expectFinal: '16.20' },
      { label: 'Search "the"', input: { keyword: 'the' }, method: 'get', expectFinal: '17.10' },
      { label: 'Invalid genre "Horror" falls back to All', input: { genre: 'Horror' }, method: 'get', expectFinal: '45.90' },
      { label: 'Family-friendly only', input: { family: 'yes' }, method: 'get', expectFinal: '26.10' }
    ],
    hints: [
      'This form uses method="get", so everything comes from $_GET, not $_POST. A field the visitor never filled in is simply missing from $_GET entirely - check for that before reading it, the same way you would for an optional $_POST value.',
      'A genre coming from the URL could be tampered with into something that was never one of your options. Validate it against $allowedGenres, and fall back to a safe default when it isn\'t on that list.',
      'A checkbox that isn\'t ticked doesn\'t come through as false - it\'s missing from $_GET altogether. Your check for $familyOnly needs to handle "not present" and "present but not yes" as the same thing: not family-only.',
      'Before echoing the search keyword back onto the page, think about what this week\'s slides said you must always do first to any user-supplied text before it\'s shown - that\'s what keeps a malicious search term from running as a script (XSS).'
    ],
    files: [
      { name: 'README.md', editable: false, code: `# Movie Night Set 1, Part 3 of 3 – Getting Data from the Browser (4 points)

## Goal
Build a Box Office search page. Unlike every form so far in this quiz, this one uses **\`method="get"\`** - so the search can be bookmarked and shared as a URL - which means the data arrives in \`$_GET\`, not \`$_POST\`.

## What to build
Fill in the \`// TODO\` sections in \`index.php\`:

1. **Collect** \`$keyword\` from \`$_GET['keyword']\`, trimmed, defaulting to \`''\` if it wasn't submitted at all.
2. **Collect** \`$genre\` from \`$_GET['genre']\`, defaulting to \`'All'\` if it wasn't submitted.
3. **Validate** \`$genre\` - if it isn't one of the values in \`$allowedGenres\`, fall back to \`'All'\`. This stops a tampered-with or made-up URL from silently showing zero results.
4. **Collect** \`$familyOnly\` - it should end up \`true\` only when the family checkbox was both present in the request *and* equal to \`'yes'\`.
5. Inside the filtering loop, finish the three \`...Ok\` checks (keyword/genre/family) and the two \`$subtotal\`/\`$matchCount\` TODOs after it.
6. **Escape the output**: when the page echoes the search keyword back (\`Showing results for: ...\`), make sure it's run through the same "always escape before displaying" step you've used elsewhere - this is the rule from this week's slides, and it's what stops a search box from being used to inject a script into the page.

Pricing: each matching movie's price is added to the subtotal, with a **10% "double feature" discount** once **2 or more** movies match.

## Testing your code
Open the **Tests** tab and click **Run tests**. One of the tests submits an invalid genre on purpose, to check that your \`in_array\` fallback actually works.

## Files in this project
| File | Can I edit it? |
|---|---|
| \`index.php\` | ✅ Yes - this is the only file you need to change |
| \`style.css\` | 🔒 Read-only - provided styling |
| \`script.js\` | 🔒 Read-only - a small helper script |
| \`README.md\` | 🔒 Read-only - this file |
` },
      { name: 'index.php', editable: true, code: `<?php
// Movie Night Set 1, Part 3 of 3 - Getting Data from the Browser
// Notice the form below uses method="get" - everything here comes from $_GET.

$movies = [
    ['title' => 'Galactic Drift',    'genre' => 'Sci-Fi',    'price' => 12.00, 'family' => false],
    ['title' => 'The Great Escape',  'genre' => 'Drama',     'price' => 10.00, 'family' => false],
    ['title' => 'Ocean Friends',     'genre' => 'Animation', 'price' => 9.00,  'family' => true],
    ['title' => 'Midnight in Paris', 'genre' => 'Romance',   'price' => 11.00, 'family' => true],
    ['title' => "The Lion's Roar",   'genre' => 'Animation', 'price' => 9.00,  'family' => true],
];
$allowedGenres = ['All', 'Sci-Fi', 'Drama', 'Animation', 'Romance'];

// TODO: $keyword - the trimmed value of $_GET['keyword'], or '' if it wasn't submitted
$keyword = '';

// TODO: $genre - the value of $_GET['genre'], or 'All' if it wasn't submitted
$genre = 'All';

// TODO: validate - if $genre isn't one of the values in $allowedGenres, reset it to 'All'


// TODO: $familyOnly - true only if the family checkbox was submitted AND equals 'yes'
$familyOnly = false;

$matches = [];
foreach ($movies as $movie) {
    // TODO: $keywordOk - true when $keyword is blank, OR the movie's title contains it


    // TODO: $genreOk - true when $genre is 'All', OR it matches the movie's own genre


    // TODO: $familyOk - true when $familyOnly is false, OR the movie itself is family-friendly


    if ($keywordOk && $genreOk && $familyOk) {
        $matches[] = $movie;
    }
}

// TODO: $matchCount = count($matches);

$subtotal = 0;
foreach ($matches as $movie) {
    // TODO: $subtotal += $movie['price'];

}
// TODO: $discount = $matchCount >= 2 ? $subtotal * 0.10 : 0; ("double feature" 10% off for 2+ results)


// TODO: $final = $subtotal - $discount;

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Box Office Search</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Movie Night · Set 1 · Part 3 of 3</p>
    <h1>🎬 Box Office Search</h1>
    <form method="get">
      <label>Search <input type="text" name="keyword" value="<?php echo htmlspecialchars($keyword); ?>"></label>
      <label>Genre
        <select name="genre">
          <?php foreach ($allowedGenres as $g): ?>
            <option value="<?php echo htmlspecialchars($g); ?>" <?php echo $g === $genre ? 'selected' : ''; ?>><?php echo htmlspecialchars($g); ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label><input type="checkbox" name="family" value="yes" <?php echo $familyOnly ? 'checked' : ''; ?>> Family-friendly only</label>
      <button type="submit">Search</button>
    </form>

    <p>Showing results for: <strong><?php /* TODO: echo the (safely-escaped) keyword, or '(any title)' when it's blank */ ?></strong></p>

    <div class="results">
      <?php foreach ($matches as $movie): ?>
        <p class="movieItem"><?php echo htmlspecialchars($movie['title']); ?> — <?php echo htmlspecialchars($movie['genre']); ?> — $<?php echo number_format($movie['price'], 2); ?></p>
      <?php endforeach; ?>
      <?php if (!$matches): ?><p class="movieItem">No matches.</p><?php endif; ?>
    </div>
    <table class="receipt">
      <tr><th>Movies matched</th><td><?php echo $matchCount; ?></td></tr>
      <tr class="total"><th>Final amount</th><td>$<?php echo number_format($final, 2); ?></td></tr>
    </table>
  </main>
</body>
</html>
` },
      { name: 'style.css', editable: false, code: movieCss('#1b1033', '#352a57', '#ffd369', '#4a2f00', '#6f4fd1', '#8d7fb0', '#3a2f5c') },
      { name: 'script.js', editable: false, code: MOVIE_SCRIPT }
    ]
  },
  mv2a: {
    title: 'Movie Night Set 2, Part 1 of 3 – Classes and Arrays of Objects (3 pts)',
    preview: true,
    functions: MOVIE_OOP_FUNCS,
    tests: [
      { label: '2 standard, 1 VIP', input: { standardQty: '2', vipQty: '1' }, expectFinal: '36.00' },
      { label: '4 standard, 2 VIP (6 tickets → group discount)', input: { standardQty: '4', vipQty: '2' }, expectFinal: '64.80' },
      { label: 'No tickets', input: { standardQty: '0', vipQty: '0' }, expectFinal: '0.00' }
    ],
    hints: [
      'You need $standardQty new standard tickets added to the $tickets array - a loop that runs that many times, creating one Ticket object on each pass, is the pattern you are after.',
      'The VIP tickets work the same way, just with a different quantity and seat type.',
      'price() just needs to look at this ticket\'s own $seatType and return the matching dollar amount.',
      'Once $tickets is full of Ticket objects, you can call ->price() on each one as you loop over the array, the same way you would call any other method on an object.'
    ],
    files: [
      { name: 'README.md', editable: false, code: `# Movie Night Set 2, Part 1 of 3 – Classes and Arrays of Objects (3 points)

## Goal
Set 2 continues where Set 1 left off. This time, a booking is made of **several \`Ticket\` objects** stored together in one array - combining classes (Part 1 of Set 1) with arrays (the Café's Part 3), the same way a real shopping cart holds a list of item objects.

## What to build
1. Finish the \`Ticket\` class: the constructor needs to store the seat type it was given, and \`price()\` returns **\\$10.00** for \`'standard'\` or **\\$16.00** for \`'vip'\`.
2. Build \`$tickets\` - an array of \`Ticket\` objects - by creating \`$standardQty\` standard tickets and \`$vipQty\` VIP tickets, and adding every one of them to the array.
3. Work out how many tickets ended up in that array.
4. Loop over \`$tickets\` and total up what each one's \`price()\` comes out to, into \`$subtotal\`.
5. Apply a **10% group discount** once the ticket count is **6 or more** - the same two-branch shape of logic as always.

## Testing your code
Open the **Tests** tab and click **Run tests**.

## Files in this project
| File | Can I edit it? |
|---|---|
| \`index.php\` | ✅ Yes - this is the only file you need to change |
| \`style.css\` | 🔒 Read-only - provided styling |
| \`script.js\` | 🔒 Read-only - a small helper script |
| \`README.md\` | 🔒 Read-only - this file |
` },
      { name: 'index.php', editable: true, code: `<?php
// Movie Night Set 2, Part 1 of 3 - Classes, Objects, and Arrays of Objects

class Ticket {
    public string $seatType; // 'standard' or 'vip'

    public function __construct(string $seatType) {
        // TODO: store $seatType as a property on $this

    }

    public function price(): float {
        // TODO: return the price matching THIS ticket's own $seatType -
        //       10.00 for 'standard', 16.00 for 'vip'

    }
}

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';
$ticketCount = 0;
$final = 0;

if ($submitted) {
    $standardQty = (int) ($_POST['standardQty'] ?? 0);
    $vipQty = (int) ($_POST['vipQty'] ?? 0);

    $tickets = [];
    // TODO: create $standardQty new standard Ticket objects, adding each one to $tickets


    // TODO: do the same for $vipQty VIP tickets


    // TODO: $ticketCount - how many tickets ended up in $tickets


    $subtotal = 0;
    foreach ($tickets as $ticket) {
        // TODO: add this ticket's own price into $subtotal

    }

    // TODO: $discount - 10% of $subtotal once $ticketCount is 6 or more, otherwise no discount


    // TODO: $final - the subtotal with the discount taken off

}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ticket Booking</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Movie Night · Set 2 · Part 1 of 3</p>
    <h1>🎟️ Ticket Booking</h1>
    <form method="post">
      <label>Standard tickets ($10.00) <input type="number" name="standardQty" min="0" value="0"></label>
      <label>VIP tickets ($16.00) <input type="number" name="vipQty" min="0" value="0"></label>
      <button type="submit">Book tickets</button>
    </form>

    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Tickets booked</th><td><?php echo $ticketCount; ?></td></tr>
      <tr class="total"><th>Final amount</th><td>$<?php echo number_format($final, 2); ?></td></tr>
    </table>
    <?php endif; ?>
  </main>
</body>
</html>
` },
      { name: 'style.css', editable: false, code: movieCss('#2b0f10', '#5c2224', '#ffb3b3', '#5c0000', '#b3302f', '#c79a9a', '#4a2224') },
      { name: 'script.js', editable: false, code: MOVIE_SCRIPT }
    ]
  },
  mv2b: {
    title: 'Movie Night Set 2, Part 2 of 3 – Built-in Functions: Regex & Numbers (3 pts)',
    preview: true,
    functions: MOVIE_REGEX_NUM_FUNCS,
    tests: [
      { label: 'Valid code "save10" (lowercase), 5 tickets', input: { promo: 'save10', tickets: '5' }, expectFinal: '45.00' },
      { label: 'Bad format "bogus!!", 5 tickets', input: { promo: 'bogus!!', tickets: '5' }, expectFinal: '50.00' },
      { label: 'No code, 5 tickets', input: { promo: '', tickets: '5' }, expectFinal: '50.00' },
      { label: 'Valid code "movie5", 3 tickets', input: { promo: 'movie5', tickets: '3' }, expectFinal: '28.50' }
    ],
    hints: [
      'Normalize the submitted code first, the same way you normalized search text earlier in this quiz - so "  save10 ", "SAVE10", and "Save10" all end up identical before anything else happens to them.',
      'A valid promo code has a specific shape: 4 to 10 characters, uppercase letters and digits only. The function reference panel has a tool built exactly for checking a string against a shape like that.',
      'Only look the code up in $promoCodes if the format check passed - checking the format first means an obviously-wrong code never even reaches the lookup.',
      'The discount amount is a percentage of the subtotal - don\'t forget you\'re working with a percent, not a decimal fraction, and that money amounts should come out rounded to 2 decimal places.'
    ],
    files: [
      { name: 'README.md', editable: false, code: `# Movie Night Set 2, Part 2 of 3 – Built-in Functions: Regex & Numbers (3 points)

## Goal
Validate a promo code using a **regular expression**, look up its discount in an array, and calculate the final price - combining three different kinds of built-in functions from Chapter 5: string, regex, and numeric.

## What to build
Fill in the \`// TODO\` sections in \`index.php\`:

1. **Normalize** the submitted code so \`"  save10 "\`, \`"SAVE10"\`, and \`"Save10"\` are all treated the same before you check or look up anything.
2. **Validate the format** with a regular expression: a real promo code here is **4 to 10 characters, uppercase letters and digits only**. The function reference panel has the regex tool for this, and the character-class pattern you need is close to one already shown there.
3. **Look up the discount**: only if the format was valid *and* the normalized code exists as a key in \`$promoCodes\` - otherwise the discount percentage is \`0\`.
4. **Calculate**: the subtotal is straightforward (tickets × price), and the discount amount is that percentage of the subtotal - rounded to 2 decimal places, since it's money - subtracted for \`$final\`.

## Why validate the format first?
If you only checked \`array_key_exists\`, a code like \`"<script>"\` would just quietly fail the lookup - harmless here, but in a real app you always want to reject obviously-wrong input with a clear rule (the regex) before you even check it against real data.

## Testing your code
Open the **Tests** tab and click **Run tests** - it checks a valid code, an invalid-format code, no code at all, and a second valid code.

## Files in this project
| File | Can I edit it? |
|---|---|
| \`index.php\` | ✅ Yes - this is the only file you need to change |
| \`style.css\` | 🔒 Read-only - provided styling |
| \`script.js\` | 🔒 Read-only - a small helper script |
| \`README.md\` | 🔒 Read-only - this file |
` },
      { name: 'index.php', editable: true, code: `<?php
// Movie Night Set 2, Part 2 of 3 - Built-in Functions: Regex and Numbers

$promoCodes = ['SAVE10' => 10, 'SAVE20' => 20, 'MOVIE5' => 5]; // code => % off
$pricePerTicket = 10.00;

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';
$ticketCount = 0;
$final = 0;

if ($submitted) {
    $ticketCount = (int) ($_POST['tickets'] ?? 0);
    $rawPromo = $_POST['promo'] ?? '';

    // TODO: $promo - a trimmed, uppercase version of $rawPromo, ready for checking
    $promo = '';

    // TODO: $validFormat - true only if $promo is 4-10 characters, A-Z/0-9 only
    $validFormat = false;

    // TODO: $discountPct - the matching % from $promoCodes, but only when $validFormat
    //       is true AND $promo actually exists as a key in $promoCodes; otherwise 0
    $discountPct = 0;

    $subtotal = $ticketCount * $pricePerTicket;
    // TODO: $discountAmount - $discountPct percent of $subtotal, rounded to 2 decimals
    $discountAmount = 0;

    // TODO: $final - the subtotal with the discount amount taken off

}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Promo Codes</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Movie Night · Set 2 · Part 2 of 3</p>
    <h1>🎟️ Apply a Promo Code</h1>
    <form method="post">
      <label>Tickets ($10.00 each) <input type="number" name="tickets" min="0" value="0"></label>
      <label>Promo code <input type="text" name="promo" placeholder="optional"></label>
      <button type="submit">Apply</button>
    </form>

    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Tickets</th><td><?php echo $ticketCount; ?></td></tr>
      <tr class="total"><th>Final amount</th><td>$<?php echo number_format($final, 2); ?></td></tr>
    </table>
    <?php endif; ?>
  </main>
</body>
</html>
` },
      { name: 'style.css', editable: false, code: movieCss('#2b0f10', '#5c2224', '#ffb3b3', '#5c0000', '#b3302f', '#c79a9a', '#4a2224') },
      { name: 'script.js', editable: false, code: MOVIE_SCRIPT }
    ]
  },
  mv2c: {
    title: 'Movie Night Set 2, Part 3 of 3 – Form Validation (4 pts)',
    preview: true,
    functions: MOVIE_VALIDATION_FUNCS,
    tests: [
      { label: 'Valid: Alex Kim, 3 tickets', input: { name: 'Alex Kim', quantity: '3', terms: 'yes' }, expectFinal: '30.00' },
      { label: 'Valid: Jo, 10 tickets (upper boundary)', input: { name: 'Jo', quantity: '10', terms: 'yes' }, expectFinal: '100.00' },
      { label: 'Valid: Sam, 1 ticket (lower boundary)', input: { name: 'Sam', quantity: '1', terms: 'yes' }, expectFinal: '10.00' },
      { label: 'Invalid: name too short ("A")', input: { name: 'A', quantity: '3', terms: 'yes' }, expectFinal: '0.00' },
      { label: 'Invalid: quantity out of range (15)', input: { name: 'Alex', quantity: '15', terms: 'yes' }, expectFinal: '0.00' },
      { label: 'Invalid: terms not checked', input: { name: 'Alex', quantity: '3' }, expectFinal: '0.00' }
    ],
    hints: [
      'Name needs to fall inside a length range - think about what you\'d check to make sure a string is neither too short nor too long, and what message to store in $errors when it fails.',
      'Quantity has to pass two different kinds of check: is it actually a number at all, and if so, does it fall inside the allowed range? Either failure should land the same kind of message in $errors.',
      'Terms is already computed as a true/false value for you - $errors just needs an entry for the case where it came out false.',
      '$invalid needs to end up falsy when there were no errors, and truthy when there were. There\'s a function in the reference panel that turns an array of messages into one string - think about what it produces when the array is empty versus when it isn\'t.'
    ],
    files: [
      { name: 'README.md', editable: false, code: `# Movie Night Set 2, Part 3 of 3 – Form Validation (4 points)

## Goal
This is the quiz's last part, and it brings everything from this week's "Getting Data from the Browser" slides together: collecting several fields, **validating every one of them**, collecting every problem into one \`$errors\` array, and only processing the booking once there are no errors at all.

## What to build
Fill in the \`// TODO\` sections in \`index.php\`:

1. **Validate \`$name\`**: it must be **2 to 40 characters**. If it isn't, set \`$errors['name']\` to a message.
2. **Validate \`$quantity\`**: it must actually be a number, **and** that number must fall between **1 and 10**. If either check fails, set \`$errors['quantity']\`.
3. **Validate \`$terms\`**: the checkbox must have been checked (\`$terms\` is already computed for you as true/false). If it's \`false\`, set \`$errors['terms']\`.
4. **Combine the errors**: \`$invalid\` should end up falsy when \`$errors\` is empty, and truthy when it isn't - exactly like the slides' approach to turning a whole array of error messages into one value you can check with a simple \`if\`.
5. Only when there are no errors, calculate the final amount from the ticket price and quantity.

If there *are* errors, the page already shows them back to the student (each one escaped with \`htmlspecialchars\`) above the receipt - you don't need to touch that part, just make sure \`$errors\` (and then \`$invalid\`) end up right. The receipt row always appears once the form is submitted, but it stays **$0.00** whenever there are errors, since nothing was actually booked.

## Testing your code
Open the **Tests** tab and click **Run tests**. Unlike the other parts, this one's 6 tests are **not** all meant to succeed in booking: 3 use valid input and expect a real dollar total, and 3 use *invalid* input (a too-short name, an out-of-range quantity, an unchecked box) and expect **$0.00** - because correctly-written validation should reject them. If your validation isn't right, one of those three will show a real dollar amount instead of $0.00.

## Files in this project
| File | Can I edit it? |
|---|---|
| \`index.php\` | ✅ Yes - this is the only file you need to change |
| \`style.css\` | 🔒 Read-only - provided styling |
| \`script.js\` | 🔒 Read-only - a small helper script |
| \`README.md\` | 🔒 Read-only - this file |
` },
      { name: 'index.php', editable: true, code: `<?php
// Movie Night Set 2, Part 3 of 3 - Getting Data from the Browser: full form validation

$ticketPrice = 10.00;
$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';
$errors = [];
$invalid = '';
$final = 0;
$name = '';
$quantity = '';

if ($submitted) {
    $name = trim($_POST['name'] ?? '');
    $quantity = $_POST['quantity'] ?? '';
    $terms = isset($_POST['terms']) && $_POST['terms'] === 'yes';

    // TODO: if $name's length is outside the 2-40 character range, set
    //       $errors['name'] to a message explaining why


    // TODO: if $quantity isn't a valid number, OR falls outside 1-10, set
    //       $errors['quantity'] to a message explaining why


    // TODO: if $terms came out false, set $errors['terms'] to a message


    // TODO: $invalid - should be falsy when $errors is empty, truthy otherwise


    if (!$invalid) {
        // TODO: $final - the ticket price times the quantity booked

    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Checkout</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Movie Night · Set 2 · Part 3 of 3</p>
    <h1>🎟️ Checkout</h1>
    <form method="post">
      <label>Name <input type="text" name="name" value="<?php echo htmlspecialchars($name); ?>"></label>
      <label>Tickets ($10.00 each) <input type="number" name="quantity" min="1" max="10" value="<?php echo htmlspecialchars((string) $quantity); ?>"></label>
      <label><input type="checkbox" name="terms" value="yes"> I agree to the terms</label>
      <button type="submit">Book now</button>
    </form>

    <?php if ($submitted && $invalid): ?>
    <div class="errorBox">
      <strong>Please fix the following:</strong>
      <ul>
        <?php foreach ($errors as $message): ?>
          <li><?php echo htmlspecialchars($message); ?></li>
        <?php endforeach; ?>
      </ul>
    </div>
    <?php endif; ?>
    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Booked by</th><td><?php echo htmlspecialchars($name); ?></td></tr>
      <tr><th>Tickets</th><td><?php echo (int) $quantity; ?></td></tr>
      <tr class="total"><th>Final amount</th><td>$<?php echo number_format($final, 2); ?></td></tr>
    </table>
    <?php endif; ?>
  </main>
</body>
</html>
` },
      { name: 'style.css', editable: false, code: movieCss('#2b0f10', '#5c2224', '#ffb3b3', '#5c0000', '#b3302f', '#c79a9a', '#4a2224') },
      { name: 'script.js', editable: false, code: MOVIE_SCRIPT }
    ]
  },
  blank: { title: 'Blank PHP Editor', preview: false, stdin: '', hints: [], files: [{ name: 'index.php', editable: true, code: '<?php\n\n' }] }
};

/* ------------------------------------------------------------------
   TEMPLATED QUESTIONS

   A question above is fully hand-written - every number in it was typed in by hand, and
   so is every related "answer key" number in its tests. A question defined here instead
   has a `params` block (values with a min/max and how many decimals to round to) and uses
   {{paramName}} placeholders anywhere in its title/hints/files/functions text; a `tests`
   entry's `expectFinal` is a function of those params instead of a fixed string. The point
   isn't to vary per student - every student sees the exact same resolved numbers, just
   like every other question here, which is what keeps grading fair between students. The
   point is to make a NEW question (or a differently-numbered variant of one, for a
   different exam/quiz sitting) fast to generate - the min/max ranges and the formulas in
   `expectFinal` only have to be written once, and asking Claude to add or re-roll one from
   here on is a quick conversation rather than hand-editing a wall of PHP and recomputing
   every expected test answer by hand.

   TEMPLATE_SEED is a single fixed number, baked into the build, shared by every student -
   not randomized per browser session. Every student who opens a question defined here
   gets the IDENTICAL resolved numbers, every time, the same as a hand-written question.
   To get a differently-numbered variant for a different exam/quiz (not for different
   students within the same one), change this to a different fixed number and rebuild -
   that new number is still shared by everyone sitting THAT exam.

   Add a new question by copying an existing entry below (or asking Claude to write one) -
   once it's added to QUESTION_TEMPLATES, it's automatically resolved and merged into
   QUESTIONS under its own key, indistinguishable from a hand-written question to the rest
   of the app.
------------------------------------------------------------------- */

const TEMPLATE_SEED = 1; // bump to a different fixed number to re-roll a new, still-fixed, still-fair-for-everyone variant
// mulberry32 - a small, fast, fully deterministic PRNG from a 32-bit seed (same seed,
// same sequence of values, every time - unlike Math.random(), which can't be seeded).
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randParam(rng, spec) {
  const decimals = spec.decimals ?? 0;
  const step = spec.step ?? (decimals ? 1 / Math.pow(10, decimals) : 1);
  const n = Math.round((spec.min + rng() * (spec.max - spec.min)) / step) * step;
  return Number(n.toFixed(decimals));
}
function fillPlaceholders(str, params) {
  return str.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in params ? String(params[k]) : m));
}
function deepFillPlaceholders(value, params) {
  if (typeof value === 'string') return fillPlaceholders(value, params);
  if (Array.isArray(value)) return value.map(v => deepFillPlaceholders(v, params));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k in value) out[k] = deepFillPlaceholders(value[k], params);
    return out;
  }
  return value;
}
function resolveTemplate(tpl, rng) {
  const params = {};
  for (const name in tpl.params) params[name] = randParam(rng, tpl.params[name]);
  const resolved = deepFillPlaceholders(
    { title: tpl.title, preview: tpl.preview, sql: tpl.sql, stdin: tpl.stdin, functions: tpl.functions, hints: tpl.hints, files: tpl.files },
    params
  );
  resolved.tests = (tpl.tests || []).map(t => ({
    label: fillPlaceholders(t.label, params),
    input: deepFillPlaceholders(t.input, params),
    expectFinal: t.expectFinal(params)
  }));
  return resolved;
}

const QUESTION_TEMPLATES = {
  movie1: {
    title: 'Bonus – Movie Night Order',
    preview: true,
    functions: CAFE_FUNCS_BASE,
    params: {
      ticketPrice: { min: 8, max: 14, decimals: 2 },
      snackPrice: { min: 3, max: 7, decimals: 2 },
      discountThreshold: { min: 20, max: 40, step: 5, decimals: 0 },
      discountPct: { min: 5, max: 15, step: 5, decimals: 0 },
      taxPct: { min: 3, max: 9, decimals: 0 }
    },
    hints: [
      'Ticket cost and snack cost are each just a quantity times its own price. The subtotal is those two added together.',
      'The {{discountPct}}% discount only applies once the subtotal reaches the {{discountThreshold}} threshold - below that, there is no discount at all. This is the same two-branch shape of logic as the Café discount questions.',
      'Tax is {{taxPct}}% of the subtotal AFTER the discount is subtracted, not before - the order these are calculated in matters.',
      'Any dollar amount you echo onto the page should go through the same formatting tool you\'ve used for money everywhere else in this course.'
    ],
    files: [
      { name: 'README.md', editable: false, code: `# Bonus – Movie Night Order

## Goal
Finish \`index.php\` so the order form correctly calculates and displays the total cost - same shape of problem as the Café parts, with a different set of numbers.

## The numbers for this question
| | |
|---|---|
| Ticket price | \`$ {{ticketPrice}}\` |
| Snack price | \`$ {{snackPrice}}\` |
| Discount | **{{discountPct}}%** once the subtotal is **$ {{discountThreshold}} or more** |
| Tax | **{{taxPct}}%** of the subtotal after the discount |

## What to build
When the form is submitted, fill in the \`// TODO\` sections so the page calculates, in order:
1. \`$ticketCost\` and \`$snackCost\` - each quantity times its price above.
2. \`$subtotal\` - the two costs added together.
3. \`$discount\` - **{{discountPct}}%** of the subtotal, but only when the subtotal is **$ {{discountThreshold}} or more**; otherwise \`$0\`.
4. \`$tax\` - **{{taxPct}}%** of the subtotal *after* the discount has been subtracted.
5. \`$final\` - the subtotal, minus the discount, plus the tax.

Then echo each amount into its matching table cell, using \`number_format($value, 2)\`.

## Testing your code
Open the **Tests** tab and click **Run tests** - the checks use YOUR numbers above, not anyone else's.
` },
      { name: 'index.php', editable: true, code: `<?php
// Bonus - Movie Night Order (generated from a template - see questions.js)

$ticketPrice = {{ticketPrice}};
$snackPrice  = {{snackPrice}};

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';

if ($submitted) {
    $tickets = (int) ($_POST['tickets'] ?? 0);
    $snacks  = (int) ($_POST['snacks'] ?? 0);

    // TODO: calculate $ticketCost and $snackCost


    // TODO: calculate $subtotal


    // TODO: use if/else to calculate $discount ({{discountPct}}% when $subtotal is {{discountThreshold}} or more, otherwise 0)


    // TODO: calculate $tax ({{taxPct}}% of the subtotal after the discount)


    // TODO: calculate $final

}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Movie Night</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="card">
    <h1>Movie Night Order</h1>
    <form method="post">
      <label>Tickets <input type="number" name="tickets" min="0" value="0"></label>
      <label>Snacks <input type="number" name="snacks" min="0" value="0"></label>
      <button type="submit">Calculate</button>
    </form>
    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Ticket cost</th><td>$<?php // TODO: echo the ticket cost ?></td></tr>
      <tr><th>Snack cost</th><td>$<?php // TODO: echo the snack cost ?></td></tr>
      <tr class="subtotal"><th>Subtotal</th><td>$<?php // TODO: echo the subtotal ?></td></tr>
      <tr><th>Discount</th><td>$<?php // TODO: echo the discount ?></td></tr>
      <tr><th>Tax</th><td>$<?php // TODO: echo the tax ?></td></tr>
      <tr class="total"><th>Final amount</th><td>$<?php // TODO: echo the final amount ?></td></tr>
    </table>
    <?php endif; ?>
  </main>
</body>
</html>
` },
      { name: 'style.css', editable: false, code: `body{font-family:system-ui,sans-serif;background:#eef3f8;margin:0;padding:24px;color:#20242b}
.card{max-width:440px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #dbe2ea}
h1{margin:0 0 16px;font-size:21px}
label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
input{width:80px;padding:6px}
button{margin-top:6px;padding:8px 16px;background:#2f6fed;color:#fff;border:0;border-radius:4px;cursor:pointer}
.receipt{width:100%;margin-top:20px;border-collapse:collapse}
.receipt th{text-align:left;font-weight:400;color:#5b6472}
.receipt td{text-align:right}
.receipt th,.receipt td{padding:6px 0;border-bottom:1px solid #eef1f5}
.receipt tr.subtotal th,.receipt tr.subtotal td{border-top:2px solid #dbe2ea;font-weight:600;color:#20242b}
.receipt tr.total th,.receipt tr.total td{font-weight:700;font-size:17px;border-bottom:0}
` }
    ],
    // Each expectFinal is a function of the resolved params, computed with the exact same
    // math the student's PHP is supposed to implement - this is the "answer key" logic,
    // kept in one place so it can never silently drift from what grading actually checks.
    tests: [
      {
        label: '2 tickets, 2 snacks',
        input: { tickets: '2', snacks: '2' },
        expectFinal: p => {
          const subtotal = p.ticketPrice * 2 + p.snackPrice * 2;
          const discount = subtotal >= p.discountThreshold ? subtotal * p.discountPct / 100 : 0;
          const tax = (subtotal - discount) * p.taxPct / 100;
          return (subtotal - discount + tax).toFixed(2);
        }
      },
      {
        label: '4 tickets, 1 snack',
        input: { tickets: '4', snacks: '1' },
        expectFinal: p => {
          const subtotal = p.ticketPrice * 4 + p.snackPrice * 1;
          const discount = subtotal >= p.discountThreshold ? subtotal * p.discountPct / 100 : 0;
          const tax = (subtotal - discount) * p.taxPct / 100;
          return (subtotal - discount + tax).toFixed(2);
        }
      },
      {
        label: 'Nothing ordered (0, 0)',
        input: { tickets: '0', snacks: '0' },
        expectFinal: () => '0.00'
      }
    ]
  }
};

// Resolve every template above, using this tab's own stable per-sitting seed, and merge the
// results into QUESTIONS right alongside the hand-written questions - from this point on, a
// templated question is indistinguishable from a static one to the rest of the app (tests.js,
// debugger.js, editor-ui.js, ...), which never need to know the difference.
(function resolveAllTemplates() {
  const rng = makeRng(TEMPLATE_SEED);
  for (const k in QUESTION_TEMPLATES) QUESTIONS[k] = resolveTemplate(QUESTION_TEMPLATES[k], rng);
})();

// Which question keys THIS build actually offers, in picker order. Leave empty for the full
// development/demo build (everything above is offered). For one exam's build, set this to
// just that exam's keys - e.g. ['mv1a','mv1b','mv1c'] for an exam using only Set 1 - so
// students see (and can only reach, even via a direct ?q= link) that exam's own question
// set, while the full library keeps living in this one file across every exam. 'blank' is
// always kept available as a safety net regardless of this list.
//
// Restricted to this quiz's two movie-themed sets only, so students can't stumble onto the
// "Bonus - Movie Night Order" template question below (left in the file for future reuse,
// but hidden from the picker and from direct ?q=movie1 links while this is in effect).
const EXAM_SET = ['mv1a', 'mv1b', 'mv1c', 'mv2a', 'mv2b', 'mv2c'];
if (EXAM_SET.length) {
  for (const k in QUESTIONS) if (k !== 'blank' && !EXAM_SET.includes(k)) delete QUESTIONS[k];
}
