import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DownloadDescriptor from "../Download";
import FileSourceDescriptor from "../FileSource";

/** A blob's text; jsdom's Blob has no `text()`. */
function textOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function create(descriptor: any, state: Record<string, unknown> = {}) {
  const app = { notify: vi.fn(), log: vi.fn(), next: vi.fn() };
  const svc: any = descriptor.create(app, "test-board", descriptor, "svc");
  svc.configure(state);
  app.notify.mockClear();
  return { svc, app };
}

describe("Download", () => {
  let saved: { name: string; blob: Blob }[] = [];
  const blobs = new Map<string, Blob>();

  beforeEach(() => {
    saved = [];
    let n = 0;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:test/${++n}`;
      blobs.set(url, blob);
      return url;
    }) as any;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        saved.push({ name: this.download, blob: blobs.get(this.href)! });
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves text under its filename and passes it on", async () => {
    const { svc, app } = create(DownloadDescriptor, { filename: "tennis.sql" });
    const text = "BEGIN TRANSACTION;\nCOMMIT;\n";
    expect(svc.process(text)).toBe(text);
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("tennis.sql");
    expect(saved[0].blob.type).toBe("text/plain;charset=utf-8");
    expect(await textOf(saved[0].blob)).toBe(text);
    expect(app.notify).toHaveBeenCalledWith(svc, {
      saved: "tennis.sql",
      bytes: text.length,
      error: "",
    });
  });

  it("saves anything else as its JSON, and bytes as bytes", async () => {
    const { svc } = create(DownloadDescriptor, { filename: "rows.json" });
    svc.process({ rows: [1, 2] });
    expect(saved[0].blob.type).toBe("application/json");
    expect(JSON.parse(await textOf(saved[0].blob))).toEqual({ rows: [1, 2] });

    svc.process(new Uint8Array([1, 2, 3]));
    expect(saved[1].blob.type).toBe("application/octet-stream");
    expect(saved[1].blob.size).toBe(3);
  });

  it("uses the configured type when there is one", () => {
    const { svc } = create(DownloadDescriptor, { mimeType: "application/sql" });
    svc.process("SELECT 1;");
    expect(saved[0].blob.type).toBe("application/sql");
  });

  it("saves nothing when nothing arrives", () => {
    const { svc } = create(DownloadDescriptor);
    expect(svc.process(null)).toBeNull();
    expect(saved).toEqual([]);
  });
});

describe("File Source handed a file", () => {
  it("reads it as text, tells the picker it is done, and passes it on", async () => {
    const { svc, app } = create(FileSourceDescriptor);
    const file = new File(["CREATE TABLE t (n);"], "dump.sql", {
      type: "application/sql",
    });
    await svc.send(file);
    expect(app.notify.mock.calls.map((call) => call[1])).toEqual([
      { progress: "Reading dump.sql…" },
      { progress: "" },
    ]);
    expect(app.next).toHaveBeenCalledWith(svc, "CREATE TABLE t (n);");
  });
});
