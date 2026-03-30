export function toAbsolute(
  value: string | number | undefined,
  upper: number,
): number {
  if (value === undefined || upper === undefined) {
    return 0;
  }
  if (typeof value === "string") {
    const components = value.split("%");
    if (components.length > 1) {
      return (Number(components[0]) / 100) * upper;
    }
  }
  return Number(value);
}

export function applyTextTransform(input: string, operation: string): string {
  switch (operation) {
    case "lowercase":
      return input.toLowerCase();
    case "lowercase-spacing-1":
      return input.toLowerCase().split("").join(" ");
    case "uppercase":
      return input.toUpperCase();
    case "uppercase-spacing-1":
      return input.toUpperCase().split("").join(" ");
    default:
      console.warn(`Unknown transform operation: ${operation}`);
      return input;
  }
}

export function maxArrayElem<T>(arr: Array<T>): T {
  return arr.reduce((max, cur) => (cur > max ? cur : max), arr[0]);
}

export function minArrayElem<T>(arr: Array<T>): T {
  return arr.reduce((min, cur) => (cur < min ? cur : min), arr[0]);
}
