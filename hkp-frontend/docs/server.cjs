#!/usr/bin/env node
/**
 * docs/server.js — Serve the hkp docs as rendered HTML in your browser.
 * No npm install required; uses only Node built-ins.
 *
 * Usage:  node docs/server.js [port]
 *         open http://localhost:3333
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.argv[2] || '3333', 10);
const DOCS_ROOT = path.resolve(__dirname);

// ─── helpers ────────────────────────────────────────────────────────────────

function isInsideDocsRoot(filePath) {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(DOCS_ROOT + path.sep) || resolved === DOCS_ROOT;
}

function walkMd(dir, base) {
  const entries = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = path.relative(base, full);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push({ type: 'dir', name, rel, children: walkMd(full, base) });
    } else if (name.endsWith('.md')) {
      entries.push({ type: 'file', name, rel });
    }
  }
  return entries;
}

function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

// ─── HTML shell ─────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>hkp docs</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-light.min.css">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         display: flex; height: 100vh; overflow: hidden; background: #f6f8fa; color: #1f2328; }

  /* sidebar */
  nav { width: 260px; min-width: 180px; overflow-y: auto; background: #fff;
        border-right: 1px solid #d1d9e0; padding: 16px 0; flex-shrink: 0; }
  nav h1 { font-size: 13px; font-weight: 700; text-transform: uppercase;
           letter-spacing: .06em; color: #57606a; padding: 4px 16px 12px; }
  nav ul { list-style: none; }
  nav li { }
  nav .dir-label { font-size: 11px; font-weight: 600; text-transform: uppercase;
                   letter-spacing: .07em; color: #57606a; padding: 12px 16px 4px; }
  nav a { display: block; padding: 5px 16px; font-size: 13px; color: #1f2328;
          text-decoration: none; border-radius: 0; transition: background .12s; }
  nav a:hover { background: #f0f3f6; }
  nav a.active { background: #0969da1a; color: #0969da; font-weight: 600; }

  /* content */
  main { flex: 1; overflow-y: auto; padding: 40px 48px; }
  article { max-width: 820px; margin: 0 auto; }

  /* markdown overrides */
  .markdown-body { font-size: 15px; line-height: 1.7; }
  .markdown-body h1 { border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; margin-top: 0; }
  .markdown-body table { display: table; width: 100%; }
  .markdown-body code { font-size: 13px; }
  .markdown-body pre { font-size: 13px; }

  /* placeholder */
  #placeholder { color: #57606a; font-size: 15px; margin-top: 60px; text-align: center; }
  #placeholder h2 { font-size: 22px; margin-bottom: 8px; color: #1f2328; }
</style>
</head>
<body>
<nav id="nav">
  <h1>hkp docs</h1>
  <ul id="tree"></ul>
</nav>
<main>
  <article id="content">
    <div id="placeholder">
      <h2>hkp documentation</h2>
      <p>Select a page from the sidebar to get started.</p>
    </div>
  </article>
</main>
<script>
(async () => {
  const tree = document.getElementById('tree');
  const content = document.getElementById('content');

  // ── fetch file tree ──────────────────────────────────────────────────────
  const files = await fetch('/api/files').then(r => r.json());

  function label(name) {
    return name.replace(/\.md$/, '').replace(/-/g, ' ');
  }

  function buildTree(nodes, ul) {
    for (const node of nodes) {
      if (node.type === 'dir') {
        const li = document.createElement('li');
        li.innerHTML = '<div class="dir-label">' + label(node.name) + '</div>';
        const sub = document.createElement('ul');
        buildTree(node.children, sub);
        li.appendChild(sub);
        ul.appendChild(li);
      } else {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.dataset.path = node.rel;
        a.textContent = label(node.name);
        a.addEventListener('click', e => { e.preventDefault(); loadFile(node.rel, a); });
        li.appendChild(a);
        ul.appendChild(li);
      }
    }
  }

  buildTree(files, tree);

  // ── load & render a file ─────────────────────────────────────────────────
  async function loadFile(relPath, anchor) {
    document.querySelectorAll('nav a.active').forEach(el => el.classList.remove('active'));
    if (anchor) anchor.classList.add('active');
    const md = await fetch('/api/file?path=' + encodeURIComponent(relPath)).then(r => r.text());
    content.innerHTML = '<div class="markdown-body">' + marked.parse(md) + '</div>';
    content.scrollTop = 0;
    window.location.hash = encodeURIComponent(relPath);
  }

  // ── restore from hash on load ────────────────────────────────────────────
  if (window.location.hash) {
    const relPath = decodeURIComponent(window.location.hash.slice(1));
    const anchor = document.querySelector('a[data-path="' + CSS.escape(relPath) + '"]');
    if (anchor) loadFile(relPath, anchor);
  }
})();
</script>
</body>
</html>`;

// ─── request handler ─────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // GET /
  if (pathname === '/' || pathname === '') {
    return send(res, 200, 'text/html; charset=utf-8', HTML);
  }

  // GET /api/files  → JSON tree of all .md files
  if (pathname === '/api/files') {
    try {
      const tree = walkMd(DOCS_ROOT, DOCS_ROOT).filter(n => n.name !== 'server.js');
      return send(res, 200, 'application/json', JSON.stringify(tree));
    } catch (e) {
      return send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
  }

  // GET /api/file?path=relative/path.md  → raw markdown
  if (pathname === '/api/file') {
    const rel = parsed.query.path || '';
    // sanitise: must stay inside docs root, must be .md
    if (!rel.endsWith('.md') || rel.includes('\0')) {
      return send(res, 400, 'text/plain', 'Bad path');
    }
    const abs = path.resolve(DOCS_ROOT, rel);
    if (!isInsideDocsRoot(abs)) {
      return send(res, 403, 'text/plain', 'Forbidden');
    }
    fs.readFile(abs, 'utf8', (err, data) => {
      if (err) return send(res, 404, 'text/plain', 'Not found');
      send(res, 200, 'text/markdown; charset=utf-8', data);
    });
    return;
  }

  send(res, 404, 'text/plain', 'Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`hkp docs → http://localhost:${PORT}`);
});
