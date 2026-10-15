import { expect, it } from "vitest";
import {
  documentationIndex,
  readDocumentation,
  searchDocumentation,
} from "./documentation";
it("ships repository service contracts and runnable board examples", async () => {
  expect(documentationIndex).toContain("docs/services/camera.md");
  expect(documentationIndex).toContain("boards/face-alert-board.json");
  const [camera, example] = await readDocumentation([
    "docs/services/camera.md",
    "boards/face-alert-board.json",
  ]);
  expect(camera.content).toContain("triggerSnapshot");
  expect(JSON.parse(example.content).runtimes.length).toBeGreaterThan(0);
  expect((await searchDocumentation("camera detect")).length).toBeGreaterThan(
    0,
  );
  await expect(readDocumentation(["../secrets"])).rejects.toThrow("Unknown");
});
