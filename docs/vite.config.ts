import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { IncomingMessage, ServerResponse } from 'http';

const CONTENT_ROOT = path.resolve(__dirname, 'content');

interface FileEntry {
  type: 'file' | 'dir';
  name: string;
  rel: string;
  children?: FileEntry[];
}

function walkMd(dir: string, base: string): FileEntry[] {
  const entries: FileEntry[] = [];
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

function isInsideContentRoot(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(CONTENT_ROOT + path.sep) || resolved === CONTENT_ROOT;
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendText(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function parseQuery(req: IncomingMessage): URLSearchParams {
  const raw = req.url ?? '';
  const qIndex = raw.indexOf('?');
  return new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : '');
}

function docsApiPlugin() {
  return {
    name: 'docs-api',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';

        if (url === '/api/files' || url.startsWith('/api/files?')) {
          try {
            sendJson(res, 200, walkMd(CONTENT_ROOT, CONTENT_ROOT));
          } catch (e: any) {
            sendJson(res, 500, { error: e.message });
          }
          return;
        }

        if (url.startsWith('/api/md')) {
          const rel = parseQuery(req).get('path') ?? '';
          if (!rel.endsWith('.md') || rel.includes('\0') || rel.includes('..')) {
            return sendText(res, 400, 'Bad path');
          }
          const abs = path.resolve(CONTENT_ROOT, rel);
          if (!isInsideContentRoot(abs)) {
            return sendText(res, 403, 'Forbidden');
          }
          fs.readFile(abs, 'utf8', (err, data) => {
            if (err) return sendText(res, 404, 'Not found');
            sendText(res, 200, data);
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), docsApiPlugin()],
  server: { port: 3333 },
});
