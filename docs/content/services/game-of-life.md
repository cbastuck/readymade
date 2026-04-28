# Game of Life

Simulates Conway's Game of Life on an infinite sparse grid and renders each generation as canvas draw commands.

---

## Available in

| Runtime | Service IDs |
|---|---|
| Browser | `hookup.to/service/game-of-life`, `hookup.to/service/game-of-life-renderer` |

---

## Two-service pipeline

The simulation is split across two services for separation of concerns:

| Service | Responsibility |
|---|---|
| **Game of Life** | Pure simulation — advances the grid by one generation per tick and emits a frame descriptor |
| **Game of Life Renderer** | Pure rendering — converts the frame descriptor into canvas draw commands |

Connect them in sequence, then pipe the Renderer's output into a [Canvas](./canvas.md) service.

```
Timer → Game of Life → Game of Life Renderer → Canvas
```

---

## Game of Life

**Service ID:** `hookup.to/service/game-of-life`

### What it does

Maintains a sparse infinite grid using a `Set<string>` of `"row,col"` keys. On each `process()` call it advances by one generation using standard Conway rules (birth at 3 neighbours; survival at 2 or 3; otherwise death). The initial state is the **Gosper Glider Gun** — the classic infinite-growth pattern.

### Output shape

```typescript
{
  generation: number;
  objects: GolObject[];
}
```

Each `GolObject` is a maximal connected component (8-connectivity) of alive cells:

```typescript
{
  row: number;      // top-left row of the bounding box
  col: number;      // top-left col of the bounding box
  matrix: number[][];  // [rowIndex][colIndex], 1=alive 0=dead
}
```

### Configuration

| Property | Type | Description |
|---|---|---|
| `reset` | `boolean` | Resets the grid to the initial Gosper Glider Gun seed |

---

## Game of Life Renderer

**Service ID:** `hookup.to/service/game-of-life-renderer`

### What it does

Receives a `GolFrame`, culls cells outside the visible viewport, and emits an array of `{ type: "rect", ... }` draw commands compatible with the [Canvas](./canvas.md) service. The viewport pans smoothly toward the centre of mass of all alive cells using exponential blending.

Objects are color-coded by size:
- Large structures (≥ 20 cells, e.g. the gun) — deep blue
- Mid-size (5–19 cells, e.g. gliders in transit) — deep green
- Small / still-lifes (< 5 cells) — deep red

### Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `cellSize` | `number` | `6` | Size of each cell in pixels |
| `canvasWidth` | `number` | `800` | Width of the target canvas in pixels |
| `canvasHeight` | `number` | `600` | Height of the target canvas in pixels |

### Input / Output

| | Shape |
|---|---|
| **Input** | `GolFrame` from the Game of Life service |
| **Output** | Array of Canvas rect draw commands |
