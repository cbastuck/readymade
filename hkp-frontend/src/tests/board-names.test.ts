import { describe, expect, it } from "vitest";
import { generateRandomName } from "../core/board";
import { moods, objects } from "../core/boardNames";

describe("board names", () => {
  it("are two capitalised words joined by a dash", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRandomName()).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+$/);
    }
  });

  it("draw from word lists without duplicates", () => {
    expect(new Set(moods).size).toBe(moods.length);
    expect(new Set(objects).size).toBe(objects.length);
  });
});
