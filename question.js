/* ------------------------------------------------------------------
   QUESTIONS  (link students to  index.html?q=cafe-web )
   files   : the run file is the first .php file (index.php).
             editable:false makes a file read-only (CSS/JS you provide).
             Other files are inlined into the preview automatically when
             the page uses <link href="style.css"> or <script src="script.js">.
   preview : true  = show rendered page. false = plain text output only.
   stdin   : text for the Input box (readline()/fgets(STDIN)). Omit to hide the box.
   hints   : optional array, revealed one at a time.
------------------------------------------------------------------- */
const QUESTIONS = {
  "cafe-web": {
    title: "Student Café Order Calculator (web page)",
    preview: true,
    hints: [
      "Subtotal = (sandwiches × 8.50) + (drinks × 2.50) + (desserts × 4.00).",
      "Apply the 10% discount only when the subtotal is 30 or more. The 5% tax is added after the discount.",
      "Use number_format($value, 2) to display two decimal places.",
    ],
    files: [
      {
        name: "index.php",
        editable: true,
        code: `<?php
const SANDWICH_PRICE = 8.50;
const DRINK_PRICE    = 2.50;
const DESSERT_PRICE  = 4.00;

$submitted = $_SERVER['REQUEST_METHOD'] === 'POST';

if ($submitted) {
    $sandwiches = (int) ($_POST['sandwiches'] ?? 0);
    $drinks     = (int) ($_POST['drinks'] ?? 0);
    $desserts   = (int) ($_POST['desserts'] ?? 0);

    // TODO: calculate $subtotal, $discount, $tax and $final

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
    <h1>Student Café</h1>
    <form method="post">
      <label>Sandwiches <input type="number" name="sandwiches" min="0" value="0"></label>
      <label>Drinks <input type="number" name="drinks" min="0" value="0"></label>
      <label>Desserts <input type="number" name="desserts" min="0" value="0"></label>
      <button type="submit">Calculate</button>
    </form>

    <?php if ($submitted): ?>
    <table class="receipt">
      <tr><th>Subtotal</th><td>$<?php // TODO: echo the subtotal ?></td></tr>
      <tr><th>Discount</th><td>$<?php // TODO: echo the discount ?></td></tr>
      <tr><th>Tax</th><td>$<?php // TODO: echo the tax ?></td></tr>
      <tr class="total"><th>Final amount</th><td>$<?php // TODO: echo the final amount ?></td></tr>
    </table>
    <?php endif; ?>
  </main>
</body>
</html>
`,
      },
      {
        name: "style.css",
        editable: false,
        code: `body{font-family:system-ui,sans-serif;background:#f3efe6;margin:0;padding:24px;color:#2b2b2b}
.card{max-width:420px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #ddd}
h1{margin:0 0 16px;font-size:22px}
label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
input{width:80px;padding:6px}
button{margin-top:6px;padding:8px 16px;background:#7a3b1d;color:#fff;border:0;border-radius:4px;cursor:pointer}
.receipt{width:100%;margin-top:20px;border-collapse:collapse}
.receipt th{text-align:left}.receipt td{text-align:right}
.receipt th,.receipt td{padding:6px 0;border-bottom:1px solid #eee}
.total{font-weight:700}
`,
      },
      {
        name: "script.js",
        editable: false,
        code: `document.querySelectorAll('input[type=number]').forEach(function (el) {
  el.addEventListener('focus', function () { el.select(); });
});
`,
      },
    ],
  },
  cafe: {
    title: "Student Café Order Calculator",
    preview: false,
    stdin: "2\n2\n1",
    hints: [
      "Subtotal = (sandwiches × 8.50) + (drinks × 2.50) + (desserts × 4.00).",
      "Apply the 10% discount only when the subtotal is 30 or more. The 5% tax is added after the discount.",
      "Use number_format($value, 2) to display two decimal places.",
    ],
    files: [
      {
        name: "index.php",
        editable: true,
        code: `<?php
// Student Café Order Calculator

const SANDWICH_PRICE = 8.50;
const DRINK_PRICE    = 2.50;
const DESSERT_PRICE  = 4.00;

// 1. Ask the customer for their order
$sandwiches = (int) readline("Sandwiches: ");
$drinks     = (int) readline("Drinks: ");
$desserts   = (int) readline("Desserts: ");

// 2. Calculate the subtotal, discount, tax and final amount
// TODO


// 3. Display the results
// TODO

`,
      },
    ],
  },
  functions: {
    title: "Café Calculator with Functions",
    preview: false,
    stdin: "2\n2\n1",
    hints: [],
    files: [
      {
        name: "index.php",
        editable: true,
        code: `<?php
function calculateSubtotal(int $sandwiches, int $drinks, int $desserts): float {
    // TODO
}

function calculateDiscount(float $subtotal): float {
    // TODO
}

function calculateTax(float $amountAfterDiscount): float {
    // TODO
}

// Main program
$sandwiches = (int) readline("Sandwiches: ");
$drinks     = (int) readline("Drinks: ");
$desserts   = (int) readline("Desserts: ");

// TODO: call your functions and display the results

`,
      },
    ],
  },
  blank: {
    title: "PHP Editor",
    preview: false,
    stdin: "",
    hints: [],
    files: [{ name: "index.php", editable: true, code: "<?php\n\n" }],
  },
};
