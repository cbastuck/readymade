import { readFile } from "node:fs/promises";
import path from "node:path";

async function resolveGitDir(worktree: string): Promise<string | undefined> {
  const marker = path.join(worktree, ".git");
  try {
    const value = (await readFile(marker, "utf8")).trim();
    const match = /^gitdir:\s*(.+)$/.exec(value);
    return match ? path.resolve(worktree, match[1]) : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EISDIR") return marker;
    return undefined;
  }
}

export async function readCommit(worktree: string): Promise<string> {
  const gitDir = await resolveGitDir(worktree);
  if (!gitDir) return "unknown";
  try {
    const head = (await readFile(path.join(gitDir, "HEAD"), "utf8")).trim();
    if (!head.startsWith("ref: ")) return head;
    const ref = head.slice(5);
    try {
      return (await readFile(path.join(gitDir, ref), "utf8")).trim();
    } catch {
      const packed = await readFile(path.join(gitDir, "packed-refs"), "utf8");
      const line = packed.split("\n").find((entry) => entry.endsWith(` ${ref}`));
      return line?.split(" ")[0] ?? "unknown";
    }
  } catch {
    return "unknown";
  }
}
