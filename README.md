# PHP Quiz Editor

A browser-based PHP coding editor for beginner programming labs and quizzes.

## Project structure

```text
php-quiz-editor/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── functions.js
│   ├── questions.js
│   └── script.js
├── README.md
└── .gitignore
```

### What each file does

- `index.html` — page structure/UI only.
- `css/style.css` — all editor and application styling.
- `js/questions.js` — quiz/question definitions and starter files.
- `js/functions.js` — reusable helper/runtime functions such as storage, path handling, PHP input wrapping, and preview inlining.
- `js/script.js` — main application logic, CodeMirror setup, file explorer, reset/undo, hints, and PHP execution.
- `README.md` — project documentation.

## Run locally

Because the application uses JavaScript modules, open it through a local web server rather than double-clicking `index.html`.

For example, with Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Question URLs

The editor supports the existing query-string question selection:

```text
?q=cafe-web
?q=cafe
?q=functions
```

If no `q` parameter is provided, the question picker is shown.

## GitHub Pages

This project is static from the hosting server's perspective. PHP execution is handled in the browser through `php-wasm`, so GitHub Pages can host the application.

1. Create a GitHub repository.
2. Put these files in the repository with the same folder structure.
3. Commit and push the files.
4. In GitHub, open **Settings → Pages**.
5. Select **Deploy from a branch**.
6. Select your main branch and `/ (root)`.
7. Save.
8. Open the generated GitHub Pages URL.

The application will need internet access because CodeMirror and `php-wasm` are loaded from CDNs.

## Adding another question

Add another entry to `QUESTIONS` in `js/questions.js`. Each question can define:

- `title`
- `preview`
- `stdin`
- `hints`
- `files`

A file can be made read-only with:

```js
{ name: 'style.css', editable: false, code: '...' }
```

The first editable PHP file is used as the default run file.
