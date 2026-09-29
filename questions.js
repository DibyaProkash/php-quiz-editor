/* ------------------------------------------------------------------
   QUESTIONS  (link students to  index.html?q=part1 )
   files     : the run file is the first .php file (index.php).
               editable:false makes a file read-only (CSS/JS you provide).
               Other files are inlined into the preview automatically when
               the page uses <link href="style.css"> or <script src="script.js">.
   preview   : true  = show rendered page. false = plain text output only.
   stdin     : text for the Input box (readline()/fgets(STDIN)). Omit to hide the box.
   hints     : optional array, revealed one at a time.
   tests     : optional array of { label, input: {postFieldName: value, ...}, expectFinal }.
               Each test POSTs `input` to the student's own current code through the real
               PHP engine and compares the rendered ".total" row against expectFinal.
               Adds a "Tests" tab where students can run these themselves. Omit to hide it.
   functions : optional array of { sig, desc, example } shown in a collapsible
               "PHP function reference" panel. Omit to hide that panel.
------------------------------------------------------------------- */

// The 3 official test cases for the Café Order Calculator (same math in all 3 parts).
const CAFE_TESTS = [
  { label: '2 sandwiches, 2 drinks, 1 dessert', input: { sandwiches: '2', drinks: '2', desserts: '1' }, expectFinal: '27.30' },
  { label: '3 sandwiches, 2 drinks, 1 dessert', input: { sandwiches: '3', drinks: '2', desserts: '1' }, expectFinal: '32.60' },
  { label: 'Nothing ordered (0, 0, 0)', input: { sandwiches: '0', drinks: '0', desserts: '0' }, expectFinal: '0.00' }
];

// Built-in PHP functions worth knowing for this question. Real functions, real PHP -
// the editor runs actual PHP 8.4, so every one of these already works as shown.
const CAFE_FUNCS_BASE = [
  { sig: 'number_format(float $num, int $decimals = 0): string', desc: 'Formats a number with grouped thousands and a fixed number of decimal places - use it whenever you display a dollar amount.', example: 'number_format(27.3, 2)\n// "27.30"' },
  { sig: 'round(float $num, int $precision = 0): float', desc: 'Rounds a number to the given number of decimal places.', example: 'round(4.567, 2)\n// 4.57' },
  { sig: 'isset(mixed $var): bool', desc: 'Checks whether a variable (or array key) exists and is not null - handy for reading an optional $_POST value safely.', example: "isset($_POST['sandwiches']) ? (int) $_POST['sandwiches'] : 0" }
];
const CAFE_FUNCS_ARRAYS = CAFE_FUNCS_BASE.concat([
  { sig: 'array_sum(array $array): int|float', desc: 'Adds up every value in an array and returns the total. Perfect for turning your $costs array into a subtotal.', example: "array_sum(['sandwich' => 17, 'drink' => 5, 'dessert' => 4])\n// 26" },
  { sig: 'count(Countable|array $value): int', desc: 'Counts how many elements are in an array.', example: "count(['sandwich', 'drink', 'dessert'])\n// 3" },
  { sig: 'array_keys(array $array): array', desc: 'Returns a new array containing all the keys of an array.', example: "array_keys(['sandwich' => 8.50, 'drink' => 2.50])\n// ['sandwich', 'drink']" }
]);

const QUESTIONS = {
  part1: {
    title: 'Part 1 – Variables, Expressions, and Conditionals',
    preview: true,
    tests: CAFE_TESTS,
    functions: CAFE_FUNCS_BASE,
    hints: [
      'Sandwich cost = sandwiches × 8.50. Do the same for drinks and desserts, then add all three for the subtotal.',
      'Use if ($subtotal >= 30) { ... } else { ... } to set the 10% discount, or $0 otherwise.',
      'Tax is 5% of the subtotal after the discount is subtracted, not before.',
      'Use number_format($value, 2) when you display each dollar amount.'
    ],
    files: [
      { name: 'index.php', editable: true, code: `<?php
// Part 1 - Variables, Expressions, and Conditionals
// Do not use functions or arrays in this part.

$sandwichPrice = 8.50;
$drinkPrice    = 2.50;
$dessertPrice  = 4.00;

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';

if ($submitted) {
    $sandwiches = (int) ($_POST['sandwiches'] ?? 0);
    $drinks     = (int) ($_POST['drinks'] ?? 0);
    $desserts   = (int) ($_POST['desserts'] ?? 0);

    // TODO: calculate $sandwichCost, $drinkCost and $dessertCost


    // TODO: calculate $subtotal


    // TODO: use if/else to calculate $discount (10% when $subtotal is 30 or more, otherwise 0)


    // TODO: calculate $tax (5% of the subtotal after the discount)


    // TODO: calculate $final

}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Student Café</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Part 1 of 3</p>
    <h1>Student Café Order Calculator</h1>
    <form method="post">
      <label>Sandwiches <input type="number" name="sandwiches" min="0" value="0"></label>
      <label>Drinks <input type="number" name="drinks" min="0" value="0"></label>
      <label>Desserts <input type="number" name="desserts" min="0" value="0"></label>
      <button type="submit">Calculate</button>
    </form>

    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Sandwich cost</th><td>$<?php // TODO: echo the sandwich cost ?></td></tr>
      <tr><th>Drink cost</th><td>$<?php // TODO: echo the drink cost ?></td></tr>
      <tr><th>Dessert cost</th><td>$<?php // TODO: echo the dessert cost ?></td></tr>
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
      { name: 'style.css', editable: false, code: `body{font-family:system-ui,sans-serif;background:#f3efe6;margin:0;padding:24px;color:#2b2b2b}
.card{max-width:440px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #ddd}
.badge{display:inline-block;margin:0 0 8px;padding:3px 10px;border-radius:999px;background:#f1e6db;color:#7a3b1d;font-size:12px;font-weight:600}
h1{margin:0 0 16px;font-size:21px}
label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
input{width:80px;padding:6px}
button{margin-top:6px;padding:8px 16px;background:#7a3b1d;color:#fff;border:0;border-radius:4px;cursor:pointer}
.receipt{width:100%;margin-top:20px;border-collapse:collapse}
.receipt th{text-align:left;font-weight:400;color:#6b6b6b}
.receipt td{text-align:right}
.receipt th,.receipt td{padding:6px 0;border-bottom:1px solid #eee}
.receipt tr.subtotal th,.receipt tr.subtotal td{border-top:2px solid #ddd;font-weight:600;color:#2b2b2b}
.receipt tr.total th,.receipt tr.total td{font-weight:700;font-size:17px;border-bottom:0}
` },
      { name: 'script.js', editable: false, code: `document.querySelectorAll('input[type=number]').forEach(function (el) {
  el.addEventListener('focus', function () { el.select(); });
});
` }
    ]
  },
  part2: {
    title: 'Part 2 – Refactor Using Functions',
    preview: true,
    tests: CAFE_TESTS,
    functions: CAFE_FUNCS_BASE,
    hints: [
      'calculateSubtotal() takes the three item costs as parameters and returns their sum.',
      'calculateDiscount() takes the subtotal and returns 10% of it when the subtotal is 30 or more, otherwise 0.',
      'calculateTax() takes the amount after the discount and returns 5% of it.',
      'Call each function and store its return value, e.g. $subtotal = calculateSubtotal($sandwichCost, $drinkCost, $dessertCost);'
    ],
    files: [
      { name: 'index.php', editable: true, code: `<?php
// Part 2 - Refactor Using Functions

function calculateSubtotal(float $sandwichCost, float $drinkCost, float $dessertCost): float {
    // TODO: return the sum of the three item costs
}

function calculateDiscount(float $subtotal): float {
    // TODO: return 10% of $subtotal when it is 30 or more, otherwise return 0
}

function calculateTax(float $amountAfterDiscount): float {
    // TODO: return 5% of $amountAfterDiscount
}

$sandwichPrice = 8.50;
$drinkPrice    = 2.50;
$dessertPrice  = 4.00;

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';

if ($submitted) {
    $sandwiches = (int) ($_POST['sandwiches'] ?? 0);
    $drinks     = (int) ($_POST['drinks'] ?? 0);
    $desserts   = (int) ($_POST['desserts'] ?? 0);

    $sandwichCost = $sandwiches * $sandwichPrice;
    $drinkCost    = $drinks * $drinkPrice;
    $dessertCost  = $desserts * $dessertPrice;

    // TODO: $subtotal = calculateSubtotal($sandwichCost, $drinkCost, $dessertCost);

    // TODO: $discount = calculateDiscount($subtotal);

    // TODO: $tax = calculateTax($subtotal - $discount);

    // TODO: $final = ...

}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Student Café</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Part 2 of 3</p>
    <h1>Student Café Order Calculator</h1>
    <form method="post">
      <label>Sandwiches <input type="number" name="sandwiches" min="0" value="0"></label>
      <label>Drinks <input type="number" name="drinks" min="0" value="0"></label>
      <label>Desserts <input type="number" name="desserts" min="0" value="0"></label>
      <button type="submit">Calculate</button>
    </form>

    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Sandwich cost</th><td>$<?php // TODO: echo the sandwich cost ?></td></tr>
      <tr><th>Drink cost</th><td>$<?php // TODO: echo the drink cost ?></td></tr>
      <tr><th>Dessert cost</th><td>$<?php // TODO: echo the dessert cost ?></td></tr>
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
      { name: 'style.css', editable: false, code: `body{font-family:system-ui,sans-serif;background:#eef4f1;margin:0;padding:24px;color:#213330}
.card{max-width:440px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #d7e5e0}
.badge{display:inline-block;margin:0 0 8px;padding:3px 10px;border-radius:999px;background:#dcefe6;color:#1f5c46;font-size:12px;font-weight:600}
h1{margin:0 0 16px;font-size:21px}
label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
input{width:80px;padding:6px}
button{margin-top:6px;padding:8px 16px;background:#2d6a4f;color:#fff;border:0;border-radius:4px;cursor:pointer}
.receipt{width:100%;margin-top:20px;border-collapse:collapse}
.receipt th{text-align:left;font-weight:400;color:#5f6f6b}
.receipt td{text-align:right}
.receipt th,.receipt td{padding:6px 0;border-bottom:1px solid #e7efec}
.receipt tr.subtotal th,.receipt tr.subtotal td{border-top:2px solid #d7e5e0;font-weight:600;color:#213330}
.receipt tr.total th,.receipt tr.total td{font-weight:700;font-size:17px;border-bottom:0}
` },
      { name: 'script.js', editable: false, code: `document.querySelectorAll('input[type=number]').forEach(function (el) {
  el.addEventListener('focus', function () { el.select(); });
});
` }
    ]
  },
  part3: {
    title: 'Part 3 – Refactor Using Associative Arrays',
    preview: true,
    tests: CAFE_TESTS,
    functions: CAFE_FUNCS_ARRAYS,
    hints: [
      'Loop with foreach ($prices as $item => $price) and multiply by $quantities[$item] to fill $costs[$item].',
      'array_sum($costs) adds up every value in the $costs array, giving you the subtotal.',
      'The discount and tax rules are the same as Parts 1 and 2, just applied to the array-based subtotal.',
      'You can read a specific cost back out for display with $costs["sandwich"], $costs["drink"] and $costs["dessert"].'
    ],
    files: [
      { name: 'index.php', editable: true, code: `<?php
// Part 3 - Refactor Using Associative Arrays

$prices = [
    "sandwich" => 8.50,
    "drink"    => 2.50,
    "dessert"  => 4.00,
];

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';

if ($submitted) {
    $quantities = [
        "sandwich" => (int) ($_POST['sandwiches'] ?? 0),
        "drink"    => (int) ($_POST['drinks'] ?? 0),
        "dessert"  => (int) ($_POST['desserts'] ?? 0),
    ];

    $costs = [];
    // TODO: loop over $prices with foreach ($prices as $item => $price)
    //       and set $costs[$item] = $price * $quantities[$item]


    // TODO: calculate $subtotal from $costs (try array_sum())


    // TODO: calculate $discount (10% when $subtotal is 30 or more, otherwise 0)


    // TODO: calculate $tax (5% of the subtotal after the discount)


    // TODO: calculate $final

}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Student Café</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer><\/script>
</head>
<body>
  <main class="card">
    <p class="badge">Part 3 of 3</p>
    <h1>Student Café Order Calculator</h1>
    <form method="post">
      <label>Sandwiches <input type="number" name="sandwiches" min="0" value="0"></label>
      <label>Drinks <input type="number" name="drinks" min="0" value="0"></label>
      <label>Desserts <input type="number" name="desserts" min="0" value="0"></label>
      <button type="submit">Calculate</button>
    </form>

    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Sandwich cost</th><td>$<?php // TODO: echo $costs['sandwich'] ?></td></tr>
      <tr><th>Drink cost</th><td>$<?php // TODO: echo $costs['drink'] ?></td></tr>
      <tr><th>Dessert cost</th><td>$<?php // TODO: echo $costs['dessert'] ?></td></tr>
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
      { name: 'style.css', editable: false, code: `body{font-family:system-ui,sans-serif;background:#f0eef7;margin:0;padding:24px;color:#2b2740}
.card{max-width:440px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #ddd8ee}
.badge{display:inline-block;margin:0 0 8px;padding:3px 10px;border-radius:999px;background:#e5e0f5;color:#463a8c;font-size:12px;font-weight:600}
h1{margin:0 0 16px;font-size:21px}
label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
input{width:80px;padding:6px}
button{margin-top:6px;padding:8px 16px;background:#4a3f8c;color:#fff;border:0;border-radius:4px;cursor:pointer}
.receipt{width:100%;margin-top:20px;border-collapse:collapse}
.receipt th{text-align:left;font-weight:400;color:#655f80}
.receipt td{text-align:right}
.receipt th,.receipt td{padding:6px 0;border-bottom:1px solid #ede9f7}
.receipt tr.subtotal th,.receipt tr.subtotal td{border-top:2px solid #ddd8ee;font-weight:600;color:#2b2740}
.receipt tr.total th,.receipt tr.total td{font-weight:700;font-size:17px;border-bottom:0}
` },
      { name: 'script.js', editable: false, code: `document.querySelectorAll('input[type=number]').forEach(function (el) {
  el.addEventListener('focus', function () { el.select(); });
});
` }
    ]
  },
  blank: { title: 'Blank PHP Editor', preview: false, stdin: '', hints: [], files: [{ name: 'index.php', editable: true, code: '<?php\n\n' }] }
};
