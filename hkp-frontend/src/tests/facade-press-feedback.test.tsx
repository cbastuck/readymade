import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePressFeedback } from "../facade/pressFeedback";

/**
 * Whether a facade button acknowledges being pressed.
 *
 * A facade widget is styled inline, which has no `:hover` or `:active` to
 * lean on, so the states are tracked in the component. The awkward parts are
 * the ones a stylesheet would have handled for free: a pointer that leaves
 * mid-press, a tap that never leaves at all, and the keyboard.
 */

const mouse = { pointerType: "mouse" } as React.PointerEvent;
const touch = { pointerType: "touch" } as React.PointerEvent;

describe("press feedback", () => {
  it("shows the press while the pointer is down, and stops when it lifts", () => {
    const { result } = renderHook(() => usePressFeedback());

    expect(result.current.style.transform).toBeUndefined();

    act(() => result.current.handlers.onPointerDown());
    expect(result.current.style.transform).toBe("translateY(1px)");

    act(() => result.current.handlers.onPointerUp());
    expect(result.current.style.transform).toBeUndefined();
  });

  it("ends the press when the pointer leaves while still held", () => {
    // The release lands somewhere else, so this element never hears about it
    // and would stay pressed for as long as the panel is open.
    const { result } = renderHook(() => usePressFeedback());

    act(() => result.current.handlers.onPointerEnter(mouse));
    act(() => result.current.handlers.onPointerDown());
    act(() => result.current.handlers.onPointerLeave());

    expect(result.current.style.transform).toBeUndefined();
    expect(result.current.style.backgroundColor).toBeUndefined();
  });

  it("does not leave a tap looking hovered", () => {
    // A touch reports entering and never reports leaving.
    const { result } = renderHook(() => usePressFeedback());

    act(() => result.current.handlers.onPointerEnter(touch));

    expect(result.current.style.backgroundColor).toBeUndefined();
  });

  it("answers the keyboard, which fires a click without a pointer", () => {
    const { result } = renderHook(() => usePressFeedback());

    act(() =>
      result.current.handlers.onKeyDown({ key: " " } as React.KeyboardEvent),
    );
    expect(result.current.style.transform).toBe("translateY(1px)");

    act(() => result.current.handlers.onKeyUp());
    expect(result.current.style.transform).toBeUndefined();
  });

  it("ignores keys that do not press a button", () => {
    const { result } = renderHook(() => usePressFeedback());

    act(() =>
      result.current.handlers.onKeyDown({ key: "Tab" } as React.KeyboardEvent),
    );

    expect(result.current.style.transform).toBeUndefined();
  });

  it("stays inert when the button cannot be pressed", () => {
    const { result } = renderHook(() => usePressFeedback("primary", true));

    act(() => result.current.handlers.onPointerEnter(mouse));
    act(() => result.current.handlers.onPointerDown());

    expect(result.current.style.filter).toBeUndefined();
    expect(result.current.style.transform).toBeUndefined();
  });

  it("darkens a filled button rather than recolouring it", () => {
    const { result } = renderHook(() => usePressFeedback("primary"));

    act(() => result.current.handlers.onPointerEnter(mouse));
    expect(result.current.style.filter).toBe("brightness(0.92)");
    expect(result.current.style.backgroundColor).toBeUndefined();

    act(() => result.current.handlers.onPointerDown());
    expect(result.current.style.filter).toBe("brightness(0.82)");
  });
});
