import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toAbsolute,
  applyTextTransform,
  maxArrayElem,
  minArrayElem,
} from "../canvasUtils";

describe("toAbsolute", () => {
  it("converts a percentage string to an absolute value", () => {
    expect(toAbsolute("50%", 200)).toBe(100);
  });

  it("handles 100% with upper 400", () => {
    expect(toAbsolute("100%", 400)).toBe(400);
  });

  it("converts a numeric string to a number", () => {
    expect(toAbsolute("150", 999)).toBe(150);
  });

  it("returns a plain number as-is", () => {
    expect(toAbsolute(42, 999)).toBe(42);
  });

  it("returns 0 when value is undefined", () => {
    expect(toAbsolute(undefined, 200)).toBe(0);
  });

  it("returns 0 when upper is 0 and value is a percentage", () => {
    expect(toAbsolute("50%", 0)).toBe(0);
  });
});

describe("applyTextTransform", () => {
  it("lowercases input for 'lowercase' operation", () => {
    expect(applyTextTransform("Hello World", "lowercase")).toBe("hello world");
  });

  it("uppercases input for 'uppercase' operation", () => {
    expect(applyTextTransform("Hello World", "uppercase")).toBe("HELLO WORLD");
  });

  it("lowercases and joins with spaces for 'lowercase-spacing-1'", () => {
    expect(applyTextTransform("AB", "lowercase-spacing-1")).toBe("a b");
  });

  it("uppercases and joins with spaces for 'uppercase-spacing-1'", () => {
    expect(applyTextTransform("ab", "uppercase-spacing-1")).toBe("A B");
  });

  it("returns input unchanged for unknown operation and emits console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = applyTextTransform("Hello", "unknown-op");
    expect(result).toBe("Hello");
    expect(warnSpy).toHaveBeenCalledWith(
      "Unknown transform operation: unknown-op",
    );
    warnSpy.mockRestore();
  });
});

describe("maxArrayElem", () => {
  it("returns the maximum element from a positive number array", () => {
    expect(maxArrayElem([1, 5, 3])).toBe(5);
  });

  it("returns the maximum element from a negative number array", () => {
    expect(maxArrayElem([-3, -1, -2])).toBe(-1);
  });

  it("returns the single element when array has one item", () => {
    expect(maxArrayElem([42])).toBe(42);
  });
});

describe("minArrayElem", () => {
  it("returns the minimum element from a positive number array", () => {
    expect(minArrayElem([1, 5, 3])).toBe(1);
  });

  it("returns the minimum element from a negative number array", () => {
    expect(minArrayElem([-3, -1, -2])).toBe(-3);
  });

  it("returns the single element when array has one item", () => {
    expect(minArrayElem([7])).toBe(7);
  });
});
