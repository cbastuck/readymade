export interface FileEntry {
  type: 'file' | 'dir';
  name: string;
  rel: string;
  children?: FileEntry[];
}

export async function fetchFiles(): Promise<FileEntry[]> {
  const res = await fetch('/api/files');
  if (!res.ok) throw new Error(`/api/files returned ${res.status}`);
  return res.json();
}

export async function fetchMarkdown(rel: string): Promise<string> {
  const res = await fetch('/api/md?path=' + encodeURIComponent(rel));
  if (!res.ok) throw new Error(`/api/md returned ${res.status}`);
  return res.text();
}
