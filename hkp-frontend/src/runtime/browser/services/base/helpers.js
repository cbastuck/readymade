export function sleep(t) {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}

export function roundWithNDecimals(x, n) {
  const m = n * 10;
  return Math.round(x * m) / m;
}
