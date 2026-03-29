export function sleep(t: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}

export function roundWithNDecimals(x: number, n: number): number {
  const m = n * 10;
  return Math.round(x * m) / m;
}
